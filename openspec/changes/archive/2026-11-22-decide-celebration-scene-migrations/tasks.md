# Tasks

Slicing strategy: **vertical by deliverable**. Each group ends with something a reviewer can check on its own:

- a working summarizer (group 1)
- a confirmed register (group 2)
- published figures (group 3)
- a recorded review (group 4)

Group 3 and group 4 are independent of each other. Group 5 depends on groups 2–4. No task touches `libs/celebrations/src`, `apps/*` or a pack.

## 1. Baseline harness repair (`celebration-migration-baseline` delta, design D7)

- [x] 1.1 Add `libs/celebrations/browser-tests/summarize-baseline.spec.mjs` (`node:test`). Each case runs the summarizer as a child process, with its working directory set to a temporary folder holding a fixture `tmp/celebrations-baseline/<id>/results.json`. Cases:
  - a capture with `penguin-star`, `gift-wrapping` and `cat` prints all three environment records
  - `penguin-star` at a different fingerprint exits non-zero and names both scenes
  - a legacy capture with `sleigh` and only a top-level `environment` still summarizes
  - an unknown scene key exits non-zero
  - a capture holding both `sleigh` and `penguin-star` exits non-zero
  - Verification: `node --test libs/celebrations/browser-tests/summarize-baseline.spec.mjs` fails on every case except the legacy one before 1.2 (red)
- [x] 1.2 In `libs/celebrations/browser-tests/summarize-baseline.mjs`:
  - replace the hard-coded `SCENES` with a matrix chosen per capture: the legacy `sleigh`, `gift-wrapping`, `cat` when the capture holds `sleigh`, otherwise `penguin-star`, `gift-wrapping`, `cat` (design D7)
  - reject recorded keys outside that matrix
  - leave the `artefacts.sha256` and mixed-provenance logic unchanged
  - Verification: `node --test libs/celebrations/browser-tests/summarize-baseline.spec.mjs` passes. Then `node libs/celebrations/browser-tests/summarize-baseline.mjs 1cfb11468` on the existing local S0 capture, if present, leaves its `artefacts.sha256` byte-identical (`shasum -a 256` before and after)
- [x] 1.3 Run the files from 1.1 and 1.2 through Prettier and ESLint, and confirm that `openspec/changes/decide-celebration-scene-migrations/specs/celebration-migration-baseline/spec.md` matches `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs` (scenes, missing-composer cells for every anchor-reading scene).
  - Verification: `npm run verify:changed` passes. `grep -n sleigh libs/celebrations/browser-tests/summarize-baseline.mjs` shows only the legacy entry

## 2. Pinned inventory and register confirmation (`celebration-migration-portfolio`, design D1–D3)

- [x] 2.1 Confirm the pins and record them for the #9226 draft:
  - Chat `f585b223a` and its date, plus whether `libs/celebrations`, `apps/chat/src/context` and `apps/chat-api/src/celebrations` have local changes
  - Themes `bdd2feb`, and the hashes of `static/celebrations/new-year-default/1.1.1/manifest.json` and `static/celebrations/halloween-default/1.0.0/manifest.json`
  - resolved `lottie-web` and Playwright versions, and Node
  - Verification: every value is read with `git rev-parse`, `git show`, `npm ls` and `node -v`. None is copied from this change's text
- [x] 2.2 For each of the 20 scene IDs, write one inventory row at `f585b223a` with the S0 fields: event and ID, story, pool, `durationMs` and internal clock, renderer, anchors read, live/copied/measured interaction, reduced-motion/missing-target/unsupported-API fallback, interrupt triggers, `Math.random` sites, own production files and lines. Every cell cites a repo path and symbol, or says "unverified". Put the rows in a scratchpad draft for task 5.1 and keep them out of the repository.
  - Verification: the draft has 20 rows. Each `HalloweenScene` and `NewYearScene` member (`libs/celebrations/src/halloween/types/halloween.ts`, `libs/celebrations/src/new-year/types/new-year.ts`) appears exactly once, and the pools match `HALLOWEEN_CLICK_BURSTS`, `HALLOWEEN_SECRET_BURSTS` (`libs/celebrations/src/halloween/constants/halloween.ts`), and the New Year click pool and `secretTrigger.sceneIds` (`libs/celebrations/src/new-year/constants/new-year.ts`, `libs/celebrations/src/new-year/event.tsx`)
- [x] 2.3 Write the decoration rows separately:
  - Halloween artwork, each `HalloweenDecorBehavior` (pointer, idle, typing) and the pumpkin activation (`libs/celebrations/src/halloween/components/Halloween/HalloweenDecor.tsx`, `HalloweenCornerSpider.tsx`)
  - the New Year garland and gift (`libs/celebrations/src/new-year/components/NewYear/NewYearDecor.tsx`)
  - the comparison with `static-trigger-v1` (`libs/celebrations/src/components/StaticTriggerDecoration`)
  - Verification: every `HalloweenDecorBehavior` member has a row, and each row states whether `selection` can disable it
- [x] 2.4 Apply design D1 to every row. Where the evidence from 2.2/2.3 contradicts a row in `specs/celebration-migration-portfolio/spec.md` (decision, reason code, reopen condition, or the interactions it names), amend that delta spec and the design D2 table together.
  - Verification: `openspec validate decide-celebration-scene-migrations --strict` passes. Each scenario in "New Year decisions", "Halloween decisions" and "Decoration decisions" matches its inventory row
