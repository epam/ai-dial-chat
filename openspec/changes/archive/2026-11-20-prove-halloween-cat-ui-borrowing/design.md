# Design

## Context

Motivation and scope are in proposal.md ("Why", "Problem"). The requirements are in the specs, mainly `celebration-ui-borrowing`. These facts shape the approach.

### The compiled Cat

`buildCatPlan` (`libs/celebrations/src/halloween/utils/halloween-cat-plan.ts`) samples every track about every 60 ms over 25 s:

- the actor transform
- facing
- ten articulated parts: arm, forearm, head, tail, two legs, eyes, pupils, ears, tongue
- one track per borrowed button

`animateCat` (`halloween-cat-animation.ts`) plays all of them as WAAPI animations on one `document.timeline` start time.

### Where geometry enters

| Input | Where it is used |
| --- | --- |
| The composer top | Perch, approach, entry height |
| Each button's near edge and bottom edge | Stand point `edge − side·30·scale`, contact point |
| The side choice and the travel to the viewport edge | Push amount, clamped by travel |
| The first support below, or the viewport floor | Drop, fall time `√(2·drop/2000)`, rebound |
| The number of reachable buttons | One-button or two-button story |

Everything else depends only on time and cat size:

- joint motion
- hop arcs (`sin·size·k`)
- gait at 1.9 Hz
- squash
- looks, blinks and grooming
- the fixed beats (walk-in 2.6 s, jump 3.1–3.7 s, hop 7.6–8.3 s, prize beats at 8.6 s and 15.3 s, move 14.2–15.1 s, groom limit 22.7 s, departure 23.5–24.9 s)

Paw contact is solved by two-joint IK. The contact point relative to the foot is `(side·(30·scale + displacement − shift), −0.38·h)`, so the only geometry it depends on is the button height `h`.

### Recoil, grooming and the landing

The recoil, the first grooming bout and the looks after a fall are timed from the physical landing. The departure is not.

### Building blocks that exist

- **Lottie clock.** `onPlaybackStarted` reports `timelineZeroMs` on the first rendered frame (`libs/celebrations/src/utils/lottie-scene-session.ts`). SnowmanDelivery already starts a WAAPI card copy on it (`libs/celebrations/src/new-year/utils/snowman-delivery-card.ts`).
- **Snapshots.** `animateCelebrationSnapshots` (`libs/celebrations/src/utils/celebration-snapshots.ts`) clones and animates in one call. It has a 1,500-node budget, unique IDs, `href` removal, its own interrupt listeners and an exactly-once `stop`.
- **Target observers.** `observeSceneTargets` (`libs/celebrations/src/utils/scene-targets.ts`) watches targets with a 0.5 px tolerance.
- **Anchored scenes.** `LottieScene` already runs `composer-anchor-v1`: one measurement after load, root re-basing through a null layer, and `watchComposer` plus `useComposerInterrupts`. It runs them on a private copy (`LottieDataOwnership.Transferred`).

### The pinned player

`lottie_light` 5.13.0 (`node_modules/lottie-web/build/player/lottie_light.js`) does three things that matter here:

- It implements precomposition time remap. In `ICompElement.prepareFrame`, `tm` is in seconds and multiplied by `fr`.
- It parses `markers`, with `cm` as plain text or a JSON payload.
- It renders gradient fills.

The Cat artwork has 34 paths and 5 gradients (`HalloweenCat.tsx`).

### The pipeline is open by pattern

The BFF accepts any capability ID that matches `CELEBRATION_CAPABILITY_PATTERN` (`apps/chat-api/src/celebrations/constants/celebrations.constants.ts`). It validates `composer-anchor-v1` placements fully and strips unknown fields. The app negotiates support through `SUPPORTED_CELEBRATION_CAPABILITIES` alone.

### There is no Halloween pack yet

The themes index lists `new-year-default` (1.0.0, 1.1.0, 1.1.1) and `company-anniversary`.

## Goals / Non-Goals

**Goals:**

