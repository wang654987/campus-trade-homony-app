const express = require('express');
const Favorite = require('../models/Favorite');
const { auth } = require('../middleware/auth');

const router = express.Router();

// 收藏商品
router.post('/:productId', auth, async (req, res) => {
  try {
    const exists = await Favorite.findOne({
      user: req.userId,
      product: req.params.productId
    });
    if (exists) {
      return res.json({ code: 0, message: '已收藏', data: { isFavorited: true } });
    }

    await Favorite.create({
      user: req.userId,
      product: req.params.productId
    });
    res.json({ code: 0, message: '收藏成功', data: { isFavorited: true } });
  } catch (error) {
    console.error('favorites 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 取消收藏
router.delete('/:productId', auth, async (req, res) => {
  try {
    await Favorite.findOneAndDelete({
      user: req.userId,
      product: req.params.productId
    });
    res.json({ code: 0, message: '已取消收藏', data: { isFavorited: false } });
  } catch (error) {
    console.error('favorites 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 获取我的收藏列表
router.get('/', auth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.userId })
      .populate({
        path: 'product',
        populate: { path: 'seller', select: 'username nickname avatar' }
      })
      .sort({ createdAt: -1 });

    // 过滤掉已删除/下架的商品
    const validFavorites = favorites.filter(f => f.product && f.product.status === 'active');

    res.json({ code: 0, data: validFavorites });
  } catch (error) {
    console.error('favorites 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 检查是否已收藏
router.get('/check/:productId', auth, async (req, res) => {
  try {
    const exists = await Favorite.findOne({
      user: req.userId,
      product: req.params.productId
    });
    res.json({ code: 0, data: { isFavorited: !!exists } });
  } catch (error) {
    console.error('favorites 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
