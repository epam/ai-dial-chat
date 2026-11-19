# Verification

## Implemented scope

- Reindeer: broader native fur shading, an open shoulder contour, clearer calf facial marks and matching static artwork inset from the gift. Existing motion/contact tracks are unchanged.
- Penguin: separated cheek/beak/glasses, a shaped belly, rounded fir branches and local head compression/lift during effort and release. Flipper and star contact tracks are unchanged; static artwork matches.
- Snowman: lower crescent shadows, rounded fir tiers, a lower front branch lip and a soft snow ledge. Branch socket, head/card paths and grips are unchanged; static artwork matches.
- Elves: broad face/coat shadows and finer warm outlines in native and static artwork; wider cast spacing and a hanging free ribbon whose endpoints still follow the same grips.
- Themes: companion authored pack 1.1.1 copied to the local `ai-dial-chat-themes` repository after checking original hashes; all 11 files in previous immutable versions remain byte-identical. No publication was performed.

## Visual evidence

[Committed before/after frames](evidence/README.md) provide reviewable examples; the larger local preview and recordings described below remain ignored artifacts.

The ignored `tmp/celebration-art-fix/index.html` compares native 360/1280 frames with the verified pre-change audit. Supporting captures include 900 RTL and 1920 dark fixtures, reduced-motion stills, and recorded playback. Interrupted captures are not used as evidence of completed playback; final helpers check the actual player clock. These are Storybook host fixtures, not a running production deployment.

Inspected working poses include Penguin effort/throw/bow, Snowman impact/lodged head/catch/recovery, Elf pull/reveal/departure and Reindeer pull/reach/release/flight. Selected poses and contact geometry were assessed; continuous normal-speed video playback was not visually assessed. Video recordings are provided separately and are not treated as proof of motion appeal.

## Focused checks

- Exact Penguin utility/component files: passed (32 tests).
- Exact Snowman utility/component files: passed, including a regression that bounds the complete front-needle Bezier envelope below the lodged face. The post-regression Snowman run passed 63 tests. Final SVG counts are 246 nodes / 112 paths on mobile and 264 / 121 on desktop (one fewer node and path than before). Penguin remains at 112 nodes / 47 paths.
- Exact Elf utility/component files: passed (78 tests), rerun after the final steeper ribbon tangents. Native art grows from 36,728 to 37,532 compact JSON bytes with two additional face-shadow paths; contact pivots and articulation names remain unchanged.
- Exact Reindeer utility/physics/component files: passed (46 tests). Final SVG counts are 274 nodes / 108 paths on mobile and 290 / 116 on desktop. Final 900 RTL authored composition is 494,151 bytes against the unchanged 500,000 cap. An optional added lean was removed before final verification; it is not part of the delivered change.
- Native Snowman probes at 360/900 RTL/1280/1920: maximum sled/hand separation 1.285 px, head/plan separation 1.470 px, catch separation 1.8 px desktop / 1.36 px mobile; input cancellation retains the draft. Maximum authored composition 166,252 bytes against 170,000. Evidence: `tmp/celebration-art-fix/snowman-native-probe.json`.
- Documentation validator passed; spec-reference validation has zero errors and 174 existing identifier warnings. OpenSpec strict validation passed.
- `lib-theming` and `i18n-strings` scans against HEAD: no candidates. Decorative art uses the explicit `libs/celebrations` palette exception; no public labels or API changed.

## Quality review

Five-axis review found no actionable correctness, readability, architecture, security or performance defects in the scene changes. Native/static artwork parity and mobile/RTL behavior were included. Pivots and shared playback/session code remain intact; no dependencies, external assets in compiled scenes, masks, filters, per-frame DOM reads, app/API/environment/storage knowledge or new animation engine were introduced. README and change specs describe the delivered artwork and staging.

## Remaining integration results

