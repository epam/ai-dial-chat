# celebration-composer-anchoring Specification

## Purpose

How pack scenes attach to the host composer: the runtime behaviour of `composer-anchor-v1` placement and of the `interaction-composer-outline-v1` adapter. That covers composer measurement and eligibility, bounded mapping from local scene coordinates, fallback, invalidation, slot fitting and replay isolation. Defined by S3 (#9222).

## Requirements

### Requirement: The composer is measured once, with fixed eligibility rules

A `composer-anchor-v1` scene SHALL measure the composer once, after the player and data load. It inspects at most four elements with the class `anchors.composer` and 24 ancestors of each, and SHALL NOT read host geometry while loading. A candidate is eligible only when all hold:

- width ≥ `anchorRect.width × scale.min`, height 36–260
- ≥ 12 px from both side edges, ≥ 20 px above the bottom
- stage headroom above it in the viewport
- no hidden, inert, aria-hidden, invisible or clipping ancestor

#### Scenario: A focused composer with a draft
- **WHEN** a scene starts while a visible, eligible composer is focused and holds text and a selection
- **THEN** the composer is measured once, and its text, focus, selection, styles and rectangle stay unchanged throughout playback

#### Scenario: A composer clipped by a scrolling ancestor
- **WHEN** the only candidate composer extends past an ancestor with `overflow: auto`
- **THEN** it is not eligible, and the placement fallback applies

#### Scenario: Composer narrower than the stage allows
- **WHEN** `anchorRect.width` is 520, `scale.min` is 0.65 and the composer is 300 px wide
- **THEN** the composer is not eligible (300 < 338), and the placement fallback applies

### Requirement: The stage maps to the composer by a bounded uniform scale

The runtime SHALL scale the stage uniformly by `s = clamp(composerWidth / anchorRect.width, scale.min, scale.max)`, never per axis and never fitted to the viewport. It SHALL align the center of `anchorRect` with the composer's center, and its declared `edge` with the same composer edge. Content beyond the authored stage SHALL stay visible. Content outside the viewport SHALL be clipped, so the page never scrolls.

#### Scenario: Ribbon beyond the authored stage
- **WHEN** a 1200 × 280 stage is anchored to a composer 1500 px wide
- **THEN** content drawn beyond the stage's 1200 px stays visible inside the viewport, and the page does not scroll horizontally

#### Scenario: Wide desktop composer
- **WHEN** `anchorRect` is 520 × 56 with `scale.max` 1, `edge` is `top` and the composer is 900 × 72
- **THEN** `s` is 1, the stage's anchor top edge sits on the composer's top edge, and its anchor center sits on the composer's center

#### Scenario: Narrow phone composer
- **WHEN** `anchorRect` is 300 × 56 with `scale.min` 0.77, and the composer is 270 px wide
- **THEN** `s` is 0.9 on both axes, and no element of the stage is stretched

### Requirement: Mirroring follows the anchor

When the scene declares `direction: mirror` and the supplied direction is `rtl`, the runtime SHALL flip the stage horizontally around the vertical center line of `anchorRect`, so that the mirrored anchor stays centered on the composer. `direction: variant` SHALL select the RTL variant instead, with no flip. Neither mode reads the UI language.

#### Scenario: RTL mirrored scene
- **WHEN** a `mirror` scene plays in an RTL document with a composer centered at x = 700
- **THEN** the stage is flipped, its anchor center remains at x = 700, and characters that enter from the inline start in LTR enter from the right

### Requirement: Fallback when no composer is eligible

With no eligible composer, `fallback: poster` SHALL show the scene poster for `posterDurationMs`. `fallback: stage-anchor` SHALL map the stage to a synthetic anchor:

- size: `anchorRect × scale.min`, at `s = scale.min`
- horizontally centered
- top at 57 % of the viewport height, kept below the stage headroom and above a 26 px bottom margin

When the synthetic anchor does not fit inside 12 px side margins, the poster SHALL be used.

#### Scenario: Composer removed before activation
- **WHEN** a `stage-anchor` scene starts on a page with no element of class `anchors.composer`
- **THEN** the scene plays around the synthetic anchor, and no layout is read beyond that one measurement

#### Scenario: Viewport too narrow for the synthetic anchor
- **WHEN** no composer is eligible and the viewport is narrower than the synthetic anchor plus 24 px
- **THEN** the poster shows, and no renderer is created

### Requirement: Layout changes cancel instead of re-mapping

Once measured, an anchored scene SHALL be cancelled, never re-mapped, when:

- the composer moves or resizes by > 0.5 px, disconnects, or it or an ancestor mutates
- the viewport or visual viewport resizes or scrolls, or the tab is hidden
- the user points, clicks, types, focuses, inputs or composes

Layout, direction or variant changes end it through the host reset key. Scene-layer mutations are ignored. Checks run only on events, never per frame.

#### Scenario: The user starts typing
- **WHEN** the user presses a key while an anchored scene plays
- **THEN** the scene is removed immediately, and its player, observers, listeners and timers are released exactly once

#### Scenario: The renderer updates its own SVG
- **WHEN** the Lottie renderer changes attributes or children inside the scene layer
- **THEN** no composer geometry is read and playback continues

### Requirement: The outline adapter fits the composer-outline slot

A scene that requires `interaction-composer-outline-v1` SHALL have one Lottie layer named `composer-outline`, with a static identity transform and exactly one static path. At preparation the adapter SHALL replace that path's vertices with a closed contour around the anchor in stage units. The contour starts at the top-edge center, runs toward the authored inline end, and is inset by at most 4 CSS px. Stroke, trim and timing stay as authored.

#### Scenario: Ribbon traces a tall composer
- **WHEN** an anchored GiftWrapping variant authored around a 520 × 56 anchor plays on a composer of 900 × 140
- **THEN** the drawn ribbon follows the 900 × 140 border, while the characters keep their authored size

#### Scenario: Slot missing
- **WHEN** a scene requires `interaction-composer-outline-v1` but its animation has no `composer-outline` layer, or has two
- **THEN** preparation fails before playback, and the poster shows

### Requirement: The parcel slot exists only for a synthetic anchor

An optional single layer named `composer-parcel`, with a static identity transform and exactly one static rectangle, SHALL be removed when a real composer is measured. For a synthetic anchor, the adapter SHALL resize the rectangle to that anchor. Layers other than the two slots SHALL be left unchanged.

#### Scenario: Decorative parcel on a page without a composer
- **WHEN** an outline scene falls back to `stage-anchor`
- **THEN** the parcel rectangle matches the synthetic anchor, and the outline wraps the parcel

### Requirement: Preparation never mutates loaded data

Anchor mapping and adapter fitting SHALL work on a private deep copy of the loaded animation. The object returned by `loadAnimationData` SHALL remain deep-equal to its first value after any number of activations, and every activation's player SHALL receive a newly built object. A resolution that arrives after cancellation SHALL start no player and SHALL NOT update any state.

#### Scenario: Replay after a cached load
- **WHEN** GiftWrapping plays on a 900 px composer, is cancelled, and then plays again on a 340 px composer from the host's cached animation
- **THEN** the second contour matches the 340 px composer, and the cached object equals the original asset

#### Scenario: Late data after cancellation
- **WHEN** a scene is cancelled while `loadAnimationData` is pending, and the promise then resolves
- **THEN** no renderer is created, no composer is measured, and nothing renders

### Requirement: Anchored scenes stay decorative and host-agnostic

Anchored scenes SHALL render inside the provider's scene layer as `inert`, `aria-hidden` and pointer-transparent elements, and SHALL announce nothing beyond the provider's notification. The anchor arrives only as the `anchors.composer` class name through `CelebrationEnvironment`, which `CelebrationHost` supplies. The library SHALL receive no selectors, URLs, routes, config or feature flags.

#### Scenario: Keyboard user during playback
- **WHEN** a keyboard user tabs while an anchored scene plays
- **THEN** focus never enters the scene, the scene is cancelled, and focus moves to the next host control as usual

### Requirement: The external GiftWrapping path has committed browser coverage

A committed browser suite SHALL drive the published GiftWrapping assets through the anchored `LottieScene`, using the baseline harness `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs`. The assets are the `new-year-default@1.1.1` variants, pinned by their `sha256`. The suite SHALL cover delayed and broken loads, cancellation during loading and during playback, cached replay, contact at 360/390/1280/1920 px in LTR and RTL, and the `stage-anchor` fallback.

#### Scenario: Slow and broken loads
- **WHEN** the loader resolves after `loadTimeoutMs`, or rejects at once
- **THEN** the poster shows for `posterDurationMs`, and no renderer is inserted

#### Scenario: Cancellation during playback
- **WHEN** a key press arrives 6 s into the external GiftWrapping playback
- **THEN** the renderer, observers and listeners are released once, and the composer's draft, focus and rectangle are unchanged

#### Scenario: Cached replay
- **WHEN** the scene plays twice from the same loaders on composers of different widths
- **THEN** the data is requested once, each replay's contour matches its composer, and the cached object stays equal to the pinned asset

#### Scenario: Contact and fallback frames
- **WHEN** the suite captures the wrap, the pull and the departure at each width in LTR and RTL, and once without a composer
- **THEN** the feet stay on the measured top edge, the ribbon traces the composer or the synthetic parcel, and the frames are saved with the change's evidence

### Requirement: Anchored preparation time is measured under CPU throttling

Apply SHALL measure the preparation of the external GiftWrapping and of the external Cat in Chromium under 4× CPU throttling, over at least 20 runs on real host geometry. For GiftWrapping, that is the measurement, the private copy, the mapping and the slot fitting. For the Cat, it also covers target discovery, retargeting, the time remap, the copy tracks and snapshot cloning. It SHALL report p50 and p95 against the 50 ms target. Native frame-time measurements SHALL NOT replace it.

#### Scenario: Recorded measurement
- **WHEN** the preparation benchmark runs at 1280 and 390 px under 4× throttling
- **THEN** the p50 and p95 preparation times of both scenes are recorded with the revision, and any p95 above 50 ms is reported as a finding, never silently accepted
