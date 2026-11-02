## ADDED Requirements

### Requirement: Pack resolution in the app adapter (S2 scope)

Pack resolution SHALL live in an app-owned hook `useCelebrationPacks` in `apps/chat/src/hooks/celebration/`, used only by `CelebrationHost` in `apps/chat/src/context/CelebrationHost.tsx`. No new React context is added. The hook SHALL do the following:

- Fetch through `apps/chat/src/server-api/celebrations.api.ts` only, inside `useEffect` with an `AbortController` and a cancelled flag (following `useFavicon` in `apps/chat/src/hooks/favicon/useFavicon.ts`).
- Resolve the pack for an event only from the celebration index `defaults[eventId]` (`GET /api/v1/celebrations`). The theme binding (S5) and the embedding override (S6) stay unimplemented; an absent binding falls through to bundled, as the precedence rule allows.
- Negotiate capabilities against `SUPPORTED_CELEBRATION_CAPABILITIES` from `@epam/ai-dial-celebrations`.
- For a known event, require that the descriptor has no `event` block and that the replaced scene ID exists in the bundled event and is allowlisted.
- For an external-only event, require that the event ID is admitted, that the descriptor has an `event` block, and that every click scene is supported.
- Localize pack labels for new label IDs and for external-only events: exact locale, then base language, then `en`. The resolved strings are passed through the existing `labels` prop. Pack labels SHALL NOT override a label ID the bundled event defines.
- Build `CelebrationAssetLoaders`. `loadAnimationData` calls `getCelebrationAssetRaw` with the abort signal and parses the JSON. `resolveImageUrl` returns an app-built `/api/v1/celebrations/assets/{assetId}` URL, but only for an `assetId` the resolved manifest declares as an image.
- Cache manifests and parsed animation data in memory for the page lifetime, keyed by `packId@version` and `assetId`. These resources are immutable, so there is no invalidation. The index is not cached in the app beyond the browser HTTP cache.

Host inputs to the cancellation identity and to variant selection SHALL be:

