# Spec: halloween-easter-egg

## Purpose

The seasonal Halloween module selected by `UI_EVENT=halloween`: eleven random start-page pumpkin scenes, the secret phrase for descending spiders, and the guarantees that keep decoration from affecting ordinary chat or conversation data.

## Requirements

### Requirement: The secret phrase celebrates instead of sending

Only the start-page `NewConversationComposer` SHALL route outgoing text through `consumeSecretPhrase` before creating a conversation and return early when it returns `true`. `ConversationView` SHALL send the phrase as ordinary text; editor previews SHALL also send normally because CelebrationProvider is disabled outside `/`.

`consumeSecretPhrase` SHALL match `HALLOWEEN_SECRET_PHRASE` ("trick or treat") against the whole input after normalization that lowercases it, preserves Unicode letters and numbers, and collapses punctuation and whitespace into single spaces, so "Trick-or-Treat!" matches. A longer message that merely contains the phrase SHALL NOT match, and SHALL send normally.

#### Scenario: The phrase is sent from the start page

- **WHEN** Halloween is selected and the user sends exactly "trick or treat", in any casing or punctuation, from the start-page composer
- **THEN** the spider drop plays, the Halloween notification is raised, and no message is sent

#### Scenario: A message containing the phrase still sends

- **WHEN** Halloween is selected and the user sends a longer message containing the phrase
- **THEN** the message is sent normally and no celebration plays

### Requirement: The empty chat carries seasonal decoration with a pumpkin trigger

While Halloween is the selected, loaded event on the start page, `NewConversationComposer` SHALL render `HalloweenDecor` inside its welcome-screen region: a cobweb pinned to each of the region's inline-start and inline-end top corners with a spider perched on it, and a pumpkin button. `CelebrationDecor` SHALL render the selected event decoration, or nothing when the runtime is disabled. HalloweenDecor receives an onActivate callback and does not read config or select scenes.

The webs SHALL stay faint — they frame the screen rather than compete with it — and the faintness SHALL live on the web drawing, not on the corner wrapper, so the spiders keep their contrast.

Each pumpkin click SHALL randomly select ghosts, a web-weaving celebration, bats, a cat with wisps, flying witches, a ghost train, a claw portal, perched ravens, candy rain, invisible paw prints, or dancing skeletons. Every scene SHALL be eligible on the first click. Later clicks SHALL exclude the preceding pumpkin scene, with all other scenes equally eligible. Each click SHALL replace the active effect. Keyboard Enter/Space and touch SHALL use the same selection behaviour.

Every celebration SHALL raise a success notification and SHALL clear itself after its configured scene duration, which SHALL outlast its finite artwork animations. The existing scenes SHALL default to `HALLOWEEN_BURST_DURATION_MS`; the six additional scenes SHALL use individual deadlines between 10 and 12 seconds. Repeating the same celebration SHALL restart its animations rather than leave the layer untouched.

The Halloween module and its artwork SHALL load on demand only when selected on the start page. CelebrationProvider SHALL own the portal, random selection and cleanup; HalloweenBurstOverlay supplies only scene artwork.

#### Scenario: Clicking selects a surprise

- **WHEN** Halloween is selected and the user clicks the pumpkin
- **THEN** a randomly selected celebration plays and its notification reveals the secret chat phrase

#### Scenario: Consecutive clicks differ

- **WHEN** the user clicks the pumpkin again
- **THEN** a randomly selected different scene replaces the active celebration

#### Scenario: Nothing renders on the empty chat while Halloween is not selected

- **WHEN** Halloween is not selected
- **THEN** the empty-chat screen renders no cobwebs, spiders, or pumpkin, and neither the decor nor the celebration layer is loaded

### Requirement: The ghost celebration is a flock of individuals, not one sprite

The Ghost celebration SHALL stage possession of distinct visible interface elements and an unsuccessful attempt to frighten the main pumpkin. Up to three mobile or five desktop small elements SHALL be selected across available history, welcome/starter and composer-control areas. Each target SHALL contain at most 60 descendants and SHALL NOT be clipped, hidden, focused, expanded, disabled, editable or contain an editable subtree. The composer itself SHALL NOT be cloned. Each borrowed visual copy SHALL float with attached expressive eyes while its real element keeps layout, focus and data.

Ghosts SHALL retain the distinct `HalloweenGhostVariant` SVG silhouettes, tints, translucent cloth folds and recessed faces. Each SHALL have its own arrival, possession point and departure. One brave ghost SHALL approach the existing pumpkin and try to frighten it; the pumpkin SHALL answer with a glowing grin. The brave ghost SHALL recoil and hide with its tail briefly exposed. Other ghosts SHALL peek out from their separate homes and escape along different routes with staggered departures. The interface SHALL be fully restored within twelve seconds, before the existing fourteen-second deadline.

