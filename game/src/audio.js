// audio.js — every sound is synthesized with WebAudio. No audio files.
// Engine hum follows speed, a two-tone siren follows the wanted level,
// and a slow chord pad plays as music. All of it starts only after the
// player presses a key or clicks, as browsers require.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.started = false;
    // A slow sunset progression, as note frequencies.
    this.chords = [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
      [164.81, 220.0, 261.63],
    ];
    this.chordIndex = 0;
  }

  start() {
    if (this.started) return;
    this.started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // Engine: a sawtooth through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();

    // Siren: a sine whose pitch wobbles between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 750;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 0.55;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();

    // Music: one soft pad chord every 4 seconds.
    this.musicTimer = window.setInterval(() => this.playChord(), 4000);
    this.playChord();
  }

  playChord() {
    if (!this.ctx) return;
    const notes = this.chords[this.chordIndex % this.chords.length];
    this.chordIndex++;
    for (const freq of notes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 1.2);
      gain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 3.8);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + 4.0);
    }
  }

  // Short blip for pickups and mission steps.
  blip(freq = 660) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Low thud for punches and crashes.
  thud() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.15);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Called every frame: engine follows speed, siren follows wanted.
  update(speed, wanted, driving) {
    if (!this.ctx) return;
    const targetEngine = driving ? 0.05 + Math.min(0.12, speed * 0.003) : 0.0;
    this.engineGain.gain.setTargetAtTime(targetEngine, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed * 2.2, this.ctx.currentTime, 0.1);
    const targetSiren = wanted > 0 ? 0.045 : 0.0;
    this.sirenGain.gain.setTargetAtTime(targetSiren, this.ctx.currentTime, 0.2);
  }
}
