---
description: "Task list for the main menu feature"
---

# Tasks: Main Menu

**Input**: Design documents from `/specs/002-main-menu/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included for the pure logic only (`GameFlow`, `Settings`) as specified in plan.md. DOM, touch layout and audio are verified manually via quickstart.md.

**Organization**: Grouped by user story so each can be implemented and tested independently. `index.html`, `src/style.css`, `src/ui/menu.ts` and `src/main.ts` are touched by several stories, so tasks that edit them are sequential (never `[P]`) across stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 to US5 map to the user stories in spec.md

## Constitution reminders (apply to every task)

- Nothing added to the per-frame path beyond one state check: no allocation, no DOM or storage access in the sim loop (Principle III)
- Colours only from the palette CSS variables; no assets (Principle II)
- Touch targets at least 44 px and usable in portrait and landscape (Principle I)
- Patterns must match the Architecture Design Review in plan.md; a newly discarded pattern gets added there (Principle VI)
- Audio starts only after a user gesture (Start button)

---

## Phase 1: Setup

- [X] T001 Add constants to `src/config.ts`: `AUTHOR = 'Fabricio Perez'` and `SETTINGS = { key: 'lowrally.settings.v1', schemaVersion: 1 }` (with a doc comment pointing to `specs/002-main-menu`)

**Checkpoint**: `npm run typecheck` passes.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: The pure flow state machine, the input `release()` contract, and replacing `started` in `main.ts` with it. After this phase the game plays exactly as before.

- [X] T002 [P] Write failing tests in `src/game/flow.test.ts` for `GameFlow` per `data-model.md`: initial state is `title`; `start()` moves `title` to `playing`; `pause()` moves `playing` to `paused`; `resume()` and `restart()` move `paused` to `playing`; every other transition is ignored and returns `false` (e.g. `pause()` in `title`, `resume()` in `playing`, a second `start()`); each legal transition returns `true`; `needsRestartConfirm` is `true` only for `'running'` and `false` for `'armed'` and `'finished'`; `isStepping` is `true` only in `playing`
- [X] T003 Create `src/game/flow.ts` (State pattern, DOM-free, no allocation): export `type FlowState = 'title' | 'playing' | 'paused'`, `class GameFlow` with a `state` field, methods `start()`, `pause()`, `resume()`, `restart()` returning `boolean` (true if the transition happened), a getter `isStepping`, and `needsRestartConfirm(stage: StageState): boolean` (import `StageState` from `src/stage.ts`) returning `true` only for `'running'`. Make T002 pass with `npm test`
- [X] T004 Add `release(): void` to the `InputSource` interface in `src/input/types.ts` with the doc comment "Drop any held input (menu opened, page hidden)"
- [X] T005 [P] Implement `release()` in `src/input/keyboard.ts`: clear the `down` set and call `refresh()`; reuse it from the existing `onBlur` handler
- [X] T006 [P] Implement `release()` in `src/input/touch.ts`: clear the `pointers` map, remove the `active` class from every `.zone` and `#touch-brake`, then call `refresh()`
- [X] T007 In `src/main.ts` replace the `started` boolean with a `GameFlow` instance: the sim step loop runs only when `flow.isStepping`; the `showStartScreen` callback calls `flow.start()`; the `alpha` interpolation uses `flow.isStepping`; add helper functions `pause()` (calls `flow.pause()` and, if it returned true, `source.release()` on every input source) and `resume()` (calls `flow.resume()`); pass `() => leaderboardView.isOpen || !flow.isStepping` as the `KeyboardInput` suspended callback. Behaviour for the player is unchanged

**Checkpoint**: `npm test`, `npm run typecheck` and `npm run dev` pass; the game starts and plays as before.

---

## Phase 3: User Story 1 - Pause, resume and restart from the menu (Priority: P1) 🎯 MVP

**Goal**: The HUD Restart button becomes a Menu button; opening it pauses the game and offers Resume and Restart (with confirmation while the timer is running).

