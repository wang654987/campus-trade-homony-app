require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const rateLimit = require('express-rate-limit');
const { JWT_SECRET } = require('./middleware/auth');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const favoriteRoutes = require('./routes/favorites');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');
const path = require('path');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// 全局限流 - 所有接口
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 500,                  // 最多500次请求
  message: { code: 429, message: '请求过于频繁，请稍后再试' }
}));

// 路由
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20,                   // auth接口最多20次
  message: { code: 429, message: '登录/注册过于频繁，请稍后再试' }
}), authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);

// 静态文件服务 - 上传的图片
// 简易鉴权：检查 Referer 防止外部盗链；App 端通常不发送 Referer，予以放行
// TODO: 生产环境应改为基于 token 的鉴权中间件（参考 #21）
app.use('/uploads', (req, res, next) => {
  // 仅允许服务图片扩展名，防止目录遍历 / 任意文件下载
  const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(req.path).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return res.status(404).json({ code: 404, message: '资源不存在' });
  }
  const referer = req.get('Referer');
  // 放行：无 Referer（App/直接加载）、本地开发、模拟器
  if (!referer ||
      referer.includes('localhost') ||
      referer.includes('127.0.0.1') ||
      referer.includes('10.0.2.2')) {
    return next();
  }
  res.status(403).json({ code: 403, message: '禁止直接访问' });
}, express.static(path.join(__dirname, 'uploads')));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: '校园二手交易平台后端运行中', time: new Date().toISOString() });
});

// 创建 HTTP 服务器
const server = http.createServer(app);

// WebSocket 服务器
const wss = new WebSocketServer({ server, path: '/ws' });

// 用户连接映射：userId → Set<WebSocket>
const connections = new Map();

wss.on('connection', (ws, req) => {
  let userId = null;
  ws.isAuthenticated = false;
  let authTimer = null;

  // 10秒认证超时
  authTimer = setTimeout(() => {
    if (!ws.isAuthenticated) {
      console.log('[WS] 认证超时，关闭连接');
      ws.close(4001, '认证超时');
    }
  }, 10000);

  ws.on('message', (rawData) => {
    // 首条消息必须是认证消息
    if (!ws.isAuthenticated) {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.type === 'auth' && msg.token) {
          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(msg.token, JWT_SECRET);
            userId = decoded.userId;
            ws.isAuthenticated = true;
            clearTimeout(authTimer);

            // 保存连接
            if (!connections.has(userId)) {
              connections.set(userId, new Set());
            }
            connections.get(userId).add(ws);

            console.log(`[WS] 用户 ${userId} 已认证并连接`);
          } catch (e) {
            console.log('[WS] Token 验证失败');
            ws.close(4001, '无效的 token');
          }
        } else {
          console.log('[WS] 首条消息非认证消息');
          ws.close(4001, '请先认证');
        }
      } catch (e) {
        console.log('[WS] 消息格式错误');
        ws.close(4001, '消息格式错误');
      }
      return;
    }

    // 已认证：后续正常消息处理（可扩展）
  });

  ws.on('close', () => {
    clearTimeout(authTimer);
    if (userId && ws.isAuthenticated) {
      const userConns = connections.get(userId);
      if (userConns) {
        userConns.delete(ws);
        if (userConns.size === 0) {
          connections.delete(userId);
        }
      }
      console.log(`[WS] 用户 ${userId} 已断开`);
    }
  });

  ws.on('error', () => {
    clearTimeout(authTimer);
  });
});

// 注入到 app，供路由使用
app.set('wsServer', {
  sendToUser(userId, data) {
    const userConns = connections.get(userId);
    if (userConns) {
      const payload = JSON.stringify(data);
      userConns.forEach(ws => {
        if (ws.readyState === 1) { // OPEN
          ws.send(payload);
        }
      });
    }
  }
});

// 启动
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 校园二手交易平台后端已启动: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket 已启动: ws://localhost:${PORT}/ws`);
    console.log(`📋 API 文档:`);
    console.log(`   POST /api/auth/register      注册`);
    console.log(`   POST /api/auth/login         登录`);
    console.log(`   GET  /api/products           商品列表`);
    console.log(`   GET  /api/products/:id       商品详情`);
    console.log(`   POST /api/products           发布商品`);
    console.log(`   GET  /api/products/my/list   我的发布`);
    console.log(`   POST /api/favorites/:id      收藏`);
    console.log(`   GET  /api/favorites          我的收藏`);
    console.log(`   GET  /api/user/profile       个人信息`);
    console.log(`   GET  /api/chat/conversations  会话列表`);
    console.log(`   POST /api/chat/conversations  创建会话`);
    console.log(`   GET  /api/chat/conversations/:id/messages  消息列表`);
    console.log(`   POST /api/chat/conversations/:id/messages  发送消息`);
    console.log(`   GET  /api/chat/unread                   未读消息计数`);
    console.log(`   POST /api/upload                        上传图片\n`);
  });
});