Missing pumpkin or eligible targets SHALL retain `buildHalloweenGhostFlight` as a decorative fallback: `HALLOWEEN_GHOST_COUNT` ghosts with distinct size, pace, tilt, opacity and delay, alternating entry edges, upward arcs and opposite-edge exits. Its viewport-relative CSS paths SHALL retain inner vertical bobbing and SHALL NOT flip in RTL. Consecutive ghosts SHALL use different variants.

`HalloweenGhosts` SHALL own a stable per-activation measured/random plan and temporary artwork; CelebrationProvider SHALL continue owning selection, lifecycle and notifications. No shared cache or persistent state SHALL be added. The scene SHALL keep the existing `UI_EVENT=halloween` gate without `ENABLED_FEATURES`/roles additions, and reuse the existing translated Ghost toast with the secret-phrase hint. No API calls, new strings, telemetry, core-component changes or library changes SHALL be introduced.

Playback SHALL use bounded visual copies and precomputed transforms/opacity on one timeline, with no layout reads or React updates per frame. Copies SHALL be inert, and all artwork SHALL be aria-hidden and pointer-transparent. Physical measured coordinates SHALL preserve attachment in LTR and RTL. Reduced motion or unsupported animation APIs SHALL show stationary, distributed ghosts without borrowing or pumpkin animation. Interaction, scrolling, resizing, source mutation, hidden documents, live motion changes, replacement and unmount SHALL stop pending work and restore originals immediately; canceled scenes SHALL NOT restart.

#### Scenario: Separate possessions precede the failed scare

- **WHEN** the scene starts with an eligible interface and pumpkin
- **THEN** ghosts enter distinct elements whose copies float with attached eyes
- **AND** the brave ghost attempts a scare, recoils from the pumpkin grin, hides with an exposed tail and joins the others in peeking and staggered escape

#### Scenario: Every ghost flies its own path

- **WHEN** eligible possession anchors are unavailable
- **THEN** the fallback contains `HALLOWEEN_GHOST_COUNT` ghosts with distinct paths, entering from both sides and starting and ending off-screen

#### Scenario: The flock mixes silhouettes

- **WHEN** a ghost celebration renders
- **THEN** more than one silhouette is drawn and consecutive ghosts differ

#### Scenario: Small screens and RTL retain attachment

- **WHEN** the scene runs on mobile or in RTL
- **THEN** it chooses at most three mobile or five desktop homes from the actually visible interface, keeps eyes and ghosts attached to those homes and causes no horizontal overflow

#### Scenario: Interruption restores the page

- **WHEN** interaction, source changes, scrolling, resizing, hidden document, motion change, replacement or unmount interrupts playback
- **THEN** copies and pending animations are removed and originals immediately recover their exact presentation without changing focus, drafts or data
- **AND** the interrupted scene does not restart on later viewport or preference changes

#### Scenario: Motion is suppressed

- **WHEN** reduced motion is enabled or the animation API is unavailable
- **THEN** stationary distributed ghosts appear without borrowing interface elements or animating the pumpkin

#### Scenario: Work remains bounded

- **WHEN** the page has long history or complex controls
- **THEN** target discovery and copies respect candidate/descendant budgets, oversized and unsafe controls are skipped, and playback performs no repeated measurements or React frame updates

### Requirement: A corner spider keeps its distance from the pointer

A corner spider SHALL bolt directly away from the pointer every time the cursor comes within `HALLOWEEN_SPIDER_FLEE_RADIUS_PX` of where the spider actually is, by `HALLOWEEN_SPIDER_FLEE_STEP_PX` per nudge, so a pointer that follows it keeps pushing it along and a chase works. After `HALLOWEEN_SPIDER_RETURN_MS` undisturbed it SHALL creep back to its perch, with no further input. Bolting SHALL be fast and the return slow, so being startled reads as a scurry and the return as the spider thinking better of it.

Distance SHALL be measured from the spider's chosen position — its perch plus the displacement last chosen — not from its live bounding rect, which during a transition reports the element mid-flight and would feed the spider's own motion back in as a chase. The perch SHALL be re-measured on resize.

Displacement SHALL be clamped to `HALLOWEEN_SPIDER_MAX_OFFSET_PX` as a circle, not a box, so a spider herded against the boundary keeps whatever part of the push runs along it and slides round rather than stopping dead. A push aimed exactly at the centre has no such component and does hold it against the leash — the one way to corner it. A pointer exactly on the spider SHALL break the tie diagonally rather than divide by zero.

