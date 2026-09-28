# Candy cleanup battle verification

## Implemented scope

The complete 35-second story is implemented through OpenSpec propose/apply: measured candy rain, two feeding ravens, the mummy sweeping and expelling them, a returning larger flock expelling the mummy, a second feast, and the mummy returning with exactly two skeleton janitors to drive the flock out and finish sweeping. Provider deadline: 35.5 seconds. No public API or host integration changed.

Private preparation, pure geometry/choreography, owned WAAPI playback and SVG artwork are separate. Existing scene selection is preserved. Static motion fallback skips target measurement. No source snapshots, live-control animations, dynamic filters, physics engine, dependencies or per-frame React/layout work were added.

Lower-card routes go beside the wider composer before entering underneath it, where the measured clearance fits a sweet. Bounce height is limited by the overhead surface. Tight layouts retain a safe upper-edge route. Regression coverage samples the flight through the composer's vertical band to detect body intersections.

## Browser evidence

Local Chromium against the running celebrations Storybook at port 3005. The actual chat at port 4207 is login-gated; these are host fixtures using the same anchors, not an authenticated end-to-end chat claim.

- Moving scenes at 360, 900, 1280 and 1920 pixels; RTL at 360/1280; composer-only and starters-above at 360/1280: passed. Default Candy has starters below the composer.
- All planned rendered edge/beak/brush contacts measured within 0.008 CSS px. Source DOM, draft, backward selection and focus remain unchanged; source controls own zero scene animations. No horizontal overflow.
- Typing cancels every track and preserves the typed character. Missing anchors retain all actors; resize cancels. Reduced motion has zero animation tracks. Unit tests additionally cover observer changes, removal, scroll, hidden documents, partial setup, StrictMode, motion/environment change, unmount and idempotent deadline cleanup.
- Full natural playback at 360/light and 1280/dark: two initial ravens at 7s; 4/6 feeding ravens after the mummy retreats at 22.3s; all three janitors at 27.8s; final sweep/departure; provider removal by 36s. Real-size frames were inspected for folded wings, pecking, broom grip, mobile formation and chase separation.
- Artifacts (ignored local diagnostics): `tmp/candy-battle/verify.cjs`, `verification.json`, `natural.cjs`, `natural.json`, `natural-*.png`, `video/`. Screenshots retain the caret so screenshot instrumentation cannot mutate the host and cancel the scene.

## Performance

Baseline was captured before replacing Candy; final profiling ran after production builds completed. Same Chromium, 360px/CPU ×4 and 1280px/CPU ×1. These are desktop emulation measurements, not physical-phone FPS guarantees. No application geometry reads or long tasks over 50ms occurred during the final 1–33s measurement window; natural provider cleanup passed by 36s on both.

| Metric | Mobile baseline | Mobile final | Desktop baseline | Desktop final |
| --- | ---: | ---: | ---: | ---: |
| Owned tracks | 18 | 43 | 32 | 57 |
| SVG nodes | 78 | 249 | 138 | 331 |
| Main-thread task time, seconds 1–9 (ms) | 428.1 | 1436.7 | 547.5 | 881.4 |
| Native layout time, seconds 1–9 (ms) | 6.74 | 76.71 | 3.37 | 26.37 |

Final 1–33s p95 frame intervals: 9.2ms mobile, 9.1ms desktop; max: 16.8ms/9.4ms. Full-window native layout: 261.59ms/93.19ms; main-thread task time: 5.228s/2.820s across 32s. The RAF sampler itself belongs to the test harness, not the scene.

The complete cast costs more than the old rain: approximately 3.36×/1.61× main-thread task time over the comparable first eight seconds. Native SVG transform rendering still incurs browser layout/style work despite zero JavaScript geometry polling. The new story stays inside its explicit track/node/frame caps and showed no long-task or sampled-frame regression in this run; it is not claimed to be cheaper than the old effect. Mobile uses fewer sweets and birds while preserving both helpers and every plot beat.

Artifacts: `tmp/candy-battle/baseline.cjs`, `baseline.json`, `profile.cjs`, `profile.json`.

## Automated checks

- Focused target/plan/playback/component/Extras tests passed; story coverage and HalloweenEvent integration passed; the updated bat-duration regression also passed.
- Final scoped Nx celebrations typecheck, lint and build passed. Tests: 879 passed, one pre-existing failure in `HalloweenSecrets.spec.tsx` expecting eleven pumpkin scenes while the committed constant includes twelve (Spiders is also in the secret pool). The scene pool is unchanged by this work.
- Slice `verify:changed`: affected typecheck/lint passed. Test failures were the existing attachment-canvas size budgets, backend undefined refinement-model expectation, existing scene-pool mismatch, and one obsolete cross-scene Candy deadline assertion. The deadline assertion was corrected and passed in subsequent focused/scoped runs. The first geometry check overlapped in-progress artwork and caught formatting errors; those were corrected, not treated as baseline failures.
- Exactly one `npm run verify:full` was run: full typecheck/lint passed; global format check stopped on unchanged `apps/chat-api/README.md`, so its test phase did not execute. The affected and scoped test runs above provide the test evidence. No unrelated formatting/test fixes were made.
- Affected production build passed (30.7s). Documentation validation and strict OpenSpec validation passed. Final changed-file format and whitespace checks passed.

Logs: `tmp/candy-battle/final-scoped-checks.log`, `playback-checks.log`, `full-checks.log`, `affected-build.log`; individual task logs are referenced within those files under `tmp/agent-logs/`.

## Five-axis self-review

- Correctness: complete plot, exact contacts, persistent sweets, offscreen reversals, composer-only/missing targets, provider lifetime and interruption ownership covered. The old cross-scene deadline assertion and lower-card bypass were corrected during verification.
- Readability: geometry, playback and artwork each have one responsibility; shared beak/brush coordinates keep plan and drawing consistent. No shared engine or unrelated refactor introduced.
- Architecture: private celebrations files use only existing host-provided anchors/mobile and computed direction. No app imports, routes, storage, environment variables, transports or new package contracts.
- Security/accessibility: static SVG paths, no external assets or HTML insertion in production; inert, aria-hidden, pointer-transparent illustration; no text entry/focus changes; reduced motion renders static art.
- Performance: finite precomputed transform/opacity tracks, bounded target discovery and art, event-driven geometry rechecks only; measurements below.
- Responsive/documentation gates: four viewport widths, RTL and light/dark cast inspection; every mobile story beat and both helpers preserved. README describes the implemented contract; no structural architecture-doc update needed.

No blocking defect found in the Candy implementation. Workspace verification remains non-green for the unrelated failures listed above.
