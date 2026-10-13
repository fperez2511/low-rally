# Feature Specification: Persistent Leaderboard

**Feature Branch**: `001-persist-leaderboard`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "create a new feature to persist a leaderboard using local cache"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Finished runs are remembered (Priority: P1)

A player finishes a lap. Their time is saved on their device automatically, so it is still
there after closing the game, refreshing, or going offline and coming back later.

**Why this priority**: Without saving runs there is no leaderboard. Today only a single best
time is kept; this is the foundation every other story builds on.

**Independent Test**: Finish three laps with different times, close and reopen the game, and
confirm all three times are still recorded.

**Acceptance Scenarios**:

1. **Given** a player finishes a lap, **When** the stage ends, **Then** the lap time is added to the leaderboard without any extra action from the player.
2. **Given** the leaderboard contains saved times, **When** the player closes and reopens the game (including while offline), **Then** the same times are still present.
3. **Given** the leaderboard already holds the maximum number of entries, **When** a new time is faster than the slowest entry, **Then** the new time is added and the slowest is dropped.
4. **Given** the leaderboard is full, **When** a new time is slower than every entry, **Then** the leaderboard is unchanged.

---

### User Story 2 - View the leaderboard (Priority: P2)

A player can open a leaderboard showing their fastest runs, ranked from fastest to slowest, with
the date of each run. The run they just completed is highlighted if it made the list.

**Why this priority**: Saved data only has value once the player can see and compare it, but the
game is still playable and the data is still safe without this view.

**Independent Test**: With several saved times, open the leaderboard and confirm they appear in
ascending order with dates, and that a just-finished run that qualifies is highlighted.

**Acceptance Scenarios**:

1. **Given** saved times exist, **When** the player opens the leaderboard, **Then** entries are listed fastest first, each showing rank, time and date.
2. **Given** a player just finished a lap that made the leaderboard, **When** the results are shown, **Then** that entry is visibly highlighted and its rank is stated.
3. **Given** no times have been saved, **When** the player opens the leaderboard, **Then** a clear empty state invites them to drive a lap.

---

### User Story 3 - Existing best time carries over (Priority: P3)

A player who already has a best time from the current version of the game keeps it: it appears
on the leaderboard as their first entry rather than being lost.

**Why this priority**: Protects existing players' progress; matters only for returning players.

**Independent Test**: Start with only a legacy best time stored, open the game, and confirm that time appears on the leaderboard and that the displayed best time is unchanged.

**Acceptance Scenarios**:

1. **Given** a player has a previously saved best time and no leaderboard, **When** the game loads, **Then** that time appears as a leaderboard entry and the best time shown is unchanged.

---

### Edge Cases

- Storage is unavailable or blocked (e.g. private browsing): the game MUST remain fully playable, with the leaderboard living only for the current session and no error shown mid-run.
- Storage is full: saving fails silently for the player; the current session's board still updates.
- Saved data is corrupted or in an unexpected shape: invalid entries are discarded, valid ones kept, and the game never crashes.
- Two runs finish with identical times: both are kept; the earlier run ranks first.
- A time of zero, negative, or not-a-number is never recorded.
- The player clears browser data: the leaderboard is empty, which is expected and not an error.
- Multiple tabs of the game are open: a time saved in one is not lost when the other saves its own.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record the completion time of every finished stage as a leaderboard candidate automatically.
- **FR-002**: System MUST keep the fastest 10 runs and discard slower ones.
- **FR-003**: System MUST store the leaderboard on the player's device so it survives closing, reloading and offline use.
- **FR-004**: System MUST work without any network connection or account.
- **FR-005**: System MUST rank entries by time ascending, with earlier runs ranking ahead on ties.
- **FR-006**: Each entry MUST record the lap time and the date the run was completed.
- **FR-007**: Players MUST be able to view the leaderboard from the game's start/results screens.
- **FR-008**: System MUST highlight the player's just-completed run and show its rank when it makes the leaderboard.
- **FR-009**: System MUST show an empty-state message when there are no entries.
- **FR-010**: System MUST reject invalid times (zero, negative, non-numeric) and discard malformed stored entries without failing.
- **FR-011**: System MUST keep the game fully playable when storage is unavailable, holding the leaderboard in memory for the session.
- **FR-012**: System MUST import an existing saved best time as a leaderboard entry exactly once, and keep the displayed best time consistent with the top entry.
- **FR-013**: Players MUST be able to clear the leaderboard, after an explicit confirmation.
- **FR-014**: Saving and displaying the leaderboard MUST NOT cause any perceptible hitch or frame-rate drop while driving.

### Key Entities

- **Leaderboard Entry**: One completed run. Attributes: lap time, completion date, and rank (derived from time).
- **Leaderboard**: The ordered collection of the fastest entries (up to 10) for the player's device. Owned by a single player on a single device; not shared.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of finished laps that qualify appear on the leaderboard immediately after the stage ends, with no extra player action.
- **SC-002**: After closing and reopening the game (online or offline), 100% of previously saved entries are present and in the correct order.
- **SC-003**: A player can open the leaderboard and see their ranked times within 2 taps/clicks from the start or results screen.
- **SC-004**: Existing players lose no progress: 100% of previously saved best times appear in the leaderboard after the update.
- **SC-005**: With storage unavailable, 100% of laps still complete and display results without errors.
- **SC-006**: Driving frame rate is unaffected: no visible stutter in the 5 seconds around saving or opening the leaderboard on a mid-range phone.

## Assumptions

- The leaderboard is personal and per-device: no accounts, sharing, or online/global rankings (out of scope).
- Entries have no player names; time and date identify a run. Names can be added later.
- The leaderboard holds a single track, since the stage is one seeded lap; per-track boards are out of scope.
- Top 10 is a sensible default size that fits a phone screen.
- Clearing browser data or switching devices legitimately resets the leaderboard; syncing across devices is out of scope.
- Dates are shown in the player's local format.
