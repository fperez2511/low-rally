# Data Model: Main Menu

## GameFlow (in memory)

Pure state machine in `src/game/flow.ts`; no DOM, no timers.

| State | Meaning | Sim stepping | Menu |
|-------|---------|--------------|------|
| `title` | Page loaded, first run not started | No | Open, offers Start |
| `playing` | A run is being driven | Yes | Closed |
| `paused` | Menu opened over a run | No | Open, offers Resume / Restart |

### Transitions

| From | Action | To | Notes |
|------|--------|----|-------|
| `title` | `start()` | `playing` | Caller unlocks audio and shows the HUD |
| `playing` | `pause()` | `paused` | Triggered by the Menu button, Escape, `R` needing confirmation, or the page being hidden. Caller releases held inputs |
| `paused` | `resume()` | `playing` | |
| `paused` | `restart()` | `playing` | Caller resets car, camera, stage first; allowed only after confirmation when `needsRestartConfirm` is true |
| any other combination | any | unchanged | Illegal transitions are ignored (e.g. rapid double taps) |

`needsRestartConfirm(stageState: StageState): boolean` returns `true` only for `'running'`.

## Settings (persisted)

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `soundOn` | boolean | `true` | Changed from the menu; written immediately; any invalid stored value falls back to the default |

Stored shape and failure behaviour: see [contracts/settings-format.md](contracts/settings-format.md).

## VersionInfo (config constants)

| Field | Source | Notes |
|-------|--------|-------|
| `author` | `AUTHOR` in `src/config.ts` | "Fabricio Perez" |
| `version` | `VERSION` in `src/config.ts` | Author-maintained string, edited by hand like any other constant (initially `"0.0.2"`) |

## Relationships

- `main.ts` owns one `GameFlow`, one `Settings`, one `MenuView`.
- Sim stepping: `flow.state === 'playing'`.
- Audio muted: `!settings.soundOn || flow.state !== 'playing'`.
- Run time: `Stage.time`, unchanged; it advances only inside the sim step, so paused time is never counted.
