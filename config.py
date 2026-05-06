# 蒙面畅聊 - 配置文件
import os

class Config:
    """应用配置"""
    # 基础配置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'maskchat-secret-key-2024'
    DEBUG = True

    # Session配置 - 确保多用户登录独立
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 86400 * 7  # 7天

    # 数据库配置
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///maskchat.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # 文件上传配置
    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'wav', 'mp4'}

    # WebSocket配置 - 使用threading模式更稳定
    SOCKETIO_ASYNC_MODE = 'threading'
    SOCKETIO_CORS_ALLOWED_ORIGINS = '*'
    SOCKETIO_MESSAGE_QUEUE = None  # 简化模式，支持多用户

    # 阶梯解锁配置 (聊天轮数要求)
    # 0-5轮: 初始阶段，仅文字聊天
    # 5轮以上: 解锁语音留言
    # 10轮以上: 解锁语音通话
    # 15轮以上: 解锁视频通话
    UNLOCK_LEVELS = {
        'voice_message': 5,       # 5轮聊天解锁语音留言
        'voice_call': 10,         # 10轮聊天解锁语音通话
        'video_call': 15,         # 15轮聊天解锁视频通话
    }

    # 积分配置
    POINTS_PRICE = {
        'voice_message': 50,      # 付费解锁语音留言
        'voice_call': 100,        # 付费解锁语音通话
        'video_call': 200,        # 付费解锁视频通话
    }

    # VIP配置
    VIP_PRICE_MONTHLY = 29.9
    VIP_PRICE_YEARLY = 299
    VIP_BONUS_POINTS = 1000

    # 关系标签
    RELATIONSHIP_TAGS = [
        '浅尝辄止',
        '普通好友',
        '忘年之交',
        '知心好友',
        '密友',
        '知己'
    ]

    # AVATAR_CATEGORIES - 虚拟头像分类
    AVATAR_CATEGORIES = [
        'animal',      # 动物系
        'cartoon',     # 卡通系
        'emoji',       # 表情系
        'abstract',    # 抽象系
    ]
