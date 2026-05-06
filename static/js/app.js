// 蒙面畅聊 - 主应用逻辑

// ==================== 全局状态 ====================
const AppState = {
    socket: null,
    currentUser: null,
    currentChat: null,
    friends: [],
    friendsUnreadCount: 0,
    chatroomsUnreadCount: 0
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    initNavigation();
    initMatch();
    initFriends();
    initChat();
    initGroupChat();
    initChatrooms();
    initSquare();
    initProfile();

    // 加载用户信息
    loadUserProfile();
});

// ==================== Socket.IO 连接 ====================
function initSocket() {
    AppState.socket = io();

    AppState.socket.on('connect', () => {
        console.log('已连接到服务器');
    });

    AppState.socket.on('connected', (data) => {
        console.log('连接成功:', data);
    });

    AppState.socket.on('new_message', (data) => {
        handleNewMessage(data);
    });

    AppState.socket.on('message_sent', (data) => {
        handleMessageSent(data);
    });

    AppState.socket.on('user_typing', (data) => {
        handleUserTyping(data);
    });

    AppState.socket.on('incoming_call', (data) => {
        handleIncomingCall(data);
    });

    AppState.socket.on('call_response', (data) => {
        handleCallResponse(data);
    });

    // 聊天室消息
    AppState.socket.on('room_new_message', (data) => {
        handleNewRoomMessage(data);
    });

    AppState.socket.on('error', (data) => {
        showNotification(data.message, 'error');
    });

    // WebRTC信令事件
    AppState.socket.on('webrtc_offer', async (data) => {
        console.log('收到webrtc_offer事件');
        await WebRTCCall.handleOffer(data.offer, data.sender_id);
    });

    AppState.socket.on('webrtc_answer', async (data) => {
        console.log('收到webrtc_answer事件');
        await WebRTCCall.handleAnswer(data.answer);
    });

    AppState.socket.on('webrtc_ice_candidate', async (data) => {
        console.log('收到webrtc_ice_candidate事件');
        await WebRTCCall.handleIceCandidate(data.candidate);
    });

    AppState.socket.on('call_end', () => {
        showNotification('对方已结束通话', 'info');
        WebRTCCall.endCall();
    });
}

// ==================== 导航切换 ====================
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.dataset.tab;

            // 更新导航状态
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // 切换内容
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `tab-${tabName}`) {
                    content.classList.add('active');
                }
            });

            // 加载对应数据
            switch(tabName) {
                case 'friends':
                    loadFriends();
                    // 切换到好友列表时，清除侧边栏徽标
                    clearFriendsUnreadBadge();
                    break;
                case 'chatrooms':
                    loadChatrooms();
                    // 切换到聊天室时，清除侧边栏徽标
                    clearChatroomsUnreadBadge();
                    break;
                case 'square':
                    loadPosts();
                    break;
                case 'profile':
                    loadProfile();
                    break;
            }
        });
    });
}

// ==================== 随机匹配 ====================
function initMatch() {
    const startBtn = document.getElementById('startMatchBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    let selectedGender = '';

    // 性别筛选
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGender = btn.dataset.gender;
        });
    });

    // 开始匹配
    startBtn.addEventListener('click', async () => {
        const matchStatus = document.getElementById('matchStatus');
        const matchResult = document.getElementById('matchResult');

        matchStatus.style.display = 'block';
        matchResult.style.display = 'none';

        try {
            const response = await fetch('/api/match/random', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gender: selectedGender })
            });

            const result = await response.json();

            matchStatus.style.display = 'none';

            if (result.success) {
                displayMatchResult(result);
            } else {
                showNotification(result.message, 'warning');
            }
        } catch (error) {
            matchStatus.style.display = 'none';
            showNotification('匹配失败，请稍后重试', 'error');
        }
    });
}

function displayMatchResult(result) {
    const matchResult = document.getElementById('matchResult');

    matchResult.innerHTML = `
        <div class="matched-user">
            <img src="${result.matched_user.avatar_url}" alt="avatar" class="matched-avatar">
            <h3 class="matched-name">${result.matched_user.nickname}</h3>
            ${result.matched_user.bio ? `<p class="matched-bio">${result.matched_user.bio}</p>` : ''}
            <div class="matched-tags">
                <span class="tag relationship">${result.friendship.relationship_tag}</span>
                <span class="tag">已聊 ${result.friendship.chat_rounds} 轮</span>
            </div>
            <div class="matched-actions">
                <button class="btn btn-primary" onclick="startChat(${result.matched_user.id}, '${result.matched_user.nickname}', '${result.matched_user.avatar_url}', ${result.friendship.id})">
                    开始聊天
                </button>
                <button class="btn btn-secondary" onclick="resetMatch()">
                    重新匹配
                </button>
            </div>
        </div>
    `;

    matchResult.style.display = 'block';
}

function resetMatch() {
    document.getElementById('matchResult').style.display = 'none';
}

// ==================== 好友列表 ====================
function initFriends() {
    // 初始化时加载好友列表
}

async function loadFriends() {
    const friendsList = document.getElementById('friendsList');

    try {
        const response = await fetch('/api/friends');
        const result = await response.json();

        if (result.success) {
            AppState.friends = result.friends;
            displayFriends(result.friends);
        }
    } catch (error) {
        friendsList.innerHTML = '<div class="loading">加载失败</div>';
    }
}

