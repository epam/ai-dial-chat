# Tasks

Slicing strategy: **vertical by deliverable**, the same as batch 0. Each group ends with something a reviewer can check on its own:

- group 1: a confirmed register and ElfFireworks spec;
- group 2: published figures;
- group 3: the posted comment.

Group 2 depends only on group 1's pins. Group 3 depends on groups 1 and 2.

No task touches `libs/celebrations/src`, `apps/*`, a README or a pack. Scratch scripts and drafts stay in the session scratchpad and are never committed.

## 1. Register and spec confirmation (`celebration-migration-portfolio`, `new-year-elf-fireworks`; design D1–D5)

- [x] 1.1 Re-confirm the pins:
  - Chat `origin/development`, with `git rev-parse` and `git log -1 --format=%cs`;
  - Themes `origin/development` in the local `ai-dial-chat-themes` checkout;
  - the scene IDs and SHA-256 of `static/celebrations/new-year-default/1.5.1/manifest.json`;
  - the version folder of `static/celebrations/new-year-polar-bears/`.

  If Chat has moved past `892cf97ef`, check `git log 892cf97ef..origin/development -- libs/celebrations/src/new-year libs/celebrations/src/halloween/types libs/celebrations/src/utils/celebration-descriptor-event.ts`. Any new scene, pool or eligibility change is recorded under the addendum rule ("A scene added after the addendum"), not folded into this addendum.
  - Verification: every value comes from a command run in this task, not from this change's text, and the #9226 draft lists them.
- [x] 1.2 Re-check every code fact the portfolio delta and the design Context cite, against `892cf97ef`:
  - `NEW_YEAR_CLICK_SCENES` (`libs/celebrations/src/new-year/constants/new-year.ts`);
  - `secretTrigger.sceneIds` and `externalSceneIds` (`libs/celebrations/src/new-year/event.tsx`);
  - `replaceCelebrationScenes` and `addCelebrationScenes` (`libs/celebrations/src/utils/celebration-descriptor-event.ts`);
  - the send-button limits in `libs/celebrations/src/new-year/utils/elf-fireworks-targets.ts` and the selector limits in `libs/celebrations/src/new-year/utils/cat-bauble-targets.ts`;
  - the button-props limits (`safeTarget`, `keys`) in `libs/celebrations/src/utils/button-props-adapter.ts`.

  Where a fact differs, amend the delta spec and the design D2 table together.
  - Verification: `openspec validate register-post-baseline-celebration-scenes --strict` passes. Each fact in the "ElfFireworks", "CatBauble", "Compiled pools at the addendum revision" and "Counts at the addendum revision" scenarios points to a file and symbol listed in this task.
- [x] 1.3 Walk each requirement and scenario of `specs/new-year-elf-fireworks/spec.md` against its source:
  - `libs/celebrations/src/new-year/utils/elf-fireworks-{targets,composition,animation,art}.ts`;
  - `libs/celebrations/src/new-year/components/NewYearElfFireworks/{NewYearElfFireworks,ElfFireworksStill}.tsx`;
  - `libs/celebrations/src/hooks/useComposerInterrupts.ts`, `libs/celebrations/src/utils/lottie-scene-session.ts` and `libs/celebrations/src/utils/celebration-snapshots.ts`;
  - the two suites `libs/celebrations/src/new-year/utils/tests/elf-fireworks.spec.ts` and `libs/celebrations/src/new-year/components/NewYearElfFireworks/tests/NewYearElfFireworks.spec.tsx`.

  Record the source of each scenario in the scratchpad draft. Correct any statement the code does not support. Move any behaviour that looks wrong to design Open Questions rather than the spec.
  - Verification: every scenario has a recorded source. `grep -nE '\.(ts|tsx):[0-9]|#L[0-9]' openspec/changes/register-post-baseline-celebration-scenes/specs/new-year-elf-fireworks/spec.md` prints nothing. `npm run test:file -- libs/celebrations/src/new-year/utils/tests/elf-fireworks.spec.ts` and `npm run test:file -- libs/celebrations/src/new-year/components/NewYearElfFireworks/tests/NewYearElfFireworks.spec.tsx` pass unchanged, which confirms the tolerances and budgets the spec quotes.