Pointer moves SHALL be coalesced into one animation frame, because a cursor crossing the web fires far more of them than there are frames to render. The two corners SHALL be independent: one spider bolting SHALL NOT move the other.

The decoration layer takes no pointer events; the spider listens on the window instead, so nothing in the corner becomes click-through-blocking in order to make this work.

The gesture is deliberately pointer-only and the spider stays `aria-hidden`: it accomplishes nothing, so a keyboard user is missing nothing, and making a decoration focusable inside a hidden layer would cost more than it gives. Under `prefers-reduced-motion: reduce` the spider SHALL never take a displacement at all. That check lives in the component rather than the stylesheet, because the displacement is an inline transform a media query could not override; a host without `matchMedia` SHALL get the ordinary spider rather than an error.

#### Scenario: The pointer closes in on one corner

- **WHEN** Halloween is selected and the pointer comes within the flee radius of one corner spider
- **THEN** that spider bolts away from it and the other corner's spider does not move

#### Scenario: Both corners behave the same

- **WHEN** a pointer approaches each corner spider from its left in turn
- **THEN** both bolt to the right — displacement is in screen coordinates, so no corner may sit under a mirrored ancestor

#### Scenario: The pointer gives chase

- **WHEN** the pointer follows a spider to where it just bolted
- **THEN** the spider gives ground again rather than settling

#### Scenario: The pointer loses interest

- **WHEN** a displaced spider is left alone for `HALLOWEEN_SPIDER_RETURN_MS`
- **THEN** it creeps back to its perch

### Requirement: The spider celebration abseils from the top edge

`buildHalloweenSpiderDrop` SHALL lay out `HALLOWEEN_SPIDER_COUNT` spiders, one per column across the viewport and jittered inside it, so the drop spreads instead of clumping wherever chance puts it. Every spider SHALL get its own thread length, size, sway angle, sway pace, descent pace and start delay.

Each spider SHALL descend from the viewport's top edge on a thread, hang and sway there, then climb back up the way it came, all within one animation cycle. The thread's anchor SHALL stay fixed at the top edge for the whole descent — the element is as tall as its thread and starts fully above the viewport, so translating it down by its own height pays the thread out rather than moving a rigid stick. The sway SHALL pivot at the top of the thread, so the spider swings like the weight on a pendulum rather than sliding sideways.

The spider SHALL be drawn as inline SVG, not an emoji, with a shaded segmented body, jointed legs, highlighted edges and visible amber eyes, readable on light and dark surfaces.

#### Scenario: Spiders spread across the viewport

- **WHEN** a spider drop is laid out
- **THEN** it contains `HALLOWEEN_SPIDER_COUNT` spiders in strictly left-to-right columns, every column inside the viewport, and thread length, size and pace differ between them

#### Scenario: A spider leaves the way it came

- **WHEN** a spider has finished descending and swaying
- **THEN** it climbs back above the top edge, leaving nothing behind when the burst ends

### Requirement: Every celebration toast names the secret chat phrase

All twelve celebration notifications, including the secret-phrase spider drop, SHALL tell the user to send `HALLOWEEN_SECRET_PHRASE` in the start-page chat. The phrase SHALL be interpolated rather than duplicated in locale strings. Messages SHALL NOT promise a fixed next scene.

#### Scenario: Clicking the pumpkin reveals the phrase

- **WHEN** Halloween is selected and the user clicks the pumpkin
- **THEN** the notification's message is resolved with the secret phrase as its interpolation argument

### Requirement: The easter egg is inert, accessible, and motion-safe

The easter egg SHALL persist nothing, read no storage, and issue no feature-specific API request; all of its state is in-memory and per-tab. The seasonal icon SHALL be a bundled SVG loaded through the normal asset pipeline.

**Accessibility:** The cobwebs, the corner spiders, and everything either celebration draws are decorative — they SHALL sit in `aria-hidden` layers that take no pointer events, and the announcement SHALL be the notification each celebration raises. The pumpkin SHALL be a labelled `IconButton` with `ButtonAppearance.Link`, a transparent background in idle, hover and pressed states, and a visible keyboard focus outline, kept outside the `aria-hidden` layer, so it stays focusable and is never an unreachable control inside a hidden subtree. The celebration layer SHALL be portaled to `document.body` so no scroll container clips it.

**RTL:** The decoration SHALL use logical positioning so the corners follow the document's `dir`. A web is drawn from its own top-left, so whichever corner it lands in decides whether it is mirrored, and each web SHALL carry the `rtl:` counterpart that keeps its dense end in the screen corner. The mirror SHALL sit on the web itself and never on the corner wrapper: a flipped ancestor would also flip the spider's inline transform, so it would flee towards the pointer instead of away from it and jam against its leash. The spider SHALL be placed with logical insets instead, which follow the corner the same way the mirror does.

