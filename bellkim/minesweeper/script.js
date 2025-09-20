class Minesweeper {
    constructor() {
        this.boardSize = 10;
        this.mineCount = 10;
        this.board = [];
        this.gameState = 'playing';
        this.flagCount = 0;
        this.revealedCount = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.firstClick = true;

        this.initializeDOM();
        this.initializeGame();
    }

    initializeDOM() {
        this.boardElement = document.getElementById('game-board');
        this.mineCountElement = document.getElementById('mine-count');
        this.timerElement = document.getElementById('timer-display');
        this.resetButton = document.getElementById('reset-btn');
        this.messageElement = document.getElementById('game-message');

        this.resetButton.addEventListener('click', () => this.resetGame());
    }

    initializeGame() {
        this.createBoard();
        this.renderBoard();
        this.updateMineCount();
        this.resetTimer();
    }

    createBoard() {
        this.board = [];
        for (let row = 0; row < this.boardSize; row++) {
            this.board[row] = [];
            for (let col = 0; col < this.boardSize; col++) {
                this.board[row][col] = {
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    neighborMines: 0
                };
            }
        }
    }

    placeMines(excludeRow, excludeCol) {
        let minesPlaced = 0;
        while (minesPlaced < this.mineCount) {
            const row = Math.floor(Math.random() * this.boardSize);
            const col = Math.floor(Math.random() * this.boardSize);

            if (!this.board[row][col].isMine &&
                !(row === excludeRow && col === excludeCol)) {
                this.board[row][col].isMine = true;
                minesPlaced++;
            }
        }

        this.calculateNeighborMines();
    }

    calculateNeighborMines() {
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (!this.board[row][col].isMine) {
                    let count = 0;
                    for (let i = -1; i <= 1; i++) {
                        for (let j = -1; j <= 1; j++) {
                            const newRow = row + i;
                            const newCol = col + j;
                            if (this.isValidPosition(newRow, newCol) &&
                                this.board[newRow][newCol].isMine) {
                                count++;
                            }
                        }
                    }
                    this.board[row][col].neighborMines = count;
                }
            }
        }
    }

    isValidPosition(row, col) {
        return row >= 0 && row < this.boardSize &&
               col >= 0 && col < this.boardSize;
    }

    renderBoard() {
        this.boardElement.innerHTML = '';

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                cell.addEventListener('click', (e) => this.handleCellClick(e));
                cell.addEventListener('contextmenu', (e) => this.handleRightClick(e));

                this.boardElement.appendChild(cell);
            }
        }
    }

    handleCellClick(event) {
        if (this.gameState !== 'playing') return;

        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);
        const cell = this.board[row][col];

        if (cell.isFlagged || cell.isRevealed) return;

        if (this.firstClick) {
            this.placeMines(row, col);
            this.firstClick = false;
            this.startTimer();
        }

        if (cell.isMine) {
            this.gameOver(false);
        } else {
            this.revealCell(row, col);
            this.checkWinCondition();
        }

        this.updateBoard();
    }

    handleRightClick(event) {
        event.preventDefault();

        if (this.gameState !== 'playing') return;

        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);
        const cell = this.board[row][col];

        if (cell.isRevealed) return;

        if (cell.isFlagged) {
            cell.isFlagged = false;
            this.flagCount--;
        } else {
            cell.isFlagged = true;
            this.flagCount++;
        }

        this.updateMineCount();
        this.updateBoard();
    }

    revealCell(row, col) {
        if (!this.isValidPosition(row, col) ||
            this.board[row][col].isRevealed ||
            this.board[row][col].isFlagged) {
            return;
        }

        const cell = this.board[row][col];
        cell.isRevealed = true;
        this.revealedCount++;

        if (cell.neighborMines === 0 && !cell.isMine) {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    this.revealCell(row + i, col + j);
                }
            }
        }
    }

    updateBoard() {
        const cells = this.boardElement.querySelectorAll('.cell');

        cells.forEach(cellElement => {
            const row = parseInt(cellElement.dataset.row);
            const col = parseInt(cellElement.dataset.col);
            const cell = this.board[row][col];

            cellElement.className = 'cell';
            cellElement.textContent = '';

            if (cell.isFlagged) {
                cellElement.classList.add('flagged');
                cellElement.textContent = '🚩';
            } else if (cell.isRevealed) {
                cellElement.classList.add('revealed');

                if (cell.isMine) {
                    cellElement.classList.add('mine');
                    cellElement.textContent = '💣';
                } else if (cell.neighborMines > 0) {
                    cellElement.textContent = cell.neighborMines;
                    cellElement.classList.add(`number-${cell.neighborMines}`);
                }
            }
        });
    }

    checkWinCondition() {
        const totalCells = this.boardSize * this.boardSize;
        const nonMineCells = totalCells - this.mineCount;

        if (this.revealedCount === nonMineCells) {
            this.gameOver(true);
        }
    }

    gameOver(won) {
        this.gameState = won ? 'won' : 'lost';
        this.stopTimer();

        if (!won) {
            for (let row = 0; row < this.boardSize; row++) {
                for (let col = 0; col < this.boardSize; col++) {
                    if (this.board[row][col].isMine) {
                        this.board[row][col].isRevealed = true;
                    }
                }
            }
            this.updateBoard();
        }

        this.showMessage(won ? '승리! 🎉' : '게임 오버! 💥', won ? 'win' : 'lose');
        this.resetButton.textContent = won ? '😎' : '😵';
    }

    showMessage(text, type) {
        this.messageElement.textContent = text;
        this.messageElement.className = `game-message ${type}`;
        this.messageElement.classList.remove('hidden');
    }

    hideMessage() {
        this.messageElement.classList.add('hidden');
    }

    updateMineCount() {
        const remainingMines = this.mineCount - this.flagCount;
        this.mineCountElement.textContent = remainingMines.toString().padStart(3, '0');
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.timerElement.textContent = this.timer.toString().padStart(3, '0');
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.stopTimer();
        this.timer = 0;
        this.timerElement.textContent = '000';
    }

    resetGame() {
        this.gameState = 'playing';
        this.flagCount = 0;
        this.revealedCount = 0;
        this.firstClick = true;

        this.resetButton.textContent = '🙂';
        this.hideMessage();
        this.initializeGame();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Minesweeper();
});