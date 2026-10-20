// Restrained, synthesised sound design (off by default).
export class Sound {
  constructor() { this.ctx = null; this.on = false; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    // low ambient bed: two detuned sines through a soft low-pass
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 180;
    const bed = this.ctx.createGain();
    bed.gain.value = 0.05;
    for (const f of [41, 61.7]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    lp.connect(bed).connect(this.master);
    const len = this.ctx.sampleRate * 0.12;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  }
  toggle() {
    this.init();
    if (!this.ctx) return false;
    this.on = !this.on;
    this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.4);
    return this.on;
  }
  click(strength = 1) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400 + Math.random() * 1400; bp.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.value = 0.16 * strength;
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    // a soft metallic body under the click
    const o = this.ctx.createOscillator();
    o.frequency.value = 420 + Math.random() * 80;
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.03 * strength, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.3);
  }
  accent() {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(62, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 2.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 2.7);
  }
}
