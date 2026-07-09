const express = require('express');
const Product = require('../models/Product');
const Favorite = require('../models/Favorite');
const Conversation = require('../models/Conversation');
const { auth } = require('../middleware/auth');

const router = express.Router();

// 获取商品列表（分页 + 搜索 + 分类筛选）
router.get('/', async (req, res) => {
  try {
    const { page = 1, size = 10, keyword, category } = req.query;
    const query = { status: 'active' };

    if (keyword) {
      query.$text = { $search: keyword };
    }
    if (category) {
      query.category = category;
    }

    const total = await Product.countDocuments(query);
    const list = await Product.find(
      query,
      keyword ? { score: { $meta: 'textScore' } } : {}
    )
      .populate('seller', 'username nickname avatar')
      .sort(keyword ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip((page - 1) * size)
      .limit(parseInt(size));

    res.json({
      code: 0,
      data: {
        list,
        total,
        page: parseInt(page),
        size: parseInt(size),
        totalPages: Math.ceil(total / size)
      }
    });
  } catch (error) {
    console.error('products 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 获取商品详情
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('seller', 'username nickname avatar');

    if (!product) {
      return res.status(404).json({ code: 404, message: '商品不存在' });
    }

    res.json({ code: 0, data: product });
  } catch (error) {
    console.error('products 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 发布商品
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, price, originalPrice, category, condition, images } = req.body;

    if (!title || price === undefined || price === null || price === '' || !category || !condition) {
      return res.status(400).json({ code: 400, message: '标题、价格、分类、新旧程度为必填项' });
    }

    const product = await Product.create({
      title, description, price, originalPrice,
      category, condition, images,
      seller: req.userId
    });

    res.json({ code: 0, message: '发布成功', data: product });
  } catch (error) {
    console.error('products 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 修改商品
router.put('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ code: 404, message: '商品不存在' });
    }
    if (product.seller.toString() !== req.userId) {
      return res.status(403).json({ code: 403, message: '无权修改他人商品' });
    }

    const updates = req.body;
    delete updates.seller; // 不允许修改卖家
    delete updates.views;
    delete updates.status; // 状态通过专门接口修改

    const updated = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ code: 0, message: '修改成功', data: updated });
  } catch (error) {
    console.error('products 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 删除/下架商品
router.delete('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ code: 404, message: '商品不存在' });
    }
    if (product.seller.toString() !== req.userId) {
      return res.status(403).json({ code: 403, message: '无权操作他人商品' });
    }

    product.status = 'removed';
    await product.save();

    // 级联清理：删除相关收藏、解除会话商品关联
    await Favorite.deleteMany({ product: req.params.id });
    await Conversation.updateMany({ product: req.params.id }, { $set: { product: null } });

    res.json({ code: 0, message: '下架成功' });
  } catch (error) {
    console.error('products 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 我的发布
router.get('/my/list', auth, async (req, res) => {
  try {
    const products = await Product.find({ seller: req.userId })
      .sort({ createdAt: -1 });

    res.json({ code: 0, data: products });
  } catch (error) {
    console.error('products 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 修改商品状态（标记已售出）
router.put('/:id/status', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ code: 404, message: '商品不存在' });
    }
    if (product.seller.toString() !== req.userId) {
      return res.status(403).json({ code: 403, message: '无权操作他人商品' });
    }

    product.status = req.body.status || 'sold';
    await product.save();

    // [S3] 若标记为售出，同步创建 Order 记录，确保购买记录不缺失
    if (req.body.status === 'sold') {
      const Order = require('../models/Order');
      await Order.create({
        buyer: req.userId,
        seller: product.seller,
        product: product._id,
        price: product.price
      });
    }

    res.json({ code: 0, message: '状态更新成功', data: product });
  } catch (error) {
    console.error('products 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