- Answer the gate question with measured evidence before the full migration. Does authored motion stay in contact with DOM copies on one clock, through an adapter that holds only geometry rules?
- Keep every asset/adapter rule generic enough that #9226 can judge reuse: anchor binding, the time remap and copy tracks are scene-agnostic modules, and only the Cat's anchor resolution is scene-specific.
- Keep visual parity with the compiled Cat, within the deltas this document records.

**Non-Goals:**

- Retargeting arbitrary keyframes, evaluating Bézier keyframes in the browser, or runtime IK.
- A slot or rig system for other characters.
- A new placement template.
- Any change to the compiled Cat or its tests.

## Decisions

### D1. Split choreography between the asset and the code

| Concern | Today (code) | External path |
| --- | --- | --- |
| Artwork (34 paths, 5 gradients) | `HalloweenCat.tsx` | asset: shape layers, with part artwork as shared precompositions |
| Joint motion, looks, blinks, ear twitches, tongue, grooming | sampled keyframes | asset |
| Hop arcs, gait bob and squash | sampled into the actor transform | asset: a relative `cat-motion` null |
| Locomotion timing and easing between stations | sampled | asset: `cat-root` keyframe times and easing |
| Station positions (entry, perch, stands, exit) | computed | **code**: anchor values written into `cat-root` keyframes (D5) |
| Facing per side | computed `scaleX` | asset: hold keyframes. **Code** writes the sign per anchor |
| Paw reach | IK per frame | asset: authored reach at reference contact height (D5) |
| Push displacement of each button | computed, clamped by travel | asset: `prize-N` track. **Code** mirrors it per side and checks reachability |
| Fall, tilt and rebound | gravity | **code**: same constants, written as WAAPI keyframes (D7) |
| Story choice (two, one, crossing) and the cat's reaction to the physical landing | computed | **code**: a time remap on `cat-rig` (D6), inside authored windows |
| Floor glow | div from the grounded buttons | asset slot `cat-floor`, fitted by **code** |
| Target discovery, snapshots, restoration, observers, interrupts | scene code | **code**: the existing rules and helpers |

Geometry enters only through anchor values, the physical fall, reachability and the story choice. Code authors no pose, no timing and no keyframe count.

**Alternatives considered:**

- Feeding `buildCatPlan` keyframes to Lottie (option B in the proposal) relocates the generator.
- Running IK at preparation to rewrite the arm keyframes would put the rig constants (24-unit joints, shoulder origin) back into code. D5 makes it unnecessary.

### D2. Asset structure

```
root (w×h stage, op = 25 s, no time remap)
├─ cat-floor                 shape layer slot: one static rectangle, gradient fill
└─ cat-rig                   precomposition layer (st 0). The adapter writes `tm` here
   ├─ anchor:entry-edge … anchor:exit-edge   static nulls: the reference anchor points
   ├─ prize-0, prize-1       nulls: authored copy tracks (position x, rotation, opacity)
   └─ cat-root               null: station keyframes (linear spatial path, no tangents)
      └─ cat-facing          null: hold keyframes on x-scale ±100
         └─ cat-motion       null: relative arcs, bob and squash, around the foot point
            └─ body and ten part layers, each referencing a static artwork precomposition
```

The `cat-rig` precomposition's own timeline holds three sections:

| Section | Rig-local range | Content |
| --- | --- | --- |
| `two-prizes` | 0–25 s | The full two-button story. It is the default view, so the asset previews the two-button story at reference geometry without any adapter. |
| `one-prize` tail | 25 s – 25 s + (25 s − release₀) | The story after the first release: rebound watch, recoil, two grooming bouts, departure |
| `crossing` | after that, 9 s | The fallback walk |

Sharing the artwork precompositions keeps one copy of the paths. Each section adds only keyframes.

**Implemented in the spike:**

- `lottie_light` clips every precomposition to its own `w × h` from (0, 0). So `cat-rig` is 4096 × 4096, its layer has the anchor (1000, 1000) and the position (0, 0), and rig coordinates are stage coordinates + (1000, 1000). The adapter reads that shift from the layer's static `a` and `p`.
- A `cat-art` null maps the 160 × 140 artwork around its foot point (80, 120) at the authored size (scale 87.5 % for 140 px).
- `cat-paw` is an invisible reference layer under the forearm at the point the compiled IK reached (100, 120), with the DOM id `cat-paw` through Lottie `ln`. The browser checks measure contact against it. Its layer opacity stays 100 and only its fill is transparent, because `lottie_light` hides a layer whose opacity is 0 (`hideOnTransparent`) and drops its path.

