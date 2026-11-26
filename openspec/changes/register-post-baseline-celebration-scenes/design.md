# Design

## Context

See `proposal.md` for why this change exists. It works from this state.

**Revisions.**

| What | Revision |
| --- | --- |
| Chat `development` | `892cf97ef` (2026-11-26). Includes #9976 (`d144e4f4c`), #9983 (`8cc0829dc`), #9998 (`3b09fc36d`), #9996 (`b3e254229`) and #10023 |
| Themes `development` | `57643b3`. Holds `new-year-default` 1.2.0, 1.3.0, 1.4.0 and 1.5.1, `new-year-polar-bears@1.0.0`, `halloween-default` and `company-anniversary` |
| Baseline | `f585b223a` / `bdd2feb` (batch 0) and the S0 record `1cfb11468`, both left untouched |

**Inventory change since the baseline.**

- The Halloween enum has the same 16 members. Only its JSDoc changed, in #10023.
- `NewYearScene` grew from 4 to 6 members.
- `NEW_YEAR_CLICK_SCENES` lists `penguin-star`, `snowman-delivery`, `elf-fireworks` and `cat-bauble`.
- `secretTrigger.sceneIds` lists `gift-wrapping` and `reindeer-takeoff`. `secretTrigger.externalSceneIds` lists `santa-history-delivery` and `snow-circus`.
- `new-year-default@1.5.1` ships six scenes: `bullfinch-couriers`, `gift-wrapping`, `snowman-delivery`, `santa-history-delivery`, `polar-bears-workshop` and `snow-circus`.

**How external scenes reach the pools** (`libs/celebrations/src/utils/celebration-descriptor-event.ts`).

- `replaceCelebrationScenes` swaps a bundled scene in place and keeps its pool.
- `addCelebrationScenes` appends a new scene to the secret pool when `externalSceneIds` lists it, and to the click pool otherwise.

**The two compiled candidates** (read at `892cf97ef`).

| | `elf-fireworks` | `cat-bauble` |
| --- | --- | --- |
| Borrowed control | the composer's inline-end-most button among the first 16 (the send button), via `getElfFireworksTargets` | the model selector found through the host anchor `composerModelSelector`, via `cat-bauble-targets.ts` |
| Size and node limits | 24–120 × 24–64 px, ≤ 40 nodes; disabled allowed | 36–140 × 24–44 px, ≤ 40 nodes; disabled rejected |
| Copy track | hooked, two ±360° arcs, vertical squash 0.72–1.05, eased segments, returned to its rect | flicked, slid, hung on a drawn hook, pendulum rotation, carried by a grip, returned; eased segments, no scale |
| Measured prop | cane length computed from the button's top | grip and hook bound to the drawn fir |
| Fallback | drawn detonator, then still | drawn tangerine, then still |
| Spec | none before this change | `new-year-cat-bauble` |

**Scene-specific source at `892cf97ef`.** These are physical / non-empty lines of `.ts`/`.tsx` files, with tests and stories excluded. The tree is clean, so `HEAD` equals `892cf97ef`. These figures orient the design; the published ones come from task 2.1.

| Scene | Files | Physical | Non-empty |
| --- | --- | --- | --- |
| ElfFireworks | `utils/elf-fireworks-{animation,art,composition,targets}.ts`, `components/NewYearElfFireworks/{NewYearElfFireworks,ElfFireworksStill}.tsx` | 2,195 | 2,109 |
| CatBauble | `utils/cat-bauble-{animation,art,composition,targets}.ts`, `components/NewYearCatBauble/{NewYearCatBauble,CatBaubleStill}.tsx` | 2,303 | 2,232 |

ElfFireworks also reuses code that other scenes own, and that code is not counted above:

- the GiftWrapping master elf artwork (`assets/gift-wrapping-elves.json`, `GiftElf`) and rig (`gift-wrapping-rig.ts`);
- the SnowmanDelivery art, rig and timeline helpers.

CatBauble reuses only the SnowmanDelivery helpers.

**Released adapters next to these scenes.**

