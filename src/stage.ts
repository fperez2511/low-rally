import type { Leaderboard } from './leaderboard/leaderboard';
import type { Track } from './world/track';

export type StageState = 'armed' | 'running' | 'finished';

/**
 * One-lap stage timer. The car spawns just behind the line ("armed"); crossing it
 * starts the clock, and coming back round to the line finishes the stage.
 *
 * Progress is the sample index nearest the car, unwrapped into a running total so a
 * full lap is exactly `track.count` samples.
 */
export class Stage {
  state: StageState = 'armed';
  time = 0;
  /** True for exactly one update after a new record. */
  newRecord = false;
  /** Leaderboard rank of the last finished run (1-based), or null if it did not place. */
  lastRank: number | null = null;

  private index = 0;
  private travelled = 0; // samples driven since the start line

  constructor(
    private readonly track: Track,
    private readonly board: Leaderboard,
  ) {}

  /** Fastest recorded time, straight from the leaderboard (single source of truth). */
  get best(): number | null {
    return this.board.best();
  }

  /** Re-arm with the car at the given spawn point. */
  reset(x: number, z: number): void {
    this.state = 'armed';
    this.time = 0;
    this.newRecord = false;
    this.lastRank = null;
    this.travelled = 0;
    this.index = this.track.nearestIndexNear(x, z, this.track.count - 1, this.track.count >> 1);
  }

  update(dt: number, x: number, z: number): void {
    const n = this.track.count;
    const idx = this.track.nearestIndexNear(x, z, this.index);
    let delta = idx - this.index;
    if (delta > n / 2) delta -= n; // wrapped backwards over the line
    else if (delta < -n / 2) delta += n; // wrapped forwards over the line
    const crossedForward = this.index > n * 0.75 && idx < n * 0.25;
    this.index = idx;

    if (this.state === 'armed') {
      if (crossedForward) this.state = 'running';
      return;
    }
    if (this.state !== 'running') return;

    this.time += dt;
    this.travelled += delta;
    if (this.travelled >= n) {
      this.state = 'finished';
      this.lastRank = this.board.submit(this.time);
      this.newRecord = this.lastRank === 1;
    }
  }
}
