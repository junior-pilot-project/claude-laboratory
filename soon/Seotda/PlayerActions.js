/**
 * 플레이어 액션 처리를 담당하는 클래스
 * 콜, 레이즈, 폴드 액션 및 관련 validation 로직
 */
class PlayerActions {
    constructor(gameManager) {
        this.gameManager = gameManager;
    }

    // ========================================
    // 주요 액션 메서드들
    // ========================================

    call() {
        const callAmount = this.calculateCallAmount();
        
        if (!this.validatePlayerAction(callAmount)) return;
        
        this.processPlayerBet(callAmount);
        this.gameManager.soundManager.playSound('bet');
        
        const message = this.gameManager.uiManager.getCallMessage(callAmount);
        
        if (this.gameManager.gamePhase === 'firstBetting') {
            this.gameManager.uiManager.setGameMessage(message + ' 상대방이 생각하고 있습니다...');
            this.gameManager.updateDisplay();
            this.gameManager.aiController.opponentTurn();
        } else if (this.gameManager.gamePhase === 'finalBetting') {
            this.gameManager.uiManager.setGameMessage(message + ' 승부를 봅시다!');
            this.gameManager.gameController.scheduleReveal();
        }
    }

    raise() {
        const raiseAmount = this.gameManager.pot;
        
        if (!this.validateRaise(raiseAmount)) return;
        
        this.processPlayerBet(raiseAmount);
        this.gameManager.soundManager.playSound('raise');
        
        const message = this.gameManager.uiManager.getRaiseMessage(raiseAmount);
        this.gameManager.uiManager.setGameMessage(message);
        this.gameManager.updateDisplay();
        
        if (this.gameManager.gamePhase === 'firstBetting') {
            this.gameManager.uiManager.setGameMessage(message + ' 상대방이 생각하고 있습니다...');
            this.gameManager.aiController.opponentTurn();
        } else if (this.gameManager.gamePhase === 'finalBetting') {
            this.gameManager.playerRaised = true;
            this.gameManager.aiController.opponentTurn();
        }
    }

    fold() {
        this.gameManager.playerFolded = true;
        this.gameManager.soundManager.playSound('fold');
        
        this.gameManager.uiManager.setGameMessage(this.gameManager.uiManager.getFoldMessage());
        this.gameManager.uiManager.setOpponentAction('하하! 잘 판단하셨네요!');
        
        this.gameManager.aiPlayer.addMoney(this.gameManager.pot);
        this.gameManager.pot = 0;
        this.gameManager.updateDisplay();
        
        setTimeout(() => this.gameManager.gameController.endRound(), 3000);
    }

    // ========================================
    // 계산 및 검증 메서드들
    // ========================================

    calculateCallAmount() {
        if (this.gameManager.gamePhase === 'firstBetting' || this.gameManager.currentBet === 0) {
            return 100; // 기본 베팅
        }
        return this.gameManager.currentBet; // 상대방 베팅에 맞춤
    }

    validatePlayerAction(amount) {
        if (amount > this.gameManager.playerMoney) {
            alert('보유금이 부족합니다.');
            return false;
        }
        return true;
    }

    validateRaise(amount) {
        if (amount > this.gameManager.playerMoney) {
            alert(`레이즈하려면 ${amount}원이 필요하지만 ${this.gameManager.playerMoney}원밖에 없습니다.`);
            return false;
        }
        if (amount === 0) {
            alert('판돈이 0원이므로 레이즈할 수 없습니다.');
            return false;
        }
        return true;
    }

    processPlayerBet(amount) {
        this.gameManager.playerMoney -= amount;
        this.gameManager.pot += amount;
        this.gameManager.currentBet = amount;
        
        console.log(`Player bets ${amount}. Player: ${this.gameManager.playerMoney}, Pot: ${this.gameManager.pot}`);
    }

    // ========================================
    // 상태 체크 메서드들
    // ========================================

    canPlayerAct() {
        return (this.gameManager.gamePhase === 'firstBetting' || this.gameManager.gamePhase === 'finalBetting') && 
               !this.gameManager.playerFolded && !this.gameManager.opponentFolded;
    }

    getAvailableActions() {
        if (!this.canPlayerAct()) {
            return [];
        }

        const actions = ['fold'];
        
        // 콜 가능 여부 체크
        const callAmount = this.calculateCallAmount();
        if (callAmount <= this.gameManager.playerMoney) {
            actions.push('call');
        }
        
        // 레이즈 가능 여부 체크
        const raiseAmount = this.gameManager.pot;
        if (raiseAmount > 0 && raiseAmount <= this.gameManager.playerMoney) {
            actions.push('raise');
        }
        
        return actions;
    }

    getActionCosts() {
        return {
            call: this.calculateCallAmount(),
            raise: this.gameManager.pot,
            fold: 0
        };
    }

    // ========================================
    // 디버깅 및 로깅 헬퍼
    // ========================================

    logPlayerAction(action, amount = 0) {
        const state = {
            action: action,
            amount: amount,
            playerMoney: this.gameManager.playerMoney,
            pot: this.gameManager.pot,
            currentBet: this.gameManager.currentBet,
            gamePhase: this.gameManager.gamePhase,
            playerRaised: this.gameManager.playerRaised
        };
        
        console.log('Player Action:', state);
        return state;
    }
}