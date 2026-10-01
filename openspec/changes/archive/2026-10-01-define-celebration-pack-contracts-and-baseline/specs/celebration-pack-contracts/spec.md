## ADDED Requirements

Status legend used below: **[Contract]** means a requirement that S0 fixes and that follow-up stages must implement exactly. S0 implements no runtime code for it. **[Invariant]** means behavior that already exists at `1cfb11468` and that every follow-up stage must preserve. The test cited next to an invariant verifies it today.

### Requirement: Three separate contracts with named owners

**[Contract]** Celebration pack data SHALL cross three contracts. Each SHALL have exactly one owner, and no layer SHALL consume another layer's contract directly:

| Contract | Owner (authors/serves) | Consumer | Schema authority |
| --- | --- | --- | --- |
| C1, published catalog and pack JSON (`static/config.json` additions, `static/celebrations/<packId>/<version>/manifest.json`, hashed resources) | `epam/ai-dial-chat-themes` publication pipeline, or a compatible customer static host | `apps/chat-api/src/themes` only | This capability and `celebration-lottie-authoring-profile` |
| C2, normalized camelCase BFF DTOs (`ThemeCatalogDto`, `CelebrationPackDto`, raw asset bytes) | `apps/chat-api/src/themes` (Swagger DTOs, then OpenAPI, then `libs/chat-api-client`) | `apps/chat/src/server-api` wrappers only | Backend Swagger DTO classes |
| C3, transport-independent descriptors plus loader callbacks (`CelebrationPackDescriptor`, `CelebrationSceneDescriptor`, `CelebrationAssetLoaders`) | `libs/celebrations` (public types) | App adapter in `apps/chat` (`CelebrationHost` and a celebration resolver under `apps/chat/src/utils/celebrations/`) produces C3 values; `libs/celebrations` consumes them | `libs/celebrations` exported TypeScript types |

The browser SHALL NOT fetch C1 resources from the themes host. `libs/celebrations` SHALL NOT receive or construct HTTP paths, generated-client instances, auth/session data, `THEMES_CONFIG_URL`, app configuration, feature flags, storage keys, routes or locale-resolution logic. These rules extend the existing boundary: today the host already passes anchors and translated labels as props (`apps/chat/src/context/CelebrationHost.tsx:30-38,69-82`).

#### Scenario: The library never sees a transport detail
- **WHEN** a follow-up stage passes a C3 descriptor to `libs/celebrations`
- **THEN** the descriptor contains asset IDs, resolved labels and numeric parameters only, and all bytes reach the library through the host-supplied loader callbacks, not through a URL string chosen by the library

#### Scenario: A customer serves its own themes host
- **WHEN** a deployment points `THEMES_CONFIG_URL` at a compatible non-EPAM static host
- **THEN** that host publishes only C1 files, and no change to C2 or C3 is needed

### Requirement: Published catalog extension is additive to the existing config.json

**[Contract]** C1 SHALL extend the existing `config.json` (top-level `themes` and `images`, inspected at `epam/ai-dial-chat-themes@22cdaddbcb00c3b69c2dc021cb3bc594ace79f8d`) only with new optional fields. Existing fields, their kebab-case spellings and their meaning SHALL stay unchanged. Legacy readers, including today's `/api/themes` passthrough (`apps/chat-api/src/themes/theme.service.ts:116-122`), SHALL keep working when they ignore the new fields. A `config.json` without any new field SHALL remain a valid v1 catalog. New top-level fields:

- `schemaVersion`: integer. Absent means a legacy catalog.
- `revision`: string, 1 to 64 characters of `[A-Za-z0-9._-]`.
- `defaultThemeId`, `systemThemeIds`: see `appearance-override-contract`.
- `assets`: a registry of branding assets keyed by asset ID.
- `celebrationPacks`: the published packs, as `{ packId, version, eventId, manifest: { path, bytes, sha256 } }`.
- `defaultCelebrationPacks`: maps `eventId` to `{ packId, version }`.

Per-theme additions are `colorScheme`, `branding` and `celebrationPacks`. Example of the additions only; existing fields are abbreviated:

