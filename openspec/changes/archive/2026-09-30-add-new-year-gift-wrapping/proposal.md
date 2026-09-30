## Why

New Year's gift-wrapping scene gives a stocky green master and a nimble coral helper a comic reversal: the helper pulls the loose ribbon and accidentally turns the master into the present. The scene now uses Lottie for continuous ribbon movement, but the user still dislikes the elves and their strange-looking arms. They selected mischievous, expressive cartoon elves. This revision redraws their faces and proportions and makes the arm artwork and ribbon grip follow one shared rig; the plot and Lottie lifecycle remain unchanged.

## What Changes

- Redraw both animated and static elves in the selected mischievous cartoon style: compact limbs, smaller noses, expressive brows and readable grins, with a stocky green master and a nimble coral helper.
- Shorten the articulated shoulder-to-grip reach from 70 to about 37 native-coordinate units. Keep shoulder, elbow, wrist and mitten connected through working, pulling and presenting poses; use shared rig constants for artwork and composition contact geometry instead of duplicate 35-unit arm assumptions.
- Keep `NewYearScene.GiftWrapping`, its existing trigger and labels, and the two-elf reversal. Play a 16-second Lottie composition within the existing 18.5-second provider deadline.
- Load the light SVG build of `lottie-web` only when this scene needs animated playback. Supply a locally authored native-vector composition built once from the measured composer rectangle; use no external animation URL, fonts, expressions or raster assets.
- Give entrance, anticipation, pull, reaction and hops distinct timing, with sparse intentional Bézier easing and subframe interpolation. Facing never interpolates through zero scale.
- Draw the composer ribbon continuously with trim paths from the working grip, then retract it as front/back ribbon loops gather around the master. The loose end, cocoon and reel share the characters' contact geometry.
- Preserve drafts, selection, focus and layout by only measuring the composer. Keep both characters and every story beat on mobile; use a decorative parcel when the composer lacks room.
- Keep the static bound-master/proud-helper illustration for reduced motion, unsupported APIs or loading/rendering failure. Player import has a two-second deadline and SVG readiness a further 250 ms deadline, and waiting for the player import performs no host measurement.
- Bound player, asset and generated SVG complexity, destroy every scene instance on exit, and verify normal-speed motion, ribbon continuity and cleanup through tests and browser recordings/profiles.

## Capabilities

### New Capabilities

- `new-year-gift-wrapping`: The wrapping story, choreography, safe host interaction, fallbacks and resource budgets.

### Modified Capabilities

None. Existing New Year effects and the confetti secret remain unchanged.

## Impact

The original addition includes `libs/celebrations/src/new-year`, its README, and the app's translation enum/locales. The completed Lottie slice replaced scene-local choreography/player code and added native vectors plus the `lottie-web` implementation dependency. The current artwork slice changes `components/NewYearGiftWrapping/GiftWrappingArt.tsx`, `assets/gift-wrapping-elves.json`, the shared arm rig, `utils/gift-wrapping-composition.ts`, focused tests and these documents; it adds no further dependency. `CelebrationHost.tsx:30` already supplies the composer anchor. Retain the finite measured-artwork lifecycle of `libs/celebrations/src/new-year/components/NewYearGiftWrapping/NewYearGiftWrapping.tsx:14` and target eligibility in `libs/celebrations/src/new-year/utils/gift-wrapping-targets.ts`.

Library isolation: `CelebrationEnvironment` continues to supply host anchors, mobile state and labels; the provider owns selection/deadline. Lottie is a private rendering dependency, not a peer or host integration. Its instance consumes local artwork and geometry only. No new app context, route, host class, API, telemetry, storage or global animation framework is introduced. The optional `giftWrappingToastMessage` label remains unchanged; this revision adds no labels.

## Non-goals

Live dragging, chat actions, audio, changing the active event, copying controls, rebuilding other celebrations with Lottie, loading third-party animations, or replacing UI-kit icons. The static fallback uses the same revised character design; its stationary presentation and no-player behavior remain unchanged.

## Acceptance criteria

- Animated and static elves visibly match the selected mischievous cartoon style at actual mobile/desktop size: distinct stocky/nimble silhouettes, small noses, expressive eyebrows and grins. Faces and hands remain readable on light/dark backgrounds.
- Upper arm, forearm and mitten remain connected with consistent proportions throughout working, pull and presentation poses. Their combined shoulder-to-grip reach is about 37 native-coordinate units; changing proportions cannot leave the ribbon at an old 70-unit hand position. Source SVG, native vectors and composition contacts agree with the shared rig in LTR and RTL.
- At actual size in LTR/RTL at 360, 900, 1280 and 1920 pixels, normal-speed playback makes the helper's pull, master's wrapping and their contrasting reactions readable without sound. Continuous movement does not stop at a repeated global pose grid, and direction changes never flatten a character through zero scale.
- The composer ribbon grows along a continuous contour from the grip and retracts during the reversal; front/back loops visibly pass around the master's body. Grips, loose ribbon, cocoon and reel remain attached during contact and departure.
- Exactly two elves and one non-looping Lottie instance; at most 12 top-level layers, 500 generated SVG descendants, 180 rendered path nodes, 80 KB minified static vectors, 240 KB serialized composition, 1,400 property keyframes and 900 static-artwork Bézier vertices. No filters, masks, particles or snapshots. The scene and engine add at most 80 KB gzip to the production scene load; actual build sizes must be recorded.
- Playback lasts 16 seconds; player import is bounded to two seconds, SVG readiness to a further 250 ms, and the provider still unmounts by 18.5 seconds. Waiting for the player import, reduced motion and unsupported-browser fallback read no host geometry.
- Interrupted/repeated playback releases the player, observers, listeners and timers without accumulating resources or altering the original composer. Preparation measures once; later geometry reads only respond to relevant cancellation events.
- Targeted tests, changed/full verification, docs validation, production build size and browser profiling are recorded separately from historical WAAPI evidence, including environment limitations. The new artwork requires fresh visual/contact and cost evidence; the prior Lottie verification does not establish this redraw's quality.

## Alternatives and rollback

Scaling the old arms or adjusting easing alone would leave the rejected silhouettes and duplicated grip geometry. Redrawing the vectors while retaining the Lottie story addresses the selected style and the joint defect with a bounded scene-local change. More realistic characters and new story mechanics are outside the user-selected direction. The redraw can be reverted with its matching rig/contact data without changing the player, labels or host contract.

Keeping WAAPI and rewriting its paths is the conservative alternative and avoids a new dependency, but still requires replacing the sampled pose system and coordinating path drawing with character tracks. A scene-local Lottie composition is selected because the user requested it and it gives the ribbon paths and characters one authored timeline. It still needs new choreography and normal-speed visual review; Lottie is not a guarantee of smooth or funny movement. A video/raster animation would not adapt cleanly to measured composer geometry and would lose the editable vector route. A library-wide engine migration is unnecessary scope.

The public event, selection and label contracts remain compatible. Hosts can disable `GiftWrapping` through existing selection. Reverting the scene-local player/composition and dependency restores the prior implementation without migrating host state.
