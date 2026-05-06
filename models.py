# 蒙面畅聊 - 数据库模型
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from config import Config

db = SQLAlchemy()


class User(UserMixin, db.Model):
    """用户表"""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    # 匿名信息 (可为假名)
    nickname = db.Column(db.String(50))  # 昵称
    gender = db.Column(db.String(10))    # 性别: male/female/secret
    age = db.Column(db.Integer)          # 年龄 (可为假)
    bio = db.Column(db.Text)             # 个人简介
    avatar_type = db.Column(db.String(20), default='emoji')  # 虚拟头像类型
    avatar_url = db.Column(db.String(255))  # 虚拟头像URL

    # 人脸识别
    face_encoding = db.Column(db.Text)  # 人脸特征编码(JSON)
    face_registered = db.Column(db.Boolean, default=False)  # 是否已注册人脸

    # VIP和积分
    is_vip = db.Column(db.Boolean, default=False)
    vip_expire_at = db.Column(db.DateTime)
    points = db.Column(db.Integer, default=100)  # 初始赠送100积分

    # 统计
    total_chats = db.Column(db.Integer, default=0)
    total_matches = db.Column(db.Integer, default=0)

    # 状态
    is_online = db.Column(db.Boolean, default=False)
    is_banned = db.Column(db.Boolean, default=False)
    last_seen = db.Column(db.DateTime, default=datetime.now)

    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    # 关系
    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy='dynamic')
    received_messages = db.relationship('Message', foreign_keys='Message.receiver_id', backref='receiver', lazy='dynamic')
    posts = db.relationship('Post', backref='author', lazy='dynamic')
    friendships = db.relationship('Friendship', foreign_keys='Friendship.user_id', backref='user', lazy='dynamic')

    def can_use_feature(self, feature):
        """检查是否可以使用某个功能 (基于VIP或积分)"""
        if self.is_vip and self.vip_expire_at and self.vip_expire_at > datetime.now():
            return True
        # 积分付费解锁将在业务逻辑中处理
        return False

    def __repr__(self):
        return f'<User {self.username}>'


class Friendship(db.Model):
    """好友关系表"""
    __tablename__ = 'friendships'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # 亲密度系统
    chat_rounds = db.Column(db.Integer, default=0)  # 聊天轮数
    chat_duration = db.Column(db.Integer, default=0)  # 聊天时长(分钟)
    intimacy_level = db.Column(db.Integer, default=1)  # 亲密度等级 1-5

    # 关系标签
    relationship_tag = db.Column(db.String(20), default='浅尝辄止')

    # 解锁状态
    unlocked_voice_message = db.Column(db.Boolean, default=False)
    unlocked_voice_call = db.Column(db.Boolean, default=False)
    unlocked_video_call = db.Column(db.Boolean, default=False)

    # 是否被对方解除
    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    # 唯一约束
    __table_args__ = (db.UniqueConstraint('user_id', 'friend_id', name='unique_friendship'),)

    def check_unlock(self, feature):
        """检查功能是否解锁"""
        if feature == 'voice_message':
            return self.unlocked_voice_message
        elif feature == 'voice_call':
            return self.unlocked_voice_call
        elif feature == 'video_call':
            return self.unlocked_video_call
        return False

    def update_intimacy(self):
        """根据聊天轮数更新亲密度和解锁状态"""
        from config import Config

        # 更新解锁状态
        if self.chat_rounds >= Config.UNLOCK_LEVELS['voice_message']:
            self.unlocked_voice_message = True
        if self.chat_rounds >= Config.UNLOCK_LEVELS['voice_call']:
            self.unlocked_voice_call = True
        if self.chat_rounds >= Config.UNLOCK_LEVELS['video_call']:
            self.unlocked_video_call = True

        # 更新亲密度等级
        if self.chat_rounds >= 200:
            self.intimacy_level = 5
            self.relationship_tag = '知己'
        elif self.chat_rounds >= 150:
            self.intimacy_level = 4
            self.relationship_tag = '密友'
        elif self.chat_rounds >= 100:
            self.intimacy_level = 3
            self.relationship_tag = '知心好友'
        elif self.chat_rounds >= 50:
            self.intimacy_level = 2
            self.relationship_tag = '忘年之交'
        else:
            self.intimacy_level = 1
            self.relationship_tag = '浅尝辄止'

        db.session.commit()

    def __repr__(self):
        return f'<Friendship {self.user_id}-{self.friend_id}>'


class Message(db.Model):
    """私聊消息表"""
    __tablename__ = 'messages'

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # 消息类型: text/voice/image/video
    message_type = db.Column(db.String(20), default='text')
    content = db.Column(db.Text)  # 文字内容或语音转文字结果
    media_url = db.Column(db.String(255))  # 语音/视频/图片URL
    duration = db.Column(db.Integer)  # 语音/视频时长(秒)

    is_read = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

    def __repr__(self):
        return f'<Message {self.id} {self.sender_id}->{self.receiver_id}>'


