# New Year character-motion verification

## PR integration on development, 2026-10-31

The combined scene changes were integrated onto development at `6e53c3b36b`. NewYear registration tests retain the base branch's outer suite and all secret-pool checks. New test hooks are scoped to their suites, the contact assertion helper is named `expectTouching`, and the new statement-padding rules are satisfied. All 21 changed production/story TypeScript files emit identical JavaScript to the browser-verified implementation; these integration corrections do not change animation behavior. Local celebration-skill edits are excluded.

- Full typecheck, lint and formatting pass. The full test run passes the celebrations and frontend application targets, but does not pass overall: `reusable-workflows-consumer-fixture:verify` cannot load React via the quotations bundle's CommonJS require; attachment-canvas exceeds its eager-entry (71,271 / 66,500 bytes) and unpacked-package (260,840 / 247,500 bytes) budgets; the backend upload-controller 401 case receives 503. The dependent reusable-workflows fixture test is not run. The affected modules and fixture files are unchanged from the base branch.
- `npm run build:quiet` passes on the integrated tree. Documentation and agent-configuration validation pass. Spec references pass for 423 specs with zero errors and 196 existing warnings.
- Strict validation passes for all four changed main specs. The all-spec strict scan passes 422/423: the unchanged `theme-selection` spec has a requirement without SHALL/MUST. This base-branch finding is separate from the completed scene specs.
- The earlier successful full verification and browser measurements below describe the implementation before integration onto this newer base. The fresh full-run result above is the PR's current verification status.

## Scope and findings

Applied `celebration-scene-ideas` to PenguinStar, GiftWrapping and ReindeerTakeoff. SnowmanDelivery is the approved reference and was excluded from changes. No character artwork, snowman source or shared runtime/timeline file was changed.

The favorite scenes inform specific choices: the Skeletons handoff uses shared attachment geometry; SnowmanDelivery separates anticipation, impact and recovery; the Mummy's resisting pose makes effort readable. Here these translate to an attached penguin flipper, held reactions and directed elf hops, rather than more joints or SVG detail.

| Scene / beat | Evidence and finding | Result |
| --- | --- | --- |
| Penguin, capture at 6.7 s and throw at 8.5 s | The flipper had an independent world position while the torso rotated; capture geometry also applied an extra RTL angle sign. Source-confirmed connection error; baseline frames recorded. | Flipper inherits the torso; capture/release use the same mirrored local pose. Native SVG checks agree within 0.001 px. |
| Penguin, approach at 11.8–13.5 s | The feet's `moving` condition excluded the intermediate walk; time and distance also used the same eased fraction, leaving travel effectively linear. | All three walking intervals use coordinated, uniform-time samples and alternating foot lifts. Held poses retain quiet feet. |
| Penguin, star arc at 8.5–10.7 s | Each of four position samples used ease-in-out, introducing repeated braking. | One sampled arc with linear segments; the released star starts at the carried star's position and orientation. |
| Elves, pull/recoil at 5.8–7.7 s | The original drawing was coherent in inspected frames. Cap rotation reached -25/+22 degrees; extra swing was unnecessary to communicate the recoil. | Source SVG retained; cap swing reduced to -8/+7 degrees and body recoil reduced. This is an expressive adjustment, not a claim that the original hat was detached. |
| Elves, hops after 10.25 s | Ascent, apex and descent each used the same soft easing. | Short preparation, slowing ascent, accelerating descent and continuous horizontal travel through the apex. Winding contacts remain unchanged. |
| Reindeer | New baseline recordings at 360/1280 retain the composer walk, caught word, intact facing silhouette, tucked flight legs and visible snow trail. | Existing revised artwork/motion retained. No additional redraw or solver introduced. |

## Visual evidence

Normal-speed baseline recordings cover all three scenes at 360 and 1280. Final recordings cover penguin/elves at 360/900/1280/1920, including 900 RTL and a dark 1920 fixture. Inspected actual-size contact, approach, recoil and flight frames; also checked the static fallbacks. No new SVG paths or drawing detail were added. Videos are available for human assessment of complete movement; frame inspection and geometry tests do not establish user preference.

