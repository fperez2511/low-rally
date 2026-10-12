import { createInputState, type InputSource, type InputState } from './types';

/** True on phones/tablets whose primary pointer is a finger. */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
}

/**
 * Left/right screen halves steer, a button brakes, throttle is automatic.
 * Uses Pointer Events with pointer capture so multi-touch (steer + brake) just works
 * and a finger sliding off its zone still releases cleanly.
 */
export class TouchInput implements InputSource {
  readonly state: InputState = createInputState();
  private readonly pointers = new Map<number, number>(); // pointerId -> steer dir (-1/+1) or 0 for brake
  private readonly cleanups: Array<() => void> = [];

  constructor(root: HTMLElement) {
    this.state.throttle = 1; // auto-throttle
    root.hidden = false;

    root.querySelectorAll<HTMLElement>('.zone').forEach((el) => {
      this.bind(el, Number(el.dataset.steer));
    });
    this.bind(root.querySelector<HTMLElement>('#touch-brake')!, 0);
  }

  dispose(): void {
    this.cleanups.forEach((fn) => fn());
  }

  private bind(el: HTMLElement, dir: number): void {
    const down = (e: PointerEvent): void => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone; the up/cancel handlers still balance the map */
      }
      this.pointers.set(e.pointerId, dir);
      el.classList.add('active');
      this.refresh();
    };
    const up = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId);
      // Only clear the highlight if no other finger is still on this element.
      let still = false;
      this.pointers.forEach((d) => { if (d === dir) still = true; });
      if (!still) el.classList.remove('active');
      this.refresh();
    };
    const noMenu = (e: Event): void => e.preventDefault();

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', noMenu);
    this.cleanups.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('lostpointercapture', up);
      el.removeEventListener('contextmenu', noMenu);
    });
  }

  private refresh(): void {
    let left = false;
    let right = false;
    let brake = false;
    this.pointers.forEach((d) => {
      if (d < 0) left = true;
      else if (d > 0) right = true;
      else brake = true;
    });
    this.state.steer = (right ? 1 : 0) - (left ? 1 : 0);
    this.state.brake = brake ? 1 : 0;
  }
}
