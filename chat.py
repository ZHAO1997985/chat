# 蒙面畅聊 - 主程序
# 匿名阶梯交友APP - 从匿名聊天到真实社交的渐进式体验
"""
蒙面畅聊 (MaskChat) - 匿名阶梯交友APP
========================================
核心功能：
1. 匿名身份系统 - 无需实名，虚拟头像
2. 阶梯解锁机制 - 聊天轮数逐步解锁语音/视频
3. 随机匹配 - 一对一私聊、公共聊天室
4. 动态广场 - 发布动态、互动交流
5. VIP/积分系统 - 付费快速解锁高级功能

技术栈：
- 后端: Flask + Flask-SocketIO (WebSocket)
- 数据库: SQLite (开发) / PostgreSQL (生产)
- 前端: HTML + CSS + JavaScript + Socket.IO客户端
"""

import os
import json
import random
import string
import hashlib
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

from models import db, User, Friendship, Message, ChatRoom, ChatRoomMember, RoomMessage, Post, PostComment, PostLike, MatchHistory, PaymentOrder
from config import Config

# ==================== 应用初始化 ====================
app = Flask(__name__)
app.config.from_object(Config)

# 初始化扩展
db.init_app(app)
# 使用threading模式，更稳定支持多用户并发
socketio = SocketIO(
    app,
    async_mode=app.config.get('SOCKETIO_ASYNC_MODE', 'threading'),
    cors_allowed_origins=app.config.get('SOCKETIO_CORS_ALLOWED_ORIGINS', '*'),
    logger=True,
    engineio_logger=True
)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = '请先登录'

# 确保上传目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


# ==================== 工具函数 ====================
def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def generate_avatar(avatar_type=None):
    """生成虚拟头像URL - 使用本地SVG"""
    # 创建头像目录
    avatar_dir = os.path.join('static', 'avatars')
    os.makedirs(avatar_dir, exist_ok=True)

    # emoji列表
    emoji_list = ['😀', '😎', '🤖', '🦊', '🐱', '🐼', '🦄', '🌈', '⭐', '🔥', '❄️', '🌸', '🎀', '🎈', '🌙', '☀️']
    emoji = random.choice(emoji_list)

    # 背景颜色
    bg_colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF8C42', '#6C5CE7']
    bg_color = random.choice(bg_colors)

    # 生成唯一的头像文件名
    filename = f'avatar_{random.randint(100000, 999999)}.svg'
    filepath = os.path.join(avatar_dir, filename)

    # 检查是否已存在（避免重复生成）
    if os.path.exists(filepath):
        return f'/static/avatars/{filename}'

    # 生成SVG内容
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="{bg_color}" rx="100" ry="100"/>
    <text x="100" y="130" font-size="120" text-anchor="middle" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">{emoji}</text>
