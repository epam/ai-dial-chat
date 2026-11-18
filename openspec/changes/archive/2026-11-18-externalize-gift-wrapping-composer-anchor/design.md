# Design

## Context

See proposal.md, "Why" and "Problem". The facts that shape the approach:

- **The compiled scene.** `buildGiftWrappingComposition` (`libs/celebrations/src/new-year/utils/gift-wrapping-composition.ts`) builds a Lottie composition the size of the viewport (`w`/`h` = `clientWidth`/`clientHeight`) in world coordinates around the measured composer box. Geometry enters in three places:
  - **the composer ribbon:** a ten-vertex contour from `box.width`/`box.height`
  - **actor anchor offsets:** `masterX = -min(0.27·w, 130)`, `helperX = min(0.34·w, 175)` and the departure `-w/2 - 140`
  - **the fallback parcel:** a rectangle with the same box

  Everything else is time-based and does not depend on geometry: joint rotations, leans, expressions, coils, the bound bow and leg cycles. That includes the loose ribbon, which is sampled from the rig at fixed actor offsets, and the cap.
- **Its size.** The generated output is about 133 KB minified, with 5–6 layers, 566 keyframes and 1,172 path vertices (measured during proposal with `tsx` at 760/340/parcel boxes). That is inside the v1 caps (300 KiB, 2,000 keyframes, 8,000 vertices) and inside the GiftWrapping ceilings (240 KB, 1,400 keyframes).
- **Root clipping.** `lottie_light` clips the root layer group to `animData.w × animData.h` (`SVGRendererBase.prototype.configAnimation`, a `clipPath` with a `rect` of `w`/`h`). It also clips every precomposition (`ty: 0`) to its own `w`/`h`. A small authored stage would therefore clip the ribbon around a wide or tall composer.
- **Pack scene support today.** `LottieScene` (`libs/celebrations/src/components/LottieScene/LottieScene.tsx`) renders only `viewport-stage-v1`. It uses `LottieDataOwnership.Shared`, and its `prepare` only reads `w`/`h`. The app keeps parsed clips for the page lifetime (`createAssetLoaders` in `apps/chat/src/hooks/celebration/useCelebrationPacks.ts`), so a `prepare` that mutated its input would corrupt every later replay.
- **Cancellation identity.** The host reset key already contains the pack key, color scheme, direction and layout (`resetKey` in `apps/chat/src/context/CelebrationHost.tsx`). A direction, layout, theme or allowlist change therefore cancels the scene and recomposes the event without any new code.

## Goals / Non-Goals

**Goals:**

- One generic anchored placement, usable by later composer scenes in S7.
- A GiftWrapping adapter that fits geometry and authors no motion.
- Visual parity with the compiled scene within the deltas recorded below.

**Non-Goals:**

- Changing the compiled GiftWrapping. Its behavior and tests stay as they are, and only shared helpers move.
- A general slot or rig system, keyframe evaluation in the browser, or retargeting individual keyframes.

## Decisions

### D1. Split choreography between the asset and the code

| Concern | Today (code) | External path |
| --- | --- | --- |
| Artwork (`gift-wrapping-elves.json`, 157 KB) | lib asset turned into layers at runtime | asset |
| Joint rotations, leans, expressions, cap, legs, reel spin, coil trims, bound bow, composer bow | generated keyframes | asset |
| Actor paths, hops and departure | generated, scaled by composer width | asset, at reference geometry; scaled uniformly by `s` |
| Loose ribbon (261 sampled path keys) | sampled from the rig at prepare time | asset, at reference geometry; uniform `s` keeps contact |
| Composer ribbon contour | generated from the box | **code**: `composer-outline` slot fitting |
| Parcel | generated when no composer | **code**: `composer-parcel` slot removal or resize |
| Target eligibility, observers, interrupts | scene code | **code**: shared, generic for `composer-anchor-v1` |

Uniform scaling preserves every relation between the actors, the loose ribbon and the bow, because they all scale together. Only the outline must follow the composer's own aspect ratio. That is why the adapter is small.

**Alternatives considered:**

- Evaluating authored keyframes in the browser to retarget actor offsets would need a Bézier keyframe evaluator, and the rig constants would have to live in code. It was rejected as a generator under another name.
- Publishing pre-rendered geometry buckets was rejected: the real geometry is continuous and only known at runtime.

### D2. Local scene coordinates and per-variant reference frames

Each variant is authored in its own stage, using the profile's coordinate system. `anchorRect` is the reference composer. The characters stand on its top edge, and the stage keeps headroom above it for the characters plus their hops. The scene's `placement` is the desktop frame, and the mobile variant overrides it with its own `placement`, which keeps the template (see the `celebration-pack-contracts` delta). These values were confirmed with contact frames during apply.

