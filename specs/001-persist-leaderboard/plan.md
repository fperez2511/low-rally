# Implementation Plan: Persistent Leaderboard

**Branch**: `001-persist-leaderboard` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-persist-leaderboard/spec.md`

## Summary

Replace the single "best time" value with a top-10 leaderboard persisted in the browser's
`localStorage`. A pure, DOM-free `Leaderboard` model owns ranking rules; a small storage
abstraction (real `localStorage` or an in-memory fallback) owns persistence; a lightweight
DOM panel shows the board. Saving happens once per finished stage and the panel renders only
when opened, so nothing touches the per-frame path. The legacy best-time key is imported once.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), ES modules

**Primary Dependencies**: existing only (Three.js, Vite, vite-plugin-pwa). No new runtime dependency. One new dev dependency, `vitest`, for unit tests (no bundle impact)

**Storage**: Browser `localStorage`, single JSON key `lowrally.leaderboard.v1`; in-memory fallback when unavailable

**Testing**: Vitest unit tests for the model and storage; manual run-through per [quickstart.md](quickstart.md) for UI

**Target Platform**: Mobile and desktop browsers, installed PWA, offline

**Project Type**: Single-project browser game (PWA)

**Performance Goals**: 60 fps maintained; zero per-frame allocation added; storage write happens at most once per finished stage

**Constraints**: Offline-capable; must not throw when storage is blocked/full/corrupt; no external assets; tiny payload (<1 KB)

**Scale/Scope**: 10 entries, one track, one device

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Mobile-first, installable PWA | PASS | Panel is touch-sized, works offline, no network. Reachable from start screen and finish banner |
| II. Everything generated in code | PASS | No assets; UI is DOM + CSS using palette variables |
| III. Performance budget | PASS | Writes only on stage finish; panel renders only on open; model code is outside the hot loop. `Stage.update` gains no allocation |
| IV. Deterministic single source of truth | PASS | Leaderboard is the sole authority for "best time"; HUD and banner derive from it instead of a second copy |
| V. Simple arcade model | PASS | No new dependencies at runtime; smallest design that meets the spec |
| VI. Design patterns | PASS | See Architecture Design Review below |

**Post-design re-check (after Phase 1)**: all PASS. The one dev dependency (`vitest`) is justified in [research.md](research.md) and adds nothing to the shipped bundle.

## Architecture Design Review

Patterns are from *Design Patterns* (GoF), adapted to idiomatic TypeScript (Principle VI).

### Adopted

| Pattern | Category | Where | Problem it solves |
|---------|----------|-------|-------------------|
| Strategy | Behavioral | `LeaderboardStore` interface with `LocalStorageStore` and `MemoryStore` | Persistence must be swappable at runtime (blocked storage, tests) without the model knowing |
| Factory Method | Creational | `createStore()` | Chooses the store by probing availability once at startup, hiding that decision from callers |
| Adapter | Structural | `LocalStorageStore` | Adapts the string-key `Storage` API and the versioned JSON format to the typed `LeaderboardStore` interface |
| Facade | Structural | `Leaderboard` class | Gives `Stage` and the UI one small surface (`submit`, `entries`, `best`, `clear`) over ranking, validation, migration and persistence |

### Considered and discarded

| Pattern | Problem weighed against | Why discarded |
|---------|-------------------------|---------------|
| Observer (event bus / subscriptions) | Notify HUD and panel when entries change | Only two consumers, and both already poll or render on demand (HUD at 10 Hz, panel on open). A subscription list adds indirection and closure allocation for no benefit (Principles III, V) |
| Singleton | Global access to the leaderboard | Hidden global state hurts testing. A single instance is created in `main.ts` and passed in, which gives the same effect without the pattern |
| Repository | Abstracting entry persistence | Redundant with the Strategy store for one collection; a second layer would be pure ceremony (Principle V) |
| Memento / Command (undo for "clear") | Recover from accidental clear | Confirmation dialog (FR-013) already prevents it; undo history is out of scope |
| Object Pool | Reuse entry objects | Entries are created once per stage, not per frame, so pooling gains nothing (Principle III is not at risk) |
| Decorator (validation/migration wrappers around the store) | Layering validation | Validation is a pure function called once on load; wrapping stores in decorators adds classes without reuse |

## Project Structure

### Documentation (this feature)

```text
specs/001-persist-leaderboard/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── storage-format.md
│   └── leaderboard-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── config.ts                    # + LEADERBOARD constants (key, size); BEST_TIME_KEY kept for migration
├── stage.ts                     # takes a Leaderboard; best time derived from it; submits on finish
├── main.ts                      # create store + leaderboard, wire panel and finish banner
├── leaderboard/
│   ├── leaderboard.ts           # pure model: validate, rank, trim, migrate (Facade)
│   ├── store.ts                 # LeaderboardStore, LocalStorageStore, MemoryStore, createStore()
│   └── leaderboard.test.ts      # Vitest
└── ui/
    └── leaderboardView.ts       # DOM panel; renders on open only

index.html                       # panel markup + buttons (start screen, finish banner)
src/style.css                    # panel styles using existing palette variables
```

**Structure Decision**: Extend the existing single-project layout. Leaderboard logic gets its own
`src/leaderboard/` folder, mirroring how `world/`, `car/` and `input/` group a concern, and the
view sits beside the other UI modules in `src/ui/`.

## Complexity Tracking

No constitution violations. One justified addition: the `vitest` dev dependency (see research.md).
