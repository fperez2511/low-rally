/** Formats seconds as m:ss.cc */
export function formatTime(t: number): string {
  const total = Math.max(0, t);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

/**
 * Thin DOM HUD. Writes to the DOM only when the displayed text changes and the
 * game throttles calls to ~10 Hz, so it never causes per-frame layout work.
 */
export class Hud {
  private readonly root = document.getElementById('hud')!;
  private readonly speed = document.getElementById('hud-speed')!;
  private readonly time = document.getElementById('hud-time')!;
  private readonly best = document.getElementById('hud-best')!;
  private readonly banner = document.getElementById('banner')!;
  private lastSpeed = -1;
  private lastTime = '';
  private lastBest = '';

  constructor(onRestart: () => void) {
    const btn = document.getElementById('hud-restart')!;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onRestart();
      btn.blur(); // keep Space/Enter from re-triggering the button
    });
  }

  show(): void {
    this.root.hidden = false;
  }

  setSpeed(kmh: number): void {
    const v = Math.round(kmh);
    if (v === this.lastSpeed) return;
    this.lastSpeed = v;
    this.speed.textContent = String(v);
  }

  setTime(text: string): void {
    if (text === this.lastTime) return;
    this.lastTime = text;
    this.time.textContent = text;
  }

  setBest(text: string): void {
    if (text === this.lastBest) return;
    this.lastBest = text;
    this.best.textContent = text;
  }

  showBanner(html: string | null): void {
    if (html === null) {
      this.banner.hidden = true;
      return;
    }
    this.banner.innerHTML = html;
    this.banner.hidden = false;
  }
}
