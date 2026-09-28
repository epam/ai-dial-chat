## ADDED Requirements

### Requirement: Footprints reveal an invisible cat through card contact

With an eligible starter, `HalloweenScene.Footprints` SHALL show a twelve-second sequence in which alternating prints approach the card, climb onto its visual copy, reveal the weight of a seated invisible cat, then jump away while the card rebounds and returns. Without a starter, it SHALL use the safe composer-outline or decorative fallback described below. Eyes SHALL glance and blink before the pleased grin; the final pair of prints and disappearing grin SHALL complete the story near the deadline. Surface reaction SHALL follow paw contact, and attached prints SHALL use the surface's transform and pivot.

`HalloweenFootprints` SHALL own one stable plan per activation and its temporary artwork. `CelebrationProvider` SHALL retain event selection, notification, replacement and the existing 12000ms mount deadline. The existing event/selection gate and `footprintsToastMessage` SHALL remain; no new API, feature flag, strings, telemetry or persistent state SHALL be introduced. Host integration SHALL arrive exclusively through existing environment anchors/settings.

#### Scenario: A safe card exists

- **WHEN** Footprints starts with an eligible starter button and composer anchor
- **THEN** the complete approach, climb, sit and jump sequence plays with one inert visual card copy
- **AND** contact and weight cause the card's tilt/sag, without changing application data, actual layout, draft, focus or selection
- **AND** the copy returns exactly before original visibility is restored, covering the original through the handoff

#### Scenario: The host places starters below the composer

- **WHEN** the host renders eligible starter buttons below its composer, as the real chat does
- **THEN** Footprints borrows a safe starter and plays the same contact, sitting and return sequence
- **AND** eligibility depends on non-overlap and visibility rather than the fixture's component ordering

#### Scenario: Targets are absent or unsuitable

- **WHEN** no safe composer geometry is available
- **THEN** a finite decorative route retains the invisible familiar's footsteps, eyes and grin without borrowing UI

#### Scenario: Only the input is available

- **WHEN** a visible composer has room for the scene but no eligible starter exists, including when no starter-list anchor is provided
- **THEN** the prints walk along a bounded portion of its top edge and a decorative outline reacts to contacts, sitting weight and departure
- **AND** the outline and attached prints share the same geometry and motion
- **AND** the input, text, selection and focus remain unchanged: no input subtree snapshot, opacity animation or transform is applied to live controls
- **AND** ordinary interruption/resize/source-change cleanup removes the outline and all owned effects
- **AND** this variant uses at most thirteen mobile / seventeen desktop animations within the existing scene budget

#### Scenario: Mobile, RTL and reduced motion

- **WHEN** the scene uses mobile layout
- **THEN** at most eight prints and one card preserve the main story without hover
- **WHEN** the host is RTL
- **THEN** all contact follows actual physical geometry and copied text remains unmirrored
- **WHEN** reduced motion is enabled or required animation APIs are unavailable
- **THEN** three static prints and the face appear without target measurements, snapshots or active animations

### Requirement: Footprints artwork and playback stay bounded and reversible

The scene SHALL use at most twelve candidate buttons, four composer candidates, two starter lists, 32 ancestor checks per candidate and 40 descendants per copied card. A borrowed card SHALL be visible, idle, untransformed/unclipped and at most 240×96px; focused, disabled, expanded, editable and hidden controls SHALL be skipped.

The scene SHALL allocate at most 8/12 mobile/desktop prints, 80/110 mobile/desktop SVG nodes, 2KiB of unique SVG path data in artwork definitions, 20 simultaneous animations including snapshot/source tracks and 80 keyframes per track. It SHALL use precomputed transform/opacity tracks without per-frame JS geometry reads, React updates, animated filters, unbounded particles or new dependencies. Paw shapes and the eyes/grin SHALL remain legible at the actual mobile size.

#### Scenario: Bounded steady playback

- **WHEN** Footprints plays without changes to its host after preparation
- **THEN** it performs no repeated geometry polling and remains within the object, copy, SVG and animation budgets
- **AND** the final reveal remains visible late in the twelve-second story instead of leaving a multi-second empty ending

#### Scenario: Interaction or host changes interrupt the cat

- **WHEN** typing/composition, pointer/focus, scrolling, resize, a relevant source change, a hidden document, changed mobile/motion/anchor settings, navigation, replacement or unmount interrupts playback
- **THEN** all originals are restored immediately and all owned animations, copies, timers, listeners and observers are released idempotently
- **AND** canceled preparation cannot restart later

#### Scenario: Setup failure and repeated activation

- **WHEN** snapshot/animation setup fails or the scene repeatedly starts and stops, including React StrictMode
- **THEN** the ordinary chat stays usable with no hidden original or accumulated resource
- **AND** unrelated toast removal does not cancel a scene whose anchors remain unchanged
