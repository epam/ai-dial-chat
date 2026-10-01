# Celebration Repository Examples

Use this index for selective reading, not as a substitute for source code. Paths are relative to the AI DIAL Chat root. Verify current implementations before claiming a capability; examples describe techniques rather than mandatory templates.

## Entry points

- `libs/celebrations/README.md`: events, scenes, constraints, anchors and Storybook.
- `libs/celebrations/src/models/celebration.ts`: `CelebrationEvent`, `CelebrationScene`, `CelebrationAnchors` and scene selection contracts.
- `apps/chat/src/context/CelebrationHost.tsx`: the app adapter for actual anchors, event loaders, translations, mobile mode and navigation reset.
- `libs/celebrations/src/utils/celebration-snapshots.ts`: inert snapshots, appearance preservation, synchronization and restoration of originals.
- `libs/celebrations/src/utils/host-anchors.ts`: resolution of host-provided anchors.

## Select a relevant technique

Paths in this table are relative to `libs/celebrations/src/halloween/`.

| Example      | Action                                                                                                  | Useful technique                                                                                      | Sources                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Cat          | Sits on the composer, gradually pushes small buttons off, startles at the last bounce and grooms itself | Gaze and pauses establish character; synchronized paw/prop contact; a consequence-driven ending       | `components/Halloween/HalloweenCatScene.tsx`, `utils/halloween-cat-plan.ts`, `utils/halloween-cat-targets.ts`   |
| Bats         | Helpers try to wake a sleepy bat; wingbeats rock UI props and stronger gusts carry helpers away         | Cause and reaction at a distance, distinct roles, inertia and lag instead of arbitrary shaking        | `components/Halloween/HalloweenBats.tsx`, `utils/halloween-bat-plan.ts`, `utils/halloween-bat-targets.ts`       |
| Ravens       | Collect UI fragments for a pumpkin nest; a pair pulls a chat row until one lets go                      | A shared goal with independent trajectories, tension/recoil, composer-border fallback without history | `components/Halloween/HalloweenRavens.tsx`, `utils/halloween-raven-plan.ts`, `utils/halloween-raven-targets.ts` |
| Ghosts       | Possess small elements; an attempt to frighten the pumpkin scares the ghosts instead                    | Reversal of initiative and expectations; UI and decor share a story                                   | `components/Halloween/HalloweenGhosts.tsx`, `utils/halloween-ghost-plan.ts`                                     |
| Spider theft | Wrap small elements in webbing and carry them upward                                                    | Preparation for a grip, visible carrier/load attachment and coordinated motion                        | `components/Halloween/HalloweenSpiderTheft.tsx`, `utils/halloween-spider-theft.ts`                              |
| Mummy        | Fails twice to push the composer, then slowly pushes it offscreen before restoration                    | Weight, effort and repetition; specialized preservation of a working input during apparent movement   | `components/Halloween/HalloweenMummy.tsx`, `utils/halloween-mummy.ts`                                           |
| Bowling      | A pumpkin knocks down visible history rows, which reassemble afterward                                  | Target motion begins at contact; bounded interaction area                                             | `components/Halloween/HalloweenBowling.tsx`, `utils/halloween-bowling.ts`                                       |
| Train        | Stops, loads the main pumpkin into an empty carriage and leaves                                         | Decor becomes a character; boarding uses actual coordinates and carriage occlusion                    | `components/Halloween/HalloweenTrain.tsx`, `utils/halloween-train.ts`                                           |

## Reactive decor and triggered scenes

`libs/celebrations/src/halloween/components/Halloween/HalloweenDecor.tsx` connects the pumpkin trigger and corner spider. The spider reacts to the pointer and typing and may wrap the pumpkin after inactivity. This decor behavior does not establish support for clicks or dragging inside every scene.

Check current pools and durations in:

- `libs/celebrations/src/halloween/event.tsx` and `libs/celebrations/src/halloween/constants/halloween.ts`.
- `libs/celebrations/src/new-year/event.ts`: existing Snow, Confetti and Sleigh scenes; new ideas should add a distinct action.

## Lottie example

The New Year gift-wrapping implementation uses local vector art and one scene-local Lottie SVG timeline. Its presence in source does not mean the current event pool selects it. Read these paths relative to the repository root:

- `libs/celebrations/src/new-year/components/NewYearGiftWrapping/NewYearGiftWrapping.tsx`: activation, reduced-motion/static fallback and interruption.
- `libs/celebrations/src/new-year/utils/gift-wrapping-composition.ts` and `gift-wrapping-rig.ts`: measured stage, shared character geometry, native vector shapes and timed props.
- `libs/celebrations/src/new-year/utils/gift-wrapping-player.ts` and `gift-wrapping-animation.ts`: dynamic light-player import, bounded readiness, playback and cleanup.

Use this example when a proposed scene benefits from a single authored character timeline. It does not imply that Lottie fits every DOM interaction or removes the need for browser profiling.

## Available element roles

`CelebrationAnchors` includes `composer`, `composerAddCluster`, `composerModelSelector`, `starterList`, `historyContainer`, `historyRowLink` and `welcomeRegion`. The first five are class names; the last two are selectors. Scenes find headings and small buttons within these regions and check their eligibility; they are not separate guaranteed anchors.

The main pumpkin has a Halloween-specific anchor. Do not treat it as a universal event contract. For other decorative props, inspect their components and public classes in `libs/celebrations/src/constants/public-class-names.ts`.

## Visual inspection

- `libs/celebrations/src/halloween/stories/HalloweenScenes.stories.tsx`: individual scenes with mobile, RTL and reduced-motion controls.
- `libs/celebrations/src/stories/ScenePlayer.tsx` and `libs/celebrations/src/stories/StoryHostPage.tsx`: playback on a representative host page.
- `libs/celebrations/src/new-year/stories/NewYearScenes.stories.tsx`: current New Year scenes.

Source inspection usually suffices for an idea. For visual verification, use the existing Storybook and the repository's Nx task workflow; do not add a separate demo app just for exploration.
