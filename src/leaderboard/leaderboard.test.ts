import { describe, expect, it } from 'vitest';
import { LEADERBOARD } from '../config';
import { Leaderboard } from './leaderboard';
import { MemoryStore, type LeaderboardStore } from './store';

const noLegacy = (): number | null => null;
const make = (store: LeaderboardStore = new MemoryStore()): Leaderboard => new Leaderboard(store, noLegacy);
const times = (b: Leaderboard): number[] => b.entries().map((e) => e.time);

describe('ranking', () => {
  it('returns a 1-based rank and keeps the list ascending', () => {
    const b = make();
    expect(b.submit(60, 1)).toBe(1);
    expect(b.submit(50, 2)).toBe(1);
    expect(b.submit(55, 3)).toBe(2);
    expect(times(b)).toEqual([50, 55, 60]);
  });

  it('ranks the earlier run first on equal times', () => {
    const b = make();
    b.submit(50, 1);
    expect(b.submit(50, 2)).toBe(2);
    expect(b.entries().map((e) => e.date)).toEqual([1, 2]);
  });

  it('trims to the board size and drops the slowest', () => {
    const b = make();
    for (let i = 0; i < LEADERBOARD.size; i++) b.submit(100 + i, i);
    expect(b.submit(90, 99)).toBe(1);
    expect(b.entries()).toHaveLength(LEADERBOARD.size);
    expect(b.entries()[LEADERBOARD.size - 1].time).toBe(108);
  });

  it('ignores a time slower than every entry on a full board', () => {
    const b = make();
    for (let i = 0; i < LEADERBOARD.size; i++) b.submit(100 + i, i);
    const before = times(b);
    expect(b.submit(500, 99)).toBeNull();
    expect(times(b)).toEqual(before);
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('rejects invalid time %s', (t) => {
    const b = make();
    expect(b.submit(t)).toBeNull();
    expect(b.entries()).toHaveLength(0);
  });

  it('best() is null when empty and the fastest time otherwise', () => {
    const b = make();
    expect(b.best()).toBeNull();
    b.submit(70, 1);
    b.submit(65, 2);
    expect(b.best()).toBe(65);
  });

  it('clear() empties the board', () => {
    const b = make();
    b.submit(70, 1);
    b.clear();
    expect(b.entries()).toHaveLength(0);
    expect(b.best()).toBeNull();
  });

  it('keeps a stable entries() reference between mutations', () => {
    const b = make();
    b.submit(70, 1);
    expect(b.entries()).toBe(b.entries());
  });
});

describe('persistence', () => {
  it('survives creating a new Leaderboard over the same store', () => {
    const store = new MemoryStore();
    const a = make(store);
    a.submit(70, 1);
    a.submit(60, 2);
    expect(times(make(store))).toEqual([60, 70]);
  });

  it('starts empty on corrupt JSON', () => {
    const store = new MemoryStore();
    store.save('{not json');
    expect(make(store).entries()).toHaveLength(0);
  });

  it('starts empty on a wrong schema version', () => {
    const store = new MemoryStore();
    store.save(JSON.stringify({ v: 99, entries: [{ time: 50, date: 1 }] }));
    expect(make(store).entries()).toHaveLength(0);
  });

  it('drops invalid entries individually and keeps valid siblings', () => {
    const store = new MemoryStore();
    store.save(
      JSON.stringify({
        v: LEADERBOARD.schemaVersion,
        entries: [{ time: -1, date: 1 }, 'x', null, { time: 'a' }, { time: 60, date: null }, { time: 55, date: 5 }],
      }),
    );
    expect(times(make(store))).toEqual([55, 60]);
  });

  it('re-sorts and re-trims whatever is stored', () => {
    const store = new MemoryStore();
    const entries = Array.from({ length: LEADERBOARD.size + 5 }, (_, i) => ({ time: 200 - i, date: i }));
    store.save(JSON.stringify({ v: LEADERBOARD.schemaVersion, entries }));
    const b = make(store);
    expect(b.entries()).toHaveLength(LEADERBOARD.size);
    expect(b.best()).toBe(200 - (LEADERBOARD.size + 4));
  });

  it('never throws when the store fails to save', () => {
    const broken: LeaderboardStore = {
      load: () => null,
      save: () => {
        throw new Error('quota');
      },
    };
    const b = make(broken);
    expect(() => b.submit(60, 1)).not.toThrow();
    expect(times(b)).toEqual([60]);
  });

  it('merges entries written by another instance (read-merge-write)', () => {
    const store = new MemoryStore();
    const tabA = make(store);
    const tabB = make(store);
    tabA.submit(60, 1);
    tabB.submit(70, 2);
    expect(times(make(store))).toEqual([60, 70]);
  });
});

describe('legacy best time import', () => {
  const withLegacy = (v: number | null, store: LeaderboardStore = new MemoryStore()): Leaderboard =>
    new Leaderboard(store, () => v);

  it('imports a valid legacy best as an undated entry and writes the new format', () => {
    const store = new MemoryStore();
    const b = withLegacy(70.5, store);
    expect(b.entries()).toEqual([{ time: 70.5, date: null }]);
    expect(JSON.parse(store.load()!)).toEqual({ v: LEADERBOARD.schemaVersion, entries: [{ time: 70.5, date: null }] });
  });

  it('does not duplicate the import on a second load', () => {
    const store = new MemoryStore();
    withLegacy(70.5, store);
    expect(withLegacy(70.5, store).entries()).toHaveLength(1);
  });

  it.each([null, NaN, 0, -3, Infinity])('imports nothing for legacy value %s', (v) => {
    const store = new MemoryStore();
    expect(withLegacy(v, store).entries()).toHaveLength(0);
  });

  it('does not re-import after clear()', () => {
    const store = new MemoryStore();
    const b = withLegacy(70.5, store);
    b.clear();
    expect(withLegacy(70.5, store).entries()).toHaveLength(0);
  });

  it('ranks the imported entry among new runs and keeps best() consistent', () => {
    const b = withLegacy(70.5);
    expect(b.submit(80, 1)).toBe(2);
    expect(b.submit(60, 2)).toBe(1);
    expect(b.best()).toBe(60);
  });
});