**Reduced motion:** Every animation the feature adds SHALL be suppressed under `prefers-reduced-motion: reduce`, resolving to a static frame rather than to an empty screen. Because an un-animated ghost would otherwise sit at the layer's origin with the rest of the flock stacked on top of it, each one SHALL carry a spread-out resting position used in that state; an un-animated spider SHALL likewise render already paid out on its thread rather than parked above the top edge.

**i18n impact:** Fourteen keys under `halloween.*` — the shared toast title, one message per celebration (each interpolating `{{phrase}}` and identifying the start-page chat), and the pumpkin's accessible name. The six additional scene messages SHALL use `halloween.trainToastMessage`, `halloween.portalToastMessage`, `halloween.ravensToastMessage`, `halloween.candyToastMessage`, `halloween.footprintsToastMessage` and `halloween.skeletonsToastMessage`.

#### Scenario: A reduced-motion user still sees a celebration

- **WHEN** Halloween is selected, the user's system asks for reduced motion, and a celebration is triggered
- **THEN** the notification is raised and the drawings render in static, spread-out, on-screen positions instead of animating, with nothing left frozen off-screen or stacked at the origin

#### Scenario: The pumpkin has no button background

- **WHEN** the user hovers or presses the large pumpkin
- **THEN** its background remains transparent while its SVG supplies the visual response
- **AND** keyboard focus remains visible and Enter/Space activate the same event

### Requirement: The pumpkin chuckles visually and the logo keeps its identity

The start-page pumpkin SHALL be a shaded SVG jack-o'-lantern, at least 88 CSS pixels square, with carved eyes and mouth and warm candlelight. Hover, keyboard focus and pressing SHALL produce the same visual chuckle: a short repeating shake, narrowed eyes and flickering light. No audio SHALL play. Reduced-motion users SHALL receive a static lit expression.

The seasonal SVG icon SHALL replace only the existing favicon slot in desktop navigation and the mobile header, keeping its dimensions and accessible label. The welcome area SHALL gain no extra logo or icon block. The theme wordmark SHALL stay unchanged. If no favicon is configured, no new icon slot SHALL be added. Other routes SHALL show the configured favicon.

#### Scenario: Pumpkin feedback preserves existing branding

- **WHEN** Halloween is selected and the user hovers, focuses or presses the pumpkin
- **THEN** its SVG supplies the visual chuckle without sound, or a static lit expression under reduced motion
- **AND** seasonal branding replaces only an existing icon slot and adds no welcome-area logo block

### Requirement: Spiders visibly weave their webs

The web celebration SHALL show 54 weaving spiders on mobile and 80 on desktop, sized 16–21 and 21–27 CSS pixels respectively. Small spiral sections (40–68 CSS pixels on mobile, 64–108 on desktop) SHALL connect through bowed horizontal, vertical and diagonal silk threads into one continuous network covering almost the whole viewport, including the visible history panel. Every section SHALL belong to this connected network. Each celebration SHALL randomize positions within coverage cells, arrival order, spiral rotation, weaving speed, diagonal connections, thread sag and escape direction. Threads and sections SHALL progressively appear over shuffled delays spanning 4.2 seconds; the shared web SHALL remain visible while spiders finish weaving.

Some sections SHALL attach to corners of visible composer, welcome or conversation-history elements and the main pumpkin using a bounded snapshot of at most twelve UI rectangles. The visible pumpkin SHALL receive a target before conversation rows fill this budget, with its target inset to the pumpkin body rather than the empty corners of its artwork. These corner webs SHALL stay within their target bounds and join the same network. Missing or hidden targets SHALL fall back to random viewport coverage. No real element SHALL be moved, hidden, restyled or cloned. Physical viewport coordinates SHALL preserve attachment in LTR and RTL.

Spokes SHALL appear first, followed by scalloped silk. Each spider SHALL follow the same geometry as its growing silk, then travel smoothly towards a viewport edge. Webs SHALL gently fade. Every delayed departure SHALL finish before the shared fourteen-second cleanup. Navigation away SHALL remove the layer immediately. All layers SHALL pass through clicks and focus and SHALL NOT change or persist history.

`HalloweenWebScene` SHALL own transient drawing state and precomputed geometry. The scene SHALL use one visible canvas and at most one animation frame chain, bounded to 30 draws per second, without per-frame React state updates or layout reads. Completed silk and spider artwork SHALL be cached only for the scene lifetime. Raster scale SHALL be at most 1.5 and each viewport backing surface SHALL be at most three million pixels. Unmount, replacement, scrolling, resizing or a hidden document SHALL cancel pending work and release cached surfaces.

