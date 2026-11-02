# new-year-reindeer-takeoff Specification

## Purpose

Define the finite New Year reindeer celebration in which an adult and calf walk along the composer rim, release a ribbon caught on a copied word and fly away with a sleigh and snow trail, preserving the editor, accessible fallbacks and bounded rendering cost.

## Requirements

### Requirement: Reindeer release the caught ribbon before takeoff

The compiled New Year scene SHALL show two distinct articulated reindeer and one gift sleigh for 23 seconds. They SHALL walk along the measured upper composer rim; the ribbon SHALL catch a short visible word from its textarea value or placeholder, two resisted pulls SHALL lift an inert copy, and the calf SHALL release it with its nose while standing on the rim. The copy SHALL return before takeoff. The textarea value, placeholder, focus, selection, styles and native editing state SHALL remain unchanged. The copy SHALL contain <=32 characters in <=280 × 48 px and use two inert DOM elements including the original-pixel cover.

#### Scenario: Empty composer
- **WHEN** the editor has a visible placeholder on a flat opaque background
- **THEN** the ribbon catches its first word, lifts the copy above the rim under tension, and restores the original appearance before departure

#### Scenario: Composer contains a draft
- **WHEN** a visible draft word can be measured safely
- **THEN** the same interaction uses that word without modifying the draft, native editor or selection

#### Scenario: Missing or unsuitable text
- **WHEN** no safely measurable word exists, including scrolled, clipped or invisible text or a non-flat background
- **THEN** the same rim story uses a drawn catch; a host without anchors uses a self-contained stage

#### Scenario: Supported walk and visible flight
- **WHEN** the full scene runs
- **THEN** the ground phase clips to the input width with hooves on its top edge, the stage opens at takeoff, and both deer and the sleigh remain visible through 20.5 seconds before physically departing

### Requirement: Contact and inertia are visible

Grounded walking SHALL advance each foot by traveled distance, keep planted hooves on the rim, and solve the two leg joints and sole rotation from the supported body pose. Pulls and takeoff SHALL include body compression and weight transfer. The calf SHALL turn before its return walk. The flight arc SHALL preserve velocity at its joins; the calf and sleigh SHALL begin their climb 0.2 and 0.35 seconds after the adult. Harness, nose grip and snow emission SHALL follow the rendered poses, including lean and sleigh pitch. All solving SHALL occur before playback.

The adult and calf SHALL have distinct body/head proportions and antlers, curved torso/neck contours and coordinated neck, head, gaze and ear poses. The adult's effort and the calf's curiosity/reaction SHALL remain readable at scene size. Forelegs and hind legs SHALL bend in distinct directions with staggered walking contacts. After takeoff, the legs SHALL extend, fold and settle into a held glide pose instead of continuing a periodic walking motion. Static fallbacks SHALL retain the revised character design.

Drawing integrity SHALL constrain articulation: head/neck and leg/body joins SHALL remain coherent through transitions, and the calf's facing change SHALL preserve a full-width silhouette rather than interpolate through horizontal collapse. Added physical accuracy or detail SHALL NOT substitute for readable poses.

#### Scenario: Ground contact in the native renderer
- **WHEN** walking and bracing frames are sampled at 30 fps on desktop, mobile and RTL
- **THEN** each planted sole is within 2 px of its intended point and drifts less than 2.5 px between successive samples in the same stance

#### Scenario: Taking up the load
- **WHEN** the adult starts its climb
- **THEN** the calf follows, the sleigh responds last with a small settling pitch, and the formation travels continuously through its climb and departure

#### Scenario: Expressive release and settled flight
- **WHEN** the calf notices and releases the caught loop
- **THEN** its gaze, ears, neck and head support the action while the rendered nose stays attached to the loop through the lift
- **AND** the adult and calf transition from their launch pose to tucked legs and a relaxed glide with distinct reactions

### Requirement: Snow remains behind the airborne sleigh

The scene SHALL deposit at most 24 snow clusters on desktop and 16 on mobile at past sleigh positions during flight. Each cluster SHALL drift downward and fade within 2.8 seconds, leaving a visible trail rather than following the cast. All snow SHALL disappear by 23 seconds or immediately on cancellation.

#### Scenario: The formation leaves
- **WHEN** the reindeer and sleigh exit
- **THEN** a short snow wake remains along their recent route and fades before session completion

### Requirement: Adaptation and cleanup preserve ordinary chat

The existing session SHALL own playback and disposal. Both characters and every story beat SHALL remain on mobile at reduced scale/travel with at most 16 snow clusters; desktop SHALL use at most 24. RTL SHALL follow measured direction without mirroring copied text. Reduced motion, unsupported APIs, failed player or unsuitable geometry SHALL show an inert static resolution without borrowing. Input, focus, pointer, scrolling, viewport/target/direction changes, hidden tabs, navigation and unmount SHALL release originals, copies, player, timers, listeners and observers immediately. The scene SHALL be aria-hidden and pointer-transparent, sound-independent, and activated through the existing keyboard-operable host flow. No new feature gate, caching, telemetry or API SHALL be introduced; existing event opt-in and scene selection apply.

#### Scenario: Interruption under tension
- **WHEN** a user types, clicks, scrolls or changes the viewport while the word is lifted
- **THEN** the original immediately returns and the scene and all owned resources are removed

#### Scenario: Reduced motion
- **WHEN** reduced motion is active at selection
- **THEN** a static adult and calf with the freed loop appear without player loading or host measurement

### Requirement: The scene has bounded rendering cost

The scene SHALL use one lazy light-SVG player, <=500 KB composition data, <=24 top-level layers, <=110 animated properties, <=7000 total keyframes, <=380 keys per property, <=320 generated SVG nodes, <=140 paths and <=2000 vertices. Load/readiness/playback limits SHALL be 2000/250/23000 ms with a 25500 ms provider deadline. It SHALL have no per-frame host measurement, React updates, remote/raster artwork, filters or masks. Preparation SHALL scan <=4 composers, <=4 textareas, <=24 background ancestors and <=512 text characters; it SHALL remove its disposable measurement mirror before playback. At most four WAAPI companions SHALL share the renderer clock. Verification SHALL include budget tests plus real browser playback, contact inspection, profiles and repeated cancellation without resource accumulation.

#### Scenario: Repeated playback
- **WHEN** the scene completes or is interrupted repeatedly
- **THEN** no player, copy, observer or listener accumulates and measured rendering/data counts stay within budget
