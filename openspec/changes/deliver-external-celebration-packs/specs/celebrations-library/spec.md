## ADDED Requirements

### Requirement: Pack descriptors and capabilities are public API

`@epam/ai-dial-celebrations` SHALL export from `libs/celebrations/src/index.ts` the C3 shapes named in `celebration-pack-contracts` ("Library descriptors and asset-loader callbacks"):

- `CelebrationCapability`, plus `SUPPORTED_CELEBRATION_CAPABILITIES`: the read-only set this release implements, `lottie-light-svg-v1`, `viewport-stage-v1`, `static-poster-v1` and `static-trigger-v1`. `composer-anchor-v1` stays unimplemented until S3.
- `CelebrationSceneDescriptor`, `CelebrationSceneVariantDescriptor`, `CelebrationPlacementDescriptor`, `CelebrationPackDescriptor`, `CelebrationExternalEventDescriptor` and `CelebrationAssetLoaders`.
- The string enums `CelebrationDirectionMode` (`none`, `mirror`, `variant`), `CelebrationLayout` (`mobile`, `desktop`), `CelebrationColorScheme` (`light`, `dark`), `CelebrationPlacementTemplate` and `CelebrationStageFit`/`CelebrationStageAlign`.
- `CelebrationVariantContext`: `{ direction: 'ltr' | 'rtl'; colorScheme: CelebrationColorScheme }`. Layout comes from the provider's `isMobile`.

Every type reachable from these exports SHALL be exported. `libs/celebrations/README.md` SHALL document each export with a compiling example.

#### Scenario: A host checks support
- **WHEN** a host intersects a scene's `requiredCapabilities` with `SUPPORTED_CELEBRATION_CAPABILITIES`
- **THEN** `composer-anchor-v1` is reported as unsupported in this release

### Requirement: Generic Lottie scene renders one descriptor

The library SHALL provide a generic `LottieScene`, built on `useLottieSceneSession` (`libs/celebrations/src/hooks/useLottieSceneSession.ts`), that plays one `CelebrationSceneDescriptor`. It SHALL behave as follows:

- It picks the variant that matches the most of layout, direction and color scheme, with ties going to declaration order. No match means the scene is unsupported and renders its poster.
- It renders the `viewport-stage-v1` placement inside the provider's existing scene layer, with `fit` and `align`. `start`/`end` resolve against the supplied direction. `direction: mirror` flips the stage horizontally in RTL. The stage is `inert`.
- It requests animation data only after the scene mounts, through `loadAnimationData(assetId, signal)`. It aborts the signal on cancellation and ignores a late resolution.
- It clones the data before the player gets it (`LottieDataOwnership.Shared`).
- It uses the descriptor's `loadTimeoutMs`, `readyTimeoutMs` and `playbackDurationMs`. The provider lifetime is `maxLifetimeMs`.
- It rejects at runtime a generated SVG with more than 800 elements, treated as a failure before playback.
- Under `prefers-reduced-motion: reduce`, it renders only the poster, through `<img alt="" src={resolveImageUrl(posterAssetId)}>`, for `posterDurationMs`. It loads neither the player nor the animation data.
- On a failure before playback starts, it renders the poster for `posterDurationMs`, or nothing when `resolveImageUrl` returns `undefined`.
- On a failure after the first rendered frame, it releases the player, observers and listeners exactly once and renders nothing.
- It never calls `fetch`, `import()`s a URL, or injects markup through `innerHTML`.

The scene is direction-aware only through the supplied direction and logical alignment. It reads no language.

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

### Requirement: Descriptor factory and scene replacement

The library SHALL export the following pure functions from a new lazy entry point `@epam/ai-dial-celebrations/packs` (`libs/celebrations/src/packs/index.ts`, beside the existing `halloween` and `new-year` entries), so `LottieScene` and the static trigger never enter the main chunk. The host imports that entry by a fixed specifier only after a pack has resolved:

