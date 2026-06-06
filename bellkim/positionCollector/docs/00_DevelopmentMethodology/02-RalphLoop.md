# 02 · 랄프루프 (Ralph Wiggum Loop) 플러그인

## 랄프루프란?

> **"AI가 완료 조건을 스스로 충족할 때까지 반복 실행하는 자율 루프 자동화"**

심슨 가족 캐릭터 **Ralph Wiggum**에서 따온 이름. 실패해도 멈추지 않고 *"I'm helping!"*을 외치며 계속 시도하는 그 정신을 AI 코딩에 적용한 기법이다. 2025년 말 개발자 커뮤니티에서 바이럴되었고, Anthropic이 Claude Code 공식 플러그인으로 출시했다.

**설치방법:** Claude Code 내 `/plugin` 명령어 입력 후 `ralph-loop` 검색 및 설치

---

## 핵심 원리

```bash
# 랄프의 본질
while true; do
  claude -p "$(cat PROMPT.md)"
done
```

**컨텍스트는 매번 리셋되지만, 코드(파일)는 유지되는 게 이 구조의 핵심.** 각 iteration에서 Claude는 새로운 컨텍스트로 시작하지만, 이전에 작성한 파일과 코드는 그대로 남아있다.

### 동작 4단계

1. **Prompt** — 작업 지시 + 완료 조건 제공
2. **Action** — Claude가 코드 작성 및 테스트 실행
3. **Check (Stop Hook)** — 플러그인이 완료 신호(`DONE`) 감지
4. **Repeat** — 신호 없으면 같은 프롬프트로 자동 재시작

---

## 설치 및 사용법

```bash
# Claude Code 플러그인 설치
/plugin install ralph-loop@claude-plugins-official

# 실행
/ralph-wiggum:ralph-loop "모든 유닛 테스트를 통과시켜라" \
  --max-iterations 30 \
  --completion-promise "DONE"
```

| 커맨드 | 설명 |
| --- | --- |
| `/ralph-wiggum:ralph-loop` | 루프 시작 |
| `/ralph-wiggum:cancel-ralph` | 활성 루프 취소 |
| `/ralph-wiggum:help` | 도움말 표시 |

---

## 핵심 특징

### ✅ 작업에 적합한 경우

- 대량 테스트 코드 자동 작성
- 반복적인 API 엔드포인트 생성
- 명확한 완료 기준이 있는 작업
- 대량 파일의 형식 일관성 검사

### ⚠️ 주의할 점

- 간단한 버그 수정에는 **과잉** — 단순 작업에는 사용 안 함
- `--max-iterations` 설정 **필수** — 무한 루프 및 토큰 낭비 방지
- 해결 불가 문제에는 무한루프 위험 — 중간 모니터링 필요

### 🛡️ 가드레일 시스템

무언가 실패하면, 에이전트가 `.ralph/guardrails.md`에 **표지판(Sign)**을 추가한다:

```markdown
### Sign: 추가하기 전에 import 확인
- 트리거: 새 import 문 추가 시
- 지시: 파일에 import가 이미 존재하는지 확인
```

다음 iteration에서 이 가드레일을 읽고 같은 실수를 반복하지 않는다.

---

## 실사례

> 화제: Y Combinator 해커톤에서 하룻밤에 GitHub 저장소 6개 생성

> 화제: 5만 달러짜리 계약을 297달러로 완수

> 화제: 테스트 코드 거의 없던 상태에서 1~2시간 루프로 베이스라인 완성
