const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Product = require('../models/Product');
const { auth } = require('../middleware/auth');

const router = express.Router();

// 获取我的会话列表
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId
    })
      .populate('participants', 'username nickname avatar')
      .populate('product', 'title price images')
      .sort({ updatedAt: -1 });

    // 为每个会话计算未读消息数（对方发来且尚未读），供会话列表显示红点
    const data = await Promise.all(conversations.map(async (conv) => {
      const unreadCount = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: req.userId },
        read: false
      });
      const obj = conv.toObject();
      obj.unreadCount = unreadCount;
      return obj;
    }));

    res.json({ code: 0, data });
  } catch (error) {
    console.error('chat 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 创建或查找会话（通过商品ID联系卖家）
router.post('/conversations', auth, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ code: 400, message: '缺少商品ID' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ code: 404, message: '商品不存在' });
    }

    // 检查商品状态
    if (product.status !== 'active') {
      return res.status(400).json({ code: 400, message: '商品已下架或已售出' });
    }

    // 不能和自己聊天
    if (product.seller.toString() === req.userId) {
      return res.status(400).json({ code: 400, message: '不能联系自己' });
    }

    // 参与者为当前用户和卖家（排序确保一致性）
    const participants = [req.userId, product.seller.toString()].sort();
    const participantKey = participants.join(':');

    // 查找已有会话
    let conversation = await Conversation.findOne({
      participants: { $all: participants, $size: 2 },
      product: productId
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        participantKey,
        product: productId
      });
    }

    await conversation.populate('participants', 'username nickname avatar');
    await conversation.populate('product', 'title price images');

    res.json({ code: 0, data: conversation });
  } catch (error) {
    console.error('chat 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 获取单个会话详情
router.get('/conversations/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .select('participants product')
      .populate('participants', 'username nickname avatar')
      .populate('product', 'title images price status');
    if (!conversation) {
      return res.status(404).json({ code: 404, message: '会话不存在' });
    }
    if (!conversation.participants.map(p => p._id.toString()).includes(req.userId)) {
      return res.status(403).json({ code: 403, message: '无权访问此会话' });
    }
    res.json({ code: 0, data: conversation });
  } catch (error) {
    console.error('chat 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 获取会话消息（分页）
router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { page = 1, size = 30 } = req.query;
    const conversation = await Conversation.findById(req.params.id).select('participants product');
    if (!conversation) {
      return res.status(404).json({ code: 404, message: '会话不存在' });
    }
    if (!conversation.participants.map(p => p.toString()).includes(req.userId)) {
      return res.status(403).json({ code: 403, message: '无权访问此会话' });
    }

    const total = await Message.countDocuments({ conversation: req.params.id });
    // 先按最新优先取当前页，再在内存里反转为时间正序返回（前端结构不变）
    const messages = await Message.find({ conversation: req.params.id })
      .populate('sender', 'username nickname avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * size)
      .limit(parseInt(size));
    messages.reverse();

    // 标记消息为已读
    await Message.updateMany(
      { conversation: req.params.id, sender: { $ne: req.userId }, read: false },
      { $set: { read: true } }
    );

    res.json({
      code: 0,
      data: {
        list: messages,
        total,
        page: parseInt(page),
        size: parseInt(size),
        totalPages: Math.ceil(total / size)
      }
    });
  } catch (error) {
    console.error('chat 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 发送消息
router.post('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ code: 400, message: '消息不能为空' });
    }

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ code: 404, message: '会话不存在' });
    }
    if (!conversation.participants.map(p => p.toString()).includes(req.userId)) {
      return res.status(403).json({ code: 403, message: '无权发送消息' });
    }

    // 找到接收者
    const receiver = conversation.participants.find(
      p => p.toString() !== req.userId
    );

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.userId,
      content: content.trim()
    });
    if (!conversation.participantKey) {
      conversation.participantKey = conversation.participants.map(p => p.toString()).sort().join(':');
    }

    // 更新会话最后消息
    conversation.lastMessage = {
      content: content.trim(),
      sender: req.userId,
      createdAt: message.createdAt
    };
    await conversation.save();

    await message.populate('sender', 'username nickname avatar');

    // WebSocket 推送
    const wsServer = req.app.get('wsServer');
    if (wsServer) {
      wsServer.sendToUser(receiver.toString(), {
        type: 'new_message',
        data: {
          _id: message._id,
          conversation: conversation._id,
          sender: {
            _id: message.sender._id,
            username: message.sender.username,
            nickname: message.sender.nickname,
            avatar: message.sender.avatar
          },
          content: message.content,
          createdAt: message.createdAt
        }
      });
    }

    res.json({ code: 0, data: message });
  } catch (error) {
    console.error('chat 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 将会话标记为已读
router.put('/conversations/:id/read', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).select('participants');
    if (!conversation) {
      return res.status(404).json({ code: 404, message: '会话不存在' });
    }
    if (!conversation.participants.map(p => p.toString()).includes(req.userId)) {
      return res.status(403).json({ code: 403, message: '无权访问此会话' });
    }

    // 将该会话中对方发来的未读消息标记为已读
    await Message.updateMany(
      { conversation: req.params.id, sender: { $ne: req.userId }, read: false },
      { $set: { read: true } }
    );

    // 返回当前用户的全局未读总数
    const conversations = await Conversation.find({
      participants: req.userId
    }).select('_id');
    const conversationIds = conversations.map(c => c._id);
    const count = conversationIds.length === 0 ? 0 : await Message.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: req.userId },
      read: false
    });

    res.json({ code: 0, data: { count } });
  } catch (error) {
    console.error('chat 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 获取未读消息总数
router.get('/unread', auth, async (req, res) => {
  try {
    // 查找当前用户参与的所有会话
    const conversations = await Conversation.find({
      participants: req.userId
    }).select('_id');

    const conversationIds = conversations.map(c => c._id);

    if (conversationIds.length === 0) {
      return res.json({ code: 0, data: { count: 0 } });
    }

    // 统计这些会话中，sender 不是自己且 read=false 的消息数
    const count = await Message.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: req.userId },
      read: false
    });

    res.json({ code: 0, data: { count } });
  } catch (error) {
    console.error('chat 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
