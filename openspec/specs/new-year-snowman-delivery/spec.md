# new-year-snowman-delivery Specification

## Purpose

Defines the New Year "Delivery Without Losing Your Head" scene: a snowman sleds on a borrowed starter card, loses his head in a fir on impact, recovers it and returns the card, with adaptive staging, exact card restoration, one shared Lottie clock and bounded rendering cost.

## Requirements

### Requirement: The snowman delivers a present on a borrowed card

The New Year event SHALL provide the finite `NewYearScene.SnowmanDelivery` (`snowman-delivery`) scene, "Delivery Without Losing Your Head". It SHALL play one non-looping native-vector Lottie composition of 25,000 ms (`SNOWMAN_DELIVERY_MS`). The provider SHALL own a mount deadline of `SNOWMAN_DELIVERY_MS + 2500` (27,500 ms).

The scene SHALL show these beats, in this order:

1. A slightly pompous snowman enters carrying a wrapped present. He wears a burgundy scarf and mittens and has a prominent carrot nose and expressive brows.
2. He notices a small tree at the far end of his stage, looks at the distance and at a nearby starter-prompt card, and shows an idea.
3. He balances the present on his head, grips the card with both mittens (jumping for it when it is above his reach and hanging until his weight tears it free) and visibly pulls an inert visual copy of it free.
4. He places the copy on the stage floor, tests it with one foot, sits on it and hugs the present to his belly.
5. He pushes off twice and slides. His expression changes from cautious to smug, and his scarf trails behind with a delay.
6. The card stops in a snowbank near the tree. His body compresses and settles, while his head keeps going and lodges in the tree's lower branches. The present stays in his mittens.
7. A hold, while the head glares indignantly at its body.
8. The body places the present under the tree, feels above its shoulders and spreads its mittens in confusion.
9. The head sneezes. The branch flexes and drops the head into the waiting mittens.
10. He puts the head on backwards, pauses, and corrects it.
11. He straightens the present.
12. He returns the card copy exactly to the original card's position.
13. He walks away holding his head with both mittens.
14. A brief hold on the tree and the delivered present, after which every decoration is removed before the deadline.

The joke SHALL be readable without sound or text.

#### Scenario: Full delivery with an eligible card

- **WHEN** the New Year gift selects SnowmanDelivery and an eligible starter card exists
- **THEN** every beat plays in order within 25 s, and the card copy follows the mitten grips while it is handled and the seat while it is ridden
- **AND** the original card is hidden only from the grip contact until the copy is back in its slot, and it is visible again before the scene ends

#### Scenario: The joke reads without sound

- **WHEN** the scene plays muted at the actual desktop or mobile size
- **THEN** the intention, the impact, the detached head, the sneeze-driven recovery and the backwards-head correction are distinguishable from silhouette, pose and expression alone

### Requirement: Impact, head flight and recovery follow causal order

The composition SHALL make the stop read as cause and effect.

- **Impact order.** The card's forward motion SHALL stop at the snowbank contact frame. Body compression SHALL begin no later than one frame after contact. The head SHALL stay on the neck socket until at least three frames after contact, then separate.
- **Head launch.** The horizontal launch speed SHALL equal the sled's speed at contact within ±20 %. The arc SHALL end in the lower branches, with a flight time of 0.35–0.7 s and at most 1.25 head rotations.
- **Lodged head.** While lodged, the head SHALL follow the branch tip. The branch SHALL dip on landing and recoil with one overshoot.
- **Release.** At the sneeze, the branch flex SHALL begin before the head is released. The head SHALL land in the mittens with its bottom within 1.5 native units of the mitten grip.
- **Backwards head.** It SHALL be shown by swapping the front and back face groups with hold keys while the head is lifted. No transform SHALL interpolate through zero scale.

#### Scenario: The stop sequence

- **WHEN** the plan is sampled around the snowbank contact
- **THEN** sled contact, body compression and head separation occur in that order, with the separation at least three frames after contact

#### Scenario: Head momentum

