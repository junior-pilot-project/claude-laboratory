/**
 * 섯다 게임 메인 관리자 클래스
 * 모든 컴포넌트를 조립하고 게임 상태를 관리하는 중앙 컨트롤러
 */
class GameManager {
    constructor() {
        // === 의존성 초기화 ===
        this.soundManager = new SoundManager();
        this.gameLogic = new GameLogic();
        this.aiPlayer = new AIPlayer(this.gameLogic);
        this.uiManager = new UIManager(this.gameLogic);
        
        // === 컨트롤러 초기화 ===
        this.gameController = new GameController(this);
        this.playerActions = new PlayerActions(this);
        this.aiController = new AIController(this);
        
        // === 게임 상태 초기화 ===
        this.initializeGameState();
        
        // === 이벤트 바인딩 및 게임 시작 ===
        this.bindUIEvents();
        this.gameController.startNewGame();
    }

    // ========================================
    // 초기화 메서드들
    // ========================================
    
    initializeGameState() {
        this.playerCards = [];
        this.pot = 0;
        this.playerMoney = 10000;
        this.currentBet = 0;
        this.round = 1;
        this.gamePhase = 'firstCard';
        this.playerFolded = false;
        this.opponentFolded = false;
        this.playerRaised = false;
    }

    bindUIEvents() {
        this.uiManager.bindEvents({
            onCall: () => this.playerActions.call(),
            onRaise: () => this.playerActions.raise(),
            onFold: () => this.playerActions.fold(),
            onNewGame: () => this.gameController.startNewGame(),
            onShowRules: () => this.uiManager.showRules(),
            onHideRules: () => this.uiManager.hideRules()
        });
    }

    // ========================================
    // UI 업데이트 메서드
    // ========================================

    updateDisplay() {
        const gameState = {
            playerCards: this.playerCards,
            aiCards: this.aiPlayer.cards,
            playerMoney: this.playerMoney,
            aiMoney: this.aiPlayer.getMoney(),
            pot: this.pot,
            round: this.round,
            gamePhase: this.gamePhase,
            playerFolded: this.playerFolded,
            opponentFolded: this.opponentFolded
        };
        
        this.uiManager.updateGameDisplay(gameState);
    }

    // ========================================
    // 게임 상태 조회 메서드들 (디버깅용)
    // ========================================

    getGameState() {
        return {
            // 기본 게임 상태
            playerCards: this.playerCards,
            aiCards: this.aiPlayer.cards,
            pot: this.pot,
            playerMoney: this.playerMoney,
            aiMoney: this.aiPlayer.getMoney(),
            currentBet: this.currentBet,
            round: this.round,
            gamePhase: this.gamePhase,
            
            // 플레이어 상태
            playerFolded: this.playerFolded,
            opponentFolded: this.opponentFolded,
            playerRaised: this.playerRaised,
            
            // 게임 로직 정보
            deckInfo: this.gameLogic.getDeckInfo(),
            playerRank: this.playerCards.length === 2 ? this.gameLogic.getHandRank(this.playerCards) : null,
            aiRank: this.aiPlayer.cards.length === 2 ? this.gameLogic.getHandRank(this.aiPlayer.cards) : null,
            
            // 액션 가능 여부
            availablePlayerActions: this.playerActions.getAvailableActions(),
            actionCosts: this.playerActions.getActionCosts(),
            
            // AI 정보
            aiState: this.aiController.getAIState()
        };
    }

    // ========================================
    // 디버깅 및 개발자 도구
    // ========================================

    // 개발자 콘솔에서 게임 상태 확인용
    debug() {
        const state = this.getGameState();
        console.table({
            '플레이어 돈': state.playerMoney,
            'AI 돈': state.aiMoney,
            '판돈': state.pot,
            '현재 베팅': state.currentBet,
            '라운드': state.round,
            '게임 페이즈': state.gamePhase,
            '플레이어 카드 수': state.playerCards.length,
            'AI 카드 수': state.aiCards.length
        });
        
        if (state.playerRank) {
            console.log('플레이어 족보:', state.playerRank);
        }
        
        if (state.aiRank && state.gamePhase === 'reveal') {
            console.log('AI 족보:', state.aiRank);
        }
        
        console.log('가능한 액션:', state.availablePlayerActions);
        console.log('액션 비용:', state.actionCosts);
        
        return state;
    }

    // 치트 기능들 (개발/테스트용)
    cheat = {
        addMoney: (amount) => {
            this.playerMoney += amount;
            this.updateDisplay();
            console.log(`플레이어에게 ${amount}원 추가. 현재: ${this.playerMoney}원`);
        },
        
        setPlayerCards: (month1, month2) => {
            this.playerCards = [
                { month: month1, type: 'normal', value: month1 },
                { month: month2, type: 'normal', value: month2 }
            ];
            this.updateDisplay();
            const rank = this.gameLogic.getHandRank(this.playerCards);
            console.log(`플레이어 카드 변경: ${month1}월, ${month2}월 (${rank.name})`);
        },
        
        revealAICards: () => {
            if (this.aiPlayer.cards.length > 0) {
                console.log('AI 카드:', this.aiPlayer.cards);
                if (this.aiPlayer.cards.length === 2) {
                    const rank = this.gameLogic.getHandRank(this.aiPlayer.cards);
                    console.log('AI 족보:', rank);
                }
            }
        },
        
        skipToReveal: () => {
            if (this.playerCards.length === 2 && this.aiPlayer.cards.length === 2) {
                this.gamePhase = 'reveal';
                this.gameController.revealCards();
                console.log('승부 단계로 스킵');
            } else {
                console.log('카드가 부족합니다. 먼저 두 번째 카드를 받으세요.');
            }
        }
    };

    // ========================================
    // 게임 통계 (향후 확장용)
    // ========================================

    getStats() {
        // 향후 게임 통계 기능 추가시 사용
        return {
            roundsPlayed: this.round - 1,
            // TODO: 승률, 평균 베팅 금액 등 통계 추가
        };
    }
}

// 게임 시작 및 전역 접근용
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new GameManager();
    
    // 개발자 도구에서 게임에 접근할 수 있도록
    window.game = game;
    console.log('게임이 시작되었습니다! 콘솔에서 game.debug() 또는 game.cheat 를 사용해보세요.');
});