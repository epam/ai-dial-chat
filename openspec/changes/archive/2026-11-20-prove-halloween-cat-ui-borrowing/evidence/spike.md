# Spike evidence: one representative Cat interaction

Covers tasks 3.1–3.6. Design D9 lists the gate thresholds, and design "Gate result" records the decision.

## Reference geometry (3.1)

The real `ConversationInput` and `StarterButtons` are rendered by `libs/celebrations/src/stories/ConversationInputHostPage.tsx` at 1280 × 800:

| Element | Rect (left, top, width, height) | Descendants |
| --- | --- | --- |
| Composer `.dial-ci-wrapper` | 290, 353, 700, 114 | — |
| Add | 40 × 40 | 3 |
| Model selector | 56 × 36 | 9 |
| Send | 933, 410, 40, 40 | 4 |
| Starters `.dial-starter-buttons-list` | 32, 487, 1216, 40 | — |

At 390 × 844 the composer is 32, 375, 326, 114 and its buttons are 40 × 40, 50 × 40 and 40 × 40.

Real composer buttons are 40 px tall, not the 32 px the design assumed. The spike therefore authors the reach for a contact 0.38 × 40 = 15.2 px above the baseline. That is still below the 20 px minimum target height, so delta V1 keeps its argument.

## Spike asset (3.2)

The asset was bootstrapped once by a throwaway script (session scratchpad, not committed) from `buildCatPlan`. The input is the one-prize story at the reference geometry above: Send as the prize, side +1, no support, and a drop of 348 px to the floor. The clip covers story time 7.0–16.5 s: perch, hop down, nudge, push, release, fall, rebound, recoil and the start of grooming. It is committed as `libs/celebrations/src/stories/fixtures/cat-borrow-spike.lottie.json`, formatted by Prettier like the other Lottie fixtures.

| Measure | Value | v1 cap |
| --- | --- | --- |
| Published (minified) size | 78,208 B | 300 KiB |
| Layers (root + `cat-rig`) | 26 | 30 |
| Keyframes | 670 | 2,000 |
| Path vertices | 210 | 8,000 |
| Frame rate, length | 60 fps, 570 frames (9.5 s) | — |
| Station replay error at segment boundaries | 0.08 px | — |

**Structure.** The root holds `cat-rig` (a 4096 × 4096 precomposition, offset by 1000/1000 so that the cat stays inside the precomposition clip) and `cat-floor`. The rig contains:

- the reference nulls `anchor:perch` and `anchor:prize-0`
- the track `prize-0`
- `cat-root`, which holds the stations, with linear or exact-smoothstep easing (`cubic-bezier(1/3, 0, 2/3, 1)`)
- `cat-facing`
- `cat-motion`, which holds the residual arcs, bob and squash
- `cat-art`, which maps the 160 × 140 art at scale 0.875 around the foot point (80, 120)
- 14 art layers converted from `HalloweenCat.tsx`: 34 paths with absolute M/L/H/C/Q/Z commands, 5 gradients and 2 ellipses

The joint tracks are sampled from the compiled plan and decimated linearly. The tolerances are 0.4° for rotation, 1 % for scale, 0.1 px for pupils and 2 % for tongue opacity. The residual position uses 0.25 px and its scale 0.5 %.

**Markers (60 fps, clip-local).**

| Marker | Value |
| --- | --- |
| `cat:section:one-prize` | 0 + 570 |
| `cat:bind:perch` | 0 + 78 |
| `cat:bind:prize-0` | 78 + 492 |
| `cat:entry:0` | 156 (9.6 s) |
| `cat:contact:0` | 156, 219, 306, 369 (touch, nudge, push, release) |
| `cat:release:0` | 369 (13.15 s) |
| `cat:landing:0` | 404.39, with a 144-frame elastic range (2.4 s) |
| `cat:restore` | 510 (15.5 s, spike only; the full story restores at 23 s) |

### Keyframe density (input for the D9 asset row)

Linear decimation gives about 70 keyframes and 8.2 KB per second of acting. Cubic Hermite fitting with tangents taken from the sampled source was tried and dropped: it produced 782–853 keyframes, more than linear decimation. Blinks (90 ms), ear twitches, IK contact envelopes and the 60 ms source sampling leave no smooth spans to fit.

Projected over the full asset, about 46 s of rig time (two-prize 25 s, one-prize tail 11.85 s, crossing 9 s), that is about 3,200 keyframes and about 370 KiB. Both are above the v1 caps of 2,000 keyframes and 300 KiB. See design D9, "Asset" row.

## Adapter (3.3–3.4)

`libs/celebrations/src/utils/cat-borrow-adapter.ts` runs through the real `LottieScene`, through the inline branch and the internal `PackSceneCapabilitiesContext` (design D12). It has 14 unit tests (`libs/celebrations/src/utils/tests/cat-borrow-adapter.spec.ts`).

