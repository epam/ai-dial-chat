## ADDED Requirements

### Requirement: The gift offers a finite wrapping story

New Year SHALL register `NewYearScene.GiftWrapping` in its random gift-click pool. The existing provider SHALL own selection and an 18.5-second mount deadline; the scene SHALL finish departure and decoration removal by 18 seconds. The scene SHALL show two elves discovering the composer (0–3s), wrapping it (3–7s), trapping the helper's hat in a bow and reacting (7–10s), deliberately unwrapping it (10–14s), then proudly wearing the bow and departing with the reel (14–18s). The confetti secret SHALL remain unchanged. The app SHALL supply `newYear.giftWrappingToastMessage` through its existing label adapter; the library SHALL provide an English default and optional typed label property.

#### Scenario: Gift wrapping is selected

- **WHEN** the enabled gift scene is selected by the gift trigger or existing direct scene API
- **THEN** both elves act through all five beats without sound, their grip and hat contacts remain attached, the composer is visually released before departure, and cleanup completes within the deadline

### Requirement: Host controls remain intact

The scene SHALL measure only eligible visible composer geometry, including an already-focused composer, and SHALL never copy, hide, transform or mutate host controls. Drafts, focus, selection, chat ordering and layout SHALL remain unchanged. Host integration SHALL arrive through existing `CelebrationEnvironment` anchors and mobile/label values; no app-specific contracts SHALL enter the library. The inert aria-hidden decorative layer SHALL accept no pointer or keyboard input; the existing gift SHALL remain keyboard accessible and notifications SHALL use the host's existing announcement path.

#### Scenario: A focused composer contains a draft

- **WHEN** wrapping starts while a visible safe composer contains text and a selection
- **THEN** the same control, text, focus, selection and rectangle remain throughout playback

### Requirement: Mobile and fallback presentations preserve meaning

Both elves and all five story beats SHALL remain at 360/900 mobile and 1280/1920 desktop widths. RTL SHALL use inherited direction and actual geometry without mirroring text. Missing, clipped, hidden or spatially unsafe composers SHALL use a decorative parcel. Reduced motion or missing WAAPI/observer support SHALL show a static pair with a hat bow without measuring anchors. Plans SHALL be calculated once, with no per-frame React state updates.

#### Scenario: Only the composer is available

- **WHEN** a mobile host has no history or starters
- **THEN** the full wrapping story uses its composer if safely visible, otherwise the decorative parcel, and creates no horizontal page overflow

#### Scenario: Reduced motion or unsupported animation

- **WHEN** reduced motion is enabled or required browser APIs are missing at activation
- **THEN** the elves and hat bow are stationary, no host geometry is read and no animation is started

### Requirement: Interruption releases every resource

Preparation and playback SHALL cancel on input/composition, pointer or keyboard interaction, focus changes, scrolling, viewport/visual viewport changes, relevant source changes/removal/movement, hidden tabs, scene replacement, navigation/unmount and reduced-motion changes. Cancellation SHALL immediately remove decoration and release timers, observers, listeners and animations exactly once, including partial initialization failures. Geometry rechecks SHALL occur only in response to relevant events. Original host content SHALL require no restoration writes.

#### Scenario: Repeated activation and cancellation

- **WHEN** scenes are replayed and interrupted during preparation, wrapping, the caught-hat beat or departure
- **THEN** no decorations or active resources accumulate and ordinary input remains usable

### Requirement: Rendering cost is bounded and measured

Each run SHALL contain exactly two elves, one segmented ribbon and at most one reel/parcel, zero particles and zero snapshots. Each elf SHALL use at most 80 SVG nodes, 40 paths, 800 path commands, 3 gradients and 8 independently animated groups, with zero filters/masks. Other artwork SHALL use at most 40 SVG nodes. Selection SHALL inspect at most four composer candidates and 24 ancestors each. Desktop SHALL use at most 32 animations and 640 total keyframes; mobile at most 24 animations and 480 total keyframes. Playback SHALL use precomputed transform/opacity tracks. The change SHALL record resource tests and actual browser visual/profile evidence with viewport and CPU conditions. No API, telemetry, persistence, new dependency or feature gate SHALL be added; existing event and selection settings SHALL apply.

#### Scenario: Profile the scene

- **WHEN** the story runs at desktop and mobile sizes
- **THEN** structural budgets pass, no playback polling or accumulated resources are found, and browser frame/layout/paint observations are reported separately from unit-test results
