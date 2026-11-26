# Proposal

## Why

The S7 (#9226) register in `celebration-migration-portfolio` covers the 20 bundled scenes of `f585b223a`, judged against Themes `bdd2feb`. Since 2026-11-23 two compiled scenes, three pack-only scenes, one external-only event and three generic adapters have landed outside the S7 batches. The register says nothing about any of them. It also says "Click and secret pools SHALL stay unchanged", which the code no longer matches. Prompt 03 (the Halloween reassessment) needs to know how many scenes justify each adapter, so this register update has to land before it.

## Problem

- **Two compiled scenes have no decision.**
  - `elf-fireworks` (#9976, `d144e4f4c`, 2026-11-24): the elf borrows an inert copy of the composer's send button.
  - `cat-bauble` (#9996, `b3e254229`, 2026-11-25): the cat borrows an inert copy of the model selector.

  Both are in `NEW_YEAR_CLICK_SCENES` (`libs/celebrations/src/new-year/constants/new-year.ts`). The user decided on 2026-11-26 that both are S7 candidates and each gets `migrate` or `retain`. Neither may be excluded.
- **ElfFireworks has no spec.** #9976 merged without an OpenSpec change. Its behaviour is described only by the code, its two test suites, a README paragraph and the PR description. CatBauble has `new-year-cat-bauble`.
- **Pack-only scenes and an event are not counted.**
  - `polar-bears-workshop` (#9973, #9990; Themes #189, #194) joins the gift-click pool when admitted. It also exists as the separate external-only event `new-year-polar-bears`.
  - `santa-history-delivery` (#9983; Themes #190, #192) and `snow-circus` (#9998; Themes #197) join the secret pool through `secretTrigger.externalSceneIds` (`libs/celebrations/src/new-year/event.tsx`).

  The register counts only `bullfinch-couriers` and `company-anniversary` apart from the candidates.
- **The pools sentence is false.** At `892cf97ef` the compiled click pool has four scenes, not two. `addCelebrationScenes` (`libs/celebrations/src/utils/celebration-descriptor-event.ts`) appends an admitted external scene to the click pool, or to the secret pool when its ID is listed in `externalSceneIds`.
- **The adapters have no justification count.** Three adapters were each released with one scene:
  - `interaction-composer-carry-v1`, with the polar bears;
  - `interaction-history-ladder-v1`, with Santa;
  - `interaction-button-props-v1`, with Snow Circus.

  The rule "an adapter is justified by at least two scenes" cannot be applied until the register says which scenes use or would use each one.

## What Changes

This change decides and documents. It migrates nothing and changes no code.

- **A dated addendum, not a rewrite.**
  - Add a 2026-11-26 addendum to the register, pinned at Chat `892cf97ef` and Themes `57643b3`.
  - Keep the 20-row baseline at `f585b223a` / `bdd2feb` and the S0 record (`1cfb11468`) as they are.
- **Two new candidate rows, each with exactly one decision.** Each row records what the scene borrows, which released adapter comes closest (`interaction-button-props-v1` for both), and what that adapter lacks. The scene-specific code size at `892cf97ef` goes in the design and the #9226 comment. Provisional decision for both rows: `retain`, `adapter-pending` (design D2). The reopen condition is the same for both. ElfFireworks and CatBauble are the two scenes that a widened button-copy adapter would serve, so that adapter's own change is where the decision gets reopened.
- **Non-candidates counted.**
  - `polar-bears-workshop`, `santa-history-delivery` and `snow-circus` are listed as external scene additions to `new-year-default`, next to `bullfinch-couriers`.
  - `new-year-polar-bears` is listed as an external-only event, next to `company-anniversary`.
  - None of them gets a decision.
- **The pools sentence replaced with what the code does.**
  - The compiled click and secret pools.
  - Admitted replacements keep their bundled ID's pool.
  - Admitted additions go to the secret pool when `externalSceneIds` lists them, and to the click pool otherwise.
  - S7 batches still change no pool.
- **Adapter justification counts.** For each of the three adapters, record the scenes that use it today (one each). Also record the scenes that would use it only after a change to the adapter, and do not count those. This is the input to prompt 03's two-scene rule.
- **A new `new-year-elf-fireworks` capability**, written from the code at `892cf97ef`. It covers:
  - the story and its beats;
  - send-button eligibility and the node limit checked before cloning;
  - the detonator, still and failure fallbacks;
  - interruption and restore;
  - the deadline against the story length;
  - the structural budgets.

  Where the code and #9976 disagree, the spec states the disagreement. Defects go to the design's open questions, not into code.
- **A draft #9226 comment** with pins, the two new rows, line counts and adapter counts. It is posted only after the user approves it, with no Claude attribution.

No **BREAKING** changes. No runtime, API, manifest, pack, label or i18n change.

## Non-goals

- Migrating ElfFireworks, CatBauble or any other scene, and designing a widened button-copy adapter.
- Changing a pool, a scene ID, a duration, a toast label, or the Themes repository.
- Reassessing baseline rows. ReindeerTakeoff stays with batch 2 (prompt 02), the Halloween rows with prompt 03 and PenguinStar with its product condition. The design records CatBauble's copied model selector as an open question for the PenguinStar row, not as a decision.
- Fixing any ElfFireworks defect the spec work finds. Those go to the open questions, and from there to #9960 or a new issue after approval.
- Cross-linking `celebration-events` to the new spec. Its scene line for `elf-fireworks` stays as it is.

## Alternatives considered

| Option | Correctness | Delivery risk | Rollback | Pick |
| --- | --- | --- | --- | --- |
| A. Leave the register as it is (baseline) | Pools sentence stays false; two candidates without a decision | None | n/a | no: the user decided the new scenes are candidates, and prompt 03 needs the counts |
| B. Rewrite the register at `892cf97ef` (22 rows, new pins) | Correct today | Medium: rewrites batch 0's evidence base and its published figures | Revert | no: the baseline and the S0 record must stay citable as pinned |
| C. Dated addendum, plus the ElfFireworks spec in the same change | Correct; baseline untouched | Low: documents and decisions only | Revert the change | **yes** |
| D. As C, with ElfFireworks or CatBauble set to `migrate` now | Assigns a batch before the adapter it needs exists or has been costed | High: commits a batch to an undesigned button-copy extension | Needs a later delta | no: D1 step 6 needs a released adapter, or one new adapter justified by cost first |

## Acceptance criteria

- The portfolio delta adds an addendum pinned at `892cf97ef` / `57643b3`, and leaves the 20-row baseline, the S0 citation and every unchanged scenario word for word as they are.
- `elf-fireworks` and `cat-bauble` each have exactly one decision with a reason code, the borrowed control, the closest adapter, what that adapter lacks, and a reopen condition.
- The three pack-only scenes and `new-year-polar-bears` are counted apart and carry no decision.
- The pools text matches `NEW_YEAR_CLICK_SCENES`, `secretTrigger.sceneIds`, `externalSceneIds` and `addCelebrationScenes` at `892cf97ef`.
- Each new adapter has its current justifying scenes listed, and potential scenes are listed apart.
- `openspec/changes/register-post-baseline-celebration-scenes/specs/new-year-elf-fireworks/spec.md` has ADDED requirements, each with at least one scenario, and cites files and symbols but no line numbers.
- `npm run validate:specs` passes with no unknown-identifier warning from the new spec. `openspec validate register-post-baseline-celebration-scenes --strict` passes.
- The #9226 comment is shown to the user and posted only after approval.

## Capabilities

### New Capabilities

- `new-year-elf-fireworks`: the bundled New Year "Elf Fireworks" scene. Covers the story, the send-button copy and its eligibility, the detonator and still fallbacks, interruption and restore, the deadline, and the rendering budgets.

### Modified Capabilities

- `celebration-migration-portfolio`:
  - "The candidate set is fixed at a pinned revision" gains the dated addendum and the new non-candidates.
  - "New Year decisions" gains the `elf-fireworks` and `cat-bauble` rows and the code-accurate pools text.
  - A new requirement records adapter justification counts.

## Impact

- **`openspec/`.** One new capability delta and one modified capability delta. `openspec/specs/**` changes only at archive.
- **Code.** None. `libs/celebrations`, `apps/chat`, `apps/chat-api` and `libs/chat-api-client` are read only. The new spec follows `openspec/specs/new-year-cat-bauble/spec.md` as its structural model. Host knowledge stays where it is: `apps/chat/src/context/CelebrationHost.tsx` supplies anchors and loaders, and the lib reads only `CelebrationAnchors`.
- **`epam/ai-dial-chat-themes`.** Read only, to pin `57643b3` and the scene list of `new-year-default@1.5.1`.
- **GitHub.** One #9226 comment, after approval. The author is the user only.
- **i18n.** No new strings. The spec cites the existing `newYear.elfFireworksToastMessage` key.
- **Rollback.** Revert the change. Nothing is deployed.
