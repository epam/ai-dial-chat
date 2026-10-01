## Context

The scene uses two elves and a single golden ribbon. The officious master becomes the accidental present while the eager helper remains convinced he has done a good job. The completed Lottie revision supplies deliberate curves, continuous ribbon drawing and readable pauses. The user subsequently rejected the elf artwork and strange-looking arms, then selected mischievous, expressive cartoon characters. The current revision redraws both characters and replaces duplicated arm/contact assumptions with a shared rig, preserving the existing Lottie story and lifecycle.

Existing New Year scenes are registered in `libs/celebrations/src/new-year/event.ts`; the host supplies `anchors.composer`, translated labels and `isMobile`. The shared provider retains selection and an 18.5-second mount deadline. Scene-local React state owns preparation/fallback/termination; a pure composition builder owns geometry and choreography; a scene-local player adapter owns one Lottie instance and its cleanup.

## Goals / Non-Goals

Goals: mischievous cartoon characters with readable expressions and compact connected arms; continuous ribbon wrapping, deliberate character motion, readable comic setup and reversal, exact hand/ribbon/torso contacts, responsive measured staging, zero host mutation, finite lifecycle and bounded rendering cost.

Non-goals: a shared animation framework, migrating other scenes, external animation services, APIs, navigation, audio, interactive puppets, new anchors or provider refactoring. Keep the secret phrase assigned to confetti and preserve event lazy loading. Redraw the static SVG fallback to match the animated pair while retaining its existing behavior.

## Decisions

### One scene-local Lottie composition

Use `lottie-web`'s light SVG player as a dynamically imported implementation dependency, with one non-looping instance and local `animationData`. The player is requested only for animated gift-wrapping activation; reduced motion does not load it. Construct a fresh viewport-sized composition from native vector shapes and the resolved target geometry. No external URLs, fonts, expressions, raster assets, filters, masks or repeaters are required. There is no dependency on After Effects or an external asset service at runtime.

