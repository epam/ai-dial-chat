## Why

### Problem
The Ghost burst currently sends seven decorative ghosts across the screen without interacting with the interface. The approved direction combines possession of separate interface elements with one unsuccessful attempt to frighten the main pumpkin.

## What Changes

### Solution
- Ghosts enter different small, visible page elements. Eyes appear on their visual copies, which gently float and look around.
- One brave ghost approaches the existing pumpkin, tries to frighten it, then recoils from its glowing grin and hides with its tail briefly exposed.
- All ghosts peek out and escape along separate, staggered routes; borrowed visuals return to their exact original places.
- Keep a decorative fallback when anchors are unavailable and stationary artwork for reduced motion.

### Non-goals
No changes to conversation data, core page components, libraries, event selection, notification wording or other Halloween scenes. No audio, canvas dependency or persistent state.

### Acceptance criteria
- At most three possessed elements on mobile and five on desktop, chosen from different visible areas without borrowing focused, expanded, editable or oversized elements.
- The pumpkin reaction visibly causes the hiding, peeking and escape sequence, all within the existing fourteen-second deadline.
- Interaction and lifecycle interruption restore originals immediately; input drafts and focus remain intact.
- Bounded setup and precomputed SVG/WAAPI motion; no layout reads or React updates per animation frame. Automated lifecycle/geometry tests and a browser fixture cover mobile, desktop, RTL and reduced motion.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `halloween-easter-egg`: replace the crossing-flock requirement with interface possession and the failed pumpkin scare.

## Impact

Follow `apps/chat/src/components/Halloween/HalloweenRavens.tsx:28` for scene-local preparation and `apps/chat/src/utils/celebration-snapshots.ts:117` for inert, reversible visual borrowing. Route Ghost from `HalloweenBurstOverlay.tsx`; preserve the existing translucent ghost artwork and fallback flight helper. Add app-owned targeting, planning, playback and tests, and update `apps/chat/README.md`.

Alternatives: keeping only decorative flights does not deliver the approved interaction; a full canvas renderer would require duplicating UI rendering for a small number of actors. Start with bounded SVG and composited transforms, then measure.

The change is backward compatible and can be rolled back by restoring the previous Ghost rendering branch. CelebrationProvider remains the state owner; no new context or shared-library changes. Reuse the current translated Ghost notification and its secret-phrase hint; no new visible strings.