**Independent Test**: Quickstart scenarios 2 to 7. Start a run, open Menu, wait, Resume: timer and car continue unchanged. Restart mid-run asks for confirmation; before the start line or after finishing it does not.

- [X] T008 [US1] In `index.html` replace `<button id="hud-restart">Restart</button>` with `<button id="hud-menu" type="button" aria-haspopup="dialog">Menu</button>`, and add a hidden `<div id="menu" hidden role="dialog" aria-modal="true" aria-labelledby="menu-title">` containing a card with two views per `contracts/menu-ui.md`: `#menu-main` (`<h2 id="menu-title">Paused</h2>`, buttons `#menu-resume` "Resume" and `#menu-restart` "Restart") and `#menu-confirm` (hidden; text "Restart?", buttons `#menu-confirm-no` "No" and `#menu-confirm-yes` "Yes")
- [X] T009 [US1] In `src/style.css` rename the `#hud-restart` rules to `#hud-menu` (same position) and add `#menu` styles: fixed full-screen overlay at `z-index: 20` (above `#hud` 10 and `#touch` 5, below `#leaderboard` 30), dimmed background using the existing rgba palette values, centred card reusing the `.lb-card` look, `.menu-btn` buttons based on `.lb-btn` with `min-height: 44px` and a vertical stack with gap, card `max-height: 100%` with `overflow-y: auto` so it scrolls on short landscape phones, safe-area padding like `#leaderboard`
- [X] T010 [US1] Update `src/ui/hud.ts`: the constructor takes `onMenu: () => void`, binds the `#hud-menu` button click (preventDefault, call `onMenu`, then `blur()` as the current Restart button does)
- [X] T011 [US1] Create `src/ui/menu.ts` (Facade + Command): export `interface MenuActions { onResume(): void; onRestart(): void; onRestartConfirmed(): void }` and `class MenuView` with `isOpen` getter, `openPaused()`, `showConfirm()`, `close()`. It toggles `hidden` on `#menu`, `#menu-main` and `#menu-confirm`, moves focus (Resume on main, "No" on confirm), remembers nothing else, and handles `Escape` on `window` keydown per `contracts/menu-ui.md`: ignore if `e.defaultPrevented` or the menu is closed; on the confirm view go back to main; on main call `onResume`. No DOM writes outside user actions
- [X] T012 [US1] In `src/ui/leaderboardView.ts` make the existing Escape handler call `e.preventDefault()` when it closes the dialog, so the menu's Escape handler (which ignores `defaultPrevented` events) leaves the menu open
- [X] T013 [US1] Add `setMuted(muted: boolean)` to `src/audio.ts`: stores the flag and sets the gain to 0 when muted; make `update()` return early while muted (so the gain is not rewritten) and apply the normal gain again when unmuted
- [X] T014 [US1] Wire the pause flow in `src/main.ts`: create `MenuView` with `onResume` (resume, close menu), `onRestart` (if `flow.needsRestartConfirm(stage.state)` call `menu.showConfirm()`, otherwise call `doRestart()`) and `onRestartConfirmed` (`doRestart()`); `doRestart()` calls the existing `restart()`, then `flow.restart()`, then `menu.close()`; pass `() => openMenu()` to `Hud` where `openMenu()` calls `pause()` then `menu.openPaused()`; call `audio.setMuted(!flow.isStepping)` after every flow change (pause, resume, restart); add a `window` keydown handler: `Escape` while `flow.isStepping` and the leaderboard is closed calls `openMenu()`; the `KeyR` key (non-repeat) while `flow.isStepping`: if `flow.needsRestartConfirm(stage.state)` then `openMenu()` followed by `menu.showConfirm()`, otherwise `doRestart()`; add a `document` `visibilitychange` listener that calls `openMenu()` when hidden and `flow.isStepping`. Remove the `onRestart` argument from the `KeyboardInput` construction and drop the `onRestart` handling (`KeyR` branch and constructor parameter) from `src/input/keyboard.ts`
- [X] T015 [US1] Manually verify quickstart scenarios 2 to 7 on `npm run dev`; confirm the timer excludes paused time by finishing a lap after a long pause and checking the leaderboard entry

