## Why

The existing train only crosses the screen with decorative passengers. The main pumpkin should join it in an empty wagon, with smoke from several directions.

## What Changes

- Stop the train beside the main pumpkin, animate the pumpkin jumping into an empty wagon, then depart together and restore the pumpkin.
- Add layered smoke from the chimney and side vents, preserving mobile, RTL and reduced motion.
- Prepare optional scene audio with bounded playback and cleanup, disabled by default.

Non-goals: changing core chat components, changing scene selection, new settings, APIs, persistence or dependencies. Acceptance: the passenger starts at the actual pumpkin, lands inside the wagon, stays attached on departure and restores on completion/interruption; optional audio stops with the scene.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: Interactive pumpkin boarding for the existing train scene.

## Impact

Extract the existing train from `apps/chat/src/components/Halloween/HalloweenExtras.tsx:6`; follow `HalloweenMimic.tsx` and `utils/halloween-mimic.ts` for measured, synchronized scene motion. Add a marker only to HalloweenDecor's existing pumpkin wrapper. Keep CelebrationProvider, core page components and libraries unchanged. Update the existing train notification and app README.

Use one moving carrier with layered wagon art and pumpkin, rather than independent train/passenger trajectories that can drift. This is compatible with the existing scene ID and twelve-second runtime deadline; reverting restores the old train.