| Variant | Stage `w × h` | `anchorRect` | `scale` | Character size baked in | Why |
| --- | --- | --- | --- | --- | --- |
| desktop (scene placement) | 1200 × 280 | `{ x: 340, y: 164, width: 520, height: 56 }` | `{ min: 0.6, max: 1 }` | 0.9 | At 520 both of today's offset caps apply (−130 / +175), so wide composers match the compiled scene exactly. `164` equals today's desktop clearance. The width floor is 312 px, and the synthetic anchor is 312 × 34 |
| mobile (variant placement) | 720 × 240 | `{ x: 210, y: 132, width: 300, height: 56 }` | `{ min: 0.77, max: 1 }` | 0.68 | At 300 the offsets equal the compiled ones (−81 / +102). The width floor is 231 px (today: 230). `132` equals today's mobile clearance. On a tablet with a 736 px composer, `s` stays 1 and the elves keep the compiled 0.68 |

`max: 1` keeps the actor spread at the compiled caps on wide composers. The scene never grows the characters beyond their authored size.

**Review correction.** An intermediate apply step shared one 520 px frame between both variants, because `placement` was scene-wide. The "Лёха" review (level 3) found the consequence. The mobile layout spans everything up to 1279 px, so a tablet composer reached `s = 1` with the mobile art at size 1.0. The elves were then 47 % larger than in the compiled mobile scene, and larger than on desktop. Adding the optional per-variant `placement` (additive within schema 1) restored the frames in the table above.

### D3. `composer-anchor-v1` re-bases the stage onto the viewport through a root null layer

At preparation, `LottieScene` runs these steps on a private JSON copy of the loaded data:

1. Measure the composer with the shared target rules (D5) and compute `s` and the anchor origin.
2. Set the copy's `w`/`h` to the viewport's `clientWidth`/`clientHeight`.
3. Add one null layer (`ty: 3`) with a fresh `ind` and `ip`/`op` equal to the root's. Set its anchor point to the anchor's top-center (or bottom-center), in stage coordinates. Set its position to the matching point on the measured composer, and its scale to `[±s·100, s·100]`, negative x for `direction: mirror` in RTL.
4. Parent every top-level layer that has no `parent` to that null layer.

The host element is the full scene layer: `absolute inset-0 overflow-clip`, `inert`, aria-hidden, the same as the compiled scene. The SVG maps 1:1 to CSS pixels, so the root clip is the viewport and content beyond the authored stage stays visible. Nothing is repositioned after preparation.

**Alternatives considered:**

- Positioning a stage-sized `<div>` with a CSS transform was rejected: the root clip is `w × h`, so the outline would be cut.
- Wrapping the stage in a precomp was rejected because precomps are clipped too.
- Enlarging the stage in the asset to 4096 × 4096 was rejected: it would cost DOM and paint, and it breaks authoring previews.

### D4. Fallback becomes `stage-anchor | poster`

A stage authored around a composer has no `fit`/`align`, so the S0 value `viewport-stage-v1` cannot be honored. `stage-anchor` uses the "smallest eligible composer" (`anchorRect × scale.min`, `s = scale.min`). It is centered at 57 % of the viewport height and kept between the headroom and a 26 px bottom margin, which is today's parcel rule generalized. Changing the contract value is safe: no client ever implemented `composer-anchor-v1`, and the themes checker currently accepts `composer-anchor-v1` only as an ID. The amendment is recorded in the `celebration-lottie-authoring-profile` delta.

### D5. Shared composer target, watch and interrupts

- **Target rules.** `getGiftWrappingTarget` moves into `libs/celebrations/src/utils/composer-target.ts`, parameterized by `{ minWidth, headroom }`. The compiled scene calls it with its current constants (230; 164/132), so its tests pass unchanged. The anchored placement passes `anchorRect.width × scale.min` and `anchorRect.y × s`.
- **Composer watch.** `watchComposer` (`gift-wrapping-animation.ts`) moves into `utils/composer-watch.ts` as a generic `onAnimationCreated`.
- **Interrupts.** The 11-event interrupt effect in `NewYearGiftWrapping.tsx` becomes an internal hook, `useComposerInterrupts`, used by both the compiled scene and the anchored `LottieScene`.

These moves create no public exports. Following the S1 rule, the only edits allowed in the compiled tests are mock module paths.

### D6. `interaction-composer-outline-v1` adapter

`libs/celebrations/src/utils/composer-outline-adapter.ts`, estimated at about 120 lines, runs after D3 on the same private copy:

