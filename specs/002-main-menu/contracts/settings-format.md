# Contract: Settings Storage Format

**Key**: `lowrally.settings.v1` in `localStorage`

```json
{ "v": 1, "sound": true }
```

| Field | Type | Rule |
|-------|------|------|
| `v` | number | Schema version, currently `1`. A different value is treated as absent |
| `sound` | boolean | Anything other than `true`/`false` is treated as absent (default `true`) |

## Behaviour

- Read once at startup; written on every sound toggle.
- Missing, unparseable or invalid data resolves to defaults without an error.
- If `localStorage` throws on read or write (private mode, blocked, quota), the value is kept in memory for the session and no error reaches the player.
- The key is independent of `lowrally.leaderboard.v1` and `lowrally.best.v1`; clearing the leaderboard does not touch it.
