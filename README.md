# 🎭 蒙面畅聊 - 匿名阶梯交友APP

一款从匿名聊天开始，按聊天深度阶梯解锁真实社交能力的陌生人交友应用。

## ✨ 核心特性

### 1. 匿名身份系统
- 无需实名认证，虚拟头像保护隐私
- 支持多种头像风格：表情系、动物系、卡通系、抽象系
- 可设置虚假年龄、性别等信息

### 2. 阶梯解锁机制
- **Lv.1 文字聊天**：初始即可使用
- **Lv.2 语音留言**：20轮聊天后解锁（或付费50积分）
- **Lv.3 语音通话**：50轮聊天后解锁（或付费100积分）
- **Lv.4 视频聊天**：100轮聊天后解锁（或付费200积分）

### 3. 社交功能
- 随机匹配：智能匹配在线用户
- 一对一私聊：支持文字、语音消息
- 公共聊天室：多人互动交流
- 动态广场：发布动态、点赞评论

### 4. VIP/积分系统
- 积分充值：购买积分解锁高级功能
- VIP会员：享受加速解锁、优先匹配等特权
- 关系标签：浅尝辄止、普通好友、忘年之交、密友、知己

## 📁 项目结构

```
chat_website/
├── chat.py              # 主程序入口
├── models.py            # 数据库模型
├── config.py            # 配置文件
├── requirements.txt     # 依赖包
├── templates/           # HTML模板
│   ├── index.html       # 首页
│   ├── register.html    # 注册页面
│   ├── login.html       # 登录页面
│   └── main.html        # 主界面
└── static/              # 静态资源
    ├── css/
    │   ├── style.css    # 全局样式
    │   └── main.css     # 主界面样式
    └── js/
        ├── main.js      # 全局JavaScript
        └── app.js       # 应用逻辑
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行应用

```bash
python chat.py
```

### 3. 访问应用

打开浏览器访问：[http://localhost:5000](http://localhost:5000)

## 🔧 技术栈

| 类别 | 技术 |
|------|------|
| 后端框架 | Flask 3.0 |
| 实时通信 | Flask-SocketIO + Socket.IO |
| 数据库 | SQLite (开发) / PostgreSQL (生产) |
| 用户认证 | Flask-Login |
| 密码加密 | Werkzeug Security |
| 前端 | HTML5 + CSS3 + JavaScript (ES6+) |
| WebSocket客户端 | Socket.IO Client |

## 📊 数据库模型

### 核心表结构
- **users**: 用户信息表
- **friendships**: 好友关系表（含亲密度、解锁状态）
- **messages**: 私聊消息表
- **chatrooms**: 聊天室表
- **chatroom_members**: 聊天室成员表
- **room_messages**: 聊天室消息表
- **posts**: 动态广场表
- **post_comments**: 动态评论表
- **post_likes**: 动态点赞表
- **match_history**: 匹配历史表
- **payment_orders**: 支付订单表
- **system_logs**: 系统日志表

## 🔌 API接口

### 认证相关
- `POST /register` - 用户注册
- `POST /login` - 用户登录
- `GET /logout` - 用户登出

### 匹配相关
- `POST /api/match/random` - 随机匹配
- `GET /api/friends` - 获取好友列表
- `GET /api/friendship/:id/status` - 获取好友关系状态
- `POST /api/unlock` - 积分解锁功能

### 消息相关
- `GET /api/messages/:friend_id` - 获取聊天记录
- `POST /api/messages/read` - 标记消息已读

### 动态广场
- `GET /api/posts` - 获取动态列表
- `POST /api/posts` - 发布动态
- `POST /api/posts/:id/like` - 点赞动态
- `GET /api/posts/:id/comments` - 获取评论
- `POST /api/posts/:id/comments` - 发表评论

### 用户相关
- `GET /api/user/profile` - 获取用户资料
- `POST /api/user/profile` - 更新用户资料

### 支付相关
- `POST /api/payment/create_order` - 创建支付订单
- `POST /api/payment/callback` - 支付回调

### 聊天室
- `GET /api/chatrooms` - 获取聊天室列表
- `POST /api/chatrooms` - 创建聊天室
- `POST /api/chatrooms/:id/join` - 加入聊天室
- `GET /api/chatrooms/:id/messages` - 获取聊天室消息

## 🔌 WebSocket事件

### 客户端 → 服务器
- `connect` - 连接
- `disconnect` - 断开连接
- `private_message` - 发送私聊消息
- `room_message` - 发送聊天室消息
- `join_room` - 加入聊天室
- `leave_room` - 离开聊天室
- `typing` - 输入状态
- `call_request` - 通话请求
- `call_response` - 通话响应

### 服务器 → 客户端
- `connected` - 连接成功
- `new_message` - 新消息
- `message_sent` - 消息发送确认
- `user_typing` - 用户输入状态
- `incoming_call` - 来电
- `call_response` - 通话响应
- `error` - 错误消息

## 💰 盈利模式

1. **积分充值**：9.9元/100积分、39.9元/500积分、69.9元/1000积分
2. **VIP会员**：29.9元/月、299元/年
3. **功能解锁**：积分解锁语音/视频功能
4. **后续扩展**：礼物打赏、广告、增值服务

## 🔐 安全特性

- 密码加密存储（Werkzeug）
- 内容审核与举报系统
- 用户封禁功能
- 系统日志记录

## 📝 配置说明

编辑 [config.py](config.py) 可修改：
- 数据库连接
- 阶梯解锁轮数要求
- 积分解锁价格
- VIP价格和赠送积分
- 关系标签定义

## 🎯 后续计划

- [ ] WebRTC音视频通话实现
- [ ] 语音消息录制与播放
- [ ] 语音转文字集成
- [ ] 支付宝/微信支付接入
- [ ] 图片上传功能
- [ ] 礼物打赏系统
- [ ] 直播功能
- [ ] 移动端适配优化
- [ ] Redis缓存支持
- [ ] 消息推送

## 📄 许可证

MIT License

## 👨‍💻 作者

毕业设计项目

---

**从陌生到相识，一步一个脚印** 🎭
