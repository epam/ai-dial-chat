# Design

Keep the existing playback/session state and native choreography. Add optional paired identity nulls `bp-bounds:min` and `bp-bounds:max` with finite static corner positions inside the composition. Their rectangle conservatively encloses visible authored artwork during contact intervals. An absent pair uses the full composition rectangle; incomplete, inverted or out-of-stage bounds fail before mutation. Themes validates the same grammar.

A target is eligible only when its measured center gives an allowed displacement for every prop slot available in that layout, and both zero displacement and the translated rectangle fit the viewport. Existing 400/140-unit displacement caps remain. Because all contact weights are nonnegative and total at most one, their blend is a convex combination of these safe translations; linear interpolation also stays safe between keyframes. No per-frame measurements or path interpretation are required.

Pass an optional predicate into `findBorrowTargets`, after its ordinary safety checks and before pair enumeration/ranking. Keep support discovery independent. Button-props uses the predicate for size, complexity, animation/transform safety and viewport geometry; other callers are unchanged. Preparing snapshots still occurs only after selection.

The unpublished standard pack 1.5.1 and Chat's verification fixtures receive only bounds nulls; existing shapes, poses and motion tracks are unchanged. Preserve the 48-layer, 2500-key, 160-path, 1000-vertex, 500-SVG-node, 512-KiB and 26-second budgets. Recompute hashes, inventory and catalog revision. No published version is edited.

Regression verification covers the original edge case in the browser, dense native-frame envelope inspection, both eligible buttons beside a rejected selector, malformed bounds, fallback without slots, blended contacts and existing cancellation tests. Documentation describes the standard pack and secret phrase. No new strings, endpoints, roles, telemetry, cache or memoisation are introduced. Existing host-supplied anchors/loaders preserve library isolation, physical RTL geometry and inert/focus-free copies.

## Integration contract

`CelebrationProvider` in `libs/celebrations/src/context/CelebrationContext.tsx` retains playback state. Host-provided anchors and loaders remain unchanged. No endpoint, generated-client, label, feature/role gate, cache, telemetry or memoisation change is required. Copies remain inert; keyboard interruption and focus behavior stay intact. RTL uses physical geometry and never mirrors copied text; reduced motion still uses the poster.

## Local cache recovery follow-up

The unpublished 1.5.0 candidate was already consumed by the local browser, whose immutable manifest cache retains the previous asset identifiers after the candidate was edited. A normal reload and delivery-policy revision cannot change the manifest cache key. Replace this unpublished candidate with version 1.5.1 and update the catalog/default; do not weaken production cache rules or change hashes under existing asset identifiers. Published 1.2.0–1.4.0 remain untouched. Verify the transition with the old descriptor cached, not only with a clean browser.