- Before: `tmp/new-year-audit/before/<scene>-<width>.webm` and timestamped PNGs.
- After: `tmp/new-year-audit/after/<scene>-<width>.webm`, PNGs and `profile.json`.
- Reindeer: prior four-width contact profile preserved at `tmp/new-year-audit/reindeer-prior-all-widths.json`; control-run results are in `tmp/reindeer-verification/`.

## Native browser profile

`node libs/celebrations/browser-tests/new-year-character-motion.browser.spec.mjs` passed all eight scene/width combinations. Mobile/tablet uses 4× CPU slowdown; desktop uses 1×. These isolated headless Chromium observations are not a physical-device FPS guarantee.

| Scene | Width | Composition bytes | SVG nodes / paths | Frame p95 / p99 ms |
| --- | --- | --- | --- | --- |
| Penguin | 360 | 64,507 | 112 / 47 | 9.3 / 10.0 |
| Penguin | 900 RTL | 64,155 | 112 / 47 | 9.2 / 9.3 |
| Penguin | 1280 | 60,563 | 112 / 47 | 9.1 / 9.3 |
| Penguin | 1920 dark | 60,778 | 112 / 47 | 9.2 / 9.3 |
| Elves | 360 | 132,990 | 314 / 165 | 9.2 / 9.3 |
| Elves | 900 RTL | 132,359 | 314 / 165 | 9.2 / 9.3 |
| Elves | 1280 | 132,707 | 314 / 165 | 9.1 / 9.3 |
| Elves | 1920 dark | 132,726 | 314 / 165 | 9.3 / 9.4 |

All existing ceilings remain intact. No playback host reads, long tasks, horizontal overflow or page errors were observed. Native shoulder/capture/release errors stay below 0.001 px; the elf ribbon's actual path vertex remains on the rendered mitten within 0.001 px. Borrowed controls regain their original transform/opacity; typing cancels the scene and preserves the new draft. Reduced-motion stills pass.

After 20 replay/cancellation cycles per scene, penguin DOM nodes remain 431 → 431, elves 432 → 432, and listeners 343 → 343 in both cases.

The unchanged reindeer additionally passed a fresh `REINDEER_WIDTHS=360,1280` control run: native sole error <=1.600 px, drift <=1.184 px, nose/loop gap <=0.819 px, visible flight/trail and restored editor. Frame p95/p99 was 9.2/9.3 ms mobile and 9.1/9.3 ms desktop, with no host reads or long tasks. After 20 cancellations, nodes remained 426 → 426 and listeners 343 → 343. The prior unchanged four-width run supplies additional 900 RTL/1920 evidence.

## Repository checks and self-review

Focused penguin and elf utility/component suites pass, including existing rendering budgets, interruption and restoration coverage. New regression checks cover torso/shoulder attachment, actual capture in RTL, intermediate approach steps, restrained cap motion and hop acceleration/continuity.

`npm run verify:changed` and the final `npm run verify:full` pass typecheck, lint, formatting and affected/full tests. `npm run build:quiet` passes all 69 affected/dependency tasks (64 cached). Documentation and strict OpenSpec validation pass. Spec references pass under installed Node 24.14.0 with zero errors and 196 existing warnings. i18n/theming scans report no candidates; no artwork colors or strings changed. `git diff --check` passes.

The complete production New Year module changes from 200,940 to 201,849 bytes, or 52,151 to 52,531 bytes with the same gzip measurement: +380 bytes gzip for both motion revisions. Player and artwork assets are unchanged.

Correctness: grip geometry matches the emitted parent transforms, and sampling does not change winding contacts or scene duration. Readability: two existing scene-local compositions, unchanged artwork and no new engine or shared abstraction. Architecture/security/accessibility: no app/API/auth/env/storage/telemetry coupling, external assets, dependencies, strings or public API changes; existing host anchors, inert artwork and reduced-motion/cleanup contracts remain. Responsive/performance: full stories at all four widths and in RTL, unchanged path counts and budgets. Documentation: README and delta specs describe actual motion changes; reference quality is assessed separately from contact/performance checks.
