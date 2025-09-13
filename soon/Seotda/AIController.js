/**
 * AI 턴 처리를 담당하는 클래스
 * AI의 행동 결정, 베팅 처리, 대화 관리
 */
class AIController {
    constructor(gameManager) {
        this.gameManager = gameManager;
    }

    // ========================================
    // AI 턴 메인 로직
    // ========================================

    opponentTurn() {
        const thinkingMessages = this.gameManager.aiPlayer.getThinkingMessage(this.gameManager.gamePhase);
        const message = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
        this.gameManager.uiManager.setGameMessage(message);
        
        setTimeout(() => {
            this.processAIAction();
        }, 1500);
    }

    processAIAction() {
        const action = this.gameManager.aiPlayer.decideAction(
            this.gameManager.gamePhase, 
            this.gameManager.playerRaised, 
            this.gameManager.pot
        );
        
        const dialogues = this.gameManager.aiPlayer.getDialogue(
            action, 
            this.gameManager.aiPlayer.getConfidence(this.gameManager.aiPlayer.cards)
        );
        
        console.log(`AI decides to ${action}. Phase: ${this.gameManager.gamePhase}, PlayerRaised: ${this.gameManager.playerRaised}`);
        
        switch (action) {
            case 'call':
                this.handleAICall(dialogues);
                break;
            case 'raise':
                this.handleAIRaise(dialogues);
                break;
            case 'fold':
                this.handleAIFold(dialogues);
                break;
            default:
                console.error('Unknown AI action:', action);
                this.handleAICall(dialogues); // fallback to call
        }
    }

    // ========================================
    // AI 액션 핸들러들
    // ========================================

    handleAICall(dialogues) {
        const callAmount = this.calculateAICallAmount();
        
        this.gameManager.aiPlayer.bet(callAmount);
        this.gameManager.pot += callAmount;
        
        this.setAIDialogue(dialogues);
        
        console.log(`AI calls ${callAmount}. AI: ${this.gameManager.aiPlayer.getMoney()}, Pot: ${this.gameManager.pot}`);
        
        this.proceedAfterAIAction('call');
    }

    handleAIRaise(dialogues) {
        const raiseAmount = this.gameManager.pot;
        
        // 돈 부족하면 콜로 변경
        if (raiseAmount > this.gameManager.aiPlayer.getMoney()) {
            console.log(`AI wanted to raise ${raiseAmount} but only has ${this.gameManager.aiPlayer.getMoney()}, calling instead`);
            this.handleAICall(dialogues);
            return;
        }
        
        this.gameManager.aiPlayer.bet(raiseAmount);
        this.gameManager.pot += raiseAmount;
        
        const message = this.formatAIRaiseMessage(dialogues, raiseAmount);
        this.gameManager.uiManager.setOpponentAction(message);
        
        console.log(`AI raises ${raiseAmount}. AI: ${this.gameManager.aiPlayer.getMoney()}, Pot: ${this.gameManager.pot}`);
        
        this.proceedAfterAIAction('raise');
    }

    handleAIFold(dialogues) {
        this.gameManager.opponentFolded = true;
        
        this.setAIDialogue(dialogues);
        this.gameManager.uiManager.setGameMessage('🎉 상대방이 폴드했습니다! 당신의 승리! 🎉');
        
        this.gameManager.playerMoney += this.gameManager.pot;
        this.gameManager.pot = 0;
        this.gameManager.updateDisplay();
        
        console.log(`AI folds! Player gets pot. Player: ${this.gameManager.playerMoney}`);
        
        setTimeout(() => this.gameManager.gameController.endRound(), 3000);
    }

    // ========================================
    // AI 액션 후 게임 진행 처리
    // ========================================

    proceedAfterAIAction(action) {
        if (this.gameManager.gamePhase === 'firstBetting') {
            this.gameManager.gameController.proceedToSecondCard();
        } else if (this.gameManager.gamePhase === 'finalBetting') {
            this.handleFinalBettingEnd(action);
        }
    }

    handleFinalBettingEnd(action) {
        let message;
        
        if (action === 'call') {
            message = this.gameManager.uiManager.getBettingEndMessage();
        } else if (action === 'raise') {
            message = '상대방이 레이즈했습니다! 승부를 겁니다!';
        }
        
        setTimeout(() => {
            this.gameManager.gameController.scheduleReveal(message);
        }, 1500);
    }

    // ========================================
    // AI 베팅 계산 및 메시지 처리
    // ========================================

    calculateAICallAmount() {
        let amount;
        
        if (this.gameManager.playerRaised && this.gameManager.currentBet > 0) {
            // 플레이어가 레이즈했다면 그 금액을 맞춰야 함
            amount = this.gameManager.currentBet;
        } else {
            // 일반적인 콜이면 최소 베팅
            amount = Math.max(100, this.gameManager.currentBet);
        }
        
        // AI 보유금 한도 내에서만
        return Math.min(amount, this.gameManager.aiPlayer.getMoney());
    }

    setAIDialogue(dialogues) {
        if (!dialogues || dialogues.length === 0) {
            this.gameManager.uiManager.setOpponentAction('...');
            return;
        }
        
        const message = dialogues[Math.floor(Math.random() * dialogues.length)];
        this.gameManager.uiManager.setOpponentAction(message);
    }

    formatAIRaiseMessage(dialogues, amount) {
        if (!dialogues || dialogues.length === 0) {
            return `${amount}원 레이즈!`;
        }
        
        const template = dialogues[Math.floor(Math.random() * dialogues.length)];
        return template.replace('{amount}', amount);
    }

    // ========================================
    // AI 상태 분석 및 디버깅
    // ========================================

    getAIState() {
        return {
            cards: this.gameManager.aiPlayer.cards,
            money: this.gameManager.aiPlayer.getMoney(),
            confidence: this.gameManager.aiPlayer.getConfidence(this.gameManager.aiPlayer.cards),
            possibleActions: this.getAIPossibleActions()
        };
    }

    getAIPossibleActions() {
        const actions = ['fold']; // 항상 폴드 가능
        
        // 콜 가능 여부
        const callAmount = this.calculateAICallAmount();
        if (callAmount <= this.gameManager.aiPlayer.getMoney()) {
            actions.push('call');
        }
        
        // 레이즈 가능 여부 (플레이어가 레이즈했으면 불가)
        if (!this.gameManager.playerRaised) {
            const raiseAmount = this.gameManager.pot;
            if (raiseAmount > 0 && raiseAmount <= this.gameManager.aiPlayer.getMoney()) {
                actions.push('raise');
            }
        }
        
        return actions;
    }

    logAIAction(action, amount = 0) {
        const state = {
            action: action,
            amount: amount,
            aiMoney: this.gameManager.aiPlayer.getMoney(),
            pot: this.gameManager.pot,
            currentBet: this.gameManager.currentBet,
            gamePhase: this.gameManager.gamePhase,
            playerRaised: this.gameManager.playerRaised,
            aiCards: this.gameManager.aiPlayer.cards,
            confidence: this.gameManager.aiPlayer.getConfidence(this.gameManager.aiPlayer.cards)
        };
        
        console.log('AI Action:', state);
        return state;
    }

    // ========================================
    // AI 전략 조정 (미래 확장용)
    // ========================================

    adjustAIStrategy(difficulty = 'normal') {
        // 향후 AI 난이도 조정을 위한 메서드
        // 'easy', 'normal', 'hard' 등으로 AI 행동 패턴 변경 가능
        console.log(`AI strategy set to: ${difficulty}`);
        
        // TODO: AIPlayer 클래스에 difficulty 설정 기능 추가시 연동
    }
}