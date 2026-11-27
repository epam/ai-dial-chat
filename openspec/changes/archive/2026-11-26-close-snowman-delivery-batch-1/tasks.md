# Tasks

Slicing: risk-first. Group 1 re-proves the facts everything else stands on (published hashes, the Themes check) and stops the change if they no longer hold. Groups 2–4 each deliver one evidence file and are independent of each other after group 1. Group 5 depends on all three.

This change edits no source in either repository, so it owes no unit tests, no `verify:full` and no `build:quiet`. Group 3 is a recorded run by the issue owner on a local stand; it is the evidence the archived task 7.1 asked for, not a test of new code (design D2–D4). Recordings, the stand's environment files and the scratchpad copy of the counting script stay out of Git.

## 1. Re-verify the publication and stop on drift

- [x] 1.1 Fetch Themes and confirm that `origin/development`'s last change to `static/celebrations/index.json` is still `900b19a` (revision `2026-11-25.3`, `defaults.new-year` `1.5.1`), or record the newer commit, revision and default.
  - Verification: `git -C ../ai-dial-chat-themes log -1 --format='%h %cs' origin/development -- static/celebrations/index.json` and the `revision`/`defaults` fields of that tree's index
- [x] 1.2 Recompute the sha256 of the three `snowman-delivery` files in `new-year-default/1.2.0` and in the current default version from git objects, and compare them with the values pinned in `libs/celebrations/src/utils/tests/copy-track-fixtures.spec.ts`. If any differs, stop and report to the user; do not continue with groups 2–5.
  - Verification: `git show <rev>:<path> | shasum -a 256` for each file equals `e102fb11…88af`, `655cd259…8f10` and `9a5fcf22…c1df`, and each manifest's `bytes`/`sha256` entry matches
- [x] 1.3 Run the Themes check on a clean extract of the merged tree, without touching the Themes working tree: `git -C ../ai-dial-chat-themes archive 900b19a | tar -x -C <scratchpad>/themes-900b19a`, then `node scripts/check-celebration-packs.mjs` from that directory.
  - Verification: the check exits 0; its output (valid, warning count) is kept for 2.1. On failure, stop and report

## 2. Publication record (archived task 6.2)

- [x] 2.1 Write `evidence/publication.md` with:
  - #186 (`d5e1775`, revision `2026-11-23.1`) and #187 (`b170e2a`, revision `2026-11-23.2`), both merged 2026-11-23; #192, #194 and #197 with their merge commits and versions
  - the `1.2.0` `snowman-delivery` entry as published: `requiredCapabilities`, `composer-anchor-v1` placement with scale 0.9 desktop / 0.68 mobile, `direction: none`, `playbackDurationMs` 25,000, `maxLifetimeMs` 27,500, poster 4,000 ms
  - the hash table from 1.2 for `1.2.0` and the default version, and the Themes check result from 1.3
  - the retention outcome of design D1: the `new-year-default` index history table, that neither the literal 30-day reading nor the D13 `defaults` reading was met on 2026-11-23, that the deletion was the Themes owner's decision confirmed on 2026-11-26, and the README's current four-version exception (`1.2.0`, `1.3.0`, `1.4.0`, `1.5.1`)
  - Verification: every row names a Themes commit and index revision; `npm run validate:docs` is not required (the file is under `openspec/changes/`), but every relative link in it resolves

## 3. Local-stand recordings and rollback (archived task 7.1)

- [x] 3.1 Prepare the stand of design D2: serve `<scratchpad>/themes-900b19a/static` on `http://localhost:8090`; check out Chat `development` clean and record its SHA (it must contain `2c6a8a83f`); set `THEMES_CONFIG_URL=http://localhost:8090` and `UI_EVENT=new-year` in the local `apps/chat-api/.env.local`, and leave every `UI_EVENT_DELIVERY_*` and `UI_EVENT_EXTERNAL_*` variable unset; publish the managed `ui.celebrationDelivery.*` values of D2 (mode `prefer-external`, revision `1`, the six-scene allowlist); start with `npm run start:all`.
  - Verification: `curl -s http://localhost:8090/celebrations/index.json` reports revision `2026-11-25.3`; the client config response carries mode `prefer-external`, revision `1` and the six scenes, plus a refresh schedule (`nextRefreshAt`). If it carries no schedule, record that managed configuration is unavailable and use the D3 fallback in 3.3
- [x] 3.2 Record the `ledge-card` section and a no-copy section at normal speed (design D4): desktop, 1920 × 1080, LTR, one full 25 s scene each. Note the gift clicks needed and the request for the 1.5.1 desktop asset `new-year-default-snowman-delivery-desktop-e102fb11b63505f4`. The no-copy section is `platform`: on the start page the adapter did not choose `rim`, and the issue owner accepted `platform` in its place (2026-11-26); `rim` moves to the S8 list.
  - Verification: two recordings whose file names and sha256 are listed in `evidence/local-stand.md`, each with the external asset request and the scene still active at 24 s
