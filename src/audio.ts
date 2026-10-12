/**
 * Minimal engine hum. The real purpose of the start tap is to create/resume the
 * AudioContext inside a user gesture (iOS refuses otherwise); this gives it something to play.
 */
export class EngineAudio {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  /** Must be called from a pointer/key handler. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    void ctx.resume();
    this.ctx = ctx;
    this.osc = osc;
    this.gain = gain;
  }

  /** speedRatio 0..1, throttle 0..1. */
  update(speedRatio: number, throttle: number): void {
    if (!this.ctx || !this.osc || !this.gain) return;
    this.osc.frequency.value = 55 + speedRatio * 120;
    this.gain.gain.value = 0.035 + 0.03 * throttle;
  }
}
