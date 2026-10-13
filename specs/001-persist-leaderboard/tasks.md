---
description: "Task list for the persistent leaderboard feature"
---

# Tasks: Persistent Leaderboard

**Input**: Design documents from `/specs/001-persist-leaderboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. plan.md specifies Vitest unit tests for the model and storage; UI is checked manually via quickstart.md.

**Organization**: Grouped by user story so each can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3 map to spec.md user stories

## Constitution reminders (apply to every task)

- Nothing added to the per-frame path: no allocation, no storage or DOM access in the sim loop (Principle III)
- Colours only from the palette CSS variables; no assets (Principle II)
- Patterns used must match the Architecture Design Review in plan.md; a newly discarded pattern gets added there (Principle VI)

---

## Phase 1: Setup

- [X] T001 Add `vitest` to `devDependencies` and a `"test": "vitest run"` script in `package.json`; run `npm install`
- [X] T002 [P] Add a `LEADERBOARD` constant in `src/config.ts` with `key: 'lowrally.leaderboard.v1'`, `size: 10` and `schemaVersion: 1`; keep the existing `BEST_TIME_KEY` (used only for migration)
- [X] T003 [P] Exclude `*.test.ts` from the production build type-check path if needed so `npm run build` still passes (check `tsconfig.json` `include`; test files may stay type-checked but MUST NOT be bundled)

**Checkpoint**: `npm run test` runs (no tests yet) and `npm run build` passes.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: The pure model and storage strategy from plan.md. No DOM, no wiring.

- [X] T004 [P] Write failing tests in `src/leaderboard/leaderboard.test.ts` for the model using a `MemoryStore`: valid submit returns 1-based rank; list is sorted ascending; ties keep the earlier run first; trims to 10 and drops the slowest; a slower-than-all time on a full board returns `null` and leaves entries unchanged; `time` of 0, negative, `NaN` and `Infinity` are rejected (return `null`); `best()` is `null` when empty; `clear()` empties
- [X] T005 [P] Write failing tests in `src/leaderboard/leaderboard.test.ts` for persistence: entries survive creating a new `Leaderboard` over the same store; corrupt JSON gives an empty board; wrong `v` gives an empty board; per-entry validation drops `{"time":-1}`, non-objects and non-finite numbers but keeps valid siblings; a store whose `save` throws never makes `submit` throw; `submit` re-reads the store before writing so an entry added by another instance is kept (read-merge-write)
- [X] T006 [P] Create `src/leaderboard/store.ts` exporting `interface LeaderboardStore { load(): string | null; save(raw: string): void }` and `class MemoryStore` implementing it (holds the raw string; `save` never throws), per `contracts/leaderboard-api.md`
- [X] T007 Add `class LocalStorageStore` (Adapter) to `src/leaderboard/store.ts`: `load` and `save` use `LEADERBOARD.key` from `src/config.ts`, wrap every access in `try/catch`, return `null` on failure, and `save` swallows quota/security errors
- [X] T008 Add `createStore(): LeaderboardStore` (Factory Method) to `src/leaderboard/store.ts`: probe `localStorage` once with a write/remove of a throwaway key inside `try/catch`; return `LocalStorageStore` if usable, otherwise `MemoryStore`
- [X] T009 Create `src/leaderboard/leaderboard.ts` exporting `interface LeaderboardEntry { readonly time: number; readonly date: number | null }` and `class Leaderboard` (Facade) with the constructor `(store: LeaderboardStore, legacyBest: () => number | null)` and methods `submit(time, now = Date.now()): number | null`, `best(): number | null`, `entries(): readonly LeaderboardEntry[]`, `clear(): void`. Implement per `data-model.md`: entry `time` "Finite and > 0"; `date` "number (epoch ms) or `null`"; order `time` ascending with earlier `date` first on ties (`null` first); at most `LEADERBOARD.size` entries; parse the stored `{ "v": 1, "entries": [...] }` defensively, re-validating, re-sorting and re-trimming; `submit` re-reads the store, merges, trims and calls `save` once; `entries()` returns a stable array reference between mutations. Leave `legacyBest` unused for now (US3)
- [X] T010 Run `npm run test` and make T004 and T005 pass; run `npm run typecheck`

**Checkpoint**: Model and store fully unit-tested; nothing wired into the game yet.

---

## Phase 3: User Story 1 - Finished runs are remembered (Priority: P1) 🎯 MVP

**Goal**: Every finished lap is saved automatically and survives reload and offline use.

**Independent Test**: Finish three laps with different times, reload, and check (via DevTools `localStorage` or the HUD best time) that all three are stored and the HUD best equals the fastest. Quickstart scenarios 1, 2, 3.

- [X] T011 [US1] In `src/stage.ts`, change the `Stage` constructor to `(track: Track, board: Leaderboard)`; replace the `readBest`/`writeBest` helpers and the `best` field initialiser so `best` returns `board.best()`; on the transition to `finished`, call `board.submit(this.time)` once and set `newRecord` to true only when the returned rank is `1`. Store the returned rank in a new public `lastRank: number | null` field (reset to `null` in `reset()`). Do not add allocation to `update()`
- [X] T012 [US1] In `src/main.ts`, create the store and leaderboard once (`createStore()`, then `new Leaderboard(store, readLegacyBest)` where `readLegacyBest` is a small function in `src/stage.ts`-independent scope that reads `BEST_TIME_KEY` inside `try/catch` and returns `null` unless the value is finite) and pass the leaderboard into `new Stage(...)`. Keep the dev-only `window.__game` handle and add `board` to it
- [X] T013 [US1] In `src/main.ts`, keep the 10 Hz HUD path unchanged except that `hud.setBest(...)` now reads `stage.best` (already backed by the leaderboard); confirm the finish banner text still uses `stage.newRecord`
- [X] T014 [US1] Run `npm run build` and verify quickstart scenarios 1 to 3 and 7 (blocked storage) in `npm run dev`: laps persist across reload, the board trims at 10, and a private window completes laps without errors

**Checkpoint**: MVP. Data is persisted; no board UI yet.

---

## Phase 4: User Story 2 - View the leaderboard (Priority: P2)

**Goal**: Players can open a ranked list with dates, see their fresh run highlighted, and clear the board.

**Independent Test**: With several saved times, open the panel from the start screen and from the finish banner; entries are fastest first with date; a just-finished qualifying run is highlighted with its rank; empty state shows with no data. Quickstart scenarios 4, 5, 9.

- [X] T015 [P] [US2] Add panel markup to `index.html` after `#banner`: a hidden `<div id="leaderboard" hidden>` containing a heading, an ordered list container `#lb-list`, an empty-state element `#lb-empty`, and `Close` and `Clear` buttons (`#lb-close`, `#lb-clear`)
- [X] T016 [P] [US2] Add a `Leaderboard` button to the start screen in `index.html` (`id="start-lb"`) and a `Leaderboard` button inside the banner area (`id="banner-lb"`) reachable after a finish (SC-003: at most 2 taps)
- [X] T017 [P] [US2] Add styles in `src/style.css` for `#leaderboard`, its rows, the highlighted row, the empty state and the new buttons, using only the existing palette CSS variables; touch targets at least 44 px; usable in portrait and landscape; `#banner` buttons need `pointer-events: auto` if the banner is otherwise non-interactive
- [X] T018 [US2] Create `src/ui/leaderboardView.ts` exporting `class LeaderboardView` constructed with the `Leaderboard`, with `open(highlightRank: number | null)`, `close()` and `isOpen`. Render rows (rank, `formatTime` from `src/ui/hud.ts`, local-formatted date, or an em dash when `date` is `null`) only inside `open()`, never on a timer; toggle `#lb-empty` when there are no entries; mark the `highlightRank` row with a class and state the rank in text. `Clear` asks `window.confirm(...)`, calls `board.clear()` only on confirm, then re-renders (FR-013)
- [X] T019 [US2] Wire the buttons in `src/main.ts`: `#start-lb` opens the view with `null`; `#banner-lb` opens it with `stage.lastRank`; `#lb-close` closes it. On the start screen call `stopPropagation()` on the button's `pointerdown` so opening the board does not start the game, and make the start screen's global `keydown` start handler in `src/ui/startScreen.ts` ignore keys while the view is open (e.g. an `isBlocked` callback passed in) so Escape or typing does not start a run
- [X] T020 [US2] While the view is open, pause input side effects: ignore game keys in `src/input/keyboard.ts` only if needed (verify first whether the overlay blocks the touch zones; use the simplest fix that prevents steering underneath the panel). Add `Escape` to close the panel
- [X] T021 [US2] Verify quickstart scenarios 4, 5 and 9 manually in `npm run dev`, in a mobile viewport and a desktop viewport; run `npm run build`

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Existing best time carries over (Priority: P3)

