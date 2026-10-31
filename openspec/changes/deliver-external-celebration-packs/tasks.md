<!--
Slicing strategy: contract-first. S0 already fixed C1/C2/C3, so each layer builds
against the frozen shapes and ships as its own inert, verifiable PR: library (1–4),
BFF celebrations domain (5–8), app (9–11), themes repository (12). The highest-risk pieces come first
inside their layers: the characterization tests (1) and the upstream reader (5).
Nothing changes behavior until slice 10 wires the host, and the default policy stays `bundled`.
-->

## 1. Characterization tests (before relying on provider facts)

- [x] 1.1 In `libs/celebrations/src/context/tests/CelebrationRuntime.spec.tsx`, add "keeps the loaded event when the loader function identity changes" and "keeps a playing scene mounted when selection changes". Change no source.
  - Verification: `npm run test:file -- libs/celebrations/src/context/tests/CelebrationRuntime.spec.tsx`
- [x] 1.2 If either test fails, stop and record the observed behavior as an Open Question in `design.md` before going on to slice 10.

## 2. Library contract types and capabilities

- [x] 2.1 Add the C3 types and string enums (`CelebrationCapability`, `CelebrationDirectionMode`, `CelebrationLayout`, `CelebrationColorScheme`, placement template/fit/align) and `CelebrationVariantContext`, `CelebrationAssetLoaders` and the descriptor interfaces. Put the interfaces in `libs/celebrations/src/models/celebration-pack.ts` and the enums in `libs/celebrations/src/types/celebration-pack.ts`, with JSDoc on every field.
- [x] 2.2 Add `SUPPORTED_CELEBRATION_CAPABILITIES` in `libs/celebrations/src/constants/celebration-capabilities.ts`, without `composer-anchor-v1`, and export everything from `libs/celebrations/src/index.ts`.
- [x] 2.3 Add pure helpers with unit tests in `libs/celebrations/src/utils/celebration-variant.ts`: `selectCelebrationVariant` (most matches, declaration-order ties, `undefined` on no match) and `resolveStageAlignment` (maps `align` to logical block/inline edges; `start`/`end` resolve against the supplied direction through the stage's own `dir`, and the poster's `object-position` through `resolvePosterObjectPosition` in `libs/celebrations/src/utils/celebration-pack-scene.ts`).
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/celebration-variant.spec.ts`

## 3. Generic Lottie scene

- [x] 3.1 Extend `LottieSceneSessionOptions`/`UseLottieSceneSessionOptions` in `libs/celebrations/src/models/lottie-scene.ts` with an optional `loadData(signal)`. In `libs/celebrations/src/utils/lottie-scene-session.ts`, await it together with the player under the single `loadTimeoutMs`, abort it on cancel, and ignore a late result. Add the session tests: abort on cancel, late resolve ignored, rejection → `Failed`, no stacked deadline.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-scene-session.spec.ts`, `npm run test:file -- libs/celebrations/src/hooks/tests/useLottieSceneSession.spec.tsx`, `npm run test:file -- libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx`
- [x] 3.2 Implement `libs/celebrations/src/components/LottieScene/LottieScene.tsx` with `LottieScene.module.scss`:
  - variant selection and `viewport-stage-v1` fit/align
  - `mirror` in RTL and an `inert` stage
  - `Shared` ownership
  - an 800-element guard after readiness
  - a poster `<img alt="">` for reduced motion, pre-playback failure and an unsupported variant
  - nothing after a post-start failure
  - a `posterDurationMs` timer
- [x] 3.3 Add `libs/celebrations/src/components/LottieScene/tests/LottieScene.spec.tsx`, with an injected player and loaders, covering:
  - reduced motion loads nothing but the poster
  - cancellation aborts the signal
  - a load timeout shows the poster
  - `data_failed` after the first frame renders nothing, with teardown exactly once
  - the RTL mirror and alignment
  - the element-cap failure
  - Verification: `npm run test:file -- libs/celebrations/src/components/LottieScene/tests/LottieScene.spec.tsx`
- [x] 3.4 RTL check: `LottieScene.module.scss` uses only logical properties, and alignment derives from the supplied direction, never from the document language.

## 4. Descriptor factory, scene replacement, static trigger and the `packs` entry