- **WHEN** the head's launch velocity is compared with the sled's velocity at contact
- **THEN** the horizontal components differ by at most 20 %, and the landing point is the lower-branch socket

#### Scenario: Branch recoil releases the head

- **WHEN** the head sneezes
- **THEN** the branch rotation changes before the head leaves the branch, and the head is caught by both mittens

### Requirement: Character motion uses planted contact and secondary motion

Separate tracks SHALL drive the body (squash ≤8 %), the head, the scarf tail, the two articulated arms with mittens, the present, the branch, the drawn sled (decorative modes) and the particles.

- **Walking and handling.** These SHALL plant the feet: a planted foot's world x SHALL drift by at most 0.5 native units. No rigid whole-body slide SHALL occur outside the sled ride.
- **Grips.** Mitten-to-card and mitten-to-present grips SHALL stay within 1.5 CSS px of the gripped point throughout handling and return. Each grip SHALL hold still for at least 100 ms around every change of contact.
- **Gaze holds.** Before the idea, the snowman SHALL look at the tree, along the distance and at the card, holding each gaze for at least 300 ms.
- **Scarf.** The scarf tail SHALL lag the body by 80–150 ms during the slide.
- **Readability.** The silhouette and expressions SHALL be readable at the actual mobile size on light and dark host surfaces.

#### Scenario: Hand and card contact

- **WHEN** the plan's card track is compared with the rig's mitten grips during handling and return
- **THEN** every sampled grip is within 1.5 CSS px of the card's grip points

#### Scenario: Planted feet while walking

- **WHEN** a foot is in stance during the entrance, the return walk or the exit
- **THEN** its world x changes by at most 0.5 native units until it lifts

### Requirement: Staging adapts to measured geometry

At preparation, after the player import, the scene SHALL measure the host anchors once. It SHALL use only the host-provided `CelebrationAnchors` `composer`, `starterList` and `welcomeRegion`, and SHALL pick the first qualifying mode:

1. **Ledge.** The card's row is the lowest content in the welcome region, and a free band below it fits the reach-up stance. The snowman stands on a drawn snow ledge under the starter row and pulls the card copy down.
2. **Rim.** The composer is a safe stage, and the band above its upper edge across the travel span is clear of the heading and of every starter except the borrowed card. The snowman rides the composer's snowy upper edge.
3. **Rim with a decorative sled.** Used when no card is eligible or reachable.
4. **Self-contained snowy platform with a decorative sled.** Used when no safe composer stage exists.
5. **Static still.** Used when no free band exists for the platform.

The composer SHALL only be measured as a support. It SHALL NOT be copied, moved or restyled.

- **Travel.** The minimum travel SHALL be 160 px on desktop and 100 px on mobile. The maximum slide SHALL be 460 px on desktop and 220 px on mobile, and the longest ride that the viewport and the host content allow SHALL be chosen. He SHALL enter from at most 200 native units before his pickup stance, fading in, and the scene SHALL be clipped to the welcome region's horizontal extent.
- **Ledge height.** The ledge floor SHALL sit at the card's bottom plus its height plus 130 native units, so his seated head clears the starter row; a card taller than 66 native units SHALL NOT be borrowed for a ledge.
- **Rim reach.** A card above the rim SHALL be borrowed only when its bottom is 40–128 native units above the floor.
- **Host text.** The cast SHALL NOT overlap the heading, the composer's content or any starter other than the borrowed one, except for the mittens at the borrowed slot.

#### Scenario: Starters below the composer (default production layout)

- **WHEN** the starter list renders below the composer and its bottom row has an eligible card with a free band beneath
- **THEN** the scene uses the Ledge mode, the snowman reaches up to grip the card copy, and the composer is not covered

#### Scenario: Starters above the composer

- **WHEN** the starters render between the greeting and the composer, and the rim band over the travel span is clear except for the borrowed card
- **THEN** the snowman rides the composer's upper edge on the card copy

#### Scenario: No eligible card

- **WHEN** no starter card qualifies or none is reachable from the chosen stance
- **THEN** the same story plays with a drawn sled, and no host element is hidden or copied

