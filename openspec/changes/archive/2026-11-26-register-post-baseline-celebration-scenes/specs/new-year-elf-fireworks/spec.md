## Purpose

Defines the bundled New Year "Elf Fireworks" scene as the code implements it. An elf fishes an inert copy of the composer's send button onto the rim, stomps it to launch fireworks, rides the last rocket away and returns the copy to its slot. The scene has a drawn detonator fallback, one shared Lottie clock and bounded rendering cost.

## ADDED Requirements

### Requirement: An elf launches fireworks from the send button

The New Year event SHALL provide the finite `NewYearScene.ElfFireworks` (`elf-fireworks`) scene. It plays one non-looping native-vector Lottie composition of 25,600 ms (`ELF_FIREWORKS_MS`). The `NewYearElfFireworks` component SHALL own the scene's state through the existing `useLottieSceneSession` hook. No new context is introduced. The scene SHALL be in the gift-click pool (`NEW_YEAR_CLICK_SCENES`).

#### Scenario: The scene is registered
- **WHEN** the New Year event module is read at `libs/celebrations/src/new-year/event.tsx`
- **THEN** it declares `elf-fireworks` with the label `elfFireworksToastMessage` and the duration from `NEW_YEAR_SCENE_DURATIONS`, and `NEW_YEAR_CLICK_SCENES` lists it with `penguin-star`, `snowman-delivery` and `cat-bauble`

#### Scenario: Stale pool count in #9976
- **WHEN** the scene is compared with the #9976 description, which says the gift-click pool "now has three scenes"
- **THEN** the code is followed: since #9996 the pool has four scenes, and this disagreement is recorded rather than resolved in favour of the PR text

### Requirement: The story plays its beats in order on the composer rim

On the composer's upper rim, the composition SHALL play the beats of `ELF_FIREWORKS_BEATS`, in this order:

1. entrance with the sack;
2. rockets tossed onto a rack;
3. the idea;
4. fishing the launcher;
5. a useless press by hand;
6. the stomp and the fireworks;
7. the kick home;
8. the dud ride and the finale;
9. the fall, the cap and the exit.

The story SHALL read without sound or text.

#### Scenario: Full story in button mode
- **WHEN** a gift click selects `elf-fireworks` and an eligible send button exists
- **THEN** the following plays in order:
  - The elf fades in on the rim with the sack on its back, at most 150 elf units past its toss spot and no more than 6 px beyond the inline-end edge. By 1.9 s it walks to the toss spot, 26 elf units short of the sack spot at 55 % of the rim, and it sets the sack down at 2.3 s.
  - Between 2.75 s and 4.85 s it tosses the rockets from the sack onto a rack that runs from 8 % of the rim toward the sack. The last rocket on the rack, nearest the sack, is the dud.
  - It looks along the rim, starts with surprise at an idea, and walks to the fishing spot.
  - It lowers a candy cane, hooks the send button's copy at 8.45 s, tugs twice, and yanks at 9.45 s. The copy arcs up with one full turn and lands on the rim at 10.05 s with a squash.
  - It walks to the copy and presses it by hand at 11.25 s, squashing it to 88 %. Nothing happens, and it scratches its cap.
  - It jumps and stomps the copy with both boots at 12.8 s, squashing it to 72 %. The fuses ignite, and between 13.15 s and 14.83 s the regular rockets launch in rack order, starting from the end farthest from the sack, each bursting 0.85 s after launch. The elf cheers with two small hops on the copy.
  - It hops off on the start side and kicks the copy home. The copy arcs back with one full turn into its own rect by 16.55 s.
  - It walks to the dud and peers in. The dud fires at 18.05 s, the elf grabs its grip, and it is dragged and then lifted above the viewport by 19.25 s. Its cap pops off and flutters down to the rim, and the finale bursts at 19.4 s.
  - It falls from above the viewport onto the rim beside its cap at 20.8 s and is dizzy. It puts the cap back on at 22.65 s, bows, and walks out with the sack toward the inline-end side, fading out by 25.45 s.

#### Scenario: The press by hand does nothing
- **WHEN** the composition is probed at the press beat
- **THEN** the elf's hand is within 2 px of the launcher's top, the launcher's vertical scale is 0.88, and no rocket has launched before the stomp

