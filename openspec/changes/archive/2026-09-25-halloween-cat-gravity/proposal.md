## Why

### Problem
The current Cat burst slides a single 68px illustration along the screen bottom without touching the interface. The user chose the gravity-testing cat story: deliberate paw nudges, two falling buttons, a surprising rebound and nonchalant grooming.

## What Changes

### Solution
An articulated black cat jumps onto the composer edge. It tests a nearby small button with a paw, pauses and looks toward the viewer, then pushes it off. It moves to a second button and deliberately drops that too. One rebounds, startling the cat; the cat then washes its paw and leaves. Visual copies provide the interaction while the composer stays live.

### Non-goals
No core-page, library, provider, conversation-data or audio changes. No particle effects, independent canvas or event-pool changes. Preserve all existing Raven/Ghost/Bats edits and the user's Cat-only preview selection.

### Acceptance criteria
- One expressive cat with articulated limbs, head, ears and tail; clear anticipation, contact, pauses, weight and grooming.
- Up to two nearby small safe button copies, physical paw contact preceding their motion, gravity-like falls and a bounded rebound followed by recoil.
- Original controls, input text, selection and focus are preserved. Natural completion and any interruption restore originals.
- Mobile/desktop and RTL use measured positions; reduced motion uses a static cat without borrowing UI; missing safe targets retains a decorative fallback.
- Bounded preparation and synchronized transform/opacity playback; automated geometry, cleanup and browser checks.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `halloween-easter-egg`: replace the decorative Cat passage with the gravity story and its fallback, lifecycle and performance guarantees.

## Impact

Follow `apps/chat/src/components/Halloween/HalloweenBats.tsx:16` for scene preparation and `apps/chat/src/utils/celebration-snapshots.ts:113` for reversible visual copies. Replace `HalloweenCatScene.tsx`, add cat artwork, target/plan/controller utilities and tests, adjust only Cat's lifetime, and document its behavior in `apps/chat/README.md`. CelebrationProvider retains selection and lifecycle; there is no new state owner outside the scene and no new i18n text.

Alternatives: polishing the existing walk lacks interface interaction; a canvas would add UI rasterization for just one actor and two copies. Use articulated SVG and precomputed WAAPI first. This is backward compatible; restoring the old Cat component and default lifetime rolls it back.
