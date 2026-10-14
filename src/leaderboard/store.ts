import { LEADERBOARD } from '../config';

/**
 * Persistence strategy for the leaderboard. Implementations deal in the raw serialised string
 * and MUST NOT throw: storage problems must never reach the game.
 */
export interface LeaderboardStore {
  /** Raw stored value, or null if absent or unreadable. */
  load(): string | null;
  save(raw: string): void;
}

/** Session-only fallback used when browser storage is unavailable (and in tests). */
export class MemoryStore implements LeaderboardStore {
  private raw: string | null = null;

  load(): string | null {
    return this.raw;
  }

  save(raw: string): void {
    this.raw = raw;
  }
}

/** Adapts the string-keyed `localStorage` API to `LeaderboardStore`. */
export class LocalStorageStore implements LeaderboardStore {
  load(): string | null {
    try {
      return localStorage.getItem(LEADERBOARD.key);
    } catch {
      return null; // storage blocked (private mode etc.)
    }
  }

  save(raw: string): void {
    try {
      localStorage.setItem(LEADERBOARD.key, raw);
    } catch {
      /* quota exceeded or blocked: the in-memory board still works this session */
    }
  }
}

/** Factory: use `localStorage` if it is actually usable, otherwise fall back to memory. */
export function createStore(): LeaderboardStore {
  try {
    const probe = `${LEADERBOARD.key}.probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return new LocalStorageStore();
  } catch {
    return new MemoryStore();
  }
}
