# Contract: Leaderboard Module Interface

Internal TypeScript contract between `Stage`, the UI and the leaderboard module.

```ts
interface LeaderboardEntry { readonly time: number; readonly date: number | null }

interface LeaderboardStore {
  load(): string | null;          // raw stored value, null if absent or unreadable
  save(raw: string): void;        // MUST NOT throw
}

class Leaderboard {
  constructor(store: LeaderboardStore, legacyBest: () => number | null);
  submit(time: number, now?: number): number | null; // 1-based rank, or null if not recorded
  best(): number | null;
  entries(): readonly LeaderboardEntry[];
  clear(): void;
}

function createStore(): LeaderboardStore; // LocalStorageStore if usable, else MemoryStore
```

## Behavioural guarantees

- No method throws because of storage problems.
- `submit` performs at most one `save`; `entries()` and `best()` never touch storage.
- `entries()` returns a stable array reference between mutations (no allocation per call), so
  callers on a timer can use it freely.
- Not used from the per-frame simulation path; `Stage` calls `submit` only on the transition to
  `finished`.
