# new-year-santa-history-delivery Specification

## Purpose

Define the accepted Santa History Delivery scene, its history and rope routes,
artwork, departure, bounded runtime cost and prerequisites for additive release.
The maintained scene is unpublished; this contract does not assert deployed pack
availability.

`CelebrationHost` in `apps/chat/src/context/CelebrationHost.tsx` supplies the existing
provider with resolved event, anchors, direction and memoized labels/callbacks;
`useCelebrationPreference` in
`apps/chat/src/hooks/celebration/useCelebrationPreference.ts` controls user opt-in.
There is no new `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES` gate: the existing
active-event/delivery policy and user preference apply. The new pack label ID is
`santaHistoryDeliveryToastMessage`, resolved through the existing locale fallback;
no new application translation key is introduced.

The profile's decorative accessibility contract applies: an inert, aria-hidden,
pointer-transparent scene, a safely placed reduced-motion poster and the existing
keyboard-operable composer phrase trigger and announced notification. Native art mirrors for
RTL while copied text remains upright. Existing pack delivery/cache contracts are
reused; this scene adds no endpoint, SDK operation, cache, analytics or telemetry.

## Requirements

### Requirement: Santa delivers gifts down the history and calls a ride

The scene SHALL preserve selected Santa D and show descent along conversation rows, a loaded row falling, Santa nearly falling and catching himself on an upper row, recovery and descent to the bottom, arranging three presents, an unsuccessful effort to climb back, a visible phone call, arrival of two reindeer and one sleigh, boarding and departure. The causal beats SHALL remain readable without sound. All temporary artwork SHALL clear after a brief ending pause.

#### Scenario: First rendered interaction
- **WHEN** the representative slice is reviewed at actual desktop and mobile size
- **THEN** loading the row precedes its fall, the catch arrests Santa's fall, a hanging pause and recovery are visible, and artwork, contact geometry and continuous motion have separate evidence

#### Scenario: Full scene
- **WHEN** the `happy new year` secret phrase selects the supported scene
- **THEN** every story beat plays once within the descriptor lifetime, with a stopped sleigh for boarding and no abrupt disappearance used in place of the departure

### Requirement: Mobile and missing history preserve the story

A closed, absent, empty or unsafe history SHALL use an authored rope near the composer. Santa SHALL descend the rope, briefly slip, catch it with a visible mitten grip and recover, then deliver the gifts, attempt to climb back, call for the sleigh and depart. The runtime SHALL NOT open history, create real conversations or substitute only the ending.

#### Scenario: Phone with closed sidebar
- **WHEN** no safe real-row route exists and the rope route fits
- **THEN** Santa descends the rope with a readable slip/catch/recovery and all remaining story beats play without drawn conversation cards or touching live controls

#### Scenario: No readable safe stage
- **WHEN** a full route cannot fit or reduced motion is requested
- **THEN** a safely placed expressive static poster appears, or only the existing festive notification if no readable poster fits or its image fails

### Requirement: Santa carries gifts with a centered head silhouette

Both native variants, both route branches and the static poster SHALL show a clearly readable gift sack carried behind Santa's shoulder. The sack SHALL remain connected to the character without hiding his face, beard or supporting mitten contacts. Santa's head SHALL be centered above his torso without a persistent sideways tilt; small action-related reactions MAY remain.

#### Scenario: Descent and pause poses
- **WHEN** Santa descends, catches himself or pauses before delivering gifts
- **THEN** the sack reads as part of his carried load and the connected head/beard silhouette remains balanced at actual desktop and mobile display sizes

#### Scenario: Safe static fallback
- **WHEN** reduced motion or insufficient route clearance selects the poster
- **THEN** the poster retains the gift sack and centered head silhouette without borrowing live controls

### Requirement: Native ownership, additive delivery and bounded cost

Themes SHALL own native artwork, timelines, poster, labels and descriptors. Chat SHALL own only generic playback/geometry/copies. The scene SHALL use at most one player, one bounded row snapshot, six stations and the numerical budgets below. Santa SHALL join the existing `happy new year` secret pool only when its external scene is admitted. Gift clicks SHALL NOT select Santa. Existing click and secret scenes SHALL remain available. Publication SHALL wait for the separate eligible ordinary-pack retention prerequisite.

#### Scenario: Older client
- **WHEN** the client does not support the scene-level history-ladder capability
- **THEN** it omits only this scene and preserves all supported New Year behavior

#### Scenario: Interrupted scene
- **WHEN** interaction, layout/content changes, hidden tab or host reset ends playback
- **THEN** the live row is restored immediately, all decorations/resources are removed, and conversation data, order and composer state remain unchanged

### Requirement: Supports and flight use visible screen boundaries

Santa SHALL descend the left edge of eligible LTR conversation rows, with mirrored native choreography in RTL. A fallback rope SHALL continue beyond the visible window top. The sleigh and reindeer SHALL enter from outside the inline-start edge at fixed scale, decelerate to a stop for boarding, then accelerate with Santa completely beyond the inline-end edge before cleanup. Opacity or shrink-to-zero SHALL NOT substitute for crossing the edge.

#### Scenario: Smooth boarding and departure
- **WHEN** the full scene reaches the rescue beat
- **THEN** the flight stops at 21.8 seconds, boarding finishes before 23.8 seconds, and Santa shares the sleigh's departure positions and easing through 26.2 seconds
- **AND** all airborne art is outside the viewport before the 27-second scene completes

### Requirement: Scene cost remains bounded

The complete variants SHALL retain the same finite resource limits across history and rope routes.

#### Scenario: Complete native variant validation
- **WHEN** a full desktop or mobile variant is validated
- **THEN** it is at most 300 KiB, 36 layers, 2,500 animated keys, 4,000 path vertices and 420 rendered SVG descendants, with one player and at most one 80-node row snapshot
- **AND** playback lasts 27 seconds within its declared finite loading and lifetime deadlines

### Requirement: Santa is a secret phrase scene

The compiled New Year event SHALL declare Santa as an external secret scene. Composition SHALL add it to the secret pool only after the host admits a compatible scene, without adding it to the gift-click pool or creating a new phrase.

#### Scenario: Secret activation and rollback
- **WHEN** the admitted Santa scene is selected by `happy new year`
- **THEN** it plays through the existing secret trigger and is never selected by a gift click
- **AND** removing its allowlist entry removes only Santa while preserving the existing scenes and phrase
