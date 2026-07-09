const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ code: 400, message: '参数格式错误' });
    }
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ code: 400, message: '两次密码输入不一致' });
    }
    if (password.length < 8) {
      return res.status(400).json({ code: 400, message: '密码长度至少8位' });
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ code: 400, message: '密码必须包含字母和数字' });
    }

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ code: 400, message: '用户名已被注册' });
    }

    const user = await User.create({ username, password, nickname: username });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ code: 0, message: '注册成功', data: { token, user } });
  } catch (error) {
    console.error('auth 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ code: 400, message: '参数格式错误' });
    }
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ code: 400, message: '用户名或密码错误' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ code: 400, message: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ code: 0, message: '登录成功', data: { token, user } });
  } catch (error) {
    console.error('auth 错误:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
