## Why

### Problem
The current Bats burst only flies sixteen small bats across the screen. The user selected and approved a comic crosswind scene that makes bats interact with existing UI through visible cause and effect.

## What Changes

### Solution
A sleepy bat grips the underside of the composer and wraps itself in its wings. Two helpers fan it from opposite sides. Their articulated wings fold on recovery, spread during stronger downstrokes and gently lift their bodies; nearby small controls, cards and history rows react after a short distance-dependent delay. There are no rays, airflow streaks or drawn vortex. The sleeper wraps up tighter; stronger opposing currents catch the helpers in a whirl and carry them away in separate directions. The sleeper opens one eye, yawns, crawls to a nearby button when available and departs last.

### Non-goals
No core page, library, provider, data, audio or new notification changes. No composer snapshots, canvas dependency, ghost/raven refactor or event-pool changes.

### Acceptance criteria
- Exactly three story actors, with visible claws, folded wings and sleepy/awake expressions.
- At most three mobile/five desktop small visual copies. Actual power strokes determine motion onset and direction, with a short propagation delay; remote elements remain still.
- Helper exits precede the sleeper's lazy final departure; a 17.5-second story settles before its scene-specific eighteen-second deadline. Flight carries momentum through turns and slows before settling, with continuous wingbeat phase and damped surface motion.
- Interruption immediately restores originals; input/focus/data remain owned by their existing components. Reduced motion is static; missing usable composer retains the decorative flock.
- Automated geometry/lifecycle tests plus a browser fixture verify attachment, story phases, mobile/RTL and bounded playback performance.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `halloween-easter-egg`: add the bat crosswind story and its cleanup, motion and performance constraints.

## Impact

Follow scene-local preparation in `apps/chat/src/components/Halloween/HalloweenGhosts.tsx:17` and reversible snapshots in `apps/chat/src/utils/celebration-snapshots.ts:113`. Add bat artwork, scene, targeting, planning and animation files; route only Bats from `HalloweenBurstOverlay.tsx` and update the app README. Keep `HalloweenNightFlight.tsx:140` as the unavailable-anchor fallback and unchanged Witch renderer.

Alternatives: keeping the old flock lacks interaction; a canvas adds UI-rasterization complexity for three actors. Use bounded SVG and precomputed WAAPI motion first. This is backward compatible and rolls back by restoring the old Bats rendering branch. No new i18n strings: preserve the current bat toast and secret-phrase hint. CelebrationProvider continues owning activation/lifecycle; no new context is needed.
