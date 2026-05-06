// 蒙面畅聊 - 全局JavaScript

// ==================== 通知样式 ====================
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: var(--background-card);
        border-left: 4px solid var(--primary-color);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        z-index: 9999;
        transform: translateX(120%);
        transition: transform 0.3s ease;
        max-width: 400px;
    }

    .notification.show {
        transform: translateX(0);
    }

    .notification-info {
        border-color: var(--primary-color);
    }

    .notification-success {
        border-color: var(--success-color);
    }

    .notification-warning {
        border-color: var(--warning-color);
    }

    .notification-error {
        border-color: var(--danger-color);
    }

    /* 滚动条样式 */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    ::-webkit-scrollbar-track {
        background: var(--background-dark);
    }

    ::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: var(--text-secondary);
    }
`;
document.head.appendChild(style);

// ==================== 工具函数 ====================

// 格式化时间
function formatTime(date) {
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
        return '刚刚';
    } else if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`;
    } else if (diff < 604800000) {
        return `${Math.floor(diff / 86400000)}天前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

// 截断文本
function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==================== 本地存储 ====================
const Storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    clear() {
        localStorage.clear();
    }
};

// ==================== API请求封装 ====================
const API = {
    async request(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const finalOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, finalOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '请求失败');
            }

            return data;
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    },

    get(url) {
        return this.request(url, { method: 'GET' });
    },

    post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    delete(url) {
        return this.request(url, { method: 'DELETE' });
    }
};

// ==================== 登出处理 ====================
async function handleLogout() {
    if (!confirm('确定要退出登录吗？')) {
        return;
    }

    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
        // 忽略错误，直接跳转
    }

    // 清除所有本地存储
    localStorage.clear();
    sessionStorage.clear();

    // 跳转回首页
    window.location.href = '/';
}

// ==================== 表情选择器 ====================
const Emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗',
    '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
    '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑',
    '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
    '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳',
    '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
    '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
    '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
    '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    '👍', '👎', '👏', '🙌', '🤝', '❤️', '💔', '💯'
];

function showEmojiPicker(callback, triggerElement) {
    // 移除已存在的选择器
    const existing = document.querySelector('.emoji-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    picker.innerHTML = `
        <div class="emoji-picker-header">
            <span>选择表情</span>
            <button class="emoji-close">&times;</button>
        </div>
        <div class="emoji-list">
            ${Emojis.map(emoji => `<span class="emoji-item">${emoji}</span>`).join('')}
        </div>
    `;

    document.body.appendChild(picker);

    // 计算位置 - 跟随触发按钮
    if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        const pickerWidth = 280; // 弹窗宽度
        let left = rect.left - pickerWidth + rect.width;
        let top = rect.bottom + 5;

        // 边界检测 - 确保不超出视窗
        if (left < 10) left = 10;
        if (left + pickerWidth > window.innerWidth - 10) {
            left = window.innerWidth - pickerWidth - 10;
        }
        if (top + 250 > window.innerHeight) {
            top = rect.top - 255;
        }

        picker.style.position = 'fixed';
        picker.style.left = left + 'px';
        picker.style.top = top + 'px';
    }

    // 事件处理
    picker.querySelector('.emoji-close').addEventListener('click', () => picker.remove());

    picker.querySelectorAll('.emoji-item').forEach(item => {
        item.addEventListener('click', () => {
            callback(item.textContent);
            picker.remove();
        });
    });

    // 点击外部关闭
    setTimeout(() => {
        function closeOnClickOutside(e) {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closeOnClickOutside);
            }
        }
        document.addEventListener('click', closeOnClickOutside);
    }, 10);
}

// ==================== 图片预览 ====================
function previewImage(url) {
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
        <div class="image-preview-content">
            <img src="${url}" alt="预览">
            <button class="image-preview-close">&times;</button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.image-preview-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ==================== 音频播放器 ====================
function playAudio(url) {
    const audio = new Audio(url);
    audio.play();
    return audio;
}

// ==================== 视频通话 ====================
let localStream = null;
let remoteStream = null;

async function startVideoCall(roomId) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // TODO: 实现WebRTC连接
        showNotification('视频通话功能开发中', 'info');
    } catch (error) {
        showNotification('无法访问摄像头和麦克风', 'error');
    }
}

async function startVoiceCall(roomId) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // TODO: 实现WebRTC连接
        showNotification('语音通话功能开发中', 'info');
    } catch (error) {
        showNotification('无法访问麦克风', 'error');
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
}

// ==================== 页面可见性 ====================
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // 页面隐藏时暂停某些操作
        console.log('页面隐藏');
    } else {
        // 页面显示时恢复操作
        console.log('页面显示');
        if (typeof AppState !== 'undefined' && AppState.socket && !AppState.socket.connected) {
            AppState.socket.connect();
        }
    }
});

// ==================== 错误处理 ====================
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});

// ==================== 页面加载完成 ====================
window.addEventListener('load', () => {
    console.log('🎭 蒙面畅聊已加载');
});

// ==================== 导出 ====================
// AppState在app.js中定义，这里不导出
window.Storage = Storage;
window.API = API;
window.showEmojiPicker = showEmojiPicker;
window.previewImage = previewImage;
