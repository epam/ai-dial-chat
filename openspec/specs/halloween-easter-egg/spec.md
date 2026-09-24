# Spec: halloween-easter-egg

## Purpose

The seasonal Halloween easter egg in the chat app: what the `halloweenEnabled` feature flag turns on, the start-page-only celebrations — five randomly selected pumpkin-click scenes, and the secret phrase for a drop of spiders — and the guarantees that keep a decorative feature from affecting chat behaviour.

## Requirements

### Requirement: HalloweenProvider owns the easter egg and gates it on halloweenEnabled

`HalloweenProvider` (`apps/chat/src/context/HalloweenContext.tsx`) SHALL read `useFeatureFlag('halloweenEnabled')` (see `config-registry-and-env-provider`) and expose `isEnabled`, `celebrate(burst)`, and `consumeSecretPhrase(text)`. `isEnabled` SHALL additionally require the exact start-page pathname `/`. Conversation routes, editor previews and every other route SHALL remain inert even when the flag is on.

While the flag is `false`, `celebrate` SHALL be a no-op and `consumeSecretPhrase` SHALL always return `false`, so the phrase reaches the model as an ordinary message. Because `useFeatureFlag` already returns `false` until the client config is ready, the easter egg SHALL stay dark during config load rather than flashing on.

`useHalloween` SHALL resolve to a permanently disabled easter egg outside the provider instead of throwing, unlike the app's other context hooks: its consumers include the new-conversation composer, which are mounted in trees that legitimately skip the provider, and a decorative feature must not break them.

Leaving the start page or turning the flag off mid-session SHALL immediately hide and clear any celebration in flight. Returning SHALL NOT resume a previous effect. Turning the flag off is supported — the client config is re-fetched, so the value can flip without a reload.

#### Scenario: The flag is off

- **WHEN** `features.halloweenEnabled` is `false`
- **THEN** `isEnabled` is `false`, `celebrate` renders no celebration and raises no notification, and `consumeSecretPhrase` returns `false` for every input

#### Scenario: Used outside the provider

- **WHEN** a component calling `useHalloween` is rendered with no `HalloweenProvider` ancestor
- **THEN** the hook returns a disabled easter egg rather than throwing

### Requirement: The secret phrase celebrates instead of sending

Only the start-page `NewConversationComposer` SHALL route outgoing text through `consumeSecretPhrase` before creating a conversation and return early when it returns `true`. `ConversationView` SHALL send the phrase as ordinary text; editor previews SHALL also send normally because the provider is disabled outside `/`.

`consumeSecretPhrase` SHALL match `HALLOWEEN_SECRET_PHRASE` ("trick or treat") against the whole input after normalization that lowercases it and collapses every non-latin-letter run into a single space, so "Trick-or-Treat!" matches. A longer message that merely contains the phrase SHALL NOT match, and SHALL send normally.

#### Scenario: The phrase is sent from the start page

- **WHEN** the flag is on and the user sends exactly "trick or treat", in any casing or punctuation, from the start-page composer
- **THEN** the spider drop plays, the Halloween notification is raised, and no message is sent

#### Scenario: A message containing the phrase still sends

- **WHEN** the flag is on and the user sends a longer message containing the phrase
- **THEN** the message is sent normally and no celebration plays

### Requirement: The empty chat carries seasonal decoration with a pumpkin trigger

While the flag is on, `NewConversationComposer` SHALL render `HalloweenDecor` inside its welcome-screen region: a cobweb pinned to each of the region's inline-start and inline-end top corners with a spider perched on it, and a pumpkin button. `HalloweenDecor` SHALL additionally render nothing of its own when the flag is off, so the call site needs no second gate.

The webs SHALL stay faint — they frame the screen rather than compete with it — and the faintness SHALL live on the web drawing, not on the corner wrapper, so the spiders keep their contrast.

Each pumpkin click SHALL randomly select ghosts, a web-weaving celebration, bats, a cat with wisps, or flying witches. Every scene SHALL be eligible on the first click. Later clicks SHALL exclude the preceding pumpkin scene, with all other scenes equally eligible. Each click SHALL replace the active effect. Keyboard Enter/Space and touch SHALL use the same selection behaviour.

Every celebration SHALL raise a success notification and SHALL clear itself after `HALLOWEEN_BURST_DURATION_MS`, which SHALL outlast the longest animation in `Halloween.module.scss`. Repeating the same celebration SHALL restart its animations rather than leave the layer untouched.

`HalloweenDecor` and `HalloweenBurstOverlay` SHALL both be loaded on demand, so a deployment with the flag off pays for neither the components nor their stylesheet.

#### Scenario: Clicking selects a surprise

