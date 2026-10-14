# Quickstart: Validating the Persistent Leaderboard

## Prerequisites

```bash
npm install
npm run dev     # http://localhost:5173
```

Unit tests (after tasks add Vitest): `npx vitest run`

## Scenarios

1. **Save and persist (US1)**: Drive and finish a lap. Reload the page. Open the leaderboard from
   the start screen. Expect the time to be listed. Repeat with 3 laps and confirm all appear,
   fastest first.
2. **Offline (US1, FR-004)**: Build and preview (`npm run build && npm run preview`), load once,
   switch the browser to offline, reload. Expect the same entries.
3. **Trimming (US1)**: Seed 10 entries via DevTools (`localStorage.setItem` per
   [storage-format.md](contracts/storage-format.md)), finish a faster lap, expect the slowest to drop;
   finish a slower lap, expect no change.
4. **Highlight (US2)**: Finish a qualifying lap, open the leaderboard from the finish banner.
   Expect that row highlighted with its rank.
5. **Empty state (US2)**: Clear site data, open the leaderboard. Expect the empty message.
6. **Legacy import (US3)**: Remove `lowrally.leaderboard.v1`, set `lowrally.best.v1` to `70.5`,
   reload. Expect one entry of 1:10.50 and an unchanged HUD best time. Reload again: still one entry.
7. **Blocked storage**: Open in a private window or block site data. Finish a lap. Expect no error,
   the board shows the run for the session.
8. **Corrupt data**: Set the key to `{"v":1,"entries":[{"time":-1},{"time":60,"date":null},"x"]}`.
   Reload. Expect a single 1:00.00 entry and no crash.
9. **Clear (FR-013)**: Use clear, cancel the confirmation (nothing changes), then confirm
   (board empties and stays empty after reload).
10. **Performance (SC-006)**: With DevTools Performance recording on a throttled mobile profile,
    finish a lap and open the panel. Expect no long task or dropped frames from the leaderboard.

## Done when

All scenarios behave as described, `npm run build` passes, and unit tests pass.