function displayFriends(friends) {
    const friendsList = document.getElementById('friendsList');

    if (friends.length === 0) {
        friendsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p>还没有好友，去随机匹配吧！</p>
            </div>
        `;
        return;
    }

    friendsList.innerHTML = friends.map(friend => `
        <div class="friend-item" onclick="startChat(${friend.id}, '${friend.nickname || friend.username}', '${friend.avatar_url}', ${friend.friendship.id})">
            <img src="${friend.avatar_url}" alt="avatar" class="friend-avatar">
            <div class="friend-info">
                <div class="friend-name">${friend.nickname || friend.username}</div>
                <div class="friend-status">
                    <span class="${friend.is_online ? 'online-indicator' : 'offline-indicator'}"></span>
                    ${friend.is_online ? '在线' : '离线'}
                </div>
            </div>
            <div class="friend-meta">
                <div class="friend-level">${friend.friendship.relationship_tag}</div>
                ${friend.unread_count > 0 ? `<span class="unread-badge">${friend.unread_count > 99 ? '99+' : friend.unread_count}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ==================== 聊天功能 ====================
function initChat() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const voiceMessageBtn = document.getElementById('voiceMessageBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const chatWindow = document.getElementById('chatWindow');
    const resizeHandle = document.getElementById('chatResizeHandle');

    // 发送消息
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 输入状态提示
    chatInput.addEventListener('input', () => {
        if (AppState.currentChat) {
            AppState.socket.emit('typing', {
                receiver_id: AppState.currentChat.userId,
                is_typing: true
            });
        }
    });

    // 关闭聊天
    closeChatBtn.addEventListener('click', closeChat);

    // 语音消息
    if (voiceMessageBtn) {
        voiceMessageBtn.addEventListener('click', handleVoiceMessage);
    }

    // Emoji表情
    if (emojiBtn) {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showEmojiPicker((emoji) => {
                chatInput.value += emoji;
                chatInput.focus();
            }, emojiBtn);
        });
    }

    // 拖动调整大小
    if (resizeHandle && chatWindow) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = chatWindow.offsetWidth;
            document.body.style.cursor = 'ew-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const diff = startX - e.clientX;
            const newWidth = Math.min(Math.max(startWidth + diff, 300), 800);
            chatWindow.style.width = newWidth + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });
    }
}

function initGroupChat() {
    const groupChatInput = document.getElementById('groupChatInput');
    const groupSendBtn = document.getElementById('groupSendBtn');
    const closeGroupChatBtn = document.getElementById('closeGroupChatBtn');

    // 发送消息
    if (groupSendBtn) {
        groupSendBtn.addEventListener('click', sendGroupChatMessage);
    }

    if (groupChatInput) {
        groupChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendGroupChatMessage();
            }
        });
    }

    // 关闭聊天室
    if (closeGroupChatBtn) {
        closeGroupChatBtn.addEventListener('click', closeGroupChat);
    }
}

function startChat(userId, nickname, avatarUrl, friendshipId) {
    AppState.currentChat = { userId, nickname, avatarUrl, friendshipId };

    // 更新聊天窗口
    document.getElementById('chatUserName').textContent = nickname;
    document.getElementById('chatUserAvatar').src = avatarUrl;
    document.getElementById('chatMessages').innerHTML = '';

    // 显示聊天窗口
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.style.display = 'flex';
    setTimeout(() => chatWindow.classList.add('open'), 10);

    // 加载聊天记录
    loadMessages(userId);

    // 标记消息为已读
    markMessagesAsRead(userId);

    // 加载解锁状态
    loadFriendshipStatus(friendshipId);
}

async function markMessagesAsRead(senderId) {
    try {
        await fetch('/api/messages/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_id: senderId })
        });
        // 刷新好友列表以更新未读徽标
        loadFriends();
        // 清除侧边栏好友徽标
        clearFriendsUnreadBadge();
    } catch (error) {
        console.error('标记已读失败:', error);
    }
}

function closeChat() {
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.classList.remove('open');
    setTimeout(() => {
        chatWindow.style.display = 'none';
    }, 300);

    AppState.currentChat = null;
}

async function loadMessages(friendId) {
    try {
        const response = await fetch(`/api/messages/${friendId}`);
        const result = await response.json();

        if (result.success) {
            displayMessages(result.messages);
        }
    } catch (error) {
        console.error('加载消息失败:', error);
    }
}

function displayMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');

    chatMessages.innerHTML = messages.map(msg => {
        const isSent = msg.sender_id === AppState.currentUser?.id;
        let messageContent = msg.content;

        // 语音消息显示为音频播放器
        if (msg.message_type === 'voice' && msg.media_url) {
            messageContent = `<audio controls src="${msg.media_url}" class="voice-message"></audio>`;
        }

        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                ${!isSent ? `<img src="${AppState.currentChat?.avatarUrl}" class="message-avatar">` : ''}
                <div class="message-content">
                    ${messageContent}
                    <div class="message-time">${msg.created_at}</div>
                </div>
            </div>
        `;
    }).join('');

    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const content = chatInput.value.trim();

    if (!content || !AppState.currentChat) return;

    const tempId = Date.now();

    // 显示临时消息
    addMessageToChat({
        id: tempId,
        sender_id: AppState.currentUser?.id,
        content: content,
        created_at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }, true);

    // 发送消息
    AppState.socket.emit('private_message', {
        receiver_id: AppState.currentChat.userId,
        content: content,
        message_type: 'text',
        temp_id: tempId
    });

    chatInput.value = '';
}

function addMessageToChat(message, isTemp = false) {
    const chatMessages = document.getElementById('chatMessages');
    const isSent = message.sender_id === AppState.currentUser?.id;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
    messageEl.dataset.messageId = message.id;
    if (isTemp) messageEl.dataset.temp = 'true';

    messageEl.innerHTML = `
        ${!isSent ? `<img src="${AppState.currentChat?.avatarUrl}" class="message-avatar">` : ''}
        <div class="message-content">
            ${message.content}
            <div class="message-time">${message.created_at}</div>
        </div>
    `;

    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleNewMessage(data) {
    if (AppState.currentChat && data.sender_id === AppState.currentChat.userId) {
        // 当前聊天窗口中
        addMessageToChat(data);

        // 标记已读
        fetch('/api/messages/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_id: data.sender_id })
        });
    } else {
        // 其他消息，增加好友未读计数
        AppState.friendsUnreadCount++;
        updateFriendsUnreadBadge();
        showNotification(`收到 ${data.sender_nickname} 的新消息`, 'info');
    }
}

function handleMessageSent(data) {
    // 更新临时消息ID
    const tempMsg = document.querySelector(`[data-temp="true"]`);
    if (tempMsg) {
        tempMsg.dataset.messageId = data.id;
        delete tempMsg.dataset.temp;
    }
}

function handleUserTyping(data) {
    if (AppState.currentChat && data.user_id === AppState.currentChat.userId) {
        // 显示输入状态
        // TODO: 实现输入状态显示
    }
}

