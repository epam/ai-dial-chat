# new-year-cat-bauble Specification

## Purpose

Defines the New Year "The bauble" scene: a cat misses a fir bauble, swats an inert copy of the model selector into the fir, where it hangs as an ornament, and carries it back to its slot, with a drawn tangerine fallback, one shared Lottie clock and bounded rendering cost.

## Requirements

### Requirement: A cat hangs the model selector on the fir as an ornament

The New Year event SHALL provide the finite `NewYearScene.CatBauble` (`cat-bauble`) scene, "The bauble". It SHALL play one non-looping native-vector Lottie composition of 23,000 ms (`CAT_BAUBLE_MS`). The provider SHALL own a mount deadline of `CAT_BAUBLE_MS + 2500` (25,500 ms). The scene state SHALL be owned by the `NewYearCatBauble` component through the existing `useLottieSceneSession` hook. No new context is introduced.

The scene SHALL show these beats, in this order, on the composer's upper rim:

1. A grey tabby cat with white chest and paws, amber eyes and a red collar with a gold bell fades in near the rim's selector-side end and trots, tail up, toward a small drawn fir at the opposite end. The fir has three baubles and one empty hook on the branch facing the cat.
2. It stops below the lowest bauble. Its pupils widen, its ears turn forward, it crouches and wiggles its rear twice, then pounces.
3. The bauble swings away from the paw before contact, and the cat misses. It lands forelegs first, then hind legs, and grooms a forepaw, head down, in a displacement pause.
4. It looks back, turns, and walks to the model selector. It lies on the rim, stretches one foreleg down over the edge to the selector's top, and flicks the selector's inert copy up onto the rim. It then stands behind it and swats it toward the fir.
5. The copy slides along the rim, decelerating, and strikes the fir's trunk. On contact the fir tilts, all baubles swing with distinct phases, and the copy pops up onto the empty hook.
6. The fir leans toward the cat. The cat freezes, ears flat, with its tail puffed, until the fir straightens back.
7. The copy hangs on the hook and swings with a decaying pendulum. The cat sits and tilts its head at it, first one way, then the other.
8. The cat rears up on its hind legs, takes the copy in its mouth by the grip it hung from, unhooks it and walks back carrying it. The copy's bottom slides along the rim when it would otherwise sink below it.
9. It lowers the copy into the selector's exact slot.
10. It curls up beside the selector for a moment, stretches with its forelegs out, and walks off through the selector-side end, fading out before the playback ends.

The story SHALL read without sound or text.

#### Scenario: Full story with an eligible selector

- **WHEN** a gift click selects `cat-bauble` and an eligible model selector exists
- **THEN** every beat plays in order within 23 s
- **AND** the original selector is hidden only from the paw contact until the copy is back in its rect, and it is visible again before the scene ends

#### Scenario: The miss is visible

- **WHEN** the plan is sampled at the pounce apex
- **THEN** the lowest bauble has swung away from the cat's forepaw by more than its own radius

### Requirement: Contacts follow the measured geometry

The composition SHALL be planned once from measured geometry, and its contacts SHALL hold at every 60 fps frame of the relevant beat.

- **Feet.** The cat's feet SHALL stay on or above the rim (`composer.top − 3 px`), within 0.6 px.
- **Hook contact.** At the paw contact time, the stretched forepaw tip SHALL be within 2 px of the selector's top centre. The copy SHALL not move before that frame.
- **Slide.** The copy's bottom SHALL rest on the rim while it slides. Its leading edge SHALL meet the trunk at the impact time, within 2 px.
- **Grip.** The copy hangs and is carried by one grip on its top edge, 8 px in from its fir-side end, so its body stays clear of the branches. The tangerine hangs by its stem.
- **Hanging.** While on the hook, the copy's grip SHALL stay within 1 px of the hook.
- **Carry.** While carried, the cat's mouth SHALL be within 2.5 px of the copy's grip, except where the copy's bottom is clamped to the rim.
- **Return.** At and after the restore time, the copy's keyframes SHALL have zero translation and zero rotation (modulo 360°).

A selector SHALL be eligible only when all of the following hold:

- It is the first element with the `composerModelSelector` class inside the measured composer.
- It is a `button` or `[role="button"]`.
- It is connected, visible, idle and not disabled, expanded, editable, hidden, inert, focused, hovered or transformed.
- It is 36–140 × 24–44 px, has at most 40 nodes, and is unclipped.
- Its top lies no more than the cat's reach below the rim.

Otherwise the tangerine mode SHALL play the same story with a drawn tangerine and borrow nothing.

