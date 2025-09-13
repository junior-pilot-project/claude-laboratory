# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 필요한 가이드를 제공합니다.

## 프로젝트 개요

여러 개발자의 프로젝트를 자동으로 스캔하여 표시하는 동적 개발자 프로젝트 보드/대시보드 시스템입니다. 2단계 폴더 구조를 사용하며, 개발자 폴더(1단계) 안에 프로젝트 폴더(2단계)가 포함되고, `index.html` 파일이 있는 프로젝트만 유효한 프로젝트로 표시됩니다.

## 아키텍처

### 서버 아키텍처 (server.js)

전문적인 클래스 기반 Node.js 아키텍처:

- `ProjectBoardServer` - 우아한 종료 기능이 있는 메인 서버 클래스
- `ProjectScanner` - 실시간 파일 시스템 스캔 (빌드 단계 불필요)
- `Router` - CORS 지원하는 요청 라우팅
- `StaticFileServer` - 보안이 적용된 정적 파일 서빙 (디렉토리 탐색 공격 방지)
- `ResponseHelper` - HTTP 응답 유틸리티
- `Logger` - 이모지 기반 로깅 시스템

### 클라이언트 아키텍처 (script.js)

간단한 함수형 JavaScript 접근 방식:

- Vanilla JavaScript DOM 조작 (프레임워크 종속성 없음)
- `/api/projects`에서 실시간 API 소비
- 개발자 및 검색어별 필터링
- 목록 및 그룹 뷰 간 토글

### 파일 구조

```
root/
├── server.js          # Node.js 서버 (클래스 기반)
├── index.html          # 메인 대시보드
├── style.css           # 반응형 그리드 레이아웃
├── script.js           # 클라이언트 로직 (함수형)
├── package.json        # Node.js 종속성
└── [개발자-폴더]/
    └── [프로젝트-폴더]/
        └── index.html  # 프로젝트 감지에 필수
```

## 개발 명령어

### 애플리케이션 실행

```bash
npm start          # 프로덕션 모드
npm run dev        # 개발 모드 (start와 동일)
node server.js     # 직접 실행
```

### 서버 세부사항

- 기본적으로 `http://localhost:8000`에서 실행
- API 엔드포인트: `/api/projects` - 감지된 모든 프로젝트의 JSON 반환
- 환경 변수: `PORT`, `HOST`
- 2단계 폴더 스캔: developer/project/index.html 패턴

## 주요 구현 세부사항

### 프로젝트 감지 로직

서버는 다음 패턴의 `index.html` 파일이 포함된 폴더를 자동으로 스캔합니다:
`./[개발자명]/[프로젝트명]/index.html`

`index.html`이 없는 프로젝트는 무시됩니다. 유효한 프로젝트가 없어도 모든 개발자 폴더는 통계에 나열됩니다.

### 보안 기능

- 정적 파일 서빙에서 디렉토리 탐색 공격 방지
- 기본 디렉토리에 대한 경로 검증
- 적절한 HTTP 상태 코드로 우아한 오류 처리

## API 응답 형식

```json
{
  "generated": "2024-01-01T12:00:00.000Z",
  "totalCount": 6,
  "developerCount": 8,
  "developerStats": {
    "developer1": 2,
    "developer2": 0
  },
  "projects": [
    {
      "folderName": "project-name",
      "developer": "developer-name",
      "folderPath": "./developer/project/",
      "indexPath": "./developer/project/index.html",
      "category": "project",
      "lastModified": "2024-01-01T12:00:00.000Z",
      "size": 1024
    }
  ]
}
```
