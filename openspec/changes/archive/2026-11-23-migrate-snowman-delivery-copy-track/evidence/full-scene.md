# Full scene evidence (tasks 5.1–5.4)

This file covers the full SnowmanDelivery copy-track asset, desktop and mobile variants, measured **on data only**. No browser run was made (issue owner, 2026-11-22). The adapter prepares the committed fixtures in jsdom against synthetic hosts, and the tests evaluate the prepared Lottie properties at the marker frames.

## Revisions

- Chat: `f416f8c69` with the uncommitted working tree of this change (2026-11-23).
- Fixtures under `libs/celebrations/src/stories/fixtures/`. The sha256 values are pinned in `copy-track-fixtures.spec.ts`:

| File | Bytes | sha256 |
| --- | --- | --- |
| `copy-track-snowman.desktop.lottie.json` | 278,719 | `e102fb11b63505f431b2f77fb66438cc6f9374242ea23e5c16f16f19187988af` |
| `copy-track-snowman.mobile.lottie.json` | 286,910 | `655cd2599ddb1964fc6c97033ff3d4f6fcb9ed7ffbd676b598c2de5238568f10` |
| `copy-track-snowman.poster.svg` | 4,362 | `9a5fcf2229c5f6db023c9c9f276f9acad5d961dbd8f46b79cd6ac1a4846dc1df` |

The variants were bootstrapped once by the throwaway script of design D11, which stays in the session scratchpad and is not committed.

## Structural check (task 5.1)

| Variant | Bytes | Keyframes | Layers | Vertices | Sections | Fills |
| --- | --- | --- | --- | --- | --- | --- |
| desktop | 278,719 | 3,021 | 46 | 219 | `ledge-card`, `rim-card`, `rim`, `platform` | `rim-card` pickup and slot return; `rim`/`platform` story |
| mobile | 286,910 | 3,137 | 46 | 219 | same | same |

- Both variants are within the caps: 512 KiB, 48 layers, 4,000 keyframes, 8,000 vertices. The poster is 4,362 bytes against 100 KiB.
- Both parse under the `ct:` grammar (`readCopyTrackMarkers`). The worst exact-slicing error of a fill is 1.7e-8 units.
- At each cycle boundary the root, the feet, the card and the sled close to 0.00 units.
- The layers are shape, null and precomposition only. Partly visible art (the flying head, the held present) is held by opacity keys instead of being copied (design D2).
- Section overrides: six `anchor:*#rim,platform` references, `ct-follow:span-end#rim,platform` and `ct-travel#rim,platform`.

## Gate on data (task 5.3)

`libs/celebrations/src/utils/tests/copy-track-gate.spec.ts`: **304 passed, 16 skipped**. The 16 skipped are the metric checks of the four cells where the poster is expected.

**Cells (64).** Each variant runs at four widths in LTR and RTL, once per section host (`ledge-card`, `rim-card`, `rim`, `platform`):

- desktop (scale 0.9): 1024, 1280, 1440 and 1920 px
- mobile (scale 0.68): 360, 390, 600 and 900 px

| Check | Threshold | Result |
| --- | --- | --- |
| Stage choice against `getSnowmanDeliveryTargets` on the same host | the section of the compiled stage | ✅ in 56 cells. The 8 V9 cells (360 and 390 px × LTR/RTL × two card hosts) are recorded exceptions: a card host below the composer plays `rim` where the compiled scene plays `ledge`, and a card host above it shows the poster where the compiled scene plays `rim` (390 px) or its still (360 px) |
| Contact pairs | ≤ 2 px | ✅ every playing cell. Card sections: grip and seat (root–card), impact (card–snowbank), catch (head–root). Drawn-sled sections: seat (root–sled), impact (sled–snowbank), catch |
| Head flight | speed within 20 % of the sled's; lodged ≤ 2 px from the socket | ✅ every playing cell |
| Planted feet | ≤ 4 px per stance | ✅ every playing cell. Measured at most 0.7 px over every mobile span from 100 to 220 px after the stride scale (design D8). It was up to 6 px before |
| Card return | ≤ 0.5 px and 0.01° between `slotted` and `ct:restore` | ✅ `ledge-card` and `rim-card` |

**Spans reached.**

- desktop: 372–460 px
- mobile: 100–220 px for the drawn-sled sections and 140–220 px for the card sections

**Findings fixed while extending the gate**, all accepted by the issue owner on 2026-11-23 and recorded in design D2–D8 and the deltas:

1. **Drawn sled at the rig's size.** The drawn-sled sections were about 86 px (desktop) and 100 px (mobile) longer than the compiled ones, so phones fell to the poster. They now lay out from section overrides with the rig-sized sled, in one shared story fill.
2. **`rim-card` slot return.** The card returned to the ledge height (67 px off on desktop, 60 px on mobile). It now has its own slot return fill.
3. **Stride scale.** A phone's walk has only three to five stances, and the rounded cycle count slid a foot up to 6 px.
4. **Mobile card sections from 140 px.** Shorter card spans would launch the head up to 38 % faster than the sled (delta V9).
5. **Missing keys.** The card tracks needed keys at the `rim-card` splice edges.
6. **Whole cycles.** The drawn-sled return window held a half cycle.
7. **Overhang.** The band's overhang is read against the base `far` reference.
9. **Bare keyframe.** The card tracks got a key at the `rim-card` splice edge (frame 231) before their first key, with neither a hold nor an easing. Every check here evaluates such a key, but lottie-web throws on it, so the browser run on the local host failed at 3.85 s. The key is now a hold. The fixture test and the Themes check reject a bare key, and every prepared section of both variants now steps through all 1,500 frames in `lottie_light` without an error.
8. **Exit pose.** The drawn-sled story ran only to the return (23.5 s), and the themes check found an 88/146-unit pose jump at that splice edge. The story fill now runs to the end of the trunk, and `ct:stretch` allows 12 ranges.

