# Proposal

## Why

S3 (#9222) showed that a pack scene can attach to one host element: GiftWrapping maps its stage onto the composer with one uniform scale. The Halloween Cat does more. It walks to two live buttons, pushes reversible copies of them with its paw, and drops them onto measured supports, with the fall timed by gravity. S7 (#9226) migrates every DOM-borrowing scene (PenguinStar, SnowmanDelivery, the Halloween secret scenes). Before that, we need evidence that externally authored Lottie motion can stay in contact with DOM copies on one clock, and that this needs only a small adapter rather than a relocated generator. The Cat is the gate for that decision: `celebration-lottie-authoring-profile` names "the S4 Halloween Cat pilot (#9223)" as the next planned adapter.

## Problem

The whole Cat story is computed in code, in about 1,600 lines:

- `buildCatPlan` (`libs/celebrations/src/halloween/utils/halloween-cat-plan.ts`, 774 lines) recomputes every keyframe from the measured buttons on each activation.
- It solves the paw position by two-joint IK (`reach`, `halloween-cat-plan.ts`).
- Fall time comes from gravity and the measured drop (`halloween-cat-plan.ts`). The cat's recoil and grooming are then timed from the landing.

Geometry enters in four places: the stations (composer perch, button stand points, entry and exit edges), the side the cat works from, the drop to a support or the floor, and the number of reachable buttons. One button or two changes the story.

`composer-anchor-v1` fixes only the first of these, and only for the composer. The rest has no contract today:

- Descriptors have no `interaction` field.
- v1 runtimes ignore Lottie `markers` (`celebration-lottie-authoring-profile`, "Reserved interaction extension point").
- `interaction-cat-borrow-v1` is reserved but unsupported, so a pack that requires it keeps the bundled Cat.

So the Cat can change only with a Chat release, and S7 has no proven pattern for borrowing scenes.

## What Changes

The change runs as a gated feasibility pilot. A spike proves the split on one representative interaction. The full scene migrates only after that spike passes. Every step is inert under the default `bundled` policy.

- **Split choreography between asset and adapter (design D1).**
  - **Asset** (themes repository): the artwork and every pose and transferable motion. That covers the articulation, gait, hops, squash, looks, blinks, grooming, each button's push displacement, story sections and timing.
  - **Adapter** (compiled, host-independent, in `libs/celebrations`): only geometry rules. It discovers targets with today's `getCatTargets` rules (`libs/celebrations/src/halloween/utils/halloween-cat-targets.ts`). It resolves five physical anchors and the cat's working side. It writes those anchors into marker-bound station keyframes. It selects a story section and absorbs the physical fall time through a time-remap track. It computes the copies' fall and rebound. It snapshots, restores and observes.
  - Paw reach needs no IK. Each stand point is anchored to the button's near edge and baseline, so the authored reach meets the button whatever its width.
- **Release `interaction-cat-borrow-v1`**, the second released adapter, together with `composer-anchor-v1` placement.
  - It reads `cat:`-namespaced Lottie markers and reserved layer names: `cat-rig`, `cat-root`, `cat-facing`, `prize-0`, `prize-1`, `anchor:*` and `cat-floor`.
  - Malformed markers or slots are a preparation failure, which shows the poster. The scene is never partly executed.
- **Use markers, not manifest parameters (design D3).** Contact times live with the motion in the authoring tool, so a retimed asset cannot drift from a manifest copy. The descriptor gains no field. The BFF already validates capability IDs by pattern (`apps/chat-api/src/celebrations/celebration-manifest.normalizer.ts`) and validates composer-anchor placements. The OpenAPI document and the generated client therefore stay unchanged, and `npm run openapi:check` proves it. The profile amends "v1 runtimes ignore markers": only an adapter a scene requires reads its own namespace.
- **Synchronize on one clock.**
  - **Readiness.** The copies are cloned and attached hidden before readiness.
  - **Start.** They start on the Lottie clock through the existing `onPlaybackStarted`/`timelineZeroMs` (`libs/celebrations/src/models/lottie-scene.ts`), as SnowmanDelivery's card does (`libs/celebrations/src/new-year/utils/snowman-delivery-animation.ts`).
  - **Snapshot helper.** `animateCelebrationSnapshots` (`libs/celebrations/src/utils/celebration-snapshots.ts`) gains a prepare/start split, and existing callers keep their behaviour.
  - **Skipped frames.** Both clocks derive from `document.timeline`, so a skipped frame never accumulates drift.
  - **Cancellation.** A cancellation before the first rendered frame never touches an original.
- **Keep the timing.** The 25 s story and the bundled 25.5 s lifetime are unchanged (`HALLOWEEN_SCENE_DURATIONS`, `libs/celebrations/src/halloween/constants/halloween.ts`). The external scene declares `25000 / 2000 / 250 / 27750`, which is at most the 32 s cap.
- **Publish `halloween-default@1.0.0`** (themes repository, cross-repository). It contains the `cat` scene (one animation asset, with a mobile variant mapped at 0.8 scale) and a static poster. The publication check gains the cat-borrow marker, slot and budget rules. The asset is bootstrapped once from `buildCatPlan` at reference geometry and then committed as the authored source. No generator is committed or run there.
- **Carry over the S3 verification.**
  - Committed browser coverage of the real external GiftWrapping asset: delayed and broken loads, cancellation, cached replay, contact and fallback.
  - Preparation timing under 4× CPU throttling against the 50 ms target.
- **Record the evidence** before any further DOM migration is approved:
  - the adapter and generic code, the asset size and the rendering cost
  - contact frames and normal-speed recordings
  - the go/no-go decision of the spike

There are no **BREAKING** changes. Old clients do not support `interaction-cat-borrow-v1`, so they keep the compiled Cat.

## Non-goals

- Deleting or changing the compiled Cat. Its suites stay green unchanged, and deletion is S7/S8.
- A generic borrowing adapter for other scenes. #9226 designs that from this evidence and from SnowmanDelivery's card.
- Manifest `interaction` parameters, new placement templates, theme or embedding bindings (S5/S6), telemetry or rate limits (S8).
- Simplifying the story. That needs an explicit product decision and is not taken here.
- The outstanding S3 authoring-tool review and the final merge-revision code accounting. Both are tracked with asset acceptance in #9226.

## Alternatives considered

| Option | Contact and pacing | Code left in Chat | Contract/delivery risk | Pick |
| --- | --- | --- | --- | --- |
| A. Keep the compiled Cat (baseline, and the no-go outcome) | Exact | All of it, about 1,600 lines | None | no: the gate question stays open |
| B. Run `buildCatPlan` in the adapter and feed its keyframes to Lottie | Exact | The generator, relocated | Low | no: the issue rules it out |
| C. `composer-anchor-v1` alone, one uniform scale | Breaks: 3–4 independent targets cannot share one transform | Placement only | Low | no |
| D. One asset per story or per geometry bucket, chosen before loading | Approximate; geometry is continuous | Selection logic | Measuring before load breaks the S3 measure-after-load rule | no |
| E. D1 split, with contact times in manifest `interaction` parameters | As F | As F | Timing is duplicated outside the asset, and it needs DTO, OpenAPI and client changes | no |
| F. D1 split: marker-bound station retargeting, a time remap for story and fall, and DOM copy tracks | Exact at stations and contacts. The fall stays physical and the cat's reaction is re-timed within authored windows | Geometry rules only | Medium: one adapter, one profile amendment, one pack | **yes** |

F keeps poses and timing in the asset and only geometry and physics in code. It is the only option that answers the gate question without moving the generator.

## Acceptance criteria

- **Spike (the gate).** One representative interaction meets the thresholds in design D9, and the go/no-go is recorded. That interaction runs from the perch: hop down, nudge, push, a physical fall to the measured support, rebound and recoil. On no-go, the compiled Cat stays, the spike code is removed, and the evidence is filed on #9223.
- **Usable chat.** Real chat controls, focus, selection and drafts stay unchanged and usable. After any termination, no copy remains, no original stays hidden, and no animation, listener, observer or timer remains. This holds over 20 repeated activations and interruptions.
- **Layouts and fallbacks.** Contact and restoration are correct at 360/390/1280/1920 px in LTR and RTL. The two-button and one-button stories, the crossing cat with no reachable target, and the stationary reduced-motion poster are kept.
- **Borrowing limits.** At most two buttons are borrowed, each with ≤ 60 descendants, ≤ 300 × 96 px and ≤ 24,000 px². The composer is never copied or transformed.
- **Visual parity.** Artwork and pacing match the compiled Cat. Reviewers assess this at actual size during continuous normal-speed playback, not from contact frames alone.
- **Manifests.** They contain only validated capability IDs and placement fields: no code, functions, selectors or parameters.
- **Cleanup.** Every interrupt path cleans up exactly once. A failure after the first frame stops the scene and plays no fallback scene.
- **Library boundary.** `libs/celebrations` receives only semantic anchor class names, resolved loaders and data, and narrow callbacks.
- **S3 carry-over.** It is complete before S4 is accepted.

## Capabilities

### New Capabilities

- `celebration-ui-borrowing`: runtime behaviour of `interaction-cat-borrow-v1`. That covers target and anchor resolution, marker and slot rules, station retargeting, story selection and elastic time remap, copy tracks and physics, single-clock synchronization, readiness, cancellation, restoration and budgets.

### Modified Capabilities

- `celebration-lottie-authoring-profile`: the reserved interaction extension point. `interaction-cat-borrow-v1` is released, adapters may read their own namespaced markers, and other markers stay ignored.
- `celebrations-library`: the supported capability set and enum, and `LottieScene` running the cat-borrow adapter and its unsupported conditions.
- `celebration-composer-anchoring`: committed browser coverage and a preparation-time measurement for external anchored scenes (S3 carry-over).
- `halloween-easter-egg`: the Cat may be delivered from a pack, and the compiled Cat stays the default and the fallback.
- `celebrations-delivery-api`: the BFF's streamed read cap for Lottie JSON rises from 300 KiB to 512 KiB.
- `celebration-pack-contracts`: the Lottie JSON caps rise from 300 KiB and 2,000 keyframes to 512 KiB and 4,000 keyframes, for every pack. This follows the gate decision (design "Gate result").

## Impact

- **`libs/celebrations` (shared library, scope flag).** New internal modules for markers, retargeting, time remap, copy tracks and the cat-borrow adapter. Changes to `LottieScene`, `celebration-pack-scene.ts`, the capability enum and set, and the `celebration-snapshots.ts` prepare/start split. Also the README, stories and tests. Host knowledge stays outside: the adapter reads only `anchors.composer`, `anchors.starterList` and `anchors.welcomeRegion` through `CelebrationEnvironment`, supplied by `CelebrationHost` (`apps/chat/src/context/CelebrationHost.tsx`). Bytes arrive through `CelebrationAssetLoaders`.
- **Storybook (dev only).** A story-only devDependency on `@epam/ai-dial-conversation-input` lets the browser tests use real `ConversationInput` geometry, as `type:ui` → `type:ui` allows. It also adds a pinned copy of the published GiftWrapping 1.1.1 assets as fixtures (about 225 KB).
- **`apps/chat-api`, `libs/chat-api-client`.** The JSON asset caps in `apps/chat-api/src/celebrations/constants/celebrations.constants.ts` rise to 512 KiB (`CELEBRATION_ASSET_MAX_BYTES`, `IMMUTABLE_STORE_MAX_ENTRY_BYTES`). There is no DTO or OpenAPI change, and a normalizer test proves that a cat-borrow manifest passes unchanged.
- **`apps/chat`.** No change. `useCelebrationPacks` already replaces scenes of known events by stable ID.
- **`epam/ai-dial-chat-themes`.** `halloween-default/1.0.0`, an index revision with `defaults.halloween`, and `scripts/check-celebration-packs.mjs` rules.
- **i18n.** No new strings. The Cat keeps `halloween.catToastMessage`.
- **Rollback.** Remove `halloween/cat` from `UI_EVENT_EXTERNAL_SCENES` and bump `UI_EVENT_DELIVERY_REVISION`, which is part of the reset key. Active playback is restored and stopped, and the compiled Cat plays from the next activation, never in the same one. As a secondary path, drop `defaults.halloween` from the index. The library changes are additive.
