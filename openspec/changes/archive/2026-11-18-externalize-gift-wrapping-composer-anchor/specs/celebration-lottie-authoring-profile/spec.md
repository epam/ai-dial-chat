# Spec Delta

## MODIFIED Requirements

### Requirement: Coordinate system

**[Contract]** Each composition SHALL be authored in its own stage coordinates:

- The origin is at the top-left, x grows right and y grows down.
- The unit is one CSS pixel at stage scale 1.
- The stage size is the composition's `w` × `h`.
- Authoring is left-to-right.

The runtime SHALL map stage coordinates to the viewport through the placement template only. It SHALL NOT stretch non-uniformly, and it SHALL NOT read layout on every frame. Geometry SHALL be measured once during preparation. A later change in layout, direction, variant or reduced-motion SHALL cancel the scene instead of re-mapping it mid-flight. This matches the interrupt-on-`resize`/`scroll` behavior of `useComposerInterrupts` (`libs/celebrations/src/hooks/useComposerInterrupts.ts`), which the compiled GiftWrapping and every `composer-anchor-v1` scene in `LottieScene` use to call their session's `cancel`, and of the interrupt-listener effect of `HalloweenCatScene.tsx`.

#### Scenario: A narrow phone
- **WHEN** a `viewport-stage-v1` scene with a 1440 × 900 stage plays in a 360 × 780 viewport
- **THEN** the stage scales uniformly by its `fit` rule, and no axis is scaled independently

### Requirement: Placement templates

**[Contract]** v1 SHALL define two placement templates.

`viewport-stage-v1` takes `{ template, fit: 'contain' | 'cover', align: 'center' | 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' }`. `start`/`end` resolve against the document direction. The stage fills the existing fixed, pointer-transparent scene layer (`libs/celebrations/src/context/CelebrationContext.tsx`).

`composer-anchor-v1` takes `{ template, anchor: 'composer', anchorRect: { x, y, width, height }, edge: 'top' | 'bottom', scale: { min, max }, fallback: 'stage-anchor' | 'poster' }`:

- `anchorRect` is in stage coordinates. It is the reference composer the motion is authored around, and lies fully inside the stage with `width ≥ 120` and `height ≥ 24`.
- The scene is measured once at preparation against the host anchor `CelebrationAnchors.composer`, which the host supplies (`apps/chat/src/context/CelebrationHost.tsx`). The eligibility rules are those of `celebration-composer-anchoring`.
- The runtime computes a uniform scale `clamp(composerWidth / anchorRect.width, min, max)`, with `0.25 ≤ min ≤ max ≤ 4`.
- It aligns the horizontal center of `anchorRect` and the declared `edge` with the measured composer rectangle. The stage is never fitted to the viewport.
- `direction: mirror` flips the stage around the vertical center line of `anchorRect`.
- If no composer is eligible, the runtime uses `fallback`:
  - `stage-anchor` maps the stage to a synthetic anchor of size `anchorRect × min`, centered in the lower half of the viewport.
  - `poster` shows the poster.

S3 (#9222) replaced the S0 fallback value `viewport-stage-v1` with `stage-anchor`. A stage authored around a composer has no `fit` or `align`. No client had implemented `composer-anchor-v1` before that change.

No other anchor names, selectors or free-form transforms are valid in v1.

#### Scenario: Composer missing
- **WHEN** a `composer-anchor-v1` scene starts and no composer anchor element is connected
- **THEN** the declared `fallback` is used, and no layout read beyond the single preparation measurement occurs

#### Scenario: Composer aspect ratio differs from the reference
- **WHEN** a scene authored around a 520 × 56 `anchorRect` plays on a 900 × 140 composer
- **THEN** the stage is scaled uniformly, never stretched along one axis, and only an `interaction-composer-outline-v1` slot follows the composer's own aspect ratio

### Requirement: Reserved interaction extension point

**[Contract]** Capability IDs that start with `interaction-` SHALL be reserved for compiled, host-independent interaction adapters.

- The first released adapter is `interaction-composer-outline-v1` (S3, #9222). Its behaviour is defined by `celebration-composer-anchoring`. It requires `composer-anchor-v1` placement and has no manifest parameters.
- The next planned adapter is the S4 Halloween Cat pilot (#9223).
- Every other `interaction-*` capability SHALL be unsupported, so a scene that requires one falls back as unsupported.
- An adapter's manifest parameters SHALL be limited to an `interaction` object of finite numbers, booleans and adapter-defined string-enum values, plus Lottie marker names.
- An adapter MAY fit Lottie layers whose `nm` equals one of its adapter-defined slot names (for example `composer-outline`, `composer-parcel`). It SHALL change only the geometry the adapter defines for that slot. A slot that is missing, duplicated or malformed is a preparation failure.
- Manifests SHALL never carry selectors, functions, code, class names or DOM paths.
- v1 runtimes SHALL ignore Lottie `markers`.

#### Scenario: A pack ahead of the runtime
- **WHEN** a manifest scene requires `interaction-cat-borrow-v1` before S4 ships
- **THEN** the known event keeps its bundled `cat` scene, and no external player starts for it

#### Scenario: The composer-outline adapter is supported
- **WHEN** a `composer-anchor-v1` scene requires `interaction-composer-outline-v1` on a client that includes S3
- **THEN** the scene is supported, and the adapter fits only its `composer-outline` and `composer-parcel` layers

#### Scenario: Adapter without an anchored placement
- **WHEN** a scene requires `interaction-composer-outline-v1` but declares `viewport-stage-v1` placement
- **THEN** the scene is unsupported, and a known event keeps its bundled scene

### Requirement: Variants

**[Contract]** A scene SHALL declare 1–8 `variants`. Each variant is `{ when: { layout?: 'mobile' | 'desktop', direction?: 'ltr' | 'rtl', colorScheme?: 'light' | 'dark' }, animationAssetId }`.

- The host supplies the inputs: `isMobile` (already a provider prop), the document direction, and the resolved color scheme.
- The runtime SHALL pick the variant that matches the most conditions. A missing condition matches anything.
- Ties SHALL resolve by declaration order. A scene with no match SHALL be treated as unsupported.

Direction handling SHALL be declared once per scene as `direction`:

- `none`: the motion is symmetric or deliberately the same in RTL.
- `mirror`: the stage is flipped horizontally around its center. This is allowed because the profile has no text layers.
- `variant`: an RTL variant is required.

A variant MAY declare its own `placement` with the scene's template. It replaces the scene's placement for that variant only. Use it when a variant is authored around a different reference geometry, for example a phone `anchorRect` for the mobile variant of a `composer-anchor-v1` scene, so that the characters' on-screen size does not follow the composer width across the whole mobile band. A variant placement with another template SHALL be invalid.

#### Scenario: RTL mobile
- **WHEN** variants exist for `{layout: mobile}` and `{layout: mobile, direction: rtl}`, and the document is RTL on a phone
- **THEN** the RTL mobile variant is chosen

#### Scenario: Mobile frame of an anchored scene
- **WHEN** a `composer-anchor-v1` scene's mobile variant declares `anchorRect 300 × 56` and the desktop placement is `520 × 56`
- **THEN** a mobile layout maps the mobile stage against 300, and a desktop layout maps the desktop stage against 520