Layer budget estimate: 2 root layers, about 6 nulls, 5 anchor nulls and about 11 part layers in the rig, that is about 24 of 30. Apply records the real count.

### D3. Markers, not manifest parameters

`cat:` markers are written in rig-local time, in frames, with plain-text `cm`:

| Marker | Duration | Meaning |
| --- | --- | --- |
| `cat:section:two-prizes` / `one-prize` / `crossing` | the section length | Section ranges |
| `cat:branch:one-prize` | — | Frame in `two-prizes` where the one-prize path leaves for its tail. It equals `cat:release:0`, and the poses at the branch and at the tail start must match. |
| `cat:bind:<anchor>` | the range | Binds the `cat-root` and `cat-facing` keyframes in range to `entry-edge`, `perch`, `prize-0`, `prize-1` or `exit-edge` |
| `cat:entry:<prize>` | — | The copy becomes visible and the original hides |
| `cat:contact:<prize>` | — | A paw contact instant, up to 4 per prize. Used by the contact tests and the checker |
| `cat:release:<prize>` | — | End of the push. Physics owns the copy from here |
| `cat:landing:<prize>` | optional elastic range | Authored landing. With a duration, the cat's reaction is re-timed (D6) |
| `cat:restore` | — | The copies fade and the originals return. Opacity is authored on `prize-N` |

Markers win over an `interaction` object because:

- contact and release times move with the motion when an author retimes it in the authoring tool, so there is no second copy that can drift
- the descriptor gains no field, so the BFF DTOs, OpenAPI and the client stay unchanged, with no regeneration
- the profile already reserved "Lottie marker names" for adapters

Physics constants (2000 px/s², tilt ≤ 12°, rebound factors) are adapter constants, versioned by the capability ID. A change to them is `interaction-cat-borrow-v2`.

Validation runs twice, with the same rules:

- the themes publication check rejects the asset
- the runtime fails the preparation, which shows the poster (spec "Malformed markers or slots fail before playback")

Markers outside `cat:` are ignored everywhere.

### D4. Placement: `composer-anchor-v1` at a fixed scale, `direction: none`

The scene placement (desktop) is `anchorRect { x: 600, y: 98, width: 240, height: 56 }`, `edge: top`, `scale { min: 1, max: 1 }` and `fallback: stage-anchor`. The mobile variant reuses the same animation asset with `scale { min: 0.8, max: 0.8 }`.

- **Why `s` is fixed.** `s = 1` keeps the authored 140 px cat. `s = 0.8` gives exactly the compiled mobile size (112 px) and headroom (`98 × 0.8 = 78.4 = 112 × 0.7`).
- **Why `anchorRect.width` is 240.** With `min = max`, `anchorRect.width` is the composer width floor. 240 px (192 on mobile) is above every real composer's minimum.
- **What the mapping gives.** It supplies the stage origin, S3's eligibility rules, `watchComposer`, `useComposerInterrupts` and the synthetic anchor. The adapter converts measured viewport points into stage units through the inverse of the root null (`(p − origin) / s`).
- **Why `direction: none`.** Sides come from physical geometry, as in the compiled Cat, and copies are never mirrored.

**Alternative considered: a new pixel-stage template.** It would duplicate the composer-anchor machinery for one scene.

### D5. Station retargeting through anchor bindings

For each `cat-root` keyframe in a `cat:bind:X` range, the adapter writes a new value:

```
v' = A_X + diag(σ_X, 1) · (v − R_X)
```

- `A_X` is the measured anchor, in stage units.
- `R_X` is the static position of `anchor:X`.
- `σ_X` is the measured side × the authored side. The authored side is the sign of `cat-facing` at the range start.

`cat-facing` keyframes in the same range get `scaleX' = σ_X · scaleX`. Keyframe times, easing and count are unchanged. Arcs, bob and squash live in `cat-motion`, inside the facing space, so they follow the side automatically.

