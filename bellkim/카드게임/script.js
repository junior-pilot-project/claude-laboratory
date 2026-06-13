// 게임 상태 및 설정
class SolitaireGame {
    constructor() {
        this.deck = [];
        this.waste = [];
        this.foundations = {
            spades: [],
            hearts: [],
            diamonds: [],
            clubs: []
        };
        this.tableau = [[], [], [], [], [], [], []];

        this.score = 0;
        this.moves = 0;
        this.startTime = null;
        this.gameTimer = null;
        this.gameHistory = [];

        this.suits = ['spades', 'hearts', 'diamonds', 'clubs'];
        this.ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        this.suitSymbols = {
            spades: '♠',
            hearts: '♥',
            diamonds: '♦',
            clubs: '♣'
        };

        this.draggedCard = null;
        this.draggedFrom = null;

        this.init();
    }

    init() {
        this.createDeck();
        this.shuffleDeck();
        this.dealCards();
        this.setupEventListeners();
        this.startTimer();
        this.updateDisplay();
    }

    // 카드 덱 생성
    createDeck() {
        this.deck = [];
        for (let suit of this.suits) {
            for (let rank of this.ranks) {
                this.deck.push({
                    suit: suit,
                    rank: rank,
                    color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black',
                    faceUp: false,
                    id: `${suit}-${rank}`
                });
            }
        }
    }

    // 덱 섞기
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // 카드 배치
    dealCards() {
        // 태블로에 카드 배치
        for (let col = 0; col < 7; col++) {
            for (let row = 0; row <= col; row++) {
                const card = this.deck.pop();
                if (row === col) {
                    card.faceUp = true;
                }
                this.tableau[col].push(card);
            }
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 덱 클릭
        document.getElementById('deck-pile').addEventListener('click', () => this.drawFromDeck());

        // 새 게임 버튼
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('new-game-modal-btn').addEventListener('click', () => this.newGame());

        // 실행취소 버튼
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());

        // 힌트 버튼
        document.getElementById('hint-btn').addEventListener('click', () => this.showHint());

        // 드래그 앤 드롭 이벤트
        this.setupDragAndDrop();
    }