Under reduced motion, complete webs and stationary spiders SHALL appear in their final positions until cleanup with no animation loop. The scene SHALL remain decorative and aria-hidden, gated by the existing `UI_EVENT=halloween` selection, with unchanged notifications and no new API, strings, telemetry or persistent state.

#### Scenario: A connected web covers the viewport

- **WHEN** random pumpkin selection activates the web scene
- **THEN** 54 spiders on mobile or 80 on desktop weave one connected network with randomized arrival, weaving and escape paths
- **AND** the effect passes through interaction and finishes before the fourteen-second cleanup, with a static complete web under reduced motion

#### Scenario: Webs attach to the interface

- **WHEN** visible composer or conversation-history targets exist
- **THEN** some spiders weave corner sections anchored within those targets, connected to the viewport mesh in either text direction
- **AND** the real elements retain their layout, contents, focus and interactions

#### Scenario: Rendering work is bounded

- **WHEN** a dense web scene runs
- **THEN** one visible canvas composites cached silk and sprites at no more than 30 draws per second without reading layout per frame
- **AND** stopping or replacing the scene leaves no pending animation frame or scene-owned cache

#### Scenario: The main pumpkin is covered in silk

- **WHEN** the pumpkin is visible and the web scene starts, including with a long conversation history
- **THEN** spiders weave on the pumpkin body and connect its silk to the same viewport network without adding spiders or exceeding twelve targets
- **AND** the pumpkin button remains clickable and retains focus in LTR and RTL

### Requirement: Further clicks reveal other characters

The bat scene SHALL stage the three-bat crosswind story when a usable composer is available, with its own eighteen-second lifetime. When attachment space or the composer is unavailable it SHALL retain sixteen small bats with staggered curved flights and flapping wings. The cat scene SHALL stage the gravity-testing story on eligible interface anchors, with a decorative crossing cat as fallback. The witch scene SHALL release five small witches on broomsticks, flying along arcs at different heights in both directions. Each scene SHALL announce its own translated notification and respect the same navigation, configured-lifetime and click-through guarantees.

Every added animation SHALL be disabled under reduced motion. Characters and wisps SHALL remain visible in separated static positions, not frozen off-screen. All character drawings SHALL be decorative SVG, with no sound.

#### Scenario: Another character scene is selected

- **WHEN** random pumpkin selection chooses bats, the cat or witches
- **THEN** the corresponding characters play their scene and its translated notification announces the secret phrase
- **AND** reduced motion displays separated static characters while navigation and scene deadlines still remove the effect

### Requirement: Cat tests gravity on interface buttons

HalloweenCatScene SHALL own one stable measured plan per activation. CelebrationProvider SHALL retain scene selection, notification and lifecycle, with a 25.5-second Cat lifetime enclosing 25 seconds of animation. The scene SHALL retain UI_EVENT=halloween and the existing cat toast/secret hint without additional ENABLED_FEATURES/role gating, translations, provider, endpoint, persistence, cache or telemetry.

#### Scenario: Tentative nudge becomes deliberate mischief

- **WHEN** a visible composer and two nearby safe small buttons are available
- **THEN** an articulated black cat walks in on four legs, anticipates and jumps onto the composer edge, sits there looking at the viewer and down at its prize, then hops down beside the buttons
- **AND** it moves each button gradually over two pushes; before every push it looks at the viewer, looks at the button while its paw pushes, then looks back at the viewer
- **AND** it walks on four legs to the second button, one button rebounds and the cat recoils before sitting to groom its paw and leaving
- **AND** the cat uses a seated drawing while sitting, pushing and grooming and a standing drawing with a diagonal gait while walking and jumping, swapping without either drawing turning translucent
- **AND** button motion starts at physical paw contact, falls accelerate, and the cat anticipates jumps, absorbs landings and pauses naturally
- **AND** originals return before natural scene disposal without altering draft, selection, focus, layout or application data

#### Scenario: Work stays bounded and isolated

- **WHEN** the cat scene prepares and plays
- **THEN** it borrows at most two visible buttons of at most 60 descendants, 300×96px and 24000px² each, excluding focused, editable, disabled, expanded, hidden or clipped controls
- **AND** the composer is an anchor only and is never copied or transformed
- **AND** precomputed SVG and copy transforms share a timeline without per-frame measurements, React updates or changes to core components/libraries

#### Scenario: Interruption restores the controls

