# Spec Delta

## MODIFIED Requirements

### Requirement: Pack descriptors and capabilities are public API

`@epam/ai-dial-celebrations` SHALL export from `libs/celebrations/src/index.ts` the C3 shapes named in `celebration-pack-contracts` ("Library descriptors and asset-loader callbacks"):

- `CelebrationCapability`, plus `SUPPORTED_CELEBRATION_CAPABILITIES`: the read-only set this release implements, `lottie-light-svg-v1`, `viewport-stage-v1`, `composer-anchor-v1`, `interaction-composer-outline-v1`, `interaction-cat-borrow-v1`, `interaction-copy-track-v1`, `static-poster-v1` and `static-trigger-v1`. `composer-anchor-v1` and `interaction-composer-outline-v1` were added by S3 (#9222). `interaction-cat-borrow-v1` (`CelebrationCapability.InteractionCatBorrowV1`) was added by S4 (#9223). `interaction-copy-track-v1` (`CelebrationCapability.InteractionCopyTrackV1`) was added by S7 batch 1 (#9226).
- `CelebrationSceneDescriptor`, `CelebrationSceneVariantDescriptor`, `CelebrationPlacementDescriptor` (the union of `CelebrationViewportStagePlacement` and `CelebrationComposerAnchorPlacement`), `CelebrationPackDescriptor`, `CelebrationExternalEventDescriptor` and `CelebrationAssetLoaders`.
- The string enums `CelebrationDirectionMode` (`none`, `mirror`, `variant`), `CelebrationLayout` (`mobile`, `desktop`), `CelebrationColorScheme` (`light`, `dark`), `CelebrationPlacementTemplate`, `CelebrationStageFit`/`CelebrationStageAlign`, and `CelebrationAnchor`/`CelebrationAnchorEdge`/`CelebrationAnchorFallback`.
- `CelebrationVariantContext`: `{ direction: 'ltr' | 'rtl'; colorScheme: CelebrationColorScheme }`. Layout comes from the provider's `isMobile`.

Every type reachable from these exports SHALL be exported. The adapters' marker parser, retargeting, stretching, span solver, time-remap, step-cycle and copy-track helpers are internal and SHALL NOT be exported. `libs/celebrations/README.md` SHALL document each export with a compiling example.

#### Scenario: A host checks support
- **WHEN** a host intersects a scene's `requiredCapabilities` with `SUPPORTED_CELEBRATION_CAPABILITIES`
- **THEN** `composer-anchor-v1`, `interaction-composer-outline-v1`, `interaction-cat-borrow-v1` and `interaction-copy-track-v1` are reported as supported, and any other `interaction-*` ID as unsupported

### Requirement: Generic Lottie scene renders one descriptor

The library SHALL provide a generic `LottieScene`, built on `useLottieSceneSession` (`libs/celebrations/src/hooks/useLottieSceneSession.ts`), that plays one `CelebrationSceneDescriptor`. It SHALL behave as follows:

- It picks the variant that matches the most of layout, direction and color scheme, with ties going to declaration order. No match means the scene is unsupported and renders its poster.
- It renders the `viewport-stage-v1` placement inside the provider's existing scene layer, with `fit` and `align`. `start`/`end` resolve against the supplied direction. `direction: mirror` flips the stage horizontally in RTL. The stage is `inert`.
- It uses the chosen variant's `placement` when present, else the scene's. A variant placement with a different template makes the scene unsupported, so it renders its poster.
- It renders the `composer-anchor-v1` placement as defined by `celebration-composer-anchoring`. It reads the composer class from `CelebrationEnvironment` `anchors.composer`, measures once after loading, applies the bounded uniform mapping and the fallback, and cancels on layout change or user interaction. When the scene requires `interaction-composer-outline-v1`, it fits that adapter's slots on a private copy of the data.
- When the scene requires `interaction-cat-borrow-v1`, it runs that adapter as defined by `celebration-ui-borrowing`, after the anchor mapping and on the same private copy:
  - It reads `anchors.composer`, `anchors.starterList` and `anchors.welcomeRegion` from `CelebrationEnvironment`. A change to any of them ends the scene.
  - It prepares the borrowed copies before readiness, starts them from `onPlaybackStarted` on the reported `timelineZeroMs`, and watches every borrowed target as well as the composer.
- When the scene requires `interaction-copy-track-v1`, it runs that adapter as defined by `celebration-copy-track`, after the anchor mapping and on the same private copy:
  - It reads `anchors.composer`, `anchors.starterList` and `anchors.welcomeRegion` from `CelebrationEnvironment`, and the supplied direction. A change to any of them ends the scene.
  - It prepares the copies before readiness, starts them from `onPlaybackStarted` on the reported `timelineZeroMs`, and watches every copied or measured target as well as the composer.
- It treats a scene as unsupported, and renders its poster, when any of these holds:
  - its renderer is not `lottie-light-svg-v1`
  - a required capability is missing from `SUPPORTED_CELEBRATION_CAPABILITIES`
  - its placement template is unknown
  - it requires `interaction-composer-outline-v1`, `interaction-cat-borrow-v1` or `interaction-copy-track-v1` without `composer-anchor-v1` placement
  - it requires `interaction-cat-borrow-v1` or `interaction-copy-track-v1` with a `direction` other than `none`
  - it requires more than one `interaction-*` adapter
- A `composer-anchor-v1` scene renders its poster, and loads neither the player nor the data, in a browser without `ResizeObserver` or `MutationObserver`. A cat-borrow or copy-track scene does the same in a browser without `Element.prototype.animate`.
- It requests animation data only after the scene mounts, through `loadAnimationData(assetId, signal)`. It aborts the signal on cancellation and ignores a late resolution.
- It clones the data before the player gets it (`LottieDataOwnership.Shared`). For a `composer-anchor-v1` scene, the mapped and fitted copy is made per preparation and handed over once (`LottieDataOwnership.Transferred`).
- It uses the descriptor's `loadTimeoutMs`, `readyTimeoutMs` and `playbackDurationMs`. The provider lifetime is `maxLifetimeMs`. A cat-borrow or copy-track scene whose selected section is shorter than `playbackDurationMs` completes at that section's end.
- It rejects at runtime a generated SVG with more than 800 elements, treated as a failure before playback.
- Under `prefers-reduced-motion: reduce`, it renders only the poster, through `<img alt="" src={resolveImageUrl(posterAssetId)}>`, for `posterDurationMs`. It loads neither the player nor the animation data, reads no composer geometry and borrows no control.
- On a failure before playback starts, it renders the poster for `posterDurationMs`, or nothing when `resolveImageUrl` returns `undefined`. Malformed adapter markers or slots and a failed snapshot are failures before playback.
- On a failure after the first rendered frame, it releases the player, observers, listeners and borrowed copies exactly once, restores every original, and renders nothing.
- It never calls `fetch`, `import()`s a URL, or injects markup through `innerHTML`.

The scene is direction-aware only through the supplied direction and logical alignment. A cat-borrow scene is direction-aware only through physical geometry. A copy-track scene is direction-aware through physical geometry and the supplied direction's preferred travel side. It reads no language. Its state lives in the component and its `useLottieSceneSession` session. No new context or provider state is added. The playback object stays memoised on the descriptor's timing, its placement and the selected adapter.

#### Scenario: Reduced motion
- **WHEN** reduced motion matches at activation of an external scene
- **THEN** only the poster `<img>` renders, and neither `loadAnimationData` nor the player import is called

#### Scenario: Cancellation during load
- **WHEN** the scene unmounts while `loadAnimationData` is pending
- **THEN** the signal is aborted, a later resolution starts no player, and no state update happens after cleanup

#### Scenario: Failure after playback started
- **WHEN** the player emits `data_failed` after the first frame
- **THEN** the scene is torn down once and renders nothing, with no poster

#### Scenario: RTL mirror
- **WHEN** `direction` is `mirror`, the supplied direction is `rtl`, and `align` is `bottom-start`
- **THEN** the stage is flipped horizontally and anchored to the inline-start (right) bottom corner

#### Scenario: Anchored scene on an eligible composer
- **WHEN** a `composer-anchor-v1` scene plays and the composer is eligible
- **THEN** the stage element is positioned once from the measured composer, and is not repositioned during playback

#### Scenario: Missing observer APIs
- **WHEN** `ResizeObserver` is undefined and a `composer-anchor-v1` scene activates
- **THEN** the poster renders, and the player is not imported

#### Scenario: Mobile variant placement on a tablet
- **WHEN** a mobile-layout host plays an anchored scene whose mobile variant declares `anchorRect 300 × 56` and `scale.max 1`, and the composer is 736 px wide
- **THEN** the mobile variant loads, the stage maps at scale 1 around the variant's anchor, and the characters keep their authored size

#### Scenario: Cat-borrow scene starts its copies on the Lottie clock
- **WHEN** a cat-borrow scene reaches its first rendered frame with two borrowed buttons
- **THEN** both copies and both originals' opacity animations start with the reported `timelineZeroMs` as their start time, and no other component re-renders the scene

#### Scenario: Starter anchor changes mid-scene
- **WHEN** `anchors.starterList` changes while a cat-borrow scene plays
- **THEN** the scene ends, every original is restored, and nothing renders

#### Scenario: Copy-track scene starts its copy on the Lottie clock
- **WHEN** a copy-track scene reaches its first rendered frame with a `starter-card` copy
- **THEN** the copy and the original's opacity animation start with the reported `timelineZeroMs` as their start time, and no other component re-renders the scene

#### Scenario: Copy-track scene with a second adapter
- **WHEN** a scene requires `interaction-copy-track-v1` and `interaction-composer-outline-v1`
- **THEN** it is unsupported and renders its poster
