## ADDED Requirements

All requirements below are **[Contract]**: S0 fixes them and S1–S4 implement them. Requirements marked **[Invariant]** describe behavior that exists at `1cfb11468`.

### Requirement: One pinned player profile

**[Contract]** Renderer capability `lottie-light-svg-v1` SHALL mean exactly these settings:

- player package `lottie-web` at **5.13.0**, the version resolved in `package-lock.json:19162-19166` (the manifest declares `^5.13.0`, `libs/celebrations/package.json:34`)
- player entry `lottie-web/build/player/lottie_light`
- renderer `svg`
- `loadAnimation` options `{ renderer: 'svg', loop: false, autoplay: false, animationData, rendererSettings: { progressiveLoad: false, preserveAspectRatio: 'xMidYMid meet', focusable: false } }`
- `setSubframe(true)`

These settings are the ones the existing GiftWrapping scene uses today (`libs/celebrations/src/new-year/utils/gift-wrapping-player.ts:9-13`, `libs/celebrations/src/new-year/utils/gift-wrapping-animation.ts:74-86`).

In the installed 5.13.0 build, `lottie_light` registers only the `svg` renderer, registers no effects, and installs an expressions plugin only through an explicit `installPlugin('expressions', …)` call. No code makes that call.

A new player version, a different build, or another renderer SHALL get a new capability ID. It SHALL NOT silently redefine `lottie-light-svg-v1`. The player SHALL stay in a lazily imported chunk.

#### Scenario: The resolved player version drifts
- **WHEN** an install resolves `lottie-web` to a version other than 5.13.0
- **THEN** the profile check fails (the check itself is implemented in S1 or S2), and assets are not certified for `lottie-light-svg-v1` until they are re-verified and the capability ID decision is recorded

#### Scenario: Existing lazy player
- **WHEN** a New Year event is loaded but no Lottie scene has been activated
- **THEN** **[Invariant]** the `lottie_light` chunk has not been requested, because `loadGiftWrappingPlayer` imports it dynamically only after the scene is prepared

### Requirement: Allowed Lottie JSON subset

**[Contract]** An animation asset for `lottie-light-svg-v1` SHALL meet all of the following:

- It is Bodymovin/Lottie JSON with `v` in `5.x` and no newer than `5.13.0`, and its `fr` is in 24–60.
- `ip`, `op`, `w` and `h` are finite, with `0 ≤ ip < op` and `1 ≤ w,h ≤ 4096`.
- `ddd` is `0`.
- It contains only shape layers (`ty: 4`), null layers (`ty: 3`) and precomposition layers (`ty: 0`) that reference IDs in its own `assets`.
- It contains no image layers (`ty: 2`), text layers (`ty: 5`), audio layers (`ty: 6`) or camera layers (`ty: 13`).
- It contains no expressions (`x` on any property), no effects (`ef`), no `fonts` or `chars`, and no asset with `u`/`p` file references.
- It contains no embedded data URIs.
- It stays within the structure caps in `celebration-pack-contracts`.

Masks and track mattes are allowed only after they render correctly in the pinned player for that asset. Verification in the pinned player is mandatory, in addition to verification in the authoring tool.

#### Scenario: An exported text layer
- **WHEN** an export contains a `ty: 5` text layer
- **THEN** publication rejects the asset, because the profile carries no fonts and has no locale-aware text

#### Scenario: An expression slipped into a property
- **WHEN** any property in the JSON has an `x` expression string
- **THEN** the asset is invalid, even though the light player would ignore the expression

### Requirement: Coordinate system

**[Contract]** Each composition SHALL be authored in its own stage coordinates:

- The origin is at the top-left, x grows right and y grows down.
- The unit is one CSS pixel at stage scale 1.
- The stage size is the composition's `w` × `h`.
- Authoring is left-to-right.

The runtime SHALL map stage coordinates to the viewport through the placement template only. It SHALL NOT stretch non-uniformly, and it SHALL NOT read layout on every frame. Geometry SHALL be measured once during preparation. A later change in layout, direction, variant or reduced-motion SHALL cancel the scene instead of re-mapping it mid-flight. This matches today's interrupt-on-`resize`/`scroll` behavior in `NewYearGiftWrapping.tsx:56-71` and `HalloweenCatScene.tsx:58-68`.