The anchors are:

| Anchor | Position | Side |
| --- | --- | --- |
| `perch` | (prize-0 stand x, composer top) | first side |
| `prize-N` | the button's near inline edge on its bottom edge | its side. The compiled rule applies: the half of the composer that holds the button, else the other half |
| `entry-edge` | viewport edge on the first side, at the composer top | first side |
| `exit-edge` | viewport edge on the last side, at the last baseline | last side |

In `crossing`, both edge anchors sit 24 px above the viewport bottom, as in the compiled fallback.

**Why no IK is needed.** The authored stand point keeps its offset from `prize-N`: −30 units, mirrored. The paw's reach is authored for a contact 15.2 units above the baseline. That is the compiled contact (0.38 × h) on the real 40 px composer buttons, which the spike measured on the real `ConversationInput`; the design had assumed 32 px. So the paw meets the near edge of any button 20–96 px tall, because 15.2 < 20, the target minimum. Only the contact fraction changes: lower on tall buttons. This is recorded as delta V1.

**The walk between two buttons.** It binds to the anchor `move`. Its point is where the cat stands after the first button's pushes, and its side is the measured direction toward the second stand point. So the facing during the walk follows the page, not the authored order of the buttons.

**Unplayed ranges.** A bind range whose anchor the chosen story does not measure, such as `prize-1` in the one-prize story, keeps its keyframes as authored. Every keyframe must still lie in a bind range.

**Reachability.** A button is reachable only when all of these hold:

- the authored total push (`prize-N` x span × s) plus 3 px fits before the viewport edge
- the stand point lies inside `0.46 · size` margins
- the drop is at least 24 px

Otherwise the other side is tried, and then the button is skipped. The compiled Cat instead shortens the push. This is recorded as delta V2.

### D6. One time remap for the story and the physical fall

The adapter writes linear keyframes on `cat-rig.tm`.

**The section path:**

| Story | Mapping from composition time `t` to rig-local time |
| --- | --- |
| Two buttons | `t` |
| One button | `t` up to `B` (`cat:branch:one-prize`), then a step to the tail start `T`, then `T + (t − B)` |
| Crossing | `C + t`, and the private copy's root `op` is trimmed to 9 s, so the Lottie `complete` event ends the session early |

**The elastic fall.** This applies only when `cat:landing:N` has a duration `E` and the prize is the path's last one.

- `R` is the release and `f_a` the authored fall, from release to the landing marker. `f_p` is the physical fall.
- Map `[R, R + f_p] → [R, R + f_a]`, then `[R + f_p, L_a + E] → [L_a, L_a + E]`.
- The speed in the second piece, `E / (E − (f_p − f_a))`, must lie in [0.8, 1.25]. Otherwise the prize is unreachable, and the story degrades as the spec describes.
- At reference values (`E` ≈ 2.4 s in two-prize, about 9 s in one-prize), this absorbs falls up to about 0.48 s longer than authored.

The copies keep the physical fall in composition time. So the recoil starts within one frame of the landing, and the departure keeps its authored composition time.

The `prize-N` tracks and the markers are read in rig-local time and mapped to composition time through the inverse of the monotone pieces. Push windows lie in identity or pure-offset pieces, because a validation rule keeps elastic ranges from overlapping any later push.

**Alternatives considered:**

- A fixed authored fall window with a variable effective gravity keeps the timing trivially. It breaks "falls accelerate" pacing: a 40 px drop takes 0.35 s instead of 0.2 s.
- Shifting act layers by `st` clips the following act and pops.
- A separate asset per story must be chosen before loading (option D).

### D7. Copies: authored track, then physics, on the existing snapshot helper

`celebration-snapshots.ts` gains a prepare/start split, `prepareCelebrationSnapshots(targets, options)`:

- **prepare** clones without a host
- **attach** puts the clones, hidden, into a layer and applies the scroll positions
- **start** creates the copy animations and the originals' opacity animations, with the given `startTime`
- **stop** is idempotent

