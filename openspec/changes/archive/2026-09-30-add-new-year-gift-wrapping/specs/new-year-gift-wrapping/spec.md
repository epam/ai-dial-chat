## ADDED Requirements

### Requirement: The gift offers a finite wrapping story

New Year SHALL register `NewYearScene.GiftWrapping` in its random gift-click pool. The existing provider SHALL own selection and an 18.5-second mount deadline. The scene SHALL play one non-looping 16-second Lottie composition after at most two seconds of importing the player plus 250 ms of SVG initialization. The scene SHALL show two elves arriving at the composer corners while the master surveys the work, wrapping the composer, pausing proudly before the helper leans back to pull a loose ribbon end, and accidentally winding ribbon around the master while the composer unwraps. It SHALL hold the awkward result while the stunned master and the helper's double take establish the joke, then show the helper proudly presenting his work while the master makes frustrated little hops because a ribbon tail joins his torso cocoon to an ankle band. The master SHALL hop away with a chest bow and the helper SHALL follow with the reel. Departure and decoration removal SHALL finish before the mount deadline. The confetti secret SHALL remain unchanged. The app SHALL supply `newYear.giftWrappingToastMessage` through its existing label adapter; the library SHALL provide an English default and optional typed label property. The revision SHALL add no new labels or public API.

#### Scenario: Gift wrapping is selected

- **WHEN** the enabled gift scene is selected by the gift trigger or existing direct scene API
- **THEN** both elves act through the setup, pull, reversal, reaction and hopping departure without sound, the helper's tension ribbon remains attached to his actual hand and the master's torso ribbon attachment, the cocoon follows the master's torso, the composer is visually released before departure, and cleanup completes within the deadline

### Requirement: Character movement and ribbon continuity support the joke

Both elves SHALL use the user-selected mischievous, expressive cartoon style. The master SHALL have a stocky green silhouette and officious posture; the helper SHALL have a nimble coral silhouette and eager posture. Smaller noses, readable eyebrows and grins SHALL distinguish their reactions at actual mobile and desktop scene sizes on light and dark surfaces. Animated native vectors and the static SVG fallback SHALL use the same revised character design. Expression, surprise and annoyed face groups SHALL be mutually exclusive; the static bound master SHALL look annoyed. The master SHALL change from composed to stunned and frustrated. The helper SHALL anticipate the pull, perform a double take and then proudly present the accidental result. The scene SHALL provide a visible proud pause before the pull and an awkward hold after the cocoon reveal; the master's hop preparation and landing recovery SHALL communicate frustration without sound.

The native-vector Lottie composition SHALL use a 60 fps timeline with subframe interpolation. Continuous movement SHALL use sparse intentional Bézier easing, with no repeatedly eased global pose-sampling grid and no facing interpolation through zero scale. Composer wrapping SHALL advance continuously along a rounded contour from the working grip using trim paths, then retract as front/back loops wind around the master's torso. Grips, loose ribbon, torso loops and carried reel SHALL share contact geometry throughout their interactions. The pull SHALL precede the master's physical reaction.

#### Scenario: Watch the reversal at normal speed

- **WHEN** the full scene plays at its intended mobile or desktop size
- **THEN** the two roles, the helper's pull causing the master's wrapping, and their contrasting reactions are visible without relying on tiny details, text or audio, and intermediate ribbon states follow a continuous route around the composer and body

#### Scenario: A movement crosses authored keyframes

- **WHEN** entrance, pull or hopping movement passes an intermediate timeline position
- **THEN** its position and orientation follow the intended continuous curve without a stop at each old pose sample or a zero-width facing flip

### Requirement: Compact arm geometry remains connected to its props

The characters SHALL use a compact articulated shoulder-to-grip reach of about 37 native-coordinate units instead of the previous 70-unit reach. Shoulder, elbow, wrist and mitten SHALL remain connected throughout wrapping, anticipated pulling, reaction and presentation poses, with stable segment lengths and small artwork overlaps that prevent joint gaps. Elbow bends SHALL stay positive within the 20–120-degree working range; the master's sleeve SHALL remain behind his head so gestures do not cover his face. A shared scene-local rig SHALL define the geometry used by source SVG artwork and composition contact calculations, and native vector transforms SHALL agree with that rig. Ribbon and reel grips SHALL follow the actual transformed hand under body lean, responsive scaling and RTL mirroring; duplicated 35-unit arm assumptions SHALL NOT remain in contact calculations. The artwork revision SHALL preserve the existing plot, 16-second timeline, player/lifecycle contract and numerical rendering budgets.

#### Scenario: Short arms pull and present the ribbon

- **WHEN** either character passes through the working, pull and presentation poses on mobile or desktop in LTR or RTL
- **THEN** the upper arm, elbow, forearm, wrist and mitten remain connected with compact proportions, and the ribbon or reel grip remains on the actual hand rather than its former position

#### Scenario: Static fallback uses the same redesigned characters

- **WHEN** reduced motion, missing browser support or a player failure selects stationary artwork
- **THEN** the bound master and proud helper retain the revised silhouettes, smaller noses, expressive faces and compact connected arms without starting Lottie or changing fallback behavior

### Requirement: Host controls remain intact

