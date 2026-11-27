# Accounting (archived batch 1 task 7.2)

Counted on 2026-11-26 from git objects, so the working tree does not affect the result. The inclusion rule is S0's (`celebration-migration-baseline`).

## Revisions

- **Chat:** `2c6a8a83f` (#9963 merge). Its first parent `dd37ad783` is the "before" side, and the batch 0 pin is `f585b223a`.
- **Themes:** `b170e2a` (#187, `new-year-default@1.2.0`, index revision `2026-11-23.2`).

## Script

- Published batch 0 script: `count-celebrations-s7.mjs` from #9226 comment "Batch 0, part 2 of 8", copied verbatim. sha256 `72013acf663c23abbec41ac994504104922d65e539bbce27d124d6d2c23c09fa`, 257 lines.
- Extended script used here: sha256 `6835af5b41bcc1a610784541b1620fdd365220cf684c9528ba3f7dd379e94ccb`.
- Command (from the Chat repository root):

  ```sh
  node count-celebrations-s7.mjs 2c6a8a83f --themes ../ai-dial-chat-themes --themes-rev b170e2a
  ```

**Why it was extended.** At `2c6a8a83f` the published script runs without error, but its `RUNTIME` map ends with `['core', /./]`. A file that no earlier entry matches therefore lands in `runtime:core` without warning. Design D5 expected an "unassigned" error instead. Run unchanged, the published script put the eight copy-track adapter files and the new generic copy modules into `runtime:core` (27 files / 3,720 / 3,557). The extension adds one bucket and widens one pattern; nothing else changes:

```diff
@@ -88,9 +88,14 @@
     /^(utils\/composer-outline-adapter|types\/composer-outline)\.ts$/,
   ],
   ['adapter:cat-borrow', /^(utils|constants|models|types)\/cat-borrow(-adapter)?\.ts$/],
+  /* S7 batch 1 (#9963): the copy-track adapter and its generic copy modules. */
   [
+    'adapter:copy-track',
+    /^(utils\/copy-track-(adapter|markers|stages)|(constants|models|types)\/copy-track|models\/copy-track-(preparation|stage))\.ts$/,
+  ],
+  [
     'borrow-generic',
-    /^(utils|models)\/(borrow-targets|lottie-markers|lottie-time-remap|lottie-track-keyframes|lottie-anchor-binding)\.ts$/,
+    /^(utils|models)\/(borrow-targets|lottie-markers|lottie-time-remap|lottie-track-keyframes|lottie-anchor-binding|copy-layers|text-run-copy)\.ts$/,
   ],
   [
     'pack-runtime',
```

**No effect on batch 0.** The extended script's output at `f585b223a` is byte-identical to the published script's output there: 184 files / 34,832 physical / 33,599 non-empty, as published in the batch 0 comment.

## Figures at `2c6a8a83f` (files / physical / non-empty)

| Figure | Value | Notes |
| --- | --- | --- |
| SnowmanDelivery scene-specific (`scene:new-year/snowman-delivery`) | 9 / 3,266 / 3,147 | Unchanged by #9963: the compiled scene stays the default and the fallback. Same at `f585b223a` and `f416f8c69` |
| Copy-track adapter (`runtime:adapter:copy-track`) | 8 / 2,168 / 2,080 | All new in #9963 |
| Generic changes, counted once | 962 non-empty lines added or changed | See the table below |
| Adapter + generic | 3,042 non-empty | — |

**SnowmanDelivery against batch 1 design D14.** D14 gave 3,241 physical and 3,123 non-empty at `f416f8c69`. The batch 0 script gives 3,266 / 3,147 there. The 25 / 24 difference is exactly `new-year/types/new-year.ts`. The script assigns that file to SnowmanDelivery because no other scene root reaches it; D14 left it out. This file uses the script's figure.

**Adapter + generic against the gate.** The batch 1 gate comment ("Batch 1 gate", 2026-11-22) measured the code row as "about 2,437 non-empty lines", on `f416f8c69` plus uncommitted work. Measured at the merge, the row is 3,042 (+605, +25 %). The two figures were taken on different trees, so the growth between the gate and the merge is not attributed file by file here. The issue owner accepted the code row as measured; this is the merged figure.

### Generic changes (`git diff dd37ad783 2c6a8a83f`)

Production files outside the SnowmanDelivery and copy-track adapter buckets. "Counted" is the number of non-empty `+` lines in `git diff -U0`.

| Bucket | File | +/− (numstat) | Counted |
| --- | --- | --- | ---: |
| borrow-generic | `utils/lottie-anchor-binding.ts` | 272 / 59 | 265 |
| borrow-generic | `utils/text-run-copy.ts` (new) | 230 / 0 | 227 |
| borrow-generic | `utils/lottie-track-keyframes.ts` | 144 / 10 | 138 |
| borrow-generic | `utils/lottie-time-remap.ts` | 102 / 1 | 96 |
| borrow-generic | `models/text-run-copy.ts` (new) | 39 / 0 | 37 |
| borrow-generic | `models/lottie-track-keyframes.ts` (new) | 33 / 0 | 30 |
| borrow-generic | `utils/copy-layers.ts` (new) | 28 / 0 | 27 |
| borrow-generic | `models/lottie-anchor-binding.ts` (new) | 20 / 0 | 19 |
| borrow-generic | `models/lottie-time-remap.ts` (new) | 20 / 0 | 18 |
| borrow-generic | `utils/lottie-markers.ts` | 18 / 0 | 16 |
| pack-runtime | `utils/pack-scene-adapter.ts` | 26 / 3 | 25 |
| pack-runtime | `utils/celebration-pack-scene.ts` | 23 / 6 | 21 |
| pack-runtime | `components/LottieScene/LottieScene.tsx` | 2 / 0 | 2 |
| pack-runtime | `types/celebration-pack.ts` | 2 / 0 | 2 |
| pack-runtime | `constants/celebration-capabilities.ts` | 1 / 0 | 1 |
| core | `utils/celebration-snapshots.ts` | 23 / 11 | 22 |
| core | `types/pack-scene.ts` | 7 / 0 | 7 |
| core | `utils/host-anchors.ts` | 2 / 1 | 2 |
| adapter:cat-borrow | `utils/cat-borrow-adapter.ts` | 7 / 5 | 7 |
| | **Total** | | **962** |

By bucket: borrow-generic 873, pack-runtime 51, core 31, cat-borrow 7.

**The `reindeer-text` move.** `new-year/utils/reindeer-text.ts` lost 188 lines (+17 / −188) when its text-run copy moved to the generic `utils/text-run-copy.ts`. So `scene:new-year/reindeer-takeoff` fell from 2,730 / 2,694 to 2,559 / 2,524 (−170 non-empty). It is a scene file, so it is not part of the generic count above.

### Totals, `dd37ad783` → `2c6a8a83f`

| Bucket | Before | After |
| --- | --- | --- |
| scene-specific (20 scenes) | 102 / 24,017 / 23,413 | 102 / 23,846 / 23,243 |
| event shell, decoration, shared art | 30 / 5,212 / 4,904 | 30 / 5,212 / 4,904 |
| runtime: core | 15 / 1,235 / 1,167 | 16 / 1,255 / 1,186 |
| runtime: pack runtime | 22 / 2,251 / 2,105 | 22 / 2,296 / 2,147 |
| runtime: `interaction-composer-outline-v1` | 2 / 171 / 158 | 2 / 171 / 158 |
| runtime: `interaction-cat-borrow-v1` | 4 / 881 / 844 | 4 / 883 / 846 |
| runtime: `interaction-copy-track-v1` | — | 8 / 2,168 / 2,080 |
| runtime: generic borrowing | 9 / 1,065 / 1,008 | 12 / 1,901 / 1,811 |
| authoring tools and generators | 0 | 0 |
| **total (S0 rule)** | **184 / 34,832 / 33,599** | **196 / 37,732 / 36,375** |

The bucket totals at `dd37ad783` equal those at `f585b223a`.

## Assets at Themes `b170e2a` (raw / gzip-9 / Brotli-11 bytes)

| File | Bytes |
| --- | --- |
| `new-year-default/1.2.0/snowman-delivery.desktop.e102fb11b63505f4.json` | 278,719 / 32,288 / 23,909 |
| `new-year-default/1.2.0/snowman-delivery.mobile.655cd2599ddb1964.json` | 286,910 / 33,844 / 24,909 |
| `new-year-default/1.2.0/snowman-delivery.poster.9a5fcf2229c5f6db.svg` | 4,362 / 1,545 / 1,396 |

The raw sizes and hashes equal the Chat fixtures (`evidence/publication.md`). A client downloads one variant plus, only on fallback, the poster.

## What is not claimed

No net removal. The compiled SnowmanDelivery (3,266 physical lines) stays until after the S8 (#9227) window ("Compiled duplicates are removed only after the gate"). Its removal change will count what it actually frees (`new-year/types/new-year.ts` may need to stay). The batch keeps the 2,168-line adapter and the generic modules, which later batches can reuse (ReindeerTakeoff's `composer-word` role).

## Published

Posted on #9226 on 2026-11-26 after the issue owner approved the draft: https://github.com/epam/ai-dial-chat/issues/9226#issuecomment-7200891051
