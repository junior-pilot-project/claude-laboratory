class SoundManager {
    constructor() {
        this.audioContext = null;
        this.soundEnabled = true;
        this.initializeAudio();
    }

    initializeAudio() {
        try {
            // 사용자 상호작용 후 AudioContext 초기화
            const initAudio = () => {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    console.log('Audio initialized');
                }
            };
            
            // 첫 클릭시 오디오 컨텍스트 초기화
            document.addEventListener('click', initAudio, { once: true });
        } catch (error) {
            console.warn('Audio initialization failed:', error);
            this.soundEnabled = false;
        }
    }

    playSound(type) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // 사운드 타입별 설정
            switch (type) {
                case 'cardDeal':
                    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                    break;
                    
                case 'bet':
                    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.15);
                    break;
                    
                case 'raise':
                    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.2);
                    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.3);
                    break;
                    
                case 'fold':
                    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.5);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.5);
                    break;
                    
                case 'win':
                    // 승리 사운드 - 상승하는 멜로디
                    const frequencies = [523, 659, 784, 1047]; // C, E, G, C (한 옥타브 위)
                    frequencies.forEach((freq, index) => {
                        const osc = this.audioContext.createOscillator();
                        const gain = this.audioContext.createGain();
                        osc.connect(gain);
                        gain.connect(this.audioContext.destination);
                        
                        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + index * 0.15);
                        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime + index * 0.15);
                        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + index * 0.15 + 0.3);
                        
                        osc.start(this.audioContext.currentTime + index * 0.15);
                        osc.stop(this.audioContext.currentTime + index * 0.15 + 0.3);
                    });
                    return; // 일찍 리턴해서 아래 코드 실행 안 함
                    
                case 'lose':
                    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.8);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.8);
                    break;
                    
                case 'tie':
                    oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime + 0.2);
                    oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime + 0.4);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime + 0.2);
                    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + 0.3);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime + 0.4);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.6);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.6);
                    break;
                    
                case 'newRound':
                    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(554, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.3);
                    break;
            }
        } catch (error) {
            console.warn('Sound playback failed:', error);
        }
    }
}