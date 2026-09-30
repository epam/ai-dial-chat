## ADDED Requirements

### Requirement: Candy stages a complete cleanup battle

HalloweenScene.Candy SHALL play a 35-second finite story with a provider deadline of 35.5 seconds. Candy SHALL bounce on available visible page elements, settle at the bottom and persist for the contest. Two ravens SHALL enter from one edge and peck. A mummy janitor SHALL enter from the opposite edge, sweep candy and drive both ravens fully off their entry edge. A larger returning flock SHALL drive the mummy off the opposite edge, land and resume pecking. The mummy SHALL return with exactly two skeleton janitors; all three SHALL sweep forward and drive the flock off its original edge, clear remaining candy and leave.

The component SHALL own one immutable activation plan and finite animation lifetime. The existing provider SHALL retain selection, trigger, notification and replacement. No public API, translation, feature flag, persisted state or telemetry SHALL be added.

#### Scenario: Complete desktop contest

- **WHEN** Candy plays uninterrupted on desktop
- **THEN** eighteen or fewer sweets, two initial ravens returning as six, one mummy and two skeleton helpers perform every ordered beat
- **AND** sweets remain for both feeding rounds and move only after a beak/broom contact or gravity segment
- **AND** all departures cross the appropriate viewport edge, with a readable feeding pause between reversals

#### Scenario: Mobile and RTL preserve the story

- **WHEN** the host selects mobile mode
- **THEN** twelve or fewer sweets and four returning ravens preserve both feeding rounds, both retreats and all three janitors
- **WHEN** the host has RTL direction
- **THEN** the entry/retreat sides mirror while candy contacts use actual physical UI geometry and no text is mirrored

### Requirement: Candy contacts measured page edges without changing the chat

Candy SHALL use at most two mobile/three desktop visible edge targets from existing host anchors, measuring at most four composers and twelve starter buttons with cached reads and at most 32 ancestor checks. No DOM snapshot or live-control animation SHALL be created. Hidden, clipped, transformed or otherwise unsafe geometry SHALL be excluded. Contact and subsequent flight SHALL be geometrically continuous; broom/beak motion and candy response SHALL share contact points and times.

#### Scenario: Starters or only a composer exist

- **WHEN** eligible starters are above or below the composer
- **THEN** sweets can bounce on their measured edges
- **WHEN** only a safe composer exists, including without a starter-list anchor
- **THEN** sweets bounce on its top edge, clear its side and settle below for the same complete contest
- **AND** draft, selection, focus and real layout remain unchanged

#### Scenario: Targets are absent

- **WHEN** no safe edge can be measured
- **THEN** sweets fall to the floor and the complete raven/janitor contest still plays

### Requirement: Candy playback is bounded and reversible

Candy SHALL use at most 60/80 mobile/desktop active tracks, 400/520 SVG nodes, and 160 keyframes per track. The scene SHALL use precomputed transform/opacity motion without per-frame layout reads, React updates, a physics engine, animated filters or unbounded particles. Grounded actors SHALL fold wings/stop walking between actions. Geometry is read only at preparation or event-driven cancellation checks.

#### Scenario: Interruption and resource release

- **WHEN** input/composition, pointer/focus, scroll/resize, source changes/removal, hidden document, environment/motion changes, replacement or unmount occurs
- **THEN** every owned animation, timer, listener and observer is released idempotently and all art is removed/hidden
- **AND** cancelled preparation, partial setup failure or StrictMode rehearsal cannot restart stale work

#### Scenario: Reduced or unsupported motion

- **WHEN** reduced motion is enabled or required animation APIs are unavailable
- **THEN** a static candy/raven/janitor composition appears without target measurements or animation

#### Scenario: Verified performance

- **WHEN** the complete story is verified
- **THEN** tests enforce object/track/keyframe caps and contact/order/cleanup behavior
- **AND** browser evidence covers 360/900/1280/1920, RTL, composer-only, missing targets and reduced motion, plus mobile CPU ×4 and desktop profiles without resource accumulation
