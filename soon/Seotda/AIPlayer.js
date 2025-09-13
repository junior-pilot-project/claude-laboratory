class AIPlayer {
    constructor(gameLogic) {
        this.gameLogic = gameLogic;
        this.cards = [];
        this.money = 10000;
    }

    // AI의 패 강도 평가
    getConfidence(cards) {
        if (!cards || cards.length < 1) return 0.1;
        
        if (cards.length === 1) {
            // 첫 카드만으로 판단
            const card = cards[0];
            if (card.type === 'light') return 0.8; // 광패면 높은 자신감
            if (card.month >= 8) return 0.6; // 높은 숫자
            if (card.month >= 5) return 0.4; // 중간 숫자
            return 0.2; // 낮은 숫자
        }
        
        const rank = this.gameLogic.getHandRank(cards);
        if (rank.rank >= 1000) return 1.0; // 광패
        if (rank.rank >= 900) return 0.9;  // 땡
        if (rank.rank >= 894) return 0.8;  // 특수조합
        if (rank.rank >= 7) return 0.6;    // 7끗 이상
        if (rank.rank >= 4) return 0.4;    // 4끗 이상
        if (rank.rank >= 1) return 0.2;    // 1끗 이상
        return 0.1; // 0끗
    }

    // AI 행동 결정
    decideAction(gamePhase, playerRaised, currentPot) {
        const confidence = this.getConfidence(this.cards);
        const random = Math.random();
        
        console.log(`AI deciding action. Phase: ${gamePhase}, Confidence: ${confidence.toFixed(2)}, PlayerRaised: ${playerRaised}`);

        // 플레이어가 레이즈했을 때는 콜 또는 폴드만 가능
        if (playerRaised) {
            if (confidence > 0.2) {
                return 'call'; // 적당한 패면 콜
            } else {
                // 매우 약한 패일 때만 폴드
                if (random < 0.3) return 'call'; // 30% 확률로 블러핑 콜
                else return 'fold';
            }
        } else {
            // 게임 페이즈에 따른 다른 전략
            if (gamePhase === 'firstBetting') {
                // 첫 베팅에서는 훨씬 더 적극적 - 거의 폴드하지 않음
                if (confidence > 0.6) {
                    // 강한 패: 거의 항상 레이즈
                    if (random < 0.9) return 'raise';
                    else return 'call';
                } else if (confidence > 0.3) {
                    // 중간 패: 콜 위주, 가끔 레이즈
                    if (random < 0.7) return 'call';
                    else if (random < 0.95) return 'raise';
                    else return 'fold';
                } else if (confidence > 0.1) {
                    // 약한 패: 대부분 콜, 가끔 블러핑
                    if (random < 0.8) return 'call';
                    else if (random < 0.15) return 'raise'; // 블러핑
                    else return 'fold';
                } else {
                    // 매우 약한 패도 첫 베팅에서는 자주 콜
                    if (random < 0.6) return 'call'; // 60% 콜
                    else if (random < 0.08) return 'raise'; // 8% 블러핑
                    else return 'fold'; // 32% 폴드
                }
            } else {
                // 최종 베팅에서는 기존보다 조금 더 보수적
                if (confidence > 0.7) {
                    // 강한 패: 주로 레이즈
                    if (random < 0.8) return 'raise';
                    else return 'call';
                } else if (confidence > 0.4) {
                    // 중간 패: 콜 또는 레이즈, 폴드 확률 줄임
                    if (random < 0.6) return 'call';
                    else if (random < 0.85) return 'raise';
                    else return 'fold';
                } else if (confidence > 0.2) {
                    // 약한 패: 콜 위주, 블러핑도 가끔
                    if (random < 0.5) return 'call';
                    else if (random < 0.15) return 'raise'; // 블러핑
                    else return 'fold';
                } else {
                    // 매우 약한 패: 최종에서는 더 신중
                    if (random < 0.2) return 'call';
                    else if (random < 0.03) return 'raise'; // 아주 가끔 블러핑
                    else return 'fold';
                }
            }
        }
    }

    // AI 대사 생성
    getDialogue(action, confidence) {
        const dialogues = {
            call: [
                '흠... 따라가보지.',
                '일단 콜이다.',
                '괜찮은 것 같은데?',
                '따라가 보겠어.',
                '재미있겠는걸?'
            ],
            raise: [
                '이정도면 충분하겠지? {amount}원!',
                '좀 더 재미있게 해보자! {amount}원!',
                '내 패에 자신있어! {amount}원!',
                '어디 한번 해보자! {amount}원!',
                '너무 쉽게 가는군! {amount}원!'
            ],
            fold: [
                '이번엔 포기할게.',
                '패가 별로네... 폴드!',
                '아직은 아니야.',
                '운이 나쁘군.',
                '다음 기회에...'
            ]
        };
        
        return dialogues[action] || ['...'];
    }

    // 승부 후 반응 대사
    getReactionDialogue(result, opponentRank, myRank) {
        if (result === 'win') {
            return [
                '하하! 제가 이겼네요! 다음에도 도전해보세요!',
                '운이 따라줬네요! 좋은 승부였습니다!',
                '제 패가 더 좋았군요! 아깝게 지셨네요.',
                '이번엔 제가 운이 좋았나 봅니다!',
                '섯다는 운칠기삼이라죠! 이번엔 제 차례였네요!'
            ];
        } else if (result === 'lose') {
            return [
                '아... 당신이 이기셨네요. 축하합니다!',
                '완전히 당했습니다... 잘하시는군요!',
                '이번엔 제가 졌네요. 다음엔 지지 않겠어요!',
                '훌륭한 승부였습니다! 제 패가 약했네요.',
                '당신의 운이 더 좋았군요... 참패입니다!'
            ];
        } else {
            return [
                '어... 똑같네요? 판돈 그대로 두고 다시!',
                '무승부라니! 판돈이 계속 쌓이겠네요!',
                '우리 실력이 비슷한가 봅니다! 다시 해봅시다!',
                '이런 경우는 정말 드물어요! 재경기!',
                '판돈은 그대로! 더 흥미진진해지겠네요!'
            ];
        }
    }

    // 게임 진행 중 생각하는 메시지
    getThinkingMessage(gamePhase) {
        if (gamePhase === 'firstBetting') {
            return [
                '상대방이 첫 카드를 보고 고민하고 있습니다...',
                '상대방이 첫 패를 확인 중입니다...',
                '상대방이 어떻게 할지 고민하고 있습니다...'
            ];
        } else {
            return [
                '상대방이 패를 살펴보고 있습니다...',
                '상대방이 고민 중입니다...',
                '상대방이 당신을 의심스럽게 쳐다보고 있습니다...',
                '상대방이 자신있는 표정을 짓고 있습니다...'
            ];
        }
    }

    // AI 카드 설정
    setCards(cards) {
        this.cards = cards || [];
    }

    // AI 돈 설정/조회
    setMoney(amount) {
        this.money = amount;
    }

    getMoney() {
        return this.money;
    }

    // 베팅
    bet(amount) {
        if (amount > this.money) {
            amount = this.money; // 올인
        }
        this.money -= amount;
        return amount;
    }

    // 돈 추가 (승리시)
    addMoney(amount) {
        this.money += amount;
    }
}