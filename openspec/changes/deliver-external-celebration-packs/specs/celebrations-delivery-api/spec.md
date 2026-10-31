## ADDED Requirements

### Requirement: A separate celebrations domain with versioned public endpoints

`apps/chat-api` SHALL add a `celebrations` domain folder at `apps/chat-api/src/celebrations/`, containing `CelebrationsModule`, `CelebrationsController`, the services and `dto/`. `AppModule` (`apps/chat-api/src/app/app.module.ts`) SHALL import `CelebrationsModule` beside `ThemesModule`. The themes domain (`apps/chat-api/src/themes/`) SHALL NOT change.

`CelebrationsController` SHALL be declared as `@Controller({ path: 'celebrations', version: '1' })`, `@Public()` and `@ApiTags('celebrations')`. It SHALL expose exactly the endpoints below. None of them accepts a body, reads the session or returns user data, so any caller, authenticated or not, may call them. None is gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

| Method and path | Request DTO | 200 response | operationId / SDK method | Frontend call |
| --- | --- | --- | --- | --- |
| `GET /api/v1/celebrations` | none | `CelebrationCatalogDto` (JSON) | `getCelebrationCatalog` | normal |
| `GET /api/v1/celebrations/packs/{packId}/{version}` | `GetCelebrationPackDto` (path) | `CelebrationPackDto` (JSON) | `getCelebrationPack` | normal |
| `GET /api/v1/celebrations/assets/{assetId}` | `GetCelebrationAssetDto` (path) | raw bytes with the registered `Content-Type` | `getCelebrationAsset` | `getCelebrationAssetRaw` for Lottie JSON. Posters and icons are loaded by `<img src>` from an app-built URL |

Path parameters SHALL be validated with `@Matches` allowlists:

- `packId`: `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`, at most 64 characters.
- `version`: `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$`.
- `assetId`: `^[a-z0-9][a-z0-9-]{0,95}$`.

Errors, each documented with `@ApiResponse`:

- `400`: an ID fails its allowlist. No upstream request is made.
- `404`: the pack or version is not in the current valid celebration index, or the asset is in no manifest that index lists.
- `502`: an invalid upstream status, unsupported `schemaVersion`, schema violation, exceeded cap, MIME mismatch or hash mismatch.
- `503`: an upstream timeout, an unreachable upstream, or `THEMES_CONFIG_URL` not configured.

No `429` is declared. See `celebration-pack-contracts` "Normalized BFF DTOs".

Example request: `GET /api/v1/celebrations`. Example 200 response:

```json
{
  "schemaVersion": 1,
  "revision": "2026-11-15.1",
  "packs": [
    { "packId": "new-year-default", "version": "1.0.0", "eventId": "new-year" },
    { "packId": "company-anniversary", "version": "1.0.0", "eventId": "company-anniversary" }
  ],
  "defaults": {
    "new-year": { "packId": "new-year-default", "version": "1.0.0" },
    "company-anniversary": { "packId": "company-anniversary", "version": "1.0.0" }
  }
}
```

Example request: `GET /api/v1/celebrations/packs/new-year-default/1.0.0`. Example 200 response:

