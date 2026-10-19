import { describe, expect, it } from 'vitest';
import { SETTINGS } from './config';
import { Settings } from './settings';

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SETTINGS.key, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('Settings', () => {
  it('defaults sound to on', () => {
    expect(new Settings(fakeStorage()).soundOn).toBe(true);
  });

  it('persists the sound choice across instances', () => {
    const s = fakeStorage();
    new Settings(s).setSoundOn(false);
    expect(new Settings(s).soundOn).toBe(false);
    new Settings(s).setSoundOn(true);
    expect(new Settings(s).soundOn).toBe(true);
  });

  it('falls back to on for invalid stored data', () => {
    for (const raw of ['{"v":1,"sound":"yes"}', '{"v":2,"sound":false}', '{nope', '{"sound":false}', 'null']) {
      expect(new Settings(fakeStorage(raw)).soundOn).toBe(true);
    }
  });

  it('never throws when storage throws, and keeps the value for the session', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const s = new Settings(bad);
    expect(s.soundOn).toBe(true);
    expect(() => s.setSoundOn(false)).not.toThrow();
    expect(s.soundOn).toBe(false);
  });

  it('works with no storage at all', () => {
    const s = new Settings(null);
    s.setSoundOn(false);
    expect(s.soundOn).toBe(false);
  });
});
