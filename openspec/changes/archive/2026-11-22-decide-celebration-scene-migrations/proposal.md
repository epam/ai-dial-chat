# Proposal

## Why

S7 (#9226) asks for an explicit migrate-or-retain decision for every remaining bundled celebration scene and reactive decoration, before any further scene moves into a pack. The infrastructure needed for that decision now exists. S2 delivers packs. S3 (#9222, merged in #9920) released `composer-anchor-v1` and `interaction-composer-outline-v1` with GiftWrapping. S4 (#9223, merged in #9956) passed its gate "go, with amendments" and released `interaction-cat-borrow-v1` with the Cat.

What is missing is the decision itself:

- No record says which of the 20 scenes should migrate, which should stay compiled, or why.
- Both pilots were archived with acceptance work still open. The S3 authoring-tool review and the code table (S3 tasks 7.1, 8.3) and the S4 full-scene evidence (S4 tasks 6.1–6.4, 7.1–7.4) are unchecked. The S4 archive explicitly hands the authoring-tool review and the merged-revision code accounting to #9226.
- The S0 baseline still describes a scene that no longer exists. `celebration-migration-baseline` names `sleigh` in its browser matrix, and `libs/celebrations/browser-tests/summarize-baseline.mjs:21` still lists `sleigh`. The harness itself already moved to `penguin-star` (`libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs:47`). Snow, Confetti and Sleigh were removed in #9631.

Without a decision record, each later migration would re-argue the whole portfolio, and "retain" (the issue explicitly accepts it) would never be written down as a valid result.

## Problem

- **The inventory differs from the plan.** The bundled inventory at `development` `f585b223a` has 20 scenes. That is 16 Halloween scenes (11 in the pumpkin click pool, 5 in the secret pool, `libs/celebrations/src/halloween/constants/halloween.ts:80`, `:95`) and 4 New Year scenes (`penguin-star` and `snowman-delivery` on gift click, `libs/celebrations/src/new-year/constants/new-year.ts:12`; `gift-wrapping` and `reindeer-takeoff` secret, `libs/celebrations/src/new-year/event.tsx:38`). The S0 record pinned 21 scenes at `1cfb11468` and must not be overwritten.
- **Almost every scene borrows host UI.** Of the 18 scenes that are not pilots, 17 read host anchors or copy page elements (`animateCelebrationSnapshots`, `libs/celebrations/src/utils/celebration-snapshots.ts`). The exception is Train, which boards the decoration's own pumpkin (`[data-halloween-pumpkin-anchor]`, `libs/celebrations/src/halloween/utils/halloween-train.ts`) and has an optional soundtrack. `penguin-star` moves a live control rather than a copy (`libs/celebrations/src/new-year/utils/penguin-star-selector.ts`). The only released borrowing adapter is Cat-specific. So "migrate" is not free: each candidate either fits a released adapter or needs a new one, and that adapter has to cost less than the code it replaces.
- **No evidence rule for batches.** S0 defined counting for the library as a whole, by event folder. S7 must count retained runtime and adapters, authoring tools and generators, and assets separately. The issue also asks for a recount of GiftWrapping at the merged revision rather than the provisional S3 estimate.
- **The review requirement is unmet.** `celebration-lottie-authoring-profile` makes "verification in the authoring tool" mandatory in addition to the pinned player. Neither published asset (`new-year-default@1.1.1` GiftWrapping, `halloween-default@1.0.0` Cat) has had that review. Pinned-player renders do not count as one.

## What Changes

This is **batch 0** of S7. It decides; it migrates nothing.

- **Pin the revisions.** Chat `development` `f585b223a` (2026-11-20, includes #9920 and #9956), and `epam/ai-dial-chat-themes` `development` `bdd2feb` (includes #181, #182, #183). The S0 record (`1cfb11468`, `62b34e244`) is cited, never replaced.
- **Inventory every candidate at the pinned revision.** One row per scene ID and per decoration behaviour. Each row records story, pool, renderer, own production lines, assets, timing, anchors, live/copied interaction, fallbacks and interrupts. Delivered pilots, retired scenes, external additions (`bullfinch-couriers`) and external-only events (`company-anniversary`) are listed apart and never counted as candidates.
- **Decide each candidate, with one of four outcomes:** `delivered-pilot`, `migrate` (assigned to a numbered batch with its own change), `retain` (with a reason code and the condition that would reopen it), or `retired`. The rules are explicit: migrate only when the story fits released placements and adapters, or a new adapter costs less than the scene code it removes. The default is `retain`.
- **Commit the decisions; publish the numbers.** Decisions and their reasons go into a new `celebration-migration-portfolio` spec. Revision-pinned sizes, payloads and browser measurements go into #9226 comments, as S0 did, because they go stale with the next scene edit.
- **Define the per-batch evidence protocol** that every later migration change must meet:
  - named-revision source counts that separate retained runtime/adapters, authoring tools/generators and assets
  - compressed payload
  - browser cost
  - mobile/desktop, RTL, reduced motion, missing targets, replay and interruption
  - full playback assessed at normal speed, separately from still frames, geometry tests and performance figures
  - per-scene disablement through `UI_EVENT_EXTERNAL_SCENES` with the compiled fallback kept
- **Close the authoring-tool review** of both published assets in an authoring tool, and record the tool, its version and the findings. If no suitable tool can open them, propose a revised review requirement and get it explicitly approved instead.
- **Recount both pilots at the merged revision**, with the S0 counting rule plus the S7 grouping. This closes S3 task 8.3 and S4 task 6.4's code accounting.
- **Repair the S0 baseline drift.** Bring `celebration-migration-baseline` and `summarize-baseline.mjs` in line with the harness (`penguin-star` instead of the removed `sleigh`). Allow S7 batches to write comparison captures alongside S1–S4.

There are no **BREAKING** changes, and no runtime, API, manifest or pack changes.

## Non-goals

- Migrating any scene. Each `migrate` row becomes its own change, and each batch stays independently reversible.
- Designing or releasing a new interaction adapter. Batch 0 only states when one would be justified.
- Removing a compiled duplicate. That waits for the fallback contract, public references and the S8 (#9227) compatibility and rollback window.
- Finishing the S4 full-scene evidence (S4 tasks 6.1–6.3, 7.1–7.4) or the external Cat rollout. Batch 0 records them as open pilot acceptance items that block S8, not S7.
- Product changes to a story, such as letting PenguinStar copy a control instead of moving it.
- Audio in packs. The Train soundtrack has no pack contract.

## Alternatives considered

| Option | Correctness | Delivery risk | Rollback | Pick |
| --- | --- | --- | --- | --- |
| A. Keep everything compiled, write nothing (baseline) | Correct today | None | n/a | no: the issue requires a documented decision per candidate |
| B. Migrate all remaining scenes to Lottie | Breaks stories that move live controls or need audio, and needs a new adapter per borrowing pattern | Very high: about 14 adapters' worth of work | Hard | no: the issue says 100 % conversion is not required |
| C. Decide and migrate the first batch in one change | Mixes a portfolio decision with one scene's adapter design | Medium: one large change, crosses into the themes repository | Batches no longer independently archivable | no: rejected in scoping |
| D. Batch 0: inventory, rule-based decisions in a spec, numbers on the issue, evidence protocol, review closure | Durable decisions, no stale numbers in Git | Low: planning, tooling fix and evidence only | Revert the spec and the script change | **yes** |

D gives later batches a fixed checklist and turns `retain` into a recorded, valid outcome.

## Acceptance criteria

- Every one of the 20 bundled scene IDs and every reactive decoration behaviour has exactly one recorded decision with its reason. Delivered pilots and retired scenes are identified separately, and external additions and external-only events are counted apart.
- Each `migrate` row names its batch, the placement and adapters it needs, and the evidence its change must produce. Each `retain` row names a reason code and a reopen condition.
- The #9226 comments pin both revisions and state the counting script. The source-size comparison separates runtime/adapters, authoring tools/generators and assets, and recounts GiftWrapping and the Cat at the merged revision.
- The authoring-tool review of both published assets is recorded, or a revised requirement is approved and documented.
- `summarize-baseline.mjs` no longer lists `sleigh`, and `celebration-migration-baseline` matches the harness.
- `npm run validate:specs` passes.

## Capabilities

### New Capabilities

- `celebration-migration-portfolio`: the S7 decision register for bundled scenes and decorations: candidate set, decision outcomes and rules, the per-batch evidence protocol, duplicate-removal gate, published-asset review and host-boundary invariants.

### Modified Capabilities

- `celebration-migration-baseline`: the browser matrix names `penguin-star` instead of the removed `sleigh`, and S7 batches may write comparison captures under the same rules as S1–S4.

## Impact

- **`openspec/`.** New spec delta and an amended baseline delta.
- **`libs/celebrations/browser-tests/summarize-baseline.mjs`.** The scene list matches the harness. This is dev tooling only and does not touch the published package.
- **`libs/celebrations` runtime, `apps/chat`, `apps/chat-api`, `libs/chat-api-client`.** No change. Host policy stays in `apps/chat/src/context/CelebrationHost.tsx` and `useCelebrationPacks`. The library keeps receiving only anchors, loaders and descriptors.
- **`epam/ai-dial-chat-themes`.** Read only: the pinned revision and the assets under review.
- **GitHub.** Evidence comments on #9226, posted only after the user approves the drafts.
- **i18n.** No new user-visible strings.
- **Rollback.** Revert the change: the spec and the one-line script fix. Nothing is deployed.