`animateCelebrationSnapshots` becomes prepare + attach + start, and its 12 existing calling modules keep their behaviour. Their suites prove it.

Two details keep that behaviour:

- Copies stay invisible between `attach` and `start` through the wrapper's `opacity`. `visibility` would not work, because a clone copies `visibility: visible` onto every node.
- `decorateCopy` runs after the copy is attached, as before the split, because the raven and spider scenes use it to move the copy into another element.

The phases map onto the Lottie session as follows:

| Session step | Snapshot step |
| --- | --- |
| Preparation | Clone |
| `onAnimationCreated` | Attach to a scene-owned layer prepended to the renderer host, so the cat draws over the copies. Register `observeSceneTargets` for the buttons and supports, and the snapshot `stop` as a disposer |
| `onPlaybackStarted` | Start on `timelineZeroMs`, after `LottieScene` records that playback started |

A snapshot `stop` before `cat:restore` cancels the session, as SnowmanDelivery's card does.

**Building the WAAPI keyframes:**

- Each Lottie keyframe becomes a WAAPI keyframe at `offset = t_comp / duration`.
- Its easing `o`/`i` becomes `cubic-bezier(o.x, o.y, i.x, i.y)`, and a hold (`h: 1`) becomes `steps(1, end)`.
- x is multiplied by σ and s, and the y component is ignored before release.
- After `cat:release:N`, the adapter appends 18 fall samples, plus 20 rebound samples for the last prize, with the compiled formulas.
- `hideAt` is `cat:entry:N` and `restoreAt` is `cat:restore`.

Copies only translate and rotate, so copied RTL text reads as in the original.

### D8. Synchronization semantics

**One clock.** Lottie renders the frame for the elapsed `requestAnimationFrame` time (`setSubframe(true)`). WAAPI computes from `document.timeline` with the shared start time. Both derive from the frame timestamp, so a skipped frame advances both by the same amount, and no drift accumulates.

**Skipped frames.** Copies animate transform and opacity, which can run on the compositor. During a main-thread stall a copy may therefore lead the SVG by at most the stalled frame, and the next main-thread frame realigns them. The spike measures this with an injected 200 ms task under 4× throttling.

**Readiness.** The scene is ready when the renderer is ready (`DOMLoaded` on a loaded renderer) and the copies are attached hidden. No original is touched before start.

**Cancellation:**

- before start, it removes the copies, and no original was ever animated
- after start, it cancels the copy animations and the originals' opacity animations, and the originals show at once

Every resource is released exactly once through the session's disposer order.

### D9. The spike, the gate and its thresholds

**Scope.** The representative interaction is the one-prize path from the perch:

- the hop down to prize 0
- the nudge (contact 1), the push (contact 2) and the release
- the physical fall onto a measured starter-button support or the floor
- the rebound
- the elastic recoil

It exercises every mechanism except section selection. Because a step remap runs to the tail section, it also exercises a time remap.

**Building the spike asset.** The spike asset is bootstrapped by D10 for this segment only. It is committed as the Storybook fixture `libs/celebrations/src/stories/fixtures/cat-borrow-spike.lottie.json`.

**Running it.** The spike adapter runs through the real `LottieScene` path, behind a story-only descriptor, against the real `ConversationInput` host (D13). No capability is added to `SUPPORTED_CELEBRATION_CAPABILITIES` until the gate passes.

**Thresholds.** These are fixed before the spike runs:

| Criterion | Threshold |
| --- | --- |
| Contact | ≤ 2 CSS px at every contact marker. Checked in 16 cells: 360/390/1280/1920 px × LTR/RTL × buttons 32 px and 56 px tall, with real `ConversationInput` and starter supports |
| Landing to recoil | ≤ 1 frame (16.7 ms) of composition time, for drops of 24–600 px |
| Long task | After an injected 200 ms task under 4× throttling, contact is back within 2 px on the next frame, and the end-of-story drift is ≤ 1 frame |
| Code (non-empty, non-test lines) | Scene-specific adapter ≤ 350. Generic modules (markers, binding, time remap, track conversion, snapshot split) ≤ 450 |
| Asset | The projected full asset, three sections at the measured keyframes per second, fits 300 KiB, 30 layers, 2,000 keyframes and 8,000 vertices |
| Rendering cost (Chromium, 4×, 1280 and 390 px) | p95 frame time ≤ compiled p95 + 25 %. No scene-attributable long task > 50 ms during playback. ≤ 800 SVG elements. Heap after 20 runs within the compiled scene's delta + 1 MiB |
| Visual review | The reviewer watches at actual size and normal speed and accepts it. The review is recorded |

