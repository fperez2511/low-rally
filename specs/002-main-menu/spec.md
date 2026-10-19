# Feature Specification: Main Menu

**Feature Branch**: `002-main-menu`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Introduce a main menu. The player can start or restart the game, pause and resume the game. Add another option called about and display a card with my name and the version (commit) of the repo. Add another option to turn sounds on/off. Reduce the tappable area for steering left and right to just the edges of the screen and perhaps a width of 33% of the screen because currently you see some white overlay on the 50% of the side of the screen where you tap. Once the game starts, replace the restart button with this new menu button."

## Clarifications

### Session 2026-10-18

- Q: Should choosing Restart from the in-run menu ask for confirmation before discarding the run? → A: Yes, always ask "Restart? Yes / No" first.
- Q: When a lap has already finished, should Restart skip the confirmation? → A: Yes, confirm only while a run is in progress.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the menu to pause, resume and restart (Priority: P1)

Once a run is under way, the on-screen Restart button is replaced by a Menu button. Opening the menu pauses the game and offers Resume and Restart. Resume returns the player to the exact moment they left; Restart begins a fresh run.

**Why this priority**: Pausing is the biggest gap today (the game cannot be interrupted), and the Menu button is the entry point for everything else in this feature.

**Independent Test**: Start a run, drive for a few seconds, open the menu, wait, choose Resume, and confirm the car and timer continue from where they stopped. Open the menu again and choose Restart; confirm a fresh run begins.

**Acceptance Scenarios**:

1. **Given** a run is in progress, **When** the player looks at the screen, **Then** a Menu button is shown where the Restart button used to be, and no separate Restart button is shown.
2. **Given** a run is in progress, **When** the player opens the menu, **Then** the game freezes (car, timer and scenery stop) and the menu shows Resume and Restart.
3. **Given** the menu is open over a paused run, **When** the player chooses Resume, **Then** the menu closes and the run continues with the timer and car state exactly as they were.
4. **Given** the menu is open, **When** the player chooses Restart, **Then** a confirmation asks "Restart? Yes / No"; choosing Yes closes the menu and starts a fresh run with the timer at zero, and choosing No returns to the menu with the run still paused and unchanged.
5. **Given** the menu is open, **When** the player waits a long time before resuming, **Then** the time spent paused is not counted in the run time.
6. **Given** the player is on a keyboard, **When** they press Escape during a run, **Then** the menu opens (or closes again if already open).

---

### User Story 2 - Start the game from the main menu (Priority: P2)

Before the first run, the player sees the main menu with a Start option (alongside About, Sound and Leaderboard) in place of the current "tap anywhere" start overlay. Choosing Start begins the first run.

**Why this priority**: It makes the menu the single, consistent front door of the game, but the game is already startable today, so it is secondary to pause/resume.

**Independent Test**: Load the game, confirm the main menu is shown with Start, choose Start, and confirm the run begins.

**Acceptance Scenarios**:

1. **Given** the game has just loaded, **When** the player sees the screen, **Then** the main menu is shown with Start, Sound, About and Leaderboard options.
2. **Given** the main menu is showing before the first run, **When** the player chooses Start, **Then** the menu closes and the run begins.
3. **Given** the run has not yet started, **When** the player taps outside the menu options, **Then** nothing starts accidentally.

---

### User Story 3 - Steer from the screen edges only (Priority: P2)

On a touch device, the left and right steering areas shrink from the full half of the screen to a strip along each edge, about one third of the screen width. The light overlay that currently tints half the screen while steering only covers that narrower strip, leaving the middle of the view clear.

**Why this priority**: It fixes a visible annoyance on the primary platform (phones), but it is independent of the menu.

**Independent Test**: On a touch viewport, hold a finger in the left strip and confirm the car steers left and only the left third is tinted; tap in the middle third and confirm no steering happens.

**Acceptance Scenarios**:

1. **Given** a touch device during a run, **When** the player touches within the left third of the screen, **Then** the car steers left and only that third shows the pressed highlight.
2. **Given** a touch device during a run, **When** the player touches within the right third, **Then** the car steers right and only that third shows the pressed highlight.
3. **Given** a touch device during a run, **When** the player touches the middle third of the screen, **Then** no steering occurs and nothing is highlighted.
4. **Given** the player holds a steering strip and the brake at the same time, **When** both are held, **Then** both inputs work together as they do today.
5. **Given** the player is not touching anything, **When** they look at the screen, **Then** no large light overlay is visible on either side.

---

### User Story 4 - Turn sound on or off (Priority: P3)

The menu has a Sound option that toggles all game audio on and off and clearly shows the current state. The choice is remembered the next time the game is opened.

**Why this priority**: A common courtesy feature, but not required to play.

**Independent Test**: Turn sound off from the menu, resume, confirm the game is silent; reload the game and confirm it is still off and the menu shows it as off.

**Acceptance Scenarios**:

1. **Given** sound is on, **When** the player toggles Sound in the menu, **Then** all game audio stops and the option shows "off".
2. **Given** sound is off, **When** the player toggles Sound, **Then** audio is heard again and the option shows "on".
3. **Given** the player turned sound off, **When** they close and reopen the game, **Then** sound is still off.
4. **Given** the player has never changed the setting, **When** they start the game, **Then** sound is on.

---

### User Story 5 - About card (Priority: P3)

The menu has an About option that shows a card with the author's name (Fabricio Perez) and the version of the game, expressed as the short identifier of the source commit it was built from. The card can be closed to return to the menu.

**Why this priority**: Informational; no effect on gameplay.

**Independent Test**: Open About and confirm the card shows the name and a commit identifier matching the commit the build was made from; close it and confirm the menu is shown again.

