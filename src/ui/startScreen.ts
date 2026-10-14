/**
 * "Tap to start" overlay. The tap is a user gesture, which is what iOS requires
 * before an AudioContext may run, so the callback is where audio gets unlocked.
 * Buttons on the overlay, or an open modal (`isBlocked`), do not start the game.
 */
export function showStartScreen(onStart: () => void, isBlocked: () => boolean = () => false): void {
  const el = document.getElementById('start')!;
  let done = false;
  const go = (e: Event): void => {
    if (done || isBlocked()) return;
    if (e.target instanceof HTMLButtonElement) return; // buttons (e.g. Leaderboard) must not start the run
    if (e instanceof KeyboardEvent && e.code === 'Escape') return;
    if (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey || e.altKey)) return;
    done = true;
    e.preventDefault();
    el.hidden = true;
    window.removeEventListener('keydown', go);
    onStart();
  };
  el.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}
