## Context

S0 (#9219) fixed three contracts:

- **C1**, the published catalog and pack JSON, owned by `epam/ai-dial-chat-themes`.
- **C2**, the camelCase BFF DTOs, owned by `apps/chat-api/src/themes`.
- **C3**, the transport-independent library descriptors and asset loaders, owned by `libs/celebrations`.

S0 also fixed the app-owned selection, fallback and cancellation rules (`celebration-source-selection`) and the player profile (`celebration-lottie-authoring-profile`). S1 (#9220) shipped the shared session in `libs/celebrations/src/utils/lottie-scene-session.ts` and `libs/celebrations/src/hooks/useLottieSceneSession.ts`, with a lazy `lottie_light` player in `libs/celebrations/src/utils/lottie-player.ts`.

What exists today:

- `ThemeController` and `ThemeService` (`apps/chat-api/src/themes/`) proxy `config.json` and icons from `THEMES_CONFIG_URL`. They use the shared `CACHE_MANAGER` (100 entries, 5 min) and perform no size, hash or MIME checks.
- `CelebrationHost` registers two compiled loaders and passes `resetKey = location.key` and no `selection`.
- `CelebrationProvider` reloads only when `activeEventId`, the presence of a loader or `resetKey` changes. It renders the active scene inside a fixed `aria-hidden` portal layer and ends it after `durationMs`.
- New Year has three scenes since #9631. `snowman-delivery` is in the click pool and lasts 27.5 s bundled (`SNOWMAN_DELIVERY_MS + 2500`). It reads the `starterList` and `welcomeRegion` anchors.
- `ai-dial-chat-themes` has only `themes` and `images` in `static/config.json`, and nginx serves everything with `expires 1w`. Chat, Admin (`admin-*`) and Model Garden (`model-garden-*`) all read that one file.

Constraints: library isolation (`AGENTS.md`, `.claude/rules/libs.md`), the NestJS conventions in `apps/chat-api/AGENTS.md`, and the requirement that generated files come only from Swagger (`npm run openapi`).

## Goals / Non-Goals

**Goals:**
- Deliver one real replacement scene (`new-year/snowman-delivery`) and one external-only event (`company-anniversary`) end to end, without a Chat rebuild for a new pack version.
- Make the BFF the only reader of C1, so the browser never sees an upstream path and only verified bytes reach it.
- Leave themes completely untouched: `config.json`, its caching, `apps/chat-api/src/themes/**` and `ThemeContext`.
- Keep the default deployment byte-identical in behavior, with zero new requests.

**Non-Goals:**
- Theme and embedding bindings (S5, S6), `composer-anchor-v1` (S3), interaction adapters (S4), deleting the bundled snowman, rate limiting, telemetry (S8), dotLottie.
- `GET /api/v1/themes`, camelCase theme normalization and migrating `ThemeContext`. All of these stay in S5 (#9224).

## Decisions

### D1: A separate celebration index and a separate BFF domain

Packs are listed in `celebrations/index.json` on the same themes host, not in `config.json`. The BFF gets its own domain, `apps/chat-api/src/celebrations/`, with `CelebrationsModule`, `CelebrationsController` (`@Controller({ path: 'celebrations', version: '1' })`), `CelebrationCatalogService`, a reader, a store and DTOs. `AppModule` imports it beside `ThemesModule`. Nothing under `apps/chat-api/src/themes/` changes.

Alternatives:

- **New fields in `config.json` plus `/api/v1/themes*` (the S0 contract).** Admin and Model Garden read the same file, so a new field is a risk to parsers we have not checked. The 60 s TTL conflicts with `expires 1w`. S2 would also have to normalize the whole theme catalog, which S5 already does.
- **A separate host or env var for celebrations.** It isolates as well, but it adds deployment configuration for a pilot. `THEMES_CONFIG_URL` with a fixed `celebrations/` path is enough, and a compatible customer host simply publishes the same directory.

The price is that the S5 theme binding `themes[].celebrationPacks` points to a different file, so the two files are not published atomically. An unresolvable reference falls through to the index default and then to bundled, which the contract already allows.

Authorization: `@Public()`, because the endpoints carry no user data and the start page needs them before any login redirect completes. The `apps/chat-api/AGENTS.md` controller and Swagger rules apply as written.

### D2: One upstream reader enforces containment, bounds, hash and MIME

`CelebrationsUpstreamReader.read({ path, maxBytes, expected?: { bytes, sha256, mediaType } })` works in these steps:

1. It resolves `new URL(path, celebrationsBase)` with `celebrationsBase = THEMES_CONFIG_URL + '/celebrations/'`, and requires the same origin and a pathname prefix of `celebrationsBase`. A stored path containing `..`, `\`, `:` or a leading `/` is rejected before any request.
2. It calls `fetch` with `redirect: 'error'` and the existing `THEMES_SERVICE_TIMEOUT_MS`.
3. It streams through `response.body.getReader()`, counting bytes and cancelling once `maxBytes` is exceeded.
4. It checks the exact length and the `crypto.createHash('sha256')` value, then the declared `mediaType` against the allowlist.

The reader never trusts the upstream `Content-Type`. The served `Content-Type` is the registered `mediaType`.

The alternative was to verify inside each endpoint, which would duplicate the security-critical code three times. The reader is the one place the security review has to check. Raw `fetch` is used because the themes host is a static non-DIAL upstream, which `apps/chat-api/AGENTS.md` allows.

### D3: Hand-written normalizer and validator, not class-validator on upstream JSON

The C1 → C2 mapping lives in `celebration-index.normalizer.ts` and `celebration-manifest.normalizer.ts` in `apps/chat-api/src/celebrations/`. These are pure functions that return `{ value } | { error }`. They follow `apps/chat-api/src/app-config/announcements.normalizer.ts`. They read only allowlisted fields, so unknown fields never pass through, and they apply every cap and ID regex. A JSON depth guard runs before parsing: a single-pass scan of brackets outside strings.

The alternatives were class-validator with `plainToInstance` on upstream data, or a JSON-Schema library. Class-validator would need `whitelist` behavior on nested arrays and would turn kebab-case keys into class fields. There is no kebab-case in the index, but a schema library is still a new dependency, and S0 open question 5 (a canonical JSON Schema) is not settled yet. The response DTO classes still carry `@ApiProperty` for Swagger and the generated client.

### D4: Byte-bounded immutable store, separate from `CACHE_MANAGER`

`ImmutableResourceStore` is a `Map`-based LRU in `apps/chat-api/src/celebrations/`, with `maxTotalBytes = 16 MiB` and a per-entry cap equal to the largest resource cap (300 KiB). It provides single-flight: concurrent misses for a key share one promise. Only verified entries are stored.

The index stays in `CACHE_MANAGER` under `celebrations:v1:index` with a 60 s TTL. A `lastValidIndex` field in the service is served when a refetch is invalid. Manifests are keyed `celebrations:v1:manifest:<packId>:<version>` and assets `celebrations:v1:asset:<assetId>`.

To serve an asset ID, the BFF looks it up in an asset index built from every manifest that the current valid celebration index lists and that the BFF has validated. An unknown ID gives `404` without an upstream request. A listed pack whose manifest is not cached yet is loaded first, so it can be checked for membership.

The alternative was the shared cache with a larger `max`. It cannot bound bytes, and a burst of assets would evict auth and config entries, which is the risk S0 recorded. The 16 MiB limit is a constant, not an env var, because it is an internal safety bound. It can become configurable if an operator ever needs that.

### D5: Delivery policy as registry keys, read through `useAppConfig()`

There are four keys: `ui.celebrationDelivery.mode`, `.revision`, `.externalScenes` and `.externalEvents`. They are backed by `UI_EVENT_DELIVERY_MODE`, `UI_EVENT_DELIVERY_REVISION`, `UI_EVENT_EXTERNAL_SCENES` and `UI_EVENT_EXTERNAL_EVENTS`, validated on `EnvironmentVariables`. `client-config.mapper.ts` maps them into one `celebrationDelivery` object, and the static default is `bundled` with empty lists.

This resolves S0 open question 4. The alternative, an env var read only on the server, cannot reach the client policy without the same DTO anyway, and a theme field is ruled out by the contract.

### D6: `useCelebrationPacks` owns pack state, and default mode costs nothing

The color scheme is `dark` for the theme ID `dark` and `light` otherwise. Without a v1 theme catalog there is no `colorScheme` field. Until S5, a custom dark theme gets `light` variants; the pilot clips are light/dark-neutral (D10).

The app hook lives in `apps/chat/src/hooks/celebration/useCelebrationPacks.ts`. Its input is the already-gated `activeEventId` from `CelebrationHost` (config ready, route `/`, user opted in), together with `celebrationDelivery`, `useTheme().currentTheme`, `i18n.dir()` and `useIsMobile()`. The hook:

1. Returns the compiled registry unchanged, with `packKey: 'bundled'` and no fetch, when no pack can apply. That covers a compiled event in `bundled` mode, a compiled event with no allowlisted scene, and an uncompiled event that is not admitted.
2. Otherwise fetches `getCelebrationCatalog`, then resolves `defaults[eventId]`, then fetches `getCelebrationPack`. Each call is wrapped in `celebrations.api.ts`, and the work runs inside `useEffect` with an `AbortController` and a `cancelled` flag.
3. Filters the scenes: capability ⊆ `SUPPORTED_CELEBRATION_CAPABILITIES`, the ID is allowlisted, the ID exists in the bundled event (known events), and there is no `event` block (known events) or there must be one (external-only).
4. Builds the loaders and the labels, and returns `{ events, labels, packKey, catalogRevision }`.

`CelebrationHost` builds the `resetKey` string from these parts plus the policy. While the catalog or manifest is pending, the host passes the bundled loader for known events, so the decoration appears immediately. It passes no loader for external-only events, so they appear once resolved. A late resolution changes `packKey` and therefore `resetKey`. That reloads the event before any activation in practice, because resolution takes about one RTT. If the user is mid-scene, that bundled scene is cancelled, which the contract accepts.

The alternative was to block the decoration until the pack resolves. It delays every known event by a network round trip, and the contract says failure before activation must equal bundled anyway.

### D7: A lazy `packs` entry point in the library

The C3 types, enums and `SUPPORTED_CELEBRATION_CAPABILITIES` go in the main entry, so the app can negotiate without loading the runtime. `LottieScene`, `StaticTriggerDecoration`, `createCelebrationSceneFromDescriptor`, `replaceCelebrationScenes` and `createCelebrationEventFromDescriptor` go in `@epam/ai-dial-celebrations/packs` (`libs/celebrations/src/packs/index.ts`). That gives a new `exports` entry and Vite lib entry, following `./halloween` and `./new-year`.

The host loaders are fixed closures:

- A known event: `async () => (await import('@epam/ai-dial-celebrations/packs')).replaceCelebrationScenes((await import('@epam/ai-dial-celebrations/new-year')).newYearEvent, scenes)`.
- An external-only event: the same `packs` import plus `createCelebrationEventFromDescriptor`.

No specifier is derived from an ID.

The alternative was to export everything from the main entry. That would put `LottieScene` and its session code in the chunk every page loads, against the lazy-loading contract.

### D8: `LottieScene` reuses the S1 session, and the failure phase decides the fallback

`LottieScene` calls `useLottieSceneSession` with these settings:

- `playback.timings` come from the descriptor, and the ownership is `Shared`.
- `prepare` returns `{ data }`. The session's `loadPlayer` is wrapped so that it awaits `Promise.all([loadLottiePlayer(), loaders.loadAnimationData(id, signal)])` under the single `loadTimeoutMs`. This adds no stacked wait, as the timing contract requires.
- `onAnimationCreated` installs the DOM-size guard (more than 800 generated elements → `cancel` as failure) and a `MutationObserver`-free check after `DOMLoaded`.
- `onPlaybackStarted` sets `playbackStartedRef`.

On `LottieScenePhase.Failed`, the scene renders the poster if `playbackStartedRef` is false and nothing if it is true. A poster ends after `posterDurationMs` via a local timer. The provider still bounds the scene with `maxLifetimeMs`.

Implemented: the session takes an optional `loadData(signal)` beside `loadPlayer`, awaited with it under the single `loadTimeoutMs` and aborted when the session ends first, and `prepare` receives the loaded data. The element guard is an optional `isRendererAccepted(host)` on `LottieScenePlayback`, checked at `DOMLoaded` before `play`, so a rejection is a failure before playback. Both are internal APIs covered by the session tests.

One additive C3 field: `CelebrationPackDescriptor.labels` carries the pack's English labels, which `createCelebrationEventFromDescriptor` uses as the event's defaults. The app adapter fills it from `CelebrationPackDto.labels.en`; host translations still arrive through the provider's `labels` prop.

The alternative was a second session implementation for external data, which would duplicate the exactly-once teardown that S1 proved.

### D9: Poster after activation for a known event

When a known event fails after activation but before playback, the scene shows the external poster and never the bundled scene. The provider has already sent the bundled `snowmanDeliveryToastMessage` notification on activation (`celebrate` in `libs/celebrations/src/context/CelebrationContext.tsx`). Swapping in the bundled scene would need provider changes to suppress a second notification, and the contract only says it MAY. The `celebration-source-selection` delta makes this explicit.

### D10: Snowman-delivery as the pilot, with `viewport-stage-v1` and `mirror`

The external clip is a self-contained viewport animation. It does not borrow the starter card, so it reads no anchors. `direction: mirror` handles RTL. There are two variants (desktop, mobile), and both are light/dark-neutral. The timing is 12 s of playback within a 15 s lifetime. Authoring follows `celebration-lottie-authoring-profile`: no text layers, no expressions, no images.

The bundled 27.5 s story stays the fallback. This is deliberately a visual change during the pilot: the external version is simpler. The other options are compared in the proposal.

### D11: Themes repository publication and cache split

The `ai-dial-chat-themes` change adds `static/celebrations/index.json` and `static/celebrations/new-year-default/1.0.0/{manifest.json, snowman-delivery.desktop.<hash16>.json, snowman-delivery.mobile.<hash16>.json, snowman-delivery.poster.<hash16>.svg}` and `static/celebrations/company-anniversary/1.0.0/…`. `static/config.json` is not changed.

The new script `scripts/check-celebration-packs.mjs` recomputes bytes and hashes and checks references, ID rules, caps, Lottie subset rules (`ddd`, text layers, expressions, images, counts) and `playbackDurationMs = (op - ip) / fr × 1000 ± 1 frame`. It runs in that repo's CI. Its rules are ported from `openspec/changes/archive/2026-10-01-define-celebration-pack-contracts-and-baseline/examples/check-contract-examples.mjs`.

`nginx/themes.conf.template` gets only new locations: `location = /celebrations/index.json { add_header Cache-Control "public, max-age=60, must-revalidate"; }` and `location /celebrations/ { add_header Cache-Control "public, max-age=31536000, immutable"; }`. The existing rules, including `expires 1w` for `config.json`, are untouched. The BFF reads with Node `fetch`, which has no HTTP cache, so the split matters for any CDN or proxy in front of the themes host.

Retention: keep the version the index lists plus one previous version per pack. The check script fails at a fourth version. Older versions are deleted in a separate change once no index revision from the last 30 days references them. One snowman version is roughly 0.3–0.7 MB raw, so without this rule each release would add a full copy to the image and to git history.

Publication order: resources, then the manifest, then `celebrations/index.json`. That repository has its own review. The Chat PRs do not depend on it, because tests use fixtures.

### D12: The celebrations endpoints compress their own responses

`apps/chat-api` has no compression middleware, and Lottie JSON compresses 5–8×. Immutable resources are compressed once with Node `zlib` (Brotli 11 / gzip 9) after verification, and the copies are kept in the immutable store under its byte limit. The index is compressed per response at Brotli 5. Negotiation uses `Accept-Encoding`, with `Vary: Accept-Encoding`. `sha256` and `bytes` keep describing the identity bytes.

The alternatives were the `compression` middleware, which is a new dependency and would compress every API response (including SSE streaming, which it can break unless excluded), or leaving it to the ingress, which is not guaranteed in every deployment.

## Risks / Trade-offs

- [The theme binding (S5) and the pack live in different files, published non-atomically] → An unresolvable binding falls through to the index default and then to bundled. Publication order: pack, then index, then binding in `config.json`.
- [A custom dark theme gets `light` variants until S5] → The pilot clips are light/dark-neutral. S5 adds the theme's `colorScheme`.
- [A late pack resolution cancels a bundled scene the user just started] → Resolution takes about one RTT after the start page renders, so the window is small. The scene is cosmetic, and the contract accepts the cancellation.
- [The depth-guard scanner is hand-written, which is a security-relevant parser] → Unit tests cover strings with brackets, escapes, deep nesting and truncated input. The guard only rejects; parsing is still `JSON.parse`.
- [The 800-element runtime check needs the renderer to exist first] → It runs immediately after `DOMLoaded`, before the first visible frame. Exceeding it counts as a failure before playback, so the poster shows.
- [The external snowman is visually simpler than the bundled story] → This is a pilot. The default stays `bundled`, and an operator opts in per deployment.
- [The themes repository change lands separately] → Fixtures in `apps/chat-api/src/celebrations/tests/fixtures/` mirror the published layout. End-to-end verification against a real themes host is a separate manual task.
- [Public endpoints with no in-app rate limit] → Invalid or unknown IDs never reach upstream. Valid IDs are served from the immutable store. The catalog refetches at most once per 60 s per instance. The ingress owns request rate limits.

## Migration Plan

1. **PR 1: library.** Characterization tests, C3 types and capabilities, the `packs` entry with `LottieScene`, the factory, scene replacement and the static trigger. Stories for both. README.
2. **PR 2: BFF.** The `apps/chat-api/src/celebrations` domain (reader, store, normalizers, `CelebrationsController`, DTOs) and the delivery-policy config. Then `npm run openapi`, regenerate the client and update the README, `.env.template` and `docs/architecture.md`.
3. **PR 3: app.** `celebrations.api.ts`, `useCelebrationPacks`, the `CelebrationHost` composition and `resetKey`, and browser tests.
4. **Themes repository PR.** `celebrations/index.json`, the packs, the check script and the nginx locations for `/celebrations/`. `config.json` is not touched.
5. **Enable.** In a test deployment, set `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=new-year/snowman-delivery`, and for the external-only event `UI_EVENT=company-anniversary` with `UI_EVENT_EXTERNAL_EVENTS=company-anniversary`.

Rollback: unset the variables, or remove the single allowlist entry. Either changes `resetKey`, which cancels playback. Reverting PR 3 restores today's host. Deleting `celebrations/index.json` returns every event to bundled without touching themes. PRs 1 and 2 are additive and inert without PR 3. Published pack versions are never deleted during the migration window.

## Open Questions

1. Who authors the external snowman-delivery Lottie (design team, or Claude-generated with review)? Its byte size against the 300 KiB cap is unknown until it exists.
2. Should `scripts/check-celebration-packs.mjs` emit a JSON Schema (S0 open question 5), and should a copy live in this repository? This change ports the rules only.
3. The uncommitted change `add-new-year-reindeer-takeoff` adds a fourth New Year scene, `reindeer-takeoff`, and puts it in the secret pool beside `gift-wrapping`. Whichever change archives second must update the New Year invariant in the `celebration-source-selection` "Composition by stable scene ID" requirement. The pilot is unaffected, because the click pool is unchanged.
4. Does any production ingress already rate-limit `/api/*`? If not, an operator note is needed before enabling the public v1 endpoints in a large tenant.
