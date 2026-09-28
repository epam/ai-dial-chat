## Why

Candy currently rains 18/32 sweets through viewport-based arcs without page contact (`libs/celebrations/src/halloween/components/Halloween/HalloweenExtras.tsx:6`). The approved story replaces that effect with a contest over fallen candy: two ravens, a sweeping mummy, a larger returning flock, and the mummy's two skeleton helpers.

## What Changes

- **Solution:** a 35-second bounded scene with measured UI-edge bounces, persistent floor candy, pecking, sweeping, both retreats and the final three-janitor victory.
- Preserve all story beats on mobile: 12/18 sweets, two initial ravens returning as four/six, one mummy and two skeletons. Composer-only and missing-target variants keep the complete contest.
- Extend Candy's provider deadline to 35.5 seconds; existing trigger, notification, scene ID and host API remain.
- Add articulated Candy-specific artwork and a pure contact plan with shared actor/prop coordinates, finite WAAPI playback and interruption cleanup.
- **Non-goals:** physics engine, user steering, moving live controls, new host selectors, API/dependency/provider refactors, audio or other scene redesigns.
- **Acceptance criteria:** actual measured bounces; candy remains for both feeding rounds; beak/broom contact precedes candy motion; birds and janitors exit opposite edges; mummy returns with exactly two helpers; all originals/drafts/focus remain unchanged. All counts and keyframe budgets are tested and profiled at mobile/desktop sizes, with RTL/reduced motion and interruption coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: Candy's complete cleanup-battle choreography, contact/fallback behavior and performance/lifecycle contract.

## Impact

Private files in `libs/celebrations/src/halloween`, scene registration deadline, tests, Storybook and the lib README. Follow `HalloweenFootprints.tsx` / `halloween-footprint-plan.ts:63` for stable preparation and precomputed contact, using existing `HalloweenRaven.tsx` and `HalloweenMummy.tsx` as artwork references. Their other scenes stay unchanged.

Library isolation: existing `CelebrationEnvironment` provides mobile mode and host-owned `CelebrationAnchors`; measured geometry enters the private plan. No app imports, routes, flags, i18n, storage or external contracts enter the library. No new visible strings or translations; existing Candy notification remains valid. No public API or breaking package change. Revert the Candy renderer and deadline to roll back.

Alternatives: merely retiming the rain misses the approved story; a real-time physics engine adds unnecessary cost and dependency. Choose deterministic contact choreography and zero DOM snapshots. The user explicitly approved implementation after the complete story discussion; no state-ownership ambiguity requires another question.