- **Validate the slots.**
  - Exactly one top-level layer with `nm: composer-outline`. It has a static identity `ks` and exactly one static `sh` anywhere in its shape tree.
  - At most one `composer-parcel` layer, with one static `rc`.

  Anything else throws, which counts as a failure before playback and shows the poster.
- **Fit the outline.** Write the closed contour from today's `wrapPath`, in stage units relative to the anchor top-center. That is the measured size ÷ `s`, an inset of 3 and a corner chamfer of 10, starting at the top center and running toward +x. Mirroring is inherited from the null layer.
- **Fit the parcel.** For a real composer, delete `composer-parcel`. For a synthetic anchor, set its `rc.s` and `rc.p` to the anchor.

The adapter reads no DOM and authors no keyframes. It is a pure function of `(data, anchorBox, s)`, so it is unit-tested without a browser.

### D7. Ownership and cache isolation

The anchored `prepare` returns `{ data: privateCopy, … }`, and the playback uses `LottieDataOwnership.Transferred`, so each activation builds a fresh object (the same rule GiftWrapping follows today). The viewport stage keeps `Shared`. A test plays twice from one cached object with different composer widths. It asserts that the cached object is deep-equal to the fixture and that the two player inputs differ, and it covers a late resolution after cancel. The session already ignores late loads: the `state !== Loading` guard in `utils/lottie-scene-session.ts`.

### D8. Timing allowance

The descriptor declares `16000 / 2000 / 250 / 18500`. The player import and the data fetch share the 2000 ms load deadline. Preparation is synchronous and bounded by the caps: one JSON copy of ≤ 240 KB, ≤ 4 candidates × 24 ancestors, one contour. It must finish within the remaining 250 ms of slack. Apply measures it under 4× CPU throttling and records it, with a target of ≤ 50 ms. The provider lifetime of 18500 ms bounds everything, and a slow preparation surfaces as a shorter visible tail, never as an overrun.

### D9. BFF, client and app mapping

- **BFF.** `readPlacement` in `apps/chat-api/src/celebrations/celebration-manifest.normalizer.ts` gains a `composer-anchor-v1` branch with the bounds from the specs. `CelebrationPlacementDto` gains optional `anchor`, `anchorRect` (`CelebrationAnchorRectDto`), `edge`, `scale` (`CelebrationAnchorScaleDto`) and `fallback`, with Swagger enums. Follow `apps/chat-api/AGENTS.md` for DTO and Swagger conventions. The endpoint stays `@Public()`, unauthenticated and read-only, so no authorization change is needed.
- **Client.** Regenerate with `npm run openapi`.
- **App.** `toPlacement` in `apps/chat/src/utils/celebration-pack.ts` maps the branch to `CelebrationComposerAnchorPlacement`. `useCelebrationPacks` is unchanged: capability negotiation already goes through `SUPPORTED_CELEBRATION_CAPABILITIES`.
- **Library boundary.** No new context, provider, endpoint or fetch. The library receives only the existing `anchors.composer` class and the loaders.

### D10. Bootstrapping the asset without keeping a generator

The asset is produced once, during apply:

1. A throwaway script, kept in the scratchpad and not committed, calls the current `buildGiftWrappingComposition` with `box = anchorRect` and a stage-sized target for each variant.
2. It renames `composer-ribbon` to `composer-outline` and `fallback-parcel` to `composer-parcel`, always emitting the parcel, and sets `w`/`h` to the stage.
3. It writes minified JSON.

The JSON is then reviewed in the pinned player and in an authoring tool, and committed to `epam/ai-dial-chat-themes` as `new-year-default/1.1.0/gift-wrapping.{desktop,mobile}.<hash>.json`. The poster is the existing `data-gift-static` SVG with static art only.

From then on the JSON is the source. A parity test in this repository compares the adapter output at reference geometry with the compiled composition, using a small committed fixture: the outline and parcel layers plus the layer list, not the full asset. Neither repository keeps the generator as a publication step, and the S7/S8 deletion of the compiled scene removes it entirely.

### D11. Publication and checker

`scripts/check-celebration-packs.mjs` in the themes repository changes as follows:

- **Placement.** It validates the composer-anchor placement fields. Today it accepts any known capability as a template ID.
- **Slots.** For scenes that require `interaction-composer-outline-v1`, it validates the slot rules.
- **Versions.** It keeps `1.0.0` as the rollback target and publishes `1.1.0`. `1.1.0` reuses the `bullfinch-couriers` asset IDs; same ID and same `sha256` is allowed.

