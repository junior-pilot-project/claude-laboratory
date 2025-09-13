# 🧪 Claude Laboratory - AI와 함께하는 코딩 실험실

> **"Claude야, 오늘은 뭘 만들어볼까?"** 🤔💭

## 👨‍💻👩‍💻 참가인

- **yunrap**
- **seohaun**
- **younghoon**
- **soon**
- **bellkim**

## 🎯 이 프로젝트를 만든 이유

**"아, 각자 Claude써보면서 프로젝트 만들어봤는데.. 서로 뭐 만들었는지 궁금하지 않아?"**

그래서 만들었습니다!

- **AI 페어 프로그래밍** 경험 공유
- **문서화 노하우**
- **"와 이거 어떻게 만들었어?"** 하면서 구경하기
- **Claude와의 케미** 자랑하기

## ✨ 기능

- **실시간 프로젝트 탐지**: 프로젝트 올릴시 게시판 몰록에 자동 표현
- **폴더 기반 인식**: `개발자명/프로젝트명/` 구조로 자동 정리
- **제로 설정**: `node server.js` 한 줄로 끝!
- **반응형 대시보드**: 폰에서도 예쁘게 보여줌
- **실시간 업데이트**: 새 프로젝트 추가하면 바로 반영

## 📁 프로젝트 구조

```
claude-laboratory/
├── server.js           # Node.js 서버 (파일 자동 인식기능으로 도입)
├── index.html          # 메인 대시보드
├── style.css           # 스타일시트
├── script.js           # 클라이언트 로직
├── package.json        # 프로젝트 설정
├── CLAUDE.md           # Claude Code 가이드
├── README.md           # 이 파일
├── .gitignore          # Git 제외 파일
└── [개발자명]/           # 개발자 폴더
    └── [프로젝트명]/      # 프로젝트 폴더
        └── index.html  # 필수 파일 (프로젝트 감지용)
```

## 🚀 실행

- **Node.js 14.0.0 이상** (없으면 [여기서](https://nodejs.org/) 다운!)

```bash
git clone <이-저장소-주소>
cd claude-laboratory
node server.js
```

브라우저에서 http://localhost:8000 로 진입

> 💡 `npm start` 또는 `npm run dev`로도 실행 가능
