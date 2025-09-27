<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.*, java.text.SimpleDateFormat" %>
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Socket Message - JSP Version</title>
    <link rel="stylesheet" href="chat.css">
    <style>
        .server-info {
            background: #f0f8ff;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 10px;
            font-size: 14px;
            color: #333;
        }
    </style>
</head>
<body>
    <%
        // JSP에서 서버 시간과 세션 정보 처리
        Date currentTime = new Date();
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        String formattedTime = formatter.format(currentTime);

        String sessionId = session.getId();
        String userAgent = request.getHeader("User-Agent");
        String clientIP = request.getRemoteAddr();
    %>

    <div class="chat-container">
        <div class="chat-header">
            <h1>Socket Message (JSP)</h1>
            <div class="user-info">
                <span id="username">사용자</span>
                <span class="status online"></span>
            </div>
        </div>

        <div class="server-info">
            <strong>서버 정보:</strong><br>
            현재 시간: <%= formattedTime %><br>
            세션 ID: <%= sessionId %><br>
            클라이언트 IP: <%= clientIP %>
        </div>

        <div class="chat-messages" id="chatMessages">
            <!-- 초기 메시지 -->
            <div class="message system" style="text-align: center; color: #666; font-size: 14px; margin: 10px 0;">
                JSP 버전의 Socket Message가 로드되었습니다.
            </div>
        </div>

        <div class="chat-input-container">
            <div class="input-wrapper">
                <input type="text" id="messageInput" placeholder="메시지를 입력하세요..." maxlength="500">
                <button id="sendButton" type="button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22,2 15,22 11,13 2,9"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <script>
        // JSP에서 전달받은 서버 정보를 JavaScript로 전달
        const serverInfo = {
            sessionId: '<%= sessionId %>',
            serverTime: '<%= formattedTime %>',
            clientIP: '<%= clientIP %>'
        };

        class JSPChatClient {
            constructor() {
                this.socket = null;
                this.isConnected = false;
                this.username = '사용자' + Math.floor(Math.random() * 1000);
                this.serverInfo = serverInfo;
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

                // JSP 서버 정보를 초기 메시지로 표시
                this.addSystemMessage(`세션 ID: ${this.serverInfo.sessionId}`);
                this.addSystemMessage(`서버 시간: ${this.serverInfo.serverTime}`);
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
                    // WebSocket 연결 (Java 서버와 연결)
                    this.socket = new WebSocket('ws://localhost:8080/websocket');

                    this.socket.onopen = (event) => {
                        console.log('서버에 연결되었습니다.');
                        this.isConnected = true;
                        this.updateConnectionStatus(true);
                        this.addSystemMessage('Java Socket 서버에 연결되었습니다.');

                        // JSP에서 처리된 정보와 함께 연결 메시지 전송
                        const connectMessage = {
                            type: 'connect',
                            username: this.username,
                            sessionId: this.serverInfo.sessionId,
                            timestamp: new Date().toISOString()
                        };
                        this.socket.send(JSON.stringify(connectMessage));
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
                    sessionId: this.serverInfo.sessionId,
                    timestamp: new Date().toISOString()
                };

                try {
                    this.socket.send(JSON.stringify(messageData));
                    this.addMessage(messageData, true);
                    this.messageInput.value = '';
                    this.sendButton.disabled = true;

                    // JSP 페이지로 메시지 데이터 전송 (AJAX)
                    this.sendToJSP(messageData);
                } catch (error) {
                    console.error('메시지 전송 실패:', error);
                    this.addSystemMessage('메시지 전송에 실패했습니다.');
                }
            }

            sendToJSP(messageData) {
                // JSP 페이지로 메시지 로그 전송
                fetch('messageHandler.jsp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messageData)
                }).catch(error => {
                    console.log('JSP 로그 전송 실패:', error);
                });
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

        // JSP 페이지가 로드되면 채팅 클라이언트 초기화
        document.addEventListener('DOMContentLoaded', () => {
            new JSPChatClient();
        });
    </script>
</body>
</html>