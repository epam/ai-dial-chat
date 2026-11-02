## ADDED Requirements

### Requirement: Published celebration index

**[Contract]** Celebration packs SHALL be listed in their own mutable pointer, `celebrations/index.json`, on the same themes host as `config.json` (`THEMES_CONFIG_URL`). `config.json` SHALL NOT list packs. The index carries only celebration data, so publishing, caching or breaking it never affects theme readers (Chat, Admin, Model Garden).

```json
{
  "schemaVersion": 1,
  "revision": "2026-11-15.1",
  "packs": [
    {
      "packId": "new-year-default",
      "version": "1.0.0",
      "eventId": "new-year",
      "manifest": { "path": "new-year-default/1.0.0/manifest.json", "bytes": 2410, "sha256": "b7e2…(64 hex)" }
    },
    {
      "packId": "company-anniversary",
      "version": "1.0.0",
      "eventId": "company-anniversary",
      "manifest": { "path": "company-anniversary/1.0.0/manifest.json", "bytes": 2980, "sha256": "a1c3…(64 hex)" }
    }
  ],
  "defaults": {
    "new-year": { "packId": "new-year-default", "version": "1.0.0" },
    "company-anniversary": { "packId": "company-anniversary", "version": "1.0.0" }
  }
}
```

- `schemaVersion` is an integer; this change defines `1`. `revision` is 1 to 64 characters of `[A-Za-z0-9._-]`.
- `packs[].manifest.path` is relative to the index directory and SHALL stay under it.
- `defaults` maps an `eventId` to a listed `{ packId, version }` whose `eventId` equals the key.
- The index is at most 64 KiB. Each `packId@version` appears once.
- In the celebration requirements, "catalog" means this index. Its `revision` is the catalog revision that `CelebrationPackDto.catalogRevision` and the cancellation identity use.
- The themes host serves the index with `Cache-Control: public, max-age=60, must-revalidate` and everything else under `celebrations/` with `public, max-age=31536000, immutable`. Existing caching rules for `config.json` and the other theme files stay unchanged.

#### Scenario: No index published
- **WHEN** a themes host has no `celebrations/index.json`
- **THEN** theme behavior is unchanged, and every known event stays bundled

#### Scenario: Index and themes evolve independently
- **WHEN** a new pack version is published and only `celebrations/index.json` changes
- **THEN** `config.json` and `GET /api/themes` are byte-for-byte unchanged

### Requirement: Published version retention

**[Contract]** The themes repository SHALL keep, for every pack, the version the celebration index currently lists plus the one version it listed before. That previous version is the rollback target.

- An older version MAY be deleted only in a separate change, once no index revision published within the last 30 days references it.
- Deleting a version SHALL delete its whole `celebrations/<packId>/<version>/` directory. A published directory SHALL never be edited or partially removed.
- A deleted `<packId>@<version>` and its asset IDs SHALL never be reused for different content.
- The publication check SHALL fail when the repository holds more than three versions of one pack. A third version is allowed only during the cleanup window.

#### Scenario: A pack reaches its third version
- **WHEN** `new-year-default@1.2.0` is published while `1.0.0` and `1.1.0` are still present
- **THEN** the publication check passes, and `1.0.0` may be deleted in a later change once no index revision from the last 30 days lists it

#### Scenario: Unbounded growth is blocked
- **WHEN** a fourth version of the same pack is added without removing any
- **THEN** the publication check fails

## MODIFIED Requirements

### Requirement: Published catalog extension is additive to the existing config.json

**[Contract]** C1 SHALL extend the existing `config.json` (top-level `themes` and `images`, inspected at `epam/ai-dial-chat-themes@22cdaddbcb00c3b69c2dc021cb3bc594ace79f8d`) only with new optional fields. Existing fields, their kebab-case spellings and their meaning SHALL stay unchanged. Legacy readers, including today's `/api/themes` passthrough (`apps/chat-api/src/themes/theme.service.ts`), SHALL keep working when they ignore the new fields. A `config.json` without any new field SHALL remain a valid v1 catalog. New top-level fields:

