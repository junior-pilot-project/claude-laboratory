class ChatClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.username = '사용자' + Math.floor(Math.random() * 1000);
        this.init();
    }

    init() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.usernameElement = document.getElementById('username');

        this.usernameElement.textContent = this.username;
        this.setupEventListeners();
        this.connectToServer();
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());

        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.sendButton.disabled = this.messageInput.value.trim() === '';
        });

        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.close();
            }
        });
    }

    connectToServer() {
        try {
            this.socket = new WebSocket('ws://localhost:8080/websocket');

            this.socket.onopen = (event) => {
                console.log('서버에 연결되었습니다.');
                this.isConnected = true;
                this.updateConnectionStatus(true);
                this.addSystemMessage('서버에 연결되었습니다.');
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.socket.onclose = (event) => {
                console.log('서버 연결이 끊어졌습니다.');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.addSystemMessage('서버 연결이 끊어졌습니다. 재연결을 시도합니다...');

                setTimeout(() => {
                    this.reconnect();
                }, 3000);
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket 오류:', error);
                this.addSystemMessage('연결 오류가 발생했습니다.');
            };

        } catch (error) {
            console.error('서버 연결 실패:', error);
            this.addSystemMessage('서버에 연결할 수 없습니다.');
            setTimeout(() => {
                this.reconnect();
            }, 5000);
        }
    }

    reconnect() {
        if (!this.isConnected) {
            this.connectToServer();
        }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();

        if (message === '' || !this.isConnected) {
            return;
        }

        const messageData = {
            type: 'message',
            username: this.username,
            content: message,
            timestamp: new Date().toISOString()
        };

        try {
            this.socket.send(JSON.stringify(messageData));
            this.addMessage(messageData, true);
            this.messageInput.value = '';
            this.sendButton.disabled = true;
        } catch (error) {
            console.error('메시지 전송 실패:', error);
            this.addSystemMessage('메시지 전송에 실패했습니다.');
        }
    }

    handleMessage(data) {
        try {
            const messageData = JSON.parse(data);

            switch (messageData.type) {
                case 'message':
                    this.addMessage(messageData, false);
                    break;
                case 'system':
                    this.addSystemMessage(messageData.content);
                    break;
                case 'userJoined':
                    this.addSystemMessage(`${messageData.username}님이 입장했습니다.`);
                    break;
                case 'userLeft':
                    this.addSystemMessage(`${messageData.username}님이 퇴장했습니다.`);
                    break;
                default:
                    console.log('알 수 없는 메시지 타입:', messageData);
            }
        } catch (error) {
            console.error('메시지 파싱 오류:', error);
        }
    }

    addMessage(messageData, isSent) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = messageData.content;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(messageData.timestamp);

        contentDiv.appendChild(timeDiv);
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);

        this.scrollToBottom();
    }

    addSystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.style.textAlign = 'center';
        messageDiv.style.color = '#666';
        messageDiv.style.fontSize = '14px';
        messageDiv.style.margin = '10px 0';
        messageDiv.textContent = content;

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updateConnectionStatus(isConnected) {
        const statusElement = document.querySelector('.status');
        if (statusElement) {
            statusElement.className = `status ${isConnected ? 'online' : 'offline'}`;
        }

        this.sendButton.disabled = !isConnected || this.messageInput.value.trim() === '';
        this.messageInput.disabled = !isConnected;

        if (!isConnected) {
            this.messageInput.placeholder = '서버에 연결 중...';
        } else {
            this.messageInput.placeholder = '메시지를 입력하세요...';
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatClient();
});