import { SETTINGS } from './config';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Player settings (currently just sound), persisted as `{ v, sound }` under SETTINGS.key.
 * Adapts the string-keyed Storage API; storage problems never reach the game, the value
 * simply lives in memory for the session.
 */
export class Settings {
  private sound = true;

  constructor(private readonly storage: Store | null) {
    this.sound = this.read();
  }

  get soundOn(): boolean {
    return this.sound;
  }

  setSoundOn(on: boolean): void {
    this.sound = on;
    try {
      this.storage?.setItem(SETTINGS.key, JSON.stringify({ v: SETTINGS.schemaVersion, sound: on }));
    } catch {
      /* blocked or full: keep the in-memory value */
    }
  }

  private read(): boolean {
    try {
      const raw = this.storage?.getItem(SETTINGS.key);
      if (!raw) return true;
      const data: unknown = JSON.parse(raw);
      if (typeof data === 'object' && data !== null) {
        const d = data as { v?: unknown; sound?: unknown };
        if (d.v === SETTINGS.schemaVersion && typeof d.sound === 'boolean') return d.sound;
      }
    } catch {
      /* unreadable: fall through to the default */
    }
    return true;
  }
}

export function createSettings(): Settings {
  try {
    return new Settings(window.localStorage);
  } catch {
    return new Settings(null);
  }
}