| Adapter | Spec | Admits | Used by today |
| --- | --- | --- | --- |
| `interaction-button-props-v1` | `celebration-button-props` | ≤ 2 copies on desktop and 1 on mobile; each ≤ 64 × 56 px and ≤ 40 nodes, not disabled. Picked by `findBorrowTargets`' own nearby-button choice. Position-only tracks with linear contact keys (`button-props-adapter.ts`) | `snow-circus` |
| `interaction-composer-carry-v1` | `celebration-composer-carry` | one whole-composer copy, horizontal travel | `polar-bears-workshop` |
| `interaction-history-ladder-v1` | `celebration-history-ladder` | ≤ 1 history-row copy over measured rows, with a rope fallback | `santa-history-delivery` |
| `interaction-copy-track-v1` | `celebration-copy-track` | `starter-card` and `composer-word` roles | `snowman-delivery` (batch 1) |

## Goals / Non-Goals

**Goals:**

- Give each post-baseline compiled scene a rule-derived decision that a later change can reopen only with new evidence.
- Make the pools text and the adapter counts mechanical to re-check against code.
- Give ElfFireworks a spec as strict as `new-year-cat-bauble`, but limited to what the code and its tests actually guarantee.

**Non-Goals:**

- Measuring browser cost for retained scenes. As in batch 0, that is captured only when a batch picks a scene up.
- Designing or estimating the widened button-copy adapter.

## Decisions

### D1. An addendum as ADDED requirements, not a rewrite of the baseline

The baseline requirement "The candidate set is fixed at a pinned revision" keeps its text. Its MODIFIED block changes only the "Items that are not candidates" scenario. The addendum, the pools rule and the adapter counts are new ADDED requirements. "New Year decisions" is modified only to add two rows and two scenarios, and to point at the pools requirement. Its existing scenarios are copied word for word, including the `fix-celebration-docs-drift` text of "No page button in ReindeerTakeoff".

Why:

- The baseline and its figures on #9226 stay citable as pinned.
- The ADDED requirements stay under the 500-character description limit that `--strict` enforces. Folding the addendum into the baseline description would exceed it.

Alternative: re-pin the whole register at `892cf97ef`. Rejected, because batch 0's evidence and every comment that cites `f585b223a` would silently change meaning.

### D2. Both new rows: `retain`, `adapter-pending`

Batch 0's D1 filter is applied in order:

| Step | ElfFireworks | CatBauble |
| --- | --- | --- |
| 1 delivered / 2 retired | no | no |
| 3 moves a live control | no: inert copy | no: inert copy |
| 4 needs audio | no | no |
| 5 procedural generation is the story | no: the geometry adapts the beats, but the story is authored | no |
| 6 fits a released adapter, or one new adapter cheaper than the scene code | **no released fit** (below); a new adapter is not designed or costed | **no released fit**; same |
| 7 | `retain`, `adapter-pending` | `retain`, `adapter-pending` |

What `interaction-button-props-v1` lacks for each scene. These gaps come from its spec and from `button-props-adapter.ts` (`safeTarget`, `keys`):

- **Target choice.** The adapter takes the best nearby buttons from `findBorrowTargets`. Both scenes need one named control: the end-most composer button, or the `composerModelSelector` anchor.
- **Size.** The adapter caps a copy at 64 × 56 px. The send button may be up to 120 × 64 px and the model selector up to 140 px wide.
- **Channels.** The adapter's prop tracks are position-only. ElfFireworks needs rotation and vertical scale. CatBauble needs rotation.
- **Easing.** The adapter rejects any contact key that is not linear. Both scenes generate eased segments.
- **Measured props.** The cane's length follows the measured button top, and CatBauble's grip binds to a drawn hook. The adapter binds contact offsets to measured centres only.
- **Disabled targets.** The adapter rejects them. ElfFireworks accepts a disabled send button on purpose.

No other released adapter is closer:

- copy-track copies starter cards and composer words;
- composer-carry copies the whole composer;
- history-ladder copies history rows.

Why not `migrate`: step 6 needs a released adapter, or one new adapter whose non-empty lines are smaller than the scene-specific lines it removes. A widened button-copy adapter would serve exactly these two scenes, but nobody has designed it, so its size is unknown. Batch 0 made the same call for ReindeerTakeoff: justify the adapter first, then decide the row.

Why not `cost`: neither scene has been compared with an authored asset. Calling the compiled version "cheaper" would be a claim without evidence.

Reopen condition, shared by both rows: one adapter that copies a named composer control, with rotation, vertical scale and eased segments, is justified under the cost rule. Because these two scenes are that adapter's candidates, its own change reassesses both rows.

### D3. The pools text is derived from the code, and pools are frozen for S7