```json
{
  "packId": "new-year-default",
  "version": "1.0.0",
  "eventId": "new-year",
  "catalogRevision": "2026-11-15.1",
  "requiredCapabilities": ["lottie-light-svg-v1", "viewport-stage-v1", "static-poster-v1"],
  "assets": [
    { "assetId": "new-year-default-snowman-delivery-desktop-5b0c7e19a2d4f836", "mediaType": "application/json", "bytes": 182344, "sha256": "5b0c7e19a2d4f836…(64 hex)" },
    { "assetId": "new-year-default-snowman-delivery-mobile-c3a91f0e64b27d58", "mediaType": "application/json", "bytes": 121907, "sha256": "c3a91f0e64b27d58…(64 hex)" },
    { "assetId": "new-year-default-snowman-delivery-poster-8e2d4a6c0f1b3957", "mediaType": "image/svg+xml", "bytes": 5210, "sha256": "8e2d4a6c0f1b3957…(64 hex)" }
  ],
  "labels": {},
  "scenes": [
    {
      "id": "snowman-delivery",
      "labelId": "snowmanDeliveryToastMessage",
      "renderer": "lottie-light-svg-v1",
      "requiredCapabilities": ["lottie-light-svg-v1", "viewport-stage-v1", "static-poster-v1"],
      "placement": { "template": "viewport-stage-v1", "fit": "contain", "align": "bottom" },
      "direction": "mirror",
      "timing": { "playbackDurationMs": 12000, "loadTimeoutMs": 2000, "readyTimeoutMs": 250, "maxLifetimeMs": 15000 },
      "posterAssetId": "new-year-default-snowman-delivery-poster-8e2d4a6c0f1b3957",
      "posterDurationMs": 4000,
      "variants": [
        { "when": { "layout": "desktop" }, "animationAssetId": "new-year-default-snowman-delivery-desktop-5b0c7e19a2d4f836" },
        { "when": { "layout": "mobile" }, "animationAssetId": "new-year-default-snowman-delivery-mobile-c3a91f0e64b27d58" }
      ]
    }
  ]
}
```

Example error: `GET /api/v1/celebrations/assets/..%2Findex.json` returns `400` with `{ "statusCode": 400, "message": ["assetId must be a lowercase asset identifier"], "error": "Bad Request" }`.

#### Scenario: Catalog request
- **WHEN** a client calls `GET /api/v1/celebrations` and the upstream `celebrations/index.json` is valid
- **THEN** the response is `200` with a `CelebrationCatalogDto` and no session is required

#### Scenario: Themes are untouched
- **WHEN** the celebrations domain is registered
- **THEN** `GET /api/themes` and `GET /api/themes/icon` keep their responses, headers and validation byte-for-byte, and no file under `apps/chat-api/src/themes/` changes

#### Scenario: Traversal attempt
- **WHEN** a client requests `GET /api/v1/celebrations/assets/..%2Findex.json`
- **THEN** the BFF responds `400` and makes no upstream request

#### Scenario: Unknown asset
- **WHEN** a client requests a well-formed `assetId` that no manifest listed by the current index declares
- **THEN** the BFF responds `404` and makes no upstream request for the asset

#### Scenario: Themes host not configured
- **WHEN** `THEMES_CONFIG_URL` is unset and a client calls any celebrations endpoint
- **THEN** the BFF responds `503`

### Requirement: Index normalization from validated C1 only

`CelebrationCatalogDto` SHALL be produced by a pure normalizer in `apps/chat-api/src/celebrations/` from the upstream celebration index (`celebration-pack-contracts` "Published celebration index"). The normalizer SHALL:

- Read only the allowlisted fields `schemaVersion`, `revision`, `packs[].{packId, version, eventId, manifest}` and `defaults`. Unknown fields are stripped.
- Never emit `manifest.path`, `manifest.bytes` or `manifest.sha256`.
- Drop a `defaults` entry that names an unlisted pack, or a pack whose `eventId` differs from the key. The rest of the index is still served.
- Reject the whole index when one `packId@version` is listed twice, when an ID fails "Stable identifiers", or when `schemaVersion` is unsupported.

Every response DTO SHALL be a class with `@ApiProperty` on every field. The generated `CelebrationCatalogDto`, `CelebrationPackDto` and the wire JSON SHALL agree.

#### Scenario: Default bound to an unlisted pack
- **WHEN** `defaults.new-year` names `new-year-default@9.9.9`, which `packs` does not list
- **THEN** that default is dropped and the rest of the index is served

#### Scenario: No index published
- **WHEN** the themes host returns `404` for `celebrations/index.json`
- **THEN** `GET /api/v1/celebrations` responds `404`, and every known event stays bundled on the client