**Outcome.**

- **Go:** every row passes. The full migration continues (tasks section 4 onwards).
- **No-go:** any row fails.
  - Record the measurements and the failing rows here, under "Gate result", and on #9223.
  - Delete the spike adapter and its fixture. Keep the S3 carry-over and the snapshot split only if a caller uses it.
  - Leave the compiled Cat as is.
  - #9226 inherits the evidence.

### D10. Bootstrapping the asset without keeping a generator

A throwaway script runs once and is never committed. It is kept in the scratchpad.

1. It calls `buildCatPlan` with synthetic targets at reference geometry: the desktop composer at `anchorRect`, two 32 × 32 icon buttons at its bottom inline end, a starter row 40 px below and the floor at 900 px.
2. It decomposes the actor track: the station segments become `cat-root` keys with the closest cubic-Bézier easing, and the residual arcs, bob and squash become `cat-motion`.
3. It decimates every track with tolerances of 0.2 px, 0.25° and 0.01 opacity.
4. It converts the SVG parts into shape layers, with gradient fills.
5. It writes the anchor nulls, the `prize-N` tracks up to release, and the markers.

The one-prize tail comes from the plan with one target. The crossing section comes from the CSS keyframes in `HalloweenCatScene.module.scss`.

The result is reviewed in the pinned player and then becomes the authored source. That is the spike fixture first, and then `halloween-default/1.0.0/cat.<hash>.json` in the themes repository. The authoring-tool review stays with asset acceptance in #9226.

### D11. Publication, BFF and client

In the themes repository, `scripts/check-celebration-packs.mjs` validates cat-borrow scenes:

- the placement is composer-anchor and the direction is `none`
- the reserved layers are singletons with valid shapes: static anchor nulls, no spatial tangents on `cat-root`, hold keyframes on `cat-facing`, no scale on `prize-N` and no authored `tm` on `cat-rig`
- the marker grammar and order hold, every keyframe is bound, and the elastic ranges are disjoint
- the budgets hold

Then publish `halloween-default@1.0.0` (the `cat` scene and its poster) and bump the index revision with `defaults.halloween`.

The BFF needs no change. A normalizer test in `apps/chat-api/src/celebrations/tests/` asserts that a cat-borrow manifest normalizes to the same scene, and `npm run openapi:check` shows no drift. The app needs no change either: `useCelebrationPacks` already replaces known-event scenes by stable ID, with the descriptor's `maxLifetimeMs` (27,750).

### D12. `LottieScene` integration through an internal adapter seam

A second adapter would turn `LottieScene` into a switch. An internal, unexported interface keeps it generic. `PackSceneAdapter` supplies:

- its required browser APIs
- the anchors whose change ends the scene
- `prepare(data, mapping, environment)`
- `onAnimationCreated`
- `onPlaybackStarted`

`composer-outline` and `cat-borrow` implement it, and the viewport stage uses none.

- **Choosing the adapter.** `requiredCapabilities` selects it. A scene that requires both adapters is unsupported.
- **Memoisation.** The playback object stays memoised on timing, placement and adapter.
- **Composition with the existing callback.** `onPlaybackStarted` first runs the existing `setHasPlaybackStarted(true)` and then the adapter's start, so a throw there counts as a failure after playback: it renders nothing, with no poster.

**Spike integration.** Until the gate passes, `LottieScene` runs the adapter through a small inline branch, without the seam. The capability is enabled only through `PackSceneCapabilitiesContext`, an internal, unexported context whose default is empty and which only the spike story provides. `SUPPORTED_CELEBRATION_CAPABILITIES` stays unchanged. Task 4.2 replaces the branch with the seam on go, and section 8 removes both on no-go.