## Other suites

| Suite | Result |
| --- | --- |
| `copy-track-fixtures.spec.ts` (hashes, grammar, caps, adapter on both fixtures) | 10 passed |
| `copy-track-adapter.spec.ts` (section overrides, override validation before measuring, stride scale) | 15 passed |
| `copy-track-stages.spec.ts`, `copy-track-markers.spec.ts`, `celebration-pack-scene.spec.ts` | 26, 20, 10 passed |
| `LottieScene.spec.tsx`, copy-track block | 40 passed in the file |
| Compiled scene suites under `libs/celebrations/src/new-year/` | 13 files, 332 passed, unchanged |

The `LottieScene` copy-track block covers two cases:

- **Reduced motion:** the poster only, with no data request, no player load and no copy.
- **No composer and no starters:** a drawn-sled section on the stage anchor, with nothing copied or hidden.

## Bundle (task 9.2)

The `@epam/chat` production build of this tree, compared with `f416f8c69`. Both were built with the same `vite build`.

| Chunk | `f416f8c69` | This change | Change |
| --- | --- | --- | --- |
| entry `index-*.js` | 625,385 B | 625,462 B | +77 B (+0.01 %) |
| `new-year-*.js` | 151,846 B (46,671 gzip) | 149,202 B (45,752 gzip) | −1.7 %: `reindeer-text.ts` now delegates to the shared `text-run-copy.ts`, which left the chunk |
| `packs-*.js` | 27,400 B (11,092 gzip) | 53,931 B (20,002 gzip) | +26.5 KB, the copy-track adapter and its generic helpers |

The entry is unchanged within 1 %. The `new-year` chunk shrank by 1.7 %, outside the task's "unchanged within 1 %" because it shrank, not because it grew.

## Full verification (task 9.3)

`npm run verify:full` ran once on 2026-11-23:

- `typecheck:full`, `lint:check` and `format:check` pass.
- `test:full` fails in two tasks that this change does not touch. Both are local environment failures:

| Task | Failure | Why it is unrelated |
| --- | --- | --- |
| `@epam/chat-api:test` | 213 tests in 8 files (managed runtime, explicit environment, app config), for example `TypeError: pairs.map is not a function` in `readManagedRuntimeSettings` | The same 213 tests fail with the untouched local `apps/chat-api/.env.local`, which sets `MANAGED_*` variables that Nx loads into the run. `app-config.controller.spec.ts` passes alone under vitest (47/47). This change edits nothing in `apps/chat-api` |
| `attachment-canvas-consumer-fixture:pack-lib` | `npm error code ETARGET: No matching version found for @epam/pdf-highlighter-kit@^0.0.23` | The registry has no such version locally; the fixture packs `attachment-canvas`, which this change does not touch |

Every other suite passes, including all of `@epam/ai-dial-celebrations`.

## Local delivery from the Themes working tree (2026-11-23)

The whole delivery path runs locally:

- **Themes:** the `ai-dial-chat-themes` branch `feat/new-year-snowman-copy-track`, local only and not committed. It deletes `new-year-default/1.0.0` and publishes `1.2.0` with `snowman-delivery`, `defaults.new-year` 1.2.0 and revision `2026-11-23.1`. It is served from `static/` on `http://localhost:8090`.
- **`chat-api`:** started with `THEMES_CONFIG_URL=http://localhost:8090`, `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=new-year/gift-wrapping,new-year/snowman-delivery`. It serves the catalog (revision `2026-11-23.1`), the 1.2.0 manifest with the copy-track capability, and the 278,719-byte desktop animation.

The Themes check passes, and its 96 tests pass. That check found the exit-pose jump fixed in finding 8.

**Manual run in the app (issue owner, 2026-11-23).** The issue owner played SnowmanDelivery through the BFF in Chrome on the local start page: 1920 × 1083, starters of 183, 303 and 288 px below the composer.

- The run found two defects, and both are fixed:
  - no card qualified under the 0.9–1.1 width band (delta V1, now 0.75–1.5)
  - lottie-web threw on the bare keyframe of finding 9
- After the fixes the snowman borrows the 183 px starter, and the scene plays to the end.
- Because 1.2.0 was replaced in place during this local run, the browser's immutable cache had to be cleared. A published version is never replaced, so this does not apply to a real publication.

This is a manual check on one layout, not the S8 browser evidence listed below.

## Not measured: browser evidence S8 must produce

The browser run was dropped from batch 1 by the issue owner (portfolio delta, "Batch 1 evidence on data"). Before production rollout, S8 (#9227) must capture:

- **Browser checks:** the real `ConversationInput` at 360–1920 px in LTR and RTL, every section, with contact, story and restoration asserted in the rendered page
- **Contact frames:** at grip, seat, impact, lodge, catch and slot, for desktop and mobile
- **Profiles:** rendering cost per frame, and the SVG element count against the 800-element cap
- **Retention:** heap and detached nodes after repeated plays and cancellations
- **Preparation time:** p95 under CPU throttling
- **Long tasks:** recovery of the copy and the Lottie clock after an injected long task
- **Normal-speed review:** a reviewer watches every section at normal speed against the compiled scene
- **Pinned-player review:** of both published variants in lottie-web 5.13.0