- **WHEN** user interaction, scrolling, resizing, hidden document, source changes, motion/viewport changes, replacement, unmount or setup failure interrupts the scene
- **THEN** pending preparation, animations and copies stop and originals recover immediately
- **AND** the activation cannot restart after cancellation
- **WHEN** an unrelated notification portal appears or disappears without shifting anchors
- **THEN** the story continues through its full timeline

#### Scenario: Responsive fallback and accessibility

- **WHEN** the scene runs on mobile or desktop in LTR or RTL
- **THEN** measured physical geometry keeps paws and prizes aligned without page overflow, with inert, aria-hidden and pointer-transparent decoration
- **WHEN** only one eligible button exists
- **THEN** it receives the tentative push, deliberate fall and rebound
- **WHEN** no reachable buttons or composer exists
- **THEN** the decorative cat walk remains available
- **WHEN** reduced motion is enabled or animation support is missing
- **THEN** a stationary cat is visible without measuring or borrowing the page

### Requirement: Bat crosswind story

The Bats burst SHALL stage a 17.5-second three-bat crosswind story inside the existing decoration layer when a visible composer has sufficient space below it. CelebrationProvider SHALL retain activation ownership, the existing `UI_EVENT=halloween` gate and notification, and use an eighteen-second scene lifetime; there SHALL be no new `ENABLED_FEATURES`/role gate, provider, endpoint, persistence, telemetry or translations. The per-activation measured plan SHALL remain stable until disposed.

#### Scenario: Failed wake-up attempt

- **WHEN** the Bats story starts
- **THEN** a sleepy bat grips the composer underside and folds its wings, while two helpers approach from opposite sides and fan it
- **AND** it wraps up tighter, the helpers exchange looks and increase their effort
- **AND** opposing currents catch the helpers in a vortex and carry them away separately
- **AND** the sleeper opens one eye, yawns, crawls to and re-hangs on a nearby idle button when available (otherwise along the composer edge), then departs last
- **AND** the live composer retains its focus, draft and position throughout

#### Scenario: Smooth motion and readable pauses

- **WHEN** bats approach, circle, settle and leave
- **THEN** their paths carry momentum through intermediate flight points and decelerate before rests, without repeatedly stopping at orbit samples
- **AND** wingbeat phase stays continuous as the pace changes, page surfaces react with damped motion and the extended scene lifetime includes the final departure

#### Scenario: Wingbeats disturb nearby page surfaces

- **WHEN** helpers fan selected nearby small surfaces with their wings
- **THEN** only those surfaces rock around their edges, with stronger later gusts producing stronger motion
- **AND** motion onset follows actual power strokes with a short distance-dependent delay, while distant elements stay still
- **AND** the scene renders no beams, airflow streaks, particles or drawn vortex; separately jointed outer wings fold on recovery and spread during downstrokes while bodies gently lift and settle
- **AND** there are at most three mobile/five desktop inert visual copies, each at most sixty descendants and 440×110/33000px², excluding focused/editable/disabled/expanded/hidden/clipped elements and overlapping relatives
- **AND** originals return before the sleeper's departure without changing data or invoking UI actions

#### Scenario: Safe interruption

- **WHEN** input, focus, pointer, keyboard, external scroll, resize, hidden-tab, anchor change/removal, unmount or partial animation setup failure occurs
- **THEN** every animation stops and every original is restored immediately
- **AND** that activation does not restart after breakpoint or motion-preference changes

#### Scenario: Notification dismissal does not interrupt the story

- **WHEN** a notification or unrelated popup portal is inserted or removed without moving or resizing the measured anchors
- **THEN** the current bat story continues to its natural completion
- **AND** real anchor changes, layout shifts and user interaction still restore the interface immediately

#### Scenario: Fallback and accessibility

- **WHEN** reduced motion is requested or WAAPI is unavailable
- **THEN** the scene is stationary and creates no page snapshots or measurements
- **WHEN** a usable composer is missing or lacks attachment space
- **THEN** the legacy decorative flight plays without borrowing UI
- **AND** all scene content remains inert, aria-hidden and pointer-transparent in every case

#### Scenario: Responsive bounded rendering

- **WHEN** the story plays in LTR or RTL on mobile or desktop
- **THEN** claws remain attached to measured physical anchors, strokes affect nearby measured targets and decoration creates no page overflow
- **AND** actors, subtree scans and snapshots are bounded, with precomputed WAAPI motion and no per-frame DOM measurements or React renders

### Requirement: Halloween runs as a module of CelebrationProvider