```json
{
  "schemaVersion": 1,
  "revision": "2026-10-01.1",
  "defaultThemeId": "light",
  "systemThemeIds": { "light": "light", "dark": "dark" },
  "themes": [
    { "id": "light", "displayName": "Light", "colors": { "bg-layer-0": "#FCFCFC" }, "colorScheme": "light" },
    { "id": "dark", "displayName": "Dark", "colors": { "bg-layer-0": "#090D13" }, "colorScheme": "dark" },
    {
      "id": "acme-night",
      "displayName": "Acme Night",
      "colors": { "bg-layer-0": "#0C101D" },
      "colorScheme": "dark",
      "branding": { "logoAssetId": "acme-logo-3f9a1c2b7d4e5f60" },
      "celebrationPacks": { "new-year": { "packId": "acme-new-year", "version": "1.0.0" } }
    }
  ],
  "images": { "chat-logo-light": "chat-logo-light.svg", "chat-logo-dark": "chat-logo-dark.svg", "chat-favicon": "chat-favicon.png" },
  "assets": {
    "acme-logo-3f9a1c2b7d4e5f60": {
      "path": "brands/acme/1.0.0/logo.3f9a1c2b7d4e5f60.svg",
      "mediaType": "image/svg+xml",
      "bytes": 6287,
      "sha256": "3f9a1c2b7d4e5f60a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718"
    }
  },
  "celebrationPacks": [
    {
      "packId": "new-year-default",
      "version": "1.0.0",
      "eventId": "new-year",
      "manifest": { "path": "celebrations/new-year-default/1.0.0/manifest.json", "bytes": 3412, "sha256": "b7e2…(64 hex)" }
    }
  ],
  "defaultCelebrationPacks": { "new-year": { "packId": "new-year-default", "version": "1.0.0" } }
}
```

Hashes shortened to `…(64 hex)` in these examples are full lowercase SHA-256 values in practice. Machine-checkable copies with full, internally consistent hashes are in this change's `examples/fixtures/` and are checked by `examples/check-contract-examples.mjs`. The `acme-night` binding to `acme-new-year@1.0.0` deliberately points to a pack the catalog does not list, to show a reference the BFF drops.

#### Scenario: A legacy catalog
- **WHEN** `config.json` has only `themes` and `images`
- **THEN** it is valid, the normalized catalog contains no packs and no new metadata, and today's theme behavior is unchanged

#### Scenario: A legacy reader meets an extended catalog
- **WHEN** a reader that knows only `themes`/`images` loads an extended `config.json`
- **THEN** its existing fields resolve exactly as before, and the reader can ignore every new field

### Requirement: Published pack manifest v1

**[Contract]** Each pack version SHALL publish exactly one immutable `manifest.json` with this shape. Asset `file` names are relative to the manifest directory.

```json
{
  "schemaVersion": 1,
  "packId": "new-year-default",
  "version": "1.0.0",
  "eventId": "new-year",
  "requiredCapabilities": ["lottie-light-svg-v1", "viewport-stage-v1", "static-poster-v1"],
  "assets": [
    { "assetId": "new-year-default-sleigh-desktop-9c1e4b7a2f3d6e80", "file": "sleigh.desktop.9c1e4b7a2f3d6e80.json", "mediaType": "application/json", "bytes": 148213, "sha256": "9c1e4b7a2f3d6e80…(64 hex)" },
    { "assetId": "new-year-default-sleigh-mobile-41d0aa93c5e7b218", "file": "sleigh.mobile.41d0aa93c5e7b218.json", "mediaType": "application/json", "bytes": 97105, "sha256": "41d0aa93c5e7b218…(64 hex)" },
    { "assetId": "new-year-default-sleigh-poster-0e6f2d9b1c4a7835", "file": "sleigh.poster.0e6f2d9b1c4a7835.svg", "mediaType": "image/svg+xml", "bytes": 4120, "sha256": "0e6f2d9b1c4a7835…(64 hex)" }
  ],
  "labels": {
    "en": { "sleighToastMessage": "Special delivery from the night sky. Send \"{{phrase}}\" in the start-page chat for a secret surprise." }
  },
  "scenes": [
    {
      "id": "sleigh",
      "labelId": "sleighToastMessage",
      "renderer": "lottie-light-svg-v1",
      "requiredCapabilities": ["lottie-light-svg-v1", "viewport-stage-v1", "static-poster-v1"],
      "placement": { "template": "viewport-stage-v1", "fit": "contain", "align": "center" },
      "direction": "none",
      "timing": { "playbackDurationMs": 10100, "loadTimeoutMs": 2000, "readyTimeoutMs": 250, "maxLifetimeMs": 12500 },
      "posterAssetId": "new-year-default-sleigh-poster-0e6f2d9b1c4a7835",
      "posterDurationMs": 4000,
      "variants": [
        { "when": { "layout": "desktop" }, "animationAssetId": "new-year-default-sleigh-desktop-9c1e4b7a2f3d6e80" },
        { "when": { "layout": "mobile" }, "animationAssetId": "new-year-default-sleigh-mobile-41d0aa93c5e7b218" }
      ]
    }
  ]
}
```

