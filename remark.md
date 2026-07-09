campus-trade-server/
├── models/       ← 数据模型（Mongoose Schema）
├── routes/       ← 路由/控制器（处理 HTTP 请求）
├── middleware/    ← 中间件（如 auth 认证拦截）
├── config/       ← 配置（数据库连接等）
├── utils/        ← 工具函数
└── server.js     ← 入口文件



1. models/（数据模型层）
定义数据结构和业务规则。一共 6 个模型：

文件	对应业务	核心字段
User.js	用户	用户名、密码（自动加密）、昵称、头像、手机号
Product.js	商品	标题/描述/价格/分类/新旧程度/图片/状态（在售/售出/下架）
Order.js	订单	买家、卖家、商品、价格
Conversation.js	会话	参与者、关联商品、最后消息
Message.js	聊天消息	所属会话、发送者、内容、已读状态
Favorite.js	收藏	用户、商品
这里不处理网络请求，只定义"数据长什么样"和"有哪些规则"（比如密码存之前要加密、标题最长 50 字等）。

2. middleware/（中间件层）
请求的安检站。目前只有一个：

文件	作用
auth.js	身份认证拦截——从请求头取出 JWT token，解密出 userId，挂到 req 上给后面的路由用。没有 token 或过期就直接返回 401。
3. routes/（路由/控制器层）
核心业务逻辑都在这里。每个文件对应一个业务模块：

文件	对应的路由前缀	处理的业务
auth.js	/api/auth	注册（校验用户名/密码格式、查重、创建用户、签发 token）→ 登录（验证密码、签发 token）
products.js	/api/products	商品列表（分页+搜索+分类筛选）→ 商品详情（同时 +1 浏览量）→ 发布商品 → 修改商品（禁止改他人）→ 下架商品（级联清收藏/会话）→ 我的发布 → 标记售出
orders.js	/api/orders	购买商品（用 MongoDB 事务保证：原子标记售出 → 删收藏 → 清会话引用 → 创建订单，防止多人同时购买）→ 我的购买记录
chat.js	/api/chat	会话列表（同时算每个会话的未读数）→ 创建会话（通过商品联系卖家）→ 消息列表（分页+自动标记已读）→ 发送消息（同时 WebSocket 推送给对方）→ 标记已读 → 未读总数
favorites.js	/api/favorites	收藏 / 取消收藏 / 收藏列表（过滤已下架商品） / 是否已收藏
user.js	/api/user	个人信息查询/修改
upload.js	/api/upload	图片上传到服务器本地
4. config/（配置层）
文件	作用
db.js	MongoDB 连接 + 清理旧索引
5. server.js（入口 + 组装层）
这个文件是整个应用的入口，负责：

加载环境变量（dotenv）
注册中间件（CORS、JSON 解析、URL 编码、全局限流）
挂载路由到各 URL 前缀（/api/auth、/api/products 等）
静态文件服务（上传的图片，带简易防盗链）
WebSocket 服务（Token 认证 + 连接管理 + 向指定用户推送消息）
启动服务器（先连数据库，连上了再监听 3000 端口）



第一步：确保敏感信息不会泄露
.env 已被 gitignore 了，但建议补一个 .env.example 作为模板，让其他开发者知道需要什么配置：


# 创建 .env.example（不含真实密钥）
echo "JWT_SECRET=your_jwt_secret_here" > .env.example
.env.example 不包含真实密钥，可以安全上传。

第二步：初始化 git 并提交

cd e:/zuomian/Homony/campus-trade-server

# 初始化 git 仓库
git init

# 暂存所有文件（.gitignore 会自动排除 node_modules、.env、uploads）
git add .

# 查看哪些文件会被提交（再确认一遍没有敏感文件）
git status

# 首次提交
git commit -m "feat: 校园二手交易平台后端初始化"
第三步：在 GitHub 创建仓库
打开 github.com/new
Repository name 填 campus-trade-server（或你喜欢的名字）
不要勾选 "Add a README file"（本地已有文件）
不要勾选 ".gitignore"（本地已配好）
点击 "Create repository"
第四步：推送代码
创建完后 GitHub 会显示一段命令，类似：


git remote add origin https://github.com/你的用户名/campus-trade-server.git
git branch -M main
git push -u origin main
运行前要确认的：


# 在推送前最后确认一次 .env 不会被提交
git status
# 输出中不应该出现 .env、node_modules、uploads 里的具体文件
需要我帮你执行前两步（创建 .env.example + git init + 首次提交）吗？
