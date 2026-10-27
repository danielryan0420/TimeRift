/** All sound effects are synthesized at runtime with the WebAudio API — no audio files, no network. */
export class SoundManager {
  private ctx: AudioContext | null = null;
  muted = false;

  private getCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, duration: number, startAt: number, type: OscillatorType, gainPeak: number): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + startAt;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  click(): void {
    this.tone(520, 0.08, 0, 'triangle', 0.15);
  }

  success(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.25, i * 0.09, 'triangle', 0.18));
  }

  error(): void {
    this.tone(180, 0.18, 0, 'sawtooth', 0.12);
    this.tone(120, 0.22, 0.05, 'sawtooth', 0.1);
  }

  portal(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(80, t0);
    osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.8);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.2, t0 + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.95);
  }

  starPop(): void {
    this.tone(880, 0.12, 0, 'sine', 0.15);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }
}

export const sfx = new SoundManager();