- [x] 2.5 List the open pilot acceptance items with their source tasks: S3 tasks 7.1 and 8.3, and S4 tasks 6.1–6.4 and 7.1–7.4, in `openspec/changes/archive/2026-11-18-externalize-gift-wrapping-composer-anchor/tasks.md` and `openspec/changes/archive/2026-11-20-prove-halloween-cat-ui-borrowing/tasks.md`. Mark which ones this change closes (the review, the recount) and which ones block S8 only.
  - Verification: the `gift-wrapping` and `cat` scenarios in the delta spec name exactly these items
- [x] 2.6 Run `npm run validate:specs`.
  - Verification: it passes, and every repo path cited in both delta specs resolves

## 3. Source and payload accounting (design D4)

- [x] 3.1 Write the counting script in the scratchpad. Do not commit it; it is published with the comment, as in S0. It reads git objects with `git ls-tree` and `git show`, applies the S0 inclusion rule, and assigns each file to the four D4 buckets through an explicit file-to-bucket map. It also measures assets in raw, gzip level 9 and Brotli quality 11 bytes, both under `libs/celebrations/src/**/assets/` and for the published pack files at Themes `bdd2feb`.
  - Verification: run at `1cfb11468` and `62b34e244` with the S0 grouping, it reproduces the published S0 totals (133 / 24,785 / 23,996 and 124 / 22,779 / 22,026)
- [x] 3.2 Run the script at `2091a9876` (S3 merged), `b367d7e7f` (S4 merged) and `f585b223a`. Report GiftWrapping and the Cat as scene-specific lines against the runtime and adapter lines each stage added, and report the authoring bucket explicitly, even when it is empty.
  - Verification: the bucket totals at each revision add up to the S0-rule total at that revision, and no file is unassigned
- [x] 3.3 Report the `@epam/ai-dial-celebrations` and `@epam/chat` chunk sizes for the `new-year`, `halloween`, `packs` and `lottie_light` chunks at `f585b223a`, separately from the file compression figures.
  - Verification: the figures come from `npm run build:quiet` at a clean `f585b223a` checkout. The draft states that file compression is not chunk size

## 4. Review of the published assets (design D6)

- [x] 4.1 Record the SHA-256 of `gift-wrapping.desktop.28260bbcf8f593a6.json`, `gift-wrapping.mobile.3d541976f665e859.json` and `cat.eaf1803ee95992a9.json` at Themes `bdd2feb`. Review each original file under "Published assets pass a pinned-player review" (revised in 4.2):
  - structural check of the JSON: layer tree and reserved slots (`composer-outline`, `composer-parcel`, `cat-rig`, `cat-root`, `cat-facing`, `prize-*`, `anchor:*`, `cat-floor`), `cat:*` markers, no expressions, masks or mattes, duration and frame rate, and the rest of the profile subset
  - browser review in the pinned `lottie_light` 5.13.0 player: continuous playback at 1×, frames at the S0 capture points (25 %, 50 %, 75 %) against the pre-rendered references, layer tree and markers
  - Verification: the review record names the browser and player version, the reviewer, each file hash (unchanged after the review) and the findings per file
- [x] 4.2 No authoring tool that imports Bodymovin 5.x was available (Glaxnimate is not in Homebrew, and its source build needs KF6 frameworks Homebrew does not ship). Draft the revised review requirement in `specs/celebration-migration-portfolio/spec.md`, and ask the user for explicit approval. Record it only after approval.
  - Verification: the spec contains the approved revision ("Published assets pass a pinned-player review", approved by the issue owner on 2026-11-22), and the approval is noted in the #9226 draft
- [x] 4.3 File any finding from 4.1 that needs an asset change as a follow-up issue against `epam/ai-dial-chat-themes`, and do not edit the pack here.
  - Verification: the #9226 draft links each follow-up, or states that there are no findings

## 5. Publication and integration checks

- [x] 5.1 Draft the #9226 comments from groups 2–4:
  - pins
  - the inventory table with the per-row decision (linking the spec, not restating it)
  - the counting script and its output
  - payload and chunk figures
  - the review record
  - the open pilot items

  Every figure carries its revision. Show the drafts to the user, and post them only after approval.
  - Verification: the user approved the drafts, and the posted comment links resolve
- [x] 5.4 Draft one follow-up issue for the out-of-scope findings of task 2.2: behaviour defects in compiled scenes and documentation drift in enum JSDoc and existing specs. Show it to the user and file it only after approval. Batch 0 fixes none of them.
  - Verification: the user approved the draft, and the #9226 comment links the filed issue
- [x] 5.2 Run `npm run spec:impact` and confirm that no spec other than the two deltas is reported for files this change touched.
  - Verification: the command output lists only `celebration-migration-baseline` for `summarize-baseline.mjs`, or nothing
- [x] 5.3 Run `npm run verify:full` once.
  - Verification: it passes, or unrelated failures are recorded with their output in the #9226 draft

## Workflow follow-up

- Archive with `opsx:archive` after review. That creates `openspec/specs/celebration-migration-portfolio/spec.md` and merges the baseline delta. Then run `npm run validate:specs`.
- Start batch 1 (`snowman-delivery`) as its own change, using the evidence protocol from the portfolio spec.
- The S4 full-scene evidence and the external Cat rollout stay with S8 (#9227).