#### Scenario: Paw meets the selector

- **WHEN** the plan is probed at the hook contact
- **THEN** the forepaw tip is within 2 px of the selector's top centre, and every copy keyframe before it has zero translation

#### Scenario: A focused or oversized selector

- **WHEN** the selector is focused, expanded, wider than 140 px, taller than 44 px or out of the cat's reach
- **THEN** the scene plays in tangerine mode, `animateCelebrationSnapshots` is never called and the selector is untouched

#### Scenario: No composer room

- **WHEN** no eligible composer leaves 180 px of headroom on desktop or 150 px on mobile
- **THEN** the static still shows and the player is not loaded

### Requirement: The selector copy is inert, synchronized and always restored

The copy SHALL be an `aria-hidden`, inert, pointer-transparent snapshot made by `animateCelebrationSnapshots` inside one scene-owned layer, which is prepended beneath the renderer's SVG. Its WAAPI keyframes SHALL be generated from the same plan as the Lottie data and started at the document-timeline time of Lottie frame 0, reported by `onPlaybackStarted`. Only the original's opacity SHALL change. It SHALL never be clicked, focused, cloned into the page or reparented.

Any of the following SHALL cancel the scene and release the player, copy, layer, observers, listeners and timers at once:

- typing, pointer, focus or keyboard interaction;
- scrolling or a viewport resize;
- a mutation, move or disconnection of the composer or selector;
- a hidden tab, navigation, scene replacement or unmount;
- a reduced-motion change.

A snapshot stop before the restore time SHALL be treated as an interruption.

#### Scenario: Interruption mid-story

- **WHEN** the user presses a pointer while the copy hangs on the fir
- **THEN** the scene unmounts, the copy and its layer are removed and the original selector is fully visible

#### Scenario: Replay leaks nothing

- **WHEN** the scene is activated and cancelled five times
- **THEN** each run starts and stops exactly one copy and no scene layer, copy or timer remains

### Requirement: Adaptations keep the story coherent

- **Mobile** SHALL keep every beat, with a smaller cat and fir (scale 0.6 instead of 0.82) and the stage limited to the measured rim.
- **RTL** SHALL mirror the travel and artwork by using the composer's logical start and end. The copy's text SHALL never be mirrored. The copy only translates and rotates.
- **Reduced motion, missing `ResizeObserver`/`MutationObserver`, or a player failure** SHALL show `CatBaubleStill`, an `aria-hidden` SVG of the cat sitting under the fir with a drawn ornament on the hook. It SHALL not load the player or measure the host under reduced motion.
- **Activation** SHALL stay the existing gift trigger. Touch, Enter and Space SHALL activate it as before, and the scene layer SHALL be `inert`, `aria-hidden` and pointer-transparent.
- **Labels.** The notification SHALL use `catBaubleToastMessage`, with the English default `Every tree needs one more ornament. Send "{{phrase}}" in the start-page chat for a secret surprise.` DIAL Chat SHALL supply it from `newYear.catBaubleToastMessage` (`NewYearI18nKeys.CatBaubleToastMessage`).
- **Gating.** The scene SHALL be gated only by the existing `UI_EVENT=new-year` selection and the host's disabled-scene list. No feature flag, telemetry, persistence or cache is added, and no memoisation beyond the session's single preparation is required.

#### Scenario: RTL story

- **WHEN** the composer is right-to-left
- **THEN** the fir stands at the logical end far from the selector, the cat travels in mirrored directions, and the copy keyframes contain no negative horizontal scale

#### Scenario: Reduced motion

- **WHEN** reduced motion is preferred
- **THEN** the still shows, the player is not loaded and no host element is read or borrowed

### Requirement: The scene stays inside its rendering budgets

The scene SHALL budget:

- one player, one cat, one fir and one copy, the copy at most 140 × 44 px with at most 40 nodes;
- at most 8 top-level layers;
- at most 60 animated properties on desktop and 48 on mobile;
- at most 1,400 keyframes in total and 160 per property;
- at most 180 KB of composition data on desktop and 130 KB on mobile;
- at most 200 vector groups and drawn shapes, which approximates the player's generated SVG nodes.

It SHALL use no external or raster assets, filters, masks, gradients, per-frame host measurements or React updates during playback. Preparation SHALL read at most four composers, four selector candidates and 24 ancestors. These limits are structural budgets, not a frame-rate guarantee.

#### Scenario: Budgets on every layout

- **WHEN** the composition is built for desktop and mobile in LTR and RTL, in selector and tangerine modes
- **THEN** every limit above holds and every layer's in and out points lie inside the playback