The Halloween event definition SHALL supply its existing icon, decoration, twelve scene definitions, eleven random click scenes and trick-or-treat secret trigger to CelebrationProvider. It SHALL be selected only by UI_EVENT=halloween on `/`. HALLOWEEN_ENABLED, features.halloweenEnabled, HalloweenProvider and useHalloween SHALL be removed. The generic provider SHALL own lifecycle, random selection, portal and notifications; HalloweenDecor SHALL receive onActivate and its scene component SHALL not create a separate portal. Existing Halloween visuals, 80/54 connected-web spider counts, random weaving and departure, secret matching, accessibility, RTL and reduced-motion behavior SHALL be preserved.

#### Scenario: Halloween is selected
- **WHEN** UI_EVENT=halloween and the start page is open
- **THEN** existing Halloween artwork and interactions are rendered through the common event integration

#### Scenario: Halloween is not selected
- **WHEN** UI_EVENT is absent, none, unknown or another event
- **THEN** Halloween art and secret triggers are inactive

### Requirement: The portal temporarily borrows visible conversation rows

The portal SHALL appear at a random bounded viewport position, show eyes, reach for
up to two adjacent visible conversation-history rows with a claw, pull visual copies
into the rift, snap shut, and restore the originals. Conversation entities, ordering,
routes, focus order and persisted data SHALL remain unchanged. Copies SHALL be inert,
aria-hidden and pointer-transparent. Focused, clipped and hidden rows SHALL be excluded.
Only the app integration SHALL know the history selector and conversation route.

#### Scenario: Visible history is available
- **WHEN** the portal plays with at least two eligible visible history rows
- **THEN** a random adjacent pair visually disappears into the portal and returns within nine seconds

#### Scenario: Playback is interrupted
- **WHEN** the user interacts, scrolls, resizes, changes visibility or motion preference, replaces the scene, navigates away, or a selected row is removed, recycled or renamed
- **THEN** borrowed rows are restored immediately and all copies and imperative animations are cleaned up

#### Scenario: No eligible history or reduced motion
- **WHEN** history is empty, closed or has no eligible rows
- **THEN** the portal still plays without borrowing rows
- **WHEN** reduced motion is enabled
- **THEN** only a static portal is shown and no history rows are borrowed

### Requirement: Additional scenes remain decorative and bounded

Ghost train, ravens, candy rain, paw prints and skeletons SHALL be pointer-transparent
and hidden from assistive technology. Each SHALL honor reduced motion with static
artwork, preserve RTL layout and avoid horizontal page overflow. Mobile layouts SHALL
use fewer ravens and candies. Every new scene SHALL be eligible for random pumpkin
clicks, subject to the existing no-consecutive-repeat rule, and its notification SHALL
reveal the secret chat phrase.

#### Scenario: A new scene is selected
- **WHEN** a pumpkin click selects any additional scene
- **THEN** its finite animation plays, its notification hints at the secret phrase, and the shared runtime cleans it up by its deadline

### Requirement: The main pumpkin boards the Halloween train

The existing Train scene SHALL enter with an empty final wagon, stop, and show the main pumpkin jumping from its measured page position into that wagon. Its face SHALL match the main pumpkin. After landing, the passenger SHALL remain inside the same moving train carrier, behind the wagon front, throughout departure. The original labelled pumpkin button SHALL retain layout and focus; only its artwork is temporarily hidden and restored before the eleven-second animation ends. The existing twelve-second runtime deadline and scene pools SHALL remain unchanged. Scene-owned state SHALL drive boarding; core page components and libraries SHALL remain unchanged.

The train SHALL use layered translucent smoke from its chimney and side vents with different drift directions. Physical direction SHALL follow the main pumpkin's side while its face stays upright. The scene SHALL fit 360/900/1280/1920 widths, remain decorative, aria-hidden and pointer-transparent, preserve the secret hint in `halloween.trainToastMessage`, and use the existing UI_EVENT gate without API, persistence, telemetry or cache behavior.

#### Scenario: Boarding and departure
- **WHEN** a pumpkin click selects Train and the main pumpkin is visible
- **THEN** an empty wagon arrives and stops, the main pumpkin visibly jumps into it, and the train departs with its passenger and smoke
- **AND** the main pumpkin returns to its original place before scene completion

#### Scenario: Interruption and reduced motion
- **WHEN** the user interacts, scrolls, resizes, navigates away, replaces the scene, removes the source or enables reduced motion
- **THEN** the original pumpkin is immediately restored, boarding ends and any audio stops
- **AND** reduced motion uses static artwork with no borrowing or animated descendants

### Requirement: Train soundtrack playback is optional and bounded

The train SHALL support an optional supplied audio source. With no source, no media request SHALL occur. A supplied source SHALL play at most for the scene lifetime, stop/reset on interruption or unmount, and handle rejected playback silently. Reduced motion SHALL not start audio.

