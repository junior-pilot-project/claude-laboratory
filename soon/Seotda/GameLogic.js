class GameLogic {
    constructor() {
        this.deck = this.createDeck();
    }

    createDeck() {
        const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const cards = [];
        
        // 광패 (Light cards)
        const lightCards = [1, 3, 8];
        lightCards.forEach(month => {
            const lightCard = { month: month, type: 'light', value: month };
            cards.push(lightCard);
            console.log('Created light card:', lightCard);
        });
        
        // 열끗 (Animal cards) and others
        months.forEach(month => {
            if (!lightCards.includes(month)) {
                // 각 월마다 2장씩
                cards.push({ month: month, type: 'normal', value: month });
                cards.push({ month: month, type: 'normal', value: month });
            } else {
                // 광패가 있는 월은 1장 추가
                cards.push({ month: month, type: 'normal', value: month });
            }
        });
        
        console.log('Total cards created:', cards.length, 'Light cards:', cards.filter(c => c.type === 'light').length);
        return cards;
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCard() {
        // 덱이 부족하면 새로 생성
        if (this.deck.length < 1) {
            console.warn('Deck is empty, creating new deck');
            this.deck = this.createDeck();
            this.shuffleDeck();
        }
        
        const card = this.deck.pop();
        if (!card) {
            console.error('Failed to deal card from deck');
            // 최후의 수단으로 랜덤 카드 생성
            return { month: Math.ceil(Math.random() * 10), type: 'normal', value: Math.ceil(Math.random() * 10) };
        }
        
        return card;
    }

    getCardInfo(card) {
        // 카드 객체 유효성 검사
        if (!card || typeof card.month === 'undefined') {
            console.error('Invalid card in getCardInfo:', card);
            return { emoji: '❌', name: '오류', color: '#ff0000' };
        }
        
        const cardData = {
            1: { emoji: '🌸', name: '송학', color: '#ff69b4' },      // 1월 - 소나무
            2: { emoji: '🌺', name: '매조', color: '#ff1493' },      // 2월 - 매화
            3: { emoji: '🌸', name: '벚꽃', color: '#ffb6c1' },      // 3월 - 벚꽃
            4: { emoji: '🐦', name: '흑싸리', color: '#9370db' },    // 4월 - 흑싸리
            5: { emoji: '🏠', name: '창포', color: '#4169e1' },      // 5월 - 창포
            6: { emoji: '🦋', name: '모란', color: '#ff6347' },      // 6월 - 모란
            7: { emoji: '🐗', name: '홍싸리', color: '#ff4500' },    // 7월 - 홍싸리
            8: { emoji: '🌙', name: '공산', color: '#ffd700' },      // 8월 - 공산
            9: { emoji: '🍶', name: '국화', color: '#9932cc' },      // 9월 - 국화
            10: { emoji: '🦌', name: '단풍', color: '#ff8c00' }      // 10월 - 단풍
        };
        
        return cardData[card.month] || { emoji: '🎴', name: '화투', color: '#666' };
    }

    getHandRank(cards) {
        if (cards.length < 2) {
            return { rank: 0, name: '미완성' };
        }
        
        const [card1, card2] = cards;
        const month1 = card1.month;
        const month2 = card2.month;
        
        // 광패 조합
        if (card1.type === 'light' && card2.type === 'light') {
            if ((month1 === 3 && month2 === 8) || (month1 === 8 && month2 === 3)) {
                return { rank: 1000, name: '38광' };
            }
            if ((month1 === 1 && month2 === 3) || (month1 === 3 && month2 === 1)) {
                return { rank: 999, name: '13광' };
            }
            if ((month1 === 1 && month2 === 8) || (month1 === 8 && month2 === 1)) {
                return { rank: 998, name: '18광' };
            }
        }
        
        // 땡 (같은 숫자)
        if (month1 === month2) {
            return { rank: 900 + month1, name: `${month1}땡` };
        }
        
        // 특수 조합
        const specialCombos = [
            { combo: [1, 2], rank: 899, name: '알리' },
            { combo: [1, 4], rank: 898, name: '독사' },
            { combo: [1, 9], rank: 897, name: '구삥' },
            { combo: [1, 10], rank: 896, name: '장삥' },
            { combo: [4, 10], rank: 895, name: '장사' },
            { combo: [3, 6], rank: 894, name: '세륙' }
        ];
        
        for (const special of specialCombos) {
            if ((month1 === special.combo[0] && month2 === special.combo[1]) ||
                (month1 === special.combo[1] && month2 === special.combo[0])) {
                return { rank: special.rank, name: special.name };
            }
        }
        
        // 끗 (두 수의 합 % 10)
        const sum = (month1 + month2) % 10;
        return { rank: sum, name: `${sum}끗` };
    }

    // 덱 상태 확인
    getDeckInfo() {
        return {
            remainingCards: this.deck.length,
            lightCardsRemaining: this.deck.filter(card => card.type === 'light').length,
            normalCardsRemaining: this.deck.filter(card => card.type === 'normal').length
        };
    }

    // 새 덱으로 리셋
    resetDeck() {
        this.deck = this.createDeck();
        this.shuffleDeck();
        console.log('Deck reset with', this.deck.length, 'cards');
    }
}