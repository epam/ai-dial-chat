## Why

New Year's secret phrase currently has one story. Add the approved “Reindeer, release the brake!” scene: a strong adult and an observant calf free a gift ribbon caught on a word while walking along the input rim before taking flight.

## What Changes

- Add a 23-second native-vector Lottie story with two articulated reindeer, a sleigh, a caught ribbon, two resisted pulls, a nose-led release and an unexpected flight.
- Add ReindeerTakeoff to the `happy new year` secret pool alongside GiftWrapping, using existing independent no-repeat selection.
- Walk along the composer rim, borrow a short word from its text or placeholder without changing the live editor, and leave a bounded snow wake during flight.
- Include mobile, RTL, static reduced-motion/error fallbacks, complete interruption cleanup and numerical budgets.

## Capabilities

### New Capabilities

- `new-year-reindeer-takeoff`: artwork, choreography, safe UI contact and performance limits.

### Modified Capabilities

- `new-year-gift-wrapping`: retain the elves as one of two secret stories.
- `new-year-penguin-star`: expand the documented secret pool while preserving gift clicks.
- `celebration-events`: register the fourth New Year scene, its deadline and translated notification, and expand the secret pool.

## Impact

Changes stay in `libs/celebrations` plus the app's existing NewYearI18nKeys and English labels. Host knowledge continues to arrive through CelebrationAnchors and translated labels; no provider or external API changes. Follow `new-year/utils/snowman-delivery-animation.ts:70` for synchronized snapshots and `context/CelebrationContext.tsx:171` for secret selection.

### Solution and alternatives

Use one scene-local Lottie timeline and a synchronized inert text copy. A simple sleigh flyby would omit the approved physical joke; an independent CSS character timeline would complicate ribbon/contact synchronization.

### Non-goals

No new secret phrase routing, audio, interactive scene controls, dependency changes or app navigation.

### Acceptance criteria

The entrance traverses the measured stage and the entire flying cast stays visible before departure at mobile and desktop sizes; the word lifts only under ribbon tension and returns on release; snow remains along the flight path; drafts/focus/data remain intact; all interruption paths release resources. Structural tests and browser playback/profile evidence cover the recorded budgets.

### Compatibility and rollback

Additive enum and optional label field. Existing hosts can disable the scene through selection. Removing its secret-pool entry rolls back activation without changing the shared runtime.
