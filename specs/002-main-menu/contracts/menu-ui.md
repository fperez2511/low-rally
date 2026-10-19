# Contract: Menu UI

The menu is a single modal dialog (`#menu`, `role="dialog"`, `aria-modal="true"`) above the game and HUD and below the leaderboard dialog.

## Entry points

| Trigger | Condition | Result |
|---------|-----------|--------|
| Page load | always | Menu open in `title` mode |
| HUD Menu button (`#hud-menu`) | flow `playing` | Pause, open in `paused` mode |
| `Escape` | flow `playing` | Pause, open in `paused` mode |
| `Escape` | flow `paused`, main view | Resume |
| `Escape` | confirm or About view | Back to main view |
| `Escape` | leaderboard open | Leaderboard closes only (menu stays) |
| Page hidden (`visibilitychange`) | flow `playing` | Pause, open in `paused` mode |
| `R` | flow `playing`, `stage.state === 'running'` | Pause, open on the restart-confirm view |
| `R` | flow `playing`, stage `armed` or `finished` | Restart immediately |
| `R` | any other flow state | Ignored |

## Main view options

| Option | `title` mode | `paused` mode | Action |
|--------|--------------|---------------|--------|
| Start | shown, focused | hidden | `title` to `playing`; unlocks audio |
| Resume | hidden | shown, focused | `paused` to `playing` |
| Restart | hidden | shown | If `needsRestartConfirm`: show confirm view. Otherwise restart and resume |
| Sound: On/Off | shown | shown | Toggles and persists; button reflects state (`aria-pressed`) |
| Leaderboard | shown | shown | Opens the existing leaderboard dialog; closing returns here |
| About | shown | shown | Shows the About view |

## Restart-confirm view

Text "Restart?" with **Yes** (restart and resume) and **No** (back to the main view; run still paused and untouched). Focus starts on **No**.

## About view

Shows:

- Game name
- "By Fabricio Perez"
- "Version <VERSION>" where the value is the `VERSION` constant from the game's config
- **Close** button returning to the main view

## Rules

- Taps outside the card do nothing (they never start or resume the game).
- All controls are at least 44 px tall and reachable in portrait and landscape; the card scrolls if the viewport is too short.
- While the menu is open, steering zones and the brake button receive no touches (overlay sits above them) and any held input has been released.
- The Menu button replaces the former Restart button in the same HUD position; no other Restart button exists.
