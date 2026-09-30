## Why

New Year's existing snow, confetti and sleigh effects have no character-driven interaction with the page. The approved “A gift with character” scene turns the composer into a present and ends with the overeager elf wearing the bow.

## What Changes

- Add `NewYearScene.GiftWrapping` to the gift's random click pool, with an 18-second two-elf wrapping, trapped-hat, unwrapping and departure story.
- Measure the composer; draw decorative ribbon around its edges without copying, hiding or mutating any host element. Preserve drafts, selection, focus and layout.
- Keep both characters and every story beat on mobile; use a decorative parcel when the composer lacks room. Reduced motion or unavailable animation APIs show static elves with the bow.
- Bound SVG complexity and animation resources, cancel on interaction or changed geometry, and verify contact and cleanup through tests and browser recordings/profiles.
- Add a translated notification, Storybook coverage and library documentation.

## Capabilities

### New Capabilities

- `new-year-gift-wrapping`: The wrapping story, choreography, safe host interaction, fallbacks and resource budgets.

### Modified Capabilities

None. Existing New Year effects and the confetti secret remain unchanged.

## Impact

Changes stay in `libs/celebrations/src/new-year`, its README, and the app's translation enum/locales. `CelebrationHost.tsx:30` already supplies the composer anchor. Follow the finite measured-artwork lifecycle of `libs/celebrations/src/halloween/components/Halloween/HalloweenCandy.tsx:14` and shared grip geometry of `libs/celebrations/src/halloween/utils/halloween-raven-plan.ts:130`, without importing Halloween into New Year.

Library isolation: existing `CelebrationEnvironment` owns host-supplied anchors, mobile state and labels; the provider owns selection/deadline. No new app context, route, host class, API, telemetry, storage, dependency or global refactor. The new optional `giftWrappingToastMessage` label preserves existing typed host label objects.

## Non-goals

Live dragging, chat actions, audio, changing the active event, copying controls, or a new animation engine. This is SVG scene artwork, not a replacement for UI-kit icons.

## Acceptance criteria

- The five approved beats are readable at actual size in LTR/RTL at 360, 900, 1280 and 1920 pixels; hands/hat/ribbon meet at the same calculated points.
- Two elves, one ribbon, zero snapshots/particles; at most 80 SVG nodes per elf, 32 desktop/24 mobile animations, 640 desktop/480 mobile keyframes total. Playback ends by 18 seconds and unmounts by 18.5 seconds.
- Interrupted/repeated playback releases every animation, observer, listener and timer and never alters the original composer.
- Reduced motion and unsupported APIs perform no host measurement. Missing targets use the same story with a decorative parcel.
- Targeted tests, changed/full verification, docs validation, build and browser profiling are recorded, including any environment limitations.

## Alternatives and rollback

Measuring the composer supports the approved plot with zero DOM copying; cloning it would introduce unnecessary focus, snapshot and restoration risks. This addition is backward compatible and can be disabled through the existing per-scene selection or reverted by removing its registration.