#### Scenario: Unsuitable geometry

- **WHEN** neither the ledge band, the rim band nor a platform band fits inside the viewport
- **THEN** the static still is shown and no host element is hidden or copied

### Requirement: Card borrowing is bounded, inert and exactly reversible

The scene SHALL scan at most four buttons of the first starter list inside the welcome region. A card SHALL be eligible only when all of these hold:

- it is connected and visible;
- it is not disabled and not `aria-disabled`;
- it is not focused, does not contain focus, and is not in a hover or active state;
- it is not inside a hidden, inert or `aria-hidden` subtree, and is not itself a celebration snapshot;
- its computed `transform` is `none`;
- it is not clipped by a scrolling ancestor;
- it is inside the viewport;
- it is at least 36 × 24 and at most 240 × 96 CSS px;
- it has at most 40 nodes, including itself;
- it is reachable from the mode's stance.

At most one card SHALL be borrowed per activation. The visible prop SHALL be an inert, `aria-hidden`, pointer-transparent computed-style snapshot made with `animateCelebrationSnapshots` from `libs/celebrations/src/utils/celebration-snapshots.ts`. The original SHALL only have its opacity animated through WAAPI from the grip contact until restoration.

The scene SHALL NOT click, focus, reparent, detach or change the value or attributes of the original, and SHALL NOT change any application state.

The copy's text SHALL keep its scale (1.0, or at least 0.85 if review requires) and SHALL never be mirrored in RTL. The copy SHALL return to the original rect within 0.5 CSS px at least 200 ms before the original reappears.

#### Scenario: Exact restoration on completion

- **WHEN** the scene completes
- **THEN** the copy has matched the original rect within 0.5 px before the original reappeared, the copy is removed, and the original's opacity, transform, focus and selection equal their values before the scene

#### Scenario: Chat state is untouched

- **WHEN** a card is borrowed during playback
- **THEN** no click, send, navigation, draft change, focus change or selection change occurs in the host

### Requirement: Lottie and card copy share one clock

The card copy's WAAPI keyframes SHALL be generated from the same plan and rig as the Lottie composition. They SHALL start at the document-timeline time of Lottie frame 0, which the session's `onPlaybackStarted` callback reports. The card SHALL be drawn beneath the scene's SVG in one scene-owned layer. Choreography SHALL never place the card behind the snowman's body, except as the seat under him.

#### Scenario: Synchronized start

- **WHEN** playback starts
- **THEN** the card animation's `startTime` equals the reported frame-0 timeline time, and no per-frame resynchronization occurs

### Requirement: Interruption and completion release everything immediately

The scene SHALL end at once and restore the hidden original immediately on each of these:

- `pointerdown`, `click`, `keydown`, `focusin`, `focusout`, `beforeinput`, `input` or `compositionstart`;
- a window or `visualViewport` `scroll` or `resize`;
- the document becoming hidden;
- a change of reduced-motion preference, mobile mode or anchors;
- a mutation, geometry change or disconnection of the composer, starter list, borrowed card or heading;
- navigation or unmount;
- a player load or readiness failure;
- a failure of the companion animation.

Each ending SHALL:

- remove the copy and the card layer;
- cancel both WAAPI animations;
- disconnect every observer;
- remove every listener;
- clear every timer;
- destroy the Lottie animation exactly once.

A cancelled scene SHALL NOT reappear as its static still. Repeated activation and cancellation SHALL NOT accumulate DOM nodes, observers, listeners, animations or players.

#### Scenario: User types during the ride

- **WHEN** the user focuses the composer or types while the snowman is sliding
- **THEN** the scene disappears, the original card is visible in the same frame, and the typed input reaches the composer unchanged

#### Scenario: Repeated activation and cancellation

- **WHEN** the scene is activated and interrupted five times in a row
- **THEN** after each run no snapshot, card layer, observer, listener, animation or Lottie renderer remains, and the scene-layer DOM node count returns to its value before the first run

### Requirement: Responsive, RTL, reduced-motion and accessible presentation

