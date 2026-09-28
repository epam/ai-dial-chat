## MODIFIED Requirements

### Requirement: Further clicks reveal other characters

The bat scene SHALL stage the three-bat crosswind story when a usable composer is available, with its own eighteen-second lifetime. When attachment space or the composer is unavailable it SHALL retain sixteen small bats with staggered curved flights and flapping wings. The cat scene SHALL show a small black cat crossing the bottom edge, with tail movement and soft floating wisps. The witch scene SHALL release five small witches on broomsticks, flying along arcs at different heights in both directions. Each scene SHALL announce its own translated notification and respect the same navigation, configured-lifetime and click-through guarantees.

Every added animation SHALL be disabled under reduced motion. Characters and wisps SHALL remain visible in separated static positions, not frozen off-screen. All character drawings SHALL be decorative SVG, with no sound.

#### Scenario: Another character scene is selected

- **WHEN** random pumpkin selection chooses bats, the cat or witches
- **THEN** the corresponding characters play their scene and its translated notification announces the secret phrase
- **AND** reduced motion displays separated static characters while navigation and scene deadlines still remove the effect

## ADDED Requirements

### Requirement: Bat crosswind story
The Bats burst SHALL stage a 17.5-second three-bat crosswind story inside the existing decoration layer when a visible composer has sufficient space below it. CelebrationProvider SHALL retain activation ownership, the existing UI_EVENT gate and notification, and use an eighteen-second scene lifetime; there SHALL be no new ENABLED_FEATURES/role gate, provider, endpoint, persistence, telemetry or translations. The per-activation measured plan SHALL remain stable until disposed.

#### Scenario: Failed wake-up attempt
- **WHEN** the Bats story starts
- **THEN** a sleepy bat grips the composer underside and folds its wings, while two helpers approach from opposite sides and fan it
- **AND** it wraps up tighter, the helpers exchange looks and increase their effort
- **AND** opposing currents catch the helpers in a vortex and carry them away separately
- **AND** the sleeper opens one eye, yawns, crawls to and re-hangs on a nearby idle button when available (otherwise along the composer edge), then departs last
- **AND** the live composer retains its focus, draft and position throughout

#### Scenario: Smooth motion and readable pauses
- **WHEN** bats approach, circle, settle and leave
- **THEN** their paths carry momentum through intermediate flight points and decelerate before rests, without repeatedly stopping at orbit samples
- **AND** wingbeat phase stays continuous as the pace changes, page surfaces react with damped motion and the extended scene lifetime includes the final departure

#### Scenario: Wingbeats disturb nearby page surfaces
- **WHEN** helpers fan selected nearby small surfaces with their wings
- **THEN** only those surfaces rock around their edges, with stronger later gusts producing stronger motion
- **AND** motion onset follows actual power strokes with a short distance-dependent delay, while distant elements stay still
- **AND** the scene renders no beams, airflow streaks, particles or drawn vortex; separately jointed outer wings fold on recovery and spread during downstrokes while bodies gently lift and settle
- **AND** there are at most three mobile/five desktop inert visual copies, each at most sixty descendants and 440×110/33000px², excluding focused/editable/disabled/expanded/hidden/clipped elements and overlapping relatives
- **AND** originals return before the sleeper's departure without changing data or invoking UI actions

#### Scenario: Safe interruption
- **WHEN** input, focus, pointer, keyboard, external scroll, resize, hidden-tab, anchor change/removal, unmount or partial animation setup failure occurs
- **THEN** every animation stops and every original is restored immediately
- **AND** that activation does not restart after breakpoint or motion-preference changes

#### Scenario: Notification dismissal does not interrupt the story
- **WHEN** a notification or unrelated popup portal is inserted or removed without moving or resizing the measured anchors
- **THEN** the current bat story continues to its natural completion
- **AND** real anchor changes, layout shifts and user interaction still restore the interface immediately

#### Scenario: Fallback and accessibility
- **WHEN** reduced motion is requested or WAAPI is unavailable
- **THEN** the scene is stationary and creates no page snapshots or measurements
- **WHEN** a usable composer is missing or lacks attachment space
- **THEN** the legacy decorative flight plays without borrowing UI
- **AND** all scene content remains inert, aria-hidden and pointer-transparent in every case

#### Scenario: Responsive bounded rendering
- **WHEN** the story plays in LTR or RTL on mobile or desktop
- **THEN** claws remain attached to measured physical anchors, strokes affect nearby measured targets and decoration creates no page overflow
- **AND** actors, subtree scans and snapshots are bounded, with precomputed WAAPI motion and no per-frame DOM measurements or React renders
