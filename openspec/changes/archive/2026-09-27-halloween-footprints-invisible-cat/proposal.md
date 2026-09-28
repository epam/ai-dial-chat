## Why

Footprints currently paints fourteen identical paws on a viewport-relative sine wave and a floating grin (`HalloweenExtras.tsx:101`). The mobile audit found adjacent steps spanning about 20–81px; artwork disappears at 9.4s although the runtime keeps the scene for 12s. The approved concept gives the invisible familiar readable weight and a cause for its interaction with the page.

## What Changes

- Replace the generic footprints renderer with a twelve-second invisible-cat story: approach a starter card, climb onto its visual copy, sit with glancing eyes and a pleased grin, then jump off while the card springs back.
- Refine asymmetric paw pads and face artwork, with clear contact rather than broad glow. Precompute physical step geometry and pressure; use at most 8 mobile / 12 desktop prints and one small inert snapshot.
- With no eligible starter, use the safe composer edge: attached paw contacts move with a lightweight outline that dips and rebounds, while the live input is never cloned, hidden or animated.
- Keep meaningful no-target and static reduced-motion/unsupported-API fallbacks. Restore UI and release owned resources on interruption, anchor changes, replacement and completion.
- Budget at most 20 simultaneous scene/snapshot animations, 80 keyframes per track, 80/110 mobile/desktop SVG nodes, 40 copied descendants and a 240×96px target. Verify costs in the existing Storybook.

### Problem and solution

Use the existing `CelebrationProvider` and `animateCelebrationSnapshots` contracts. Follow `halloween-witch-animation.ts:21` for finite playback/cleanup and `halloween-cat-plan.ts:167` for synchronized contact. A cosmetic paw-only refresh would preserve the missing page interaction; adding a visible full cat would obscure the invisible-character premise and duplicate Cat. The bounded card interaction is the selected approach.

### Non-goals

No new event, scene ID, trigger, public API, animation engine, dependency, sound, telemetry, persistence, route or app integration. Do not change Candy, Skeletons or other scenes. Do not alter actual card content, submission, focus or draft state.

### Acceptance criteria

- Contact precedes each card reaction; prints on the card follow the same transform. The settled copy exactly covers its original through the restoration handoff.
- The story and final two prints remain readable in 360/900/1280/1920px, RTL and the supported motion modes. No horizontal overflow or mirrored copy text.
- Geometry and keyframes are prepared once; no per-frame JS layout reads, React updates, animated filters or unbounded particles. Profile both mobile (including CPU slowdown) and desktop.
- Natural completion, interaction and changed sources leave no hidden originals, copies, owned animations, timers or observers. Regression tests and docs describe this behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: bounded Footprints card interaction, artwork, timeline, fallbacks and restoration guarantees.

## Impact

Only `libs/celebrations` Footprints code, its tests and README. Host knowledge remains in `apps/chat/src/context/CelebrationHost.tsx`; the lib receives the existing composer/starter anchors and mobile setting through its environment. No new state context or host contract is needed. Existing `footprintsToastMessage`, active-event selection and twelve-second deadline remain applicable; no i18n changes.

This is backward compatible. Reverting the Footprints renderer/import and its new utilities restores the old decorative path; no data migration is involved.