**Goal**: A returning player's saved best becomes the first leaderboard entry exactly once.

**Independent Test**: With only `lowrally.best.v1` set to `70.5`, reload; the board shows one 1:10.50 entry and the HUD best is unchanged; reload again and no duplicate appears. Quickstart scenario 6.

- [X] T022 [P] [US3] Add tests to `src/leaderboard/leaderboard.test.ts`: when the store is empty and `legacyBest()` returns `70.5`, the board has one entry `{ time: 70.5, date: null }` and the store now holds the new format; a second `Leaderboard` over the same store does not duplicate it; an invalid legacy value (`NaN`, `0`, negative, `null`) imports nothing; after `clear()`, constructing a new `Leaderboard` does NOT re-import the legacy value (the new key exists, even if empty); the legacy key is never modified
- [X] T023 [US3] Implement the migration in `src/leaderboard/leaderboard.ts`: when `store.load()` returns `null` (the key is absent), call `legacyBest()`; if it is finite and greater than 0 create a single entry with `date: null` and `save` it. Never write to the legacy key. Make T022 pass
- [X] T024 [US3] Verify quickstart scenario 6 manually, and that scenario 8 (corrupt data) still yields only valid entries

**Checkpoint**: All three stories work.

---

## Phase 6: Polish and Cross-Cutting

