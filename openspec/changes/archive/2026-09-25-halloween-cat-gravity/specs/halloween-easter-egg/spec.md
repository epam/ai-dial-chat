## MODIFIED Requirements

### Requirement: Further clicks reveal other characters

The bat scene SHALL stage the three-bat crosswind story when a usable composer is available, with its own eighteen-second lifetime. When attachment space or the composer is unavailable it SHALL retain sixteen small bats with staggered curved flights and flapping wings. The cat scene SHALL stage the gravity-testing story on eligible interface anchors, with a decorative crossing cat as fallback. The witch scene SHALL release five small witches on broomsticks, flying along arcs at different heights in both directions. Each scene SHALL announce its own translated notification and respect the same navigation, configured-lifetime and click-through guarantees.

Every added animation SHALL be disabled under reduced motion. Characters and wisps SHALL remain visible in separated static positions, not frozen off-screen. All character drawings SHALL be decorative SVG, with no sound.

#### Scenario: Another character scene is selected

- **WHEN** random pumpkin selection chooses bats, the cat or witches
- **THEN** the corresponding characters play their scene and its translated notification announces the secret phrase
- **AND** reduced motion displays separated static characters while navigation and scene deadlines still remove the effect

## ADDED Requirements

### Requirement: Cat tests gravity on interface buttons

HalloweenCatScene SHALL own one stable measured plan per activation. CelebrationProvider SHALL retain scene selection, notification and lifecycle, with a 25.5-second Cat lifetime enclosing 25 seconds of animation. The scene SHALL retain UI_EVENT=halloween and the existing cat toast/secret hint without additional ENABLED_FEATURES/role gating, translations, provider, endpoint, persistence, cache or telemetry.

#### Scenario: Tentative nudge becomes deliberate mischief

- **WHEN** a visible composer and two nearby safe small buttons are available
- **THEN** an articulated black cat walks in on four legs, anticipates and jumps onto the composer edge, sits there looking at the viewer and down at its prize, then hops down beside the buttons
- **AND** it moves each button gradually over two pushes; before every push it looks at the viewer, looks at the button while its paw pushes, then looks back at the viewer
- **AND** it walks on four legs to the second button, one button rebounds and the cat recoils before sitting to groom its paw and leaving
- **AND** the cat uses a seated drawing while sitting, pushing and grooming and a standing drawing with a diagonal gait while walking and jumping, swapping without either drawing turning translucent
- **AND** button motion starts at physical paw contact, falls accelerate, and the cat anticipates jumps, absorbs landings and pauses naturally
- **AND** originals return before natural scene disposal without altering draft, selection, focus, layout or application data

#### Scenario: Work stays bounded and isolated

- **WHEN** the cat scene prepares and plays
- **THEN** it borrows at most two visible buttons of at most 60 descendants, 300×96px and 24000px² each, excluding focused, editable, disabled, expanded, hidden or clipped controls
- **AND** the composer is an anchor only and is never copied or transformed
- **AND** precomputed SVG and copy transforms share a timeline without per-frame measurements, React updates or changes to core components/libraries

#### Scenario: Interruption restores the controls

- **WHEN** user interaction, scrolling, resizing, hidden document, source changes, motion/viewport changes, replacement, unmount or setup failure interrupts the scene
- **THEN** pending preparation, animations and copies stop and originals recover immediately
- **AND** the activation cannot restart after cancellation
- **WHEN** an unrelated notification portal appears or disappears without shifting anchors
- **THEN** the story continues through its full timeline

#### Scenario: Responsive fallback and accessibility

- **WHEN** the scene runs on mobile or desktop in LTR or RTL
- **THEN** measured physical geometry keeps paws and prizes aligned without page overflow, with inert, aria-hidden and pointer-transparent decoration
- **WHEN** only one eligible button exists
- **THEN** it receives the tentative push, deliberate fall and rebound
- **WHEN** no reachable buttons or composer exists
- **THEN** the decorative cat walk remains available
- **WHEN** reduced motion is enabled or animation support is missing
- **THEN** a stationary cat is visible without measuring or borrowing the page