Use a 60 fps, 960-frame timeline with subframes enabled and a 16-second duration. The official [Lottie usage documentation](https://github.com/airbnb/lottie-web/wiki/Usage) describes local animation data, SVG rendering, subframe interpolation, lifecycle events and instance destruction. Sparse Bézier tracks replace the old global sampled pose grid; each continuous action has its own anticipation, acceleration and settling. A held expression or reaction uses an intentional pause. Do not restart the same easing curve at every old sample or interpolate a character's facing through zero scale.

This is an intentional cost trade-off against retaining WAAPI: path drawing and character motion share one authored timeline, but Lottie adds a player download and SVG updates. Browser profiles and build output must demonstrate the resulting cost. It is not an automatic smoothness improvement.

### Geometry and ribbon

Measure one eligible composer rectangle, or use a small decorative parcel when absent, clipped or lacking safe staging room. Inspect at most four candidates and 24 ancestors per candidate. A focused composer is eligible because it is only measured. Screen geometry is physical; direction comes from inherited CSS direction, not app i18n. Logical entrance/exit sides reverse in RTL without reflecting host text.

The elves use the upper composer edge as their workbench. Replace independently scaled ribbon segments with a continuous rounded contour. Its trim end advances around that contour from the working grip; during the pull, its trim start advances so the composer unwraps as the master becomes wrapped. Lottie's [trim-path shape modifier](https://lottiefiles.github.io/lottie-docs/shapes/#trim-path) supplies the drawing/retraction mechanism. Native paths and strokes remain vectors at every viewport size.

Use shared geometry for character grips, the loose ribbon endpoint and the master's attachment. Front and back cocoon loops occupy separate groups around the torso, so the ribbon reads as winding around a body rather than crossing an unrelated screen position. The cocoon, chest bow and tail joining the ankle band follow the master's body through his reaction and hops. The helper carries the reel from the same grip used by its motion track. Neither a trim path nor a moving character ever modifies the real composer.

### Comic timing and artwork

The 16-second story retains these ordered beats: entrance and inspection; wrapping; a proud pause and the helper's anticipatory lean; the pull and reversal; the stunned master's reaction and helper's double take; proud presentation versus frustrated hops; departure with the reel. Wrap/retract transitions happen continuously between beats, and the master's physical reaction follows the helper's pull. Both characters and every beat remain on mobile, with shorter travel and reduced secondary motion.

The selected style is mischievous, expressive cartoon elves. The stocky green master has a broad body and self-important posture; the nimble coral helper has a narrower silhouette and eager lean. Smaller noses leave space for readable eyes, eyebrows and grins. Mutually exclusive expression, surprise and annoyed groups prevent conflicting facial features from overlapping. The master changes from composed to shock and frustration, while the helper's double take resolves to a proud grin. The static bound master uses the annoyed expression. Broad shapes and front/back overlaps establish volume without filters. Match the source SVG, native Lottie vectors and stationary bound-master/proud-helper illustration so reduced motion does not restore the rejected character design. Compare actual-size light/dark silhouettes and faces during work, pull, presentation, cocoon reveal and hops.

### Shared compact arm rig

Replace the old two 35-unit arm segments with a compact articulated reach of about 37 native-coordinate units from shoulder to grip. Define the shoulder pivot, upper-arm length, elbow pivot, forearm length and wrist/grip in `libs/celebrations/src/new-year/utils/gift-wrapping-rig.ts`, consumed by the source artwork and composition builder. The compact working rig places the shoulder at `(17, -56)`, uses an 18-unit upper arm and a local palm at `(19, 0)`, for a 37-unit fully extended reach. Bent poses naturally shorten the shoulder-to-hand distance while both segment lengths stay constant. The reel support is `(-25, -35)`, the head pivot `(0, -66)`, the cap pivot `(0, -94)` and the leg pivot at y = -22. Native vector transforms must match those same values. The rig contains only character geometry; it knows nothing about host controls, services or application state.

Draw sleeves with small overlap at shoulder/elbow/wrist so rotation cannot open gaps. Keep elbow bends positive within the 20–120-degree working range instead of reversing the joint; place the master's sleeve behind the head so gestures do not obscure his face. Keep each hand attached to its forearm and each shading shape inside the corresponding limb group. The reel and ribbon derive their contact from the resulting grip, including nested transforms, body lean, responsive scale and RTL mirroring. Do not retain hardcoded 35-unit palm formulas beside the new artwork. Adjust working/pulling/presenting arm angles only as needed for the shorter limbs; preserve the authored story timing, ribbon route, reactions and body travel.

Geometry tests must compare contacts against actual emitted native transforms and confirm connected joint positions and compact reach across the working range, not merely compare constants with themselves. Inspect both motion and static poses at actual size; geometric coincidence alone does not prove a convincing sleeve, mitten or expression.

### Numerical budgets

- Exactly two elves and at most one Lottie instance, one reel and one fallback parcel.
- At most 12 top-level layers, 500 generated SVG descendants and 180 rendered path nodes.
- At most 80 KB of minified static vector artwork and 240 KB for the serialized viewport composition.
- At most 1,400 keyframes across animated properties and 900 Bézier vertices across static artwork.
- At most 80 KB gzip of incremental production scene/player payload; record the actual output and included chunks.
- Zero filters, masks, particles, raster assets, external asset requests, snapshots or DOM clone traversal.
- One bounded preparation measurement after the player import resolves. No scene-owned playback polling, per-frame DOM geometry reads or React state updates. Geometry rechecks occur only for relevant cancellation events.

Lottie owns its rendering loop; the scene does not add another loop to chase host geometry. These structural ceilings replaced the earlier WAAPI animation/keyframe limits and remain unchanged for the compact-arm redraw. Historical measurements do not establish the new renderer's cost. The main risk is SVG path update/paint cost on mobile; inspect actual browser profiles with recorded viewport and CPU conditions and do not equate an authored 60 fps timeline with measured display performance.

### Lifecycle and fallbacks

Register cancellation before requesting the player. Player import has a two-second deadline and SVG readiness has a further 250 ms deadline; do not measure anchors while awaiting the import. Reduced motion or missing required browser APIs renders the revised static illustration without requesting the player or reading host geometry. Import rejection, deadline expiry or player/rendering failure also selects that static fallback and clears partially initialized resources. Ignore a late import result after cancellation, timeout or unmount.

After the player becomes available, select/measure the target once, build the composition and start one instance. Complete playback in 16 seconds, leaving room for the bounded initial load within the unchanged 18.5-second provider lifetime. Cancellation immediately hides/removes decoration. On completion, error, timeout or unmount, destroy an initialized instance exactly once; remove listeners, disconnect observers and clear timers idempotently. Instance methods must not affect other celebrations or unrelated Lottie players.

Cancel on pointer/key/input/composition/focus, document scroll, viewport/visual viewport changes, relevant target/ancestor changes, target removal, hidden document, environment changes, navigation/unmount and motion preference changes. Ignore mutations originating inside the decorative layer, including Lottie's generated SVG updates, so animation does not cancel itself. Geometry rechecks are event-driven only. No host restoration writes are needed because the host is never hidden, copied or styled.

Missing/unsafe composers retain the full story on a decorative parcel. The overlay is inert, aria-hidden and pointer-transparent. Existing gift keyboard activation and the localized live notification remain the accessible entry/feedback path. The story needs no sound or live pointer control.

### Integration and isolation

Retain `NewYearScene.GiftWrapping`, event registration, the optional `NewYearLabels.giftWrappingToastMessage` default, app `NewYearI18nKeys.GiftWrappingToastMessage` and locale values. Update the README and Storybook coverage without new labels or public APIs. The app adapter supplies labels; do not add translation imports to the lib.

Declare `lottie-web` as a runtime dependency of `libs/celebrations`, not a peer the host must configure. The private rendering adapter consumes only local vectors and resolved scene geometry; it owns no auth, API, external service, app context or other host contract. There is no feature flag beyond the existing active event and scene-selection settings, and no cache, telemetry, persistence, route or generated API change. Regenerate the host install matrix for the dependency change. No structural architecture change is required.

## Risks / Trade-offs

- Changed arm lengths can detach the ribbon or expose joint gaps: share the rig, test emitted native transforms against contact paths, and inspect the full gesture range on mobile/desktop.
- Expressive faces can become unreadable at scene size: compare light/dark working and reaction poses with the preceding Lottie art, retaining the selected cartoon direction.
- Bad choreography remains bad in Lottie: inspect complete normal-speed recordings, especially pull anticipation, the continuous wrap/retract transition, reaction pauses and hopping recovery.
- Ribbon contact or occlusion may look detached: test shared grip/torso coordinates and inspect intermediate trim states, not only finished poses.
- Dynamic import and SVG startup can consume the scene lifetime: bound import to two seconds and SVG readiness to a further 250 ms and use static fallback for errors or timeout; test cancellation and late resolution.
- Generated SVG mutations can trigger observers: exclude the decorative subtree while retaining real target/ancestor invalidation.
- SVG updates can repaint and the player adds bytes: enforce both structural and gzip limits; separately record mobile/desktop frame, layout and paint evidence.
- Font/layout changes can move the composer: stop on relevant geometry notifications instead of chasing it during playback.
- Narrow/short viewports may lack staging room: retain the same plot on the decorative parcel with both elves.

## Migration Plan

No public migration. Hosts retain the same scene selection and labels. Revert the scene-local composition/player and `lottie-web` dependency to roll back the renderer. The revised static SVG illustration provides the same fallback without requiring a host installation or configuration change. The artwork/rig revision can be rolled back together while keeping the Lottie player and public contract unchanged.

## Open Questions

Recheck the unchanged 80 KB gzip scene/player ceiling and structural budgets against the revised vectors. Record fresh browser evidence for the shorter arms and faces, including viewport/CPU conditions and limitations. Previous WAAPI and Lottie recordings do not establish the redraw's visual quality, contact correctness or frame cost.
