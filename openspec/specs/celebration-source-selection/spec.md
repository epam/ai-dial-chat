# celebration-source-selection Specification

## Purpose

App-owned rules for choosing between bundled and externally delivered celebration scenes: eligibility and precedence, cancellation identity, lazy loading, reduced motion, legacy ID/pool compatibility, external-only event construction, and fallback/rollback per event class. Defined by S0 (#9219); implemented from S2 (#9221).

**[Contract]** requirements are fixed by S0 and implemented in S2 (#9221) and later stages. **[Invariant]** requirements describe behavior at `1cfb11468` and cite the test that verifies it.

## Requirements

### Requirement: Eligibility is application-owned and precedes all pack content

**[Contract]** The app adapter (`CelebrationHost` in `apps/chat/src/context/`) SHALL decide eligibility before it resolves any pack. It SHALL apply these gates in this order:

1. The user config is ready, and the route is exactly `/`.
2. `config.activeEventId` (from `UI_EVENT`) is non-null.
3. The event ID is either in the compiled registry or admitted as an external-only event by app delivery policy.
4. The host selection (`CelebrationEventSelection`: enabled/disabled scenes, secret and decor flags) is intersected.

Pack bindings, theme bindings and embedding appearance overrides SHALL only choose visuals for an event and scenes that already passed all gates. They SHALL never enable an event, re-enable a scene, or widen a pool.

The delivery policy has three parts: `deliveryMode: 'bundled' | 'prefer-external'` (default `bundled`), `revision`, and an allowlist of `eventId/sceneId` replacements plus admitted external-only event IDs. It is app configuration owned by `apps/chat-api/src/app-config` and the client config. It is not a theme field.

The policy is not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. It applies to every user of a deployment.

**[Invariant]** Gates 1–2 exist today (`apps/chat/src/context/CelebrationHost.tsx:65-68`), verified by "passes the configured event only on the start page once config is ready" in `apps/chat/src/context/tests/CelebrationHost.spec.tsx:76`. `CelebrationHost` passes no `selection` today, so all scenes are enabled. That fact comes from source inspection at `CelebrationHost.tsx:90-98`; no test asserts it.

#### Scenario: Celebrations switched off
- **WHEN** `UI_EVENT=none` while a theme binds a New Year pack
- **THEN** no manifest, animation or player is requested, and no decoration renders

#### Scenario: A pack tries to widen a pool
- **WHEN** a host selection disables `sleigh` and the pack provides an external `sleigh`
- **THEN** `sleigh` stays unplayable

### Requirement: Source and pack precedence per scene

**[Contract]** For each eligible scene of a known event, the source SHALL be the bundled scene unless all of the following hold:

- `deliveryMode` is `prefer-external`
- `eventId/sceneId` is allowlisted
- a resolved pack provides that scene ID
- every capability the scene requires is supported

The pack for an event SHALL resolve from the first applicable entry, in this order:

1. transient embedding appearance pack reference (S6), when it names a registered pack
2. the resolved theme's `celebrationPacks[eventId]` (S5)
3. catalog `defaultCelebrationPacks[eventId]`
4. none, which means bundled

A reference that does not resolve to a published, valid pack SHALL fall through to the next entry. It SHALL NOT disable the event.

#### Scenario: Default deployment
- **WHEN** no delivery policy is configured
- **THEN** every scene of every event uses its bundled implementation, which is exactly today's behavior

### Requirement: Composition by stable scene ID preserves the event

**[Contract]** For a known event, the app SHALL produce one logical `CelebrationEvent` before passing it to `CelebrationProvider`. In that event:

- only scenes with matching IDs are replaced
- `id`, `iconUrl`, `Decoration`, `clickSceneIds`, `secretTrigger`, `decorBehaviors`, `labels` and `titleLabelId` stay those of the bundled event
- the replaced scene's `durationMs` becomes the descriptor's `maxLifetimeMs`
- its `labelId` stays the bundled one

**[Invariant]** Event and scene IDs and pools are stable today:

- Halloween: 16 scenes; click pool `HALLOWEEN_CLICK_BURSTS` (11 scenes); secret pool `HALLOWEEN_SECRET_BURSTS` (5 scenes) (`libs/celebrations/src/halloween/constants/halloween.ts`)
- New Year: 5 scenes; all 5 are in the click pool; secret pool `confetti` (`libs/celebrations/src/new-year/constants/new-year.ts`, `libs/celebrations/src/new-year/event.tsx:33-40`)
- Pool filtering verified by `libs/celebrations/src/context/tests/CelebrationSelection.spec.tsx`
- Halloween pools verified by `libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx`

#### Scenario: Replacing only the sleigh
- **WHEN** the New Year pack provides an allowlisted `sleigh`
- **THEN** clicking the gift still samples the same five click scenes, `happy new year` still plays `confetti`, and only `sleigh` renders the external animation

### Requirement: External-only events without a compiled module

**[Contract]** An event ID absent from the compiled registry SHALL be playable only when all three hold:

- app policy admits it
- the catalog lists a valid pack for it with an `event` block
- all required capabilities are supported

The app SHALL register a loader under that ID that resolves to an event built by a library descriptor factory: `createCelebrationEventFromDescriptor(descriptor, loaders)`, exported by `libs/celebrations` in S2. The factory uses a generic `static-trigger-v1` decoration and generic Lottie scene components.

- The loader SHALL NOT derive an import path from the ID. The existing guard comment, "configuration never becomes an import path" (`CelebrationHost.tsx:23`), stays true.
- External-only events SHALL have no secret phrase and no decor behaviors in v1.
- `UI_EVENT` already accepts any kebab-case ID (`apps/chat-api/src/config/environment.config.ts:884-887`). Without policy admission, an unknown ID keeps today's behavior: no celebration.

#### Scenario: Company anniversary
- **WHEN** `UI_EVENT=company-anniversary` is admitted by policy and the catalog has a valid pack with an `event` block
- **THEN** a labeled trigger renders on `/` and plays the pack's click scenes, and no module named after the ID is imported

#### Scenario: Unknown ID without admission
- **WHEN** `UI_EVENT=company-anniversary` but policy does not admit it
- **THEN** no celebration renders and no pack is fetched

### Requirement: Stable cancellation identity

**[Contract]** The host SHALL pass `CelebrationProvider.resetKey` as one primitive string. It is compared by identity today (`libs/celebrations/src/context/CelebrationContext.tsx:85,223`). The string SHALL be built from these parts:

- route `location.key`
- `activeEventId`
- `deliveryMode` and policy `revision`
- catalog `revision`
- resolved `packId@version`, or `bundled`
- resolved theme ID and color scheme
- document direction
- layout (`mobile` or `desktop`)
- a selection revision

Any part changing SHALL cancel the active scene and pending loads, and SHALL reload the event. Locale and label changes SHALL NOT be part of the key.

**[Invariant]** Today `resetKey` is only `location.key` (`CelebrationHost.tsx:93`). The provider reloads only when `activeEventId`, loader presence or `resetKey` change, not on a new loader function identity (`CelebrationContext.tsx:77-112`), and a selection change does not unmount a playing scene. A newly composed event therefore MUST change `resetKey`. A reset on navigation is verified by `CelebrationHost.spec.tsx:104` and `CelebrationRuntime.spec.tsx:206,221,412`. The two other facts (a new loader identity does not reload, and a selection change does not unmount a playing scene) come from source inspection only. S2 SHALL add characterization tests for both before relying on them.

#### Scenario: Theme switched mid-scene
- **WHEN** the user switches from a light to a dark theme while an external scene plays
- **THEN** the scene stops and restores the UI, a pending fetch for the old variant is aborted, and the next activation uses the dark variant

#### Scenario: Language switched
- **WHEN** only the UI language changes
- **THEN** the playing scene continues, and later notifications use the new labels

### Requirement: Lazy loading and reduced motion

**[Contract]** Loading SHALL follow these rules:

- With no eligible event, nothing related to packs SHALL be requested.
- With an eligible event, only the catalog (already needed for themes) and that event's manifest MAY be requested, plus the decoration icon for external-only events.
- The player chunk and a scene's animation data SHALL be requested only after that scene is activated.
- Under reduced motion, only the poster SHALL be requested.
- Repeated activations SHALL reuse cached immutable data and SHALL clone it before playback.

**[Invariant]** Scenes already choose a static fallback under reduced motion and do not load the player (`libs/celebrations/src/hooks/useReducedMotion.ts`; in `NewYearGiftWrapping.tsx`, `useLottieSceneSession({ enabled: !reduced && … })` keeps the player unloaded and the `stationary` branch renders the static fallback), verified by `libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx`.

#### Scenario: Event shown but never clicked
- **WHEN** the New Year decoration renders and the user never activates it
- **THEN** no animation JSON and no `lottie_light` chunk are requested

### Requirement: Fallback and rollback per event class

**[Contract]** Failures SHALL be handled separately for three classes:

| Class / moment | Required behavior |
| --- | --- |
| Known bundled event, failure before activation (manifest unavailable, invalid, or unsupported capability) | Use the bundled scene for that ID |
| Known bundled event, failure after activation but before playback starts, with no scene side effect yet (load timeout, readiness timeout) | Show the external scene's poster. The bundled scene MAY be used only if no notification has been sent and no host DOM has been touched. It SHALL never produce a second notification |
| External-only event, any failure before playback | Poster for `posterDurationMs`, or no-op when the poster is also unavailable |
| Any class, failure after playback has started (player `error`/`data_failed`, target lost, renderer exception) | Restore the UI, release player, observers and listeners exactly once, and stop. The bundled scene SHALL NOT be started in the same activation; a later activation MAY use it |
| Rollback of a known event | Remove the allowlist entry or set `deliveryMode: bundled`. The cancellation identity changes, so active playback stops, and the next activation is bundled |
| Rollback of an external-only event | Remove the policy admission. The event disappears; it has no compiled fallback |

All failures SHALL leave ordinary chat usable. This extends the existing invariant that loading errors leave the host usable (`CelebrationContext.tsx:103-105`), verified by `CelebrationRuntime.spec.tsx`.

#### Scenario: The player fails halfway through
- **WHEN** an external `sleigh` emits `error` at 4 s into playback
- **THEN** the scene is cleaned up and ends, and the bundled `sleigh` does not start until the user activates again

#### Scenario: Themes host down
- **WHEN** `GET /api/v1/themes` returns 503
- **THEN** known events stay fully bundled, external-only events stay hidden, and theme data falls back as it does today

### Requirement: State ownership and memoisation

**[Contract]** Ownership SHALL be split as follows:

- Pack resolution state (catalog, manifests, policy and the resolved descriptors) SHALL live in an app-owned hook used by `CelebrationHost`. It SHALL NOT live in a new React context unless S2 shows that more than one consumer needs it.
- Playback state SHALL stay in `CelebrationProvider`.
- The composed `events` registry, the labels object and the asset loaders SHALL be memoised (`useMemo` / `useCallback`) on their primitive inputs, so that a parent render does not change the provider's inputs.
- Fetches SHALL use an `AbortController` and a cancelled flag.

Telemetry is out of scope for S0. S8 (#9227) defines app-owned outcome diagnostics through narrow library callbacks.

#### Scenario: Unrelated parent render
- **WHEN** `CelebrationHost` re-renders because of an unrelated context change
- **THEN** the `events`, `labels` and loader identities are unchanged, and the provider neither reloads nor cancels
