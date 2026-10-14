# Data Model: Persistent Leaderboard

## LeaderboardEntry

| Field | Type | Rules |
|-------|------|-------|
| `time` | number (seconds) | Finite and > 0. Entries failing this are discarded on load and rejected on submit |
| `date` | number (epoch ms) or `null` | `null` only for an entry imported from the legacy best time |

Rank is **derived** from position, not stored.

## Leaderboard

An ordered list of at most `LEADERBOARD.size` (10) entries.

**Ordering**: `time` ascending; on equal times the earlier `date` ranks first (`null` dates rank
first, as they are the oldest data).

**Operations**

- `submit(time, now)` returns the new entry's 1-based rank, or `null` if it did not qualify
  (invalid time, or full and not faster than the slowest). Inserts, re-sorts, trims to size, persists.
- `best()` returns the top entry's time or `null`.
- `entries()` returns a read-only view for rendering.
- `clear()` empties the list and persists the empty state.

## Persisted record

See [contracts/storage-format.md](contracts/storage-format.md).

## State transitions

```
load → [new key present?]
        ├─ yes → parse + validate entries → in-memory list
        └─ no  → [legacy best valid?]
                   ├─ yes → seed list with it, write new key
                   └─ no  → empty list
stage finished → submit → (qualifies) → persist
clear → empty list → persist
```
