/**
 * 게임 플로우 제어를 담당하는 클래스
 * 라운드 진행, 카드 배분, 승부 처리 등을 관리
 */
class GameController {
    constructor(gameManager) {
        this.gameManager = gameManager;
    }

    // ========================================
    // 카드 배분 관리
    // ========================================

    dealFirstCard() {
        // 덱 상태 체크 및 참가비 처리
        if (!this.handleAnte()) return;
        
        // 카드 배분
        const playerCard = this.gameManager.gameLogic.dealCard();
        const aiCard = this.gameManager.gameLogic.dealCard();
        
        this.gameManager.playerCards = [playerCard];
        this.gameManager.aiPlayer.setCards([aiCard]);
        
        this.gameManager.gamePhase = 'firstBetting';
        this.gameManager.soundManager.playSound('cardDeal');
        
        console.log('First cards dealt:', { player: playerCard, ai: aiCard });
    }

    dealSecondCard() {
        const playerCard2 = this.gameManager.gameLogic.dealCard();
        const aiCard2 = this.gameManager.gameLogic.dealCard();
        
        this.gameManager.playerCards.push(playerCard2);
        const aiCards = this.gameManager.aiPlayer.cards;
        aiCards.push(aiCard2);
        this.gameManager.aiPlayer.setCards(aiCards);
        
        this.gameManager.gamePhase = 'finalBetting';
        this.gameManager.soundManager.playSound('cardDeal');
        
        console.log('Second cards dealt:', { player: playerCard2, ai: aiCard2 });
    }

    handleAnte() {
        const anteAmount = 500;
        
        // 덱 확인
        if (this.gameManager.gameLogic.getDeckInfo().remainingCards < 4) {
            this.gameManager.gameLogic.resetDeck();
        }
        
        // 참가비 검증
        if (this.gameManager.playerMoney < anteAmount) {
            this.gameManager.uiManager.setGameMessage('참가비가 부족합니다. 게임 종료!');
            return false;
        }
        if (this.gameManager.aiPlayer.getMoney() < anteAmount) {
            this.gameManager.uiManager.setGameMessage('상대방의 참가비가 부족합니다. 당신의 승리!');
            return false;
        }
        
        // 참가비 지불
        this.gameManager.playerMoney -= anteAmount;
        this.gameManager.aiPlayer.bet(anteAmount);
        this.gameManager.pot += anteAmount * 2;
        
        console.log(`Ante paid: ${anteAmount * 2} won. Player: ${this.gameManager.playerMoney}, AI: ${this.gameManager.aiPlayer.getMoney()}, Pot: ${this.gameManager.pot}`);
        return true;
    }

    // ========================================
    // 게임 플로우 제어
    // ========================================

    proceedToSecondCard() {
        this.gameManager.playerRaised = false;
        
        setTimeout(() => {
            this.gameManager.uiManager.setGameMessage(this.gameManager.uiManager.getCardDealMessage());
            
            setTimeout(() => {
                this.dealSecondCard();
                this.gameManager.updateDisplay();
                this.gameManager.uiManager.setGameMessage(this.gameManager.uiManager.getSecondCardMessage());
            }, 1500);
        }, 1000);
    }

    scheduleReveal(message = null) {
        if (message) {
            this.gameManager.uiManager.setGameMessage(message);
        }
        
        setTimeout(() => {
            this.gameManager.gamePhase = 'reveal';
            this.revealCards();
        }, 1000);
    }

    revealCards() {
        this.gameManager.updateDisplay(); // 카드 공개를 위해 화면 업데이트
        
        const playerRank = this.gameManager.gameLogic.getHandRank(this.gameManager.playerCards);
        const aiRank = this.gameManager.gameLogic.getHandRank(this.gameManager.aiPlayer.cards);
        
        this.gameManager.uiManager.setGameMessage(this.gameManager.uiManager.getRevealMessage());
        this.gameManager.uiManager.setOpponentAction('상대방이 긴장하고 있습니다...');
        
        setTimeout(() => {
            this.processGameResult(playerRank, aiRank);
        }, 2000);
    }

    // ========================================
    // 승부 결과 처리
    // ========================================

    processGameResult(playerRank, aiRank) {
        if (playerRank.rank > aiRank.rank) {
            this.handlePlayerWin(playerRank, aiRank);
        } else if (playerRank.rank < aiRank.rank) {
            this.handlePlayerLose(playerRank, aiRank);
        } else {
            this.handleTie(playerRank, aiRank);
        }
    }

