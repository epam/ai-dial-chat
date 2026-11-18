# Proposal

## Why

S2 (#9221) delivers pack scenes, but only on `viewport-stage-v1`: a stage fitted into the viewport, with no relation to host UI. GiftWrapping is a scene whose story *is* its contact with the composer, so it is the S0 pilot for `composer-anchor-v1` (S0 design, follow-up table: "S3 #9222 — `composer-anchor-v1`, the GiftWrapping evidence"). Today the whole scene is a 799-line TypeScript generator, `libs/celebrations/src/new-year/utils/gift-wrapping-composition.ts`, which rebuilds the Lottie JSON from the measured composer on every activation. Its artwork and motion can change only with a Chat release.

`composer-anchor-v1` exists only on paper. `SUPPORTED_CELEBRATION_CAPABILITIES` (`libs/celebrations/src/constants/celebration-capabilities.ts:4`) leaves it out, `isCelebrationSceneSupported` (`libs/celebrations/src/utils/celebration-pack-scene.ts:25`) accepts only `viewport-stage-v1`, the BFF passes the template through as an ID alone (`apps/chat-api/src/celebrations/celebration-manifest.normalizer.ts:187`), and the app drops any other placement (`toPlacement` in `apps/chat/src/utils/celebration-pack.ts:120`). Checked against GiftWrapping, the S0 contract falls short in three places:

1. A uniform scale keeps characters, the loose ribbon and the bow in contact, but cannot make a ribbon trace composers of different aspect ratios. The composer height varies from 36 to 260 px, and its width depends on the layout.
2. The `viewport-stage-v1` fallback has no meaning for a stage authored around a composer: no `fit`, no `align`, no parcel.
3. "Missing, hidden or zero-sized" is weaker than today's eligibility rules (`gift-wrapping-targets.ts`): minimum size, top clearance, viewport margins, clipping ancestors, `inert`/`aria-hidden` ancestors.

## Problem

- GiftWrapping artwork and choreography cannot change without rebuilding Chat.
- No placement ties a pack stage to host geometry, so no composer scene can migrate (S7 #9226 is blocked on it as well).
- Moving the generator into the themes repository would only relocate the code, which the issue rules out explicitly.

## What Changes

- **Validate and amend `composer-anchor-v1`.** It is implemented as a generic placement in `LottieScene`:
  - Measure the composer once during preparation, with today's eligibility rules extracted into a shared composer-target module.
  - Apply a bounded uniform scale `clamp(width / anchorRect.width, min, max)` and align the declared edge.
  - Mirror around the anchor's center line.
  - Install the same composer observers and interrupt listeners GiftWrapping uses today. A layout, direction or variant change cancels the scene, and nothing reads layout per frame.
  - The `fallback` enum becomes `stage-anchor | poster` instead of `viewport-stage-v1 | poster`. `stage-anchor` is a synthetic anchor rectangle at today's parcel position. Changing the enum is safe because no client has ever implemented the capability.
- **Add the first released adapter capability, `interaction-composer-outline-v1`.** It is a small compiled adapter inside `libs/celebrations`. It only *fits* geometry and authors no motion:
  - It rewrites the single path in the reserved layer `composer-outline` into a contour around the measured composer.
  - It keeps the reserved layer `composer-parcel` only for a synthetic anchor, sized to it.
  - Slots are adapter-defined Lottie layer names, never selectors in the manifest. The adapter works on a private clone of the data, so the loader's cached object is never mutated.
- **Publish the GiftWrapping pack (themes repository, cross-repository).** `new-year-default@1.1.0` contains:
  - the unchanged `bullfinch-couriers` assets
  - the scene `gift-wrapping`: desktop and mobile Lottie variants in local scene coordinates, `direction: mirror`, a static poster (the existing bound-master still) and timing `16000 / 2000 / 250 / 18500`
  - a publication check extended to the composer-anchor fields, the reserved slots and the GiftWrapping structure budgets

  The JSON is bootstrapped once from the current generator at reference geometry. After that it is committed as the authored source. No generator is committed to, or run in, the themes repository.
- **Extend the BFF and the client.** `CelebrationPlacementDto` gains the validated `composer-anchor-v1` fields: `anchor`, `anchorRect`, `edge`, `scale`, `fallback`. Then regenerate the OpenAPI client and map the fields in the app's `toPlacement`.
- **Keep the compiled GiftWrapping as default and fallback.** It stays bundled. The external version plays only when `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES` contains `new-year/gift-wrapping`. Replacement by stable ID keeps it in the secret pool, and its notification stays `newYear.giftWrappingToastMessage`.
- **Record what stays in code.** List exactly which choreography remains compiled (outline contour, parcel, target eligibility, observers) and measure the net removal: adapter lines against the generator's lines.

There are no **BREAKING** changes. The default `bundled` policy reproduces today's behavior, and old clients skip the scene because they lack its capabilities.

## Non-goals

- Deleting the compiled GiftWrapping or `gift-wrapping-elves.json`. That happens in S7/S8, after rollout.
- Other composer scenes (ReindeerTakeoff, SnowmanDelivery), or interaction adapters that move or borrow host UI (S4 #9223, the Halloween Cat).
- New anchors other than `composer`, color-scheme variants, and theme bindings to packs (S5).
- New labels, telemetry, or rate limits (S8).

## Alternatives considered

| Option | Contact at mobile/desktop/RTL | Code left in Chat | Contract risk | Pick |
| --- | --- | --- | --- | --- |
| A. Keep the compiled scene (baseline) | Exact | All 799 + 102 + 99 lines | None | no: the issue's goal is not met |
| B. Pure `composer-anchor-v1`, uniform scale only | Breaks: the ribbon misses the composer border whenever its aspect ratio differs from the reference | Placement only | Low | no |
| C. Move the generator to themes and publish its output per geometry | Exact | None in Chat, all of it in themes | Explicitly not counted as elimination; geometry is only known at runtime | no |
| D. Authored Lottie in local coordinates, bounded uniform anchor mapping, plus a slot-fitting adapter | Exact for the outline, the parcel and the contact points. Departure distance is fixed per variant (see design) | Outline contour, parcel, eligibility, observers | Medium: amends one unimplemented capability and releases one adapter | **yes** |

D keeps all motion in the asset and only the geometry rules in code. It is also the reusable shape for later composer scenes.

## Acceptance criteria

- With `prefer-external` and `new-year/gift-wrapping` allowlisted, publishing a new `new-year-default` version changes GiftWrapping's artwork or motion without a Chat rebuild.
- Character contact holds at 360/390 mobile, 1280/1920 desktop and RTL. Feet stay on the composer's top edge, the ribbon traces the measured composer, and the loose ribbon stays in the helper's hand. Normal-speed recordings and contact frames prove it, and the stage is never stretched non-uniformly.
- A missing or unsafe composer selects the stage-anchor parcel. Reduced motion selects the poster without the player or data. A missing `ResizeObserver`/`MutationObserver`, a failed load or a timeout selects the poster before playback and nothing after it.
- A late load or a reused cached animation cannot revive a cancelled scene. A cached object stays deep-equal after any number of activations.
- `libs/celebrations` receives only the composer anchor class, resolved loaders and descriptors. It never receives URLs, routes or config.
- The design records which choreography stays in code, and the net line count removed by the external path.

## Capabilities

### New Capabilities

- `celebration-composer-anchoring`: runtime behavior of `composer-anchor-v1` and the `interaction-composer-outline-v1` adapter (measurement, mapping, fallback, invalidation, slot fitting, cache isolation).

### Modified Capabilities

- `celebration-lottie-authoring-profile`: amended `composer-anchor-v1` parameters and eligibility; adapter slots by reserved layer name; `interaction-composer-outline-v1` released.
- `celebration-pack-contracts`: the C2/C3 `composer-anchor-v1` placement shape.
- `celebrations-delivery-api`: manifest validation of `composer-anchor-v1` placements instead of an ID-only pass-through.
- `celebrations-library`: supported capabilities and `LottieScene` placement.
- `new-year-gift-wrapping`: the scene may be delivered from a pack. The compiled scene remains the default and the fallback.

## Impact

- **`libs/celebrations` (shared library, scope flag).** Changes `LottieScene`, `celebration-pack-scene.ts`, the pack types/models, the capability set, a new `utils/composer-target.ts` extracted from `gift-wrapping-targets.ts`, the adapter module, the README and tests. Host knowledge stays outside the library: the host keeps supplying `anchors.composer` through `CelebrationHost` (`apps/chat/src/context/CelebrationHost.tsx`), and bytes arrive through `CelebrationAssetLoaders`.
- **`apps/chat-api/src/celebrations`.** Normalizer, DTOs, tests, `npm run openapi`.
- **`libs/chat-api-client`.** Regenerated.
- **`apps/chat`.** `toPlacement` and its tests. There is no new context, provider or state owner: the `useCelebrationPacks` model applies unchanged.
- **`epam/ai-dial-chat-themes`.** The `new-year-default/1.1.0` pack, the index revision and `scripts/check-celebration-packs.mjs`.
- **i18n.** No new user-visible strings. GiftWrapping keeps `newYear.giftWrappingToastMessage`.
- **Rollback.** Remove `new-year/gift-wrapping` from `UI_EVENT_EXTERNAL_SCENES`, or return to `bundled`. The pack key changes, the host resets and active playback is cleaned up, and the compiled scene plays on the next activation. `bullfinch-couriers` stays enabled on its own. As a secondary path, pointing the index back to `1.0.0` removes the scene from the pack.