### Requirement: The send button is chosen and measured once, before any copy

`getElfFireworksTargets` SHALL measure the composer and its send button once per activation, after the player import, using the shared composer measurement `measureComposer`. That measurement requires a composer at least 300 px wide with 170 px of headroom on desktop, or 240 px and 140 px on mobile. The elf's floor is `composer.top − 3 px`. Only the inline-end-most button among the first 16 composer buttons may be borrowed. If that button is ineligible, no other button stands in for it.

#### Scenario: Inline-end-most button
- **WHEN** a left-to-right composer contains three rendered buttons
- **THEN** the right-most button is the candidate, and in a right-to-left composer the left-most is

#### Scenario: The end button cannot be borrowed
- **WHEN** the inline-end-most button is focused
- **THEN** the scene plays in detonator mode and borrows no other button

### Requirement: Send-button eligibility is checked before cloning

The candidate SHALL be borrowed only when it is connected, rendered, visible, untransformed and animatable; outside hidden, inert, `aria-hidden` or snapshot subtrees; idle; 24–120 × 24–64 px inside the composer; unclipped by its first 24 ancestors; at most 40 nodes; and reachable by the cane. Every check runs before `animateCelebrationSnapshots` clones it. A disabled send button SHALL stay eligible, because only its copy moves.

#### Scenario: A busy or hidden button
- **WHEN** the send button is expanded, focused or contains focus, is hovered or pressed, has zero opacity, is transformed, or sits inside a hidden, inert or `aria-hidden` subtree
- **THEN** the scene plays in detonator mode

#### Scenario: Size and placement
- **WHEN** the send button is smaller than 24 × 24 px, larger than 120 × 64 px, extends more than 1 px outside the composer rect, or is clipped by one of its first 24 ancestors
- **THEN** the scene plays in detonator mode

#### Scenario: Too many nodes
- **WHEN** the send button contains more than 39 descendant elements
- **THEN** the scene plays in detonator mode and `animateCelebrationSnapshots` is never called

#### Scenario: The cane cannot reach
- **WHEN** the cane length from the elf's fishing hand to the send button's top would be under 8 px or over 200 px, as with a button low in a tall composer
- **THEN** the scene plays in detonator mode

#### Scenario: No room to fish
- **WHEN** the fishing spot in front of the send button lies closer to the rim's start than the press spot plus 12 elf units
- **THEN** the scene plays in detonator mode

#### Scenario: A disabled send button
- **WHEN** the send button is disabled but otherwise eligible
- **THEN** its inert copy is borrowed, and the original's disabled state is unchanged

### Requirement: Contacts follow the measured geometry

The composition SHALL be planned once from the measured targets. The contacts in the scenarios below SHALL hold on desktop and mobile, in LTR and RTL, at every 60 fps frame of their beat.

#### Scenario: Hook contact
- **WHEN** the composition is probed at the hook beat
- **THEN** the cane's hook is within 1.5 px of the launcher's top, and that top equals the button's measured top

#### Scenario: Standing on the launcher
- **WHEN** the composition is probed just after the stomp, at the end of each cheering hop and at the hop-off beat
- **THEN** the elf's feet are within 1.5 px of the launcher's top and within 1 px of its centre line

#### Scenario: Boots on the rim
- **WHEN** the composition is probed at every frame of the playback
- **THEN** the elf's boots never sink more than 0.6 px below the rim

#### Scenario: Riding the dud
- **WHEN** the composition is probed at every frame between the dud's ignition and its exit
- **THEN** the hand is within 2.5 px of the dud's grip

#### Scenario: The cap
- **WHEN** the composition is probed when the cap lands and at the beat where the elf puts it back on
- **THEN** the cap rests at the floor minus 17 elf units, and from that beat it is drawn on the head again

### Requirement: The drawn detonator replaces an ineligible send button

When the composer qualifies but no send button is eligible, the scene SHALL play the same story in detonator mode (`ElfFireworksMode.Detonator`). The elf digs in the sack instead of fishing. It pulls out a drawn detonator box with a plunger, presses and stomps it like the copy, and kicks it back into the sack. No host element SHALL be borrowed, and no button layer is created.