class ChatRoom(db.Model):
    """聊天室/群聊表"""
    __tablename__ = 'chatrooms'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    room_type = db.Column(db.String(20), default='public')  # public/private/voice/video
    max_members = db.Column(db.Integer, default=100)
    current_members = db.Column(db.Integer, default=0)

    # 房间设置
    require_password = db.Column(db.Boolean, default=False)
    password = db.Column(db.String(100))
    allow_anonymous = db.Column(db.Boolean, default=True)

    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.now)

    # 关系
    members = db.relationship('ChatRoomMember', backref='room', lazy='dynamic', cascade='all, delete-orphan')
    messages = db.relationship('RoomMessage', backref='room', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<ChatRoom {self.name}>'


class ChatRoomMember(db.Model):
    """聊天室成员表"""
    __tablename__ = 'chatroom_members'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('chatrooms.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # 成员信息
    nickname = db.Column(db.String(50))  # 房间内昵称
    is_admin = db.Column(db.Boolean, default=False)
    is_muted = db.Column(db.Boolean, default=False)

    joined_at = db.Column(db.DateTime, default=datetime.now)
    last_read_at = db.Column(db.DateTime, default=datetime.now)

    # 唯一约束
    __table_args__ = (db.UniqueConstraint('room_id', 'user_id', name='unique_room_member'),)

    def __repr__(self):
        return f'<ChatRoomMember {self.room_id}-{self.user_id}>'


class RoomMessage(db.Model):
    """聊天室消息表"""
    __tablename__ = 'room_messages'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('chatrooms.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    message_type = db.Column(db.String(20), default='text')
    content = db.Column(db.Text)
    media_url = db.Column(db.String(255))
    duration = db.Column(db.Integer)

    reply_to = db.Column(db.Integer, db.ForeignKey('room_messages.id'))  # 回复的消息ID
    is_deleted = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.now)

    def __repr__(self):
        return f'<RoomMessage {self.id} in room {self.room_id}>'


class Post(db.Model):
    """动态广场 - 动态表"""
    __tablename__ = 'posts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    content = db.Column(db.Text, nullable=False)
    post_type = db.Column(db.String(20), default='text')  # text/image/mood
    image_url = db.Column(db.String(255))

    # 互动统计
    view_count = db.Column(db.Integer, default=0)
    like_count = db.Column(db.Integer, default=0)
    comment_count = db.Column(db.Integer, default=0)

    is_anonymous = db.Column(db.Boolean, default=True)  # 是否匿名发布
    is_deleted = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.now, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    # 关系
    comments = db.relationship('PostComment', backref='post', lazy='dynamic', cascade='all, delete-orphan')
    likes = db.relationship('PostLike', backref='post', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Post {self.id}>'


class PostComment(db.Model):
    """动态评论表"""
    __tablename__ = 'post_comments'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    content = db.Column(db.Text, nullable=False)
    reply_to = db.Column(db.Integer, db.ForeignKey('post_comments.id'))  # 回复的评论ID

    is_deleted = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.now)

    def __repr__(self):
        return f'<PostComment {self.id}>'


class PostLike(db.Model):
    """动态点赞表"""
    __tablename__ = 'post_likes'

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.now)

    # 唯一约束
    __table_args__ = (db.UniqueConstraint('post_id', 'user_id', name='unique_post_like'),)

    def __repr__(self):
        return f'<PostLike {self.post_id}-{self.user_id}>'


class MatchHistory(db.Model):
    """随机匹配历史表"""
    __tablename__ = 'match_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    matched_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    match_type = db.Column(db.String(20), default='random')  # random/filter/paid
    is_liked = db.Column(db.Boolean, default=False)  # 是否喜欢这次匹配

    matched_at = db.Column(db.DateTime, default=datetime.now)

    def __repr__(self):
        return f'<MatchHistory {self.user_id}->{self.matched_user_id}>'


class PaymentOrder(db.Model):
    """支付订单表"""
    __tablename__ = 'payment_orders'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    order_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    order_type = db.Column(db.String(20), nullable=False)  # vip_monthly/vip_yearly/points/unlock
    amount = db.Column(db.Float, nullable=False)
    points = db.Column(db.Integer)  # 获得的积分

    # 支付信息
    payment_method = db.Column(db.String(20))  # wechat/alipay/balance
    payment_status = db.Column(db.String(20), default='pending')  # pending/paid/failed/cancelled
    paid_at = db.Column(db.DateTime)

    # 关联信息
    unlock_feature = db.Column(db.String(50))  # 解锁的功能
    friendship_id = db.Column(db.Integer)  # 关联的好友关系ID

    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    def __repr__(self):
        return f'<PaymentOrder {self.order_no}>'


class SystemLog(db.Model):
    """系统日志表"""
    __tablename__ = 'system_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))

    action = db.Column(db.String(50), nullable=False)
    detail = db.Column(db.Text)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(255))

    created_at = db.Column(db.DateTime, default=datetime.now)

    def __repr__(self):
        return f'<SystemLog {self.id} {self.action}>'