#### Scenario: A narrow phone
- **WHEN** a `viewport-stage-v1` scene with a 1440 × 900 stage plays in a 360 × 780 viewport
- **THEN** the stage scales uniformly by its `fit` rule, and no axis is scaled independently

### Requirement: Placement templates

**[Contract]** v1 SHALL define two placement templates.

`viewport-stage-v1` takes `{ template, fit: 'contain' | 'cover', align: 'center' | 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' }`. `start`/`end` resolve against the document direction. The stage fills the existing fixed, pointer-transparent scene layer (`libs/celebrations/src/context/CelebrationContext.tsx:227-236`).

`composer-anchor-v1` takes `{ template, anchor: 'composer', anchorRect: { x, y, width, height }, edge: 'top' | 'bottom', scale: { min, max }, fallback: 'viewport-stage-v1' | 'poster' }`:

- `anchorRect` is in stage coordinates.
- At preparation, the runtime measures the host anchor `CelebrationAnchors.composer` (supplied by the host today, `apps/chat/src/context/CelebrationHost.tsx:31`).
- It computes a uniform scale `clamp(composerWidth / anchorRect.width, min, max)` with `0.25 ≤ min ≤ max ≤ 4`.
- It aligns the horizontal center of `anchorRect` and the declared `edge` to the measured composer rectangle.
- If the anchor is missing, hidden, or zero-sized, or the resulting stage would leave the viewport by more than half of it, the runtime uses `fallback`.

No other anchor names, selectors or free-form transforms are valid in v1.

#### Scenario: Composer missing
- **WHEN** a `composer-anchor-v1` scene starts and no composer anchor element is connected
- **THEN** the declared `fallback` is used, and no layout read beyond the single preparation measurement occurs

### Requirement: Timing and deadlines

**[Contract]** Each scene SHALL declare these four times, all finite integers in milliseconds:

- `playbackDurationMs`: the authored story length. It SHALL equal `(op - ip) / fr × 1000` of every variant to within one frame.
- `loadTimeoutMs`: the time allowed for the player chunk plus animation data. It SHALL be ≤ 2000.
- `readyTimeoutMs`: the time from `loadAnimation` to the `DOMLoaded` renderer readiness event. It SHALL be ≤ 250.
- `maxLifetimeMs`: the total time from mount, which becomes `CelebrationScene.durationMs`. It SHALL be at least `loadTimeoutMs + readyTimeoutMs + playbackDurationMs` and at most 32000.

The playback clock SHALL start only at renderer readiness. The outer lifetime SHALL bound everything: load, readiness, playback, exit and cleanup. Independent waits SHALL NOT stack beyond it.

**[Invariant]** GiftWrapping already follows this budget:

- 2000 ms load deadline (`NewYearGiftWrapping.tsx:79-82`)
- 250 ms readiness deadline (`gift-wrapping-animation.ts:142`)
- 16000 ms playback started at readiness (`gift-wrapping-animation.ts:55`)
- 18500 ms provider lifetime (`new-year/constants/new-year.ts:20`)

#### Scenario: Slow network
- **WHEN** the animation data has not resolved after `loadTimeoutMs`
- **THEN** the scene shows its poster (or, for a known event before any side effect, follows the source-selection fallback), and the scene still ends at `maxLifetimeMs`

#### Scenario: Declared duration disagrees with the composition
- **WHEN** `playbackDurationMs` differs from `(op - ip) / fr × 1000` by more than one frame
- **THEN** publication rejects the scene

### Requirement: Posters

**[Contract]** Each scene SHALL declare `posterAssetId` and `posterDurationMs` (1000 to `maxLifetimeMs`).

- A poster SHALL be `image/svg+xml`, `image/png` or `image/webp`.
- An SVG poster SHALL be static: no `<script>`, no `foreignObject`, no event attributes, no external references, no SMIL or CSS animation.
- Posters SHALL be rendered only as `<img>` with an empty `alt` inside the existing `aria-hidden` scene layer. They SHALL never be rendered through `innerHTML`.
- The poster SHALL be shown for reduced motion, for failure before playback starts, and for an unsupported capability on an external-only event.
- Showing a poster SHALL NOT download the player or the animation data.