#### Scenario: No send button
- **WHEN** the composer contains no eligible button
- **THEN** the host element reports `data-elf-fireworks-mode="detonator"`, the composition contains a `detonator` layer, the copy keyframes are empty, and `animateCelebrationSnapshots` is never called

### Requirement: The still replaces playback when the scene cannot play

`ElfFireworksStill` (the elf cheering under one frozen burst) SHALL be shown, in an `inert`, `aria-hidden` wrapper, in place of playback when:

- reduced motion is preferred;
- `ResizeObserver` or `MutationObserver` is missing;
- no composer qualifies (`ElfFireworksMode.Static`);
- measurement or composition throws;
- the player fails to load, initialise or render.

Under reduced motion the player SHALL not be loaded and the host SHALL not be measured.

#### Scenario: Reduced motion
- **WHEN** reduced motion is preferred
- **THEN** the still shows, the player is not loaded, `animateCelebrationSnapshots` is never called, and no timer remains after unmount

#### Scenario: No composer room
- **WHEN** the composer leaves less than the required headroom above it
- **THEN** the still shows and no animation is created

### Requirement: The send-button copy is inert, synchronized and restored

The copy SHALL be an `aria-hidden`, inert, pointer-transparent snapshot made by `animateCelebrationSnapshots` in one scene-owned layer prepended beneath the renderer's SVG. Its keyframes come from the same plan as the Lottie data and start at the timeline time of Lottie frame 0, reported by `onPlaybackStarted`. Only the original's opacity changes. The original is never clicked, focused or reparented.

#### Scenario: Copy starts on the composition clock
- **WHEN** the first Lottie frame is reported
- **THEN** exactly one snapshot animation starts, for the send button, in the button layer, with a duration of 25,600 ms and a start time equal to the timeline time of frame 0, and the composer's draft and the button's markup are unchanged

#### Scenario: The swap is invisible
- **WHEN** the copy keyframes are read
- **THEN** the copy is shown from before the original starts to fade at the hook until after the original has faded back in after the restore
- **AND** every keyframe at or after the restore has zero translation, a vertical scale of 1 and a rotation that is a multiple of 360°

### Requirement: Interruptions end the scene and release everything

User interaction, scrolling, a viewport change, a hidden tab, a change to the composer or send button, a changed environment, navigation, an event change, scene replacement and unmount SHALL each cancel the scene. Cancelling SHALL release the player, copy, layer, observers, listeners and timers at once.

#### Scenario: Interaction mid-story
- **WHEN** a pointer, click, keyboard, focus, `beforeinput`, input, composition, scroll or resize event fires during playback, including a visual-viewport scroll or resize
- **THEN** the scene unmounts with no still, the copy is stopped once, and no player, layer or timer remains

#### Scenario: Hidden tab
- **WHEN** the tab becomes hidden during playback, or is already hidden when the session starts or when the player has loaded
- **THEN** the scene is cancelled

#### Scenario: Host target changes
- **WHEN** the composer or the borrowed send button mutates, moves or disconnects (`observeSceneTargets`)
- **THEN** the scene is cancelled

#### Scenario: Environment changes
- **WHEN** the anchors, the mobile layout flag or the reduced-motion preference change after activation
- **THEN** the scene renders nothing and its session is disposed

#### Scenario: Provider-owned endings
- **WHEN** the user navigates, the event changes, another activation replaces the scene, or the scene unmounts
- **THEN** `CelebrationProvider` unmounts it, and its session releases every resource

#### Scenario: Snapshot stop before the restore
- **WHEN** the snapshot helper stops the copy before the restore time
- **THEN** the whole scene is cancelled, not only the copy

#### Scenario: Replay leaks nothing
- **WHEN** the scene is activated and cancelled five times
- **THEN** each run starts and stops exactly one copy, and no button layer, scene host or timer remains

### Requirement: The story ends inside its deadlines

The session SHALL use a 2,000 ms load deadline, a 250 ms readiness deadline and a 25,600 ms playback deadline (`ELF_FIREWORKS_TIMINGS`). The provider SHALL own a mount deadline of `ELF_FIREWORKS_MS + 2500` (28,100 ms). Every layer's in and out points, and every burst's lifetime, SHALL lie inside the 25,600 ms playback. The elf and the sack SHALL fade out by 25.45 s.

