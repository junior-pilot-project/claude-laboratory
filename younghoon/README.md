# Socket Message - 채팅 애플리케이션

## 프로젝트 개요
Socket 통신을 사용한 실시간 채팅 애플리케이션입니다. 각 기술 스택을 개별 폴더로 관리하여 모듈화된 구조를 가지고 있습니다.

## 기술 스택
- **HTML**: 채팅 UI 구조
- **CSS**: 모던한 채팅 앱 스타일
- **JavaScript**: WebSocket 클라이언트 통신
- **Java**: WebSocket 서버 구현
- **JSP**: 서버 사이드 메시지 처리

## 프로젝트 구조
```
claude/
├── html/
│   └── chat.html          # 메인 채팅 인터페이스
├── css/
│   └── chat.css           # 채팅 UI 스타일
├── javascript/
│   └── chat.js            # 클라이언트 WebSocket 통신
├── java/
│   └── ChatServer.java    # WebSocket 서버
├── jsp/
│   ├── chat.jsp           # JSP 버전 채팅 페이지
│   └── messageHandler.jsp # 메시지 로그 처리
└── list/
    └── setting.md         # 프로젝트 설정 문서
```

## 실행 방법

### 1. Java 서버 실행
```bash
cd java
javac ChatServer.java
java ChatServer
```
서버는 localhost:8080 포트에서 실행됩니다.

### 2. 클라이언트 접속
- **HTML 버전**: `html/chat.html` 파일을 브라우저에서 열기
- **JSP 버전**: 웹 서버에 jsp 폴더를 배포 후 `chat.jsp` 접속

## 주요 기능
- 실시간 메시지 송수신
- 사용자 입장/퇴장 알림
- 연결 상태 표시
- 자동 재연결
- 메시지 히스토리 (JSP 버전)
- 반응형 UI

## WebSocket 통신
- 서버: ws://localhost:8080/websocket
- 프로토콜: WebSocket RFC 6455
- 메시지 포맷: JSON

## 메시지 포맷
```json
{
  "type": "message",
  "username": "사용자명",
  "content": "메시지 내용",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 브라우저 지원
- Chrome, Firefox, Safari, Edge (WebSocket 지원 브라우저)

## 개발 고려사항
- 각 기술 스택은 개별 폴더에서 관리
- 모던한 채팅 앱 UI/UX 적용
- 실시간 통신을 위한 WebSocket 사용
- 확장 가능한 서버 아키텍처