# Research: Persistent Leaderboard

No `NEEDS CLARIFICATION` items remained in the Technical Context. The decisions below record the
choices that shaped the design.

## D1. Persistence mechanism

- **Decision**: `localStorage`, one JSON value under `lowrally.leaderboard.v1`.
- **Rationale**: Already used by the game for the best time; synchronous, tiny payload (<1 KB),
  works offline and in the installed PWA. The request explicitly asks for a local cache.
- **Alternatives considered**: IndexedDB (async, heavier, unnecessary for 10 numbers);
  Cache API / service worker cache (meant for network responses, not user data, and can be evicted
  with app assets); cookies (sent on requests, size-limited).

## D2. When to write

- **Decision**: Once, when a stage transitions to `finished` and the time qualifies.
- **Rationale**: Keeps the synchronous storage call out of the per-frame loop (Principle III). It
  happens at a moment where the player is already looking at the finish banner.
- **Alternatives considered**: Write every frame/HUD tick (wasteful, risks jank); write on page
  unload (unreliable on mobile).

## D3. Multi-tab safety

- **Decision**: On save, re-read storage, merge the new entry into what is stored, trim, then
  write (read-modify-write).
- **Rationale**: Prevents one tab overwriting another's runs (spec edge case). The window for a
  race is milliseconds and each tab only ever adds entries, so last-writer-wins loss is negligible.
- **Alternatives considered**: `storage` event syncing (needs the Observer pattern; see ADR);
  Web Locks (overkill, uneven mobile support).

## D4. Failure handling

- **Decision**: All storage access is wrapped; any failure falls back to `MemoryStore` for the
  session. Corrupt data is parsed defensively and bad entries dropped individually.
- **Rationale**: FR-010 and FR-011; matches the existing `try/catch` approach in `stage.ts`.
- **Alternatives considered**: Surfacing an error toast (disruptive mid-run, spec says silent).

## D5. Legacy best time

- **Decision**: If the new key is absent and `lowrally.best.v1` holds a valid number, seed the
  leaderboard with it (date unknown, shown as no date), write the new key, and leave the legacy key
  untouched.
- **Rationale**: Satisfies FR-012 and makes the migration idempotent: once the new key exists the
  import never runs again. Leaving the old key means a rollback to the previous version still
  shows the player's best.
- **Alternatives considered**: Deleting the old key (breaks rollback); importing every load
  (would resurrect entries after "clear").

## D6. Unit-test tooling

- **Decision**: Add `vitest` as a dev dependency.
- **Rationale**: The repo has no test runner. The model and store are pure and are where the edge
  cases live (ties, corruption, trimming, migration). Dev-only, so no bundle or offline-precache
  impact (Principle V justification).
- **Alternatives considered**: A bare `tsx` script with assertions (no watch mode or reporting);
  no automated tests (the spec's edge cases are exactly the kind that regress).

## D7. Entry point to the UI

- **Decision**: A "Leaderboard" button on the start screen and on the finish banner; one panel
  that closes back to wherever it was opened from.
- **Rationale**: SC-003 requires reaching it in at most 2 taps from start or results. The HUD is
  left uncluttered during driving.
- **Alternatives considered**: Permanent HUD button (distracts while driving, risks mis-taps).