For a known event, `labels` is optional. A label ID that the bundled event already defines keeps resolving from the app's i18n keys and then the bundled English default (see `celebration-lottie-authoring-profile`). The example repeats the existing English `sleighToastMessage` only to show the shape.

External-only events (no compiled module) SHALL additionally declare these, and known events SHALL NOT declare them:

- `event`: `{ "titleLabelId": string, "clickSceneIds": string[], "iconAssetId"?: string, "decoration": { "template": "static-trigger-v1", "posterAssetId": string, "labelId": string } }`

A v1 manifest SHALL NOT declare a secret phrase, decoration behaviors, scripts, functions, CSS, fonts, DOM selectors, class names, routes or absolute URLs.

#### Scenario: A reference to an undeclared asset
- **WHEN** a scene's `posterAssetId` or variant `animationAssetId` is not in the manifest's `assets`
- **THEN** the manifest is invalid at publication, and the BFF treats the pack as unavailable

#### Scenario: A known event declares event-level fields
- **WHEN** a manifest for `new-year` (a compiled event) contains `event`
- **THEN** the manifest is invalid, so a pack can never replace a bundled event's trigger, pools or title

### Requirement: Stable identifiers

**[Contract]** `eventId`, `packId` and scene `id` SHALL match `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` and be at most 64 characters. This is the same rule `UI_EVENT` already enforces (`apps/chat-api/src/config/environment.config.ts:884-887`).

- `version` SHALL be strict semver `MAJOR.MINOR.PATCH` without pre-release or build metadata.
- `assetId` SHALL match `^[a-z0-9][a-z0-9-]{0,95}$`, SHALL end with the first 16 hex characters of its SHA-256, and SHALL be unique across the whole catalog (the catalog `assets` registry plus every listed manifest).
- Label IDs SHALL match `^[a-z][A-Za-z0-9]{0,63}$`, the same camelCase form that existing label keys such as `sleighToastMessage` and `toastTitle` use.
- Scene IDs that replace a bundled scene SHALL equal the existing `HalloweenScene` or `NewYearScene` value.
- An ID SHALL never be reused for different content.

#### Scenario: A colliding asset ID
- **WHEN** two manifests declare the same `assetId` with different `sha256`
- **THEN** the catalog is invalid, and the BFF serves the previously valid catalog revision or none

### Requirement: Immutable versioned assets with declared size and hash

**[Contract]** Every C1 resource other than the mutable `config.json` SHALL be immutable once published:

- `celebrations/<packId>/<version>/` SHALL never be overwritten.
- Each asset SHALL declare `bytes` (the exact byte length) and `sha256` (lowercase hex SHA-256 of the exact bytes).
- The catalog SHALL also declare `bytes` and `sha256` for each manifest.
- Publication SHALL upload resources, then manifests, then the catalog pointer, in that order.

The BFF (S2) SHALL verify byte count while reading, and verify the hash before caching or serving. A mismatch SHALL make that resource unavailable rather than be served. A new version SHALL be published instead of editing an existing one.

