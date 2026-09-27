## Context

`HalloweenNightFlight.tsx` currently renders sixteen independent decorative bats. The approved replacement is a three-character comedy with reversible page interaction. Follow `HalloweenGhosts.tsx:17` for activation preparation and `celebration-snapshots.ts:113` for inert visual copies. Existing CelebrationProvider owns activation and consumes the scene-specific duration from the existing registry.

## Goals / Non-Goals

Make attachment, wingbeat-driven reactions and the failed wake-up attempt readable on mobile and desktop. Preserve input drafts, selection, focus and underlying data. Keep preparation bounded and playback independent of React rendering and DOM measurement.

No shared-library/core-component/provider changes, new backend endpoint, audio, context, dependency, feature flag, translation, telemetry or persistent cache. Keep the user's Bats-only preview pool intact. Witch flight and other scenes are outside this change.

## Decisions

- Contract-first target/plan/renderer boundaries, then one complete scene slice. Target discovery uses public composer/starter class exports and existing history selectors. Cache rectangles/styles for one activation, discard on cleanup. The composer is an anchor only and is never copied or transformed.
- Select up to three mobile/five desktop nearby small idle surfaces, bounded to sixty descendants and 440×110/33000px². Reserve a nearby small button as a perch. Skip hidden, clipped, disabled, expanded, editable or focused surfaces and overlapping relatives.
- Precompute one 17.5-second plan with an eighteen-second registry lifetime. Actor coordinates identify the claws at SVG point (50,66) in a 100×80 viewBox, so rotation around the grip leaves the sleeper attached to the composer edge. Helpers approach opposite sides, fan gently, exchange looks, fan harder, spiral and leave separately. The sleeper tightens its wrapped wings, opens one eye, yawns, crawls/re-hangs and leaves last. If no safe button exists it crawls along the composer edge.
- The user's follow-up requested softer, more realistic motion. Sample monotone cubic flight curves once, preserving tangent continuity through orbit knots and zero speed at dwells. Use linear interpolation between those precomputed samples instead of restarting ease-in-out on every path knot. Wing half-beats maintain phase as their rate/amplitude changes. Surface responses use a smoothly introduced, damped oscillation, and helpers get more time to leave the vortex. This changes only Bats' duration constant/registry entry, not the preview pool or provider.
- The user's further refinement removes all visible airflow: no beams, streaks, particles or vortex paths. Shoulder and outer-wing groups articulate separately: hand/finger membranes tuck inward on recovery and open fully on the power stroke. Helpers' bodies lift/settle by about two pixels with the same beat. Actual downstroke times plus a short distance-based delay drive edge-hinged surface reactions; distant elements stay still. Only bounded transforms and opacity run through synchronized WAAPI with the existing snapshot helper; no particle loop, per-frame layout reads, dynamic SVG filters or React updates.
- Exactly three expressive SVG actors warrant DOM/SVG rather than a shared canvas. A canvas would require rasterizing UI copies and duplicate snapshot semantics without a demonstrated need. Browser profiling verifies this choice. Artwork is custom scene illustration, not a replacement UI icon.
- A scene-local controller cancels animations and restores copies on input, focus, pointer, scroll, resize, hidden tab, anchor changes/removal, unmount or partial setup failure. Changing responsive/motion settings ends the activation permanently. Own snapshot scroll events are ignored.
- Ancestor child-list mutations alone do not prove the anchors moved: the success notification removes its fixed portal from `body` after five seconds. For these ambiguous mutations only, compare the bounded set of anchor rectangles with their captured positions/sizes. Continue when unchanged and cancel on a real layout shift. Direct anchor/descendant changes and ancestor attribute changes remain immediate cancellation. This adds event-driven geometry checks, never a per-frame poll, and keeps notification/core components untouched.
- Reduced motion or missing WAAPI uses stationary decorative bats without measuring/copying the page. Missing usable composer or insufficient space below it retains the old flight fallback. Deferred public-class loading is invisible and cancellable. No loading/error controls or user-visible strings are introduced; existing toast/hint remain.
- Inert, aria-hidden and pointer-transparent scene introduces no focus targets. Coordinates are measured in physical viewport space in either document direction; explicit left/top origins prevent RTL static-position drift. No directional UI icons are added.

## Risks / Trade-offs

Clipping below a bottom-aligned composer would hide the story: select the fallback when attachment space is insufficient. Snapshot preparation can dominate CPU: cap subtree counts, target count and scan candidates; profile the activation as well as playback. Mutating anchors during playback invalidates their snapshots: stop immediately. Ambiguous ancestor child-list changes require a bounded geometry check before deciding whether to stop. The existing preview pool can make unrelated scene-registration assertions fail; record that without changing user configuration.

## Migration / Rollback

No stored state or API migration. Route Bats to the new scene, retain HalloweenNightFlight for fallback/Witches. Roll back by restoring the old Bats route. Update only the app README's bat behavior and the OpenSpec delta; leave archived Raven/Ghost work intact.

## Verification

Target/plan/controller/component tests cover budget, exclusions, grip geometry, wing articulation, stroke-before-response, staged departures and cleanup. A browser fixture checks 360/900/1280/1920px LTR/RTL, reduced motion, natural/interrupted restoration and throttled performance. Run scoped Nx tests/typecheck, changed-slice verification, one full verification, docs validation and quiet build. Record existing unrelated failures rather than fixing them here.