- **WHEN** the flag is on and the user clicks the pumpkin
- **THEN** a randomly selected celebration plays and its notification reveals the secret chat phrase

#### Scenario: Consecutive clicks differ

- **WHEN** the user clicks the pumpkin again
- **THEN** a randomly selected different scene replaces the active celebration

#### Scenario: Nothing renders on the empty chat while the flag is off

- **WHEN** the flag is `false`
- **THEN** the empty-chat screen renders no cobwebs, spiders, or pumpkin, and neither the decor nor the celebration layer is loaded

### Requirement: The ghost celebration is a flock of individuals, not one sprite

`buildHalloweenGhostFlight` SHALL lay out `HALLOWEEN_GHOST_COUNT` ghosts, each with its own entry edge, arc, size, tilt, opacity, pace and start delay, so the flock reads as individuals rather than a row moving as one body. A ghost SHALL enter from off-screen on one side at its own height, cross the viewport along an arc whose midpoint sits above the straight line between entry and exit, and leave past the opposite edge — entry and exit are always on opposite sides, so no ghost turns around mid-flight. Entry edges SHALL alternate, so ghosts cross in both directions.

Each ghost SHALL be drawn as one of the `HalloweenGhostVariant` silhouettes, cycled so no two neighbours in the flock are alike, as inline SVG rather than an emoji — the variants differ in outline, face and tint, with translucent gradients, cloth folds and recessed eyes. Its vertical bob SHALL animate on an inner element, so it composes with the flight instead of competing for the same `transform`.

Offsets SHALL be expressed in `vw`/`vh` and passed as custom properties, so one keyframe set serves every flock and a flight crosses the viewport at any size. The paths are deliberately direction-agnostic — each ghost picks its own side — so the flock SHALL NOT flip under RTL.

#### Scenario: Every ghost flies its own path

- **WHEN** a ghost celebration is laid out
- **THEN** it contains `HALLOWEEN_GHOST_COUNT` ghosts, no two sharing a path, entering from both sides, each starting and ending off-screen

#### Scenario: The flock mixes silhouettes

- **WHEN** a ghost celebration renders
- **THEN** more than one silhouette is drawn, and no two consecutive ghosts share one

### Requirement: A corner spider keeps its distance from the pointer

A corner spider SHALL bolt directly away from the pointer every time the cursor comes within `HALLOWEEN_SPIDER_FLEE_RADIUS_PX` of where the spider actually is, by `HALLOWEEN_SPIDER_FLEE_STEP_PX` per nudge, so a pointer that follows it keeps pushing it along and a chase works. After `HALLOWEEN_SPIDER_RETURN_MS` undisturbed it SHALL creep back to its perch, with no further input. Bolting SHALL be fast and the return slow, so being startled reads as a scurry and the return as the spider thinking better of it.

Distance SHALL be measured from the spider's chosen position — its perch plus the displacement last chosen — not from its live bounding rect, which during a transition reports the element mid-flight and would feed the spider's own motion back in as a chase. The perch SHALL be re-measured on resize.

Displacement SHALL be clamped to `HALLOWEEN_SPIDER_MAX_OFFSET_PX` as a circle, not a box, so a spider herded against the boundary keeps whatever part of the push runs along it and slides round rather than stopping dead. A push aimed exactly at the centre has no such component and does hold it against the leash — the one way to corner it. A pointer exactly on the spider SHALL break the tie diagonally rather than divide by zero.

Pointer moves SHALL be coalesced into one animation frame, because a cursor crossing the web fires far more of them than there are frames to render. The two corners SHALL be independent: one spider bolting SHALL NOT move the other.

The decoration layer takes no pointer events; the spider listens on the window instead, so nothing in the corner becomes click-through-blocking in order to make this work.

The gesture is deliberately pointer-only and the spider stays `aria-hidden`: it accomplishes nothing, so a keyboard user is missing nothing, and making a decoration focusable inside a hidden layer would cost more than it gives. Under `prefers-reduced-motion: reduce` the spider SHALL never take a displacement at all. That check lives in the component rather than the stylesheet, because the displacement is an inline transform a media query could not override; a host without `matchMedia` SHALL get the ordinary spider rather than an error.

#### Scenario: The pointer closes in on one corner

- **WHEN** the flag is on and the pointer comes within the flee radius of one corner spider
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

All six celebration notifications, including the secret-phrase spider drop, SHALL tell the user to send `HALLOWEEN_SECRET_PHRASE` in the start-page chat. The phrase SHALL be interpolated rather than duplicated in locale strings. Messages SHALL NOT promise a fixed next scene.

#### Scenario: Clicking the pumpkin reveals the phrase

- **WHEN** the flag is on and the user clicks the pumpkin
- **THEN** the notification's message is resolved with the secret phrase as its interpolation argument

