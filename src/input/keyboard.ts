import { createInputState, type InputSource, type InputState } from './types';

/** Arrow keys / WASD / space. Digital; the car controller smooths the steering. */
export class KeyboardInput implements InputSource {
  readonly state: InputState = createInputState();
  private readonly down = new Set<string>();

  constructor(
    private readonly onRestart?: () => void,
    private readonly isSuspended: () => boolean = () => false,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.isSuspended()) {
      // A modal (leaderboard) is open: drop held keys and leave keys like Space to its buttons.
      this.down.clear();
      this.refresh();
      return;
    }
    if (e.code === 'KeyR' && !e.repeat) this.onRestart?.();
    if (isDriveKey(e.code)) e.preventDefault();
    this.down.add(e.code);
    this.refresh();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    this.refresh();
  };

  private readonly onBlur = (): void => {
    this.down.clear();
    this.refresh();
  };

  private refresh(): void {
    const d = this.down;
    const left = d.has('ArrowLeft') || d.has('KeyA');
    const right = d.has('ArrowRight') || d.has('KeyD');
    this.state.steer = (right ? 1 : 0) - (left ? 1 : 0);
    this.state.throttle = d.has('ArrowUp') || d.has('KeyW') ? 1 : 0;
    this.state.brake = d.has('ArrowDown') || d.has('KeyS') || d.has('Space') ? 1 : 0;
  }
}

function isDriveKey(code: string): boolean {
  return code.startsWith('Arrow') || code === 'Space' || code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD';
}