async function loadFriendshipStatus(friendshipId) {
    try {
        const response = await fetch(`/api/friendship/${friendshipId}/status`);

        // 检查HTTP状态码
        if (!response.ok) {
            if (response.status === 403) {
                console.error('无权访问好友关系:', friendshipId);
                return;
            } else if (response.status === 404) {
                console.error('好友关系不存在:', friendshipId);
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.friendship) {
            updateUnlockProgress(result.friendship.progress);
            updateCallButtons(result.friendship);
        } else {
            console.error('加载好友状态失败:', result);
        }
    } catch (error) {
        console.error('加载好友状态失败:', error);
    }
}

function updateUnlockProgress(progress) {
    const chatProgress = document.getElementById('chatProgress');

    if (progress) {
        chatProgress.style.display = 'block';

        Object.keys(progress).forEach(feature => {
            const item = chatProgress.querySelector(`[data-feature="${feature}"]`);
            if (item) {
                const fill = item.querySelector('.progress-fill');
                fill.style.width = `${progress[feature].progress}%`;

                if (progress[feature].unlocked) {
                    item.classList.add('unlocked');
                }
            }
        });
    }
}

function updateCallButtons(friendship) {
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    const videoCallBtn = document.getElementById('videoCallBtn');

    if (friendship.progress.voice_call.unlocked) {
        voiceCallBtn.style.display = 'flex';
        voiceCallBtn.onclick = () => startCall('voice');
    }

    if (friendship.progress.video_call.unlocked) {
        videoCallBtn.style.display = 'flex';
        videoCallBtn.onclick = () => startCall('video');
    }

    // 语音留言
    if (friendship.progress.voice_message.unlocked) {
        document.getElementById('voiceMessageBtn').style.display = 'flex';
    }
}

function handleVoiceMessage() {
    // 检查是否有聊天会话
    if (!AppState.currentChat) {
        showNotification('请先选择一个好友聊天', 'warning');
        return;
    }

    // 如果正在录音，停止并发送
    if (AppState.isRecording) {
        stopRecording();
        return;
    }

    // 异步检查是否解锁
    checkUnlockAndRecord();
}

async function checkUnlockAndRecord() {
    if (!AppState.currentChat?.friendshipId) {
        showNotification('语音消息未解锁', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/friendship/${AppState.currentChat.friendshipId}/status`);
        const result = await response.json();

        if (result.success && result.friendship.unlocked_voice_message) {
            // 已解锁，开始录音
            startRecording();
            AppState.currentChat.unlocked_voice_message = true;
        } else {
            const rounds = result.friendship?.chat_rounds || 0;
            showNotification(`语音消息未解锁，需要5轮聊天，当前${rounds}轮`, 'warning');
        }
    } catch (error) {
        showNotification('无法检查解锁状态', 'error');
    }
}

let mediaRecorder = null;
let audioChunks = [];

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            // 上传音频
            await uploadVoiceMessage();
            // 停止所有轨道
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        AppState.isRecording = true;

        // 更新UI
        const btn = document.getElementById('voiceMessageBtn');
        btn.textContent = '⏹';
        btn.classList.add('recording');
        showNotification('正在录音...点击停止', 'info');

    } catch (error) {
        console.error('录音失败:', error);
        showNotification('无法访问麦克风', 'error');
    }
}

async function stopRecording() {
    if (mediaRecorder && AppState.isRecording) {
        mediaRecorder.stop();
        AppState.isRecording = false;

        // 恢复UI
        const btn = document.getElementById('voiceMessageBtn');
        btn.textContent = '🎤';
        btn.classList.remove('recording');
    }
}

async function uploadVoiceMessage() {
    if (audioChunks.length === 0) return;

    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');

    try {
        const response = await fetch('/api/upload/voice', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // 发送语音消息
            sendVoiceMessage(result.url);
        } else {
            showNotification(result.message || '上传失败', 'error');
        }
    } catch (error) {
        console.error('上传失败:', error);
        showNotification('上传失败', 'error');
    }
}

function sendVoiceMessage(mediaUrl) {
    if (!AppState.currentChat) return;

    AppState.socket.emit('private_message', {
        receiver_id: AppState.currentChat.userId,
        message_type: 'voice',
        content: '',
        media_url: mediaUrl,
        duration: 0
    });

    showNotification('语音消息已发送', 'success');
}

function updateFriendsUnreadBadge() {
    const badge = document.getElementById('unreadBadge');
    if (AppState.friendsUnreadCount > 0) {
        badge.textContent = AppState.friendsUnreadCount > 99 ? '99+' : AppState.friendsUnreadCount;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

function updateChatroomsUnreadBadge() {
    const badge = document.getElementById('chatroomsBadge');
    if (badge && AppState.chatroomsUnreadCount > 0) {
        badge.textContent = AppState.chatroomsUnreadCount > 99 ? '99+' : AppState.chatroomsUnreadCount;
        badge.style.display = 'inline';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

function clearFriendsUnreadBadge() {
    AppState.friendsUnreadCount = 0;
    updateFriendsUnreadBadge();
}

function clearChatroomsUnreadBadge() {
    AppState.chatroomsUnreadCount = 0;
    updateChatroomsUnreadBadge();
}

// ==================== 聊天室 ====================
function initChatrooms() {
    const createBtn = document.getElementById('createRoomBtn');
    const modal = document.getElementById('roomModal');
    const closeBtn = document.getElementById('closeRoomModal');
    const form = document.getElementById('roomForm');

    createBtn.addEventListener('click', () => modal.style.display = 'flex');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('roomName').value,
            description: document.getElementById('roomDescription').value,
            max_members: parseInt(document.getElementById('roomMaxMembers').value)
        };

        try {
            const response = await fetch('/api/chatrooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                showNotification('创建成功', 'success');
                modal.style.display = 'none';
                form.reset();
                loadChatrooms();
            }
        } catch (error) {
            showNotification('创建失败', 'error');
        }
    });
}

async function loadChatrooms() {
    const chatroomsList = document.getElementById('chatroomsList');

    try {
        const response = await fetch('/api/chatrooms');
        const result = await response.json();

        if (result.success) {
            displayChatrooms(result.chatrooms);
        }
    } catch (error) {
        chatroomsList.innerHTML = '<div class="loading">加载失败</div>';
    }
}

function displayChatrooms(chatrooms) {
    const chatroomsList = document.getElementById('chatroomsList');

    chatroomsList.innerHTML = chatrooms.map(room => `
        <div class="chatroom-card" onclick="joinChatroom(${room.id})">
            <div class="chatroom-header">
                <div class="chatroom-name">${room.name}</div>
                ${room.is_joined && room.unread_count > 0 ? `<span class="unread-badge chatroom-unread">${room.unread_count > 99 ? '99+' : room.unread_count}</span>` : ''}
            </div>
            <div class="chatroom-desc">${room.description || '暂无简介'}</div>
            <div class="chatroom-info">
                <span class="chatroom-type">${room.room_type === 'public' ? '公开' : '私密'}</span>
                <span>${room.current_members}/${room.max_members}</span>
            </div>
        </div>
    `).join('');
}

async function joinChatroom(roomId) {
    try {
        const response = await fetch(`/api/chatrooms/${roomId}/join`, {
            method: 'POST'
        });

        const result = await response.json();
        if (result.success) {
            showNotification('加入成功', 'success');
            // 打开聊天室界面
            openGroupChat(roomId, result.chatroom ? result.chatroom.name : '聊天室');
        } else {
            showNotification(result.message, 'warning');
        }
    } catch (error) {
        showNotification('加入失败', 'error');
    }
}

// ==================== 动态广场 ====================
function initSquare() {
    const createBtn = document.getElementById('createPostBtn');
    const modal = document.getElementById('postModal');
    const closeBtn = document.getElementById('closePostModal');
    const form = document.getElementById('postForm');

    createBtn.addEventListener('click', () => modal.style.display = 'flex');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            content: document.getElementById('postContent').value,
            is_anonymous: document.getElementById('postAnonymous').checked
        };

        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                showNotification('发布成功', 'success');
                modal.style.display = 'none';
                form.reset();
                loadPosts();
            }
        } catch (error) {
            showNotification('发布失败', 'error');
        }
    });
}

async function loadPosts() {
    const postsList = document.getElementById('postsList');

    try {
        const response = await fetch('/api/posts');
        const result = await response.json();

        if (result.success) {
            displayPosts(result.posts);
        }
    } catch (error) {
        postsList.innerHTML = '<div class="loading">加载失败</div>';
    }
}

function displayPosts(posts) {
    const postsList = document.getElementById('postsList');

    if (posts.length === 0) {
        postsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📰</div>
                <p>还没有动态，快来发布第一条吧！</p>
            </div>
        `;
        return;
    }

    postsList.innerHTML = posts.map(post => {
        const avatarUrl = post.author.avatar_url || '/static/avatars/avatar_test1.svg';
        return `
        <div class="post-card">
            <div class="post-header">
                <img src="${avatarUrl}" class="post-avatar" onerror="this.src='/static/avatars/avatar_435053.svg'">
                <div class="post-author">
                    <div class="post-author-name">${post.author.nickname}</div>
                    <div class="post-time">${post.created_at}</div>
                </div>
            </div>
            <div class="post-content">${post.content}</div>
            ${post.image_url ? `<img src="${post.image_url}" class="post-image">` : ''}
            <div class="post-actions">
                <span class="post-action ${post.is_liked ? 'liked' : ''}" onclick="likePost(${post.id})">
                    ${post.is_liked ? '❤️' : '🤍'} ${post.like_count}
                </span>
                <span class="post-action" onclick="showComments(${post.id})">
                    💬 ${post.comment_count}
                </span>
            </div>
        </div>
        `;
    }).join('');
}

async function likePost(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST'
        });

        const result = await response.json();
        if (result.success) {
            loadPosts();
        }
    } catch (error) {
        console.error('点赞失败:', error);
    }
}

function showComments(postId) {
    // TODO: 实现评论显示
    showNotification('评论功能开发中', 'info');
}