- [x] 1.4 Check the references of both delta specs. `npm run validate:specs` scans only `openspec/specs/**`, so also run it once with both deltas copied temporarily to `openspec/specs/zz-tmp-elf/spec.md` and `openspec/specs/zz-tmp-portfolio/spec.md`, then delete the copies in the same command. Fix every missing path and every unknown-identifier warning reported for either file.
  - Verification: both runs report 0 errors, the temporary run reports no finding for `zz-tmp-*`, and `git status --porcelain` afterwards lists only `openspec/changes/register-post-baseline-celebration-scenes/`.

## 2. Source accounting and structural measurements (design D6)

- [x] 2.1 Count from git objects at the pinned Chat revision, with batch 0's counting rule and bucket map (S0 inclusion rule, D4 buckets). Use the script published with batch 0's #9226 comment, or rebuild it from batch 0 design D4 if it is not available. Run it from the scratchpad, never committed. Count:
  - ElfFireworks' and CatBauble's scene-specific files;
  - the shared files each one reuses from other scenes (`gift-wrapping-rig.ts`, `assets/gift-wrapping-elves.json`, `components/NewYearGiftWrapping/GiftWrappingArt.tsx`, `snowman-delivery-{art,rig,timeline}.ts`), reported as "shared, not removable";
  - the non-empty lines of `libs/celebrations/src/utils/button-props-adapter.ts`, as the reference size for a widened button-copy adapter.
  - Verification: physical / non-empty totals match the design Context figures (2,195 / 2,109 and 2,303 / 2,232 at `892cf97ef`), or the draft explains each difference. No file is unassigned.
- [x] 2.2 Measure the ElfFireworks composition with a throwaway script or test in the scratchpad that calls `buildElfFireworksComposition` with fixture targets. Measure desktop and mobile, LTR and RTL, in button and detonator mode. For each case record:
  - top-level layers;
  - animated properties;
  - total keyframes and the maximum per property;
  - vector groups plus drawn shapes;
  - serialized size;
  - copy keyframe count.

  These figures go into the #9226 draft as the evidence for the open question on missing caps. No limit is added to code.
  - Verification: the draft table names the Chat revision and the script, every case has all six figures, and `git status --porcelain` lists nothing outside the change folder.

## 3. Publication and integration checks

- [ ] 3.1 Draft the #9226 comment:
  - the pins from 1.1;
  - the addendum rows `elf-fireworks` and `cat-bauble` with their decision, linking the spec rather than restating it;
  - the non-candidates;
  - the pools;
  - the adapter counts (used versus potential);
  - the figures from 2.1 and 2.2 with their script;
  - the design's Open Questions for the issue owner.

  Show it to the user and post it only after approval, as the user, with no Claude attribution.
  - Verification: the user approved the draft, and the posted comment's links resolve.
- [ ] 3.2 For each open question the issue owner confirms as a defect (snapshot failure ending the scene, missing structural caps, the 16-button scan), draft a follow-up: a comment on #9960, or a new issue. Show each draft and post it only after approval. This change fixes none of them.
  - Verification: the #9226 comment links every posted follow-up, or states that none was confirmed.
- [x] 3.3 Run `npm run spec:impact` and confirm that it reports no spec for files this change touched (only `openspec/changes/**`).
  - Verification: the output lists no capability, or only ones unrelated to this change's paths, with the reason noted in the draft.
- [x] 3.4 Run `npm run verify:full` once.
  - Verification: it passes, or unrelated failures are recorded with their output in the #9226 draft.

## Workflow follow-up

- Archive with `opsx:archive` after review. That creates `openspec/specs/new-year-elf-fireworks/spec.md` and merges the portfolio delta. Then run `npm run validate:specs` and `openspec validate --specs --strict` on the two capabilities.
- Prompt 03 (`reassess-halloween-borrowing-candidates`) reads the adapter counts from the merged register.
- If the issue owner wants the widened button-copy adapter, it gets its own change, which reassesses the `elf-fireworks` and `cat-bauble` rows under their reopen condition.
