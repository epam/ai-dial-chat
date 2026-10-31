## Why

The user wants every New Year scene except the approved SnowmanDelivery checked against the updated celebration-scene-ideas skill. Coherent drawings and purposeful poses take precedence over added SVG detail or physical complexity. Source inspection and baseline browser frames show that the penguin's working flipper does not inherit its body's lean, its intermediate walk has inactive feet, and the elves use the same soft easing for both rising and falling hops.

## What Changes

- Keep the penguin's existing monochrome illustration; connect the working flipper to the body and derive paper capture/star release from the actual pose in both directions. Give all three walks coordinated short steps, with a readable attention/reaction hold and a continuous thrown-star arc.
- Preserve the elves' coherent artwork and distinct expressions. Restrain secondary cap/recoil motion and use directed lift/fall timing for the bound master's hops; preserve ribbon/hand synchronization.
- Audit the revised reindeer in the same browser pass; retain working artwork and poses rather than require cosmetic changes to every scene.
- Record before/after captures, native contact evidence, rendering budgets and page restoration. Leave all SnowmanDelivery files and shared runtime/timeline code unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `new-year-penguin-star`: coherent body/flipper articulation, exact RTL capture/release and coordinated walking/throwing.
- `new-year-gift-wrapping`: restrained connected poses and differentiated hop timing without increasing the rig or rendering budgets.

## Impact

Scene-local compositions, focused tests, browser verification and the celebrations README. Existing `CelebrationAnchors` and provider/player ownership remain unchanged; no app/API/auth/env/storage/telemetry knowledge enters the library. No public API, labels, dependencies or trigger changes.

## Solution and alternatives

Use the existing scene-local Lottie pattern in `libs/celebrations/src/new-year/utils/penguin-star-composition.ts:328` and the shared grip geometry already in `libs/celebrations/src/new-year/utils/gift-wrapping-composition.ts:174`. Parent connected artwork and author fewer purposeful poses. A redraw or new physics solver adds risk without addressing these defects; leaving the independent flipper unchanged preserves a known connection error.

## Non-goals

No snowman changes, story rewrite, art-engine migration, added particles, public integration changes or expanded rendering ceilings. No commit, publishing or archival.

## Acceptance criteria

Both revised scenes retain their stories, duration, cast, fallbacks and existing budgets. Penguin shoulder/capture/release agree with rendered SVG transforms in LTR/RTL; feet move during each walking interval. The elves retain recognizable connected contours and synchronized ribbon grips while hops have distinct ascent/descent timing. Browser evidence covers 360/900/1280/1920, normal playback, reduced motion and restoration. Reindeer findings are recorded separately from changes. Relevant tests, repository checks, build and docs/spec validation pass; artistic observations remain distinct from geometry/performance results.

## Compatibility and rollback

This is compatible scene-local motion work. Reverting the changed compositions and tests restores previous motion without changing saved data, triggers or host contracts.
