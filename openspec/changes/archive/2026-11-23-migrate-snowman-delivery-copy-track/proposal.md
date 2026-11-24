# Proposal: migrate SnowmanDelivery to the pack contract with a generic copy-track adapter

## Why

S7 batch 0 (#9226, `celebration-migration-portfolio`) gave `snowman-delivery` the only `migrate` decision. It is batch 1, on `composer-anchor-v1` placement and a card-borrowing adapter. The same register keeps ReindeerTakeoff and most Halloween rows at `adapter-pending`. ReindeerTakeoff reopens only if batch 1's adapter also covers a copied word on the composition's clock.

So batch 1 does two jobs:

- Delivers the first non-pilot scene through the pack path.
- Releases the adapter that unlocks later batches.

The issue owner chose a generic adapter (`interaction-copy-track-v1`) over a SnowmanDelivery-only one, and the full S4 path through publication.

## Problem

The compiled scene builds a new 25 s Lottie composition on every activation (`buildSnowmanDeliveryComposition` in `libs/celebrations/src/new-year/utils/snowman-delivery-composition.ts`). It does so from measured geometry:

- It picks one of five stages: `ledge`, `rim`, `rim-sled`, `platform` or `static` (`getSnowmanDeliveryTargets` in `snowman-delivery-targets.ts`).
- It searches the slide length: 460→160 px on desktop, 220→100 px on mobile.
- It places the snowbank, tree and branch from that length, so that the head flight stays near 0.5 s.
- It subdivides walks into a step count that follows distance.
- It solves arm IK for the grips.
- It derives the card copy's WAAPI track from the sled track.

The released adapters cannot express this:

- **`interaction-cat-borrow-v1`** binds only translated stations on one null. Its copy tracks are x-only and end in physics. Its targets are one or two composer or starter buttons, chosen with the Cat's heuristics (`libs/celebrations/src/utils/borrow-targets.ts`, `lottie-track-keyframes.ts`).
- **No released adapter** can stretch a span, repeat a step cycle, splice a variant window, or copy a text run.

The portfolio rule ("A scene migrates only when it fits the contract at lower cost") forbids moving the generator into the themes repository or into an adapter.

## What Changes

**Library (`libs/celebrations`)**

New capability `interaction-copy-track-v1`. It is a third `PackSceneAdapter`, next to `interaction-cat-borrow-v1` (`libs/celebrations/src/utils/pack-scene-adapter.ts`). It reuses S4's generic modules: markers, anchor binding, time remap, copy tracks and snapshot prepare/start. It extends them only where a second consumer needs it.

Everything the adapter does is fixed by the capability ID, and the asset only names it through layer names and `ct:` markers. The adapter:

- **Stages.** Measures host geometry once against stage templates the adapter defines: `ledge`, `rim` and `platform`.
- **Copies.** Resolves copy roles the adapter defines:
  - `starter-card`: an element copy, through `celebration-snapshots.ts`.
  - `composer-word`: a text-run copy with a background cover. The textarea is never touched.
- **Sections.** Picks the first authored section whose stage and role fit, and splices its variant windows into the shared trunk through one time remap.
- **Stations.** Binds or stretches station keyframes between measured anchors, and moves rigid groups with their anchor. No pose, timing or keyframe count is generated.
- **Span length.** Solves it from two authored reference positions per stretchable anchor.
- **Step cycles.** Repeats authored step cycles, so long paths take more steps instead of longer ones.
- **Copy tracks.** Drives each DOM copy along an authored 2-D track (x, y, rotation, opacity) on the Lottie clock.

No SnowmanDelivery-specific TypeScript runs on the external path: the scene is an asset plus the adapter's generic rules.

**Spike first, then a gate.** A spike runs before any capability is enabled, as in S4. It covers the representative segment:

- the ledge-card jump pickup
- the ride at the minimum and maximum span
- the impact, head flight and lodge
- the drawn-sled splice
- a `composer-word` probe

Go or no-go uses thresholds fixed in `design.md`.

**On go:**

- Capability plumbing: the enum, `SUPPORTED_CELEBRATION_CAPABILITIES`, support rules, the README and `docs/architecture.md`.
- The full SnowmanDelivery asset, bootstrapped once by a throwaway script that is never committed. It ships as a desktop and a mobile variant, plus a poster drawn from `SnowmanDeliveryStill`.
- Storybook fixtures, plus browser and evidence runs under the portfolio's evidence protocol.

**Themes (`epam/ai-dial-chat-themes`)**

- `scripts/check-celebration-packs.mjs` validates copy-track scenes: slots, `ct:` grammar, splice pairing, bind coverage, references and caps.
- Publish `new-year-default@1.2.0`: the existing `gift-wrapping` and `bullfinch-couriers` scenes plus `snowman-delivery`.
- Retention allows at most three versions per pack, so `1.0.0` must be deleted first. Under the approved reading of the retention rule, that is possible from 2026-12-18 (design D13).

**Unchanged**

- The compiled SnowmanDelivery stays the default and the fallback. Its files and tests are not touched.
- ReindeerTakeoff's compiled scene is unchanged, except that its text-run measurement moves into a shared module that its suite still covers.
- The BFF, OpenAPI, generated client and `apps/chat` need no code change: the BFF forwards any `interaction-*` ID, and the app filters by the exported set.

## Non-goals

- Migrating ReindeerTakeoff or any Halloween scene. The word probe only proves coverage.
- Removing the compiled SnowmanDelivery. The duplicate-removal gate waits for S8 (#9227).
- Production rollout. That is S8.
- Replacing `interaction-cat-borrow-v1` with copy-track. Convergence is a possible later change.
- New placement templates, manifest `interaction` parameters, runtime IK or Bézier evaluation in the browser.

## Alternatives

| Option | Correctness | Delivery risk | Reuse | Rollback | Verdict |
| --- | --- | --- | --- | --- | --- |
| A. SnowmanDelivery-only adapter (`interaction-card-borrow-v1`, conservative baseline) | Same fidelity limits | Lowest | Reindeer stays `adapter-pending` | Allowlist | Rejected by the issue owner in favour of reuse |
| **B. Generic copy-track adapter** | Stages and roles are fixed rules, versioned by ID | Higher: more grammar, so the spike gates it | Unlocks the Reindeer reopen condition, and later copy-only Halloween rows | Allowlist, per scene | **Picked** |
| C. Run `buildSnowmanDeliveryComposition` in the adapter or in themes | Exact | Low | None | Allowlist | Forbidden by the "Generator relocation" scenario |
| D. One pre-rendered asset per stage and span length | Exact at sampled lengths | Many assets, chosen before measuring | None | Allowlist | Rejected: exceeds the 32-asset cap, and selection has to happen before loading |

## Acceptance criteria

- **Gate recorded.** The spike result is recorded in `design.md` "Gate result" against every D10 threshold, and on #9226.
- **On go, coverage.**
  - Every stage that runs a story is covered by an authored section, for both the card and the drawn sled: `ledge`-card, `rim`-card, `rim`-sled and `platform`-sled.
  - `static` shows the poster.
  - The beat order, card return and contact checks of `new-year-snowman-delivery` hold within the design's recorded deltas.
- **On go, assets.** Both variants pass the themes checker and the pinned-player review, under "Published assets pass a pinned-player review".
- **Word probe.** The `composer-word` probe keeps its copy on its track within the contact threshold, and leaves the textarea's value, selection and focus untouched. That satisfies ReindeerTakeoff's reopen condition, and at the gate this change adds a `celebration-migration-portfolio` delta recording it.
- **Rollback.** Removing `new-year/snowman-delivery` from `UI_EVENT_EXTERNAL_SCENES` and bumping `UI_EVENT_DELIVERY_REVISION` restores the compiled scene on the next activation, while external GiftWrapping keeps playing.
- **Source accounting.** The adapter's new non-empty lines are reported next to the 3,123 non-empty scene-specific lines they make removable at `f416f8c69`, with the counting script, on #9226.
- **Verification.** `npm run verify:full`, `openspec validate --strict`, `npm run validate:specs` and `npm run validate:docs` pass.

## Capabilities

### New Capabilities

- `celebration-copy-track`: runtime behaviour of `interaction-copy-track-v1`. It covers stage templates, copy roles, section choice and splicing, binding, stretching and following, the span solver, step cycles, 2-D copy tracks, conditional layers, validation, one clock, restoration and the host boundary.

### Modified Capabilities

- `celebration-lottie-authoring-profile`: "Reserved interaction extension point" adds the third released adapter and its `ct:` marker namespace.
- `celebrations-library`:
  - "Pack descriptors and capabilities are public API" adds `interaction-copy-track-v1` to the supported set.
  - "Generic Lottie scene renders one descriptor" runs the copy-track adapter and extends the unsupported rules.
- `celebration-migration-portfolio`: "New Year decisions" records the copy-track adapter for SnowmanDelivery and that ReindeerTakeoff's reopen condition is met (added at the gate).
- `celebration-pack-contracts`: "Payload and structure caps" raises the layer cap from 30 to 48 (gate amendment).
- `new-year-snowman-delivery`: adds the external path. It keeps the compiled story's beats, stages, card return and fallbacks, under pack budgets, with per-scene rollback.

## Impact

- **Code.** `libs/celebrations/src/utils` gains the copy-track adapter and extends `lottie-anchor-binding.ts`, `lottie-time-remap.ts` and `lottie-track-keyframes.ts`. `models/`, `types/` and `constants/` get copy-track entries. `components/LottieScene` gets one adapter branch. Stories and fixtures are added, and browser tests go under `libs/celebrations/browser-tests/`.
- **Reindeer.** `new-year/utils/reindeer-text.ts` moves its measurement into a shared util; behaviour is unchanged.
- **Shared library and global providers.** No provider or context changes. `LottieScene` keeps its memoised playback object. Scope creep to flag: the generic modules get a second consumer, and `PackScenePreparation` loses its cat-only `borrow` field in favour of an adapter-owned payload.
- **Library isolation.** The adapter reads only the host-supplied `CelebrationAnchors` (`composer`, `starterList`, `welcomeRegion`) and the supplied direction. URLs, delivery mode, the allowlist and loaders stay in `apps/chat/src/context/CelebrationHost.tsx`, `apps/chat/src/hooks/celebration/useCelebrationPacks.ts` and `apps/chat/src/utils/celebration-pack.ts`.
- **APIs.** None. The BFF accepts any `interaction-*` ID (`CELEBRATION_CAPABILITY_PATTERN` in `apps/chat-api/src/celebrations/constants/celebrations.constants.ts`). An optional normalizer test mirrors the cat-borrow one.
- **i18n.** No new user-visible strings. The poster is decorative. The manifest scene uses `labelId: snowmanDeliveryToastMessage`, which already exists in `NEW_YEAR_LABELS` (`libs/celebrations/src/new-year/constants/labels.ts`) and in the app's `newYear.*` keys (`apps/chat/src/constants/i18n-keys/new-year.ts`), as GiftWrapping does.
- **RTL.** Direction `none`. The side comes from physical geometry and the supplied direction's preferred travel. Copies are never mirrored, so copied RTL text reads as in the original.
- **Accessibility.** The scene and its copies are `inert`, `aria-hidden` and pointer-transparent. Any interaction cancels the scene, and focus is never moved.
- **Feature gates.** None new. Exposure is governed by the existing `UI_EVENT_DELIVERY_MODE` and `UI_EVENT_EXTERNAL_SCENES`.
- **Bundle.** The adapter lives in the `packs` chunk, loaded only for external scenes. The entry and the compiled `new-year` chunk are unchanged.

## Rollback

- **Per scene.** Remove `new-year/snowman-delivery` from `UI_EVENT_EXTERNAL_SCENES` and bump `UI_EVENT_DELIVERY_REVISION`. Alternatively, point `defaults.new-year` back to `1.1.1` in the themes index.
- **Library.** The changes are additive. An older client ignores a scene that requires `interaction-copy-track-v1` and keeps the compiled scene.
- **No-go.** The spike adapter and its fixtures are deleted, as design D10 describes, and the compiled scene stays as it is.
- **Breaking changes.** None.