// ==================== 个人中心 ====================
function initProfile() {
    // 初始化
}

async function loadProfile() {
    const profileContent = document.getElementById('profileContent');

    try {
        const response = await fetch('/api/user/profile');
        const result = await response.json();

        if (result.success) {
            displayProfile(result.user);
        }
    } catch (error) {
        profileContent.innerHTML = '<div class="loading">加载失败</div>';
    }
}

function displayProfile(user) {
    const profileContent = document.getElementById('profileContent');

    const faceStatus = user.face_registered
        ? '<span class="face-status-registered">✓ 已注册人脸</span>'
        : '<span class="face-status-unregistered">未注册人脸</span>';

    const faceButton = user.face_registered
        ? '<button class="btn btn-outline" onclick="updateFaceRegister()">更新人脸</button> <button class="btn btn-outline" style="color: var(--danger-color, #e74c3c); border-color: var(--danger-color, #e74c3c);" onclick="clearFaceRegister()">清除人脸</button>'
        : '<button class="btn btn-primary" onclick="registerFace()">注册人脸</button>';

    profileContent.innerHTML = `
        <div class="profile-header">
            <img src="${user.avatar_url}" class="profile-avatar">
            <div class="profile-info">
                <h3>${user.nickname}</h3>
                <p class="profile-bio">${user.bio || '这个人很懒，还没有填写简介'}</p>
                ${user.is_vip ? '<span class="vip-badge">VIP会员</span>' : ''}
            </div>
            <div class="profile-stats">
                <div class="stat-item-small">
                    <div class="stat-value">${user.total_chats}</div>
                    <div class="stat-label-small">聊天</div>
                </div>
                <div class="stat-item-small">
                    <div class="stat-value">${user.total_matches}</div>
                    <div class="stat-label-small">匹配</div>
                </div>
                <div class="stat-item-small">
                    <div class="stat-value">${user.points}</div>
                    <div class="stat-label-small">积分</div>
                </div>
            </div>
        </div>
        <div class="profile-sections">
            <div class="profile-section">
                <h4>账户信息</h4>
                <p>用户名: ${user.username}</p>
                <p>性别: ${user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '保密'}</p>
                <p>年龄: ${user.age}</p>
                ${user.vip_expire_at ? `<p>VIP到期: ${user.vip_expire_at}</p>` : ''}
            </div>
            <div class="profile-section">
                <h4>人脸识别</h4>
                <p>状态: ${faceStatus}</p>
                <p style="font-size: 0.9rem; color: var(--text-secondary);">注册人脸后，可通过人脸识别快速登录</p>
                ${faceButton}
            </div>
            <div class="profile-section">
                <h4>充值积分</h4>
                <button class="btn btn-primary" onclick="showRechargeModal()">充值积分</button>
                <button class="btn btn-outline" onclick="showVipModal()">开通VIP</button>
            </div>
        </div>
    `;
}