### Requirement: The easter egg is inert, accessible, and motion-safe

The easter egg SHALL persist nothing, read no storage, and issue no feature-specific API request; all of its state is in-memory and per-tab. The seasonal icon SHALL be a bundled SVG loaded through the normal asset pipeline.

**Accessibility:** The cobwebs, the corner spiders, and everything either celebration draws are decorative — they SHALL sit in `aria-hidden` layers that take no pointer events, and the announcement SHALL be the notification each celebration raises. The pumpkin SHALL be a labelled `GhostIconButton` kept outside the `aria-hidden` layer, so it stays focusable and is never an unreachable control inside a hidden subtree. The celebration layer SHALL be portaled to `document.body` so no scroll container clips it.

**RTL:** The decoration SHALL use logical positioning so the corners follow the document's `dir`. A web is drawn from its own top-left, so whichever corner it lands in decides whether it is mirrored, and each web SHALL carry the `rtl:` counterpart that keeps its dense end in the screen corner. The mirror SHALL sit on the web itself and never on the corner wrapper: a flipped ancestor would also flip the spider's inline transform, so it would flee towards the pointer instead of away from it and jam against its leash. The spider SHALL be placed with logical insets instead, which follow the corner the same way the mirror does.

**Reduced motion:** Every animation the feature adds SHALL be suppressed under `prefers-reduced-motion: reduce`, resolving to a static frame rather than to an empty screen. Because an un-animated ghost would otherwise sit at the layer's origin with the rest of the flock stacked on top of it, each one SHALL carry a spread-out resting position used in that state; an un-animated spider SHALL likewise render already paid out on its thread rather than parked above the top edge.

**i18n impact:** Eight keys under `halloween.*` — the shared toast title, one message per celebration (each interpolating `{{phrase}}` and identifying the start-page chat), and the pumpkin's accessible name.

#### Scenario: A reduced-motion user still sees a celebration

- **WHEN** the flag is on, the user's system asks for reduced motion, and a celebration is triggered
- **THEN** the notification is raised and the drawings render in static, spread-out, on-screen positions instead of animating, with nothing left frozen off-screen or stacked at the origin


### Requirement: The pumpkin chuckles visually and the logo keeps its identity

The start-page pumpkin SHALL be a shaded SVG jack-o'-lantern, at least 88 CSS pixels square, with carved eyes and mouth and warm candlelight. Hover, keyboard focus and pressing SHALL produce the same visual chuckle: a short repeating shake, narrowed eyes and flickering light. No audio SHALL play. Reduced-motion users SHALL receive a static lit expression.

The seasonal SVG icon SHALL replace only the existing favicon slot in desktop navigation and the mobile header, keeping its dimensions and accessible label. The welcome area SHALL gain no extra logo or icon block. The theme wordmark SHALL stay unchanged. If no favicon is configured, no new icon slot SHALL be added. Other routes SHALL show the configured favicon.

### Requirement: Spiders visibly weave their webs

The web celebration SHALL show 54 tiny weaving spiders on mobile and 80 on desktop. Small spiral sections (40–68 CSS pixels on mobile, 64–108 on desktop) SHALL connect through bowed horizontal, vertical and diagonal silk threads into one continuous network covering almost the whole viewport, including the visible history panel. Every section SHALL belong to this connected network. Each celebration SHALL randomize the positions within coverage cells, arrival order, spiral rotation, weaving speed, diagonal connections, thread sag and escape direction. Threads and sections SHALL progressively appear over shuffled delays spanning 4.2 seconds; the shared web SHALL remain visible while spiders finish weaving.

Spokes SHALL appear first, followed by a scalloped spiral. Each spider SHALL follow the same geometry as its growing silk, then travel smoothly towards a viewport edge. Webs SHALL gently fade. Every delayed departure SHALL finish before the shared 14-second cleanup. Navigation away SHALL remove the layer immediately. All layers SHALL pass through clicks and focus and SHALL NOT change or persist history.

Under reduced motion, complete webs and stationary spiders SHALL appear in their final positions until cleanup.

### Requirement: Further clicks reveal other characters

The bat scene SHALL release 16 small bats, with staggered curved flights and flapping wings. The cat scene SHALL show a small black cat crossing the bottom edge, with tail movement and soft floating wisps. The witch scene SHALL release five small witches on broomsticks, flying along arcs at different heights in both directions. Each scene SHALL announce its own translated notification and respect the same navigation, lifetime and click-through guarantees.

Every added animation SHALL be disabled under reduced motion. Characters and wisps SHALL remain visible in separated static positions, not frozen off-screen. All character drawings SHALL be decorative SVG, with no sound.