### D13. Real `ConversationInput` geometry and the S3 carry-over

**Real host geometry.** The new host page renders the real composer in its start-page layout with starters and passes its class names as anchors. A `type:ui` → `type:ui` import is allowed in `eslint.config.mjs`.

- **Resolution.** The library Storybook resolves `@epam/ai-dial-conversation-input`, `@epam/ai-dial-attachment-input` and `@epam/ai-dial-starter-buttons` from source through aliases in `.storybook/main.ts`. `preview.css` scans their sources and the kit's components for Tailwind, as `apps/chat` does.
- **No manifest entry.** `src/stories/**` is outside the dependency checks, so no devDependency is declared.
- **No build reference.** `implicitDependencies` negates the two story-only graph edges, so `nx sync` adds no build reference to `tsconfig.lib.json`. The library `dist` contains no import of these packages.
- **Frame capture.** Playwright's `page.screenshot()` re-applies the device metrics of a mobile-emulated context, and that cancels any playing anchored scene. The browser specs therefore capture frames through CDP `Page.captureScreenshot` (`captureFrame` in `libs/celebrations/browser-tests/storybook-harness.mjs`).

**The GiftWrapping fixtures.** The `new-year-default@1.1.1` GiftWrapping desktop and mobile assets are committed as fixtures, with their `sha256` asserted by a unit test, and replayed through anchored stories with the existing `PackStoryLoader` modes.

**The preparation benchmark.** A benchmark story calls the internal preparation functions on the live host DOM and reports the timings into the page. The browser test applies `Emulation.setCPUThrottlingRate(4)` and reads the timings. The library runtime gets no instrumentation.

### D14. Measuring what stays in code

Use the `celebration-migration-baseline` counting rule (physical and non-empty lines from git objects) and record a table:

- compiled scene-specific lines: plan 774, targets 228, animation 165, scene 171 and art 299, plus the 189-line stylesheet
- the new scene-specific adapter
- the new generic modules, counted once
- the asset size and keyframes per section

The net removal is reported as available when the compiled Cat is deleted (S7/S8). It is not claimed now.

### Recorded visual deltas (to confirm in review)

| ID | Delta | Why it is accepted |
| --- | --- | --- |
| V1 | The paw contact on buttons taller than 40 px sits lower (15.2 px above the baseline instead of 0.38·h) | Still on the edge, with no IK |
| V2 | Buttons with too little travel for the authored push are skipped instead of pushed less | The story still uses the remaining buttons |
| V3 | The elastic re-timing changes the recoil and grooming tempo by at most ±25 % | Bounded by D6 |
| V4 | The floor glow draws above a landed copy's bottom edge, because the copies sit beneath the SVG | Soft 4 px glow |
| V5 | The reduced-motion poster sits bottom center, not at 44 % | The poster is authored to match the pose |
| V6 | S3 composer eligibility (height 36–260, 12 px margins, width ≥ 240/192) is stricter than the compiled Cat's, so edge layouts get the crossing walk | Same rules as other anchored scenes |
| V7 | The mobile nudge is 4 px instead of 5 px (scaled by 0.8) | Imperceptible |
| V8 | The crossing walk uses fixed offsets from the viewport edges instead of the CSS walk's width-proportional path: visible about 4.6 s at about the compiled speed | Offsets cannot scale with the viewport width |

## Risks / Trade-offs