- [X] T025 [P] Update the README: change the "Your best time is kept in `localStorage`" sentence to describe the top-10 leaderboard, and add `src/leaderboard/` to the project layout list
- [X] T026 [P] Add a short note under "How it works" in `README.md` covering the storage key, the one-time legacy import, and the in-memory fallback
- [ ] T027 Verify the service worker still precaches the app and that `npm run build && npm run preview` works offline after one visit (quickstart scenario 2)
- [ ] T028 Run quickstart scenario 10 (performance) with a throttled mobile profile and confirm no long task from saving or opening the panel; if the budget is at risk, record the finding in the plan's Architecture Design Review
- [X] T029 Run `npm run test` and `npm run build`; confirm both pass and `git status` shows no stray files

---

## Dependencies and Execution Order

- **Phase 1** has no dependencies. **Phase 2** depends on Phase 1 and blocks every story.
- **US1 (Phase 3)** depends on Phase 2. **US2 (Phase 4)** depends on Phase 2 and uses `Stage.lastRank` from T011, so run it after US1. **US3 (Phase 5)** depends only on Phase 2 and T009 and can run in parallel with US2.
- **Polish** depends on the stories being complete.

Within phases: T004, T005 and T006 are independent (tests first, they should fail); T007 and T008 extend `store.ts` after T006; T009 follows T006; T010 follows T004 to T009.

## Parallel Opportunities

- Phase 1: T002 and T003 together after T001.
- Phase 2: T004, T005 and T006 together.
- Phase 4: T015, T016 and T017 together (three files: `index.html` is shared by T015 and T016, so do those two in sequence if one person is editing).
- Phase 5 can run alongside Phase 4.
- Phase 6: T025 and T026 together.

```text
Parallel example, Phase 2:
  T004 model tests      src/leaderboard/leaderboard.test.ts
  T006 MemoryStore      src/leaderboard/store.ts
```

## Implementation Strategy

- **MVP first**: Phases 1 to 3 deliver persistence, the core of "persist a leaderboard". Stop and validate there.
- **Incremental**: add US2 (visibility), then US3 (migration protects existing players; consider shipping it together with US1 so no returning player loses their best).
- Note: if US1 ships alone, the old `lowrally.best.v1` value stops being read as the HUD best, so a returning player would see `--:--.--` until US3 lands. **Ship US3 with US1**, or do T022 to T023 straight after T012.
