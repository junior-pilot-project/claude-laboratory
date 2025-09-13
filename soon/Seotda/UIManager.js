class UIManager {
    constructor(gameLogic) {
        this.gameLogic = gameLogic;
        this.elements = {};
        this.initializeElements();
    }

    initializeElements() {
        this.elements = {
            playerCard1: document.getElementById('player-card1'),
            playerCard2: document.getElementById('player-card2'),
            opponentCard1: document.getElementById('opponent-card1'),
            opponentCard2: document.getElementById('opponent-card2'),
            playerMoney: document.getElementById('player-money'),
            opponentMoney: document.getElementById('opponent-money'),
            potAmount: document.getElementById('pot-amount'),
            roundNumber: document.getElementById('round-number'),
            gameMessage: document.getElementById('game-message'),
            handRank: document.getElementById('hand-rank'),
            opponentAction: document.getElementById('opponent-action'),
            callBtn: document.getElementById('call-btn'),
            raiseBtn: document.getElementById('raise-btn'),
            foldBtn: document.getElementById('fold-btn'),
            newGameBtn: document.getElementById('new-game-btn'),
            rulesBtn: document.getElementById('rules-btn'),
            rulesModal: document.getElementById('rules-modal'),
            closeModal: document.querySelector('.close')
        };
    }

    bindEvents(callbacks) {
        this.elements.callBtn.addEventListener('click', callbacks.onCall);
        this.elements.raiseBtn.addEventListener('click', callbacks.onRaise);
        this.elements.foldBtn.addEventListener('click', callbacks.onFold);
        this.elements.newGameBtn.addEventListener('click', callbacks.onNewGame);
        this.elements.rulesBtn.addEventListener('click', callbacks.onShowRules);
        this.elements.closeModal.addEventListener('click', callbacks.onHideRules);
        
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.rulesModal) {
                callbacks.onHideRules();
            }
        });
    }

    displayCard(cardElement, card, hidden = false) {
        if (hidden) {
            cardElement.className = 'card back';
            cardElement.innerHTML = '<div class="card-back-pattern">화투</div>';
        } else {
            // 카드 객체 유효성 검사
            if (!card || typeof card.month === 'undefined' || card.month < 1 || card.month > 10) {
                console.error('Invalid card object:', card);
                cardElement.className = 'card error';
                cardElement.innerHTML = '<div class="card-text">오류<br><small>카드 재생성</small></div>';
                return;
            }
            
            cardElement.className = 'card';
            const cardInfo = this.gameLogic.getCardInfo(card);
            
            // cardInfo 유효성 검사
            if (!cardInfo || !cardInfo.emoji || !cardInfo.name) {
                console.error('Invalid cardInfo:', cardInfo, 'for card:', card);
                cardElement.className = 'card';
                cardElement.innerHTML = `<div class="card-text">${card.month}월<br><small>정보오류</small></div>`;
                return;
            }
            
            // 광패와 일반패 구분하여 표시
            if (card.type === 'light') {
                cardElement.classList.add('light');
                cardElement.innerHTML = `
                    <div class="card-icon">${cardInfo.emoji}</div>
                    <div class="card-text">${card.month}광</div>
                `;
            } else {
                cardElement.innerHTML = `
                    <div class="card-icon">${cardInfo.emoji}</div>
                    <div class="card-text">${card.month}월</div>
                `;
            }
        }
        
        // 카드 애니메이션 효과
        this.addCardAnimation(cardElement);
    }

    addCardAnimation(cardElement) {
        setTimeout(() => {
            cardElement.style.animation = 'none';
            cardElement.offsetHeight; // reflow 강제 실행
            cardElement.style.animation = 'cardDeal 0.5s ease-out';
        }, 10);
    }

    updateGameDisplay(gameState) {
        this.updatePlayerCards(gameState.playerCards);
        this.updateOpponentCards(gameState.aiCards, gameState.gamePhase);
        this.updateGameInfo(gameState);
        this.updateHandRank(gameState.playerCards);
        this.updateButtonStates(gameState);
    }

    updatePlayerCards(playerCards) {
        // 첫 번째 플레이어 카드
        if (playerCards.length > 0) {
            this.displayCard(this.elements.playerCard1, playerCards[0]);
        } else {
            this.elements.playerCard1.className = 'card';
            this.elements.playerCard1.textContent = '';
        }
        
        // 두 번째 플레이어 카드
        if (playerCards.length > 1) {
            this.displayCard(this.elements.playerCard2, playerCards[1]);
        } else {
            this.elements.playerCard2.className = 'card empty';
            this.elements.playerCard2.innerHTML = '<div class="card-waiting">?</div>';
        }
    }

    updateOpponentCards(aiCards, gamePhase) {
        const shouldHide = gamePhase !== 'reveal';
        
        // 첫 번째 상대방 카드
        if (aiCards.length > 0) {
            this.displayCard(this.elements.opponentCard1, aiCards[0], shouldHide);
        } else {
            this.elements.opponentCard1.className = 'card back';
            this.elements.opponentCard1.textContent = '';
        }
        
        // 두 번째 상대방 카드
        if (aiCards.length > 1) {
            this.displayCard(this.elements.opponentCard2, aiCards[1], shouldHide);
        } else {
            this.elements.opponentCard2.className = 'card back empty';
            this.elements.opponentCard2.innerHTML = '<div class="card-waiting">?</div>';
        }
    }

    updateGameInfo(gameState) {
        this.elements.playerMoney.textContent = gameState.playerMoney;
        this.elements.opponentMoney.textContent = gameState.aiMoney;
        this.elements.potAmount.textContent = gameState.pot;
        this.elements.roundNumber.textContent = gameState.round;
    }

    updateHandRank(playerCards) {
        if (playerCards.length === 2) {
            const playerRank = this.gameLogic.getHandRank(playerCards);
            this.elements.handRank.textContent = `내 족보: ${playerRank.name}`;
        } else {
            this.elements.handRank.textContent = '카드 1장 - 족보 미정';
        }
    }

    updateButtonStates(gameState) {
        const canBet = (gameState.gamePhase === 'firstBetting' || gameState.gamePhase === 'finalBetting') && 
                      !gameState.playerFolded && !gameState.opponentFolded;
        
        // 버튼 활성화/비활성화
        this.elements.callBtn.disabled = !canBet;
        this.elements.raiseBtn.disabled = !canBet;
        this.elements.foldBtn.disabled = !canBet;
        
        // 버튼 스타일링
        const opacity = canBet ? '1' : '0.5';
        this.elements.callBtn.style.opacity = opacity;
        this.elements.raiseBtn.style.opacity = opacity;
        this.elements.foldBtn.style.opacity = opacity;
    }

    // 메시지 표시 메서드들
    setGameMessage(message) {
        this.elements.gameMessage.textContent = message;
    }

    setOpponentAction(message) {
        this.elements.opponentAction.textContent = message;
    }

    clearOpponentAction() {
        this.elements.opponentAction.textContent = '';
    }

    // 룰 모달 관리
    showRules() {
        this.elements.rulesModal.classList.remove('hidden');
    }

    hideRules() {
        this.elements.rulesModal.classList.add('hidden');
    }

    // 메시지 템플릿들
    getCallMessage(amount) {
        return `콜했습니다. (${amount}원)`;
    }

    getRaiseMessage(amount) {
        if (amount >= 2000) {
            return `${amount}원 레이즈! 판돈을 두 배로! 상대방이 당황하고 있습니다!`;
        } else if (amount >= 1000) {
            return `${amount}원 레이즈! 자신있는 모습이네요!`;
        } else {
            return `${amount}원 레이즈했습니다! 판돈이 두 배가 되었습니다!`;
        }
    }

    getFoldMessage() {
        return '😔 폴드했습니다. 상대방의 승리입니다! 😔';
    }

    getWinMessage(playerRank, aiRank) {
        return `당신: ${playerRank} vs 상대방: ${aiRank}\n\n🎉 당신의 승리! 🎉`;
    }

    getLoseMessage(playerRank, aiRank) {
        return `당신: ${playerRank} vs 상대방: ${aiRank}\n\n😤 상대방의 승리! 😤`;
    }

    getTieMessage(playerRank, aiRank) {
        return `당신: ${playerRank} vs 상대방: ${aiRank}\n\n🤝 무승부! 판돈 유지! 🤝`;
    }

    getNewRoundMessage(round) {
        return `라운드 ${round} 시작! 참가비 1000원(500원씩)이 판돈에 추가되었습니다. 첫 번째 카드가 나왔습니다.`;
    }

    getNewGameMessage() {
        return '새 게임이 시작되었습니다! 참가비 1000원(500원씩)이 판돈에 추가되었습니다. 첫 번째 카드가 나왔습니다.';
    }

    getTieRedealMessage(pot) {
        return `무승부 재경기! 판돈 ${pot}원 유지. 새 카드가 나왔습니다!`;
    }

    // 공통 게임 진행 메시지들
    getCardDealMessage() {
        return '두 번째 카드를 나눠드립니다...';
    }

    getSecondCardMessage() {
        return '두 번째 카드가 나왔습니다! 최종 베팅을 시작합니다.';
    }

    getRevealMessage() {
        return '카드를 공개합니다...';
    }

    getBettingEndMessage() {
        return '베팅이 끝났습니다. 승부를 겁니다!';
    }

    getGameOverMessage(isPlayerBroke) {
        return isPlayerBroke ? '게임 오버! 돈이 떨어졌습니다.' : '축하합니다! 상대방을 파산시켰습니다!';
    }
}