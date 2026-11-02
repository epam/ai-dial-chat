## Why

Every change to celebration artwork today needs a Chat release, because each scene is compiled into `libs/celebrations`. S0 (#9219) fixed the pack contracts and S1 (#9220) extracted a shared Lottie session, but nothing delivers a pack yet. S2 (#9221) must prove the full path end to end: one scene published in `epam/ai-dial-chat-themes`, served by the BFF, and played by a generic renderer. It must also prove that an event can exist without a compiled module.

The S0 pilot was `sleigh`, but #9631 removed the bundled sleigh. The contract only allows replacing a bundled scene by its stable ID and forbids a pack from widening a pool. An external sleigh would therefore have to be added to the New Year event, which the contract forbids. This change uses `snowman-delivery` as the pilot instead.

## Problem

- A pack cannot reach the browser yet. `apps/chat-api` only proxies themes (`GET /api/themes`, `GET /api/themes/icon` in `apps/chat-api/src/themes/theme.controller.ts`), with no size, hash or MIME checks, using the shared 100-entry LRU (`apps/chat-api/src/app/cache.config.ts`).
- S0 put the pack list into `config.json`. At least three applications read that file: Chat, Admin (`admin-*` keys) and Model Garden (`model-garden-*` keys). Changing it puts every theme reader at risk. `config.json` is served with `expires 1w` (`nginx/themes.conf.template` in the themes repository), while the pack pointer needs a 60 s TTL.
- `apps/chat/src/context/CelebrationHost.tsx` loads only compiled modules, and its `resetKey` is only `location.key`.
- `libs/celebrations` has no descriptor types, no capability enum, no generic Lottie scene and no descriptor factory.
- `openspec/specs/celebration-source-selection/spec.md` still describes New Year before #9631 (five scenes, the `confetti` secret, sleigh scenarios). The code has three scenes, the click pool `[penguin-star, snowman-delivery]` and the secret `gift-wrapping` (`libs/celebrations/src/new-year/constants/new-year.ts`, `libs/celebrations/src/new-year/event.tsx`).
- The C2 contract lists `429`, but `apps/chat-api` has no rate limiter. It also has no response compression, and Lottie JSON compresses 5–8×.

## What Changes

- **Themes repository (cross-repository).** Publish a separate celebration index `static/celebrations/index.json`, holding `schemaVersion`, `revision`, `packs` and `defaults`. Under it, publish the immutable `static/celebrations/new-year-default/1.0.0/` (a `snowman-delivery` clip for desktop and mobile, a poster and `manifest.json`) and `static/celebrations/company-anniversary/1.0.0/`, the external-only test event.
  - **`config.json` and its caching stay as they are.**
  - nginx adds only `/celebrations/` rules: the index gets 60 s, everything else under it is `immutable`.
  - A publication check covers references, bytes and hashes, timing, the player profile, the caps and version retention (current + previous).
- **BFF: a new `apps/chat-api/src/celebrations` domain.** `CelebrationsController` exposes three public endpoints: `GET /api/v1/celebrations` (`getCelebrationCatalog`), `GET /api/v1/celebrations/packs/{packId}/{version}` (`getCelebrationPack`) and `GET /api/v1/celebrations/assets/{assetId}` (`getCelebrationAsset`), with DTOs.
  - Upstream reads are bounded, never follow redirects, and stay under `<THEMES_CONFIG_URL>/celebrations/`.
  - Bytes, `sha256` and MIME type are checked before anything is cached or served.
  - Immutable resources go to a byte-bounded store separate from the app cache. The index has a 60 s TTL and the last valid version is kept.
  - JSON and SVG are compressed with Node `zlib` (`br`/`gzip`).
  - **`apps/chat-api/src/themes/` does not change.** `/api/themes` and `/api/themes/icon` stay byte-for-byte the same.
- **Delivery policy (app-config).** Four registry keys and env vars: `UI_EVENT_DELIVERY_MODE` (`bundled` | `prefer-external`, default `bundled`), `UI_EVENT_DELIVERY_REVISION`, `UI_EVENT_EXTERNAL_SCENES` (`eventId/sceneId` pairs) and `UI_EVENT_EXTERNAL_EVENTS`. They reach the client as `celebrationDelivery` in `ClientConfigResponseDto`. These are not feature flags.
- **Generated client and wrapper.** Regenerate `@epam/ai-dial-chat-api-client` and add `apps/chat/src/server-api/celebrations.api.ts`.
- **`libs/celebrations` (additive).**
  - Main entry: `CelebrationCapability`, `SUPPORTED_CELEBRATION_CAPABILITIES`, the C3 descriptor types and enums, `CelebrationAssetLoaders` and `CelebrationVariantContext`.
  - New lazy entry `@epam/ai-dial-celebrations/packs`: `LottieScene` on top of `useLottieSceneSession`, `createCelebrationSceneFromDescriptor`, `replaceCelebrationScenes`, `createCelebrationEventFromDescriptor` and the `static-trigger-v1` decoration.
- **App adapter.**
  - The `useCelebrationPacks` hook runs the eligibility gates, applies the policy, picks the pack from the index defaults, negotiates capabilities and localizes labels.
  - `CelebrationHost` composes known events by scene ID and registers admitted external-only IDs through the factory.
  - A composite `resetKey`.
- **Characterization tests first.** A new loader identity does not reload the provider, and a `selection` change does not unmount a playing scene.
- **Spec corrections.**
  - `celebration-source-selection`: the post-#9631 New Year facts, the `snowman-delivery` pilot, the policy location (S0 open question 4) and pack selection from the index defaults.
  - `celebration-pack-contracts`: a separate index instead of `config.json` fields, no `429`, `images` as an allowlist for S5 (dropping `model-garden-*`), and version retention.

There are no **BREAKING** changes. Everything is additive, and the default policy reproduces today's behavior.

## Non-goals

- `GET /api/v1/themes`, camelCase theme normalization and moving `ThemeContext` off `/api/themes`. All of this is S5 (#9224), together with theme bindings to packs. Embedding overrides are S6 (#9225).
- `composer-anchor-v1` and the gift-wrapping migration (S3 #9222). `interaction-*` (S4 #9223).
- Deleting the bundled `snowman-delivery`, which stays as the default and the fallback.
- Rate limiting inside `apps/chat-api`. That is the ingress's job.
- dotLottie, ZIP uploads, arbitrary URLs, scripts, CSS, fonts and secret phrases for external-only events.
- Telemetry (S8 #9227).

## Alternatives considered

**Where to publish packs:**

| Option | Risk to theme readers | Caching | S2 scope | Pick |
| --- | --- | --- | --- | --- |
| A. Separate `celebrations/index.json` and a separate BFF domain | None: `config.json` is untouched | Its own 60 s TTL, while themes keep `1w` | Smaller: no theme normalization | **yes** |
| B. New fields in `config.json` (the S0 contract) and `/api/v1/themes*` | Admin and Model Garden read the same file, and their parsers are unverified | Conflicts with `expires 1w` | Larger: normalizing the whole theme catalog | no |
| C. Separate host or env var for celebrations | None | Its own | Plus deployment config | no, too much for a pilot |

The cost of A: a theme binding to a pack (S5) points to a different file, so the two files are not published atomically. The contract already allows that, because an unresolvable reference falls through to bundled.

**Pilot:**

| Option | Correctness | Risk | Pick |
| --- | --- | --- | --- |
| `snowman-delivery` (click pool, `viewport-stage-v1`) | Pure replacement by ID; pools and the secret unchanged | One placement template | **yes** |
| `gift-wrapping` | Secret scene, needs `composer-anchor-v1` | Overlaps S3 | no |
| Re-add `sleigh` | Violates "never widen a pool" | Contract churn | no |
| Keep everything bundled | Fails the acceptance criteria | none | no |

Policy location: the app-config registry, because every `UI_*` key already lives in `config-registry.constants.ts` and reaches the client through `ClientConfigResponseDto`. `429`: declaring a code that is never returned would mislead readers (`.claude/rules/docs.md`), and `@nestjs/throttler` is a new global dependency. Compression: Node `zlib` inside the domain, because the `compression` middleware would compress the whole API, including SSE.

## Acceptance criteria

- With `UI_EVENT=new-year`, `prefer-external` and `new-year/snowman-delivery` allowlisted, a click that samples `snowman-delivery` plays the external clip. Publishing `new-year-default@1.0.1` and updating `celebrations/index.json` changes playback without a Chat rebuild. `penguin-star` and `gift-wrapping` stay bundled, and `happy new year` still plays `gift-wrapping`.
- `UI_EVENT=company-anniversary`, admitted by policy, renders a `static-trigger-v1` button that plays the pack's click scene. No import path is derived from the ID.
- `UI_EVENT=none`, a route other than `/`, an opted-out user, a disabled scene or the default `bundled` mode cause no `/api/v1/celebrations*` request and no player load.
- When the index, a manifest or an asset is unavailable, chat keeps working. A known event falls back to bundled before activation and to the poster after activation. An external-only event shows its poster or nothing. A failure after playback starts restores and stops, with no bundled replay in the same activation.
- The celebrations endpoints return the documented codes for invalid IDs, traversal, unknown assets, oversized bodies, hash or MIME mismatches and unsupported schemas. `apps/chat-api/src/themes/**`, `config.json` and `/api/themes*` are unchanged.
- The client is regenerated from Swagger. `libs/celebrations` has no app code, API client, i18n or `fetch`. `npm run openapi:check`, `npm run validate:docs`, `npm run validate:specs` and the affected tests pass.

## Rollback / backward compatibility

- A scene: remove `new-year/snowman-delivery` from `UI_EVENT_EXTERNAL_SCENES`, or set `UI_EVENT_DELIVERY_MODE=bundled`. The `resetKey` changes, playback stops, and the next activation is bundled.
- An external-only event: remove it from `UI_EVENT_EXTERNAL_EVENTS`.
- Code: revert the PRs. Everything is additive, and nothing else consumes the new endpoints or exports.
- Assets: published versions are immutable. Pointing `celebrations/index.json` back at the previous version, which is always kept, rolls back the content. Deleting `celebrations/index.json` entirely returns every event to bundled without touching themes.

## Capabilities

### New Capabilities

- `celebrations-delivery-api`: the `apps/chat-api/src/celebrations` domain and the public `/api/v1/celebrations*` endpoints: validation, upstream reads, caching, compression and logging.
- `celebration-delivery-policy`: the app-config keys, env vars and client DTO for the delivery mode, revision, scene allowlist and admitted external-only events.

### Modified Capabilities

- `celebration-pack-contracts`:
  - a separate `celebrations/index.json`, with packs removed from the `config.json` additions (the theme additions stay as the S5 contract)
  - the index as the manifest pointer in the immutable-asset rules
  - `/api/v1/celebrations*` endpoints, cache keys and examples instead of `/api/v1/themes*`, with `GET /api/v1/themes` deferred to S5
  - no `429`
  - `images` as an allowlist that drops `model-garden-*` (S5)
  - a `snowman-delivery` manifest example
  - version retention
  - the legacy invariant now states that S2 does not touch the themes domain
- `celebration-source-selection`: New Year after #9631, the `snowman-delivery` pilot, the policy location, pack selection from the index defaults (the theme binding must name a pack from the index), poster-only fallback after activation for a known event, and S2 pack resolution in the app hook.
- `celebrations-library`: main-entry exports (capabilities, descriptors, variant context) and the lazy `@epam/ai-dial-celebrations/packs` entry (`LottieScene`, factory, scene replacement, static trigger). The adapter requirement gains the composite `resetKey` and composed events.

## Impact

- **Code**:
  - The new domain `apps/chat-api/src/celebrations/**`, and the `CelebrationsModule` import in `apps/chat-api/src/app/app.module.ts`.
  - `apps/chat-api/src/app-config/**` and `apps/chat-api/src/config/environment.config.ts`.
  - `libs/chat-api-client/**`, regenerated.
  - `apps/chat/src/server-api/celebrations.api.ts` and `apps/chat/src/server-api/api-client.ts`.
  - `apps/chat/src/hooks/celebration/useCelebrationPacks.ts` and `apps/chat/src/context/CelebrationHost.tsx`.
  - `libs/celebrations/src/**`, `libs/celebrations/package.json` and `libs/celebrations/vite.config.mts`.
- **Not touched**: `apps/chat-api/src/themes/**`, `apps/chat/src/context/ThemeContext.tsx` and the themes repository's `static/config.json`.
- **Shared lib (scope flag).** `libs/celebrations` gains public API, while the `CelebrationProvider` props are unchanged.
  - Host knowledge stays in the app: the app builds `CelebrationAssetLoaders` through the generated client and an app-built `/api/v1/celebrations/assets/{id}` URL, passes resolved labels through the existing `labels` prop, and passes direction, color scheme and layout as values.
  - No new context; state lives in the app hook, following `apps/chat/src/hooks/favicon/useFavicon.ts`.
- **API**: three public `GET` endpoints and a new `celebrationDelivery` field in the client config.
- **Env**: four optional variables, documented in `apps/chat-api/README.md` and `apps/chat-api/.env.template`.
- **Docs**: the `libs/celebrations/README.md` exports, `docs/architecture.md` (the new backend domain and controller path, plus the celebrations mechanism) and the themes repository README.
- **i18n**: no new app keys. The replaced scene keeps `snowmanDeliveryToastMessage`. External-only strings come from pack labels, localized by the app. The trigger has an English default in the lib.
- **Dependencies**: none new.