**Checkpoint**: User Story 1 works on its own (the old tap-to-start overlay still starts the game). This is the MVP.

---

## Phase 4: User Story 2 - Start the game from the main menu (Priority: P2)

**Goal**: The tap-anywhere overlay is replaced by the menu's title mode with Start and Leaderboard.

**Independent Test**: Quickstart scenarios 1 and 10. Load the page: the menu shows Start and Leaderboard; clicking elsewhere or pressing random keys does nothing; Start begins the run and unlocks audio.

- [X] T016 [US2] In `index.html` delete the `#start` overlay and extend the `#menu` card: add a title block `<h1 id="menu-heading">Low Rally</h1>` shown in title mode, a `#menu-start` "Start" button, a `#menu-leaderboard` "Leaderboard" button (shown in both modes), and the controls help text currently in `.start-help` (touch and keyboard hints; keyboard hint says "Esc for menu, R to restart")
- [X] T017 [US2] In `src/style.css` remove the `#start`, `.start-cta`, `.start-help` pulse-animation rules and `#start-lb` rule; add equivalents under `#menu` for the heading (reuse the old `#start h1` styling) and the help text
- [X] T018 [US2] Extend `src/ui/menu.ts`: add `onStart(): void` and `onLeaderboard(): void` to `MenuActions`; add `openTitle()` (shows Start, Leaderboard and the title heading, hides Resume and Restart, focuses Start); make `openPaused()` hide Start and the heading and show Resume, Restart and Leaderboard; ignore Escape in title mode; clicks on the dimmed area outside the card do nothing
- [X] T019 [US2] Update `src/main.ts`: remove the `showStartScreen` call and the `#start-lb` listeners; call `menu.openTitle()` at startup; `onStart` calls `flow.start()`, `audio.unlock()`, `hud.show()`, `audio.setMuted(false)` and `menu.close()`; `onLeaderboard` calls `leaderboardView.open(null)`; keep the finish-banner leaderboard button listener
- [X] T020 [US2] Delete `src/ui/startScreen.ts` and remove its import from `src/main.ts`
- [X] T021 [US2] Manually verify quickstart scenarios 1 and 10 and that a keyboard-only player can start with Enter or Space

**Checkpoint**: User Stories 1 and 2 both work; the menu is the single front door.

---

## Phase 5: User Story 3 - Steer from the screen edges only (Priority: P2)

**Goal**: Touch steering zones cover the outer third of each side; the middle third is inert and untinted.

**Independent Test**: Quickstart scenario 11 on a touch viewport.

- [X] T022 [US3] In `src/style.css` change `.zone` from `width: 50%` to `width: 33.333%`; confirm `.zone-left` and `.zone-right` stay anchored to their edges, that `.zone.active` background and the chevron opacity apply only to the narrower strip, and that no other rule tints the middle of the screen
- [X] T023 [P] [US3] Update the doc comment in `src/input/touch.ts` ("Left/right screen thirds steer ...") and the touch hint in `index.html` help text to "hold the left or right edge to steer" (keep the brake hint)
- [X] T024 [US3] Verify quickstart scenario 11 with the Browser pane in the mobile preset (portrait and landscape): a touch in the left or right third steers and tints only that third, the middle third does nothing, steering plus brake works together, and nothing is tinted at rest

**Checkpoint**: User Story 3 works independently of the menu.

---

## Phase 6: User Story 4 - Turn sound on or off (Priority: P3)

**Goal**: A Sound toggle in the menu mutes all audio and is remembered.

**Independent Test**: Quickstart scenario 8.