"Click and secret pools SHALL stay unchanged" meant that S7 batches must not move scenes between pools. It was written when the pools were the bundled lists. The new requirement keeps that invariant and lists the pools as `new-year.ts`, `event.tsx` and `celebration-descriptor-event.ts` build them. A scene's own change (like #9996 or #9998) may still add to a pool. An S7 migration may not.

Alternative: list only the compiled pools. Rejected, because the gift-click and secret pools that users actually see include admitted external additions.

### D4. Adapter counts separate "used by" from "would serve"

A count is the number of scenes that need an adapter as released. ElfFireworks and CatBauble do not fit `interaction-button-props-v1` as released (D2), so the button-props count stays 1, with both listed as potential users of a widened version. Counting them would let prompt 03 reopen a Halloween row on an adapter that cannot carry the two scenes that supposedly justify it.

### D5. The ElfFireworks spec is written from the code and its tests

There are four sources, in order of authority:

1. the code;
2. `libs/celebrations/src/new-year/utils/tests/elf-fireworks.spec.ts`;
3. `libs/celebrations/src/new-year/components/NewYearElfFireworks/tests/NewYearElfFireworks.spec.tsx`;
4. the `ElfFireworks` README section and #9976.

Each contact tolerance and budget in the spec is the one a test asserts. The beats come from `ELF_FIREWORKS_BEATS`. Interruption comes from `useComposerInterrupts`, `observeSceneTargets` and the session. The structure follows `new-year-cat-bauble`.

Where the sources differ:

- #9976 says the gift-click pool "now has three scenes". After #9996 it has four. The spec states this as a recorded disagreement.
- #9976 describes only the send-button path and states no budgets. The detonator, still and budget requirements come from the code, the tests and the README alone.
- CatBauble's suite caps keyframes, animated properties and vector groups. ElfFireworks' suite caps none of these. The spec says so instead of inventing limits, and task 2.2 measures them for the comment.

### D6. Figures go to the comment, decisions to the spec

This follows batch 0's D5. Line counts, structural measurements and pins go into the #9226 comment, with their revisions. The spec cites where they are published.

Counting rule:

- the S0 inclusion rule with batch 0's D4 buckets;
- files that both scenes reuse from other scenes are reported as "shared, not removable", not as scene-specific.

## Risks / Trade-offs

- **[Risk] HEAD moves before archive, for example with batch 2 or another scene.** → Task 1.1 re-checks the pins. A new bundled scene after `892cf97ef` does not enter this addendum; the spec says it waits for the next one.
- **[Risk] Prompt 03 reads "two candidate scenes" as "button-props is justified".** → The counts requirement and its scenario state that potential users do not count toward the released adapter.
- **[Risk] The ElfFireworks spec freezes a defect as behaviour.** → Behaviour that looks wrong is listed under Open Questions, not in the spec text. The spec states only what the code does.
- **[Trade-off] Two rows stay `retain` even though together they could justify an adapter.** → The reopen condition names that adapter explicitly, so it is the next decision point and not a silent backlog item.

## Migration Plan

Nothing is deployed.

1. Land the two spec deltas.
2. Post the approved #9226 comment.
3. Archive, which creates `openspec/specs/new-year-elf-fireworks/spec.md` and merges the portfolio delta.

Rollback is a revert.

## Open Questions

These do not change the specs or the tasks. They go to the issue owner in the #9226 draft, and confirmed defects go to #9960 or a new issue after approval.

- **Snapshot failure cancels the whole scene.** `animateCelebrationSnapshots` calls `onStop` when the copy cannot be prepared, for example when it is oversized or `animate` throws. `startElfButton` treats any stop before the restore as an interruption, so the scene ends on its first frame instead of continuing in detonator mode. Is that intended?
- **No structural cap beyond layers, sparks and data size.** Should a later change add keyframe, animated-property and vector-group caps to the ElfFireworks suite, matching `new-year-cat-bauble`? The suite also checks the layer and data-size limits in button mode only. Its single detonator test (desktop LTR) asserts no budget. Measured at `892cf97ef` with the test fixtures' geometry, detonator mode reaches 17 of 17 layers on desktop and 145,789 of 150,000 characters on mobile, more than button mode in both cases (task 2.2 table in the #9226 draft).
- **Scan order.** `findSendButton` considers only the first 16 composer buttons in DOM order. A composer with more buttons falls back to the detonator even when the send button is eligible. Is that acceptable?
- **PenguinStar's reopen condition.** CatBauble shipped a copied model selector on 2026-11-25. Does the issue owner treat that as the product decision that reopens `penguin-star`? The register does not assume so.