- `createCelebrationSceneFromDescriptor(descriptor, loaders, context): CelebrationScene`. It returns `{ id, labelId, durationMs: timing.maxLifetimeMs, Component }`, where `Component` renders `LottieScene`.
- `replaceCelebrationScenes(event, scenes): CelebrationEvent`. It returns a new event with the same `id`, `iconUrl`, `Decoration`, `clickSceneIds`, `secretTrigger`, `decorBehaviors`, `labels` and `titleLabelId`. Only the scenes whose IDs already exist are replaced, and each replacement keeps the bundled `labelId`. Unknown IDs are ignored.
- `createCelebrationEventFromDescriptor(descriptor, loaders, context): CelebrationEvent`, for a descriptor with an `event` block. The resulting event has the descriptor's scenes, its `clickSceneIds` filtered to declared scenes, `titleLabelId`, labels taken from the pack's `en` defaults, an `iconUrl` from `resolveImageUrl(iconAssetId)`, the `static-trigger-v1` decoration, no `secretTrigger` and no `decorBehaviors`. It SHALL throw for a descriptor without an `event` block.

None of them derives an import path, reads config or performs I/O.

#### Scenario: Replacement keeps pools
- **WHEN** `replaceCelebrationScenes(newYearEvent, [snowman])` is called with an external `snowman-delivery` scene
- **THEN** the result has the same three scene IDs, the same `clickSceneIds` and the same `secretTrigger`, and only `snowman-delivery` has a new `Component` and `durationMs`

#### Scenario: Company anniversary
- **WHEN** `createCelebrationEventFromDescriptor` receives the `company-anniversary` descriptor
- **THEN** the event's decoration is the static trigger, its click pool is `confetti`, and it has no secret phrase

### Requirement: Static trigger decoration

The `static-trigger-v1` decoration SHALL be a native `<button type="button">`. Its accessible name is the resolved label named by `decoration.labelId`; when that label is empty, the English default `Play celebration` from the event's labels is used. It renders the decoration poster through `<img alt="" aria-hidden="true">` and calls `onActivate` on click, Enter and Space. It SHALL have a visible `focus-visible` indicator, and use logical CSS properties only. It SHALL declare no color of its own: the focus outline uses `currentColor` and the background is transparent, so the library adds no `*Colors` prop. It SHALL NOT read i18n.

#### Scenario: Keyboard activation
- **WHEN** a keyboard user focuses the trigger and presses Enter
- **THEN** a click scene plays, and the notification goes through the host's `onNotify`

## MODIFIED Requirements

### Requirement: DIAL Chat integrates through an app-level adapter

`apps/chat` SHALL contain no celebration scenes, scene utilities, constants or scene styles. A `CelebrationHost` component in the app SHALL render `CelebrationProvider` and resolve: `activeEventId` as `config.activeEventId` only when the user config is ready and the route is `/`; `resetKey` as the composite cancellation identity defined by `celebration-source-selection` (route key, event, delivery policy, catalog revision, resolved pack or `bundled`, theme and color scheme, direction, layout, selection revision); `events` as the compiled loaders, where a known event with allowlisted external scenes is wrapped by `replaceCelebrationScenes` and an admitted external-only event resolves to `createCelebrationEventFromDescriptor`, with no import path derived from an event ID; labels from `t()` using the existing `halloween.*` and `newYear.*` keys; `onNotify` via `showSuccessNotification`; `isMobile` via `useIsMobile`; anchors from `CONVERSATION_INPUT_CLASS`, `STARTER_BUTTONS_CLASS`, the app's own history-panel class with a link selector built from `ROUTES.Conversations`, and the welcome region; and all scenes enabled. The composer, header logo and navigation favicon SHALL consume `useCelebration` and `CelebrationDecor` from the library; the conversation panel keeps an app-owned class that only the adapter passes on. `UI_EVENT` handling SHALL be unchanged. Under the default `bundled` policy the adapter SHALL behave exactly as before this change.

#### Scenario: DIAL Chat behaves as before

- **WHEN** `UI_EVENT=halloween` and the user clicks the pumpkin on `/`
- **THEN** the same scenes, notifications, secret phrase and decor behaviours occur as before the extraction
