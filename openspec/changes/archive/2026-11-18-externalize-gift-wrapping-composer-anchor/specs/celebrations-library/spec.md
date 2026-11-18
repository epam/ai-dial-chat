# Spec Delta

## MODIFIED Requirements

### Requirement: Pack descriptors and capabilities are public API

`@epam/ai-dial-celebrations` SHALL export from `libs/celebrations/src/index.ts` the C3 shapes named in `celebration-pack-contracts` ("Library descriptors and asset-loader callbacks"):

- `CelebrationCapability`, plus `SUPPORTED_CELEBRATION_CAPABILITIES`: the read-only set this release implements, `lottie-light-svg-v1`, `viewport-stage-v1`, `composer-anchor-v1`, `interaction-composer-outline-v1`, `static-poster-v1` and `static-trigger-v1`. `composer-anchor-v1` and `interaction-composer-outline-v1` were added by S3 (#9222).
- `CelebrationSceneDescriptor`, `CelebrationSceneVariantDescriptor`, `CelebrationPlacementDescriptor` (the union of `CelebrationViewportStagePlacement` and `CelebrationComposerAnchorPlacement`), `CelebrationPackDescriptor`, `CelebrationExternalEventDescriptor` and `CelebrationAssetLoaders`.
- The string enums `CelebrationDirectionMode` (`none`, `mirror`, `variant`), `CelebrationLayout` (`mobile`, `desktop`), `CelebrationColorScheme` (`light`, `dark`), `CelebrationPlacementTemplate`, `CelebrationStageFit`/`CelebrationStageAlign`, and `CelebrationAnchor`/`CelebrationAnchorEdge`/`CelebrationAnchorFallback`.
- `CelebrationVariantContext`: `{ direction: 'ltr' | 'rtl'; colorScheme: CelebrationColorScheme }`. Layout comes from the provider's `isMobile`.

Every type reachable from these exports SHALL be exported. `libs/celebrations/README.md` SHALL document each export with a compiling example.

#### Scenario: A host checks support
- **WHEN** a host intersects a scene's `requiredCapabilities` with `SUPPORTED_CELEBRATION_CAPABILITIES`
- **THEN** `composer-anchor-v1` and `interaction-composer-outline-v1` are reported as supported, and any other `interaction-*` ID as unsupported

### Requirement: Generic Lottie scene renders one descriptor

The library SHALL provide a generic `LottieScene`, built on `useLottieSceneSession` (`libs/celebrations/src/hooks/useLottieSceneSession.ts`), that plays one `CelebrationSceneDescriptor`. It SHALL behave as follows:

- It picks the variant that matches the most of layout, direction and color scheme, with ties going to declaration order. No match means the scene is unsupported and renders its poster.
- It renders the `viewport-stage-v1` placement inside the provider's existing scene layer, with `fit` and `align`. `start`/`end` resolve against the supplied direction. `direction: mirror` flips the stage horizontally in RTL. The stage is `inert`.
- It uses the chosen variant's `placement` when present, else the scene's. A variant placement with a different template makes the scene unsupported, so it renders its poster.
- It renders the `composer-anchor-v1` placement as defined by `celebration-composer-anchoring`. It reads the composer class from `CelebrationEnvironment` `anchors.composer`, measures once after loading, applies the bounded uniform mapping and the fallback, and cancels on layout change or user interaction. When the scene requires `interaction-composer-outline-v1`, it fits that adapter's slots on a private copy of the data.
- It treats a scene as unsupported, and renders its poster, when any of these holds: its renderer is not `lottie-light-svg-v1`, a required capability is missing from `SUPPORTED_CELEBRATION_CAPABILITIES`, its placement template is unknown, or it requires `interaction-composer-outline-v1` without `composer-anchor-v1` placement.
- A `composer-anchor-v1` scene in a browser without `ResizeObserver` or `MutationObserver` renders its poster, and loads neither the player nor the data.
- It requests animation data only after the scene mounts, through `loadAnimationData(assetId, signal)`. It aborts the signal on cancellation and ignores a late resolution.
- It clones the data before the player gets it (`LottieDataOwnership.Shared`). For a `composer-anchor-v1` scene, the mapped and fitted copy is made per preparation and handed over once (`LottieDataOwnership.Transferred`).
- It uses the descriptor's `loadTimeoutMs`, `readyTimeoutMs` and `playbackDurationMs`. The provider lifetime is `maxLifetimeMs`.
- It rejects at runtime a generated SVG with more than 800 elements, treated as a failure before playback.
- Under `prefers-reduced-motion: reduce`, it renders only the poster, through `<img alt="" src={resolveImageUrl(posterAssetId)}>`, for `posterDurationMs`. It loads neither the player nor the animation data, and reads no composer geometry.
- On a failure before playback starts, it renders the poster for `posterDurationMs`, or nothing when `resolveImageUrl` returns `undefined`.
- On a failure after the first rendered frame, it releases the player, observers and listeners exactly once and renders nothing.
- It never calls `fetch`, `import()`s a URL, or injects markup through `innerHTML`.

The scene is direction-aware only through the supplied direction and logical alignment. It reads no language. Its state lives in the component and its `useLottieSceneSession` session. No new context or provider state is added. The playback object stays memoised on the descriptor's timing and placement.

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
