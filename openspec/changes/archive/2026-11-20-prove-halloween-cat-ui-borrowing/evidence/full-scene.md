# Full scene evidence (tasks 6.1–6.4)

This file covers the full 25 s asset (`halloween-default@1.0.0`, `cat.eaf1803ee95992a9.json`), played through the real `LottieScene` on the real `ConversationInput` (`Packs/CatBorrowSpike`, `Full*` stories). The browser specs are in `libs/celebrations/browser-tests/cat-borrow.browser.spec.mjs` (`cat-borrow full: …`). They write their numbers and contact frames to `tmp/celebrations-baseline/<captureId>/cat-borrow-full/`.

## Stories, contact and restoration (task 6.1)

The matrix covers three stories (`FullTwoButtons`, `FullOneButton`, `FullCrossing`) at 360, 390, 1280 and 1920 px, in LTR and RTL: 24 cells on the real `ConversationInput` geometry. Each cell plays to the end and asserts these points:

- **Contact:** for every button the cat borrowed, the paw sits on the copy's near edge, within its height, at every `cat:contact:<n>` marker.
- **Story:**
  - the two-button page borrows two buttons
  - the one-button page borrows only one
  - the crossing borrows none, and the cat crosses at least half the viewport
- **Facing:** the cat faces its direction of travel during the walk between the buttons (the `cat:bind:move` range). The pushing paw must be on the walking side of the rig group's center.
- **Both button orders** occur across the matrix.
- **Restoration:** afterwards no copy and no animation on an original remain, every original keeps its opacity and inline style, and the draft is unchanged.

Capture `567f111d0-wt-07027ca9`: 24/24 cells pass.

| Story | Width | Buttons borrowed | Order (LTR / RTL) | Facing share during the walk | Max contact error | Paw travel |
| --- | --- | --- | --- | --- | --- | --- |
| two | 360 | 2 | right-to-left / left-to-right | 1.00 | 0.10 px | 365 px |
| two | 390 | 2 | right-to-left / left-to-right | 1.00 | 0.10 px | 395 px |
| two | 1280 | 2 | left-to-right / right-to-left | 1.00 | 0.12 px | 1,548–1,562 px |
| two | 1920 | 2 | left-to-right / right-to-left | 1.00 | 0.12 px | 2,201 px |
| one | 360 / 390 / 1280 / 1920 | 1 in every cell | — | — | 0.10–0.12 px | — |
| crossing | 360 / 390 / 1280 / 1920 | 0 in every cell | — | — | — | 466 / 496 / 1,412 / 2,052 px |

The 2 px threshold is the spike's. On phones the composer's two trailing buttons sit on the right, so the cat works right to left in LTR. The design's risk, "The cat walks backwards", is closed: the walk is bound to the `move` anchor, and the cat faces its direction of travel in all eight two-button cells, in both orders.

Ten more cases run at 1280 px, and all pass:

| Case | Expected | Result |
| --- | --- | --- |
| Slow load (4 s, past the 2 s deadline) | poster, nothing borrowed | ✅ |
| Broken load | poster, nothing borrowed | ✅ |
| Readiness timeout | poster, nothing borrowed | ✅ An init script holds lottie's `DOMLoaded` timer for 1 s, past the 250 ms readiness deadline. The browser cannot produce this delay on demand; the test asserts that the hold took effect |
| Cancellation before the first rendered frame (during loading) | nothing inserted | ✅ |
| Cancellation mid-push (second contact + 20 ms) | page restored, originals not moved | ✅ |
| Cancellation after the release (+150 ms) | page restored | ✅ |
| Cancellation during the rebound (the last copy rising again) | page restored | ✅ |
| Cached replay | one data request, contact kept, cache unchanged | ✅ |
| Reduced motion | poster, no data request, no `lottie_light` request | ✅ |
| The static Storybook exposes the `Full*` stories | — | ✅ |

The 24-cell matrix ran before the fix described under 6.2. The ten single cases were run again after it and still pass. Task 7.3 runs the whole spec file once more.

