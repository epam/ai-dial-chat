## ADDED Requirements

### Requirement: Ravens build a nest from the interface

`HalloweenBurst.Ravens` SHALL show five ravens on mobile and eight on desktop, owned by `HalloweenRavens` inside the existing celebration viewport layer. Birds SHALL land on visible UI, tear small fragments from separated headings, buttons and history rows and build a nest on the main pumpkin. Two ravens SHALL grip opposite ends of one visible conversation, first attempt small pulls, then brace and tug harder while its visual copy bends. One SHALL release; the other and the conversation SHALL recoil toward the nest. Collectors SHALL each use a unique source, deliver their piece at staggered times and immediately fly off along separate routes without gathering over the nest. The pumpkin SHALL shake and all borrowed UI SHALL be restored by twelve seconds, before a thirteen-second shared deadline.

Flying birds SHALL turn toward their flight direction at route changes; grounded tugging SHALL preserve their grip-facing pose. The birds' beaks and the carried edges SHALL derive from the same geometry and timeline throughout contact. Target discovery SHALL use a bounded snapshot of visible existing DOM geometry in physical viewport coordinates, preserving attachment in LTR and RTL. Hidden, clipped, expanded or focused conversation controls SHALL NOT be borrowed. When no eligible conversation is visible, the birds SHALL fight over a decorative composer-border strip; when the pumpkin is absent the nest SHALL use a composer corner. With no usable interface, a stationary decorative flock SHALL remain available.

The scene SHALL use at most one real conversation snapshot with at most five visual sections, at most three/six cropped fragments on mobile/desktop (76×32px each; at most 16 source descendants) and bounded SVG artwork. It SHALL NOT clone the composer, modify data, persist state, call APIs, add telemetry or require changes to core page components or libraries. Playback SHALL NOT read layout or update React state per frame. Actors and copies SHALL share one precomputed animation timeline. Performance SHALL be checked in a browser fixture with throttled CPU before adding a canvas renderer.

All artwork SHALL be aria-hidden and pointer-transparent, and visual copies SHALL be inert. Reduced motion SHALL show stationary birds without borrowing elements or animating the pumpkin. Scene replacement, navigation, interaction, scrolling, resizing, hidden documents, target mutation and live motion-preference changes SHALL stop pending work and restore originals. The existing `UI_EVENT=halloween` gate, random click selection and `halloween.ravensToastMessage` secret-phrase hint SHALL remain unchanged; no new user-visible strings SHALL be introduced.

CelebrationProvider SHALL continue to own scene selection, notifications and lifecycle. HalloweenRavens SHALL own only its per-activation measured plan and temporary visual copies; no shared memoized plan or cache is needed. The scene SHALL use the existing `UI_EVENT=halloween` selection without a separate `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES` gate.

#### Scenario: Nest construction and tug of war share one story

- **WHEN** the raven scene starts with a visible pumpkin, composer and eligible history row
- **THEN** birds gather spatially separated fragments into a pumpkin nest while two others tug the same conversation with attached beaks
- **AND** releasing one grip launches the other bird and its cargo toward the nest before the pumpkin shakes and the scene restores the interface

#### Scenario: Mobile or empty history supplies a strip

- **WHEN** no eligible history row is visible
- **THEN** the birds tug a decorative strip at the composer instead, without opening history or changing input contents
- **AND** mobile uses five birds and desktop uses eight without horizontal overflow

#### Scenario: Interruption restores the borrowed interface

- **WHEN** the user interacts, navigates, changes motion preference, scrolls, resizes, hides the document or the target changes during playback
- **THEN** all scene-owned animations and copies are stopped and removed and original controls are immediately restored

#### Scenario: Motion is reduced

- **WHEN** reduced motion is enabled before the scene starts
- **THEN** stationary ravens appear without a borrowed conversation, pumpkin shake or animation loop

#### Scenario: Work is bounded and direction independent

- **WHEN** the scene runs in either direction with a long history
- **THEN** only bounded visible targets, one small row and at most six small fragment subtrees are measured/copied at setup
- **AND** precomputed motion keeps grips attached with no per-frame layout reads or React updates

#### Scenario: Collectors stay distributed

- **WHEN** headings, controls and history entries are visible in different areas
- **THEN** each collector tears a unique piece from its own source, with at least 96px between selected source centers
- **AND** deliveries are staggered, with a short drop followed immediately by departure along different routes, so birds do not wait in a cluster
