## Why

Skeletons is the last pumpkin scene still rendered by the pre-story `HalloweenExtras.tsx`: two stroke-only figures rise from the bottom edge, bob to infinite CSS loops and sink away without touching the page. Every other click scene now treats the interface as a prop. The approved story gives the pair a readable joke on the composer edge.

## What Changes

- **Solution:** "The lost skull" — an 11.5-second finite story. Two skeletons spring up onto the measured composer top edge (its decorative outline flexes under each landing), dance a short jig, and the showman's over-eager head-bob launches his skull. The skull bounces on the edge, rolls to the composer corner and teeters there while the headless body gropes the wrong way. The partner lunges, catches the skull at the corner, carries it back and hops to plop it on — backwards. A quick spin fixes it, both celebrate, then hop off the edge and drop below the viewport.
- Without a safe composer the same beats play on the viewport floor; the skull rolls toward the band end instead of a corner.
- Replace the old artwork with articulated filled-bone skeletons (separate skull, face, arms, legs, body) and a detachable free skull.
- Extend the Skeletons provider deadline from 10 to 12 seconds (inside the existing 10–12 s additional-scene range); scene ID, trigger pool, notification and host API stay unchanged.
- **Non-goals:** snapshots of UI, moving live controls, user steering, new anchors or selectors, new strings, audio, a physics or animation engine, refactoring other scenes.
- **Acceptance criteria:** hand–skull contact at catch, carry and placement comes from the same pose function as the arm tracks; the skull starts its flight exactly at the attached skull position; the outline reacts only after landings/impact; zero DOM snapshots and zero per-frame layout reads; ≤ 21 animations, ≤ 80 keyframes per track, ≤ 100 SVG nodes; interruptions release everything immediately; RTL, mobile, reduced motion and composer-less variants are covered by tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: Skeletons' lost-skull choreography, composer-edge contact/fallback and its performance/lifecycle contract.

## Impact

Private files under `libs/celebrations/src/halloween` (new `HalloweenSkeletons.tsx`, its artwork stylesheet, `halloween-skeleton-targets.ts`, `halloween-skeleton-plan.ts`, `halloween-skeleton-animation.ts`), removal of the old renderer from `HalloweenExtras`, the scene deadline constant, tests, and the lib README. Follows `HalloweenCandy.tsx` / `halloween-candy-animation.ts` for measured-only geometry and a single finite WAAPI clock, and `HalloweenFootprints.tsx` for the decorative composer outline.

Library isolation: only the existing `CelebrationEnvironment` (`isMobile`, host-owned `CelebrationAnchors.composer`) is read; no app imports, routes, flags, i18n, storage or external contracts enter the library. The existing `skeletonsToastMessage` ("The skeletons have found their rhythm…") still fits. No public API or breaking package change. Revert the renderer and deadline to roll back.