## Local end-to-end check against locally served themes (2026-11-20)

The whole delivery path ran locally:

- **Themes:** the `ai-dial-chat-themes` branch `feat/halloween-default-cat-pack` (`static/`, local only) on `http://localhost:8090`.
- **`chat-api`:** started with `THEMES_CONFIG_URL=http://localhost:8090`, `UI_EVENT=halloween`, `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=halloween/cat`.
- **`chat`:** the Vite dev server.

The BFF served the local catalog (revision `2026-11-20.1`), `halloween-default@1.0.0` and the 215,778-byte animation.

For this check only, the compiled Cat was left out of the Halloween event, and its click pool was emptied. A temporary edit of `libs/celebrations/src/halloween/event.tsx` did this and was reverted afterwards. Every pumpkin click therefore played the pack's cat, and nothing could fall back to compiled code. The user played the scene in the app and confirmed that it works.

## Resource retention (task 6.2)

The test runs one activation and then 20 more on `FullTwoButtons` at 1280 px. Runs 1–19 are interrupted at varied phases: during loading, at the first frame, during the walk-in, mid-push and during the fall. Run 20 plays to the end. Measurements are taken after a forced collection, before (after the first activation) and after:

| Metric | Before | After 20 runs | Rule |
| --- | --- | --- | --- |
| `[data-celebration-snapshot]` in the document; originals with an animation or a changed opacity | — | 0 / 0 | 0 |
| Window and document listeners (CDP) | 27 | 27 | back to baseline |
| Pending timeouts / intervals (init-script shim) | 1 / 0 | 0 / 0 | no more than baseline |
| Renderer SVG in the stage | 0 | 0 | 0 |
| Detached SVG nodes (CDP) | 0 | 0 | no growth |
| Heap growth | — | 2.29 MB | ≤ compiled growth 1.61 MB + 1 MiB = 2.66 MB (provisional, see below) |

The compiled reference in this run is provisional. Its last run was measured 12 s into the compiled Cat's 25.5 s scene, so the scene was still playing. The test now waits the full duration (`COMPILED_CAT_MS`), but the run with that fix was stopped before it finished. The rendering-cost test below measures the heap against a settled compiled Cat, and the scene stays within the allowance there too.

**The spike's extra detached SVG is found and fixed.** Before the fix, the count grew from 2 to 4 (detached roots from 5 to 9), and the heap grew by 2.32 MB. The retained trees were not lottie's renderer. They were the copies of the borrowed buttons (their Tabler icon SVGs), the copy layer and the anchored stage. The cause had two parts:

- `createLottieSceneSession` (`utils/lottie-scene-session.ts`) kept `host`, `animation`, `context` and the preparation after it finished.
- `prepareCelebrationSnapshots` (`utils/celebration-snapshots.ts`) kept its copy and animation arrays after `stop()`.

A still-mounted `LottieScene`, and the previous one, therefore held a whole set of copies. Retention was bounded: two sets after 6 runs and after 20. Both modules now release those references when they end, as the session's contract ("then holds no resources") already stated. After the fix, the only detached node left per retained scene is the empty copy layer: one node, no SVG.

## Code accounting (task 6.4, design D14)

The counting rule is the one in `celebration-migration-baseline`:

- **Source:** `.ts`, `.tsx`, `.scss` and `.css` files under `libs/celebrations/src`.
- **Excluded:** tests, stories, test utilities, `test-setup.ts` and `vite-env.d.ts`.
- **Lines:** physical / non-empty, counted from git objects.

The change is not committed yet, so these figures come from the tree object `86260fd6` instead of a commit. That object was written from a temporary index holding the working tree. Re-run the count at the branch head once the change is committed.

