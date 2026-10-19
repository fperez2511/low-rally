# Quickstart: Validating the Main Menu

## Prerequisites

```bash
npm install
npm run dev     # http://localhost:5173 (use a touch viewport for the touch checks)
```

Unit tests: `npm test`. Type-check and production build: `npm run build`.

## Scenarios

1. **Title menu (US2)**: Load the page. Expect Start, Sound, Leaderboard and About; no Resume/Restart. Click or tap the dim area and press random keys: nothing starts. Press Start (or Enter): the run begins and the HUD appears.
2. **Menu replaces Restart (US1, FR-003)**: During a run, expect a Menu button where Restart used to be and no other Restart button.
3. **Pause and resume (US1)**: Drive, note the timer, open Menu. Car, timer and scenery are frozen. Wait 30 s, press Resume. The timer continues from the noted value and the car state is unchanged. Finish a lap after a pause and confirm the leaderboard time excludes the pause.
4. **Restart confirmation**: Drive past the start line so the timer runs, open Menu, press Restart. Expect "Restart? Yes / No". No returns to the menu with the run intact; Yes starts a fresh run at 0:00.00. Repeat before crossing the line and after finishing: Restart happens immediately with no prompt.
5. **Keyboard**: `Escape` opens and closes the menu; `R` while the timer runs opens the confirm view; `R` before the line or after finishing restarts at once; `Enter`/`Space` activate the focused button; Escape in About or confirm goes back one step.
6. **Held input release (FR-018)**: Hold a steering key (or finger on a zone), open the menu with Escape (or the Menu button), resume. The car must not keep steering or braking.
7. **Tab hidden (FR-020)**: During a run switch tabs and come back. Expect the menu open over the paused run.
8. **Sound (US4)**: Toggle Sound off: engine hum stops and the button reads Off. Resume and drive: silent. Reload: still off. Toggle on: hum returns. Clear site data: defaults to on. With storage blocked, toggling works for the session with no error.
9. **About (US5)**: Open About. Expect "Fabricio Perez" and a hash equal to `git rev-parse --short HEAD`. Close returns to the menu; paused runs stay paused. Build with no git (`GIT_DIR=/nonexistent npm run build`) and expect "unknown".
10. **Leaderboard from the menu**: Open it from the menu, press Escape: only the leaderboard closes and the menu stays.
11. **Touch zones (US3)**: On a touch viewport (portrait and landscape) hold the left third: the car steers left and only that third is tinted. Same for the right third. Touch the middle third (away from Brake): no steering, no tint. Hold a side and Brake together: both work. At rest no side overlay is visible.
12. **Small screens**: At 360 x 640 portrait and 640 x 360 landscape, every menu view is fully visible or scrollable and all buttons are tappable.
13. **Performance (SC-002 spirit, constitution III)**: Record a Performance trace on a throttled mobile profile while opening and closing the menu mid-run: no long tasks and no dropped frames while driving.
14. **PWA**: `npm run build && npm run preview`, load once, go offline, reload: menu, sound and About all work.

## Done when

All scenarios behave as described, `npm test` and `npm run build` pass.
