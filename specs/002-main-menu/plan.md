# Implementation Plan: Main Menu

**Branch**: `002-main-menu` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-main-menu/spec.md`

## Summary

Replace the "tap anywhere" start overlay and the in-run Restart button with one modal menu. Before the
first run it offers Start; during a run a HUD Menu button (and Escape, and tab-hidden) opens it and
**freezes the simulation** by simply not stepping it, so run time stays correct without any bookkeeping.
It also offers Resume, Restart (with a confirmation while a run is in progress), a persisted Sound
toggle, Leaderboard, and an About card with the author's name and the version set in the config.
Touch steering zones shrink from 50% to 33% of the screen width each. A tiny pure `GameFlow` state
machine owns title/playing/paused so the rules are unit-testable; the DOM menu, settings and audio are
thin layers around it. Nothing new runs per frame except one state check.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), ES modules

**Primary Dependencies**: existing only (Three.js, Vite, vite-plugin-pwa, Vitest). No new dependency

**Storage**: Browser `localStorage`, one JSON key `lowrally.settings.v1` for the sound preference; in-memory fallback when unavailable

**Testing**: Vitest unit tests for `GameFlow` and `Settings`; manual run-through per [quickstart.md](quickstart.md) for UI, touch layout and audio

**Target Platform**: Mobile and desktop browsers, installed PWA, offline

**Project Type**: Single-project browser game (PWA)

**Performance Goals**: 60 fps maintained; zero per-frame allocation added; menu DOM touched only on open/close/click; pausing reduces CPU use

**Constraints**: Offline-capable; storage failures never throw; no external assets; audio starts only after a user gesture; menu usable on small phones in portrait and landscape

**Scale/Scope**: 1 modal with 3 views (main, restart confirmation, About), 1 setting, 1 build-time constant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Mobile-first, installable PWA | PASS | Menu button and options are 44 px touch targets; touch zones are narrowed; menu works offline; layout checked in portrait and landscape. The version is a plain config constant, so no network or build tooling is needed |
| II. Everything generated in code | PASS | DOM + CSS using palette variables; no assets |
| III. Performance budget | PASS | Pause = skip the sim step (one branch per frame, no allocation). Menu DOM written only on user actions. `audio.update` returns early when muted. No per-frame DOM writes added |
| IV. Deterministic single source of truth | PASS | `GameFlow` is the single authority on "is the sim stepping"; the fixed timestep is untouched. Run time is `Stage.time`, which only advances inside the sim step, so pause time cannot leak into it |
| V. Simple arcade model | PASS | No dependencies. README "Next steps" lists "Menus: stage select, car select, settings, pause"; this spec is the required go-ahead for **pause and the sound setting only**. Stage and car select stay unbuilt and README is updated accordingly |
| VI. Design patterns | PASS | See Architecture Design Review below |

Technical-constraint checks: input sources still implement `InputSource` (the interface gains one required method, `release()`); persistent state is `localStorage` only and degrades gracefully; audio still unlocks on a user gesture (Start button); `window.__game` stays dev-only.

**Post-design re-check (after Phase 1)**: all PASS.

## Architecture Design Review

Patterns are from *Design Patterns* (GoF), adapted to idiomatic TypeScript (Principle VI).

### Adopted

| Pattern | Category | Where | Problem it solves |
|---------|----------|-------|-------------------|
| State | Behavioral | `GameFlow` (`title` / `playing` / `paused`) | Which actions are legal and what the menu offers (Start vs Resume/Restart) depends on the mode; a small state machine with explicit transitions replaces scattered booleans (`started`, menu open, etc.) |
| Command | Behavioral | `MenuActions` object passed to `MenuView` | The view raises named intents (`start`, `resume`, `restart`, `toggleSound`, `openLeaderboard`) and knows nothing about the game, renderer or audio; `main.ts` binds them |
| Adapter | Structural | `Settings` over `localStorage` (with in-memory fallback) | Adapts the string-keyed `Storage` API and the versioned JSON to a typed `soundOn` property, never throwing (same approach as `LocalStorageStore` in 001) |
| Facade | Structural | `MenuView` | One small surface (`openTitle`, `openPaused`, `close`, `isOpen`) over three internal views, focus handling and the About card |

### Considered and discarded

| Pattern | Problem weighed against | Why discarded |
|---------|-------------------------|---------------|
| Observer | Notify audio and menu when the sound setting changes | One consumer each, both called from the same click handler in `main.ts`. A subscription list adds indirection for no gain (Principles III, V) |
| Singleton | Global access to settings | Hidden global state hurts testing; one instance is created in `main.ts` and passed in |
| Memento | Snapshot game state on pause so Resume can restore it | Pausing only stops stepping, so there is nothing to snapshot; restoring would add allocation and bug surface |
| Mediator (as a class) | Coordinating menu, flow, stage, audio, inputs | `main.ts` already composes these; a Mediator class would just move the same wiring into another file (Principle V) |
| Strategy for restart confirmation policy | Swap "always / never / after N seconds" | Spec fixes one rule (confirm only while the timer is running); a policy interface would be speculative |
| Template Method / Decorator for menu views | Share structure between main, confirm and About views | Three tiny views with different content; a base class costs more than the duplication it removes |

## Project Structure

### Documentation (this feature)

```text
specs/002-main-menu/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── menu-ui.md
│   └── settings-format.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── config.ts                 # + AUTHOR, VERSION, SETTINGS (key, schemaVersion)
├── settings.ts               # NEW: Settings (sound preference), persisted, never throws
├── settings.test.ts          # NEW: Vitest
├── game/
│   ├── flow.ts               # NEW: GameFlow state machine + needsRestartConfirm()
│   └── flow.test.ts          # NEW: Vitest
├── audio.ts                  # + setMuted(); update() early-returns while muted
├── input/
│   ├── types.ts              # InputSource gains release()
│   ├── keyboard.ts           # release(): clear held keys
│   └── touch.ts              # release(): clear pointers + highlights
├── ui/
│   ├── menu.ts               # NEW: MenuView (main / restart-confirm / About), focus + Escape handling
│   ├── hud.ts                # Restart button becomes Menu button (onMenu callback)
│   └── startScreen.ts        # DELETED: replaced by the menu's title mode
└── main.ts                   # owns GameFlow; skips sim step unless playing; wires menu, R, Escape, visibilitychange

index.html                    # #start overlay -> #menu markup; #hud-restart -> #hud-menu
src/style.css                 # menu card styles; .zone width 33.333%
README.md                     # controls + "How it works" + trim "Next steps" (menus/pause/settings)
```

**Structure Decision**: Extend the existing single-project layout. The pure, DOM-free flow logic lives in a new `src/game/` folder so it can be unit-tested like `src/leaderboard/`; the DOM view sits with the other UI modules; settings is a single small file because it has one value.

## Complexity Tracking

No constitution violations. No new dependencies.
