import { LEADERBOARD } from '../config';
import type { LeaderboardStore } from './store';

export interface LeaderboardEntry {
  /** Stage time in seconds; always finite and > 0. */
  readonly time: number;
  /** Completion date (epoch ms), or null for an entry imported from the legacy best time. */
  readonly date: number | null;
}

/**
 * Facade over ranking, validation and persistence: the rest of the game only sees
 * `submit`, `best`, `entries` and `clear`. Pure logic, no DOM; storage problems are
 * absorbed by the store and never thrown. Not used from the per-frame path.
 */
export class Leaderboard {
  private list: readonly LeaderboardEntry[];

  constructor(
    private readonly store: LeaderboardStore,
    legacyBest: () => number | null,
  ) {
    const raw = this.read();
    this.list = parse(raw);
    // Import the pre-leaderboard best time exactly once: only while the new key is absent.
    // The legacy key itself is never touched, so rolling back to an older build still works.
    if (raw === null) {
      const legacy = legacyBest();
      if (isValidTime(legacy)) {
        this.list = [{ time: legacy, date: null }];
        this.persist();
      }
    }
  }

  /** Records a finished run. Returns its 1-based rank, or null if it was not recorded. */
  submit(time: number, now: number = Date.now()): number | null {
    // Re-read first so a run saved by another tab is merged rather than overwritten.
    this.list = this.merged();
    if (!isValidTime(time)) return null;

    const entry: LeaderboardEntry = { time, date: now };
    const next = trim(sort([...this.list, entry]));
    const rank = next.indexOf(entry) + 1;
    if (rank === 0) return null;

    this.list = next;
    this.persist();
    return rank;
  }

  best(): number | null {
    return this.list.length > 0 ? this.list[0].time : null;
  }

  entries(): readonly LeaderboardEntry[] {
    return this.list;
  }

  clear(): void {
    this.list = [];
    this.persist();
  }

  /** Union of what is in memory and what is currently stored, de-duplicated. */
  private merged(): readonly LeaderboardEntry[] {
    const seen = new Set<string>();
    const out: LeaderboardEntry[] = [];
    for (const e of [...this.list, ...parse(this.read())]) {
      const k = `${e.time}|${e.date}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return trim(sort(out));
  }

  private persist(): void {
    try {
      this.store.save(JSON.stringify({ v: LEADERBOARD.schemaVersion, entries: this.list }));
    } catch {
      /* the store contract says it will not throw; guard anyway so the game never sees it */
    }
  }

  private read(): string | null {
    try {
      return this.store.load();
    } catch {
      return null;
    }
  }
}

function isValidTime(t: unknown): t is number {
  return typeof t === 'number' && Number.isFinite(t) && t > 0;
}

/** Defensive parse: anything unexpected yields fewer (or zero) entries, never an exception. */
function parse(raw: string | null): readonly LeaderboardEntry[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof data !== 'object' || data === null) return [];
  const { v, entries } = data as { v?: unknown; entries?: unknown };
  if (v !== LEADERBOARD.schemaVersion || !Array.isArray(entries)) return [];

  const out: LeaderboardEntry[] = [];
  for (const item of entries) {
    if (typeof item !== 'object' || item === null) continue;
    const { time, date } = item as { time?: unknown; date?: unknown };
    if (!isValidTime(time)) continue;
    if (date !== null && !(typeof date === 'number' && Number.isFinite(date))) continue;
    out.push({ time, date });
  }
  return trim(sort(out));
}

/** Fastest first; on equal times the earlier run wins (undated imports count as oldest). */
function sort(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return list.sort((a, b) => a.time - b.time || (a.date ?? -Infinity) - (b.date ?? -Infinity));
}

function trim(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return list.length > LEADERBOARD.size ? list.slice(0, LEADERBOARD.size) : list;
}
