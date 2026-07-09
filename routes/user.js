const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// 获取个人信息
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.json({ code: 0, data: user });
  } catch (error) {
    console.error('user 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 修改个人信息
router.put('/profile', auth, async (req, res) => {
  try {
    const { nickname, avatar, phone } = req.body;
    const updates = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (avatar !== undefined) updates.avatar = avatar;
    if (phone !== undefined) updates.phone = phone;

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true });
    res.json({ code: 0, message: '修改成功', data: user });
  } catch (error) {
    console.error('user 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