#### Scenario: Natural end
- **WHEN** playback reaches 25,600 ms without interruption
- **THEN** the session ends, the scene renders nothing, the copy has been stopped, and the provider's deadline at 28,100 ms finds no scene resources left

### Requirement: Layout and direction adapt without changing the story

- **Mobile** SHALL keep every beat with a smaller elf (0.58 instead of 0.72 CSS px per unit), 3 launched rockets instead of 5, 8-spark bursts and a 12-spark finale instead of 12 and 18, and a burst radius of 52 px instead of 78 px.
- **RTL** SHALL follow the measured composer's direction. It mirrors the elf's travel and artwork. The copy only translates, rotates and scales vertically, so its text is never mirrored.

#### Scenario: RTL composer
- **WHEN** the composer is right-to-left
- **THEN** the rim runs from the composer's right edge, the left-most button is borrowed, and the copy keyframes keep a horizontal scale of 1

#### Scenario: Mobile layout
- **WHEN** the scene plays on mobile
- **THEN** 3 regular rockets launch, 4 bursts play (3 × 8 sparks plus a 12-spark finale), and every beat of the desktop story is present

### Requirement: The notification uses the existing New Year label

The scene's notification SHALL use `elfFireworksToastMessage`, whose English default is `Some buttons were made for launching. Send "{{phrase}}" in the start-page chat for a secret surprise.` DIAL Chat SHALL supply its translation from the i18n key `newYear.elfFireworksToastMessage` through `NewYearI18nKeys.ElfFireworksToastMessage`.

#### Scenario: Translated notification
- **WHEN** DIAL Chat plays the scene
- **THEN** the notification shows the translated `newYear.elfFireworksToastMessage`, with the secret phrase interpolated

### Requirement: Activation and gating stay those of the New Year event

Only the existing gift trigger SHALL activate the scene. Its layer SHALL be `inert`, `aria-hidden` and pointer-transparent. The scene SHALL be gated only by the `UI_EVENT=new-year` selection and the host's disabled-scene list. It has no `ENABLED_FEATURES` key, telemetry, persistence or cache, and nothing is memoised beyond the session's single preparation.

#### Scenario: Keyboard activation
- **WHEN** the gift trigger is activated with Enter or Space
- **THEN** a click scene is picked as for a pointer click, and the scene layer takes no focus or pointer events

#### Scenario: Host disables the scene
- **WHEN** the host disables `elf-fireworks` for the New Year event
- **THEN** gift clicks pick only among the remaining enabled click scenes, and the elf never plays

### Requirement: The scene stays inside its enforced rendering budgets

The scene's suite SHALL enforce:

- one player and at most one copy;
- at most 17 layers;
- on desktop, 5 launched rockets plus the dud, 5 bursts of 12 sparks and an 18-spark finale (78 sparks);
- on mobile, 3 rockets plus the dud, and 36 sparks;
- serialized composition data under 220,000 characters on desktop and 150,000 on mobile;
- every burst inside the viewport width, with its centre more than 100 px above the rim.

#### Scenario: Budgets on every layout
- **WHEN** the composition is built for desktop and mobile, in LTR and RTL, in button mode
- **THEN** every limit above holds, and every layer's in and out points lie inside the playback

### Requirement: Playback reads no host layout and adds no hidden cost

During playback the scene SHALL make no host layout reads per frame and no React updates. It SHALL run no interval or per-frame timer, and it SHALL use no external or raster assets, filters, masks or gradients. The copy SHALL use at most two WAAPI animations: the copy's transform and the original's opacity. The detonator mode uses none. No cap on keyframes, animated properties or SVG nodes is enforced.

#### Scenario: Geometry only on observer callbacks
- **WHEN** the scene plays to its end without host changes
- **THEN** host rectangles are read only during preparation and in `ResizeObserver` or `MutationObserver` callbacks, and the only timers are the session's three deadlines, the snapshot helper's deadline and the provider's deadline

#### Scenario: Unenforced dimensions are reported, not assumed
- **WHEN** a reviewer compares this scene's budgets with `new-year-cat-bauble`
- **THEN** keyframe, animated-property and SVG-node counts are taken from a measurement at a named revision, because this scene's suite enforces no limit for them