Then the index revision is bumped. GiftWrapping-specific ceilings (12 layers, 1,400 keys, 240 KB, 500 SVG descendants, 180 paths) are measured once in this change's evidence, and the descendant count is also enforced at runtime by the existing 800-element check.

### D12. Measuring what stays in code

Apply records a table using the `celebration-migration-baseline` counting rule:

- the scene-specific compiled lines (composition 799, animation 99, targets 102, rig 10, component 104, art 354, plus the 157 KB rig JSON)
- the lines the external path needs (adapter, the anchored branch of `LottieScene`, and the shared target/watch/interrupt modules counted once)

The net removal is reported as "available on deletion of the compiled scene (S7/S8)", not claimed now.

**Measured during apply.** The counts are physical / non-empty lines in the working tree on `feat/celebrations-s3-gift-wrapping`. Recount them from git objects at the merge commit, as the rule requires, before publishing.

| Group | Files | Lines |
| --- | --- | --- |
| Compiled GiftWrapping at `024ed5445` (before) | composition 799, animation 99, targets 102, rig 10, component 104, art 354 | **1,468 / 1,435**, plus `gift-wrapping-elves.json` 157,360 B |
| Compiled GiftWrapping after this change | composition 799, animation 40, targets 47, rig 10, component 74, art 354 | 1,324 / 1,291. Each is deleted with the compiled scene in S7/S8 |
| Moved out of GiftWrapping, now shared by every composer scene | `utils/composer-target.ts` 133, `utils/composer-watch.ts` 88, `hooks/useComposerInterrupts.ts` 42 | 263 / 251. The same rules the compiled scene had, not new code |
| New, scene-agnostic external path | `utils/composer-anchor.ts` 182, `utils/composer-outline-adapter.ts` 164, `types/composer-outline.ts` 7, `models/lottie-composition.ts` 82, `LottieScene` and `celebration-pack-scene.ts` +136 / −19 | about 552 added |

**Choreography that stays in code:**

- the composer eligibility rules
- the composer watch and the 11 interrupt events
- the ten-vertex outline contour (inset 3, chamfer 10, starting at the top center)
- the parcel removal or resize

All four are geometry rules. None of them is a keyframe, a pose or a timing, and none names GiftWrapping. Deleting the compiled scene removes 1,324 GiftWrapping-specific lines and the 157 KB rig. The external path keeps about 552 lines, which have no GiftWrapping-specific code and can serve later composer scenes. The net removal on that deletion is therefore about 770 lines, and every GiftWrapping-specific line goes.

## Risks / Trade-offs

- **[Departure distance is fixed per variant.]** On a 900 px composer the elves fade out about 190 px before the composer's inline-start edge, where the compiled scene puts them past it. → Accepted: the opacity fade (15.3–16 s) hides the end. This is recorded as a visual delta in the evidence, and a follow-up can add a numeric `interaction` parameter if design asks for it.
- **[The desktop eligibility floor rises from 230 to 312 px.]** → Such composers are rare on desktop (window width ≥ 1280). They get the parcel, not a broken wrap. The mobile floor stays at 231 px. The delta is recorded in the evidence.
- **[A viewport-sized SVG costs as much as today's.]** → It is the same structure the compiled scene already uses. The 800-element runtime check and the profile evidence still apply.
- **[A future asset breaks the slot assumptions.]** → The publication check enforces the slot rules, the runtime treats a bad slot as a failure before playback (poster), and the bundled fallback stays available by policy.
- **[Cross-repository ordering.]** → Publishing `1.1.0` before Chat ships S3 is safe: older clients lack `composer-anchor-v1` and keep the compiled scene. The index bump can happen at any time.
- **[Root re-basing changes `w`/`h`.]** → This is done only on the private copy, after the caps were checked on the original, and the null layer adds a single `<g>`.

## Migration Plan

1. Land the library, BFF, client and app changes, all inert under the default `bundled` policy.
2. Publish `new-year-default@1.1.0` and bump the index revision.
3. In a test environment, set `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=new-year/bullfinch-couriers,new-year/gift-wrapping`. Capture the evidence: recordings at normal speed, contact frames at 360/390/1280/1920 in LTR and RTL, the fallback, cancellation and replay.
4. Production rollout is S8 (#9227).

**Rollback:**

- Remove `new-year/gift-wrapping` from the allowlist. The reset key changes and active playback is cleaned up, and the compiled scene plays on the next activation.
- Alternatively, point `defaults.new-year` back to `1.0.0`.
- The library changes are additive and need no revert.

## Open Questions

- Where should binary evidence be stored durably? This is S0's open question 2. Until it is answered, follow S2: attach the evidence to a comment on #9222 and commit the summaries under this change.
