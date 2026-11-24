## MODIFIED Requirements

### Requirement: Eligibility is application-owned and precedes all pack content

**[Contract]** The app adapter (`CelebrationHost` in `apps/chat/src/context/`) SHALL decide eligibility before it resolves any pack. It SHALL apply these gates in this order:

1. The user config is ready, and the route is exactly `/`.
2. `config.activeEventId` (from `UI_EVENT`) is non-null.
3. The event ID is either in the compiled registry or admitted as an external-only event by app delivery policy.
4. The host selection (`CelebrationEventSelection`: enabled/disabled scenes, secret and decor flags) is intersected.

Pack bindings, theme bindings and embedding appearance overrides SHALL only choose visuals for an event and scenes that already passed all gates. They SHALL never enable an event, re-enable a scene, or widen a pool. The one way a compiled event's click or secret pool grows is an operator decision: an `externalScenes` entry that names a scene ID the bundled event does not define adds that pack scene (see "Composition by stable scene ID"). A pack alone can never add a scene.

The delivery policy is `ClientConfigResponseDto.celebrationDelivery`: `mode` (`bundled` | `prefer-external`, default `bundled`), `revision`, `externalScenes` (allowlisted `eventId/sceneId` replacements of bundled scenes, or additions of new pack scenes) and `externalEvents` (admitted external-only event IDs). It is app configuration owned by the central registry in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` and defined by `celebration-delivery-policy`. It is not a theme field.

When the eligible event is compiled and either `mode` is `bundled` or no `externalScenes` entry names that event, the app SHALL request neither the catalog nor a manifest for celebrations. When the eligible event is not compiled and not in `externalEvents`, the app SHALL request nothing either.

The policy is not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. It applies to every user of a deployment.

**[Invariant]** Gates 1–2 exist today (`apps/chat/src/context/CelebrationHost.tsx`), verified by "passes the configured event only on the start page once config is ready" in `apps/chat/src/context/tests/CelebrationHost.spec.tsx`. `CelebrationHost` passes no `selection` today, so all scenes are enabled. That fact comes from source inspection at `CelebrationHost.tsx`; no test asserts it.

#### Scenario: Celebrations switched off
- **WHEN** `UI_EVENT=none` while a theme binds a New Year pack
- **THEN** no manifest, animation or player is requested, and no decoration renders

#### Scenario: A pack tries to widen a pool
- **WHEN** a host selection disables `snowman-delivery` and the pack provides an external `snowman-delivery`
- **THEN** `snowman-delivery` stays unplayable

#### Scenario: Default policy makes no pack requests
- **WHEN** `UI_EVENT=new-year` and `celebrationDelivery.mode` is `bundled`
- **THEN** the New Year decoration renders exactly as today, and no `/api/v1/celebrations*` request is made

### Requirement: Composition by stable scene ID preserves the event

**[Contract]** For a known event, the app SHALL produce one logical `CelebrationEvent` before passing it to `CelebrationProvider`. In that event:

- a pack scene whose ID the bundled event defines replaces that scene; its `durationMs` becomes the descriptor's `maxLifetimeMs`, and its `labelId` stays the bundled one
- a pack scene whose ID the bundled event does not define is added only when its `eventId/sceneId` is allowlisted in `externalScenes`; it is appended to the scenes and to the secret pool when the compiled event lists the ID in `secretTrigger.externalSceneIds`, otherwise to `clickSceneIds`, and it uses its own `labelId`, resolved from the pack's labels. Without an allowlist entry it SHALL be ignored, so a pack can never add a scene by itself
- `id`, `iconUrl`, `Decoration`, secret phrases, `decorBehaviors` and `titleLabelId` stay those of the bundled event; the declared secret or click pool and `labels` only gain the admitted scenes and their new label IDs, and a pack label never overrides a bundled label ID

**[Invariant]** Event and scene IDs and pools are stable today:

- Halloween: 16 scenes; click pool `HALLOWEEN_CLICK_BURSTS` (11 scenes); secret pool `HALLOWEEN_SECRET_BURSTS` (5 scenes) (`libs/celebrations/src/halloween/constants/halloween.ts`)
- New Year: 4 scenes (`penguin-star`, `gift-wrapping`, `snowman-delivery`, `reindeer-takeoff`); click pool `NEW_YEAR_CLICK_SCENES` (`penguin-star`, `snowman-delivery`); secret pool `gift-wrapping` and `reindeer-takeoff` for `happy new year` (`libs/celebrations/src/new-year/constants/new-year.ts`, `libs/celebrations/src/new-year/event.tsx`). The bundled `sleigh` and `confetti` scenes no longer exist since #9631
- Pool filtering verified by `libs/celebrations/src/context/tests/CelebrationSelection.spec.tsx`
- Halloween pools verified by `libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx`

#### Scenario: Replacing only the snowman delivery
- **WHEN** the New Year pack provides an allowlisted `snowman-delivery`
- **THEN** clicking the gift still samples `penguin-star` and `snowman-delivery`, `happy new year` still plays the bundled `gift-wrapping` or `reindeer-takeoff`, only `snowman-delivery` renders the external animation, and its notification is the bundled `snowmanDeliveryToastMessage`

#### Scenario: A pack declares a scene the event lacks
- **WHEN** the New Year pack also declares a scene `sleigh`, and only `new-year/snowman-delivery` is allowlisted
- **THEN** `sleigh` is ignored and the New Year event still has exactly its four scenes

#### Scenario: The operator adds a pack scene
- **WHEN** the New Year pack declares `bullfinch-couriers`, which the bundled event lacks, and `new-year/bullfinch-couriers` is allowlisted
- **THEN** the New Year event has five scenes, a gift click samples `penguin-star`, `snowman-delivery` and `bullfinch-couriers`, the bundled snowman still plays as `snowman-delivery`, `happy new year` still plays the bundled secret pool, and the `bullfinch-couriers` notification is the pack's `bullfinchCouriersToastMessage`