- [x] 3.3 Roll back during a `ledge-card` playback (design D3): publish the allowlist without `new-year/snowman-delivery` and revision `2`, then switch away from the tab and back while the scene plays. Then click the gift until SnowmanDelivery plays again, and play one gift-click external scene (`bullfinch-couriers` or `polar-bears-workshop`) and the external `gift-wrapping` through its secret phrase.
  - Verification: recorded in `evidence/local-stand.md` against the three checks of D4 — the card returns and the external scene stops; SnowmanDelivery plays compiled with no request for its external asset; the other scenes load their pack assets. If the D3 fallback was used, the file says rollback was observed across a reload
- [x] 3.4 Write `evidence/local-stand.md`: stand description (local, not deployed), Chat SHA, Themes `900b19a` and index revision `2026-11-25.3`, the delivery values before and after rollback, the recordings, the rollback outcome, and the S8 (#9227) items still open: browser checks, contact frames, profiles, retention, preparation p95, long-task recovery, pinned-player review, normal-speed parity review against the compiled scene, and a run in a deployed environment.
  - Verification: the file satisfies the portfolio scenario "Batch 1 rollback evidence on a local stand" in `specs/celebration-migration-portfolio/spec.md`; restore the local `.env.local` and stop the static server afterwards

## 4. Accounting (archived task 7.2)

- [x] 4.1 Copy `count-celebrations-s7.mjs` verbatim from #9226 comment "Batch 0, part 2 of 8" into the scratchpad and record its sha256. Run it at `f585b223a` and confirm it reproduces the batch 0 totals published in that comment.
  - Verification: the output equals the published batch 0 figures
- [x] 4.2 Run it at `2c6a8a83f` with `--themes ../ai-dial-chat-themes --themes-rev b170e2a`. Give every production file #9963 added outside the event folders an explicit `RUNTIME` entry ahead of the `core` catch-all, per design D5 (`adapter:copy-track` for the copy-track adapter files). Re-run at `f585b223a` to prove the batch 0 totals are unchanged, then run at `2c6a8a83f` to completion.
  - Verification: the extended script exits 0 at both revisions; its sha256 and its unified diff against the published version are recorded
- [x] 4.3 Count the generic changes: non-empty lines added or changed between `2c6a8a83f^1` and `2c6a8a83f` in files outside the `scene:new-year/snowman-delivery` and `adapter:copy-track` buckets, restricted to the S0 inclusion rule, each line counted once.
  - Verification: the `git diff --numstat` command and its per-file output are in the evidence, and the total matches the sum of the listed files
- [x] 4.4 Write `evidence/accounting.md`: revisions (Chat `2c6a8a83f`, Themes `b170e2a`), the command, the script digest and diff, SnowmanDelivery's scene-specific lines (physical and non-empty) next to 3,241 / 3,123 at `f416f8c69`, the copy-track adapter lines, the generic changes, and the raw / gzip-9 / Brotli-11 bytes of the three asset files. State that no net removal is claimed before the compiled scene is removed after S8.
  - Verification: every figure carries its revision ("Measurements are published on the issue with their revisions"); the asset raw sizes equal 278,719 / 286,910 / 4,362

## 5. Register, issue comment and integration checks

- [x] 5.1 Confirm the `snowman-delivery` row in `openspec/specs/celebration-migration-portfolio/spec.md` still reads `migrate`, batch 1, and that the deltas in `specs/` match what groups 2–4 recorded (local stand, the allowlist really run). Adjust a delta only if the evidence contradicts it.
  - Verification: the delta scenarios cite only facts present in the three evidence files
- [x] 5.2 Draft `evidence/issue-comment.md` for #9226 (design D7): publication record, retention waiver, local-stand outcome, the four accounting figures with their revisions, the extended script in a `<details>` block, and the open S8 items. Show the draft to the user.
  - Verification: every figure names its Chat or Themes revision; no Claude attribution
- [x] 5.3 After the user explicitly approves the exact draft, post it with `gh issue comment 9226 --body-file openspec/changes/close-snowman-delivery-batch-1/evidence/issue-comment.md` and record the comment URL in the three evidence files.
  - Verification: `gh issue view 9226 --json comments` shows the comment with the approved body
- [x] 5.4 Run `npm run validate:specs`, `npm run spec:impact` and `openspec validate close-snowman-delivery-batch-1 --strict`.
  - Verification: the first and last pass; `spec:impact` reports nothing new for this change, or each report is explained in the PR description

## Workflow follow-up

- Commit the change on its own branch (not `development`) and open the PR only when the user asks; no Claude attribution in commits or PR text.
- Archive the change after review, which syncs the two deltas into `openspec/specs/celebration-migration-portfolio/spec.md` and `openspec/specs/new-year-snowman-delivery/spec.md`.