#### Scenario: Colliding asset IDs
- **WHEN** two listed manifests declare the same `assetId` with different `sha256`
- **THEN** the second manifest is rejected with `502`, and the first remains servable

### Requirement: Bounded, contained and verified upstream reads

Every upstream read for the celebrations endpoints SHALL go through one reader in `apps/chat-api/src/celebrations/`:

- It resolves the target from a server-side path only: the fixed `celebrations/index.json`, an index `manifest.path`, or a manifest-relative asset `file`.
- It requires the resolved URL to keep the origin of `THEMES_CONFIG_URL` and to stay under its `celebrations/` path. `..`, an absolute URL, a scheme or a backslash in the stored path makes the resource unavailable.
- It never builds a URL from client input other than the validated IDs used as registry keys.
- It uses `redirect: 'error'` and the existing `THEMES_SERVICE_TIMEOUT_MS` through an `AbortController`.
- It reads the body as a stream and aborts once the cap is exceeded. The caps are 64 KiB for the index, 64 KiB for a manifest, 300 KiB for Lottie JSON and 100 KiB for a poster or icon.
- It verifies the exact declared `bytes` and the lowercase SHA-256 before parsing, caching or serving, and verifies the declared media type against the allowlist `application/json`, `image/svg+xml`, `image/png`, `image/webp`.
- It parses JSON with a depth limit: 32 for the index and manifests, 64 for Lottie.

The index has no declared hash. It is bounded by its cap and validated by schema. Raw `fetch` is used because the themes host is a non-DIAL static upstream (`apps/chat-api/AGENTS.md`).

#### Scenario: Oversized animation
- **WHEN** an asset's actual bytes exceed 300 KiB, whatever its declared `bytes` says
- **THEN** the reader stops at the cap and `GET /api/v1/celebrations/assets/{assetId}` responds `502`

#### Scenario: Republished bytes under an existing version
- **WHEN** a manifest's bytes no longer match the `sha256` the index declares
- **THEN** `GET /api/v1/celebrations/packs/{packId}/{version}` responds `502`, and nothing is cached

#### Scenario: Upstream redirect
- **WHEN** the themes host answers a manifest request with `302` to another origin
- **THEN** the redirect is not followed and the BFF responds `502`

#### Scenario: Stored path escapes the celebrations root
- **WHEN** an index `manifest.path` is `../config.json`
- **THEN** that pack is treated as unpublished, and the request responds `404` without an upstream request

### Requirement: Manifest validation

`CelebrationPackDto` SHALL be produced from a manifest that passes all of these checks. Otherwise the endpoint responds `502`.

- `schemaVersion` is `1`.
- `packId`, `version` and `eventId` equal the index entry.
- Every ID matches the "Stable identifiers" rules of `celebration-pack-contracts`.
- Every `posterAssetId`, `animationAssetId` and `iconAssetId` is declared in `assets`.
- The timings are finite integers within the bounds of `celebration-lottie-authoring-profile` "Timing and deadlines".
- The counts stay under the caps: 32 assets, 16 scenes, 1–8 variants, 16 locales, 280 characters per label.
- `labels` includes `en` whenever it is non-empty.
- The manifest declares no field outside the v1 allowlist. Unknown fields are stripped, never forwarded.

The BFF does not know the client's compiled registry. Whether an `event` block is allowed for an event is therefore enforced by the publication check and by the client.

`catalogRevision` SHALL be the index `revision` the pack was resolved from.

#### Scenario: Reference to an undeclared asset
- **WHEN** a scene's `posterAssetId` is not in the manifest's `assets`
- **THEN** the endpoint responds `502`

#### Scenario: Unsupported schema version
- **WHEN** a manifest declares `schemaVersion: 2`
- **THEN** `GET /api/v1/celebrations/packs/{packId}/{version}` responds `502`, and the index and `/api/themes` are unaffected

### Requirement: Separate caches for the mutable index and immutable resources

Caching SHALL follow these rules:

