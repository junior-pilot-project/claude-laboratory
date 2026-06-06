// Web Audio API 기반 사운드 매니저
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  _play(frequency, type = 'sine', duration = 0.1, gainValue = 0.3) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  _playSlide(freqFrom, freqTo, type = 'sine', duration = 0.1, gainValue = 0.3) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqTo, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  _playNoise(duration = 0.05, gainValue = 0.15) {
    if (!this.enabled || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    source.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.start(this.ctx.currentTime);
  }

  _playSequence(notes, interval = 0.12) {
    if (!this.enabled || !this.ctx) return;
    notes.forEach((note, i) => {
      setTimeout(() => this._play(note.freq, 'sine', note.dur || 0.15, note.gain || 0.3), i * interval * 1000);
    });
  }

  playClick() {
    this._playNoise(0.02, 0.2);
  }

  playEnhanceReady() {
    this._play(180, 'sine', 0.3, 0.25);
  }

  playSuccess(isRare = false) {
    if (isRare) {
      this._playSequence([
        { freq: 261 }, { freq: 329 }, { freq: 392 }, { freq: 523 },
      ], 0.1);
    } else {
      this._playSequence([
        { freq: 261 }, { freq: 329 }, { freq: 392 },
      ], 0.1);
    }
  }

  playFail() {
    this._play(200, 'square', 0.2, 0.2);
    setTimeout(() => this._playNoise(0.2, 0.1), 100);
    setTimeout(() => this._play(150, 'square', 0.2, 0.15), 200);
  }

  playInsufficientGold() {
    this._play(200, 'sawtooth', 0.1, 0.3);
    setTimeout(() => this._play(200, 'sawtooth', 0.1, 0.3), 200);
  }

  playBoxShake(callback) {
    if (!this.enabled || !this.ctx) { if (callback) setTimeout(callback, 3000); return; }
    let count = 0;
    const interval = setInterval(() => {
      this._playNoise(0.05, 0.15);
      count++;
      if (count >= 15) {
        clearInterval(interval);
        if (callback) callback();
      }
    }, 200);
  }

  playBoxOpen() {
    this._playSlide(300, 900, 'sine', 0.4, 0.3);
    setTimeout(() => this._playNoise(0.3, 0.2), 200);
  }

  playCoin() {
    this._playSlide(700, 900, 'sine', 0.08, 0.25);
  }

  playPurchase() {
    this._playSequence([
      { freq: 392, dur: 0.1 }, { freq: 523, dur: 0.15 },
    ], 0.12);
  }

  playVictory() {
    const notes = [261, 329, 392, 523, 659, 784, 1046].map(f => ({ freq: f, dur: 0.15 }));
    this._playSequence(notes, 0.12);
  }

  playTabSwitch() {
    this._playSlide(200, 400, 'sine', 0.1, 0.15);
  }

  playRaidAttack() {
    this._playSlide(440, 220, 'sawtooth', 0.07, 0.18);
    setTimeout(() => this._playNoise(0.04, 0.1), 55);
  }

  playRaidBossHit() {
    this._play(110, 'square', 0.13, 0.22);
    setTimeout(() => this._playNoise(0.05, 0.12), 45);
  }

  playRaidBossAttack() {
    this._playSlide(160, 70, 'sawtooth', 0.09, 0.28);
  }

  playRaidPlayerHit() {
    this._playNoise(0.07, 0.18);
    setTimeout(() => this._play(170, 'square', 0.1, 0.14), 55);
  }

  playRaidVictory() {
    this._playSequence([
      { freq: 392, dur: 0.12 }, { freq: 523, dur: 0.12 },
      { freq: 659, dur: 0.12 }, { freq: 784, dur: 0.2 },
    ], 0.13);
  }

  playRaidDefeat() {
    this._playSlide(280, 70, 'sawtooth', 0.5, 0.22);
    setTimeout(() => this._playNoise(0.3, 0.13), 180);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

const soundManager = new SoundManager();