- **[Three sections exceed the 2,000-keyframe or 30-layer cap.]** → The spike projects the count. Artwork is shared through precompositions and tracks are decimated. If the cap is still exceeded, the gate decides: a `celebration-pack-contracts` caps delta with its own library release, or no-go. The asset is never published over a cap.
- **[A pose pops at the one-prize branch.]** → The bootstrap writes identical poses at `B` and `T`. The checker compares the rig transforms at both frames within tolerance, and the reviewer watches it at normal speed.
- **[The physical fall exceeds the elastic bound often.]** → The spike measures the drop distribution on real start-page layouts. If common layouts degrade to one prize, widen `E` in the asset (authoring) or no-go.
- **[Compositor-driven copies lead during jank.]** → Bounded by one stalled frame and measured by D9. It is not cumulative.
- **[The cat walks backwards between two buttons.]** In the two-prize story, the facing keyframes of the walk between buttons are bound to `prize-1`, so their sign follows the second button's side. When the measured walking direction differs from the authored one, the facing is wrong during the walk. → The full asset (task 5.1) either binds the walk to an anchor whose side is the measured walking direction, or the adapter derives that side from the two stand points. The browser matrix of task 6.1 covers both orders of the buttons.
- **[The prepare/start split regresses other scenes.]** → `animateCelebrationSnapshots` keeps its signature and all its callers' suites run unchanged.
- **[The Storybook dependency on conversation-input pulls in heavy code.]** → It is Storybook-only. Apply checks the library `dist` and its package dependencies.
- **[Cross-repository ordering.]** → Publishing `halloween-default@1.0.0` before Chat ships S4 is safe, because old clients do not support `interaction-cat-borrow-v1` and keep the compiled Cat.
- **[The gate fails late, after the generic work.]** → The spike comes first and is time-boxed. The generic modules it needs are small. On no-go, the cleanup is defined in D9.

## Migration Plan

1. Land the S3 carry-over (browser coverage and the preparation benchmark). It is independent and inert.
2. Run the spike and record the gate result in this document. On no-go, stop here and clean up as D9 says.
3. On go, land the library: the capability, the adapter, the seam and the snapshot split. It stays inert under `bundled`.
4. Publish `halloween-default@1.0.0` and bump the index with `defaults.halloween`.
5. In a test environment, set `UI_EVENT=halloween`, `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=halloween/cat`. Capture the evidence: normal-speed recordings, contact frames, the 20-run retention check and the rendering cost.
6. Production rollout is S8 (#9227).

**Rollback:**

- Remove `halloween/cat` from `UI_EVENT_EXTERNAL_SCENES` and bump `UI_EVENT_DELIVERY_REVISION`. The reset key changes, active playback restores and stops, and the compiled Cat plays from the next activation.
- Alternatively, remove `defaults.halloween` from the index.
- The library changes are additive and need no revert.

## Open Questions

- Where should binary evidence (recordings, contact frames) be stored durably? This is S0's open question 2. Until it is answered, follow S3: attach the evidence to a comment on #9223 and commit the summaries under this change.

## Gate result

**Decision: go, with amendments (reviewer, 2026-11-20).** The full table is in `evidence/spike.md`.

| D9 row | Result |
| --- | --- |
| Contact | ✅ max 0.13 px across 16 cells |
| Landing to recoil | ✅ ≤ 0.2 ms alignment error, for drops of about 70, 348 and about 650 px |
| Long task | ✅ ≤ 0.05 px on the next frame, no drift |
| Code | ❌ against the estimate: adapter 543 non-empty lines (> 350), generic 768 (> 450). **Amended:** the budget is accepted as measured. The adapter authors no keyframe, pose or timing, the compiled Cat's scene-specific code is about 1,530 lines, and the generic modules are shared by later borrowing scenes (#9226) |
| Asset | ❌ against the v1 caps: about 3,200 keyframes and about 370 KiB projected. **Amended:** the Lottie JSON caps rise to 512 KiB and 4,000 keyframes for every pack (`celebration-pack-contracts` delta), because the BFF applies the byte cap per media type |
| Rendering | ⚠️ frame time, long tasks and SVG count pass. Heap growth sits at the 1 MiB limit, and one extra detached SVG root remains after 20 runs. Resolved in task 6.2: the retained trees were copies of the borrowed buttons. The finished session and the stopped snapshots now release them, so detached SVG nodes stayed at 0 in the runs after that fix (`evidence/full-scene.md`). The heap comparison in the retention run uses a provisional compiled reference, and a run on the final tree is still open (tasks 6.1–6.2) |
| Preparation | ✅ p95 29.6 ms ≤ 50 ms |
| Visual review | ⏳ the reviewer chose go from the measured evidence. The sign-off on normal-speed recordings of the full scene is task 6.3 |

Sections 4–7 continue. Section 8 (no-go cleanup) does not apply.
