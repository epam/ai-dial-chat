# Proposal: close SnowmanDelivery batch 1

## Why

S7 (#9226) batch 1 migrated the New Year `snowman-delivery` scene to the pack contract through the generic `interaction-copy-track-v1` adapter. Its change, `openspec/changes/archive/2026-11-23-migrate-snowman-delivery-copy-track/`, was archived with three tasks open on purpose: 6.2 (Themes publication), 7.1 (deployed evidence and rollback) and 7.2 (accounting). Without them the batch has no recorded publication, no rollback evidence and no published cost, and the portfolio register cannot move on to the next batch with confidence.

The work is unblocked now:

- Chat #9963 merged on 2026-11-23 (merge commit `2c6a8a83f`).
- Themes #186 deleted `new-year-default@1.0.0` and #187 published `1.2.0` with `snowman-delivery`, both merged on 2026-11-23, earlier than the 2026-12-18 date in batch 1 design D13.
- `new-year-default` has since moved to `1.3.0` (#192, Santa), `1.4.0` (#194, polar bears in the gift pool) and `1.5.1` (#197, Snow Circus, the default at index revision `2026-11-25.3`, Themes `900b19a`). So the rollback check must keep more external scenes than the archived task named.

## Problem

- **6.2 already happened, but its evidence does not exist.** Nothing records that the published hashes equal the Chat fixtures, or which retention rule allowed the early deletion of `1.0.0`. Tracing `static/celebrations/index.json` on Themes `origin/development` shows that `bdd2feb` (revision `2026-11-20.1`, 2026-11-20) still listed `1.0.0`, and `defaults.new-year` left `1.0.0` only in `aafdbd2` (2026-11-18). Neither reading of the README "Retention" rule (no index revision from the last 30 days names the version) was satisfied on 2026-11-23, and #186 itself says "Do not merge before 2026-12-18". The deletion was the Themes owner's decision; no PR comment records it.
- **7.1 has no environment.** No test environment is named anywhere in the repository. The issue owner chose a local stand for this change (2026-11-26). The archived task's wording also predates the four external scenes that now sit next to `gift-wrapping`.
- **7.2 has no figures.** The batch 0 counting script (`count-celebrations-s7.mjs`) lives only in #9226 comment "Batch 0, part 2 of 8"; it has not been run at the batch 1 merge revision.

## Solution

Carry the three tasks in this change, without reopening or editing the archived change:

1. **Publication record (6.2).** Verify the Themes publication on the merged tree and record it in `evidence/publication.md`: the merge commits, the index revisions, the placement in `1.2.0`, and the sha256 of the three `snowman-delivery` files in `1.2.0` and `1.5.1`. Both already equal the Chat fixtures pinned in `libs/celebrations/src/utils/tests/copy-track-fixtures.spec.ts` (checked during planning on Themes `900b19a`). Record the `1.0.0` deletion as a Themes-owner waiver, confirmed by the owner on 2026-11-26, and state that neither retention reading was met.
2. **Local-stand rollback evidence (7.1).** Serve the merged Themes tree at `900b19a` locally, run Chat at a named revision with `UI_EVENT=new-year`, `UI_EVENT_DELIVERY_MODE=prefer-external` and every external New Year scene `1.5.1` admits. Record normal-speed playback of the `ledge-card` section and a section with no copied card (`platform`, accepted in place of `rim` during apply), then roll back SnowmanDelivery alone during playback. Record the result in `evidence/local-stand.md`, and state that a deployed-environment run remains an S8 (#9227) item.
3. **Accounting (7.2).** Run the batch 0 counting script at `2c6a8a83f` and record SnowmanDelivery's scene-specific lines, the copy-track adapter, the generic changes and the asset raw / gzip / Brotli sizes in `evidence/accounting.md`, with the exact command, the script digest and both revisions.
4. **Register and issue.** Keep the `snowman-delivery` row at `migrate`, batch 1. Amend the batch 1 evidence and rollback scenarios so they name the local stand and every other external New Year scene. Draft the #9226 comment; post it only after the user approves the draft.

### Alternatives considered

- **Wait for a deployed test environment** (the archived task's wording). Rejected: none is named or available to the issue owner now, and the batch would stay open until S8 anyway. The local stand runs the same BFF and the same merged Themes tree; only the hosting differs, and that difference is recorded.
- **Change the `snowman-delivery` decision** (for example to `delivered-pilot`). Rejected: `delivered-pilot` names a staged pilot with open acceptance items (S3, S4), and "Every candidate has exactly one decision" fixes the vocabulary. `migrate`, batch 1, stays true until the compiled duplicate is removed after S8 ("Compiled duplicates are removed only after the gate").
- **Record the `1.0.0` deletion as satisfying the retention rule.** Rejected: the index history disproves it. Recording the waiver is the honest outcome.

## Non-goals

- No change to Chat source, Themes packs, pools, adapters or the compiled scene. The Themes check runs read-only on the merged tree.
- No browser evidence beyond the local-stand recordings and the rollback run. The S8 items (browser checks, contact frames, profiles, retention, preparation p95, long-task recovery, pinned-player review, a deployed-environment run) are listed in the evidence, not executed.
- No retention change for the four-version exception in Themes (`1.2.0`, `1.3.0`, `1.4.0`, `1.5.1`).
- No edit to the archived batch 1 change.

## Acceptance criteria

- `evidence/publication.md`, `evidence/local-stand.md` and `evidence/accounting.md` exist under this change, and every figure names its Chat and Themes revision.
- The published `snowman-delivery` hashes in `1.2.0` and in the default version equal the Chat fixtures, or the work stops and reports the difference.
- The rollback run shows the borrowed card restored, the next gift click picking from the remaining pool with SnowmanDelivery compiled, and every other allowlisted external scene still external.
- `node scripts/check-celebration-packs.mjs` passes on the merged Themes tree; `npm run validate:specs` and `openspec validate close-snowman-delivery-batch-1 --strict` pass.
- The #9226 comment draft exists and is posted only after explicit user approval, without Claude attribution.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `celebration-migration-portfolio`: "Every migration batch produces the same evidence" records that batch 1's rollback evidence comes from a local stand serving the merged Themes tree, with the deployed run left to S8; "Batches stay independently reversible" names every other allowlisted external New Year scene, not only GiftWrapping.
- `new-year-snowman-delivery`: "The external SnowmanDelivery is reversible on its own" names every other allowlisted external New Year scene in its rollback scenario.

## Impact

- **Files:** only `openspec/changes/close-snowman-delivery-batch-1/**` (artifacts and evidence). The spec deltas reach `openspec/specs/**` at archive.
- **Code, APIs, dependencies, i18n:** none. No user-visible string is added. No lib is touched, so library isolation is unaffected.
- **External:** one #9226 comment, after approval. Themes is read only.
- **Rollback:** the change is documentation and evidence only; reverting it removes the evidence and leaves the register at its current text.
