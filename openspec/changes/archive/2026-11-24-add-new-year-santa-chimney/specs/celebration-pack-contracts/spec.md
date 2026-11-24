## MODIFIED Requirements

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

For a known event, `labels` is optional. A label ID that the bundled event already defines keeps resolving from the app's i18n keys and then the bundled English default (see `celebration-lottie-authoring-profile`). The example replaces the bundled `snowman-delivery` and keeps its bundled `snowmanDeliveryToastMessage`, so it declares no `labels`. A known-event manifest MAY declare a scene whose ID the bundled event lacks. The app adds it only when the operator allowlists that `eventId/sceneId`, and ignores it otherwise. The compiled event's `secretTrigger.externalSceneIds` routes declared IDs to the existing secret pool; other additions join the click pool (see `celebration-source-selection`). Such a scene needs its own `labelId` with an `en` label in the manifest's `labels`. The former `sleigh` example was superseded because #9631 removed the bundled sleigh.

External-only events (no compiled module) SHALL additionally declare these, and known events SHALL NOT declare them:

- `event`: `{ "titleLabelId": string, "clickSceneIds": string[], "iconAssetId"?: string, "decoration": { "template": "static-trigger-v1", "posterAssetId": string, "labelId": string } }`

A v1 manifest SHALL NOT declare a secret phrase, decoration behaviors, scripts, functions, CSS, fonts, DOM selectors, class names, routes or absolute URLs.

#### Scenario: A reference to an undeclared asset
- **WHEN** a scene's `posterAssetId` or variant `animationAssetId` is not in the manifest's `assets`
- **THEN** the manifest is invalid at publication, and the BFF treats the pack as unavailable

#### Scenario: A known event declares event-level fields
- **WHEN** a manifest for `new-year` (a compiled event) contains `event`
- **THEN** the manifest is invalid, so a pack can never replace a bundled event's trigger, pools or title