    handlePlayerWin(playerRank, aiRank) {
        this.gameManager.playerMoney += this.gameManager.pot;
        this.gameManager.pot = 0;
        
        this.gameManager.soundManager.playSound('win');
        this.gameManager.uiManager.setGameMessage(
            this.gameManager.uiManager.getWinMessage(playerRank.name, aiRank.name)
        );
        
        const reactions = this.gameManager.aiPlayer.getReactionDialogue('lose', aiRank, playerRank);
        this.gameManager.uiManager.setOpponentAction(reactions[Math.floor(Math.random() * reactions.length)]);
        
        setTimeout(() => this.endRound(), 4000);
    }

    handlePlayerLose(playerRank, aiRank) {
        this.gameManager.aiPlayer.addMoney(this.gameManager.pot);
        this.gameManager.pot = 0;
        
        this.gameManager.soundManager.playSound('lose');
        this.gameManager.uiManager.setGameMessage(
            this.gameManager.uiManager.getLoseMessage(playerRank.name, aiRank.name)
        );
        
        const reactions = this.gameManager.aiPlayer.getReactionDialogue('win', aiRank, playerRank);
        this.gameManager.uiManager.setOpponentAction(reactions[Math.floor(Math.random() * reactions.length)]);
        
        setTimeout(() => this.endRound(), 4000);
    }

    handleTie(playerRank, aiRank) {
        this.gameManager.soundManager.playSound('tie');
        this.gameManager.uiManager.setGameMessage(
            this.gameManager.uiManager.getTieMessage(playerRank.name, aiRank.name)
        );
        
        const reactions = this.gameManager.aiPlayer.getReactionDialogue('tie', aiRank, playerRank);
        this.gameManager.uiManager.setOpponentAction(reactions[Math.floor(Math.random() * reactions.length)]);
        
        setTimeout(() => this.continueWithTie(), 4000);
    }

    // ========================================
    // 라운드 관리
    // ========================================

    continueWithTie() {
        console.log('Tie detected! Continuing with pot:', this.gameManager.pot);
        
        // 게임 상태 리셋 (판돈은 유지)
        this.resetRoundState();
        
        setTimeout(() => {
            // 새 카드 배정
            const playerCard = this.gameManager.gameLogic.dealCard();
            const aiCard = this.gameManager.gameLogic.dealCard();
            
            this.gameManager.playerCards = [playerCard];
            this.gameManager.aiPlayer.setCards([aiCard]);
            
            this.gameManager.gamePhase = 'firstBetting';
            this.gameManager.updateDisplay();
            this.gameManager.uiManager.setGameMessage(
                this.gameManager.uiManager.getTieRedealMessage(this.gameManager.pot)
            );
            this.gameManager.soundManager.playSound('newRound');
            
            console.log('Tie redeal - New cards:', { player: playerCard, ai: aiCard });
        }, 2000);
    }

    endRound() {
        this.gameManager.round++;
        this.resetRoundState();
        
        // 게임 종료 조건 체크
        if (this.gameManager.playerMoney <= 0 || this.gameManager.aiPlayer.getMoney() <= 0) {
            const isPlayerBroke = this.gameManager.playerMoney <= 0;
            this.gameManager.uiManager.setGameMessage(
                this.gameManager.uiManager.getGameOverMessage(isPlayerBroke)
            );
            return;
        }
        
        // 다음 라운드 시작
        setTimeout(() => {
            this.dealFirstCard();
            this.gameManager.updateDisplay();
            this.gameManager.uiManager.setGameMessage(
                this.gameManager.uiManager.getNewRoundMessage(this.gameManager.round)
            );
            this.gameManager.soundManager.playSound('newRound');
        }, 2000);
    }

    resetRoundState() {
        this.gameManager.gamePhase = 'firstCard';
        this.gameManager.playerFolded = false;
        this.gameManager.opponentFolded = false;
        this.gameManager.playerRaised = false;
        this.gameManager.currentBet = 0;
        this.gameManager.uiManager.clearOpponentAction();
    }

    // ========================================
    // 게임 초기화
    // ========================================

    startNewGame() {
        this.gameManager.gameLogic.resetDeck();
        this.gameManager.initializeGameState();
        this.gameManager.aiPlayer.setMoney(10000);
        this.gameManager.aiPlayer.setCards([]);
        
        this.dealFirstCard();
        this.gameManager.updateDisplay();
        this.gameManager.uiManager.setGameMessage(this.gameManager.uiManager.getNewGameMessage());
        this.gameManager.uiManager.clearOpponentAction();
    }
}