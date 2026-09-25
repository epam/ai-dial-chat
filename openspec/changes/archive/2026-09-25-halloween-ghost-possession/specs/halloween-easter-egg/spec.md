## MODIFIED Requirements

### Requirement: The ghost celebration is a flock of individuals, not one sprite

The Ghost celebration SHALL stage possession of distinct visible interface elements and an unsuccessful attempt to frighten the main pumpkin. Up to three mobile or five desktop small elements SHALL be selected across available history, welcome/starter and composer-control areas. Each target SHALL contain at most 60 descendants and SHALL NOT be clipped, hidden, focused, expanded, disabled, editable or contain an editable subtree. The composer itself SHALL NOT be cloned. Each borrowed visual copy SHALL float with attached expressive eyes while its real element keeps layout, focus and data.

Ghosts SHALL retain the distinct `HalloweenGhostVariant` SVG silhouettes, tints, translucent cloth folds and recessed faces. Each SHALL have its own arrival, possession point and departure. One brave ghost SHALL approach the existing pumpkin and try to frighten it; the pumpkin SHALL answer with a glowing grin. The brave ghost SHALL recoil and hide with its tail briefly exposed. Other ghosts SHALL peek out from their separate homes and escape along different routes with staggered departures. The interface SHALL be fully restored within twelve seconds, before the existing fourteen-second deadline.

Missing pumpkin or eligible targets SHALL retain `buildHalloweenGhostFlight` as a decorative fallback: `HALLOWEEN_GHOST_COUNT` ghosts with distinct size, pace, tilt, opacity and delay, alternating entry edges, upward arcs and opposite-edge exits. Its viewport-relative CSS paths SHALL retain inner vertical bobbing and SHALL NOT flip in RTL. Consecutive ghosts SHALL use different variants.

`HalloweenGhosts` SHALL own a stable per-activation measured/random plan and temporary artwork; CelebrationProvider SHALL continue owning selection, lifecycle and notifications. No shared cache or persistent state SHALL be added. The scene SHALL keep the existing `UI_EVENT=halloween` gate without `ENABLED_FEATURES`/roles additions, and reuse the existing translated Ghost toast with the secret-phrase hint. No API calls, new strings, telemetry, core-component changes or library changes SHALL be introduced.

Playback SHALL use bounded visual copies and precomputed transforms/opacity on one timeline, with no layout reads or React updates per frame. Copies SHALL be inert, and all artwork SHALL be aria-hidden and pointer-transparent. Physical measured coordinates SHALL preserve attachment in LTR and RTL. Reduced motion or unsupported animation APIs SHALL show stationary, distributed ghosts without borrowing or pumpkin animation. Interaction, scrolling, resizing, source mutation, hidden documents, live motion changes, replacement and unmount SHALL stop pending work and restore originals immediately; canceled scenes SHALL NOT restart.

#### Scenario: Separate possessions precede the failed scare
- **WHEN** the scene starts with an eligible interface and pumpkin
- **THEN** ghosts enter distinct elements whose copies float with attached eyes
- **AND** the brave ghost attempts a scare, recoils from the pumpkin grin, hides with an exposed tail and joins the others in peeking and staggered escape

#### Scenario: Every ghost flies its own path
- **WHEN** eligible possession anchors are unavailable
- **THEN** the fallback contains `HALLOWEEN_GHOST_COUNT` ghosts with distinct paths, entering from both sides and starting and ending off-screen

#### Scenario: The flock mixes silhouettes
- **WHEN** a ghost celebration renders
- **THEN** more than one silhouette is drawn and consecutive ghosts differ

#### Scenario: Small screens and RTL retain attachment
- **WHEN** the scene runs on mobile or in RTL
- **THEN** it chooses at most three mobile or five desktop homes from the actually visible interface, keeps eyes and ghosts attached to those homes and causes no horizontal overflow

#### Scenario: Interruption restores the page
- **WHEN** interaction, source changes, scrolling, resizing, hidden document, motion change, replacement or unmount interrupts playback
- **THEN** copies and pending animations are removed and originals immediately recover their exact presentation without changing focus, drafts or data
- **AND** the interrupted scene does not restart on later viewport or preference changes

#### Scenario: Motion is suppressed
- **WHEN** reduced motion is enabled or the animation API is unavailable
- **THEN** stationary distributed ghosts appear without borrowing interface elements or animating the pumpkin

#### Scenario: Work remains bounded
- **WHEN** the page has long history or complex controls
- **THEN** target discovery and copies respect candidate/descendant budgets, oversized and unsafe controls are skipped, and playback performs no repeated measurements or React frame updates