</svg>'''

    # 写入文件
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(svg_content)

    return f'/static/avatars/{filename}'


def generate_order_no():
    """生成订单号"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"MC{timestamp}{random_str}"


def calculate_intimacy_level(chat_rounds):
    """根据聊天轮数计算亲密度等级"""
    if chat_rounds >= 200:
        return 5, '知己'
    elif chat_rounds >= 150:
        return 4, '密友'
    elif chat_rounds >= 100:
        return 3, '知心好友'
    elif chat_rounds >= 50:
        return 2, '忘年之交'
    else:
        return 1, '浅尝辄止'


# ==================== 路由处理 ====================
@login_manager.user_loader
def load_user(user_id):
    """Flask-Login用户加载器"""
    return User.query.get(int(user_id))


@app.route('/')
def index():
    """首页 - 跳转到登录或主界面"""
    if current_user.is_authenticated:
        return redirect(url_for('main'))
    return render_template('index.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    """用户注册"""
    if request.method == 'POST':
        data = request.get_json()

        # 验证用户名
        if not data.get('username') or len(data['username']) < 3:
            return jsonify({'success': False, 'message': '用户名至少3个字符'})

        # 检查用户名是否已存在
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'success': False, 'message': '用户名已存在'})

        # 创建新用户
        user = User(
            username=data['username'],
            password_hash=generate_password_hash(data['password']),
            nickname=data.get('nickname', data['username']),
            gender=data.get('gender', 'secret'),
            age=data.get('age') or 18,
            bio=data.get('bio', ''),
            avatar_type=data.get('avatar_type', 'emoji'),
            avatar_url=generate_avatar(data.get('avatar_type', 'emoji')),
            points=100  # 初始赠送100积分
        )

        db.session.add(user)
        db.session.commit()

        return jsonify({'success': True, 'message': '注册成功', 'redirect': url_for('login')})

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    """用户登录"""
    if request.method == 'POST':
        data = request.get_json()
        user = User.query.filter_by(username=data['username']).first()

        if user and check_password_hash(user.password_hash, data['password']):
            if user.is_banned:
                return jsonify({'success': False, 'message': '账号已被封禁'})

            login_user(user)
            user.is_online = True
            user.last_seen = datetime.now()
            db.session.commit()

            return jsonify({
                'success': True,
                'message': '登录成功',
                'redirect': url_for('main'),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'nickname': user.nickname,
                    'avatar_url': user.avatar_url,
                    'is_vip': user.is_vip,
                    'points': user.points
                }
            })

        return jsonify({'success': False, 'message': '用户名或密码错误'})

    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    """用户登出"""
    current_user.is_online = False
    db.session.commit()
    logout_user()
    # 清除session
    session.clear()
    return redirect(url_for('index'))


# ==================== 人脸识别登录 ====================
from face_utils import encode_face, decode_face, compare_faces, extract_face_encoding, verify_face
import cv2
import numpy as np


@app.route('/api/face/register', methods=['POST'])
def face_register():
    """注册人脸"""
    try:
        data = request.get_json()
        image_data = data.get('image')
        username = data.get('username')
        password = data.get('password')

        if not image_data:
            return jsonify({'success': False, 'message': '请提供图片数据'})

        # 如果已登录，使用当前用户
        # 如果未登录，需要验证用户名和密码
        user = current_user if current_user.is_authenticated else None

        if not user and username and password:
            user = User.query.filter_by(username=username).first()
            if user and check_password_hash(user.password_hash, password):
                # 密码验证通过，允许注册人脸
                pass
            else:
                return jsonify({'success': False, 'message': '用户名或密码错误'})

        if not user:
            return jsonify({'success': False, 'message': '请先登录或提供正确的用户名和密码'})

        # 处理base64图片数据
        if ',' in image_data:
            # 去除 data:image/jpeg;base64, 前缀
            image_data = image_data.split(',')[1]

        import base64
        import io
        from PIL import Image

        # 解码base64图片
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        # 转换为RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # 转换为numpy数组
        import numpy as np
        image_array = np.array(image)

        # 使用OpenCV提取人脸特征
        encoding = extract_face_encoding(image_array)

        if encoding is None:
            return jsonify({'success': False, 'message': '未检测到人脸，请确保脸部清晰可见'})

        # 保存人脸特征
        user.face_encoding = encode_face(encoding)
        user.face_registered = True
        db.session.commit()

        return jsonify({'success': True, 'message': '人脸注册成功'})

    except Exception as e:
        return jsonify({'success': False, 'message': f'人脸注册失败: {str(e)}'})


@app.route('/api/face/verify', methods=['POST'])
def face_verify():
    """人脸验证登录"""
    try:
        data = request.get_json()
        image_data = data.get('image')
        username = data.get('username')

        if not image_data:
            return jsonify({'success': False, 'message': '请提供图片数据'})

        if not username:
            return jsonify({'success': False, 'message': '请提供用户名'})

        # 查找用户
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'})

        if not user.face_registered or not user.face_encoding:
            return jsonify({'success': False, 'message': '该用户未注册人脸'})

        # 处理base64图片数据
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        import base64
        import io
        from PIL import Image
        import numpy as np

        # 解码base64图片
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        # 转换为RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')

        image_array = np.array(image)

        # 使用OpenCV验证人脸
        matched, msg = verify_face(user.face_encoding, image_array)

        if matched:
            # 登录成功
            login_user(user)
            user.is_online = True
            user.last_seen = datetime.now()
            db.session.commit()

            return jsonify({
                'success': True,
                'message': '登录成功',
                'redirect': url_for('main'),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'nickname': user.nickname,
                    'avatar_url': user.avatar_url,
                    'is_vip': user.is_vip,
                    'points': user.points
                }
            })
        else:
            return jsonify({'success': False, 'message': msg})

    except Exception as e:
        return jsonify({'success': False, 'message': f'验证失败: {str(e)}'})


@app.route('/api/face/check/<username>', methods=['GET'])
def face_check(username):
    """检查用户是否已注册人脸"""
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'})

    return jsonify({
        'success': True,
        'face_registered': user.face_registered
    })


@app.route('/api/face/clear', methods=['POST'])
@login_required
def face_clear():
    """清除已注册的人脸"""
    try:
        current_user.face_encoding = None
        current_user.face_registered = False
        db.session.commit()

        return jsonify({'success': True, 'message': '人脸已清除'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'})


@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    """API登出"""
    current_user.is_online = False
    db.session.commit()
    logout_user()
    session.clear()
    return jsonify({'success': True, 'message': '登出成功'})


@app.route('/api/upload/voice', methods=['POST'])
@login_required
def upload_voice():
    """上传语音文件"""
    if 'audio' not in request.files:
        return jsonify({'success': False, 'message': '没有音频文件'})

    file = request.files['audio']
    if file.filename == '':
        return jsonify({'success': False, 'message': '文件名为空'})

    # 生成唯一文件名
    import uuid
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'wav'
    if ext not in app.config['ALLOWED_EXTENSIONS']:
        ext = 'wav'

    filename = f'voice_{uuid.uuid4().hex}.{ext}'
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'voices', filename)

    # 确保目录存在
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # 保存文件
    file.save(filepath)

    return jsonify({
        'success': True,
        'url': f'/static/uploads/voices/{filename}'
    })


# ==================== 主界面 ====================
@app.route('/main')
@login_required
def main():
    """主界面 - 包含聊天室和动态广场"""
    return render_template('main.html', user=current_user)


@app.route('/chat')
@login_required
def chat():
    """聊天界面"""
    return render_template('chat.html', user=current_user)


@app.route('/square')
@login_required
def square():
    """动态广场"""
    posts = Post.query.filter_by(is_deleted=False).order_by(Post.created_at.desc()).limit(50).all()
    return render_template('square.html', user=current_user, posts=posts)


# ==================== API接口 ====================

# ---------- 匹配相关 ----------
@app.route('/api/match/random', methods=['POST'])
@login_required
def random_match():
    """随机匹配用户"""
    data = request.get_json()
    prefer_gender = data.get('gender')  # 优先匹配的性别

    # 查找在线用户（排除自己）
    query = User.query.filter(User.id != current_user.id, User.is_online == True, User.is_banned == False)

    if prefer_gender and prefer_gender != 'secret':
        query = query.filter(User.gender == prefer_gender)

    candidates = query.all()

    if not candidates:
        return jsonify({'success': False, 'message': '暂无在线用户'})

    # 随机选择一个用户
    matched_user = random.choice(candidates)

    # 检查是否已有好友关系
    friendship = Friendship.query.filter_by(
        user_id=current_user.id,
        friend_id=matched_user.id
    ).first()

    if not friendship:
        # 创建好友关系
        friendship = Friendship(
            user_id=current_user.id,
            friend_id=matched_user.id
        )
        db.session.add(friendship)

        # 同时创建反向关系
        reverse_friendship = Friendship(
            user_id=matched_user.id,
            friend_id=current_user.id
        )
        db.session.add(reverse_friendship)
        db.session.commit()

        # 更新统计
        current_user.total_matches += 1
        db.session.commit()

    # 记录匹配历史
    match_history = MatchHistory(
        user_id=current_user.id,
        matched_user_id=matched_user.id
    )
    db.session.add(match_history)
    db.session.commit()

    return jsonify({
        'success': True,
        'matched_user': {
            'id': matched_user.id,
            'nickname': matched_user.nickname,
            'avatar_url': matched_user.avatar_url,
            'gender': matched_user.gender,
            'age': matched_user.age,
            'bio': matched_user.bio
        },
        'friendship': {
            'id': friendship.id,
            'chat_rounds': friendship.chat_rounds,
            'intimacy_level': friendship.intimacy_level,
            'relationship_tag': friendship.relationship_tag,
            'unlocked': {
                'voice_message': friendship.unlocked_voice_message,
                'voice_call': friendship.unlocked_voice_call,
                'video_call': friendship.unlocked_video_call
            }
        }
    })


@app.route('/api/friends', methods=['GET'])
@login_required
def get_friends():
    """获取好友列表"""
    friendships = Friendship.query.filter_by(user_id=current_user.id, is_active=True).all()

    friends_data = []
    for fs in friendships:
        friend = User.query.get(fs.friend_id)
        if friend:
            # 获取未读消息数
            unread_count = Message.query.filter_by(
                sender_id=friend.id,
                receiver_id=current_user.id,
                is_read=False
            ).count()

            friends_data.append({
                'id': friend.id,
                'username': friend.username,
                'nickname': friend.nickname if friend.nickname else friend.username,
                'avatar_url': friend.avatar_url,
                'is_online': friend.is_online,
                'unread_count': unread_count,
                'friendship': {
                    'id': fs.id,
                    'chat_rounds': fs.chat_rounds,
                    'intimacy_level': fs.intimacy_level,
                    'relationship_tag': fs.relationship_tag,
                    'unlocked': {
                        'voice_message': fs.unlocked_voice_message,
                        'voice_call': fs.unlocked_voice_call,
                        'video_call': fs.unlocked_video_call
                    }
                }
            })

    return jsonify({'success': True, 'friends': friends_data})


@app.route('/api/friendship/<int:friendship_id>/status', methods=['GET'])
@login_required
def friendship_status(friendship_id):
    """获取好友关系状态（包括解锁进度）"""
    friendship = Friendship.query.get_or_404(friendship_id)

    # 验证权限
    if friendship.user_id != current_user.id:
        return jsonify({'success': False, 'message': '无权访问'}), 403

    from config import Config

    # 计算解锁进度
    progress = {
        'voice_message': {
            'unlocked': friendship.unlocked_voice_message,
            'required': Config.UNLOCK_LEVELS['voice_message'],
            'current': friendship.chat_rounds,
            'progress': min(100, int(friendship.chat_rounds / Config.UNLOCK_LEVELS['voice_message'] * 100))
        },
        'voice_call': {
            'unlocked': friendship.unlocked_voice_call,
            'required': Config.UNLOCK_LEVELS['voice_call'],
            'current': friendship.chat_rounds,
            'progress': min(100, int(friendship.chat_rounds / Config.UNLOCK_LEVELS['voice_call'] * 100))
        },
        'video_call': {
            'unlocked': friendship.unlocked_video_call,
            'required': Config.UNLOCK_LEVELS['video_call'],
            'current': friendship.chat_rounds,
            'progress': min(100, int(friendship.chat_rounds / Config.UNLOCK_LEVELS['video_call'] * 100))
        }
    }

    return jsonify({
        'success': True,
        'friendship': {
            'id': friendship.id,
            'chat_rounds': friendship.chat_rounds,
            'intimacy_level': friendship.intimacy_level,
            'relationship_tag': friendship.relationship_tag,
            'unlocked_voice_message': friendship.unlocked_voice_message,
            'unlocked_voice_call': friendship.unlocked_voice_call,
            'unlocked_video_call': friendship.unlocked_video_call,
            'progress': progress
        }
    })


@app.route('/api/unlock', methods=['POST'])
@login_required
def unlock_feature():
    """使用积分解锁功能"""
    data = request.get_json()
    friendship_id = data.get('friendship_id')
    feature = data.get('feature')  # voice_message, voice_call, video_call

    from config import Config

    if feature not in Config.POINTS_PRICE:
        return jsonify({'success': False, 'message': '无效的功能'})

    required_points = Config.POINTS_PRICE[feature]

    if current_user.points < required_points:
        return jsonify({'success': False, 'message': f'积分不足，需要{required_points}积分'})

    # 扣除积分
    current_user.points -= required_points

    # 解锁功能
    friendship = Friendship.query.get_or_404(friendship_id)
    if friendship.user_id != current_user.id:
        return jsonify({'success': False, 'message': '无权操作'}), 403

    if feature == 'voice_message':
        friendship.unlocked_voice_message = True
    elif feature == 'voice_call':
        friendship.unlocked_voice_call = True
    elif feature == 'video_call':
        friendship.unlocked_video_call = True

    # 创建订单记录
    order = PaymentOrder(
        user_id=current_user.id,
        order_no=generate_order_no(),
        order_type='unlock',
        amount=0,
        points=required_points,
        payment_method='balance',
        payment_status='paid',
        paid_at=datetime.now(),
        unlock_feature=feature,
        friendship_id=friendship_id
    )
    db.session.add(order)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'成功解锁{feature}，消耗{required_points}积分',
        'points': current_user.points
    })


# ---------- 消息相关 ----------
@app.route('/api/messages/<int:friend_id>', methods=['GET'])
@login_required
def get_messages(friend_id):
    """获取与好友的聊天记录"""
    page = request.args.get('page', 1, type=int)
    per_page = 50

    messages = Message.query.filter(
        db.or_(
            db.and_(Message.sender_id == current_user.id, Message.receiver_id == friend_id),
            db.and_(Message.sender_id == friend_id, Message.receiver_id == current_user.id)
        )
    ).filter_by(is_deleted=False).order_by(Message.created_at.desc()).paginate(page=page, per_page=per_page)

    messages_data = []
    for msg in messages.items[::-1]:  # 反转顺序，按时间正序
        messages_data.append({
            'id': msg.id,
            'sender_id': msg.sender_id,
            'receiver_id': msg.receiver_id,
            'message_type': msg.message_type,
            'content': msg.content,
            'media_url': msg.media_url,
            'duration': msg.duration,
            'is_read': msg.is_read,
            'created_at': msg.created_at.strftime('%H:%M')
        })

    return jsonify({'success': True, 'messages': messages_data})


@app.route('/api/messages/read', methods=['POST'])
@login_required
def mark_messages_read():
    """标记消息为已读"""
    data = request.get_json()
    sender_id = data.get('sender_id')

    Message.query.filter_by(
        sender_id=sender_id,
        receiver_id=current_user.id,
        is_read=False
    ).update({'is_read': True})

    db.session.commit()

    return jsonify({'success': True})


# ---------- 动态广场相关 ----------
@app.route('/api/posts', methods=['GET'])
@login_required
def get_posts():
    """获取动态列表"""
    page = request.args.get('page', 1, type=int)
    per_page = 20

    posts = Post.query.filter_by(is_deleted=False).order_by(Post.created_at.desc()).paginate(
        page=page, per_page=per_page
    )

    posts_data = []
    for post in posts.items:
        author = User.query.get(post.user_id)
        is_liked = PostLike.query.filter_by(post_id=post.id, user_id=current_user.id).first() is not None

        posts_data.append({
            'id': post.id,
            'author': {
                'id': author.id,
                'nickname': author.nickname if not post.is_anonymous else '匿名用户',
                'avatar_url': author.avatar_url if not post.is_anonymous else None
            },
            'content': post.content,
            'post_type': post.post_type,
            'image_url': post.image_url,
            'like_count': post.like_count,
            'comment_count': post.comment_count,
            'is_liked': is_liked,
            'is_anonymous': post.is_anonymous,
            'created_at': post.created_at.strftime('%Y-%m-%d %H:%M')
        })

    return jsonify({'success': True, 'posts': posts_data})


@app.route('/api/posts', methods=['POST'])
@login_required
def create_post():
    """发布动态"""
    data = request.get_json()

    post = Post(
        user_id=current_user.id,
        content=data.get('content', ''),
        post_type=data.get('post_type', 'text'),
        image_url=data.get('image_url'),
        is_anonymous=data.get('is_anonymous', True)
    )

    db.session.add(post)
    db.session.commit()

    return jsonify({'success': True, 'message': '发布成功'})


@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
@login_required
def like_post(post_id):
    """点赞动态"""
    post = Post.query.get_or_404(post_id)

    existing_like = PostLike.query.filter_by(post_id=post_id, user_id=current_user.id).first()

    if existing_like:
        # 取消点赞
        db.session.delete(existing_like)
        post.like_count -= 1
        action = 'unliked'
    else:
        # 点赞
        like = PostLike(post_id=post_id, user_id=current_user.id)
        db.session.add(like)
        post.like_count += 1
        action = 'liked'

    db.session.commit()

    return jsonify({'success': True, 'action': action, 'like_count': post.like_count})


@app.route('/api/posts/<int:post_id>/comments', methods=['GET'])
@login_required
def get_post_comments(post_id):
    """获取动态评论"""
    comments = PostComment.query.filter_by(post_id=post_id, is_deleted=False).order_by(PostComment.created_at.asc()).all()

    comments_data = []
    for comment in comments:
        author = User.query.get(comment.user_id)
        comments_data.append({
            'id': comment.id,
            'author': {
                'id': author.id,
                'nickname': author.nickname,
                'avatar_url': author.avatar_url
            },
            'content': comment.content,
            'created_at': comment.created_at.strftime('%H:%M')
        })

    return jsonify({'success': True, 'comments': comments_data})


@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
@login_required
def create_post_comment(post_id):
    """评论动态"""
    data = request.get_json()

    post = Post.query.get_or_404(post_id)
    comment = PostComment(
        post_id=post_id,
        user_id=current_user.id,
        content=data.get('content')
    )

    db.session.add(comment)
    post.comment_count += 1
    db.session.commit()

    return jsonify({'success': True, 'message': '评论成功'})


# ---------- 用户相关 ----------
@app.route('/api/user/profile', methods=['GET'])
@login_required
def get_profile():
    """获取用户资料"""
    return jsonify({
        'success': True,
        'user': {
            'id': current_user.id,
            'username': current_user.username,
            'nickname': current_user.nickname,
            'gender': current_user.gender,
            'age': current_user.age,
            'bio': current_user.bio,
            'avatar_url': current_user.avatar_url,
            'is_vip': current_user.is_vip,
            'vip_expire_at': current_user.vip_expire_at.strftime('%Y-%m-%d') if current_user.vip_expire_at else None,
            'points': current_user.points,
            'total_chats': current_user.total_chats,
            'total_matches': current_user.total_matches,
            'is_online': current_user.is_online,
            'face_registered': current_user.face_registered
        }
    })


@app.route('/api/user/profile', methods=['POST'])
@login_required
def update_profile():
    """更新用户资料"""
    data = request.get_json()

    current_user.nickname = data.get('nickname', current_user.nickname)
    current_user.gender = data.get('gender', current_user.gender)
    current_user.age = data.get('age', current_user.age)
    current_user.bio = data.get('bio', current_user.bio)

    if data.get('avatar_type'):
        current_user.avatar_type = data['avatar_type']
        current_user.avatar_url = generate_avatar(data['avatar_type'])

    db.session.commit()

    return jsonify({'success': True, 'message': '更新成功'})


# ---------- 支付相关 ----------
@app.route('/api/payment/create_order', methods=['POST'])
@login_required
def create_payment_order():
    """创建支付订单"""
    data = request.get_json()
    order_type = data.get('order_type')  # vip_monthly, vip_yearly, points

    from config import Config

    amount = 0
    points = 0

    if order_type == 'vip_monthly':
        amount = Config.VIP_PRICE_MONTHLY
        points = Config.VIP_BONUS_POINTS
    elif order_type == 'vip_yearly':
        amount = Config.VIP_PRICE_YEARLY
        points = Config.VIP_BONUS_POINTS * 10
    elif order_type == 'points_100':
        amount = 9.9
        points = 100
    elif order_type == 'points_500':
        amount = 39.9
        points = 500
    elif order_type == 'points_1000':
        amount = 69.9
        points = 1000
    else:
        return jsonify({'success': False, 'message': '无效的订单类型'})

    order = PaymentOrder(
        user_id=current_user.id,
        order_no=generate_order_no(),
        order_type=order_type,
        amount=amount,
        points=points,
        payment_status='pending'
    )

    db.session.add(order)
    db.session.commit()

    return jsonify({
        'success': True,
        'order': {
            'order_no': order.order_no,
            'amount': amount,
            'points': points
        }
    })


@app.route('/api/payment/callback', methods=['POST'])
def payment_callback():
    """支付回调（模拟）"""
    data = request.get_json()
    order_no = data.get('order_no')

    order = PaymentOrder.query.filter_by(order_no=order_no).first()

    if not order or order.payment_status == 'paid':
        return jsonify({'success': False, 'message': '订单无效或已支付'})

    # 更新订单状态
    order.payment_status = 'paid'
    order.paid_at = datetime.now()

    # 发放权益
    user = User.query.get(order.user_id)
    if order.order_type in ['vip_monthly', 'vip_yearly']:
        user.is_vip = True
        expire_months = 12 if order.order_type == 'vip_yearly' else 1
        if user.vip_expire_at and user.vip_expire_at > datetime.now():
            user.vip_expire_at += timedelta(days=expire_months * 30)
        else:
            user.vip_expire_at = datetime.now() + timedelta(days=expire_months * 30)
    else:
        user.points += order.points

    db.session.commit()

    return jsonify({'success': True, 'message': '支付成功'})


# ---------- 聊天室相关 ----------
@app.route('/api/chatrooms', methods=['GET'])
@login_required
def get_chatrooms():
    """获取聊天室列表"""
    chatrooms = ChatRoom.query.filter_by(is_active=True).all()

    chatrooms_data = []
    for room in chatrooms:
        # 获取用户已加入的聊天室
        member = ChatRoomMember.query.filter_by(
            room_id=room.id,
            user_id=current_user.id
        ).first()

        # 计算未读消息数
        unread_count = 0
        if member:
            # 获取该聊天室的最后阅读时间
            last_read_at = member.last_read_at
            if last_read_at:
                # 计算从最后阅读时间之后的未读消息数
                unread_count = RoomMessage.query.filter(
                    RoomMessage.room_id == room.id,
                    RoomMessage.created_at > last_read_at
                ).count()
            else:
                # 从加入时间之后的消息都算未读
                unread_count = RoomMessage.query.filter_by(room_id=room.id).count()

        chatrooms_data.append({
            'id': room.id,
            'name': room.name,
            'description': room.description,
            'room_type': room.room_type,
            'current_members': room.current_members,
            'max_members': room.max_members,
            'allow_anonymous': room.allow_anonymous,
            'unread_count': unread_count,
            'is_joined': member is not None
        })

    return jsonify({'success': True, 'chatrooms': chatrooms_data})


@app.route('/api/chatrooms', methods=['POST'])
@login_required
def create_chatroom():
    """创建聊天室"""
    data = request.get_json()

    chatroom = ChatRoom(
        name=data.get('name'),
        description=data.get('description'),
        room_type=data.get('room_type', 'public'),
        max_members=data.get('max_members', 100),
        created_by=current_user.id
    )

    db.session.add(chatroom)
    db.session.commit()

    # 创建者自动加入
    member = ChatRoomMember(
        room_id=chatroom.id,
        user_id=current_user.id,
        is_admin=True
    )
    db.session.add(member)
    chatroom.current_members += 1
    db.session.commit()

    return jsonify({'success': True, 'message': '创建成功'})


@app.route('/api/chatrooms/<int:room_id>/join', methods=['POST'])
@login_required
def join_chatroom(room_id):
    """加入聊天室"""
    chatroom = ChatRoom.query.get_or_404(room_id)

    if chatroom.current_members >= chatroom.max_members:
        return jsonify({'success': False, 'message': '聊天室已满'})

    existing_member = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user.id
    ).first()

    if existing_member:
        # 已在聊天室中，更新最后阅读时间
        existing_member.last_read_at = datetime.now()
        db.session.commit()
        return jsonify({
            'success': True,
            'message': '已在聊天室中',
            'chatroom': {
                'id': chatroom.id,
                'name': chatroom.name
            }
        })

    member = ChatRoomMember(
        room_id=room_id,
        user_id=current_user.id,
        last_read_at=datetime.now()
    )
    db.session.add(member)
    chatroom.current_members += 1
    db.session.commit()

    return jsonify({
        'success': True,
        'message': '加入成功',
        'chatroom': {
            'id': chatroom.id,
            'name': chatroom.name
        }
    })


@app.route('/api/chatrooms/<int:room_id>/messages', methods=['GET'])
@login_required
def get_room_messages(room_id):
    """获取聊天室消息"""
    page = request.args.get('page', 1, type=int)
    per_page = 50

    messages = RoomMessage.query.filter_by(
        room_id=room_id,
        is_deleted=False
    ).order_by(RoomMessage.created_at.desc()).paginate(page=page, per_page=per_page)

    messages_data = []
    for msg in messages.items[::-1]:
        user = User.query.get(msg.user_id)
        messages_data.append({
            'id': msg.id,
            'sender_id': user.id,
            'sender_nickname': user.nickname if user.nickname else user.username,
            'sender_avatar': user.avatar_url,
            'content': msg.content,
            'message_type': msg.message_type,
            'created_at': msg.created_at.strftime('%H:%M')
        })

    return jsonify({'success': True, 'messages': messages_data})


@app.route('/api/chatrooms/<int:room_id>/read', methods=['POST'])
@login_required
def mark_chatroom_read():
    """标记聊天室消息为已读"""
    room_id = request.view_args.get('room_id')

    # 更新成员的最后阅读时间
    member = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user.id
    ).first()

    if member:
        from datetime import datetime
        member.last_read_at = datetime.now()
        db.session.commit()

        return jsonify({'success': True, 'message': '已标记为已读'})

    return jsonify({'success': False, 'message': '未加入该聊天室'})


# ==================== WebSocket事件处理 ====================
@socketio.on('connect')
def handle_connect():
    """客户端连接"""
    if current_user.is_authenticated:
        current_user.is_online = True
        db.session.commit()

        # 加入个人房间
        join_room(f'user_{current_user.id}')

        emit('connected', {
            'user_id': current_user.id,
            'message': '连接成功'
        })


@socketio.on('disconnect')
def handle_disconnect():
    """客户端断开连接"""
    if current_user.is_authenticated:
        current_user.is_online = False
        current_user.last_seen = datetime.now()
        db.session.commit()


@socketio.on('private_message')
def handle_private_message(data):
    """处理私聊消息"""
    if not current_user.is_authenticated:
        return

    receiver_id = data.get('receiver_id')
    content = data.get('content', '')
    message_type = data.get('message_type', 'text')
    media_url = data.get('media_url')
    duration = data.get('duration')

    # 检查好友关系和功能解锁状态
    friendship = Friendship.query.filter_by(
        user_id=current_user.id,
        friend_id=receiver_id
    ).first()

    if not friendship:
        emit('error', {'message': '还不是好友，请先匹配'})
        return

    # 检查功能解锁
    if message_type == 'voice' and not friendship.unlocked_voice_message:
        emit('error', {'message': '语音留言未解锁，需要更多聊天或付费解锁'})
        return

    # 保存消息
    message = Message(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        message_type=message_type,
        content=content,
        media_url=media_url,
        duration=duration
    )

    db.session.add(message)

    # 更新聊天轮数（任何消息类型都增加轮数）
    # 检查对方最后一条消息时间，如果是新的对话轮次则计数
    last_msg = Message.query.filter(
        Message.sender_id == receiver_id,
        Message.receiver_id == current_user.id
    ).order_by(Message.created_at.desc()).first()

    if last_msg:
        time_diff = (datetime.now() - last_msg.created_at).total_seconds()
        if time_diff > 60:  # 1分钟以上算新轮次
            friendship.chat_rounds += 1
            friendship.update_intimacy()
    else:
        friendship.chat_rounds += 1
        friendship.update_intimacy()

    current_user.total_chats += 1
    db.session.commit()

    # 发送消息给接收者
    emit('new_message', {
        'id': message.id,
        'sender_id': current_user.id,
        'sender_nickname': current_user.nickname,
        'sender_avatar': current_user.avatar_url,
        'message_type': message_type,
        'content': content,
        'media_url': media_url,
        'duration': duration,
        'created_at': message.created_at.strftime('%H:%M')
    }, room=f'user_{receiver_id}')

    # 确认发送成功
    emit('message_sent', {
        'id': message.id,
        'temp_id': data.get('temp_id'),
        'created_at': message.created_at.strftime('%H:%M')
    })


@socketio.on('room_message')
def handle_room_message(data):
    """处理聊天室消息"""
    if not current_user.is_authenticated:
        return

    room_id = data.get('room_id')
    content = data.get('content', '')

    # 检查是否在聊天室中
    member = ChatRoomMember.query.filter_by(
        room_id=room_id,
        user_id=current_user.id
    ).first()

    if not member:
        emit('error', {'message': '请先加入聊天室'})
        return

    # 保存消息
    message = RoomMessage(
        room_id=room_id,
        user_id=current_user.id,
        content=content
    )

    db.session.add(message)
    db.session.commit()

    # 广播消息到聊天室
    emit('room_new_message', {
        'id': message.id,
        'room_id': room_id,
        'sender_id': current_user.id,
        'sender_nickname': current_user.nickname if current_user.nickname else current_user.username,
        'sender_avatar': current_user.avatar_url,
        'content': content,
        'created_at': message.created_at.strftime('%H:%M')
    }, room=f'room_{room_id}')


@socketio.on('join_room')
def handle_join_room(data):
    """加入聊天室"""
    if not current_user.is_authenticated:
        return

    room_id = data.get('room_id')
    join_room(f'room_{room_id}')

    emit('joined_room', {'room_id': room_id}, room=f'room_{room_id}')


@socketio.on('leave_room')
def handle_leave_room(data):
    """离开聊天室"""
    if not current_user.is_authenticated:
        return

    room_id = data.get('room_id')
    leave_room(f'room_{room_id}')

    emit('left_room', {'room_id': room_id}, room=f'room_{room_id}')


@socketio.on('typing')
def handle_typing(data):
    """处理输入状态"""
    if not current_user.is_authenticated:
        return

    receiver_id = data.get('receiver_id')
    is_typing = data.get('is_typing', False)

    emit('user_typing', {
        'user_id': current_user.id,
        'is_typing': is_typing
    }, room=f'user_{receiver_id}')


@socketio.on('call_request')
def handle_call_request(data):
    """处理通话请求"""
    if not current_user.is_authenticated:
        return

    receiver_id = data.get('receiver_id')
    call_type = data.get('call_type')  # voice, video

    # 检查解锁状态
    friendship = Friendship.query.filter_by(
        user_id=current_user.id,
        friend_id=receiver_id
    ).first()

    if not friendship:
        emit('error', {'message': '还不是好友'})
        return

    if call_type == 'voice' and not friendship.unlocked_voice_call:
        emit('error', {'message': '语音通话未解锁'})
        return

    if call_type == 'video' and not friendship.unlocked_video_call:
        emit('error', {'message': '视频通话未解锁'})
        return

    # 发送通话请求
    emit('incoming_call', {
        'caller_id': current_user.id,
        'caller_nickname': current_user.nickname,
        'caller_avatar': current_user.avatar_url,
        'call_type': call_type,
        'room_id': f"call_{current_user.id}_{receiver_id}_{datetime.now().timestamp()}"
    }, room=f'user_{receiver_id}')


@socketio.on('call_response')
def handle_call_response(data):
    """处理通话响应"""
    if not current_user.is_authenticated:
        return

    caller_id = data.get('caller_id')
    response = data.get('response')  # accept, reject, busy
    room_id = data.get('room_id')

    emit('call_response', {
        'user_id': current_user.id,
        'response': response,
        'room_id': room_id
    }, room=f'user_{caller_id}')


# ==================== WebRTC信令服务器 ====================
@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    """转发WebRTC offer"""
    if not current_user.is_authenticated:
        return

    target_user_id = data.get('target_user_id')
    offer = data.get('offer')

    print(f'[WebRTC] 转发offer: {current_user.id} -> {target_user_id}')

    emit('webrtc_offer', {
        'sender_id': current_user.id,
        'offer': offer
    }, room=f'user_{target_user_id}')


@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    """转发WebRTC answer"""
    if not current_user.is_authenticated:
        return

    target_user_id = data.get('target_user_id')
    answer = data.get('answer')

    print(f'[WebRTC] 转发answer: {current_user.id} -> {target_user_id}')

    emit('webrtc_answer', {
        'sender_id': current_user.id,
        'answer': answer
    }, room=f'user_{target_user_id}')


@socketio.on('webrtc_ice_candidate')
def handle_webrtc_ice_candidate(data):
    """转发WebRTC ICE候选"""
    if not current_user.is_authenticated:
        return

    target_user_id = data.get('target_user_id')
    candidate = data.get('candidate')

    emit('webrtc_ice_candidate', {
        'sender_id': current_user.id,
        'candidate': candidate
    }, room=f'user_{target_user_id}')


@socketio.on('call_end')
def handle_call_end(data):
    """处理通话结束"""
    if not current_user.is_authenticated:
        return

    target_user_id = data.get('target_user_id')

    emit('call_end', {
        'user_id': current_user.id
    }, room=f'user_{target_user_id}')


# ==================== 初始化数据库 ====================
@app.before_request
def before_request():
    """请求前处理"""
    if current_user.is_authenticated:
        current_user.last_seen = datetime.now()
        db.session.commit()


@app.shell_context_processor
def make_shell_context():
    """Shell上下文"""
    return {'db': db, 'User': User, 'Message': Message, 'Friendship': Friendship}


# ==================== 启动应用 ====================
if __name__ == '__main__':
    import sys
    import io
    # 设置标准输出编码为UTF-8
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    with app.app_context():
        db.create_all()
        print("蒙面畅聊 - 匿名阶梯交友APP")
        print("=" * 40)
        print("服务启动中...")
        print("访问地址: http://localhost:5000")
        print("=" * 40)

    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
