# Spec Delta

## Purpose

Provide an externally authored New Year scene in which two expressive polar bears temporarily take the composer away and return it decorated.

## ADDED Requirements

### Requirement: Failed attempts and decorated return

The scene SHALL show a solo failed pull, an exit and return with a friend, a first joint attempt that moves the composer a small visible distance but stalls, a second joint attempt that starts slowly and accelerates into successful removal, and a return with a glowing light strand and baubles. Decorations SHALL disappear after a short final pause within the finite scene. The intended duration is 28 seconds, with a hard playback maximum of 29 seconds.

#### Scenario: Complete playback
- **WHEN** the local scene plays without interruption
- **THEN** all story beats occur in order and the decorated composer returns before both characters depart and the scene cleans up

#### Scenario: Two joint attempts
- **WHEN** both bears make their first joint pull after taking up rope slack
- **THEN** the composer moves only a small visible distance and settles into a pause
- **WHEN** they pull together again
- **THEN** movement resumes slowly from that displaced position and accelerates while visible, with synchronized rope, paws and composer motion

### Requirement: Restrained contemporary decoration

The returned composer SHALL carry a flexible wire with soft natural sags, small volumetric bulbs and bauble accents. Attachment points, bulb sockets and hanging threads SHALL remain visible without obscuring input text. Decoration SHALL work on light and dark backgrounds and disappear after the existing final pause.

#### Scenario: Decorated reveal
- **WHEN** the returned composer reaches its final hold
- **THEN** the flexible wire is visibly supported along its upper edge, softly sags under the small bulbs and preserves their rounded volume at actual mobile/desktop size
- **AND** bauble accents retain clear attachment and input text remains readable
- **AND** the drawing avoids a nearly straight taut line, triangular support tails, thick repeated green scallops and heavy glossy ornament shading

#### Scenario: Preserve the accepted scene
- **WHEN** the decoration is revised following the user's acceptance of the bears and scene in0.1.4
- **THEN** bear faces, bodies, foot motion, rope choreography, side/corner staging and composer travel remain unchanged

### Requirement: Expressive visible characters

The bears SHALL use the approved SnowmanDelivery's round proportions, compact limbs, simple faces, restrained contours and flat white/blue shading, with distinct scarf colors and readable effort/recovery poses. Desktop SHALL stage both characters beside the composer. Mobile SHALL stage them below a side corner, preserving the composer's size and initial position. The direction-agnostic story SHALL work with RTL text without mirroring the snapshot.

#### Scenario: Mobile joint pull
- **WHEN** the scene reaches the joint attempt in a 360px-wide viewport
- **THEN** both faces, planted feet and contacting paws remain readable within the viewport before departure
- **AND** the bears stand below the bottom-left corner during the outbound attempt and below the bottom-right corner on return

#### Scenario: Desktop side pull
- **WHEN** the scene reaches its pulling attempts on desktop
- **THEN** the bears stand beyond the right side of the composer with their rope attached to that side
- **AND** the return uses the opposite side while preserving the pulling direction

#### Scenario: Readable bear expressions
- **WHEN** either bear is neutral, pulling or reacting at its actual scene size
- **THEN** eyes, compact muzzle and nose form a consistent view of a bear face, with a restrained animal mouth and no accidental connecting forehead line
- **AND** facial changes preserve the body drawing, side/corner staging and rope choreography

### Requirement: Tied rope carries the pulling action

The first bear SHALL visibly tie a rope to the composer before pulling. The knot SHALL stay attached to the measured side or lower corner selected by its viewport variant, and each held rope endpoint SHALL follow its paw. Slack SHALL straighten before the composer yields and relax after failed effort. Both bears SHALL pull together after the helper arrives. The return SHALL preserve a pulling direction and release the rope before the decorated hold.

#### Scenario: First attempt
- **WHEN** the bear prepares the first pull
- **THEN** the tie, take-up of slack, braced effort and failed recoil are visibly distinct and causally ordered

#### Scenario: Return with decoration
- **WHEN** the pair brings the decorated composer back
- **THEN** the tension points toward their pulling stance and the knot remains attached until they release it

### Requirement: Continuous authored motion

Visible travel SHALL avoid instantaneous whole-body flips, abrupt position jumps and repeated braking at intermediate travel samples. Foot and body motion SHALL be restrained and coordinated with travel, and effort SHALL include a readable preparation, hold and recovery. Smooth rendering alone SHALL NOT establish artistic acceptance.

#### Scenario: Approach and turn
- **WHEN** a bear enters, turns or returns with the helper
- **THEN** its position and connected silhouette remain continuous and intermediate waypoints do not create unintended stops

### Requirement: Bounded authored assets

Each variant SHALL use at most 512 KiB JSON, 30 layers, 4000 keyframes, 8000 vertices and 800 rendered SVG nodes, with no raster/video assets, expressions or SVG filters. The scene SHALL use two characters, at most 12 bulbs and 8 baubles, one snapshot of at most 300 nodes, no recurring timers or frame loop outside the existing player, and a static reduced-motion poster.

#### Scenario: Asset verification
- **WHEN** the authored variants are inspected and played
- **THEN** structural and rendered counts remain within every stated ceiling and completion removes transient animation resources

### Requirement: External pack ownership and preview

Themes SHALL own the native JSON/SVG, poster, manifest and scene labels. Chat SHALL own the reusable composer-carry adapter. The pack SHALL have a replayable preview through the production player, remain decorative and keyboard-safe, and support light/dark, mobile/desktop and reduced motion. Publication SHALL retain existing immutable pack versions and keep activation subject to the host's existing event delivery policy.

#### Scenario: Reload and replay
- **WHEN** the developer opens or reloads the local preview and activates replay
- **THEN** the authored pack plays against the actual preview composer and can be replayed after cleanup

#### Scenario: Publication ahead of a deployed runtime
- **WHEN** a published pack requires composer carry but the deployed runtime does not advertise it
- **THEN** existing unsupported-capability handling prevents unsupported animation playback and other eligible scenes remain available

### Requirement: Independently enabled New Year Polar Bears event

The scene SHALL be published as the separate external-only `new-year-polar-bears` event, with an English event title and keyboard-accessible static trigger. Its own catalog default SHALL select the Polar Bears pack. Existing `new-year` defaults and scene pools SHALL remain unchanged. The host SHALL enable the new event through its existing event and external-delivery configuration, with no new application translation key or feature flag.

#### Scenario: Explicit event activation
- **WHEN** the host selects and allows the `new-year-polar-bears` external event
- **THEN** its static trigger starts the Polar Bears scene or the supported static fallback

#### Scenario: Existing New Year activation
- **WHEN** the host continues to select `new-year`
- **THEN** its existing default pack and eligible scenes remain unchanged
