# Contract: Stored Leaderboard Format

**Key**: `lowrally.leaderboard.v1` (in `localStorage`)

**Value**: JSON string

```json
{
  "v": 1,
  "entries": [
    { "time": 62.35, "date": 1791926400000 },
    { "time": 64.1, "date": null }
  ]
}
```

## Rules

- `v` is the schema version. Unknown or missing `v` is treated as corrupt (the board starts empty).
- `entries` is already sorted and trimmed when written, but readers MUST NOT rely on it: they
  re-validate, re-sort and re-trim.
- Each entry needs a finite `time` > 0; `date` is a finite number or `null`. Entries failing this
  are dropped individually; valid siblings are kept.
- Writers MUST read-merge-write so concurrent tabs do not discard each other's runs.
- A future format change MUST use a new key (`...v2`) and import from `v1`, as `v1` did from
  `lowrally.best.v1`.

## Legacy key (read-only)

`lowrally.best.v1`: a decimal string of seconds. Read once for migration, never modified or deleted.