- The theme ID is `useTheme().currentTheme`.
- The color scheme is `dark` when the theme ID is `dark` and `light` otherwise. S5 (#9224) replaces this with the theme's published `colorScheme`; until then, a custom dark theme resolves to `light` variants.
- The direction is `i18n.dir()` of the resolved language.
- The layout is `useIsMobile()`.
- The selection revision is the constant `none`, because `CelebrationHost` passes no `selection`.

The composed `events` registry, the labels object and the loaders SHALL be memoised on these primitive inputs plus the resolved pack keys.

#### Scenario: Catalog unavailable
- **WHEN** `GET /api/v1/celebrations` fails while `snowman-delivery` is allowlisted
- **THEN** the New Year event is the bundled one, and no error is shown

#### Scenario: Capability missing in this client
- **WHEN** the resolved `snowman-delivery` descriptor requires `composer-anchor-v1`, which this library version does not support
- **THEN** the bundled `snowman-delivery` is used and no player is started for the external one

#### Scenario: Theme switched to dark
- **WHEN** the user switches from `light` to `dark` while nothing plays
- **THEN** the cancellation identity changes, and the next activation picks a variant whose `colorScheme` is `dark` when one exists

## MODIFIED Requirements

### Requirement: Source and pack precedence per scene

**[Contract]** For each eligible scene of a known event, the source SHALL be the bundled scene unless all of the following hold:

- `deliveryMode` is `prefer-external`
- `eventId/sceneId` is allowlisted
- a resolved pack provides that scene ID
- every capability the scene requires is supported

The pack for an event SHALL resolve from the first applicable entry, in this order:

1. transient embedding appearance pack reference (S6), when it names a registered pack
2. the resolved theme's `celebrationPacks[eventId]` (S5), which SHALL name a pack listed in `celebrations/index.json`
3. the celebration index `defaults[eventId]`
4. none, which means bundled

A reference that does not resolve to a published, valid pack SHALL fall through to the next entry. It SHALL NOT disable the event.

#### Scenario: Default deployment
- **WHEN** no delivery policy is configured
- **THEN** every scene of every event uses its bundled implementation, which is exactly today's behavior

#### Scenario: S2 resolves only index defaults
- **WHEN** S2 runs and no theme or embedding binding exists yet
- **THEN** the pack for `new-year` comes from `defaults.new-year` of `GET /api/v1/celebrations`, or the event stays bundled when that entry is absent

### Requirement: Eligibility is application-owned and precedes all pack content

**[Contract]** The app adapter (`CelebrationHost` in `apps/chat/src/context/`) SHALL decide eligibility before it resolves any pack. It SHALL apply these gates in this order:

1. The user config is ready, and the route is exactly `/`.
2. `config.activeEventId` (from `UI_EVENT`) is non-null.
3. The event ID is either in the compiled registry or admitted as an external-only event by app delivery policy.
4. The host selection (`CelebrationEventSelection`: enabled/disabled scenes, secret and decor flags) is intersected.

Pack bindings, theme bindings and embedding appearance overrides SHALL only choose visuals for an event and scenes that already passed all gates. They SHALL never enable an event, re-enable a scene, or widen a pool.

The delivery policy is `ClientConfigResponseDto.celebrationDelivery`: `mode` (`bundled` | `prefer-external`, default `bundled`), `revision`, `externalScenes` (allowlisted `eventId/sceneId` replacements) and `externalEvents` (admitted external-only event IDs). It is app configuration owned by the central registry in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` and defined by `celebration-delivery-policy`. It is not a theme field.

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

- only scenes with matching IDs are replaced; a pack scene whose ID the bundled event does not define SHALL be ignored, so a pack can never add a scene to a compiled event
- `id`, `iconUrl`, `Decoration`, `clickSceneIds`, `secretTrigger`, `decorBehaviors`, `labels` and `titleLabelId` stay those of the bundled event
- the replaced scene's `durationMs` becomes the descriptor's `maxLifetimeMs`
- its `labelId` stays the bundled one

**[Invariant]** Event and scene IDs and pools are stable today:

- Halloween: 16 scenes; click pool `HALLOWEEN_CLICK_BURSTS` (11 scenes); secret pool `HALLOWEEN_SECRET_BURSTS` (5 scenes) (`libs/celebrations/src/halloween/constants/halloween.ts`)
- New Year: 3 scenes (`penguin-star`, `gift-wrapping`, `snowman-delivery`); click pool `NEW_YEAR_CLICK_SCENES` (`penguin-star`, `snowman-delivery`); secret pool `gift-wrapping` for `happy new year` (`libs/celebrations/src/new-year/constants/new-year.ts`, `libs/celebrations/src/new-year/event.tsx`). The bundled `sleigh` and `confetti` scenes no longer exist since #9631
- Pool filtering verified by `libs/celebrations/src/context/tests/CelebrationSelection.spec.tsx`
- Halloween pools verified by `libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx`

#### Scenario: Replacing only the snowman delivery
- **WHEN** the New Year pack provides an allowlisted `snowman-delivery`
- **THEN** clicking the gift still samples `penguin-star` and `snowman-delivery`, `happy new year` still plays the bundled `gift-wrapping`, only `snowman-delivery` renders the external animation, and its notification is the bundled `snowmanDeliveryToastMessage`

#### Scenario: A pack declares a scene the event lacks
- **WHEN** the New Year pack also declares a scene `sleigh`, and `new-year/sleigh` is allowlisted
- **THEN** `sleigh` is ignored and the New Year event still has exactly its three scenes

### Requirement: Fallback and rollback per event class

**[Contract]** Failures SHALL be handled separately for three classes:

| Class / moment | Required behavior |
| --- | --- |
| Known bundled event, failure before activation (manifest unavailable, invalid, or unsupported capability) | Use the bundled scene for that ID |
| Known bundled event, failure after activation but before playback starts, with no scene side effect yet (load timeout, readiness timeout) | Show the external scene's poster for `posterDurationMs`, or nothing when the poster is unavailable too. The bundled scene SHALL NOT start in the same activation, because the provider has already sent the scene's notification |
| External-only event, any failure before playback | Poster for `posterDurationMs`, or no-op when the poster is also unavailable |
| Any class, failure after playback has started (player `error`/`data_failed`, target lost, renderer exception) | Restore the UI, release player, observers and listeners exactly once, and stop. The bundled scene SHALL NOT be started in the same activation; a later activation MAY use it |
| Rollback of a known event | Remove the allowlist entry or set `deliveryMode: bundled`. The cancellation identity changes, so active playback stops, and the next activation is bundled |
| Rollback of an external-only event | Remove the policy admission. The event disappears; it has no compiled fallback |

All failures SHALL leave ordinary chat usable. This extends the existing invariant that loading errors leave the host usable (`CelebrationContext.tsx`), verified by `CelebrationRuntime.spec.tsx`.

#### Scenario: The player fails halfway through
- **WHEN** an external `snowman-delivery` emits `error` at 4 s into playback
- **THEN** the scene is cleaned up and ends, and the bundled `snowman-delivery` does not start until the user activates again

#### Scenario: Animation load times out
- **WHEN** an external `snowman-delivery` is activated and its animation data has not resolved after `loadTimeoutMs`
- **THEN** the load is aborted, the poster shows for `posterDurationMs`, and no second notification is sent

#### Scenario: Celebrations unavailable
- **WHEN** `GET /api/v1/celebrations` returns 503
- **THEN** known events stay fully bundled, external-only events stay hidden, and theme data is unaffected because it never depends on the celebration index