- `npm run verify:changed`: typecheck and lint passed; 53 of 54 test projects passed. The unrelated `@epam/chat-api:test` target fails with `pairs.map is not a function` in `managed-runtime.settings.ts` and an explicit-environment assertion (7 files / 212 tests). No backend files changed in this task.
- `npm run verify:full`: typecheck, lint and format passed. Test phase: 83 succeeded, 2 failed, 3 skipped. Failures are the same backend tests and `attachment-canvas-consumer-fixture:pack-lib`: npm ETARGET for unavailable `@epam/pdf-highlighter-kit@^0.0.22`. No attachment-canvas or fixture files changed in this task. The repository-wide check is not green.
- The final ribbon-only tangent adjustment was followed by all 78 Elf tests; isolated final browser checks cover the rendered change.
- `npm run build:quiet`: passed (35.9 seconds), after the final ribbon change.
- Themes: staged publication validator passed with zero warnings; all 20 validator tests passed. Validator rerun in the actual companion repository after copying also passed. New local index revision is `2026-11-18.2`; default is `new-year-default@1.1.1`. Only README/index and seven new version files were copied, guarded by original and staged SHA-256 values; no old version changed and nothing was published.
- External final asset maxima: birds 104,543 authored bytes / 19 layers / 775 keys / 311 SVG nodes / 162 paths; elves 112,711 bytes / 6 layers / 566 keys / 319 nodes / 167 paths (missing-composer fallback 323 / 169). Posters are 79,488 and 9,297 bytes. Existing limits are retained.
- Both external scenes were rendered at 360/900 RTL/1280/1920 dark and as static posters at 360/1280. Independent real-time runs at 360/1280 reached the ending frames and removed their SVG on the 14s/16s deadline, with no page errors. The timer disposes the player before its `complete` event. Elf input cancels playback; the existing viewport bird contract continues on input and cleans up on layout change. Missing-composer Elf fallback was also checked.
- External evidence: `tmp/celebration-art-audit/themes-fix/{capture.json,capture-elves.json,asset-metrics.json,realtime/realtime.json,posters/posters.json,fallback/capture-elves.json}`. The snapshot runs use explicit frame seeking; the separate real-time runs do not. Neither is presented as continuous visual motion assessment.
- Isolated Penguin/Elf browser harness passed all eight combinations at 360/900 RTL/1280/1920 dark. Authored data: Penguin 62,667–66,611 bytes, Elves 136,184–138,756 bytes. Native counts: Penguin 112 nodes / 47 paths; Elves 318 / 167. Both report no playback host measurements, long tasks or horizontal overflow, with original controls restored. Twenty repeated cancellations per scene stayed within the existing DOM/listener bounds.
- Those instrumented runs measured p95/p99 frame intervals at or below 16.8 ms (4× CPU throttle for 360/900). This is evidence for the local fixture, not a device-wide frame-rate guarantee. Maximum native contact deviations: Penguin 0.000301 px, Elves 0.0000714 px. All final Elf frames use the steeper sag, inspected with the full greeting visible; outer starter labels can still sit temporarily behind actors.
- Evidence: `tmp/celebration-art-fix/native-character-motion/profile.json`, named recordings and 64 frame images. Final Penguin/Snowman pose captures pass all expected player timestamps, with zero page errors and no remaining snapshots. Snowman timing was not separately benchmarked; its native geometry and structural costs were checked.
- Isolated Reindeer harness passed all four widths, native eight-hoof/nose/grip checks, airborne cast visibility, snow, draft/text restoration, reduced motion and bottom-composer fallback. Authored bytes (360/900 RTL/1280/1920): 392,058 / 494,151 / 417,105 / 421,163. Maximum hoof error 1.600 px, drift 1.184 px, nose error 0.0041 px and grip gap 0.820 px, within existing tolerances.
- Reindeer instrumented p95 16.7–16.8 ms, p99 16.8 ms; one 33.4 ms maximum interval at 1280. No long tasks or playback host reads. Twenty repeated cancellations left exactly 2 documents / 428 nodes / 351 event listeners before and after. Evidence: `tmp/celebration-art-fix/reindeer/native-probe/profile.json` and its trace, frames and recordings.
- All eight implementation/verification tasks are complete. The final before/after preview contains 94 paired frames across six variants at 360/1280 and uses final native recordings; no missing local assets. Scope-related checks are green; the unrelated repository-wide failures above remain explicit. Implementation verification was completed before archive and PR preparation; release deployment is outside this change.


## Unrelated follow-ups

- Diagnose the backend managed-runtime fixture/config mismatch (`pairs.map`) and explicit-environment failure. These backend files were not changed here.
- Restore availability of `@epam/pdf-highlighter-kit@^0.0.22` for the attachment-canvas consumer fixture, or update that fixture through its own dependency workflow. No dependency version was changed for this artwork task.