- [X] T025 [P] [US4] Write failing tests in `src/settings.test.ts` for `Settings` per `contracts/settings-format.md`: default `soundOn` is `true`; setting `false` persists and a new `Settings` over the same storage reads `false`; stored `{"v":1,"sound":"yes"}`, a wrong `v`, unparseable JSON and a missing key all resolve to `true`; a storage whose `getItem` and `setItem` throw never throws and keeps the value in memory for the session. Make the constructor accept a minimal `Pick<Storage, 'getItem' | 'setItem'> | null` so tests can pass a stub
- [X] T026 [US4] Create `src/settings.ts` (Adapter): `class Settings` with `soundOn` getter and `setSoundOn(on: boolean)`, reading once in the constructor and writing `{ "v": 1, "sound": <boolean> }` under `SETTINGS.key` from `src/config.ts`; "Anything other than `true`/`false` is treated as absent (default `true`)"; every storage access in `try/catch`; add `createSettings()` that passes `window.localStorage` (or `null` if accessing it throws). Make T025 pass with `npm test`
- [X] T027 [US4] In `index.html` add a `#menu-sound` button to the menu's main view (shown in both modes) with `aria-pressed` and visible text "Sound: On" / "Sound: Off"
- [X] T028 [US4] Extend `src/ui/menu.ts`: add `onToggleSound(): void` to `MenuActions`, bind `#menu-sound`, and add `setSound(on: boolean)` updating the label and `aria-pressed`
- [X] T029 [US4] Update `src/main.ts`: create `Settings` via `createSettings()`; call `menu.setSound(settings.soundOn)` at startup; `onToggleSound` flips and saves the setting, updates the menu label and re-applies mute; replace the mute computation everywhere with one `applyMute()` function: `audio.setMuted(!settings.soundOn || !flow.isStepping)`
- [X] T030 [US4] Manually verify quickstart scenario 8, including a reload and a private window

**Checkpoint**: User Story 4 works independently.

---

## Phase 7: User Story 5 - About card (Priority: P3)

