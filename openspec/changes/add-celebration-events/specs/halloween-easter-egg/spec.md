## REMOVED Requirements

### Requirement: HalloweenProvider owns the easter egg and gates it on halloweenEnabled

**Reason**: Shared event runtime replaces the holiday-specific provider and boolean.
**Migration**: Use UI_EVENT=halloween and CelebrationProvider.

## ADDED Requirements

### Requirement: Halloween runs as a module of CelebrationProvider

The Halloween event definition SHALL supply its existing icon, decoration, six scene definitions, five random click scenes and trick-or-treat secret trigger to CelebrationProvider. It SHALL be selected only by UI_EVENT=halloween on `/`. HALLOWEEN_ENABLED, features.halloweenEnabled, HalloweenProvider and useHalloween SHALL be removed. The generic provider SHALL own lifecycle, random selection, portal and notifications; HalloweenDecor SHALL receive onActivate and its scene component SHALL not create a separate portal. Existing Halloween visuals, 80/54 connected-web spider counts, random weaving and departure, secret matching, accessibility, RTL and reduced-motion behavior SHALL be preserved.

#### Scenario: Halloween is selected
- **WHEN** UI_EVENT=halloween and the start page is open
- **THEN** existing Halloween artwork and interactions are rendered through the common event integration

#### Scenario: Halloween is not selected
- **WHEN** UI_EVENT is absent, none, unknown or another event
- **THEN** Halloween art and secret triggers are inactive


## MODIFIED Requirements

### Requirement: The secret phrase celebrates instead of sending

Only the start-page `NewConversationComposer` SHALL route outgoing text through `consumeSecretPhrase` before creating a conversation and return early when it returns `true`. `ConversationView` SHALL send the phrase as ordinary text; editor previews SHALL also send normally because CelebrationProvider is disabled outside `/`.

`consumeSecretPhrase` SHALL match `HALLOWEEN_SECRET_PHRASE` ("trick or treat") against the whole input after normalization that lowercases it and collapses every non-latin-letter run into a single space, so "Trick-or-Treat!" matches. A longer message that merely contains the phrase SHALL NOT match, and SHALL send normally.

#### Scenario: The phrase is sent from the start page

- **WHEN** Halloween is selected and the user sends exactly "trick or treat", in any casing or punctuation, from the start-page composer
- **THEN** the spider drop plays, the Halloween notification is raised, and no message is sent

#### Scenario: A message containing the phrase still sends

- **WHEN** Halloween is selected and the user sends a longer message containing the phrase
- **THEN** the message is sent normally and no celebration plays


### Requirement: The empty chat carries seasonal decoration with a pumpkin trigger

While Halloween is the selected, loaded event on the start page, `NewConversationComposer` SHALL render `HalloweenDecor` inside its welcome-screen region: a cobweb pinned to each of the region's inline-start and inline-end top corners with a spider perched on it, and a pumpkin button. `CelebrationDecor` SHALL render the selected event decoration, or nothing when the runtime is disabled. HalloweenDecor receives an onActivate callback and does not read config or select scenes.

The webs SHALL stay faint — they frame the screen rather than compete with it — and the faintness SHALL live on the web drawing, not on the corner wrapper, so the spiders keep their contrast.

Each pumpkin click SHALL randomly select ghosts, a web-weaving celebration, bats, a cat with wisps, or flying witches. Every scene SHALL be eligible on the first click. Later clicks SHALL exclude the preceding pumpkin scene, with all other scenes equally eligible. Each click SHALL replace the active effect. Keyboard Enter/Space and touch SHALL use the same selection behaviour.

Every celebration SHALL raise a success notification and SHALL clear itself after `HALLOWEEN_BURST_DURATION_MS`, which SHALL outlast the longest animation in `Halloween.module.scss`. Repeating the same celebration SHALL restart its animations rather than leave the layer untouched.

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


### Requirement: Every celebration toast names the secret chat phrase

All six celebration notifications, including the secret-phrase spider drop, SHALL tell the user to send `HALLOWEEN_SECRET_PHRASE` in the start-page chat. The phrase SHALL be interpolated rather than duplicated in locale strings. Messages SHALL NOT promise a fixed next scene.

#### Scenario: Clicking the pumpkin reveals the phrase

- **WHEN** Halloween is selected and the user clicks the pumpkin
- **THEN** the notification's message is resolved with the secret phrase as its interpolation argument


### Requirement: The easter egg is inert, accessible, and motion-safe

The easter egg SHALL persist nothing, read no storage, and issue no feature-specific API request; all of its state is in-memory and per-tab. The seasonal icon SHALL be a bundled SVG loaded through the normal asset pipeline.

**Accessibility:** The cobwebs, the corner spiders, and everything either celebration draws are decorative — they SHALL sit in `aria-hidden` layers that take no pointer events, and the announcement SHALL be the notification each celebration raises. The pumpkin SHALL be a labelled `GhostIconButton` kept outside the `aria-hidden` layer, so it stays focusable and is never an unreachable control inside a hidden subtree. The celebration layer SHALL be portaled to `document.body` so no scroll container clips it.

**RTL:** The decoration SHALL use logical positioning so the corners follow the document's `dir`. A web is drawn from its own top-left, so whichever corner it lands in decides whether it is mirrored, and each web SHALL carry the `rtl:` counterpart that keeps its dense end in the screen corner. The mirror SHALL sit on the web itself and never on the corner wrapper: a flipped ancestor would also flip the spider's inline transform, so it would flee towards the pointer instead of away from it and jam against its leash. The spider SHALL be placed with logical insets instead, which follow the corner the same way the mirror does.

**Reduced motion:** Every animation the feature adds SHALL be suppressed under `prefers-reduced-motion: reduce`, resolving to a static frame rather than to an empty screen. Because an un-animated ghost would otherwise sit at the layer's origin with the rest of the flock stacked on top of it, each one SHALL carry a spread-out resting position used in that state; an un-animated spider SHALL likewise render already paid out on its thread rather than parked above the top edge.

**i18n impact:** Eight keys under `halloween.*` — the shared toast title, one message per celebration (each interpolating `{{phrase}}` and identifying the start-page chat), and the pumpkin's accessible name.

#### Scenario: A reduced-motion user still sees a celebration

- **WHEN** Halloween is selected, the user's system asks for reduced motion, and a celebration is triggered
- **THEN** the notification is raised and the drawings render in static, spread-out, on-screen positions instead of animating, with nothing left frozen off-screen or stacked at the origin
