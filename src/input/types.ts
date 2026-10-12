/**
 * The one contract between "something that reads a device" and the car controller.
 * Every input source (keyboard, touch, later gamepad...) fills one of these;
 * the car never knows which device it came from.
 */
export interface InputState {
  /** -1 (left) .. +1 (right) */
  steer: number;
  /** 0 .. 1 */
  throttle: number;
  /** 0 .. 1 (also reverses once stopped) */
  brake: number;
}

export interface InputSource {
  /** Live state, mutated by event handlers. */
  readonly state: InputState;
  dispose(): void;
}

export function createInputState(): InputState {
  return { steer: 0, throttle: 0, brake: 0 };
}

/** Merge several sources into `out` (strongest signal per axis wins). No allocation. */
export function mergeInputs(out: InputState, sources: readonly InputSource[]): void {
  out.steer = 0;
  out.throttle = 0;
  out.brake = 0;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i].state;
    if (Math.abs(s.steer) > Math.abs(out.steer)) out.steer = s.steer;
    if (s.throttle > out.throttle) out.throttle = s.throttle;
    if (s.brake > out.brake) out.brake = s.brake;
  }
}