On the real composer, `findBorrowTargets` ranks the model selector (56 × 36) first, so the spike borrows a different button from the one the asset was authored around (Send, 40 × 40). The anchor binding retargets onto it. The story is `Packs/CatBorrowSpike`.

## Measurements (3.5–3.6)

**Capture.** `tmp/celebrations-baseline/567f111d0-wt-2ead600d/cat-borrow-spike/`, produced by `libs/celebrations/browser-tests/cat-borrow.browser.spec.mjs`. All 7 tests pass.

**Environment.** Chromium 156.0.8078.4 headless on an Apple M4 Pro under macOS 26.6.2.

**Sampling.** Paw and copy are sampled in a task after every frame. The paw is the `cat-paw` reference. The copy is the `[data-cat-prize]` wrapper with its WAAPI transform.

| D9 row | Threshold | Measured | Result |
| --- | --- | --- | --- |
| Contact | ≤ 2 CSS px at every contact marker, in 16 cells: 360/390/1280/1920 px × LTR/RTL × real and 56 px buttons | max 0.13 px (0.11 px on mobile, 0.13 px on desktop). The paw is inside the copy's height in every sample | ✅ pass |
| Landing to recoil | ≤ 1 frame (16.7 ms) | Recoil onset after the physical landing: 16.8 ms (reference drop 348 px, landing at 6,733 ms), 16.7 ms (starter-button support, landing at 6,350 ms) and 16.6 ms (long drop at 1280 × 1100, landing at 6,850 ms). Alignment error ≤ 0.2 ms | ✅ pass |
| Long task (4× CPU, 200 ms task mid-push) | contact ≤ 2 px on the next frame; drift ≤ 1 frame | 0.03, 0.02 and 0.05 px on the next 3 frames. The landing stays at 6,733 ms, the same as without the task | ✅ pass |
| Code (non-empty, non-test lines) | scene-specific adapter ≤ 350; generic ≤ 450 | The adapter alone is 543. The scene-specific total is about 760: adapter 543, types 56, constants 49, models 35, internal context 10, `LottieScene` +44, `celebration-pack-scene` +25. Generic is 768 (markers 188, binding 182, time remap 167, copy tracks 231), plus the snapshot split at +67/−20 | ❌ fail |
| Asset | projected full asset within 300 KiB, 30 layers, 2,000 keyframes and 8,000 vertices | Spike: 78,208 B, 26 layers, 670 keyframes and 210 vertices. Full asset (about 46 s of rig time at the bootstrap density of about 70 keyframes and 8.2 KB per second): about 3,200 keyframes and about 370 KiB | ❌ fail (keyframes and bytes) |
| Rendering (4× CPU) | p95 frame ≤ compiled + 25 %; no scene long task > 50 ms; ≤ 800 SVG elements; heap ≤ compiled delta + 1 MiB | p95 is 16.8 ms against the compiled 16.7–16.8 ms. There are 0 long tasks. SVG elements: 150 (390 px) and 156 (1280 px) against 70 compiled. Heap growth over 20 runs: 2.53 MB (390 px) and 2.58 MB (1280 px) against 1.55 and 1.53 MB compiled, so the delta is +0.98 and +1.05 MB against a 1.05 MB allowance. Detached SVG roots: 1, then 2 after 20 runs (0 compiled) | ⚠️ borderline: heap at the limit at 1280 px; detached SVG to investigate in 6.2 |
| Preparation (4× CPU, 20 runs, cloning included) | ≤ 50 ms | 1280 px: p50 16.7 ms, p95 29.6 ms. 390 px: p50 17.1 ms, p95 29.1 ms. p95 is the warm-up run | ✅ pass |
| Visual review | reviewer accepts at actual size and normal speed | Recordings: `videos/1280-desktop`, `videos/390-mobile`, `videos/1280-rtl`, `videos/1280-on-support` | ⏳ needs the reviewer |

**Contact frames.** Each contact marker (2.6, 3.65, 5.1 and 6.15 s) has a frame for each of the 16 cells, under `contacts/<cell>/`.

### Measurement fixes made during the spike

- Lottie hides a layer whose opacity is 0, so the first paw reference had no geometry. The reference is now opaque with a transparent fill (design D2).
- The first sampler ran in `requestAnimationFrame` before Lottie's own callback, which paired the previous frame's paw with the current frame's copy. That showed up as 3.87 px right after the long task. Sampling in a task after the frame removed the artefact.
- The first landing detector missed the bottom point of a fast fall (about 1,180 px/s), so it took the rebound's end. It now uses the first bounce.
- The heap comparison now uses growth between the first run and run 20 of the same story, because the two stories load different hosts.
