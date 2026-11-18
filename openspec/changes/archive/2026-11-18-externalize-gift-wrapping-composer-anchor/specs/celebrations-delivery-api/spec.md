# Spec Delta

## MODIFIED Requirements

### Requirement: Manifest validation

`CelebrationPackDto` SHALL be produced from a manifest that passes all of these checks. Otherwise the endpoint responds `502`.

- `schemaVersion` is `1`.
- `packId`, `version` and `eventId` equal the index entry.
- Every ID matches the "Stable identifiers" rules of `celebration-pack-contracts`.
- Every `posterAssetId`, `animationAssetId` and `iconAssetId` is declared in `assets`.
- The timings are finite integers within the bounds of `celebration-lottie-authoring-profile` "Timing and deadlines".
- The counts stay under the caps: 32 assets, 16 scenes, 1–8 variants, 16 locales, 280 characters per label.
- `labels` includes `en` whenever it is non-empty.
- A `viewport-stage-v1` placement has a valid `fit` and `align`.
- A `composer-anchor-v1` placement has the following fields:
  - `anchor: composer`
  - an `anchorRect` of finite numbers with `width ≥ 120` and `height ≥ 24`
  - `edge` set to `top` or `bottom`
  - `scale` with `0.25 ≤ min ≤ max ≤ 4`
  - `fallback` set to `stage-anchor` or `poster`

  These values are forwarded in `CelebrationPlacementDto`. Before S3 (#9222) the BFF passed such a placement as `{ template }` alone.
- A variant `placement`, when present, is validated by the same rules and has the scene's `template`. It is forwarded in `CelebrationVariantDto.placement`.
- Any other placement template is still passed as `{ template }` alone, so a client without that capability skips the scene.
- The manifest declares no field outside the v1 allowlist. Unknown fields are stripped, never forwarded.

The BFF does not know the client's compiled registry. Whether an `event` block is allowed for an event is therefore enforced by the publication check and by the client.

`catalogRevision` SHALL be the index `revision` the pack was resolved from.

`CelebrationVariantDto` gains the optional `placement` (`CelebrationPlacementDto`). `CelebrationPlacementDto` gains the optional properties `anchor` (enum `CelebrationAnchor`), `anchorRect` (`CelebrationAnchorRectDto`), `edge` (enum `CelebrationAnchorEdge`), `scale` (`CelebrationAnchorScaleDto`) and `fallback` (enum `CelebrationAnchorFallback`). Each has Swagger metadata. `GET /api/v1/celebrations/packs/{packId}/{version}` keeps its operationId `getCelebrationPack` and its normal (non-`Raw`) generated method. The generated client is regenerated with `npm run openapi`, and `npm run openapi:check` passes. Example 200 response fragment:

```json
{
  "id": "gift-wrapping",
  "labelId": "giftWrappingToastMessage",
  "renderer": "lottie-light-svg-v1",
  "requiredCapabilities": ["lottie-light-svg-v1", "composer-anchor-v1", "interaction-composer-outline-v1", "static-poster-v1"],
  "placement": {
    "template": "composer-anchor-v1",
    "anchor": "composer",
    "anchorRect": { "x": 340, "y": 164, "width": 520, "height": 56 },
    "edge": "top",
    "scale": { "min": 0.6, "max": 1 },
    "fallback": "stage-anchor"
  },
  "direction": "mirror",
  "timing": { "playbackDurationMs": 16000, "loadTimeoutMs": 2000, "readyTimeoutMs": 250, "maxLifetimeMs": 18500 }
}
```

Caching is unchanged: the manifest stays under `celebrations:v1:manifest:<packId>:<version>`, immutable, with no TTL, and a new version gets a new key.

#### Scenario: Reference to an undeclared asset
- **WHEN** a scene's `posterAssetId` is not in the manifest's `assets`
- **THEN** the endpoint responds `502`

#### Scenario: Unsupported schema version
- **WHEN** a manifest declares `schemaVersion: 2`
- **THEN** `GET /api/v1/celebrations/packs/{packId}/{version}` responds `502`, and the index and `/api/themes` are unaffected

#### Scenario: Composer-anchor placement forwarded
- **WHEN** a manifest scene declares a valid `composer-anchor-v1` placement
- **THEN** the `200` response carries `anchor`, `anchorRect`, `edge`, `scale` and `fallback` with the same values, and no other placement field

#### Scenario: Invalid composer-anchor placement
- **WHEN** a manifest scene declares `composer-anchor-v1` with `edge: "left"`, a non-finite `anchorRect` value or `scale.min > scale.max`
- **THEN** the endpoint responds `502`, and one `warn` entry names the manifest kind, its `packId@version` and the reason, with no body

#### Scenario: Variant placement with another template
- **WHEN** a variant of a `composer-anchor-v1` scene declares `"placement": { "template": "viewport-stage-v1", "fit": "contain", "align": "bottom" }`
- **THEN** the endpoint responds `502`