#### Scenario: No recording is available
- **WHEN** no soundtrack source is configured
- **THEN** the complete visual scene plays without creating an audio request

#### Scenario: Playback is unavailable or interrupted
- **WHEN** browser playback rejects or the scene ends
- **THEN** no unhandled error or background playback remains and the original pumpkin is restored

### Requirement: Ravens build a nest from the interface

`HalloweenBurst.Ravens` SHALL show five ravens on mobile and eight on desktop, owned by `HalloweenRavens` inside the existing celebration viewport layer. Birds SHALL land on visible UI, tear small fragments from separated headings, buttons and history rows and build a nest on the main pumpkin. Two ravens SHALL grip opposite ends of one visible conversation, first attempt small pulls, then brace and tug harder while its visual copy bends. One SHALL release; the other and the conversation SHALL recoil toward the nest. Collectors SHALL each use a unique source, deliver their piece at staggered times and immediately fly off along separate routes without gathering over the nest. The pumpkin SHALL shake and all borrowed UI SHALL be restored by twelve seconds, before a thirteen-second shared deadline.

Flying birds SHALL turn toward their flight direction at route changes; grounded tugging SHALL preserve their grip-facing pose. The birds' beaks and the carried edges SHALL derive from the same geometry and timeline throughout contact. Target discovery SHALL use a bounded snapshot of visible existing DOM geometry in physical viewport coordinates, preserving attachment in LTR and RTL. Hidden, clipped, expanded or focused conversation controls SHALL NOT be borrowed. When no eligible conversation is visible, the birds SHALL fight over a decorative composer-border strip; when the pumpkin is absent the nest SHALL use a composer corner. With no usable interface, a stationary decorative flock SHALL remain available.

The scene SHALL use at most one real conversation snapshot with at most five visual sections, at most three/six cropped fragments on mobile/desktop (76×32px each; at most 16 source descendants) and bounded SVG artwork. It SHALL NOT clone the composer, modify data, persist state, call APIs, add telemetry or require changes to core page components or libraries. Playback SHALL NOT read layout or update React state per frame. Actors and copies SHALL share one precomputed animation timeline. Performance SHALL be checked in a browser fixture with throttled CPU before adding a canvas renderer.

All artwork SHALL be aria-hidden and pointer-transparent, and visual copies SHALL be inert. Reduced motion SHALL show stationary birds without borrowing elements or animating the pumpkin. Scene replacement, navigation, interaction, scrolling, resizing, hidden documents, target mutation and live motion-preference changes SHALL stop pending work and restore originals. The existing `UI_EVENT=halloween` gate, random click selection and `halloween.ravensToastMessage` secret-phrase hint SHALL remain unchanged; no new user-visible strings SHALL be introduced.

CelebrationProvider SHALL continue to own scene selection, notifications and lifecycle. HalloweenRavens SHALL own only its per-activation measured plan and temporary visual copies; no shared memoized plan or cache is needed. The scene SHALL use the existing `UI_EVENT=halloween` selection without a separate `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES` gate.

#### Scenario: Nest construction and tug of war share one story

- **WHEN** the raven scene starts with a visible pumpkin, composer and eligible history row
- **THEN** birds gather spatially separated fragments into a pumpkin nest while two others tug the same conversation with attached beaks
- **AND** releasing one grip launches the other bird and its cargo toward the nest before the pumpkin shakes and the scene restores the interface

#### Scenario: Mobile or empty history supplies a strip

- **WHEN** no eligible history row is visible
- **THEN** the birds tug a decorative strip at the composer instead, without opening history or changing input contents
- **AND** mobile uses five birds and desktop uses eight without horizontal overflow

#### Scenario: Interruption restores the borrowed interface

- **WHEN** the user interacts, navigates, changes motion preference, scrolls, resizes, hides the document or the target changes during playback
- **THEN** all scene-owned animations and copies are stopped and removed and original controls are immediately restored

#### Scenario: Motion is reduced

- **WHEN** reduced motion is enabled before the scene starts
- **THEN** stationary ravens appear without a borrowed conversation, pumpkin shake or animation loop

#### Scenario: Work is bounded and direction independent

- **WHEN** the scene runs in either direction with a long history
- **THEN** only bounded visible targets, one small row and at most six small fragment subtrees are measured/copied at setup
- **AND** precomputed motion keeps grips attached with no per-frame layout reads or React updates

#### Scenario: Collectors stay distributed

- **WHEN** headings, controls and history entries are visible in different areas
- **THEN** each collector tears a unique piece from its own source, with at least 96px between selected source centers
- **AND** deliveries are staggered, with a short drop followed immediately by departure along different routes, so birds do not wait in a cluster
