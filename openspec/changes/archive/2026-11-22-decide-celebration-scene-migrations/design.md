# Design

## Context

See `proposal.md` for why batch 0 exists. The state it works from:

- **Revisions.** Chat `development` `f585b223a` (2026-11-20) contains S3 (`2091a9876`, #9920) and S4 (`b367d7e7f`, #9956). Themes `development` `bdd2feb` contains `new-year-default@1.1.1` (#182) and `halloween-default@1.0.0` (#183). The S0 record pinned `1cfb11468` (21 scenes) and `62b34e244` (20 scenes).
- **Source at `f585b223a`** (S0 inclusion rule, by event folder, physical lines): Halloween 92 files / 19,399; New Year 40 / 9,830; shared 52 / 5,603. These are orientation figures for the design only. The published numbers come from the task 1.2 script run.
- **Renderers.**
  - Every Halloween scene except the Cat is compiled WAAPI/CSS with a per-activation plan (`libs/celebrations/src/halloween/utils/halloween-*-plan.ts`). Web also draws on a canvas.
  - The New Year scenes are Lottie compositions generated at runtime from TypeScript (`libs/celebrations/src/new-year/utils/*-composition.ts`).
  - Only the two pilots have authored pack assets.
- **Released contract.**
  - Placements: `viewport-stage-v1` and `composer-anchor-v1`.
  - Adapters: `interaction-composer-outline-v1` and `interaction-cat-borrow-v1`.
  - Decoration template: `static-trigger-v1`.
  - S4 also left generic modules that a later borrowing adapter can reuse: `libs/celebrations/src/utils/borrow-targets.ts`, `lottie-markers.ts`, `lottie-time-remap.ts`, `lottie-track-keyframes.ts`, `lottie-anchor-binding.ts`, and the prepare/start split in `celebration-snapshots.ts`.
- **Interaction survey** (from imports of `celebration-snapshots` and reads of `anchors.*`). 17 of the 18 scenes that are not pilots read host anchors or copy page elements. Train does neither: it targets the decoration's pumpkin.

## Goals / Non-Goals

**Goals:**

- A decision per candidate, derived from written rules, so a later batch cannot reopen the portfolio implicitly.
- A repeatable accounting and evidence checklist that a batch change can copy into its own tasks.
- Close the two pilot items that #9226 owns: the authoring-tool review and the merged-revision recount.

**Non-Goals:**

- Measuring browser cost for scenes that stay `retain`. Their S0-style browser cost is captured only when a batch picks them up.
- Any change to `libs/celebrations/src` or to a pack.

## Decisions

### D1. Decide by rule, not by enthusiasm

Each row gets a decision by applying these filters, in order. The first filter that matches decides:

1. Already delivered by a stage? → `delivered-pilot`.
2. Removed? → `retired`.
3. Moves a live host control? → `retain` / `live-control`. Packs may only borrow reversible copies (`celebration-ui-borrowing`).
4. Needs a capability the pack contract lacks (audio)? → `retain` / `audio`.
5. Is per-activation generation the story itself: physics over measured edges, collision against measured rows, silk over measured geometry? → `retain` / `procedural`. An asset could hold it only by relocating the generator, which #9226 rules out.
6. Fits released placements/adapters, or one new adapter smaller than the scene code it removes, with an existing compiled precedent for its clock synchronization? → `migrate`.
7. Otherwise → `retain` / `adapter-pending`.

Alternative: rank candidates by artwork value or code size alone. Rejected, because it would pick the Halloween secret scenes (large plans) whose interactions need adapters nobody has designed.

### D2. Provisional register

The register in `specs/celebration-migration-portfolio/spec.md` applies D1 to the survey above. Task 2 re-checks each row against the pinned inventory, and any change goes into the delta spec before archive.

| ID | Pool | Interaction to preserve | D1 step | Decision |
| --- | --- | --- | --- | --- |
| `penguin-star` | NY click | WAAPI on the live starter/model-selector control (`penguin-star-selector.ts`) | 3 | retain, `live-control` |
| `gift-wrapping` | NY secret | composer outline, parcel | 1 | delivered-pilot (S3) |
| `snowman-delivery` | NY click | one copied starter card, ridden and returned. Stage chosen from geometry (`SnowmanStage`). Card already started on the Lottie clock (`snowman-delivery-animation.ts`) | 6 | migrate, batch 1 |
| `reindeer-takeoff` | NY secret | ribbon drawn in the composition catches a textarea word or placeholder. An inert word copy plus a cover over the original pixels (`reindeer-text.ts`) starts on the Lottie clock, and the textarea is never touched. Drawn `ice-catch` when no word fits; walks on the composer rim | 7 | retain, `adapter-pending` |
| `cat` | HW click | two borrowed buttons | 1 | delivered-pilot (S4) |
| `train` | HW click | reads no host anchor. Hides the decoration's pumpkin `svg` while a fresh pumpkin rides. Optional soundtrack (volume 0.35, skipped under reduced motion) | 4 | retain, `audio` |
| `web` | HW click | measures up to 12 rects; silk generated on one canvas (jittered grid, corner fans, Bézier bridges) | 5 | retain, `procedural` |
| `candy` | HW click | copies nothing. Parabolic arcs computed onto measured top edges, routing around higher surfaces, 35 s multi-actor story | 5 | retain, `procedural` |
| `bowling` | HW secret | collision of the ball's circle with each history row's visible text rect along one trajectory; up to 6 rows | 5 | retain, `procedural` |
| `ghost`, `bats`, `witches`, `portal`, `ravens`, `footprints` | HW click | copies of small controls, buttons, history rows, row fragments or one starter card, each on a scene-specific track. Ghost and Ravens also animate the decoration's pumpkin | 7 | retain, `adapter-pending` |
| `skeletons` | HW click | hides the live greeting's last word with a CSS custom highlight while a re-rendered copy is carried away; skull impacts on the measured composer edge | 7 | retain, `adapter-pending` |
| `spiders`, `cauldron`, `mimic`, `mummy` | HW secret | copies of the welcome heading, composer controls, history rows or the whole composer | 7 | retain, `adapter-pending` |

Facts in this table come from the task 2.2 inventory at `f585b223a` (published with the #9226 comment).

Why SnowmanDelivery is the only `migrate` row:

- It is already Lottie.
- It borrows a single copy, and that copy is already synchronized on the Lottie clock. S4 named this as the precedent for its own copy start.
- Its scene-specific code is the largest of any scene: 3,266 physical lines at `f585b223a`. `snowman-delivery-timeline.ts` is shared with ReindeerTakeoff and is not counted in that figure.
- Its stage choice is exactly the kind of geometry rule that S3 and S4 kept in adapters.

Batch 1 still has its own gate. If the card-borrowing adapter does not beat the code it removes (D1 step 6), the row becomes `retain`.

Why ReindeerTakeoff waits, although it has the same shape (Lottie, one inert copy on the Lottie clock): one adapter should be justified by one scene first. The word copy adds a pixel cover and textarea observation that a card copy does not need. Batch 1 shows whether its adapter covers both; that is the reindeer row's reopen condition.

Why the borrowing Halloween scenes are not `migrate` now: each uses a different track shape (eyes riding copies, tongue wrapping, nest building, card contact). Making them `migrate` would mean either one adapter per scene, which costs more than the scene, or a generic copy-track adapter that has not been designed. Their shared reopen condition ("one generic copy-track adapter justified by at least two scenes") makes that the explicit next decision point instead of a silent backlog.

### D3. Decorations are split three ways

#9226 asks to judge artwork separately from controllers and activation.

- **Artwork.** `static-trigger-v1` renders one static image button. It cannot host the corner spider's poses, and it exposes no `[data-halloween-pumpkin-anchor]`, which Train hides and Ghost and Ravens animate. So Halloween artwork is `retain` / `decoration-template`.
- **Controllers** (`HalloweenDecorBehavior`). The four behaviours react to pointer proximity, a random 10–20 s timer, typing and a 60 s idle spell. Each is host-independent and switched off through `selection.disabledDecorBehaviors`. The pointer watch pose has no switch and counts as artwork. DIAL Chat passes no `selection` (`apps/chat/src/context/CelebrationHost.tsx`). A pack has no controller contract, so they are `retain` / `decoration-template`.
- **Activation.** Bundled events keep their compiled trigger buttons. External-only events already use `static-trigger-v1`.
- **New Year garland and gift** (`NewYearDecor.tsx`). These have no reactive behaviour, so moving them would only add a pack fetch for the same picture. They are `retain` / `cost`.

### D4. Accounting groups

S7 reuses the S0 inclusion rule (git objects, `.ts/.tsx/.scss/.css` under `libs/celebrations/src`, tests/stories excluded) and replaces the grouping with four buckets:

| Bucket | Contents |
| --- | --- |
| Scene-specific | files used by one scene: its component folder, `utils/<scene>-*`, its art and stills |
| Runtime and adapters | `context/`, `components/LottieScene`, `utils/lottie-*`, `utils/*-adapter.ts`, `utils/composer-*`, `utils/borrow-targets.ts`, `utils/celebration-*` and other shared runtime |
| Authoring tools and generators | composition and plan generators kept only to produce or regenerate an asset. At `f585b223a` this bucket is empty for the pilots, because their generators are still the compiled fallback. It is still reported, so a later batch cannot hide a generator in it |
| Assets | `libs/celebrations/src/**/assets/` and the published pack files, in raw, gzip (level 9) and Brotli (quality 11) bytes |

The file-to-bucket map is part of the published script, so a reviewer can contest a single assignment. The pilots are counted at `2091a9876` (S3 merged) and `b367d7e7f` (S4 merged), and again at `f585b223a`.

Alternative: count only the scene folder. Rejected: S3 and S4 both moved code into shared runtime, and the issue asks for that to be visible.

### D5. Numbers on the issue, decisions in the spec

This follows S0 (`celebration-migration-baseline`, "Revision-pinned baseline record"). Decisions are durable and reviewable in Git. Figures go stale with the next scene edit, so they live in #9226 comments that carry their revisions and the script. The user approves each comment before it is posted.

### D6. Review of the published assets

The profile requires verification in an authoring tool as well as the pinned player for assets with masks or track mattes (`celebration-lottie-authoring-profile`, "Allowed Lottie JSON subset"). The S3 and S4 archives also handed #9226 an authoring-tool review of both published assets.

- **Original plan.** Import each published file (GiftWrapping desktop and mobile `1.1.1`, Cat `1.0.0`) into an authoring tool that opens Bodymovin 5.x JSON. Check layer structure, reserved slot names, markers (Cat `cat:*`), expressions (none allowed), masks and mattes, and frame-range parity with the pinned player at the S0 capture points. Record the tool, version, file hash and findings.
- **What happened.** Glaxnimate, the open-source candidate, is not packaged for macOS in Homebrew. A source build needs seven KF6 frameworks that Homebrew does not ship either. No other authoring tool was available to the reviewer.
- **Approved revision (2026-11-22).** As the fallback required, the revised requirement was put to the issue owner, who approved it explicitly. The review is now a person watching the pinned `lottie_light` 5.13.0 player in a browser, plus a scripted structural check of the JSON. The browser page plays each original file, steps frame by frame, overlays the pre-rendered reference frames in difference mode, and lists the layer tree and markers. The structural check covers every rule of the profile subset. The authoring-tool review moves to S8 (#9227), before the external rollout.
- **Why that is enough here.** Neither asset uses masks, track mattes, expressions, effects, images or text, so the profile's own authoring-tool clause does not apply to them. What the pinned player renders is what the app ships. The remaining risk is that the source of an asset does not round-trip through an editor, and that affects the authoring workflow, not the asset users see.

### D7. Baseline harness repair

`libs/celebrations/browser-tests/summarize-baseline.mjs` hard-codes `['sleigh', 'gift-wrapping', 'cat']`. Since the harness switched to `penguin-star`, the summary drops `penguin-star` from both its table and the provenance check.

The fix chooses the matrix from the capture itself:

- A capture that holds `sleigh` is a legacy S0 capture. It uses `sleigh`, `gift-wrapping`, `cat`.
- Every other capture uses `penguin-star`, `gift-wrapping`, `cat`.

Each matrix scene that is missing from a capture still prints "No results recorded.", as before. Any recorded key outside the chosen matrix is an error rather than silently skipped. That includes a capture holding both `sleigh` and `penguin-star`. The `1cfb11468` capture still produces byte-identical output.

Alternatives:

- Take the keys from `results.json` as they are. Rejected, because a misspelled scene would then pass the provenance check unnoticed.
- Keep only the known scenes that are present. Rejected, because a partial capture would no longer show which matrix scene is missing.

## Risks / Trade-offs

- **[Risk] The register looks like "retain almost everything".** → That is the measured outcome of D1, which the issue explicitly allows. Each row carries a reopen condition. The copy-track adapter is named as the single decision that would unlock most Halloween rows.
- **[Risk] A provisional row is wrong once the inventory is pinned.** → Task 2 checks every row against `path` evidence and amends the spec before archive. A row is never left both provisional and archived.
- **[Risk] A reviewed file differs from the published one.** → The review page embeds the original bytes, never a re-export. Hashes are checked before and after.
- **[Trade-off] No authoring-tool round trip in batch 0.** → Approved by the issue owner and moved to S8 (#9227). The profile still requires an authoring tool for any asset with masks or mattes.
- **[Risk] The bucket map is contestable** (for example, `celebration-snapshots.ts` is shared by compiled scenes and adapters). → It is counted as runtime, the map is published, and S3 and S4 figures are recomputed with the same map, so the comparisons stay consistent.
- **[Trade-off] Batch 0 does not finish S4's full-scene evidence.** → Those items block S8 rollout of the external Cat, not S7's decisions. The register lists them so that they are not lost.

## Migration Plan

Nothing is deployed. The order is:

1. Land the spec delta and the summarizer fix.
2. Post the approved #9226 comments.
3. Archive.

Rollback is a revert of the change. Batch 1 starts as a separate change from the `snowman-delivery` row.

## Open Questions

- None. The reviewer had no authoring tool, and the approved revision in D6 answers the former open question.