    // 드래그 앤 드롭 설정
    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => this.handleDragStart(e));
        document.addEventListener('dragover', (e) => this.handleDragOver(e));
        document.addEventListener('drop', (e) => this.handleDrop(e));
        document.addEventListener('dragend', (e) => this.handleDragEnd(e));
    }

    // 덱에서 카드 뽑기
    drawFromDeck() {
        if (this.deck.length > 0) {
            const card = this.deck.pop();
            card.faceUp = true;
            this.waste.push(card);
            this.addMove();
        } else if (this.waste.length > 0) {
            // 폐기더미를 덱으로 되돌리기
            while (this.waste.length > 0) {
                const card = this.waste.pop();
                card.faceUp = false;
                this.deck.push(card);
            }
            this.addMove();
        }
        this.updateDisplay();
    }

    // 카드 HTML 생성
    createCardElement(card) {
        const cardEl = document.createElement('div');
        cardEl.className = `card ${card.color} ${card.faceUp ? '' : 'face-down'}`;
        cardEl.draggable = card.faceUp;
        cardEl.dataset.cardId = card.id;

        if (card.faceUp) {
            cardEl.innerHTML = `
                <div class="card-top">
                    <div>${card.rank}</div>
                    <div>${this.suitSymbols[card.suit]}</div>
                </div>
                <div class="card-center">
                    ${this.suitSymbols[card.suit]}
                </div>
                <div class="card-bottom">
                    <div>${card.rank}</div>
                    <div>${this.suitSymbols[card.suit]}</div>
                </div>
            `;
        }

        return cardEl;
    }

    // 화면 업데이트
    updateDisplay() {
        this.updateDeck();
        this.updateWaste();
        this.updateFoundations();
        this.updateTableau();
        this.updateScore();
        this.checkGameComplete();
    }

    updateDeck() {
        const deckEl = document.getElementById('deck-pile');
        deckEl.innerHTML = this.deck.length > 0 ? '<div class="card-back"></div>' : '';
    }

    updateWaste() {
        const wasteEl = document.getElementById('waste-pile');
        wasteEl.innerHTML = '';

        if (this.waste.length > 0) {
            const topCard = this.waste[this.waste.length - 1];
            const cardEl = this.createCardElement(topCard);
            wasteEl.appendChild(cardEl);
        }
    }

    updateFoundations() {
        for (let suit of this.suits) {
            const foundationEl = document.getElementById(`foundation-${suit}`);
            foundationEl.innerHTML = `<div class="foundation-placeholder">${this.suitSymbols[suit]}</div>`;

            if (this.foundations[suit].length > 0) {
                const topCard = this.foundations[suit][this.foundations[suit].length - 1];
                const cardEl = this.createCardElement(topCard);
                foundationEl.appendChild(cardEl);
            }
        }
    }

    updateTableau() {
        for (let col = 0; col < 7; col++) {
            const columnEl = document.getElementById(`column-${col}`);
            columnEl.innerHTML = '';

            this.tableau[col].forEach((card, index) => {
                const cardEl = this.createCardElement(card);
                cardEl.style.top = `${index * 25}px`;
                cardEl.style.zIndex = index;
                columnEl.appendChild(cardEl);
            });
        }
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('moves').textContent = this.moves;
    }

    // 타이머 시작
    startTimer() {
        this.startTime = Date.now();
        this.gameTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('timer').textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    // 이동 추가
    addMove() {
        this.moves++;
        this.updateScore();
    }

    // 점수 추가
    addScore(points) {
        this.score += points;
        this.updateScore();
    }

    // 드래그 시작
    handleDragStart(e) {
        if (!e.target.classList.contains('card') || e.target.classList.contains('face-down')) {
            e.preventDefault();
            return;
        }

        this.draggedCard = this.findCardByElement(e.target);
        this.draggedFrom = this.findCardLocation(this.draggedCard);

        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    // 드래그 오버
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // 드롭 타겟 하이라이트
        const dropTarget = this.getDropTarget(e.target);
        if (dropTarget && this.canDropOn(dropTarget)) {
            dropTarget.classList.add('drop-target');
        }
    }

    // 드롭 처리
    handleDrop(e) {
        e.preventDefault();

        const dropTarget = this.getDropTarget(e.target);
        if (dropTarget && this.canDropOn(dropTarget)) {
            this.moveCard(dropTarget);
        }

        this.clearDropTargets();
    }

    // 드래그 종료
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.clearDropTargets();
        this.draggedCard = null;
        this.draggedFrom = null;
    }

    // 카드 이동
    moveCard(dropTarget) {
        const targetLocation = this.getTargetLocation(dropTarget);

        if (this.isValidMove(this.draggedCard, targetLocation)) {
            // 이동 실행
            this.removeCardFromLocation(this.draggedCard, this.draggedFrom);
            this.addCardToLocation(this.draggedCard, targetLocation);

            // 숨겨진 카드 뒤집기
            this.flipHiddenCards();

            this.addMove();
            this.addScore(this.calculateMoveScore(targetLocation));
            this.updateDisplay();
        }
    }

    // 이동 유효성 검사
    isValidMove(card, targetLocation) {
        if (targetLocation.type === 'foundation') {
            return this.canMoveToFoundation(card, targetLocation.suit);
        } else if (targetLocation.type === 'tableau') {
            return this.canMoveToTableau(card, targetLocation.column);
        }
        return false;
    }

    // 파운데이션으로 이동 가능한지 확인
    canMoveToFoundation(card, suit) {
        if (card.suit !== suit) return false;

        const foundation = this.foundations[suit];
        if (foundation.length === 0) {
            return card.rank === 'A';
        }

        const topCard = foundation[foundation.length - 1];
        const cardValue = this.getCardValue(card.rank);
        const topValue = this.getCardValue(topCard.rank);

        return cardValue === topValue + 1;
    }

    // 태블로로 이동 가능한지 확인
    canMoveToTableau(card, column) {
        const tableau = this.tableau[column];

        if (tableau.length === 0) {
            return card.rank === 'K';
        }

        const topCard = tableau[tableau.length - 1];
        if (!topCard.faceUp) return false;

        const cardValue = this.getCardValue(card.rank);
        const topValue = this.getCardValue(topCard.rank);

        return cardValue === topValue - 1 && card.color !== topCard.color;
    }

    // 카드 값 반환
    getCardValue(rank) {
        const values = {'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
                       '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13};
        return values[rank];
    }

    // 숨겨진 카드 뒤집기
    flipHiddenCards() {
        for (let col = 0; col < 7; col++) {
            const column = this.tableau[col];
            if (column.length > 0) {
                const topCard = column[column.length - 1];
                if (!topCard.faceUp) {
                    topCard.faceUp = true;
                    this.addScore(5);
                }
            }
        }
    }

    // 게임 완료 확인
    checkGameComplete() {
        const totalFoundationCards = Object.values(this.foundations)
            .reduce((sum, foundation) => sum + foundation.length, 0);

        if (totalFoundationCards === 52) {
            this.gameComplete();
        }
    }

    // 게임 완료 처리
    gameComplete() {
        clearInterval(this.gameTimer);

        const finalTime = document.getElementById('timer').textContent;
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-time').textContent = finalTime;
        document.getElementById('final-moves').textContent = this.moves;

        document.getElementById('game-complete-modal').classList.add('show');

        // 보너스 점수
        this.addScore(1000);
    }

    // 새 게임 시작
    newGame() {
        clearInterval(this.gameTimer);

        // 게임 상태 초기화
        this.deck = [];
        this.waste = [];
        this.foundations = {
            spades: [],
            hearts: [],
            diamonds: [],
            clubs: []
        };
        this.tableau = [[], [], [], [], [], [], []];
        this.score = 0;
        this.moves = 0;
        this.gameHistory = [];

        // 모달 닫기
        document.getElementById('game-complete-modal').classList.remove('show');

        // 게임 재시작
        this.init();
    }

    // 유틸리티 함수들
    findCardByElement(element) {
        const cardId = element.dataset.cardId;
        // 모든 카드 배열에서 카드 찾기
        const allCards = [
            ...this.deck,
            ...this.waste,
            ...Object.values(this.foundations).flat(),
            ...this.tableau.flat()
        ];
        return allCards.find(card => card.id === cardId);
    }

    findCardLocation(card) {
        // 카드의 현재 위치 찾기
        if (this.waste.includes(card)) {
            return { type: 'waste' };
        }

        for (let suit of this.suits) {
            if (this.foundations[suit].includes(card)) {
                return { type: 'foundation', suit: suit };
            }
        }

        for (let col = 0; col < 7; col++) {
            if (this.tableau[col].includes(card)) {
                return { type: 'tableau', column: col };
            }
        }

        return null;
    }

    getDropTarget(element) {
        // 드롭 타겟 요소 찾기
        if (element.classList.contains('foundation-pile')) {
            return element;
        }
        if (element.classList.contains('tableau-column')) {
            return element;
        }
        return element.closest('.foundation-pile') || element.closest('.tableau-column');
    }

    canDropOn(dropTarget) {
        return this.draggedCard &&
               (dropTarget.classList.contains('foundation-pile') ||
                dropTarget.classList.contains('tableau-column'));
    }

    getTargetLocation(dropTarget) {
        if (dropTarget.classList.contains('foundation-pile')) {
            return {
                type: 'foundation',
                suit: dropTarget.dataset.suit
            };
        } else if (dropTarget.classList.contains('tableau-column')) {
            const columnId = dropTarget.id.split('-')[1];
            return {
                type: 'tableau',
                column: parseInt(columnId)
            };
        }
        return null;
    }

    removeCardFromLocation(card, location) {
        if (location.type === 'waste') {
            this.waste.pop();
        } else if (location.type === 'foundation') {
            this.foundations[location.suit].pop();
        } else if (location.type === 'tableau') {
            this.tableau[location.column].pop();
        }
    }

    addCardToLocation(card, location) {
        if (location.type === 'foundation') {
            this.foundations[location.suit].push(card);
        } else if (location.type === 'tableau') {
            this.tableau[location.column].push(card);
        }
    }

    calculateMoveScore(targetLocation) {
        if (targetLocation.type === 'foundation') {
            return 10;
        }
        return 0;
    }

    clearDropTargets() {
        document.querySelectorAll('.drop-target').forEach(el => {
            el.classList.remove('drop-target');
        });
    }

    // 실행취소 (기본 구현)
    undo() {
        // TODO: 실행취소 기능 구현
        console.log('실행취소 기능은 추후 구현 예정입니다.');
    }

    // 힌트 (기본 구현)
    showHint() {
        // TODO: 힌트 기능 구현
        console.log('힌트 기능은 추후 구현 예정입니다.');
    }
}

// 게임 시작
document.addEventListener('DOMContentLoaded', () => {
    new SolitaireGame();
});