#### Scenario: Republished bytes under an existing version
- **WHEN** a manifest's bytes no longer match the catalog's declared `sha256`
- **THEN** the BFF rejects the manifest (502 for a direct request) and the app uses its per-event fallback from `celebration-source-selection`

### Requirement: Schema evolution and capability negotiation

**[Contract]** `schemaVersion` SHALL be an integer, and this change defines `1`.

- Within a schema version, changes SHALL be additive and optional only.
- A removed field, a renamed field, a changed meaning or a new required field SHALL increase `schemaVersion`.
- The BFF SHALL validate against an allowlist and strip unknown fields. It SHALL never forward unknown fields.
- A catalog or manifest with an unsupported `schemaVersion` SHALL make only the affected packs unavailable. Legacy `themes`/`images` SHALL keep resolving.

Capability negotiation SHALL work as follows:

- Each manifest and scene declares `requiredCapabilities`.
- `libs/celebrations` exports the set it implements as a string enum.
- The app adapter, not the BFF, SHALL intersect the two, because only the client knows its runtime version.
- A scene with any unsupported capability SHALL NOT partially execute.

The v1 capability IDs are `lottie-light-svg-v1`, `viewport-stage-v1`, `composer-anchor-v1`, `static-poster-v1` and `static-trigger-v1`. IDs starting with `interaction-` are reserved (see `celebration-lottie-authoring-profile`).

#### Scenario: An old client meets a newer pack
- **WHEN** a scene requires `composer-anchor-v1` and the running library supports only `viewport-stage-v1`
- **THEN** that scene is treated as unsupported (bundled scene for a known event, poster or no-op for an external-only event), and no player is started for it

#### Scenario: An unsupported schema version
- **WHEN** a manifest declares `schemaVersion: 2` and the BFF supports only `1`
- **THEN** `GET /api/v1/themes/celebrations/{packId}/{version}` returns 502, and `/api/themes` and `/api/v1/themes` theme data are unaffected

### Requirement: Payload and structure caps

**[Contract]** v1 SHALL enforce these hard caps. Authors and publication checks SHALL stay at or under them, and the BFF and runtime SHALL reject anything that exceeds them. A manifest SHALL NOT raise a cap; only a library release can.

| Item | v1 cap |
| --- | --- |
| `config.json` | 256 KiB (inspected file: 15,463 bytes) |
| `manifest.json` | 64 KiB, JSON depth ≤ 32 |
| Lottie JSON per variant | 300 KiB raw, JSON depth ≤ 64, layers ≤ 30, keyframes ≤ 2,000, path vertices (all keyframes) ≤ 8,000 |
| Poster or icon | 100 KiB, intrinsic size ≤ 2,048 × 2,048 |
| Assets per manifest | 32 |
| Scenes per manifest | 16 |
| Labels | ≤ 280 characters each, ≤ 16 locales |
| Generated SVG DOM per scene (runtime check) | ≤ 800 elements |
| `maxLifetimeMs` | ≤ 32,000 |

