# Spec Delta

## ADDED Requirements

### Requirement: Composer-anchor placement crosses all three contracts

**[Contract]** A `composer-anchor-v1` placement SHALL carry the same fields through C1, C2 and C3: `template`, `anchor` (`composer`), `anchorRect { x, y, width, height }`, `edge` (`top`/`bottom`), `scale { min, max }`, `fallback` (`stage-anchor`/`poster`), all numbers finite. The BFF and the publication check SHALL enforce the bounds of `celebration-lottie-authoring-profile`. The app adapter SHALL drop a scene whose placement lacks a field.

#### Scenario: C1 placement of the GiftWrapping scene
- **WHEN** the manifest declares `"placement": { "template": "composer-anchor-v1", "anchor": "composer", "anchorRect": { "x": 340, "y": 164, "width": 520, "height": 56 }, "edge": "top", "scale": { "min": 0.6, "max": 1 }, "fallback": "stage-anchor" }`
- **THEN** `CelebrationPackDto.scenes[].placement` carries the same seven values in camelCase, and the app hands `libs/celebrations` a `CelebrationComposerAnchorPlacement` with the same values

#### Scenario: Out-of-bounds scale
- **WHEN** a manifest declares `scale: { "min": 0.1, "max": 1 }`
- **THEN** publication rejects it, and the BFF responds `502` for the pack

### Requirement: A variant may override the scene placement

**[Contract]** A variant MAY declare `placement` with the same `template` as its scene. It then replaces the scene's placement for that variant in C1, C2 (`CelebrationVariantDto.placement`) and C3 (`CelebrationSceneVariantDescriptor.placement`). A different template SHALL make the manifest invalid in the BFF and in the publication check, and SHALL make the scene unsupported in the app adapter and in the library. Each variant's `anchorRect` SHALL lie inside its own composition.

#### Scenario: Mobile variant with its own reference composer
- **WHEN** the `gift-wrapping` scene declares desktop placement `anchorRect 520 × 56` and its mobile variant declares `anchorRect 300 × 56` with `scale { min: 0.77, max: 1 }`
- **THEN** a mobile-layout host maps the mobile stage by `clamp(composerWidth / 300, 0.77, 1)`, so a 736 px tablet composer keeps the authored character size

#### Scenario: A variant changes the template
- **WHEN** a variant of a `composer-anchor-v1` scene declares `viewport-stage-v1` placement
- **THEN** the BFF responds `502` for the pack, and the publication check fails

### Requirement: C3 placement descriptor is a discriminated union

**[Contract]** `CelebrationPlacementDescriptor` SHALL be `CelebrationViewportStagePlacement | CelebrationComposerAnchorPlacement`, discriminated by `template`. The new string enums are `CelebrationAnchor` (`composer`), `CelebrationAnchorEdge` (`top`, `bottom`) and `CelebrationAnchorFallback` (`stage-anchor`, `poster`), and `CelebrationCapability` gains `InteractionComposerOutlineV1 = 'interaction-composer-outline-v1'`. Every new type SHALL be exported from `@epam/ai-dial-celebrations`.

#### Scenario: A host narrows the placement
- **WHEN** a host switches on `placement.template === CelebrationPlacementTemplate.ComposerAnchorV1`
- **THEN** TypeScript exposes `anchorRect`, `edge`, `scale` and `fallback`, and no `fit` or `align`
