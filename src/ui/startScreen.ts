/**
 * "Tap to start" overlay. The tap is a user gesture, which is what iOS requires
 * before an AudioContext may run, so the callback is where audio gets unlocked.
 */
export function showStartScreen(onStart: () => void): void {
  const el = document.getElementById('start')!;
  let done = false;
  const go = (e: Event): void => {
    if (done) return;
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
