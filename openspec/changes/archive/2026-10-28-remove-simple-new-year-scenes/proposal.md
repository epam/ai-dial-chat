## Why

### Problem
Snow, confetti and flying sleighs are simple decorative effects beside the two New Year stories. The user wants them removed and distinct triggers for the remaining stories.

## What Changes

### Solution
- **BREAKING**: remove Snow, Confetti and Sleigh from the public NewYearScene enum and remove their labels, components, styles and stories.
- Gift clicks play PenguinStar only; `happy new year` plays GiftWrapping only.
- Update host translation keys, tests, browser baseline coverage and documentation.

### Non-goals
No new scenes, animation changes, shared provider changes, dependencies or host contracts.

### Acceptance criteria
Only the two story scenes are registered. Each trigger selects its assigned scene, selection filtering still works, and removed effects have no runtime references. Existing scene cleanup, reduced-motion, mobile and RTL behavior remain covered by tests.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `celebration-events`: remove basic New Year effects and assign distinct click and phrase pools.
- `new-year-gift-wrapping`: assign the elves to the secret phrase.
- `new-year-penguin-star`: assign the penguin exclusively to gift clicks.

## Impact

Follow the existing event registration in `libs/celebrations/src/new-year/event.tsx:24` and pools in `libs/celebrations/src/new-year/constants/new-year.ts:8`. The change touches the shared celebrations library, but leaves the provider and host boundary intact: app translations still arrive through CelebrationHost labels and geometry through anchors. Remove three unused English messages; introduce no new visible strings.

Alternative considered: disabling scenes only would retain unused code and public options, contrary to the requested removal. Removing enum members and label fields is a source compatibility change for external consumers using them; migrate selection to PenguinStar/GiftWrapping and remove obsolete overrides. Rollback restores these files and the former pools together.