**Goal**: The menu has an About view showing the author and the version set in `src/config.ts` (amended: originally the build's commit hash, see Phase 9).

**Independent Test**: Quickstart scenario 9.

- [X] T031 [P] [US5] Create `src/env.d.ts` with `declare const __APP_COMMIT__: string;`
- [X] T032 [P] [US5] In `vite.config.ts` resolve the commit and add `define: { __APP_COMMIT__: JSON.stringify(commit) }`: `execSync('git rev-parse --short HEAD')` inside `try/catch` (stdio piped so errors are silent), falling back to `process.env.GITHUB_SHA?.slice(0, 7)`, then `'unknown'`
- [X] T033 [US5] In `index.html` add an `#menu-about-btn` "About" button to the main view and a hidden `#menu-about` view containing the game name, `By <span id="about-author"></span>`, `Version <span id="about-version"></span>` and a `#menu-about-close` "Close" button
- [X] T034 [US5] Extend `src/ui/menu.ts`: bind About and Close, add `showAbout()` and a back-to-main path (Escape on About returns to the main view; focus Close when shown, About button when returning); fill `#about-author` from `AUTHOR` in `src/config.ts` and `#about-version` from `__APP_COMMIT__` once in the constructor; the paused run stays paused throughout
- [X] T035 [US5] Manually verify quickstart scenario 9: the displayed hash equals `git rev-parse --short HEAD`, Close returns to the menu, and a build without git shows "unknown"

**Checkpoint**: All five user stories work independently.

---

## Phase 8: Polish & Cross-Cutting

- [X] T036 [P] Update `README.md`: controls (Menu button, Esc, R with confirmation, edge steering), a short "How it works" paragraph on pause (sim not stepped, `Stage.time` unaffected) and on the build-time commit, and remove "Menus: ..., pause" from "Next steps (deliberately not built)" leaving stage select, car select as the unbuilt items
- [X] T037 [P] Add `flow` and `menu` to the dev-only `window.__game` handle in `src/main.ts` (inside the existing `import.meta.env.DEV` block)
- [X] T038 Run `npm test` and `npm run build`; both must pass
- [ ] T039 Run the full quickstart (scenarios 1 to 14), including the small-screen check at 360x640 and 640x360, the Performance trace on a throttled mobile profile, and the offline PWA check from `npm run build && npm run preview`

---

## Phase 9: Amendment - version from config (US5)

**Context**: Clarified 2026-10-18: the About version is a constant the author edits in `src/config.ts`, not the git commit. This reverses the build-time plumbing from T031 and T032.

- [X] T041 [US5] Add `export const VERSION = '0.0.2';` to `src/config.ts` next to `AUTHOR`, with a doc comment: "Shown on the About card; bump by hand"
- [X] T042 [US5] In `src/ui/menu.ts` import `VERSION` from `src/config.ts` and set `#about-version` from it instead of `__APP_COMMIT__`
- [X] T043 [P] [US5] Delete `src/env.d.ts`
- [X] T044 [P] [US5] In `vite.config.ts` remove `resolveCommit()`, the `define: { __APP_COMMIT__ ... }` entry and the now-unused `node:child_process` import
- [X] T045 [P] [US5] In `README.md` reword the "Menu and pause" bullet and the Menu sentence near the top: the About card shows the version set in `src/config.ts` (no mention of commit, `git rev-parse` or `GITHUB_SHA`)
- [X] T046 [US5] Run `npm test` and `npm run build`; then verify quickstart scenario 9 by changing `VERSION` and confirming the About card updates, and that `grep -r APP_COMMIT src vite.config.ts` finds nothing
- [X] T047 [US5] Keep `package.json` and `package-lock.json` `version` equal to `VERSION` (`0.0.2`) and add `src/version.test.ts` asserting `VERSION === package.json version`, so the two cannot drift

---

## Dependencies & Execution Order

- **Setup (T001)** has no dependencies.
- **Foundational (T002 to T007)** depends on T001 only for config; blocks all stories. T003 follows T002; T005 and T006 follow T004; T007 follows T003.
- **US1 (T008 to T015)** depends on Foundational. This is the MVP.
- **US2 (T016 to T021)** depends on US1 (extends the same menu markup, view and `main.ts` wiring).
- **US3 (T022 to T024)** depends only on Foundational and can run any time after it, in parallel with US1, US2, US4 or US5 (it edits `.zone` rules in `src/style.css`, so avoid editing that file concurrently with another story).
- **US4 (T025 to T030)** depends on US1 (uses `setMuted`) and US2 (menu main view layout); T025 and T026 can start any time after T001.
- **US5 (T031 to T035)** depends on US1 (menu view structure); T031 and T032 can start any time.
- **Polish (T036 to T039)** after all stories.
- **Amendment (T041 to T046)** depends only on US5 already being in place; T041 before T042; T043 to T045 are independent of each other; T046 last.

## Parallel Opportunities

- After T004: T005 and T006 (different files).
- T002 (tests) alongside T001.
- US3 entirely alongside the menu stories, apart from `src/style.css` conflicts.
- T025 and T026 (settings), T031 and T032 (version plumbing) alongside any menu work.
- T036 and T037 in Polish; T043, T044 and T045 in the amendment.

## Parallel Example: Foundational

```text
T002 write flow tests        T004 add release() to InputSource
T003 implement GameFlow      T005 keyboard release()   T006 touch release()
                  \_____ T007 wire GameFlow into main.ts _____/
```

## Implementation Strategy

- **MVP**: Phases 1 to 3 (US1). The game can be paused, resumed and restarted with confirmation, and the Restart button is replaced by Menu.
- **Incremental delivery**: add US2 (menu as front door), then US3 (touch zones, small and independent), then US4 and US5. Each phase ends at a checkpoint where the game is playable and `npm run build` passes.