| Key | Store | TTL | Invalidation |
| --- | --- | --- | --- |
| `celebrations:v1:index` | shared app cache (`CACHE_MANAGER`) | 60 s | TTL expiry. The last valid normalized index is also kept in memory and served when a later fetch is invalid |
| `celebrations:v1:manifest:<packId>:<version>` | immutable resource store | none | never in place. A new version is a new key. LRU eviction by bytes |
| `celebrations:v1:asset:<assetId>` | immutable resource store | none | never in place. A new hash is a new ID. LRU eviction by bytes |

- The immutable resource store SHALL be a byte-bounded LRU provided by `CelebrationsModule`, separate from the 100-entry app cache created in `apps/chat-api/src/app/cache.config.ts`. Its total limit is 16 MiB.
- Only verified resources SHALL be stored. Failures are not cached.
- Concurrent misses for one key SHALL share a single upstream request.
- HTTP headers: the index gets `Cache-Control: public, max-age=60, must-revalidate`, with the framework `ETag` and `304` on a matching `If-None-Match`. Manifests and assets get `Cache-Control: public, max-age=31536000, immutable` and `X-Content-Type-Options: nosniff`. SVG assets also get the `Content-Security-Policy` that `GET /api/themes/icon` sends for SVG.
- Revalidation is left to the browser HTTP cache. App wrappers SHALL NOT send `If-None-Match` through the generated client.

#### Scenario: Large assets do not evict unrelated entries
- **WHEN** assets totalling more than 16 MiB are requested
- **THEN** the oldest immutable resources are evicted, and entries in the shared app cache are untouched

#### Scenario: Index revision changes
- **WHEN** the themes host publishes a new index `revision` and 60 s pass
- **THEN** the next `GET /api/v1/celebrations` returns the new revision, while cached manifests of older versions remain servable

#### Scenario: Concurrent first requests
- **WHEN** ten requests for the same uncached asset arrive together
- **THEN** exactly one upstream request is made

### Requirement: Compressed responses without a new dependency

`apps/chat-api` registers no compression middleware, so the celebrations endpoints SHALL compress their own text responses.

- For `application/json` and `image/svg+xml` (the index, manifests, Lottie JSON and SVG posters), the BFF SHALL serve `br` when `Accept-Encoding` allows it, else `gzip`, else identity. It SHALL send `Content-Encoding` and `Vary: Accept-Encoding`.
- PNG and WebP SHALL be served as identity.
- Immutable resources SHALL be compressed once, after verification, with Node `zlib` (Brotli quality 11, gzip level 9). The compressed copies are stored next to the identity bytes in the immutable resource store, and the store counts every copy toward its 16 MiB limit.
- The index SHALL be compressed per response at Brotli quality 5.
- `sha256` and `bytes` always describe the identity bytes.
- No new npm dependency is added.

#### Scenario: Brotli-capable browser
- **WHEN** a browser requests a 180 KiB Lottie asset with `Accept-Encoding: gzip, br`
- **THEN** the response has `Content-Encoding: br` and `Vary: Accept-Encoding`, and its decoded body hashes to the declared `sha256`

#### Scenario: Client without compression
- **WHEN** a client sends no `Accept-Encoding`
- **THEN** the identity bytes are served with `Content-Length` equal to the declared `bytes`

#### Scenario: Already-compressed image
- **WHEN** a PNG poster is requested with `Accept-Encoding: br`
- **THEN** it is served as identity, without `Content-Encoding`

### Requirement: Observability of rejected resources

The celebrations reader SHALL log through `Logger`, at `warn` with the resource kind and ID, every resource it rejects: status, size, hash, MIME, schema, containment or timeout. It SHALL never log bodies. The existing `MetricsInterceptor` covers request counts. No new metric is added in this change; outcome telemetry is S8 (#9227).

#### Scenario: Hash mismatch logged
- **WHEN** an asset fails hash verification
- **THEN** one `warn` entry names the asset ID and the reason, and contains no asset bytes