**Acceptance Scenarios**:

1. **Given** the menu is open, **When** the player chooses About, **Then** a card appears showing the author's name and the version commit identifier.
2. **Given** the About card is open, **When** the player closes it, **Then** they return to the menu in the same state as before (a paused run stays paused).
3. **Given** a build made without access to commit information, **When** About is opened, **Then** the card shows a clear placeholder such as "unknown" rather than an error or blank.

---

### Edge Cases

- The player opens the menu during the countdown or on the finish banner: the menu opens and Resume returns them to that same state; Restart still works.
- The player switches tabs or locks the phone mid-run: the game should not silently keep running unseen; returning shows the menu open over the paused run.
- Menu is opened while a steering strip or brake is held: held inputs are released so the car does not steer or brake on its own after Resume.
- The leaderboard modal is opened from the menu and closed: the player returns to the menu, not directly into the race.
- Keyboard `R` restart still works (and, like menu Restart, asks for confirmation while a run is in progress) during a run when the menu is closed.
- Local storage is unavailable: sound setting works for the session but is not remembered, with no error shown.
- The About card is shown on a small phone in portrait or landscape: the text remains fully visible and the close control is reachable.
- Rapid repeated taps on Menu/Resume do not cause the game to get stuck paused or run while the menu is visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST present a main menu before the first run, offering Start, Sound, About and Leaderboard options.
- **FR-002**: Choosing Start MUST begin the first run; tapping or pressing keys elsewhere on the menu screen MUST NOT start the game.
- **FR-003**: During a run, the system MUST show a Menu button in the place currently occupied by the Restart button, and MUST NOT show a separate Restart button.
- **FR-004**: Opening the menu during a run MUST pause the game: car movement, run timer, and moving scenery all stop.
- **FR-005**: The menu opened during a run MUST offer Resume and Restart in addition to Sound, About and Leaderboard.
- **FR-006**: Choosing Resume MUST close the menu and continue the run from the exact state it was paused in, with no time lost or gained.
- **FR-007**: While a run is in progress, choosing Restart MUST first ask the player to confirm (Yes / No); only on Yes MUST it begin a fresh run from the starting position with the timer reset, and on No the paused run MUST be left untouched. Once the lap has finished, Restart MUST start a fresh run immediately without asking.
- **FR-008**: Time spent in the menu MUST NOT count toward the run time recorded for the leaderboard or best time.
- **FR-009**: The Sound option MUST toggle all game audio on or off and MUST display the current state.
- **FR-010**: The sound setting MUST persist across visits on the same device and default to on.
- **FR-011**: The About option MUST show a card containing the author's name, "Fabricio Perez", and the version of the game as the short commit identifier it was built from.
- **FR-012**: The About card MUST display a readable fallback when commit information is unavailable, and MUST be closable to return to the menu.
- **FR-013**: On touch devices, the left steering area MUST cover only the leftmost third of the screen width, and the right steering area only the rightmost third.
- **FR-014**: Touches in the middle third of the screen MUST NOT steer and MUST NOT produce any highlight.
- **FR-015**: The pressed-state highlight for steering MUST be confined to the active strip, and no persistent light overlay may cover half the screen.
- **FR-016**: Brake input MUST continue to work together with steering as before.
- **FR-017**: The menu MUST be operable by touch, mouse and keyboard, with Escape toggling it during a run.
- **FR-018**: Opening the menu MUST release any held steering and brake inputs so none remain latched after resuming.
- **FR-019**: The menu and About card MUST remain fully usable on small phone screens in both portrait and landscape.
- **FR-020**: Hiding the page (switching tabs, locking the phone) during a run SHOULD open the menu so the run is paused when the player returns.

### Key Entities

- **Menu state**: Whether the menu is closed, open before the first run, or open over a paused run; determines which options (Start vs Resume/Restart) are offered.
- **Sound preference**: The player's on/off choice for audio, stored on the device, default on.
- **Version info**: The short source-commit identifier of the build, shown on the About card, along with the author's name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can pause and resume a run in two taps (Menu, then Resume), and the recorded run time differs from an uninterrupted equivalent by no more than 0.05 seconds regardless of how long they paused.
- **SC-002**: 100% of the time the menu is open, the car and run timer do not change.
- **SC-003**: On a phone, the touch steering highlight covers no more than one third of the screen width at any time, and a touch in the middle third never causes steering.
- **SC-004**: A player can switch sound off and have it stay off after reloading, in 100% of attempts when local storage is available.
- **SC-005**: The About card shows the author's name and a commit identifier that matches the build's source commit in every production build.
- **SC-006**: A first-time player can find and use Start, Sound and About without instructions (each reachable in at most two taps from the main menu).

## Assumptions

- The existing "Tap to start" overlay is replaced by the main menu; Leaderboard stays reachable from the menu, as it is from the start overlay today.
- Restart is only offered once a run has begun (as Resume/Restart in the in-run menu); the pre-run menu offers Start instead.
- The author's name displayed on the About card is "Fabricio Perez", taken from the repository's git author.
- "Version" means the short commit hash of the build; no separate semantic version number is introduced.
- Sound toggle covers all game audio (engine, effects); there is no separate music/effects split.
- Closing the page's tab or hiding it is treated as an interruption that pauses the run; this is a sensible default not stated in the request.
- The existing keyboard `R` shortcut for restart is kept when the menu is closed.
- The 33% strip width is the target from the request; the exact value may be tuned slightly during implementation provided it stays at or below roughly one third.
- Audio still requires a user gesture to start on iOS; choosing Start from the menu serves as that gesture.