- `schemaVersion`: integer. Absent means a legacy catalog.
- `revision`: string, 1 to 64 characters of `[A-Za-z0-9._-]`.
- `defaultThemeId`: must name a configured theme. `systemThemeIds: { light, dark }`: both must name configured themes. An invalid reference is dropped by the BFF and the rest of the catalog is still served. Neither field is read by the code yet.
- `assets`: a registry of branding assets keyed by asset ID.
Packs and per-event defaults are not `config.json` fields. They live in `celebrations/index.json` (see "Published celebration index"). S2 adds nothing to `config.json`; the fields above are the S5 (#9224) theme contract.

Per-theme additions are `colorScheme`, `branding` and `celebrationPacks`. A theme's `celebrationPacks[eventId]` names a `{ packId, version }` that SHALL be listed in `celebrations/index.json`. The two files are published independently, so a binding to a pack the index does not list is dropped, and selection falls through to the index default. Example of the additions only; existing fields are abbreviated:

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
  }
}
```

Hashes shortened to `…(64 hex)` in these examples are full lowercase SHA-256 values in practice. Machine-checkable copies with full, internally consistent hashes are in `openspec/changes/archive/2026-10-01-define-celebration-pack-contracts-and-baseline/examples/fixtures/` and are checked by `examples/check-contract-examples.mjs` in the same directory. The `acme-night` binding to `acme-new-year@1.0.0` deliberately points to a pack the celebration index does not list, to show a reference that is dropped.

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
    { "assetId": "new-year-default-snowman-delivery-desktop-5b0c7e19a2d4f836", "file": "snowman-delivery.desktop.5b0c7e19a2d4f836.json", "mediaType": "application/json", "bytes": 182344, "sha256": "5b0c7e19a2d4f836…(64 hex)" },
    { "assetId": "new-year-default-snowman-delivery-mobile-c3a91f0e64b27d58", "file": "snowman-delivery.mobile.c3a91f0e64b27d58.json", "mediaType": "application/json", "bytes": 121907, "sha256": "c3a91f0e64b27d58…(64 hex)" },
    { "assetId": "new-year-default-snowman-delivery-poster-8e2d4a6c0f1b3957", "file": "snowman-delivery.poster.8e2d4a6c0f1b3957.svg", "mediaType": "image/svg+xml", "bytes": 5210, "sha256": "8e2d4a6c0f1b3957…(64 hex)" }
  ],
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

For a known event, `labels` is optional. A label ID that the bundled event already defines keeps resolving from the app's i18n keys and then the bundled English default (see `celebration-lottie-authoring-profile`). The example replaces the bundled `snowman-delivery` and keeps its bundled `snowmanDeliveryToastMessage`, so it declares no `labels`. A known-event manifest MAY declare a scene whose ID the bundled event lacks, but the app ignores it (see `celebration-source-selection`). The former `sleigh` example was superseded because #9631 removed the bundled sleigh.

External-only events (no compiled module) SHALL additionally declare these, and known events SHALL NOT declare them:

- `event`: `{ "titleLabelId": string, "clickSceneIds": string[], "iconAssetId"?: string, "decoration": { "template": "static-trigger-v1", "posterAssetId": string, "labelId": string } }`

A v1 manifest SHALL NOT declare a secret phrase, decoration behaviors, scripts, functions, CSS, fonts, DOM selectors, class names, routes or absolute URLs.

#### Scenario: A reference to an undeclared asset
- **WHEN** a scene's `posterAssetId` or variant `animationAssetId` is not in the manifest's `assets`
- **THEN** the manifest is invalid at publication, and the BFF treats the pack as unavailable

#### Scenario: A known event declares event-level fields
- **WHEN** a manifest for `new-year` (a compiled event) contains `event`
- **THEN** the manifest is invalid, so a pack can never replace a bundled event's trigger, pools or title

### Requirement: Immutable versioned assets with declared size and hash

**[Contract]** Every C1 resource other than the mutable `config.json` SHALL be immutable once published:

- `celebrations/<packId>/<version>/` SHALL never be overwritten.
- Each asset SHALL declare `bytes` (the exact byte length) and `sha256` (lowercase hex SHA-256 of the exact bytes).
- The celebration index SHALL also declare `bytes` and `sha256` for each manifest.
- Publication SHALL upload resources, then manifests, then `celebrations/index.json`, in that order.

The BFF (S2) SHALL verify byte count while reading, and verify the hash before caching or serving. A mismatch SHALL make that resource unavailable rather than be served. A new version SHALL be published instead of editing an existing one.

#### Scenario: Republished bytes under an existing version
- **WHEN** a manifest's bytes no longer match the index's declared `sha256`
- **THEN** the BFF rejects the manifest (502 for a direct request) and the app uses its per-event fallback from `celebration-source-selection`

### Requirement: Normalized BFF DTOs

**[Contract]** C2 SHALL be canonical camelCase and SHALL be produced from validated C1 only. S2 (#9221) delivers the following public, unauthenticated endpoints in the `apps/chat-api/src/celebrations` domain, separate from themes. Each is marked `@Public()` like today's `ThemeController` (`apps/chat-api/src/themes/theme.controller.ts`), carries no privileged data, and accepts no body. The full behavior is in `celebrations-delivery-api`.

| Method and path | Request | 200 response | operationId / SDK method | Client call |
| --- | --- | --- | --- | --- |
| `GET /api/v1/celebrations` | none | `CelebrationCatalogDto` | `getCelebrationCatalog` | normal |
| `GET /api/v1/celebrations/packs/{packId}/{version}` | path params validated by `GetCelebrationPackDto` (`@Matches` allowlists from "Stable identifiers") | `CelebrationPackDto` | `getCelebrationPack` | normal |
| `GET /api/v1/celebrations/assets/{assetId}` | path param validated by `GetCelebrationAssetDto` | the asset bytes with the registered `Content-Type` | `getCelebrationAsset` | `getCelebrationAssetRaw` (Raw), because the body is not JSON-typed |

Errors:

- `400`: invalid ID format.
- `404`: unknown or unpublished pack, version or asset.
- `502`: invalid upstream status, schema, size, MIME type or hash.
- `503`: upstream timeout or unavailable.

The BFF declares no `429`, because `apps/chat-api` has no request rate limiter. Abuse is bounded by ID allowlists, registry membership checked before any upstream request, single-flight misses and immutable caching. Request rate limits belong to the ingress in front of the BFF.

Example `GET /api/v1/celebrations/packs/new-year-default/1.0.0` 200 response:

```json
{
  "packId": "new-year-default",
  "version": "1.0.0",
  "eventId": "new-year",
  "catalogRevision": "2026-11-15.1",
  "requiredCapabilities": ["lottie-light-svg-v1", "viewport-stage-v1", "static-poster-v1"],
  "assets": [
    { "assetId": "new-year-default-snowman-delivery-desktop-5b0c7e19a2d4f836", "mediaType": "application/json", "bytes": 182344, "sha256": "5b0c7e19a2d4f836…" }
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
      "variants": [{ "when": { "layout": "desktop" }, "animationAssetId": "new-year-default-snowman-delivery-desktop-5b0c7e19a2d4f836" }]
    }
  ]
}
```

C2 SHALL NOT contain upstream paths or URLs. The C1 asset `file`/`path` fields SHALL NOT appear in C2.

Example error: `GET /api/v1/celebrations/packs/../1.0.0` returns `400` with `{ "statusCode": 400, "message": ["packId must be a lowercase kebab-case identifier"], "error": "Bad Request" }`.

The theme catalog endpoint `GET /api/v1/themes` (`ThemeCatalogDto`, `getThemeCatalog`) is deferred to S5 (#9224), which migrates `ThemeContext`. Its legacy normalization (C1 → C2) stays part of this contract for S5, SHALL be explicit, and SHALL be covered by contract tests:

| C1 field | C2 field | Rule |
| --- | --- | --- |
| `images.chat-logo-light` / `chat-logo-dark` / `chat-favicon` | `images.chatLogoLight` / `chatLogoDark` / `chatFavicon` | Rename; the value (file name usable with `/api/themes/icon`) is unchanged |
| `images.default-addon` / `default-model` / `favicon` | `images.defaultAddon` / `defaultModel` / `favicon` | Rename; still unused by the app |
| `themes[].app-logo` | `themes[].appLogo` | Rename; optional (the inspected catalog omits it); still unused by the app |
| `themes[].colors` keys | unchanged | Token names are CSS custom-property names, not JSON field names, so they are not camel-cased |
| `themes[].topicColors`, `authColors`, `images.admin-*` | dropped from C2 | Not read by Chat; they stay available through legacy `/api/themes` |
| `images.model-garden-logo-light` / `model-garden-logo-dark` / `model-garden-favicon` | dropped from C2 | Model Garden keys served from the same themes host; not read by Chat; they stay available through legacy `/api/themes` |
| any other `images` key | dropped from C2 | `images` is an allowlist. A key Chat starts reading needs a row in this table and a regenerated DTO first |
| new C1 camelCase fields | same name | Pass through after validation |
| `assets[*].path`, manifest `assets[*].file` | dropped | The server resolves them; they are never exposed |

Cache (S2):

- BFF keys `celebrations:v1:index`, `celebrations:v1:manifest:<packId>:<version>` and `celebrations:v1:asset:<assetId>`.
- The index has a TTL of 60 s.
- Manifests and assets are immutable. They are held in a byte-bounded store separate from the shared 100-entry application cache (`apps/chat-api/src/app/cache.config.ts`), so large assets cannot evict unrelated entries.
- HTTP headers: index `public, max-age=60, must-revalidate` with `ETag`; manifest and asset `public, max-age=31536000, immutable`.
- Invalidation: a new index `revision` or TTL expiry for the index. Immutable resources never change in place; a new version or hash gets a new key.
- The browser HTTP cache handles revalidation. App wrappers SHALL NOT send `If-None-Match` through the generated client, which rejects a bare `304`.

#### Scenario: Kebab-case legacy logo normalized (S5)
- **WHEN** C1 `images` contains `"chat-logo-dark": "chat-logo-dark.svg"`
- **THEN** `ThemeCatalogDto.images.chatLogoDark` equals `"chat-logo-dark.svg"`, and the generated `ThemeCatalogDto` type and the wire JSON agree

#### Scenario: Traversal attempt
- **WHEN** a client requests `GET /api/v1/celebrations/assets/..%2Findex.json`
- **THEN** the BFF responds 400 and makes no upstream request

#### Scenario: Another application's images (S5)
- **WHEN** C1 `images` contains `model-garden-logo-dark`
- **THEN** `ThemeCatalogDto.images` has no Model Garden field, and legacy `GET /api/themes` still returns the key unchanged

### Requirement: Legacy theme endpoints stay compatible

**[Invariant]** `GET /api/themes` SHALL keep returning the upstream `config.json` unchanged, with its current `Cache-Control: public, max-age=300`. `GET /api/themes/icon?iconName=` SHALL keep its name allowlist and its SVG `Content-Security-Policy` (`getThemes` and `getThemeIcon` in `apps/chat-api/src/themes/theme.controller.ts`) while the celebrations endpoints are added in their own domain. S2 changes no file under `apps/chat-api/src/themes/` and adds no field to `config.json`. Today's behavior is verified by `apps/chat-api/src/themes/tests/theme.controller.spec.ts` and `theme.service.spec.ts`.

#### Scenario: Celebrations delivery added
- **WHEN** S2 adds the `/api/v1/celebrations*` endpoints
- **THEN** the legacy endpoint responses, headers and validation are byte-for-byte unchanged for the same upstream catalog
