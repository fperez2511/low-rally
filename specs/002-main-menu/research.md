# Research: Main Menu

All Technical Context items were known from the existing codebase; no NEEDS CLARIFICATION remained. These are the design decisions that needed a look.

## 1. How to pause

- **Decision**: Pause by not stepping the fixed-timestep simulation while the flow is not `playing`. The render loop keeps running (camera, scenery draw) so the frozen scene stays visible behind the menu and no resize/context handling is needed.
- **Rationale**: `Stage.time` only advances inside `stage.update(SIM.dt, ...)`, so skipping that call excludes pause time from the run time automatically (FR-008, SC-001). `acc` is not advanced while paused, so there is no catch-up burst on resume.
- **Alternatives**: Stopping `requestAnimationFrame` (needs special resume bookkeeping, breaks the backdrop and resize); time-scaling dt to 0 (still runs the physics step); snapshotting state (Memento, rejected in the plan).

## 2. Pausing when the page is hidden (FR-020)

- **Decision**: Listen for `visibilitychange`; when hidden while `playing`, pause and open the menu. `KeyboardInput` already clears held keys on `blur`.
- **Rationale**: Browsers throttle or stop `requestAnimationFrame` for hidden tabs and the loop already clamps big frames, but the player would return to a live car; opening the menu is the safe, expected behaviour.
- **Alternatives**: Do nothing (car drives on resume); auto-resume on visible (surprises the player).

## 3. Restart confirmation rule

- **Decision**: Ask "Restart? Yes / No" only while `stage.state === 'running'`. When `armed` (timer not started) or `finished`, restart immediately.
- **Rationale**: The clarified spec says to confirm only while a run is in progress. Before the start line crosses, nothing is lost, and after the finish the time is already saved. Keyboard `R` goes through the same function: if confirmation is needed it opens the paused menu on the confirm view, otherwise it restarts at once.
- **Alternatives**: Always confirm (rejected by the clarification); confirm only after N seconds (more states, not requested).

## 4. Sound toggle and audio unlock

- **Decision**: `EngineAudio` gets `setMuted(boolean)`; `main.ts` passes `muted = !settings.soundOn || flow.state !== 'playing'`. `unlock()` still runs from the Start click regardless of the setting, so the toggle works instantly later and iOS is satisfied. While muted, `update()` returns early and the gain is held at 0.
- **Rationale**: Audio must start in a user gesture; muting a created context is the simplest reliable approach. Muting during pause also silences the engine hum, which would otherwise droop at a constant pitch.
- **Alternatives**: Suspend/resume the `AudioContext` (async, iOS quirks); do not create the context when sound is off (a later toggle on would need a gesture it may not have).

## 5. Persisting the sound preference

- **Decision**: A `Settings` class reading/writing `{ "v": 1, "sound": true|false }` under `lowrally.settings.v1`, with an in-memory fallback and try/catch around every access. Default on; invalid or missing data resolves to the default.
- **Rationale**: Mirrors the leaderboard store approach (constitution: `localStorage` only, degrade gracefully). A versioned key leaves room for more settings without a migration.
- **Alternatives**: Reuse the leaderboard store (wrong key and responsibility); a plain boolean key (no versioning).

## 6. Version in the About card

- **Decision (amended 2026-10-18)**: The version is a string constant `VERSION` in `src/config.ts`, next to `AUTHOR` and the other tuning constants, imported directly by the menu. It is no longer derived from git. No Vite `define`, no `src/env.d.ts`, no git or `GITHUB_SHA` lookup.
- **Rationale**: The author wants to control the version explicitly, like any other constant, and the constitution already centralises constants in `src/config.ts`. It removes build-environment dependence (no git needed, no "unknown" fallback) and is trivially testable.
- **Alternatives**: Build-time commit hash (original decision; dropped at the author's request); reading `package.json` (a second place to edit and a JSON import in the bundle); a generated `version.json` (extra step, network or precache concerns).
- **Superseded**: the original plan used `git rev-parse --short HEAD` with a `GITHUB_SHA` fallback via Vite `define`; that code is removed by tasks T041 to T044.

## 7. Narrowing the touch zones

- **Decision**: Change `.zone` width from 50% to `33.333%` (the value stays in CSS next to the layout; no config constant is needed). The brake button and middle third remain; the middle third has no handler and no highlight. The pressed highlight (`.zone.active`) is therefore confined to a third of the screen.
- **Rationale**: The visible tinted block is the `.active` background on a 50%-wide element, so shrinking the element fixes both the hit area and the overlay (FR-013 to FR-015). No JS change is needed for hit-testing because each zone already owns its own pointer events.
- **Alternatives**: Keep 50% hit area but shrink the visual (hit area would not match what is shown); make the width configurable at runtime (YAGNI).

## 8. Releasing held inputs when the menu opens (FR-018)

- **Decision**: Add `release()` to `InputSource`. `KeyboardInput` clears its key set; `TouchInput` clears its pointer map and `.active` classes. `main.ts` calls it for every source on pause.
- **Rationale**: A finger or key held when the menu opens would otherwise stay latched, because the matching up event may land on the menu instead. The keyboard already ignores key events while suspended; `release()` covers the transition itself.

## 9. Menu structure and focus

- **Decision**: One `#menu` element (modal `role="dialog"`) with three internal views toggled by `hidden`: main, restart-confirm, About. Focus moves to the primary button on every view change; Escape steps back (About/confirm → main, main while paused → resume). The existing `#leaderboard` dialog (z-index 30) opens above it and returns to the menu when closed.
- **Rationale**: Reuses the existing dialog look and keeps one overlay layer, so touch events cannot reach the steering zones while the menu is open.

## 10. Test approach

- **Decision**: Unit-test the pure parts with Vitest (`GameFlow` transitions and `needsRestartConfirm`, `Settings` load/save/corrupt/blocked). Verify the DOM, touch layout and audio manually per the quickstart. The existing suite has no DOM environment and adding one is not justified.