**Mobile** (scale 0.68) SHALL keep every beat with the same single snowman. Only travel distances SHALL shrink, and particles SHALL be reduced to at most 4. **Desktop** SHALL use scale 0.9 and at most 10 particles.

**RTL** SHALL flip the travel direction and staging through the measured direction and logical sides. Copied text SHALL NOT be mirrored.

**Reduced motion, missing `ResizeObserver` or `MutationObserver`, and player failure** SHALL show `SnowmanDeliveryStill`. This is a static SVG of the snowman holding his head in both mittens beside the delivered present and the tree, with at most 60 nodes. It SHALL borrow no UI.

Every scene element SHALL be `inert`, `aria-hidden` and pointer-transparent. Keyboard activation of the gift trigger SHALL be unchanged. The notification SHALL be the only announced content.

#### Scenario: Narrow RTL mobile

- **WHEN** the scene plays at 360 px in RTL with starters below the composer
- **THEN** the full story plays with the tree on the inline-end side when room allows, the copied card's text reads unmirrored, and at most 4 particles appear

#### Scenario: Reduced motion

- **WHEN** reduced motion is preferred and SnowmanDelivery is selected
- **THEN** the static still shows until cleanup, no player loads and no host element is hidden or copied

### Requirement: Rendering resources stay within scene budgets

Each run SHALL be bounded as follows.

- **Cast and players:** one snowman, at most one borrowed card and one Lottie player.
- **Composition:**
  - at most 16 top-level layers;
  - at most 56 animated properties on desktop and 48 on mobile;
  - at most 128 keys per property;
  - at most 1,300 keyframes in total;
  - serialized size at most 170 KB.
- **Static vector art:** at most 48 KB minified and at most 650 Bézier vertices.
- **Generated SVG:** at most 360 descendants and 150 rendered paths on desktop; 320 and 130 on mobile.
- **WAAPI:** at most two animations, with at most 48 card keyframes.
- **Observers:** at most two `MutationObserver`s and one `ResizeObserver`.
- **Particles:** at most 10 on desktop and 4 on mobile.

The composition SHALL contain only shape and null layers plus one precomposition holding the snowman (so one opacity fades him in and out), with no masks, mattes, filters, gradients, expressions, text or image layers.

**Preparation** SHALL inspect at most four composer candidates and four starter buttons, with 24 ancestors each.

**During playback** the scene SHALL perform no per-frame host layout reads, no geometry polling and no React state updates.

**Deadlines:** the player load SHALL be limited to 2,000 ms and readiness to 250 ms.

**Bundle size:** the scene's production chunk SHALL be at most 35 KB gzip, excluding the shared `lottie_light` chunk.

#### Scenario: Budgets at every supported width

- **WHEN** compositions are built for 360/900 mobile and 1280/1920 desktop widths in both directions and for every staging mode
- **THEN** every structural budget above holds, and browser frame, layout and paint observations are reported separately from unit-test results

### Requirement: Host integration stays outside the library

The library SHALL receive only these from the host:

- the existing anchors;
- the mobile flag;
- the resolved `snowmanDeliveryToastMessage` label.

The library SHALL contain:

- no app routes;
- no i18n;
- no app selectors;
- no API clients;
- no storage;
- no feature-flag reads.

**Label.** The English default SHALL be `Delivered in one piece, almost. Send "{{phrase}}" in the start-page chat for a secret surprise.` DIAL Chat SHALL supply it from the `newYear.snowmanDeliveryToastMessage` i18n key, through `NewYearI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and the existing label adapter in `apps/chat/src/context/CelebrationHost.tsx`.

**Gating.** The scene SHALL be gated only by the existing celebration event activation and per-scene `selection`. It SHALL add no `ENABLED_FEATURES` key, telemetry or cache.

#### Scenario: Localized notification

- **WHEN** the gift click selects SnowmanDelivery in DIAL Chat
- **THEN** the notification shows the translated `newYear.snowmanDeliveryToastMessage` with the secret phrase interpolated when the secret trigger is enabled
