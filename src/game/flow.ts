import type { StageState } from '../stage';

export type FlowState = 'title' | 'playing' | 'paused';

/**
 * Title / playing / paused state machine (State pattern). Pure and allocation-free: the game
 * loop reads `isStepping` once per frame, and everything else is driven by user actions.
 * Transitions return whether they happened, so illegal ones (double taps) are harmless no-ops.
 */
export class GameFlow {
  state: FlowState = 'title';

  get isStepping(): boolean {
    return this.state === 'playing';
  }

  start(): boolean {
    return this.move('title', 'playing');
  }

  pause(): boolean {
    return this.move('playing', 'paused');
  }

  resume(): boolean {
    return this.move('paused', 'playing');
  }

  restart(): boolean {
    return this.move('paused', 'playing');
  }

  /** Only a run whose clock is ticking has anything to lose. */
  needsRestartConfirm(stage: StageState): boolean {
    return stage === 'running';
  }

  private move(from: FlowState, to: FlowState): boolean {
    if (this.state !== from) return false;
    this.state = to;
    return true;
  }
}