#### Scenario: Reduced motion
- **WHEN** `prefers-reduced-motion: reduce` matches at activation
- **THEN** only the poster loads, for `posterDurationMs`, and no `lottie_light` chunk or animation JSON is requested

### Requirement: Variants

**[Contract]** A scene SHALL declare 1–8 `variants`. Each variant is `{ when: { layout?: 'mobile' | 'desktop', direction?: 'ltr' | 'rtl', colorScheme?: 'light' | 'dark' }, animationAssetId }`.

- The host supplies the inputs: `isMobile` (already a provider prop), the document direction, and the resolved color scheme (`appearance-override-contract`).
- The runtime SHALL pick the variant that matches the most conditions. A missing condition matches anything.
- Ties SHALL resolve by declaration order. A scene with no match SHALL be treated as unsupported.

Direction handling SHALL be declared once per scene as `direction`:

- `none`: the motion is symmetric or deliberately the same in RTL.
- `mirror`: the stage is flipped horizontally around its center. This is allowed because the profile has no text layers.
- `variant`: an RTL variant is required.

#### Scenario: RTL mobile
- **WHEN** variants exist for `{layout: mobile}` and `{layout: mobile, direction: rtl}`, and the document is RTL on a phone
- **THEN** the RTL mobile variant is chosen

### Requirement: Labels and locale fallback

**[Contract]** Pack labels SHALL be `{ [bcp47Locale]: { [labelId]: string } }` and SHALL include `en`. Values are plain text of at most 280 characters, and the only placeholder allowed is `{{phrase}}`.

Locale resolution SHALL be owned by the app adapter. The library SHALL receive resolved strings only and SHALL NOT read i18n.

Order for a label ID that a bundled event already defines (for example `sleighToastMessage`):

1. the app's existing translation key (`newYear.*` / `halloween.*` through `CelebrationHost`)
2. the bundled English default

Pack labels SHALL NOT override existing keys.

Order for new label IDs and for external-only events:

1. exact active locale
2. base language
3. `en`

The supported app locale today is `en` only (`apps/chat/src/i18n/locales/en.json`). A label change SHALL NOT change the cancellation identity. Labels reach the library through the existing `labels` prop, which already re-translates on language change (`CelebrationHost.tsx:69-82`).

#### Scenario: Missing regional translation
- **WHEN** the active locale is `de-AT` and the pack has `de` and `en` labels
- **THEN** the `de` value is used

### Requirement: Reserved interaction extension point

**[Contract]** Capability IDs that start with `interaction-` SHALL be reserved for compiled, host-independent interaction adapters. The first planned one is the S4 Halloween Cat pilot (#9223).

- In v1, every `interaction-*` capability SHALL be unsupported, so a scene that requires one falls back as unsupported.
- When an adapter is released, its manifest parameters SHALL be limited to an `interaction` object of finite numbers, booleans and adapter-defined string-enum values, plus Lottie marker names.
- Manifests SHALL never carry selectors, functions, code, class names or DOM paths.
- v1 runtimes SHALL ignore Lottie `markers`.

This change defines no interaction semantics.

#### Scenario: A pack ahead of the runtime
- **WHEN** a manifest scene requires `interaction-cat-borrow-v1` before S4 ships
- **THEN** the known event keeps its bundled `cat` scene, and no external player starts for it

### Requirement: Decorative accessibility of pack scenes

**[Contract]** Pack scenes SHALL render inside the existing `aria-hidden`, `pointer-events-none` scene layer and SHALL be `inert`. They SHALL convey no information other than what the provider's notification already announces (`CelebrationContext.tsx:152-158`).

The `static-trigger-v1` decoration for external-only events SHALL be a native `<button>` with these properties:

- an accessible name taken from its resolved label
- keyboard operability
- a visible focus indicator
- an `aria-hidden` icon image

It SHALL use logical CSS properties for RTL.

#### Scenario: Keyboard activation of an external-only event
- **WHEN** a keyboard user focuses the `static-trigger-v1` decoration and presses Enter
- **THEN** a click scene plays, and the notification is announced through the host toast