async function loadUserProfile() {
    try {
        const response = await fetch('/api/user/profile');
        const result = await response.json();

        if (result.success) {
            AppState.currentUser = result.user;
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
}

// ==================== 通知系统 ====================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== 全局函数 ====================
function showRechargeModal() {
    showNotification('充值功能开发中', 'info');
}

function showVipModal() {
    showNotification('VIP功能开发中', 'info');
}

// ==================== 聊天室群聊 ====================
let currentGroupChat = null;

function openGroupChat(roomId, roomName) {
    currentGroupChat = { roomId, roomName };

    // 更新聊天室窗口
    document.getElementById('groupChatName').textContent = roomName;
    document.getElementById('groupChatMessages').innerHTML = '';

    // 关闭私聊窗口
    const privateChatWindow = document.getElementById('chatWindow');
    if (privateChatWindow) {
        privateChatWindow.classList.remove('open');
        setTimeout(() => privateChatWindow.style.display = 'none', 300);
    }

    // 显示聊天室窗口
    const groupChatWindow = document.getElementById('groupChatWindow');
    groupChatWindow.style.display = 'flex';
    setTimeout(() => groupChatWindow.classList.add('open'), 10);

    // 加载聊天室消息
    loadGroupChatMessages(roomId);

    // 标记聊天室消息为已读
    markChatroomAsRead(roomId);

    // 加入Socket房间
    if (AppState.socket) {
        AppState.socket.emit('join_room', { room_id: roomId });
    }
}

function closeGroupChat() {
    const groupChatWindow = document.getElementById('groupChatWindow');
    groupChatWindow.classList.remove('open');
    setTimeout(() => groupChatWindow.style.display = 'none', 300);

    // 离开Socket房间
    if (AppState.socket && currentGroupChat) {
        AppState.socket.emit('leave_room', { room_id: currentGroupChat.roomId });
    }

    currentGroupChat = null;
}

async function markChatroomAsRead(roomId) {
    try {
        await fetch(`/api/chatrooms/${roomId}/read`, {
            method: 'POST'
        });
        // 刷新聊天室列表以清除未读徽标
        loadChatrooms();
        // 清除侧边栏聊天室徽标
        clearChatroomsUnreadBadge();
    } catch (error) {
        console.error('标记聊天室已读失败:', error);
    }
}

async function refreshUnreadCounts() {
    // 刷新好友和聊天室的未读计数
    loadFriends();
    loadChatrooms();
}

async function loadGroupChatMessages(roomId) {
    try {
        const response = await fetch(`/api/chatrooms/${roomId}/messages`);
        const result = await response.json();

        if (result.success) {
            displayGroupChatMessages(result.messages);
        }
    } catch (error) {
        console.error('加载聊天室消息失败:', error);
    }
}

function displayGroupChatMessages(messages) {
    const messagesContainer = document.getElementById('groupChatMessages');

    messagesContainer.innerHTML = messages.map(msg => {
        const isSent = msg.sender_id === AppState.currentUser?.id;
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                ${!isSent ? `<img src="${msg.sender_avatar || '/static/avatars/avatar_test1.svg'}" class="message-avatar">` : ''}
                <div class="message-content">
                    ${!isSent ? `<div class="message-sender">${msg.sender_nickname}</div>` : ''}
                    ${msg.content || ''}
                    <div class="message-time">${msg.created_at}</div>
                </div>
            </div>
        `;
    }).join('');

    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendGroupChatMessage() {
    const chatInput = document.getElementById('groupChatInput');
    const content = chatInput.value.trim();

    if (!content || !currentGroupChat) return;

    // 发送到聊天室
    if (AppState.socket) {
        AppState.socket.emit('room_message', {
            room_id: currentGroupChat.roomId,
            content: content
        });
    }

    // 清空输入框
    chatInput.value = '';

    // 显示临时消息（带特殊标记）
    const tempId = 'temp_' + Date.now();
    addGroupChatMessage({
        id: tempId,
        sender_id: AppState.currentUser?.id,
        sender_nickname: AppState.currentUser?.nickname,
        sender_avatar: AppState.currentUser?.avatar_url,
        content: content,
        created_at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        isTemp: true
    });
}

function addGroupChatMessage(message) {
    const messagesContainer = document.getElementById('groupChatMessages');
    const isSent = message.sender_id === AppState.currentUser?.id;

    // 如果是自己发送的消息，先移除临时消息
    if (isSent && !message.isTemp) {
        const tempMsg = messagesContainer.querySelector('[data-temp="true"]');
        if (tempMsg) {
            tempMsg.remove();
        }
    }

    const messageHtml = `
        <div class="message ${isSent ? 'sent' : 'received'}" ${message.isTemp ? 'data-temp="true"' : ''} data-message-id="${message.id}">
            ${!isSent ? `<img src="${message.sender_avatar || '/static/avatars/avatar_test1.svg'}" class="message-avatar">` : ''}
            <div class="message-content">
                ${!isSent ? `<div class="message-sender">${message.sender_nickname}</div>` : ''}
                ${message.content || ''}
                <div class="message-time">${message.created_at}</div>
            </div>
        </div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleNewRoomMessage(data) {
    // 如果在当前聊天室，显示消息
    if (currentGroupChat && data.room_id === currentGroupChat.roomId) {
        addGroupChatMessage(data);
    } else {
        // 其他聊天室消息，增加聊天室未读计数
        AppState.chatroomsUnreadCount++;
        updateChatroomsUnreadBadge();
        showNotification(`聊天室 ${data.room_name || ''} 有新消息`, 'info');
    }
}

// ==================== 人脸注册 ====================
let faceStream = null;

function registerFace() {
    openFaceModal('register');
}

function updateFaceRegister() {
    openFaceModal('update');
}

function openFaceModal(mode) {
    // 创建人脸注册弹窗
    const modalHtml = `
        <div class="modal" id="faceRegisterModal" style="display: flex;">
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header">
                    <h3>${mode === 'register' ? '注册人脸' : '更新人脸'}</h3>
                    <button class="modal-close" onclick="closeFaceModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <video id="faceRegVideo" autoplay playsinline style="width: 100%; border-radius: 8px;"></video>
                    <canvas id="faceRegCanvas" style="display: none;"></canvas>
                    <p id="faceRegStatus" style="text-align: center; margin: 1rem 0;">请将脸部对准摄像头</p>
                    <div class="modal-actions" style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" id="captureRegBtn">拍照</button>
                        <button class="btn btn-outline" onclick="closeFaceModal()">取消</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 移除已存在的弹窗
    const existingModal = document.getElementById('faceRegisterModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 添加新弹窗
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 绑定事件
    document.getElementById('captureRegBtn').addEventListener('click', captureFaceRegister);

    // 启动摄像头
    startFaceCamera();
}

async function startFaceCamera() {
    try {
        faceStream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.getElementById('faceRegVideo').srcObject = faceStream;
    } catch (err) {
        document.getElementById('faceRegStatus').textContent = '无法访问摄像头: ' + err.message;
    }
}

function closeFaceModal() {
    const modal = document.getElementById('faceRegisterModal');
    if (modal) {
        modal.remove();
    }

    // 停止摄像头
    if (faceStream) {
        faceStream.getTracks().forEach(track => track.stop());
        faceStream = null;
    }
}

async function captureFaceRegister() {
    const video = document.getElementById('faceRegVideo');
    const canvas = document.getElementById('faceRegCanvas');
    const status = document.getElementById('faceRegStatus');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg');
    status.textContent = '处理中...';

    try {
        const response = await fetch('/api/face/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        const result = await response.json();

        if (result.success) {
            status.textContent = '注册成功！';
            showNotification('人脸注册成功！', 'success');

            setTimeout(() => {
                closeFaceModal();
                loadProfile(); // 重新加载用户信息
            }, 1500);
        } else {
            status.textContent = result.message;
        }
    } catch (err) {
        status.textContent = '注册失败，请稍后重试';
    }
}

async function clearFaceRegister() {
    if (!confirm('确定要清除已注册的人脸吗？清除后需要重新注册才能使用人脸识别登录。')) {
        return;
    }

    try {
        const response = await fetch('/api/face/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            showNotification('人脸已清除', 'success');
            loadProfile(); // 重新加载用户信息
        } else {
            showNotification(result.message, 'error');
        }
    } catch (err) {
        showNotification('操作失败，请稍后重试', 'error');
    }
}

// 点击弹窗外部关闭
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// ==================== WebRTC语音通话 ====================
const WebRTCCall = {
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    currentCall: null,
    callTimer: null,
    callSeconds: 0,
    isMuted: false,
    isSpeakerOn: true,
    isVideoCall: false,
    isCameraOff: false,
    isEnding: false,

    // STUN服务器配置（使用公共STUN服务器）
    iceServers: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    },

    // 初始化通话
    async initCall(isCaller, remoteUserId, remoteUserName, remoteUserAvatar) {
        try {
            console.log(`初始化WebRTC: ${isCaller ? '主叫' : '被叫'}方, 视频: ${this.isVideoCall}`);

            // 获取本地媒体流
            if (this.isVideoCall) {
                // 视频通话：分步获取权限以提高兼容性
                try {
                    // 先尝试同时获取音频和视频
                    const constraints = {
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        },
                        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
                    };
                    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                    console.log('同时获取音频和视频成功');
                } catch (videoError) {
                    console.warn('同时获取失败，尝试分步获取:', videoError);
                    // 如果同时获取失败，分步获取
                    try {
                        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });

                        // 合并两个流的轨道
                        this.localStream = new MediaStream([
                            ...audioStream.getAudioTracks(),
                            ...videoStream.getVideoTracks()
                        ]);
                        console.log('分步获取音频和视频成功');
                    } catch (separateError) {
                        console.error('分步获取也失败:', separateError);
                        throw new Error('无法访问摄像头或麦克风，请检查浏览器权限设置');
                    }
                }
            } else {
                // 语音通话：只获取音频
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                };
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('获取音频成功');
            }

            // 如果是视频通话，显示本地视频
            if (this.isVideoCall) {
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                    localVideo.muted = true;
                }
            }

            // 创建RTCPeerConnection
            this.peerConnection = new RTCPeerConnection(this.iceServers);

            // 添加本地流到连接
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // 监听远程流
            this.peerConnection.ontrack = (event) => {
                console.log('收到远程流，类型:', event.track.kind);
                if (!this.remoteStream) {
                    this.remoteStream = event.streams[0];
                } else {
                    const existingTracks = this.remoteStream.getTracks();
                    const newTracks = event.streams[0].getTracks();
                    newTracks.forEach(track => {
                        if (!existingTracks.find(t => t.kind === track.kind)) {
                            this.remoteStream.addTrack(track);
                        }
                    });
                }

                console.log('远程流信息:', {
                    audioTracks: this.remoteStream.getAudioTracks().length,
                    videoTracks: this.remoteStream.getVideoTracks().length
                });

                if (this.isVideoCall) {
                    const remoteVideo = document.getElementById('remoteVideo');
                    if (remoteVideo && this.remoteStream) {
                        remoteVideo.srcObject = this.remoteStream;
                    }
                } else {
                    this.playRemoteAudio();
                }
            };

            // 监听ICE候选
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    const targetId = isCaller ? remoteUserId : (this.currentCall?.callerId || remoteUserId);
                    console.log('发送ICE候选');
                    AppState.socket.emit('webrtc_ice_candidate', {
                        target_user_id: targetId,
                        candidate: event.candidate
                    });
                }
            };

            // 监听连接状态
            this.peerConnection.onconnectionstatechange = () => {
                console.log('连接状态:', this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'connected') {
                    document.getElementById('callStatus').textContent = '通话中';
                    if (!this.callTimer) {
                        this.startCallTimer();
                    }
                } else if (this.peerConnection.connectionState === 'disconnected') {
                    this.endCall();
                }
            };

            // 监听ICE连接状态
            this.peerConnection.oniceconnectionstatechange = () => {
                const state = this.peerConnection.iceConnectionState;
                console.log('ICE连接状态:', state);

                if (state === 'connected') {
                    const statusEl = this.isVideoCall ? document.getElementById('videoCallStatus') : document.getElementById('callStatus');
                    if (statusEl) statusEl.textContent = '通话中';
                    if (!this.callTimer) {
                        this.startCallTimer();
                    }
                } else if (state === 'failed') {
                    console.log('ICE连接失败');
                    showNotification('连接失败，请检查网络', 'error');
                }
            };

            // 监听信令状态
            this.peerConnection.onsignalingstatechange = () => {
                console.log('信令状态:', this.peerConnection.signalingState);
            };

            // 保存当前通话信息
            if (!this.currentCall) {
                this.currentCall = {
                    isCaller: isCaller,
                    remoteUserId: remoteUserId,
                    remoteUserName: remoteUserName,
                    remoteUserAvatar: remoteUserAvatar
                };
            }

            // 被叫方设置callerId用于后续通信
            if (!isCaller) {
                this.currentCall.callerId = remoteUserId;
            }

            return true;
        } catch (error) {
            console.error('初始化通话失败:', error);
            showNotification('无法访问麦克风，请检查权限设置', 'error');
            return false;
        }
    },

    // 播放远程音频
    playRemoteAudio() {
        if (this.remoteStream && this.isSpeakerOn) {
            console.log('准备播放远程音频，音频轨道数:', this.remoteStream.getAudioTracks().length);

            // 移除旧的音频元素
            const oldAudio = document.getElementById('remoteAudio');
            if (oldAudio) {
                oldAudio.remove();
            }

            // 创建新的音频元素
            const audioElement = document.createElement('audio');
            audioElement.id = 'remoteAudio';
            audioElement.srcObject = this.remoteStream;
            audioElement.autoplay = true;
            audioElement.playsInline = true;

            // 添加事件监听器
            audioElement.onplay = () => console.log('音频开始播放');
            audioElement.onerror = (e) => console.error('音频播放错误:', e);
            audioElement.onloadedmetadata = () => console.log('音频元数据已加载');

            // 添加到DOM
            document.body.appendChild(audioElement);

            // 确保播放
            audioElement.play().then(() => {
                console.log('远程音频正在播放');
                showNotification('通话已连接', 'success');
            }).catch(err => {
                console.error('播放音频失败:', err);
                showNotification('无法播放音频，请检查浏览器权限', 'error');
            });
        } else {
            console.warn('无法播放音频 - remoteStream:', !!this.remoteStream, 'isSpeakerOn:', this.isSpeakerOn);
        }
    },

    // 显示通话界面
    showCallUI(status) {
        if (this.isVideoCall) {
            // 视频通话界面
            const overlay = document.getElementById('videoCallOverlay');
            const name = document.getElementById('videoCallName');
            const statusEl = document.getElementById('videoCallStatus');

            if (name) name.textContent = this.currentCall.remoteUserName;
            if (statusEl) statusEl.textContent = status === 'calling' ? '正在呼叫...' : '通话中';

            overlay.style.display = 'flex';
            this.bindVideoCallButtons();
        } else {
            // 语音通话界面
            const overlay = document.getElementById('callOverlay');
            const avatar = document.getElementById('callAvatar');
            const name = document.getElementById('callName');
            const statusEl = document.getElementById('callStatus');

            avatar.src = this.currentCall.remoteUserAvatar;
            name.textContent = this.currentCall.remoteUserName;

            if (status === 'calling') {
                statusEl.textContent = '正在呼叫...';
            } else if (status === 'connected') {
                statusEl.textContent = '通话中';
            }

            overlay.style.display = 'flex';
            this.bindCallButtons();
        }
    },

    // 绑定通话按钮事件
    bindCallButtons() {
        const muteBtn = document.getElementById('callMuteBtn');
        const endBtn = document.getElementById('callEndBtn');
        const speakerBtn = document.getElementById('callSpeakerBtn');

        muteBtn.onclick = () => this.toggleMute();
        endBtn.onclick = () => this.endCall('用户点击挂断');
        speakerBtn.onclick = () => this.toggleSpeaker();
    },

    // 绑定视频通话按钮
    bindVideoCallButtons() {
        const muteBtn = document.getElementById('videoMuteBtn');
        const cameraBtn = document.getElementById('videoCameraBtn');
        const endBtn = document.getElementById('videoEndBtn');
        const speakerBtn = document.getElementById('videoSpeakerBtn');

        if (muteBtn) muteBtn.onclick = () => this.toggleMute();
        if (cameraBtn) cameraBtn.onclick = () => this.toggleCamera();
        if (endBtn) endBtn.onclick = () => this.endCall('用户点击挂断');
        if (speakerBtn) speakerBtn.onclick = () => this.toggleSpeaker();
    },

    // 切换摄像头
    toggleCamera() {
        if (!this.localStream || !this.isVideoCall) return;

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isCameraOff = !this.isCameraOff;
            videoTrack.enabled = !this.isCameraOff;

            const cameraBtn = document.getElementById('videoCameraBtn');
            const cameraIcon = document.getElementById('videoCameraIcon');

            if (this.isCameraOff) {
                cameraBtn.classList.add('off');
                cameraIcon.textContent = '📷';
            } else {
                cameraBtn.classList.remove('off');
                cameraIcon.textContent = '📹';
            }
        }
    },

    // 切换静音
    toggleMute() {
        if (this.localStream) {
            this.isMuted = !this.isMuted;
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });

            if (this.isVideoCall) {
                const muteBtn = document.getElementById('videoMuteBtn');
                const muteIcon = document.getElementById('videoMuteIcon');

                if (this.isMuted) {
                    muteBtn.classList.add('off');
                    muteIcon.textContent = '🔇';
                } else {
                    muteBtn.classList.remove('off');
                    muteIcon.textContent = '🎤';
                }
            } else {
                const muteBtn = document.getElementById('callMuteBtn');
                const muteIcon = document.getElementById('muteIcon');

                if (this.isMuted) {
                    muteBtn.classList.add('muted');
                    muteIcon.textContent = '🔇';
                } else {
                    muteBtn.classList.remove('muted');
                    muteIcon.textContent = '🎤';
                }
            }
        }
    },

    // 切换扬声器
    toggleSpeaker() {
        this.isSpeakerOn = !this.isSpeakerOn;
        const speakerBtn = document.getElementById('callSpeakerBtn');

        if (this.isSpeakerOn) {
            speakerBtn.classList.remove('off');
            this.playRemoteAudio();
        } else {
            speakerBtn.classList.add('off');
            const audioElement = document.getElementById('remoteAudio');
            if (audioElement) {
                audioElement.pause();
            }
        }
    },

    // 开始计时
    startCallTimer() {
        this.callSeconds = 0;
        this.updateCallDuration();

        this.callTimer = setInterval(() => {
            this.callSeconds++;
            this.updateCallDuration();
        }, 1000);
    },

    // 更新通话时长显示
    updateCallDuration() {
        const minutes = Math.floor(this.callSeconds / 60);
        const seconds = this.callSeconds % 60;
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (this.isVideoCall) {
            const durationEl = document.getElementById('videoCallDuration');
            if (durationEl) durationEl.textContent = formattedTime;
        } else {
            const durationEl = document.getElementById('callDuration');
            if (durationEl) durationEl.textContent = formattedTime;
        }
    },

    // 处理offer
    async handleOffer(offer, callerId) {
        try {
            console.log('收到offer，创建answer');

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // 创建answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            console.log('发送answer');
            // 发送answer给对方
            AppState.socket.emit('webrtc_answer', {
                target_user_id: callerId,
                answer: answer
            });

            // 更新UI
            document.getElementById('callStatus').textContent = '正在连接...';

        } catch (error) {
            console.error('处理offer失败:', error);
        }
    },

    // 处理answer
    async handleAnswer(answer) {
        try {
            console.log('收到answer');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

            // UI在连接状态改变时更新
        } catch (error) {
            console.error('处理answer失败:', error);
        }
    },

    // 处理ICE候选
    async handleIceCandidate(candidate) {
        try {
            console.log('收到ICE候选');
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('ICE候选已添加');
        } catch (error) {
            console.error('添加ICE候选失败:', error);
        }
    },

    // 结束通话
    endCall(reason) {
        console.log('endCall被调用，原因:', reason || '未知');

        // 如果正在结束过程中，避免重复调用
        if (this.isEnding) {
            console.log('正在结束通话中，跳过重复调用');
            return;
        }

        this.isEnding = true;

        // 停止计时器
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }

        // 关闭媒体流
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        // 关闭连接
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // 移除远程音频元素
        const audioElement = document.getElementById('remoteAudio');
        if (audioElement) {
            audioElement.remove();
        }

        // 清理视频元素
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;

        // 隐藏UI
        document.getElementById('callOverlay').style.display = 'none';
        document.getElementById('videoCallOverlay').style.display = 'none';
        document.getElementById('incomingCallModal').style.display = 'none';

        // 通知对方
        if (this.currentCall && this.currentCall.isCaller) {
            AppState.socket.emit('call_end', {
                target_user_id: this.currentCall.remoteUserId
            });
        }

        // 重置状态
        this.currentCall = null;
        this.callSeconds = 0;
        this.isMuted = false;
        this.isSpeakerOn = true;
        this.isVideoCall = false;
        this.isCameraOff = false;
        this.isEnding = false;

        showNotification('通话已结束', 'info');
    },

    // 显示来电弹窗
    showIncomingCallModal(data) {
        const modal = document.getElementById('incomingCallModal');
        const avatar = document.getElementById('incomingCallAvatar');
        const name = document.getElementById('incomingCallName');
        const type = document.getElementById('incomingCallType');
        const icon = document.getElementById('incomingCallIcon');

        avatar.src = data.caller_avatar;
        name.textContent = data.caller_nickname;

        // 设置通话类型
        this.isVideoCall = data.call_type === 'video';
        type.textContent = this.isVideoCall ? '视频通话' : '语音通话';
        if (icon) icon.textContent = this.isVideoCall ? '📹' : '📞';

        modal.style.display = 'flex';

        // 保存来电信息
        this.currentCall = {
            callerId: data.caller_id,
            callerName: data.caller_nickname,
            callerAvatar: data.caller_avatar,
            callType: data.call_type,
            roomId: data.room_id,
            isCaller: false
        };

        // 绑定按钮
        document.getElementById('acceptCallBtn').onclick = () => {
            modal.style.display = 'none';
            this.acceptIncomingCall(data);
        };

        document.getElementById('rejectCallBtn').onclick = () => {
            modal.style.display = 'none';
            this.rejectIncomingCall(data);
        };
    },

    // 接听来电
    async acceptIncomingCall(data) {
        // 设置通话类型
        this.isVideoCall = data.call_type === 'video';

        // 通知对方接听
        AppState.socket.emit('call_response', {
            caller_id: data.caller_id,
            response: 'accept',
            room_id: data.room_id
        });

        // 解锁音频播放（浏览器需要用户交互）
        this.unlockAudio();

        // 初始化WebRTC连接（等待offer）
        await this.initCall(false, data.caller_id, data.caller_nickname, data.caller_avatar);

        // 显示等待界面
        this.showCallUI('calling');
    },

    // 解锁音频播放
    unlockAudio() {
        // 创建一个静音的音频来解锁浏览器音频
        const silentAudio = new Audio();
        silentAudio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==';
        silentAudio.play().catch(() => {});
        silentAudio.remove();
    },

    // 对方接听后，主叫方开始WebRTC连接
    async startWebRTCAfterAccept() {
        try {
            // 解锁音频播放
            this.unlockAudio();

            // 获取本地媒体流
            if (this.isVideoCall) {
                // 视频通话：分步获取权限以提高兼容性
                try {
                    // 先尝试同时获取音频和视频
                    const constraints = {
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        },
                        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
                    };
                    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                    console.log('同时获取音频和视频成功');
                } catch (videoError) {
                    console.warn('同时获取失败，尝试分步获取:', videoError);
                    // 如果同时获取失败，分步获取
                    try {
                        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });

                        // 合并两个流的轨道
                        this.localStream = new MediaStream([
                            ...audioStream.getAudioTracks(),
                            ...videoStream.getVideoTracks()
                        ]);
                        console.log('分步获取音频和视频成功');
                    } catch (separateError) {
                        console.error('分步获取也失败:', separateError);
                        throw new Error('无法访问摄像头或麦克风，请检查浏览器权限设置');
                    }
                }
            } else {
                // 语音通话：只获取音频
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                };
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('获取音频成功');
            }

            // 如果是视频通话，显示本地视频
            if (this.isVideoCall) {
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                    localVideo.muted = true;
                }
            }

            // 创建RTCPeerConnection
            this.peerConnection = new RTCPeerConnection(this.iceServers);

            console.log('创建PeerConnection成功');

            // 添加本地流到连接
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // 监听远程流
            this.peerConnection.ontrack = (event) => {
                console.log('收到远程流，类型:', event.track.kind);
                if (!this.remoteStream) {
                    this.remoteStream = event.streams[0];
                } else {
                    const existingTracks = this.remoteStream.getTracks();
                    const newTracks = event.streams[0].getTracks();
                    newTracks.forEach(track => {
                        if (!existingTracks.find(t => t.kind === track.kind)) {
                            this.remoteStream.addTrack(track);
                        }
                    });
                }

                console.log('远程流信息:', {
                    audioTracks: this.remoteStream.getAudioTracks().length,
                    videoTracks: this.remoteStream.getVideoTracks().length
                });

                if (this.isVideoCall) {
                    const remoteVideo = document.getElementById('remoteVideo');
                    if (remoteVideo && this.remoteStream) {
                        remoteVideo.srcObject = this.remoteStream;
                    }
                } else {
                    this.playRemoteAudio();
                }
            };

            // 监听ICE候选
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('发送ICE候选');
                    AppState.socket.emit('webrtc_ice_candidate', {
                        target_user_id: this.currentCall.remoteUserId,
                        candidate: event.candidate
                    });
                }
            };

            // 监听连接状态
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                console.log('连接状态变化:', state);

                if (state === 'connected') {
                    const statusEl = this.isVideoCall ? document.getElementById('videoCallStatus') : document.getElementById('callStatus');
                    if (statusEl) statusEl.textContent = '通话中';
                    // 开始计时
                    if (!this.callTimer) {
                        this.startCallTimer();
                    }
                } else if (state === 'failed') {
                    console.log('连接失败，结束通话');
                    this.endCall('连接失败');
                }
            };

            // 监听ICE连接状态
            this.peerConnection.oniceconnectionstatechange = () => {
                const state = this.peerConnection.iceConnectionState;
                console.log('ICE连接状态:', state);

                if (state === 'connected') {
                    const statusEl = this.isVideoCall ? document.getElementById('videoCallStatus') : document.getElementById('callStatus');
                    if (statusEl) statusEl.textContent = '通话中';
                    if (!this.callTimer) {
                        this.startCallTimer();
                    }
                } else if (state === 'failed') {
                    console.log('ICE连接失败');
                    showNotification('连接失败，请检查网络', 'error');
                }
            };

            // 监听信令状态
            this.peerConnection.onsignalingstatechange = () => {
                console.log('信令状态:', this.peerConnection.signalingState);
            };

            // 创建offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            console.log('发送offer');
            // 发送offer给对方
            AppState.socket.emit('webrtc_offer', {
                target_user_id: this.currentCall.remoteUserId,
                offer: offer
            });

            // 更新UI状态
            const statusEl = this.isVideoCall ? document.getElementById('videoCallStatus') : document.getElementById('callStatus');
            if (statusEl) statusEl.textContent = '正在连接...';

        } catch (error) {
            console.error('启动WebRTC失败:', error);
            showNotification('无法建立通话连接', 'error');
            this.endCall('初始化失败');
        }
    },

    // 拒绝来电
    rejectIncomingCall(data) {
        AppState.socket.emit('call_response', {
            caller_id: data.caller_id,
            response: 'reject',
            room_id: data.room_id
        });

        this.currentCall = null;
    }
};

// 替换原有的通话函数
function startCall(callType) {
    if (!AppState.currentChat) return;

    if (callType === 'voice') {
        // 检查是否已解锁语音通话
        if (AppState.currentChat.friendshipId) {
            checkVoiceCallUnlocked();
        } else {
            showNotification('请先开始聊天', 'warning');
        }
    } else if (callType === 'video') {
        // 检查是否已解锁视频通话
        if (AppState.currentChat.friendshipId) {
            checkVideoCallUnlocked();
        } else {
            showNotification('请先开始聊天', 'warning');
        }
    }
}

async function checkVoiceCallUnlocked() {
    try {
        // 检查currentChat是否存在
        if (!AppState.currentChat) {
            showNotification('请先开始聊天', 'warning');
            return;
        }

        // 检查friendshipId是否存在
        if (!AppState.currentChat.friendshipId) {
            showNotification('请先开始聊天', 'warning');
            return;
        }

        console.log('检查语音通话解锁状态，friendshipId:', AppState.currentChat.friendshipId);

        const response = await fetch(`/api/friendship/${AppState.currentChat.friendshipId}/status`);

        // 检查HTTP状态码
        if (!response.ok) {
            if (response.status === 403) {
                showNotification('无权访问此好友关系', 'error');
                return;
            } else if (response.status === 404) {
                showNotification('好友关系不存在', 'error');
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        console.log('解锁状态检查结果:', result);

        if (result.success && result.friendship && result.friendship.progress && result.friendship.progress.voice_call && result.friendship.progress.voice_call.unlocked) {
            WebRTCCall.isVideoCall = false;
            // 解锁音频
            WebRTCCall.unlockAudio();

            // 保存通话信息，等待对方接听后再创建WebRTC连接
            WebRTCCall.currentCall = {
                isCaller: true,
                remoteUserId: AppState.currentChat.userId,
                remoteUserName: AppState.currentChat.nickname,
                remoteUserAvatar: AppState.currentChat.avatarUrl
            };

            // 发起通话请求
            AppState.socket.emit('call_request', {
                receiver_id: AppState.currentChat.userId,
                call_type: 'voice'
            });

            // 显示呼叫界面
            WebRTCCall.showCallUI('calling');
            showNotification('正在发起语音通话...', 'info');
        } else {
            const rounds = result.friendship?.chat_rounds || 0;
            showNotification(`语音通话未解锁，需要10轮聊天，当前${rounds}轮`, 'warning');
        }
    } catch (error) {
        console.error('检查解锁状态失败:', error);
        showNotification(`无法检查解锁状态: ${error.message}`, 'error');
    }
}

async function checkVideoCallUnlocked() {
    try {
        // 检查currentChat是否存在
        if (!AppState.currentChat) {
            showNotification('请先开始聊天', 'warning');
            return;
        }

        // 检查friendshipId是否存在
        if (!AppState.currentChat.friendshipId) {
            showNotification('请先开始聊天', 'warning');
            return;
        }

        console.log('检查视频通话解锁状态，friendshipId:', AppState.currentChat.friendshipId);

        const response = await fetch(`/api/friendship/${AppState.currentChat.friendshipId}/status`);

        // 检查HTTP状态码
        if (!response.ok) {
            if (response.status === 403) {
                showNotification('无权访问此好友关系', 'error');
                return;
            } else if (response.status === 404) {
                showNotification('好友关系不存在', 'error');
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        console.log('解锁状态检查结果:', result);

        if (result.success && result.friendship && result.friendship.progress && result.friendship.progress.video_call && result.friendship.progress.video_call.unlocked) {
            WebRTCCall.isVideoCall = true;
            // 解锁音频
            WebRTCCall.unlockAudio();

            // 保存通话信息，等待对方接听后再创建WebRTC连接
            WebRTCCall.currentCall = {
                isCaller: true,
                remoteUserId: AppState.currentChat.userId,
                remoteUserName: AppState.currentChat.nickname,
                remoteUserAvatar: AppState.currentChat.avatarUrl
            };

            // 显示呼叫界面（先显示界面，然后在后台检查权限）
            WebRTCCall.showCallUI('calling');
            showNotification('正在发起视频通话...', 'info');

            // 在后台预检查权限，但不要阻塞呼叫流程
            checkVideoCallPermissions().catch(err => {
                console.warn('权限检查警告:', err);
                // 权限检查失败不影响呼叫流程，对方接听时会再次尝试获取权限
            });

            // 发起通话请求
            AppState.socket.emit('call_request', {
                receiver_id: AppState.currentChat.userId,
                call_type: 'video'
            });
        } else {
            const rounds = result.friendship?.chat_rounds || 0;
            showNotification(`视频通话未解锁，需要15轮聊天，当前${rounds}轮`, 'warning');
        }
    } catch (error) {
        console.error('检查解锁状态失败:', error);
        showNotification(`无法检查解锁状态: ${error.message}`, 'error');
    }
}

// 检查视频通话权限（不阻塞，仅用于提前提示用户）
async function checkVideoCallPermissions() {
    try {
        // 尝试获取权限（不实际使用流）
        const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // 立即停止测试流
        testStream.getTracks().forEach(track => track.stop());
        console.log('视频通话权限检查通过');
    } catch (error) {
        console.warn('视频通话权限检查失败:', error);

        // 根据错误类型给出具体提示
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            showNotification('请允许访问摄像头和麦克风以使用视频通话', 'warning');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            showNotification('未检测到摄像头或麦克风设备', 'warning');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            showNotification('摄像头或麦克风正被其他应用占用', 'warning');
        } else {
            showNotification('视频通话需要摄像头和麦克风权限', 'warning');
        }
        throw error;
    }
}

function handleIncomingCall(data) {
    WebRTCCall.showIncomingCallModal(data);
}

function handleCallResponse(data) {
    if (data.response === 'accept') {
        showNotification('对方已接听', 'success');
        // 对方接听后，主叫方开始创建WebRTC连接
        WebRTCCall.startWebRTCAfterAccept();
    } else if (data.response === 'reject') {
        showNotification('对方拒绝了通话', 'warning');
        WebRTCCall.endCall();
    } else {
        showNotification('对方忙碌中', 'warning');
        WebRTCCall.endCall();
    }
}