- [x] 4.1 Implement `libs/celebrations/src/components/StaticTriggerDecoration/StaticTriggerDecoration.tsx` with its `.module.scss`. It is a native `<button type="button">` named by the resolved label (default `Play celebration`), with an `aria-hidden` `<img alt="">`, a `focus-visible` outline in `currentColor`, logical properties and no colors of its own. Add tests in `.../tests/StaticTriggerDecoration.spec.tsx` that query by role and name and cover Enter, Space and click.
  - Verification: `npm run test:file -- libs/celebrations/src/components/StaticTriggerDecoration/tests/StaticTriggerDecoration.spec.tsx`
- [x] 4.2 Implement `createCelebrationSceneFromDescriptor`, `replaceCelebrationScenes` and `createCelebrationEventFromDescriptor` in `libs/celebrations/src/utils/celebration-descriptor-event.ts`, with tests:
  - replacement keeps the three New Year IDs, the pools, the secret and the bundled `labelId`, and ignores unknown IDs
  - the external event has no secret, no decor behaviors and a filtered click pool
  - the factory throws without an `event` block
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/celebration-descriptor-event.spec.tsx`
- [x] 4.3 Add the `packs` entry. That means `libs/celebrations/src/packs/index.ts`, a `./packs` export in `libs/celebrations/package.json` (with the `@epam/source`, types, import and default conditions), a matching Vite lib entry in `libs/celebrations/vite.config.ts`, and the path in `tsconfig.base.json` if the existing entries use one.
- [x] 4.4 Add Storybook stories `libs/celebrations/src/stories/LottieScene.stories.tsx` and `StaticTriggerDecoration.stories.tsx`, using a local fixture Lottie and poster and fixture loaders.
- [x] 4.5 Architecture guard: `libs/celebrations/src/**` contains no `fetch`, no `/api` string, no `@epam/ai-dial-chat-api-client`, no `react-i18next`, no env/storage/router access and no `innerHTML`. `npm exec nx lint celebrations` passes the module-boundary rules.
- [x] 4.6 Update `libs/celebrations/README.md`:
  - the main-entry exports (types, enums, capabilities)
  - a new `@epam/ai-dial-celebrations/packs` section with compiling examples for `LottieScene`, `StaticTriggerDecoration`, the factory and `replaceCelebrationScenes`
  - any new `dial-*` class in the class table
  - Verification: `npm run validate:docs`
- [x] 4.7 Slice check: `npm run verify:changed` and `npm run build:quiet`. Inspect the `dist` chunks to confirm `LottieScene` lives only in the `packs` chunk and `lottie_light` stays lazy.

## 5. BFF celebrations domain: upstream reader and immutable store

- [ ] 5.1 Create the domain folder `apps/chat-api/src/celebrations/` with `celebrations.module.ts`, and import `CelebrationsModule` in `apps/chat-api/src/app/app.module.ts` beside `ThemesModule`. Do not touch `apps/chat-api/src/themes/**`.
- [ ] 5.2 Implement `apps/chat-api/src/celebrations/celebrations-upstream.reader.ts`:
  - containment under `<THEMES_CONFIG_URL>/celebrations/`, plus rejection of `..`, `\`, `:` and a leading `/`
  - `redirect: 'error'` and the `THEMES_SERVICE_TIMEOUT_MS` abort
  - a streaming byte cap, an exact-`bytes` check, `sha256` and the media-type allowlist
  - typed `NotFoundException`/`BadGatewayException`/`ServiceUnavailableException`
  - `Logger.warn` on every rejection, without bodies
- [ ] 5.3 Implement `apps/chat-api/src/celebrations/immutable-resource.store.ts`: a byte-bounded LRU with a 16 MiB total and a 300 KiB per-entry cap, single-flight, storing verified entries only. Each entry holds the identity bytes plus lazily created `br`/`gzip` copies for JSON and SVG, and every copy counts toward the total.
- [ ] 5.4 Implement the JSON depth guard in `apps/chat-api/src/celebrations/json-depth.ts`.
- [ ] 5.5 Unit tests next to the sources:
  - `celebrations-upstream.reader.spec.ts`: traversal, absolute and encoded paths, a path outside `celebrations/`, a redirect, a timeout, the oversize stream, and declared-vs-actual, hash and MIME mismatches
  - `immutable-resource.store.spec.ts`: byte eviction, the per-entry cap, single-flight and no storage of failures
  - `json-depth.spec.ts`: brackets inside strings, escapes, the depth limit and truncated input
  - Verification: `npm run test:file -- apps/chat-api/src/celebrations/celebrations-upstream.reader.spec.ts`, `npm run test:file -- apps/chat-api/src/celebrations/immutable-resource.store.spec.ts`, `npm run test:file -- apps/chat-api/src/celebrations/json-depth.spec.ts`

## 6. BFF normalizers, service and DTOs

- [ ] 6.1 Implement `apps/chat-api/src/celebrations/celebration-index.normalizer.ts`:
  - an allowlist of `schemaVersion`, `revision`, `packs[]` and `defaults`, with no `manifest.*` in the output
  - dropping a default for an unlisted pack or a mismatched `eventId`
  - rejecting duplicate `packId@version`, bad IDs and an unsupported `schemaVersion`
  - the 64 KiB and depth caps

  Put the C1 fixtures in `apps/chat-api/src/celebrations/tests/fixtures/` (the `index.json` and manifests for `snowman-delivery` and `company-anniversary`), based on the archived S0 fixtures.
- [ ] 6.2 Implement `apps/chat-api/src/celebrations/celebration-manifest.normalizer.ts`. It checks `schemaVersion: 1`, the index identity match, the ID regexes, declared references, timing bounds, counts and label caps and the field allowlist, and adds `catalogRevision`.
- [ ] 6.3 Add the DTO classes, with `@ApiProperty` on every field and enums as string enums, in `apps/chat-api/src/celebrations/dto/`: `celebration-catalog.dto.ts`, `celebration-pack.dto.ts`, and `get-celebration-pack.dto.ts` and `get-celebration-asset.dto.ts` with the `@Matches` allowlists.
- [ ] 6.4 Implement `apps/chat-api/src/celebrations/celebration-catalog.service.ts`:
  - `celebrations:v1:index` in `CACHE_MANAGER` with a 60 s TTL, plus a last-valid fallback
  - manifests and assets through the store and the asset index
  - `404` for unknown IDs with no upstream call
  - rejecting a manifest whose `assetId` collides with a different `sha256`
- [ ] 6.5 Unit tests: `celebration-index.normalizer.spec.ts`, `celebration-manifest.normalizer.spec.ts` and `celebration-catalog.service.spec.ts` (TTL, last valid revision, unknown asset gives no fetch, invalid manifest gives 502 and is not cached, collision, index 404).
  - Verification: `npm run test:file -- apps/chat-api/src/celebrations/celebration-index.normalizer.spec.ts`, `npm run test:file -- apps/chat-api/src/celebrations/celebration-manifest.normalizer.spec.ts`, `npm run test:file -- apps/chat-api/src/celebrations/celebration-catalog.service.spec.ts`

## 7. BFF controller and compression

- [ ] 7.1 Implement `apps/chat-api/src/celebrations/celebrations.controller.ts`, with `@Public()`, `@ApiTags('celebrations')` and `@Controller({ path: 'celebrations', version: '1' })`:
  - the `getCelebrationCatalog`, `getCelebrationPack` and `getCelebrationAsset` handlers
  - `@ApiOperation` and an `@ApiResponse` for 200/400/404/502/503
  - the `Cache-Control`, `nosniff` and SVG CSP headers
- [ ] 7.2 Add `apps/chat-api/src/celebrations/response-encoding.ts`. It negotiates `br` → `gzip` → identity for JSON and SVG, sends `Content-Encoding` and `Vary: Accept-Encoding`, serves PNG and WebP as identity, and uses Node `zlib` only. Unit tests go in `response-encoding.spec.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/celebrations/response-encoding.spec.ts`
- [ ] 7.3 Supertest integration tests in `apps/chat-api/src/celebrations/celebrations.controller.spec.ts`:
  - each endpoint's happy path and headers
  - an invalid ID gives 400 with no upstream call
  - an unknown pack or asset gives 404
  - a hash, size or MIME mismatch or an unsupported schema gives 502
  - a timeout or unset `THEMES_CONFIG_URL` gives 503
  - an index `ETag`/`304`
  - `br` decodes to the declared `sha256`, identity without `Accept-Encoding`, and no encoding for PNG
- [ ] 7.4 Themes guard: `git diff --stat origin/development -- apps/chat-api/src/themes` is empty, and the existing tests pass unchanged.
  - Verification: `npm run test:file -- apps/chat-api/src/celebrations/celebrations.controller.spec.ts`, `npm run test:file -- apps/chat-api/src/themes/tests/theme.controller.spec.ts`, `npm run test:file -- apps/chat-api/src/themes/tests/theme.service.spec.ts`

## 8. Delivery policy config, OpenAPI and docs

- [ ] 8.1 Add `UI_EVENT_DELIVERY_MODE`, `UI_EVENT_DELIVERY_REVISION`, `UI_EVENT_EXTERNAL_SCENES` and `UI_EVENT_EXTERNAL_EVENTS` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`, with validators, list parsing and the 64-entry limit.
- [ ] 8.2 Add the four registry entries in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, the env mapping in `env-config.provider.ts` and the defaults in `static-defaults.provider.ts`. Add `CelebrationDeliveryDto`, `CelebrationDeliveryMode` and the `celebrationDelivery` field to `apps/chat-api/src/app-config/dto/client-config-response.dto.ts`, plus the mapping in `client-config.mapper.ts`.
- [ ] 8.3 Tests: extend `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts`, `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` and the env-validation spec for the defaults, a valid pair and a rejected pair.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts`, `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`
- [ ] 8.4 Run `npm run openapi` and `npm run openapi:check`. Confirm `libs/chat-api-client/openapi.json` has `getCelebrationCatalog`, `getCelebrationPack` and `getCelebrationAsset` with strong types and `celebrationDelivery`. Run `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`.
- [ ] 8.5 Docs:
  - the four variables in `apps/chat-api/README.md` and `apps/chat-api/.env.template`
  - the `celebrations` domain, the controller path `/api/v1/celebrations` and the immutable store in `docs/architecture.md`
  - `npm run validate:docs`
- [ ] 8.6 Slice check: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` and `npm run verify:changed`.

## 9. App API wrapper

- [ ] 9.1 Add the generated `CelebrationsApi` singleton (`celebrationsApi`) to `apps/chat/src/server-api/api-client.ts`.
- [ ] 9.2 Implement `apps/chat/src/server-api/celebrations.api.ts` with these functions. They send no `If-None-Match`.
  - `getCelebrationCatalog(signal)`
  - `getCelebrationPack(packId, version, signal)`
  - `loadCelebrationAssetJson(assetId, signal)`, which uses `getCelebrationAssetRaw` and `JSON.parse`
  - `getCelebrationAssetUrl(assetId)`, which builds `/api/v1/celebrations/assets/{id}` with `encodeURIComponent`
- [ ] 9.3 Tests in `apps/chat/src/server-api/tests/celebrations.api.spec.ts`: the signal is forwarded, a non-2xx rejects, and the URL is encoded.
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/celebrations.api.spec.ts`

## 10. App pack resolution and host composition

- [ ] 10.1 Implement `apps/chat/src/hooks/celebration/useCelebrationPacks.ts`, following `useFavicon` for JSDoc, the `AbortController` and the cancelled flag:
  - zero-request short-circuit cases
  - resolution from the index `defaults[eventId]`
  - capability, allowlist, known-ID and `event`-block filtering
  - label localization (exact → base → `en`, no override of bundled IDs)
  - a page-lifetime memo for manifests and parsed animation data
  - memoised `events`, `labels`, loaders and `packKey`
  - fixed `import('@epam/ai-dial-celebrations/packs')` / `new-year` loaders only
- [ ] 10.2 Add the `@epam/ai-dial-celebrations/packs` alias to `apps/chat/vite.config.mts` beside `/halloween` and `/new-year` (subpaths before the bare alias). Update `apps/chat/src/context/CelebrationHost.tsx`:
  - use `useCelebrationPacks`
  - build the composite `resetKey` string (route key, event, mode, policy revision, catalog revision, `packKey`, theme ID, color scheme, `i18n.dir()`, layout, selection revision `none`)
  - merge pack labels into `labels`
  - keep the `ANCHORS` and the guard comment
- [ ] 10.3 Hook tests in `apps/chat/src/hooks/celebration/tests/useCelebrationPacks.spec.ts`:
  - `bundled`, `UI_EVENT=none` and a non-allowlisted scene make no request
  - a `GET /api/v1/celebrations` `503` keeps the bundled event
  - an unsupported capability keeps the bundled event
  - an external-only event that is not admitted makes no request
  - an admitted one resolves the factory event
  - aborting on unmount and on an input change
  - stable identities across an unrelated re-render
  - locale fallback
  - Verification: `npm run test:file -- apps/chat/src/hooks/celebration/tests/useCelebrationPacks.spec.ts`
- [ ] 10.4 Host tests in `apps/chat/src/context/tests/CelebrationHost.spec.tsx` and `CelebrationHost.integration.spec.tsx`:
  - the default policy behaves as today
  - an allowlisted `snowman-delivery` renders the external scene, while `penguin-star` and the `happy new year` → `gift-wrapping` path stay bundled
  - a theme, direction or layout change cancels the playing scene
  - a language change does not
  - the `company-anniversary` trigger is reachable by role and name and plays on Enter
  - Verification: `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.spec.tsx`, `npm run test:file -- apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx`
- [ ] 10.5 RTL check: under `dir="rtl"` the external `mirror` scene flips and the static trigger keeps logical spacing. Cover this in the host integration spec.
- [ ] 10.6 i18n: no new `en.json` keys. Confirm that the replaced scene still shows `newYear.snowmanDeliveryToastMessage` and that `npm run validate:specs` reports no missing translation keys.

## 11. Browser coverage and full verification

- [ ] 11.1 Extend `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs` with Storybook scenarios for `LottieScene`:
  - slow loader → poster
  - broken asset → poster
  - mid-playback failure → nothing and no replay
  - a stale late resolution after cancel
  - replay reuses cached data
  - the static trigger by keyboard
- [ ] 11.2 Update `docs/architecture.md` for the composite `resetKey` and the app-owned pack resolution in the celebrations section, and run `npm run validate:docs`.
- [ ] 11.3 Run `npm run spec:impact` and resolve any reported celebration spec drift.
- [ ] 11.4 Run `npm run verify:full` once.

## 12. Themes repository (`epam/ai-dial-chat-themes`, separate PR)

- [ ] 12.1 Author `snowman-delivery` desktop and mobile Lottie (12 s playback, `viewport-stage-v1`, authoring-profile subset, light/dark-neutral) and a static SVG poster. Author a `company-anniversary` `confetti` clip, its poster and an icon.
- [ ] 12.2 Publish `static/celebrations/new-year-default/1.0.0/` and `static/celebrations/company-anniversary/1.0.0/` with hashed file names and `manifest.json`, plus `static/celebrations/index.json` with `schemaVersion`, `revision`, `packs` and `defaults`. Do not change `static/config.json`.
- [ ] 12.3 Add `scripts/check-celebration-packs.mjs`, porting the S0 `check-contract-examples.mjs` rules to the index and manifests, and run it in that repository's CI.
- [ ] 12.4 Add only new locations to `nginx/themes.conf.template`: `= /celebrations/index.json` gets `public, max-age=60, must-revalidate`, and `/celebrations/` gets `public, max-age=31536000, immutable`. Leave the existing rules untouched. Document the publication order (resources → manifest → `celebrations/index.json`) in that repository's README.
- [ ] 12.5 Implement the retention rule in `scripts/check-celebration-packs.mjs`: fail when the repository holds more than three versions of one pack. Document the policy in that repository's README: keep the current and the previous version, and delete older versions only in a separate change once no index revision from the last 30 days references them.

## 13. Follow-ups (out of scope, record only)

- [ ] 13.1 File a follow-up for S5: `GET /api/v1/themes` with camelCase normalization (the mapping table in `celebration-pack-contracts`, including the `model-garden-*` drop), the `ThemeContext` migration, `colorScheme`, and theme bindings to packs from `celebrations/index.json`.
- [ ] 13.2 File a follow-up to confirm ingress rate limiting for `/api/v1/celebrations*` in production deployments (design Open Question 4).
- [ ] 13.3 Update the scope and acceptance criteria of issue #9221: `/api/v1/celebrations*` instead of `/api/v1/themes*`, and the `snowman-delivery` pilot instead of `sleigh`.
