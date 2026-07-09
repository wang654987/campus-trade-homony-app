/**
 * 订单路由 — 购买 / 购买记录
 *
 * POST /api/orders         — 创建订单（购买商品）
 *   body: { productId }
 *   逻辑：校验非自购 → 原子更新商品状态为 sold → 删除所有收藏 → 创建订单
 *        副本集下使用 MongoDB 事务保证四步操作原子性
 *        使用 findOneAndUpdate 防止竞态条件
 *
 * GET  /api/orders/my      — 我的购买记录
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Favorite = require('../models/Favorite');
const Conversation = require('../models/Conversation');

// 检测 MongoDB 是否支持事务（需副本集）
let supportsTransactions = null;
async function detectTransactions() {
  if (supportsTransactions !== null) return supportsTransactions;
  try {
    const admin = mongoose.connection.db.admin();
    await admin.command({ replSetGetStatus: 1 });
    supportsTransactions = true;
  } catch {
    supportsTransactions = false;
  }
  return supportsTransactions;
}

/** 创建订单（购买商品） */
router.post('/', auth, async (req, res) => {
  const useTx = await detectTransactions();
  const session = useTx ? await mongoose.startSession() : null;
  if (session) session.startTransaction();

  try {
    const { productId } = req.body;
    if (!productId) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(400).json({ code: 400, message: '缺少商品ID' });
    }

    // 预检查：商品是否存在 + 禁止自购
    const product = await Product.findById(productId);
    if (!product) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(404).json({ code: 404, message: '商品不存在' });
    }
    if (product.seller.toString() === req.userId) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(400).json({ code: 400, message: '不能购买自己的商品' });
    }

    // [S1] 原子操作：仅当 status='active' 时才标记为 sold，防止竞态条件
    const findOpts = { new: true };
    if (session) findOpts.session = session;
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, status: 'active' },
      { $set: { status: 'sold' } },
      findOpts
    );
    if (!updatedProduct) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(400).json({ code: 400, message: '商品已售出或已下架' });
    }

    // [S2] 事务保护：以下操作在副本集下包裹在事务中
    const sessOpt = session ? { session } : {};

    // 2. 删除该商品的所有收藏
    await Favorite.deleteMany({ product: productId }, sessOpt);

    // 3. 清除关联会话的商品引用
    await Conversation.updateMany(
      { product: productId },
      { $set: { product: null } },
      sessOpt
    );

    // 4. 创建订单记录
    let order;
    if (session) {
      // 事务中必须用数组语法传 session
      [order] = await Order.create([{
        buyer: req.userId, seller: product.seller, product: productId, price: product.price
      }], { session });
    } else {
      order = await Order.create({
        buyer: req.userId, seller: product.seller, product: productId, price: product.price
      });
    }

    // 5. WebSocket 通知卖家（事务外，通知失败不回滚）
    const wsServer = req.app.get('wsServer');
    if (wsServer) {
      wsServer.sendToUser(product.seller.toString(), {
        type: 'product_sold',
        data: {
          productId: productId,
          productTitle: product.title,
          buyerId: req.userId,
          price: product.price
        }
      });
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.json({ code: 0, message: '购买成功', data: { orderId: order._id } });
  } catch (e) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) {}
      session.endSession();
    }
    console.error('创建订单失败:', e.message);
    res.status(500).json({ code: 500, message: '购买失败' });
  }
});

/** 我的购买记录 */
router.get('/my', auth, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.userId })
      .populate('product', 'title price images category condition')
      .populate('seller', 'nickname avatar')
      .sort({ createdAt: -1 });

    res.json({ code: 0, data: orders });
  } catch (e) {
    console.error('获取订单失败:', e.message);
    res.status(500).json({ code: 500, message: '获取订单失败' });
  }
});

module.exports = router;
