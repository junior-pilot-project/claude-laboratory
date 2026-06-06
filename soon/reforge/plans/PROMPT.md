# UI 개선: 게임 느낌으로 변경

현재 게임 UI가 과도한 여백과 평탄한 스타일로 인해 업무 대시보드처럼 느껴진다.
게임다운 밀집감, 글로우 효과, 타이트한 레이아웃으로 개선한다.
JS 파일은 수정하지 않는다.

---

## 작업 목록

### 1. index.html — Google Fonts 추가

`<head>` 안에 Black Han Sans 폰트 링크 추가:
```html
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap" rel="stylesheet">
```

### 2. style.css — 폰트 적용

`font-family` 변수 추가 및 아래 요소에 적용:
```css
--font-game: 'Black Han Sans', 'Segoe UI', sans-serif;
```
적용 대상: `.game-header`, `.header-gold`, `.tab-btn`, `.inventory-section h3`, `.gameover-title`, `.ranking-box h2`, `.box-name`

### 3. style.css — 여백 축소

아래 값으로 수정:
- `.tab-content` : padding `14px` → `8px`
- `.game-header` : padding `12px 20px` → `8px 14px`, gap `12px` → `8px`
- `.tab-btn` : padding `12px` → `8px 12px`
- `.slots-wrap` : gap `12px` → `8px`, margin-bottom `12px` → `8px`
- `.slot-card` : padding `12px` → `8px`, min-height `100px` → `80px`
- `.enhance-panel` : padding `12px` → `8px`, margin-bottom `12px` → `8px`
- `.enhance-info` : margin-bottom `12px` → `8px`
- `.shop-item` : padding `16px` → `10px`
- `.box-row` : padding `16px` → `10px 14px`, gap `16px` → `10px`
- `.enhance-modal-card` : padding `28px 32px 20px` → `18px 24px 14px`
- `.box-modal-card` : padding `28px 24px 20px` → `18px 20px 14px`
- `.enhance-modal-icon-wrap` : margin-bottom `18px` → `12px`, width/height `120px` → `100px`
- `.enhance-modal-prob` : margin-bottom `16px` → `10px`
- `.enhance-modal-bar-wrap` : margin-bottom `18px` → `12px`

### 4. style.css — 글로우/네온 효과

`.btn-primary:hover`:
```css
opacity: 1;
transform: translateY(-2px) scale(1.04);
box-shadow: 0 0 14px rgba(233, 69, 96, 0.65), 0 4px 12px rgba(0,0,0,0.4);
```

`.slot-card:hover`:
```css
border-color: var(--accent);
box-shadow: 0 0 10px rgba(233, 69, 96, 0.35);
```

`.shop-item` 에 `transition: transform 0.2s` 추가, `.shop-item:hover`:
```css
border-color: var(--accent2);
box-shadow: 0 0 10px rgba(245, 166, 35, 0.35);
transform: translateY(-2px);
```

`.progress-bar`:
```css
box-shadow: 0 0 8px var(--accent);
```

`.inv-item:hover`:
```css
border-color: var(--accent);
cursor: pointer;
```

### 5. style.css — 헤더 & 배경 강화

`.game-header`:
```css
border-bottom: 2px solid var(--accent);
box-shadow: 0 2px 12px rgba(233, 69, 96, 0.2);
```

`body`:
```css
background: radial-gradient(ellipse at top, #0f0f20 0%, #0d0d1a 60%);
```

---

## 완료 기준

모든 항목 수정 완료 후:

<promise>UI GAME FEEL COMPLETE</promise>