These caps are initial pilot limits from source inspection, not measurements. The S0 browser baseline (#9219) and S2–S4 SHALL confirm or revise them through a later delta to this capability.

#### Scenario: An oversized animation
- **WHEN** a variant's actual bytes exceed 300 KiB, whatever its declared `bytes` says
- **THEN** the BFF stops reading at the cap and the asset is unavailable

### Requirement: Normalized BFF DTOs

**[Contract]** C2 SHALL be canonical camelCase and SHALL be produced from validated C1 only. S2 (#9221) delivers the following public, unauthenticated endpoints. Each is marked `@Public()` like today's `ThemeController` (`apps/chat-api/src/themes/theme.controller.ts:27`), carries no privileged data, and accepts no body:

| Method and path | Request | 200 response | operationId / SDK method | Client call |
| --- | --- | --- | --- | --- |
| `GET /api/v1/themes` | none | `ThemeCatalogDto` | `getThemeCatalog` | normal |
| `GET /api/v1/themes/celebrations/{packId}/{version}` | path params validated by `GetCelebrationPackDto` (`@Matches` allowlists from "Stable identifiers") | `CelebrationPackDto` | `getCelebrationPack` | normal |
| `GET /api/v1/themes/assets/{assetId}` | path param validated by `GetThemeAssetDto` | the asset bytes with the registered `Content-Type` | `getThemeAsset` | `getThemeAssetRaw` (Raw), because the body is not JSON-typed |

Errors:

- `400`: invalid ID format.
- `404`: unknown or unpublished pack, version or asset.
- `429`: rate limited.
- `502`: invalid upstream status, schema, size, MIME type or hash.
- `503`: upstream timeout or unavailable.

Example `GET /api/v1/themes/celebrations/new-year-default/1.0.0` 200 response:

```json
{
  "packId": "new-year-default",
  "version": "1.0.0",
  "eventId": "new-year",
  "catalogRevision": "2026-10-01.1",
  "requiredCapabilities": ["lottie-light-svg-v1", "viewport-stage-v1", "static-poster-v1"],
  "assets": [
    { "assetId": "new-year-default-sleigh-desktop-9c1e4b7a2f3d6e80", "mediaType": "application/json", "bytes": 148213, "sha256": "9c1e4b7a2f3d6e80…" }
  ],
  "labels": { "en": { "sleighToastMessage": "Special delivery from the night sky. Send \"{{phrase}}\" in the start-page chat for a secret surprise." } },
  "scenes": [
    {
      "id": "sleigh",
      "labelId": "sleighToastMessage",
      "renderer": "lottie-light-svg-v1",
      "requiredCapabilities": ["lottie-light-svg-v1", "viewport-stage-v1", "static-poster-v1"],
      "placement": { "template": "viewport-stage-v1", "fit": "contain", "align": "center" },
      "direction": "none",
      "timing": { "playbackDurationMs": 10100, "loadTimeoutMs": 2000, "readyTimeoutMs": 250, "maxLifetimeMs": 12500 },
      "posterAssetId": "new-year-default-sleigh-poster-0e6f2d9b1c4a7835",
      "posterDurationMs": 4000,
      "variants": [{ "when": { "layout": "desktop" }, "animationAssetId": "new-year-default-sleigh-desktop-9c1e4b7a2f3d6e80" }]
    }
  ]
}
```

C2 SHALL NOT contain upstream paths or URLs. The C1 asset `file`/`path` fields SHALL NOT appear in C2.

Example error: `GET /api/v1/themes/celebrations/../1.0.0` returns `400` with `{ "statusCode": 400, "message": ["packId must be a lowercase kebab-case identifier"], "error": "Bad Request" }`.

Legacy normalization (C1 → C2) SHALL be explicit and covered by contract tests:

| C1 field | C2 field | Rule |
| --- | --- | --- |
| `images.chat-logo-light` / `chat-logo-dark` / `chat-favicon` | `images.chatLogoLight` / `chatLogoDark` / `chatFavicon` | Rename; the value (file name usable with `/api/themes/icon`) is unchanged |
| `images.default-addon` / `default-model` / `favicon` | `images.defaultAddon` / `defaultModel` / `favicon` | Rename; still unused by the app |
| `themes[].app-logo` | `themes[].appLogo` | Rename; optional (the inspected catalog omits it); still unused by the app |
| `themes[].colors` keys | unchanged | Token names are CSS custom-property names, not JSON field names, so they are not camel-cased |
| `themes[].topicColors`, `authColors`, `images.admin-*` | dropped from C2 | Not read by Chat; they stay available through legacy `/api/themes` |
| new C1 camelCase fields | same name | Pass through after validation |
| `assets[*].path`, manifest `assets[*].file` | dropped | The server resolves them; they are never exposed |

Cache (S2):

- BFF keys `themes:v1:catalog`, `themes:v1:manifest:<packId>:<version>` and `themes:v1:asset:<assetId>`.
- The catalog has a TTL of 60 s.
- Manifests and assets are immutable. They are held in a byte-bounded store separate from the shared 100-entry application cache (`apps/chat-api/src/app/cache.config.ts:4-5`), so large assets cannot evict unrelated entries.
- HTTP headers: catalog `public, max-age=60, must-revalidate` with `ETag`; manifest and asset `public, max-age=31536000, immutable`.
- Invalidation: a new catalog `revision` or TTL expiry for the catalog. Immutable resources never change in place; a new version or hash gets a new key.
- The browser HTTP cache handles revalidation. App wrappers SHALL NOT send `If-None-Match` through the generated client, which rejects a bare `304`.

#### Scenario: Kebab-case legacy logo normalized
- **WHEN** C1 `images` contains `"chat-logo-dark": "chat-logo-dark.svg"`
- **THEN** `ThemeCatalogDto.images.chatLogoDark` equals `"chat-logo-dark.svg"`, and the generated `ThemeCatalogDto` type and the wire JSON agree

#### Scenario: Traversal attempt
- **WHEN** a client requests `GET /api/v1/themes/assets/..%2Fconfig.json`
- **THEN** the BFF responds 400 and makes no upstream request

### Requirement: Library descriptors and asset-loader callbacks

**[Contract]** `libs/celebrations` SHALL accept pack data only as these transport-independent shapes. They are final names for S2, and finite sets are string enums:

```ts
export enum CelebrationCapability {
  LottieLightSvgV1 = 'lottie-light-svg-v1',
  ViewportStageV1 = 'viewport-stage-v1',
  ComposerAnchorV1 = 'composer-anchor-v1',
  StaticPosterV1 = 'static-poster-v1',
  StaticTriggerV1 = 'static-trigger-v1',
}
export interface CelebrationSceneDescriptor {
  id: string;
  labelId: string;
  renderer: string;
  requiredCapabilities: readonly string[];
  placement: CelebrationPlacementDescriptor; // ViewportStage | ComposerAnchor params
  direction: CelebrationDirectionMode; // 'none' | 'mirror' | 'variant'
  timing: { playbackDurationMs: number; loadTimeoutMs: number; readyTimeoutMs: number; maxLifetimeMs: number };
  posterAssetId: string;
  posterDurationMs: number;
  variants: readonly CelebrationSceneVariantDescriptor[];
}
export interface CelebrationPackDescriptor {
  packId: string;
  version: string;
  eventId: string;
  scenes: readonly CelebrationSceneDescriptor[];
  event?: CelebrationExternalEventDescriptor; // only for external-only events
}
export interface CelebrationAssetLoaders {
  /** Resolves parsed, BFF-validated Lottie JSON; must reject on abort. */
  loadAnimationData: (assetId: string, signal: AbortSignal) => Promise<unknown>;
  /** Returns a host-built image URL for <img>; undefined when unavailable. */
  resolveImageUrl: (assetId: string) => string | undefined;
}
```

- Labels SHALL arrive already resolved for the active locale, through the existing `labels` prop channel (`libs/celebrations/src/models/celebration.ts:110-113`).
- The library SHALL clone animation data before passing it to the player.
- The library SHALL abort the loader signal on cancellation.
- The library SHALL ignore a late resolution.
- The library SHALL NOT call `fetch`, `import()` a URL, or inject SVG markup.
- Every type reachable from a public prop SHALL be exported.

#### Scenario: Cancellation during load
- **WHEN** the scene is cancelled while `loadAnimationData` is pending
- **THEN** the library aborts the signal, a later resolution starts no player, and no state update happens after cleanup

### Requirement: Legacy theme endpoints stay compatible

**[Invariant]** `GET /api/themes` SHALL keep returning the upstream `config.json` unchanged, with its current `Cache-Control: public, max-age=300`. `GET /api/themes/icon?iconName=` SHALL keep its name allowlist and its SVG `Content-Security-Policy` (`apps/chat-api/src/themes/theme.controller.ts:42-70,85-146`) while v1 endpoints are added beside them. Today's behavior is verified by `apps/chat-api/src/themes/tests/theme.controller.spec.ts` and `theme.service.spec.ts`.

#### Scenario: v1 delivery added
- **WHEN** S2 adds the `/api/v1/themes*` endpoints
- **THEN** the legacy endpoint responses, headers and validation are byte-for-byte unchanged for the same upstream catalog