| Group | Files | Physical | Non-empty |
| --- | --- | --- | --- |
| Compiled Cat at `HEAD` (`567f111d0`): plan 774, targets 228, animation 165, scene 171, art 299, stylesheet 189 | 6 | 1,826 | 1,750 |
| Compiled Cat at `86260fd6`: the targets file keeps only the compiled Cat's options, a 14-line wrapper | 6 | 1,612 | 1,540 |
| New scene-specific adapter: `utils/cat-borrow-adapter.ts` 570, `constants/cat-borrow.ts` 51, `models/cat-borrow.ts` 37, `types/cat-borrow.ts` 61 | 4 | 719 | 691 |
| New generic modules, counted once: `borrow-targets` 237, `lottie-markers` 151 + 51, `lottie-anchor-binding` 170 + 24, `lottie-time-remap` 147 + 31, `lottie-track-keyframes` 209 + 39, `pack-scene-adapter` 113 | 10 | 1,172 | 1,106 |
| Changed shared files: `LottieScene` +26/−32, `celebration-snapshots` +67/−20, `celebration-pack-scene` +15/−1, `celebration-pack` +2, `celebration-capabilities` +1 | 5 | +58 net | — |
| Library total | 170 → 184 | 32,891 → 34,626 | 31,762 → 33,404 |

`borrow-targets.ts` holds the button rules that used to live in `halloween-cat-targets.ts`. The compiled Cat and the adapter now share it, so it stays when the compiled Cat is deleted.

**Net removal available in S7/S8, not claimed now:** deleting the compiled Cat removes 1,612 physical lines (1,540 non-empty). The adapter adds 719, so the scene-specific net is −893 physical lines (−849 non-empty). The generic modules (1,172 lines) are the reusable cost of UI borrowing and of marker-driven Lottie adapters.

## Preparation of the full asset (design D9, spec "Readiness")

`Packs/PreparationBenchmark` now times `prepareCatBorrowScene` for the spike and for the shipped asset (`cat-borrow-full`, identical bytes to `cat.eaf1803ee95992a9.json`) on the two-button `ConversationInputHostPage`, under 4× CPU throttling, against the 50 ms target. It was measured after the local review fixes:

| Width | Spike p50 / p95 | Full asset p50 / p95 |
| --- | --- | --- |
| 1280 | 17.1 / 31.3 ms | 31.1 / 36.0 ms |
| 390 | 15.9 / 26.3 ms | 24.0 / 27.9 ms |

The shipped asset stays within the target at both widths.

## Rendering cost (task 6.4)

The test plays `FullTwoButtons` and the compiled Cat at 4× CPU throttling and samples frames for 24 s, then runs 20 Replays, after the reference fix in 6.2 (capture `567f111d0-wt-67aa1411`). The compiled Cat's story keeps no scene layer after its run, so its SVG count is the spike's 70.

| Width | p95 frame (scene / compiled) | Long tasks | SVG elements | Heap growth over 20 runs (scene / compiled) | Detached SVG after 20 runs | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| 390 | 16.7 / 16.7 ms | 0 | 159 | 2.90 / 2.03 MB (+0.87 MB) | 0 | p95 ≤ compiled + 25 %; no long task > 50 ms; ≤ 800 SVG; heap ≤ compiled + 1 MiB |
| 1280 | 16.8 / 16.7 ms | 0 | 160 | 2.85 / 2.12 MB (+0.74 MB) | 0 | same |

All rows pass. One earlier attempt of this test exceeded its 600 s limit without writing a result. Timing each of its steps alone gave about 37 s per story, and the next run of the unchanged test finished in 160 s, as before.

## Asset (task 6.4)

| Metric | Value | Cap |
| --- | --- | --- |
| Bytes | 215,778 (`cat.eaf1803ee95992a9.json`); poster 6,966 (`cat.poster.f395e76a1efb849e.svg`, cap 100 KiB) | 512 KiB |
| Layers | 30 | 30 |
| Keyframes | 2,540 | 4,000 |
| `two-prizes` keyframes (rig frames 0–1500) | 1,629 | — |
| `one-prize` tail keyframes (1500–2211) | 570 | — |
| `crossing` keyframes (2211–2751) | 324 | — |
| Outside the rig (floor, rig layer) | 17 | — |