The scene SHALL measure only eligible visible composer geometry, including an already-focused composer, and SHALL never copy, hide, transform or mutate host controls. Drafts, focus, selection, chat ordering and layout SHALL remain unchanged. Host integration SHALL arrive through existing `CelebrationEnvironment` anchors and mobile/label values; no app-specific contracts SHALL enter the library. The inert aria-hidden decorative layer SHALL accept no pointer or keyboard input; the existing gift SHALL remain keyboard accessible and notifications SHALL use the host's existing announcement path. Scene-local React state SHALL own preparation, fallback and termination; pure composition data SHALL own choreography, and the private player adapter SHALL own the Lottie instance.

#### Scenario: A focused composer contains a draft

- **WHEN** wrapping starts while a visible safe composer contains text and a selection
- **THEN** the same control, text, focus, selection and rectangle remain throughout playback

### Requirement: Mobile and fallback presentations preserve meaning

Both elves and all story beats SHALL remain at 360/900 mobile and 1280/1920 desktop widths. RTL SHALL use inherited direction and actual geometry without mirroring text. Mobile staging SHALL reduce travel and secondary motion while retaining the proud pause, reversal, double take and frustrated hops. Missing, clipped, hidden or spatially unsafe composers SHALL use a decorative parcel. Reduced motion or missing required browser APIs SHALL show the revised static SVG bound master with his chest bow beside the proud helper without requesting Lottie or measuring anchors. Import failure, loading timeout or rendering failure SHALL also select the static illustration and release any initialized player. The scene SHALL request the light SVG player only for animated activation, wait at most two seconds for its import and a further 250 ms for SVG readiness, ignore late results after termination, and perform no host geometry reads while importing the player. After import it SHALL measure the target and calculate the composition once, then start playback only after SVG readiness, with no per-frame React state updates.

#### Scenario: Only the composer is available

- **WHEN** a mobile host has no history or starters
- **THEN** the full wrapping story uses its composer if safely visible, otherwise the decorative parcel, and creates no horizontal page overflow

#### Scenario: Reduced motion or unsupported animation

- **WHEN** reduced motion is enabled or required browser APIs are missing at activation
- **THEN** the bound master, chest bow and proud helper are stationary, no host geometry is read, the Lottie player is not requested and no animation is started

#### Scenario: Player loading fails or exceeds its deadline

- **WHEN** importing or initializing the player fails, or import exceeds two seconds or SVG readiness exceeds a further 250 ms
- **THEN** the static illustration appears, resources are released, waiting for the player import has performed no host geometry reads, and a late import result cannot start playback

### Requirement: Interruption releases every resource

Preparation and playback SHALL cancel on input/composition, pointer or keyboard interaction, focus changes, scrolling, viewport/visual viewport changes, relevant source changes/removal/movement, hidden tabs, scene replacement, navigation/unmount and reduced-motion changes. Cancellation SHALL immediately remove decoration and release timers, observers and listeners. Completion, error, timeout and unmount SHALL destroy an initialized Lottie instance exactly once, including partial initialization failures, without invoking global player controls. Geometry rechecks SHALL occur only in response to relevant events. Mutations inside the decorative layer, including generated Lottie SVG updates, SHALL NOT cancel playback. Original host content SHALL require no restoration writes.

#### Scenario: Repeated activation and cancellation

- **WHEN** scenes are replayed and interrupted during loading, preparation, wrapping, the cocoon reveal or departure
- **THEN** no decorations, players or active resources accumulate, late loading cannot restart a cancelled scene, and ordinary input remains usable

#### Scenario: Lottie updates its own SVG

- **WHEN** the renderer changes attributes or descendants within the decorative layer
- **THEN** source observers ignore those mutations, while actual composer or ancestor changes still invalidate playback

### Requirement: Rendering cost is bounded and measured

Each run SHALL contain exactly two elves, at most one Lottie instance, one ribbon, at most one reel and one fallback parcel, zero particles and zero snapshots. The composition SHALL contain at most 12 top-level layers, generate at most 500 SVG descendants and 180 rendered path nodes, and use no filters or masks. Static native-vector artwork SHALL be at most 80 KB minified with at most 900 Bézier vertices. The serialized viewport composition SHALL be at most 240 KB, with at most 1,400 keyframes across animated properties. The incremental production scene/player payload SHALL be at most 80 KB gzip. Selection SHALL inspect at most four composer candidates and 24 ancestors each in one preparation pass after the player import resolves. Playback SHALL perform no scene-owned geometry polling or per-frame DOM reads or React updates.

The change SHALL record resource tests, actual production chunk sizes and actual browser visual/profile evidence with viewport and CPU conditions, distinguishing the current character/rig revision from both prior WAAPI evidence and earlier Lottie artwork evidence. `lottie-web` SHALL be a private runtime dependency loaded through the scene; hosts SHALL NOT need to install or configure a new peer. Animation data SHALL be locally authored vectors with no external asset URLs, fonts, raster images or expressions. No API, telemetry, persistence, feature gate or other scene-engine migration SHALL be added; existing event and selection settings SHALL apply.

#### Scenario: Profile the scene

- **WHEN** the story runs at desktop and mobile sizes
- **THEN** structural and production payload budgets pass, no playback geometry polling or accumulated resources are found, and browser frame/layout/paint observations are reported separately from unit-test results and authored timeline frame rate
