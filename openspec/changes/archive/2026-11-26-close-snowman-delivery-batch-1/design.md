# Design: close SnowmanDelivery batch 1

## Context

See `proposal.md` for why. This design fixes how the three open batch 1 tasks are evidenced. Facts checked during planning (2026-11-26):

| Fact | Value |
| --- | --- |
| Chat batch 1 merge | #9963, merge commit `2c6a8a83f`, 2026-11-23 |
| Chat HEAD when planned | `development` at `22a7d662e` |
| Themes #186 (delete `1.0.0`) | `d5e1775`, index revision `2026-11-23.1`, 2026-11-23 |
| Themes #187 (publish `1.2.0`) | `b170e2a`, index revision `2026-11-23.2`, 2026-11-23 |
| Later versions | #192 `1.3.0` (`2cd5702`), #194 `1.4.0` (`e596746`), #197 `1.5.1` (`900b19a`) |
| Themes `origin/development` | `57643b3`; the last index change is `900b19a`, revision `2026-11-25.3`, `defaults.new-year` = `1.5.1` |
| `new-year-default` on the index | `1.2.0`, `1.3.0`, `1.4.0`, `1.5.1` (the README's one-off four-version exception) |
| `1.5.1` scenes | `bullfinch-couriers`, `gift-wrapping`, `snowman-delivery`, `santa-history-delivery`, `polar-bears-workshop`, `snow-circus` |

The `snowman-delivery` files in `1.2.0` and `1.5.1` have the same sha256 as the Chat fixtures pinned in `libs/celebrations/src/utils/tests/copy-track-fixtures.spec.ts`:

| File | Bytes | sha256 |
| --- | --- | --- |
| desktop animation | 278,719 | `e102fb11b63505f431b2f77fb66438cc6f9374242ea23e5c16f16f19187988af` |
| mobile animation | 286,910 | `655cd2599ddb1964fc6c97033ff3d4f6fcb9ed7ffbd676b598c2de5238568f10` |
| poster | 4,362 | `9a5fcf2229c5f6db023c9c9f276f9acad5d961dbd8f46b79cd6ac1a4846dc1df` |

`new-year-default` index history on Themes `origin/development`:

| Commit | Date | Revision | Default | Versions listed |
| --- | --- | --- | --- | --- |
| `0cf4b57` | 2026-11-12 | `2026-11-06.5` | 1.0.0 | 1.0.0 |
| `aafdbd2` | 2026-11-18 | `2026-11-18.1` | 1.1.0 | 1.0.0, 1.1.0 |
| `17d8c79` | 2026-11-18 | `2026-11-18.2` | 1.1.1 | 1.0.0, 1.1.0, 1.1.1 |
| `bdd2feb` | 2026-11-20 | `2026-11-20.1` | 1.1.1 | 1.0.0, 1.1.0, 1.1.1 |
| `d5e1775` | 2026-11-23 | `2026-11-23.1` | 1.1.1 | 1.1.0, 1.1.1 |
| `b170e2a` | 2026-11-23 | `2026-11-23.2` | 1.2.0 | 1.1.0, 1.1.1, 1.2.0 |

Two more constraints shape the approach:

- **A revision change reaches an open tab only through managed configuration.** `CelebrationHost` puts `delivery.revision` into the `resetKey` that cancels a playing scene (`apps/chat/src/context/CelebrationHost.tsx`). Client config is refetched while the tab is open only when the response carries a refresh schedule (`useClientConfigRefresh`), and that happens only when the deployment publishes managed configuration. The managed keys are `ui.celebrationDelivery.mode`, `.revision`, `.externalScenes` and `.externalEvents` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`). An environment value wins over a managed one. So changing only `UI_EVENT_*` and restarting `chat-api` does not reach a tab during playback.
- **The batch 0 counting script misbuckets the copy-track files at `2c6a8a83f`.** `count-celebrations-s7.mjs` is published only in #9226 comment "Batch 0, part 2 of 8". It assigns every file outside the event folders through an explicit `RUNTIME` map written at `f585b223a`. The map ends with a catch-all `['core', /./]`, so the copy-track files (`utils/copy-track-*.ts`, `types/copy-track.ts` and others) fall into `runtime:core` without any error. (Corrected during apply; the planning draft expected an "unassigned" error.)

## Goals / Non-Goals

**Goals:**

- Every figure and outcome in the evidence names its Chat revision, its Themes revision and, for Themes, the index revision.
- The rollback run follows the protocol of "Batches stay independently reversible" with the allowlist the stand really runs.
- The count is reproducible: the exact script, its digest, its diff against the published batch 0 version, and the command.

**Non-Goals:**

- No code, pack or config change in either repository. The local stand's environment files stay out of Git.
- No retroactive fix of Themes retention history (`1.1.0` and `1.1.1` were also deleted inside their windows, by #192 and #193). They are noted as context only; batch 1 records `1.0.0`.

## Decisions

### D1. The `1.0.0` deletion is recorded as a Themes-owner waiver

Neither reading of the README "Retention" rule was met on 2026-11-23:

- The literal reading: `bdd2feb` (2026-11-20) still listed `1.0.0`, three days before #186.
- The reading in #186 and batch 1 design D13: `defaults.new-year` last named `1.0.0` before `aafdbd2` (2026-11-18), so the window ended on 2026-12-18.

The Themes owner merged #186 early and confirmed on 2026-11-26 that it was the owner's decision. `evidence/publication.md` records exactly that: the rule that was not met, the waiver, who confirmed it and when, and that #186's text ("Do not merge before 2026-12-18") was not updated.

Alternatives: claim the rule was satisfied (contradicted by the index history above); treat the reviewer's approval as the waiver (the approver is not the owner, and the owner confirmed directly).

### D2. A local stand stands in for the deployed environment

The issue owner chose a local stand (2026-11-26); no test environment is named anywhere in the repository. The stand is:

- **Themes:** `git archive 900b19a static` extracted into the session scratchpad, served by a static HTTP server on `http://localhost:8090`. Nothing is checked out or edited in the Themes repository. The served index must report revision `2026-11-25.3` and `defaults.new-year` `1.5.1`.
- **Chat:** a clean checkout of `development` at a recorded SHA that contains `2c6a8a83f` and the runtime of every `1.5.1` scene, run with `npm run start:all` and `THEMES_CONFIG_URL=http://localhost:8090`.
- **Delivery policy:** `UI_EVENT=new-year`, delivered through managed configuration (D3): mode `prefer-external`, revision `1`, external scenes `new-year/gift-wrapping,new-year/snowman-delivery,new-year/santa-history-delivery,new-year/snow-circus,new-year/bullfinch-couriers,new-year/polar-bears-workshop`. This is every scene `1.5.1` admits, a superset of the allowlist in `apps/chat-api/.env.template`.

`evidence/local-stand.md` names the stand as local, not deployed, and the portfolio delta lists a deployed-environment run among the S8 items.

Alternative: wait for a deployed environment. Rejected in `proposal.md`.

### D3. The live rollback uses managed configuration

To bump the revision during playback, the stand sets the four `ui.celebrationDelivery.*` keys through managed configuration and leaves the matching `UI_EVENT_*` variables unset, because an environment value would win. The rollback publishes the allowlist without `new-year/snowman-delivery` and revision `2`, then triggers the open tab's refresh by switching away from the tab and back during playback, so the refetch lands inside the 25 s scene (the refresh gap is 15 s, so the first trigger must come at least 15 s after the last load).

*Corrected during apply:* the published managed configuration did not list `snowman-delivery`, so the issue owner chose environment variables and a `chat-api` restart during playback; the tab's refresh came from a window `focus` event, because hiding the tab is itself a scene interrupt (`evidence/local-stand.md`).

If managed configuration cannot be published on the stand, the run falls back to environment variables, a `chat-api` restart and a page reload. Then `evidence/local-stand.md` states that rollback was observed across a reload, not during playback, and the during-playback cleanup stays an S8 item.

Alternative: environment variables only. Rejected as the primary path because the change would never reach the playing tab (Context).

### D4. Sections and recordings

- **`ledge-card`:** the start page with starter cards below the composer, desktop layout. The snowman borrows a starter card, so the rollback run happens here: the card must come back.
- **`rim`:** a conversation view with no starter cards and an empty composer, desktop layout. *Corrected during apply:* a conversation view has no gift trigger, and on the start page with the starter row hidden the adapter chose `platform`. The issue owner accepted `platform` in place of `rim` (2026-11-26); `rim` moves to S8.

Each recording is a full 25 s scene at normal speed, captured with the browser's screen recording at 1920 × 1080 in LTR. The scene is forced by gift clicks until SnowmanDelivery is chosen; the pool is random, so the number of clicks is recorded. Recordings stay out of Git; `evidence/local-stand.md` lists the file names, their sha256 and duration, and the `catalogRevision` and asset requests seen in DevTools (the desktop variant `snowman-delivery.desktop.e102fb11b63505f4.json` from `/celebrations/new-year-default/1.5.1/`).

The rollback outcome has three checks:

1. The borrowed card returns to its slot when the revision changes, and the external scene stops.
2. The next gift click picks from the remaining gift-click pool. Clicks repeat until SnowmanDelivery plays, and it plays compiled: no request for the external SnowmanDelivery asset, no `ct:` copy-track markers in play.
3. Every other allowlisted scene stays external: at least one gift-click external (`bullfinch-couriers` or `polar-bears-workshop`) and the external secret scene `gift-wrapping` are played after the rollback and load their pack assets.

### D5. Accounting uses the batch 0 script plus a published map extension

The script is copied verbatim from the #9226 comment into the session scratchpad, and its sha256 is recorded. Every production file that #9963 added outside the event folders gets an explicit `RUNTIME` entry ahead of the `core` catch-all, chosen by the rule the script already uses:

- `adapter:copy-track` for the copy-track adapter files (`utils/copy-track-*.ts`, and `copy-track*.ts` under `constants/`, `models/` and `types/`);
- `borrow-generic` for the new generic copy modules (`copy-layers`, `text-run-copy`) next to the generic modules it already names;
- files #9963 only changed keep their existing bucket, and their diff counts as generic changes.

The run uses `node count-celebrations-s7.mjs 2c6a8a83f --themes ../ai-dial-chat-themes --themes-rev b170e2a`, so the asset sizes are those of the `1.2.0` publication. The extended script's sha256, the unified diff against the published version, the command and the full output go into `evidence/accounting.md` and the #9226 comment.

The four figures are:

| Figure | Source |
| --- | --- |
| SnowmanDelivery scene-specific lines | the `scene:new-year/snowman-delivery` bucket at `2c6a8a83f` (physical and non-empty), next to 3,241 / 3,123 at `f416f8c69` from batch 1 design D14 |
| copy-track adapter | the `adapter:copy-track` bucket at `2c6a8a83f` |
| generic changes | non-empty lines added or changed in the `borrow-generic` and other `runtime:*` files between `2c6a8a83f^1` and `2c6a8a83f`, counted once (`git diff --numstat` restricted to the S0 inclusion rule) |
| assets | raw, gzip-9 and Brotli-11 bytes of the three `snowman-delivery` files at Themes `b170e2a` |

No net removal is claimed: the compiled scene stays until after S8 ("Compiled duplicates are removed only after the gate").

### D6. The register row stays `migrate`, batch 1

The decision vocabulary is fixed by "Every candidate has exactly one decision". `delivered-pilot` names a staged pilot; `retired` needs the compiled scene removed. So the row is unchanged, and the spec deltas only update the evidence and rollback scenarios (`specs/`).

### D7. The #9226 comment is a draft until approved

The draft lives at `evidence/issue-comment.md`. It carries the publication record, the local-stand outcome, the four figures and the script (in a `<details>` block, as in batch 0), each tied to its revision, plus the open S8 items. It is posted with `gh issue comment 9226 --body-file` only after the user approves the exact text. No Claude attribution.

## Risks / Trade-offs

- [The deployed Themes or Chat later differs from the local stand.] → The evidence names the stand as local and lists the deployed run as an S8 item.
- [Managed configuration is not available on the stand.] → D3 fallback, with the deviation recorded.
- [The random pool needs many clicks before SnowmanDelivery plays.] → Record the click count; no code or pool change to force it.
- [The map extension changes earlier batch 0 figures.] → Re-run the extended script at `f585b223a` and confirm the batch 0 totals are unchanged; record the check.
- [The Themes check fails on the merged tree.] → Stop and report; this change does not edit Themes.
- [The published hashes no longer equal the fixtures when the work runs.] → Stop and report, per the brief.

## Migration Plan

Not applicable: no deployable artifact changes. Reverting this change removes its evidence and its spec deltas.

## Open Questions

None. The environment and the retention waiver were resolved with the issue owner on 2026-11-26.
