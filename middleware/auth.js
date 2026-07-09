const jwt = require('jsonwebtoken');

// 检查 JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] 环境变量 JWT_SECRET 未配置，服务拒绝启动。请在 .env 中设置强随机密钥。');
  process.exit(1);
}

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET;

// JWT 验证
const auth = (req, res, next) => {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录' });
  }

  try {
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
};

// 导出
module.exports = { auth, JWT_SECRET };


