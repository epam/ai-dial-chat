## MODIFIED Requirements

### Requirement: The secret phrase celebrates instead of sending

Only the start-page `NewConversationComposer` SHALL route outgoing text through `consumeSecretPhrase` before creating a conversation and return early when it returns `true`. `ConversationView` SHALL send the phrase as ordinary text; editor previews SHALL also send normally because CelebrationProvider is disabled outside `/`.

`consumeSecretPhrase` SHALL match `HALLOWEEN_SECRET_PHRASE` ("trick or treat") against the whole input after normalization that lowercases it, preserves Unicode letters and numbers, and collapses punctuation and whitespace into single spaces, so "Trick-or-Treat!" matches. A longer message that merely contains the phrase SHALL NOT match, and SHALL send normally.

#### Scenario: The phrase is sent from the start page

- **WHEN** Halloween is selected and the user sends exactly "trick or treat", in any casing or punctuation, from the start-page composer
- **THEN** a randomly selected secret scene (descending spiders, cauldron, mimic, pumpkin bowling or mummy) plays, the Halloween notification is raised, and no message is sent

#### Scenario: A message containing the phrase still sends

- **WHEN** Halloween is selected and the user sends a longer message containing the phrase
- **THEN** the message is sent normally and no celebration plays

### Requirement: Halloween runs as a module of CelebrationProvider

The Halloween event definition SHALL supply its existing icon, decoration, sixteen scene definitions, eleven random click scenes and a five-scene trick-or-treat secret pool to CelebrationProvider. It SHALL be selected only by UI_EVENT=halloween on `/`. HALLOWEEN_ENABLED, features.halloweenEnabled, HalloweenProvider and useHalloween SHALL be removed. The generic provider SHALL own lifecycle, random selection, portal and notifications; HalloweenDecor SHALL receive onActivate and its scene component SHALL not create a separate portal. Existing Halloween visuals, 80/54 connected-web spider counts, random weaving and departure, secret matching, accessibility, RTL and reduced-motion behavior SHALL be preserved.

#### Scenario: Halloween is selected
- **WHEN** UI_EVENT=halloween and the start page is open
- **THEN** existing Halloween artwork and interactions are rendered through the common event integration

#### Scenario: Halloween is not selected
- **WHEN** UI_EVENT is absent, none, unknown or another event
- **THEN** Halloween art and secret triggers are inactive

### Requirement: The easter egg is inert, accessible, and motion-safe

The easter egg SHALL persist nothing, read no storage, and issue no feature-specific API request; all of its state is in-memory and per-tab. The seasonal icon SHALL be a bundled SVG loaded through the normal asset pipeline.

**Accessibility:** The cobweb, the corner spider, the silk it spins over the pumpkin, and everything either celebration draws are decorative — they SHALL sit in `aria-hidden` layers that take no pointer events, and the announcement SHALL be the notification each celebration raises. The pumpkin SHALL be a labelled `IconButton` with `ButtonAppearance.Link`, a transparent background in idle, hover and pressed states, and a visible keyboard focus outline, kept outside the `aria-hidden` layer, so it stays focusable and is never an unreachable control inside a hidden subtree; it renders before that layer, which takes no pointer events, so the spider can paint over it without blocking clicks. The celebration layer SHALL be portaled to `document.body` so no scroll container clips it.

**RTL:** The decoration SHALL use logical positioning so the corner follows the document's `dir`. The web is drawn from its own top-left and sits in the inline-end corner, so it is mirrored and SHALL carry the `rtl:` counterpart that keeps its dense end in the screen corner. The mirror SHALL sit on the web itself and never on the corner wrapper: a flipped ancestor would also flip the spider's inline transform, so it would flee towards the pointer instead of away from it and jam against its leash. The spider SHALL be placed with logical insets instead, which follow the corner the same way the mirror does.

**Reduced motion:** Every animation the feature adds SHALL be suppressed under `prefers-reduced-motion: reduce`, resolving to a static frame rather than to an empty screen. Because an un-animated ghost would otherwise sit at the layer's origin with the rest of the flock stacked on top of it, each one SHALL carry a spread-out resting position used in that state; an un-animated spider SHALL likewise render already paid out on its thread rather than parked above the top edge.

**i18n impact:** Eighteen keys under `halloween.*` — the shared toast title, one message per celebration (each interpolating `{{phrase}}` and identifying the start-page chat), and the pumpkin's accessible name. The six additional scene messages SHALL use `halloween.trainToastMessage`, `halloween.portalToastMessage`, `halloween.ravensToastMessage`, `halloween.candyToastMessage`, `halloween.footprintsToastMessage` and `halloween.skeletonsToastMessage`. Four message-only scene notifications SHALL use `halloween.cauldronToastMessage`, `halloween.mimicToastMessage`, `halloween.bowlingToastMessage` and `halloween.mummyToastMessage`, each including the same secret phrase hint.

#### Scenario: A reduced-motion user still sees a celebration

- **WHEN** Halloween is selected, the user's system asks for reduced motion, and a celebration is triggered
- **THEN** the notification is raised and the drawings render in static, spread-out, on-screen positions instead of animating, with nothing left frozen off-screen or stacked at the origin

#### Scenario: The pumpkin has no button background

- **WHEN** the user hovers or presses the large pumpkin
- **THEN** its background remains transparent while its SVG supplies the visual response
- **AND** keyboard focus remains visible and Enter/Space activate the same event

## ADDED Requirements

### Requirement: Secret messages reveal exclusive animated illustrations

The Halloween secret pool SHALL include descending spiders and four additional scenes: a bubbling cauldron whose bubbles become faces before popping and whose pot dissolves in smoke; a toothy mimic chest that opens, reaches with its tongue, chews and hiccups; a rolling pumpkin that knocks history rows like bowling pins; and a mummy that enters from the side, strains against the chat input without initially moving it, then slowly pushes it out of the viewport. These four new scenes SHALL NOT appear in the pumpkin click pool. Each scene SHALL use detailed vector illustration with finite entry, action and exit. Cauldron, mimic and bowling SHALL finish within eight seconds with nine-second unmount deadlines; mummy SHALL finish within twelve seconds with a thirteen-second deadline. Positions SHALL remain stable during playback and fit 360/900 mobile and 1280/1920 desktop widths. Logical placement SHALL support RTL; the illustrations themselves SHALL preserve their physical composition. Reduced motion SHALL show a recognizable static frame, with no animated descendants. All art SHALL be aria-hidden, unfocusable and click-through. Existing UI_EVENT=halloween gating SHALL apply without new API, persistence, telemetry, feature-role or cache behavior.

#### Scenario: Secret scene discovery
- **WHEN** the user repeatedly submits the secret phrase on the start page
- **THEN** all five secret scenes are eligible without consecutive repeats, each with its notification and bounded cleanup

#### Scenario: Pumpkin and messages have separate pools
- **WHEN** the pumpkin is activated
- **THEN** none of cauldron, mimic, pumpkin bowling, mummy or descending spiders is selected

#### Scenario: Reduced-motion secret scenes
- **WHEN** reduced motion is requested and any of the four new scenes plays
- **THEN** a static recognizable illustration appears within the viewport until the shared runtime removes it

### Requirement: Secret scenes interact through temporary page snapshots

Secret scenes SHALL interact through existing selectors without edits to core page components: history scenes use celebration-history; mummy uses CONVERSATION_INPUT_CLASS.wrapper. Mummy SHALL walk in from a side, plant both hands against the visible composer and make unsuccessful pushing efforts while the input remains stationary until at least 36% of its timeline. It SHALL then lean harder and move the full-size input snapshot horizontally, slowly at first and continuously until it completely leaves the viewport. Mummy and input SHALL move together while in contact. The original composer SHALL retain focus and draft, including when triggered from its focused textarea. Cauldron SHALL pull up to two visible rows into its brew and return them as bubbles. Mimic SHALL extend a tongue to up to two neighboring rows, visibly wrap them with its tip and keep the row bundle attached while retracting. Tongue, wrapping loop and snapshots SHALL share capture/pull progress and one clock. Rows SHALL stay in place until contact; the chest SHALL remain open until swallowing, then chew and spit the rows back. Pumpkin bowling SHALL calculate collisions between its rendered circular body and the visible title bounds of history rows (clipped to their containers, excluding empty trailing space) along one viewport-space trajectory. Only rows intersecting that trajectory SHALL scatter (up to six), with distinct rotations. Each row SHALL remain stationary until its own contact time, briefly hold its scattered position, then return to its original position. Ball travel, rotation and row motion SHALL share a synchronized timeline, including when the panel is on the opposite side in RTL. Scenes SHALL temporarily animate only the originals' opacity, preserving layout and data, and restore them by the end of their respective timelines. Copies SHALL preserve presentation and scroll positions, have unique IDs, and remain inert and aria-hidden. Copies SHALL NOT retain navigation links. Snapshot work SHALL be bounded to 1500 elements per target.

Keyboard input, beforeinput, input, compositionstart, pointerdown, focus, scrolling, resizing, visibility changes, original subtree mutation, scene replacement, navigation, unmount or enabling reduced motion SHALL immediately cancel borrowing, remove copies/tethers and restore originals. Hidden, clipped, focused or expanded history SHALL NOT be borrowed. A focused composer SHALL remain eligible, but subsequent user input SHALL immediately restore it without dropping input. Missing or empty history, excessive snapshot size and unavailable/failed animation APIs SHALL fall back to standalone artwork. The existing portal interaction SHALL remain unchanged.

#### Scenario: The mummy struggles before pushing
- **WHEN** the mummy plays with a visible start-page composer
- **THEN** it enters from a side, visibly braces and strains while the composer remains stationary, then gradually pushes its copy completely offscreen before restoring it
- **AND** original focus, draft and conversation data remain unchanged

#### Scenario: User interrupts the illusion
- **WHEN** the user interacts with the page or history changes while borrowed
- **THEN** originals are immediately restored and temporary copies/tethers removed

#### Scenario: No safe target exists
- **WHEN** history is unavailable, hidden, clipped, focused, empty or beyond the snapshot budget, or reduced motion is requested
- **THEN** only the scene artwork plays and the real interface stays unchanged

#### Scenario: Bowling hits only rows in its path
- **WHEN** the pumpkin rolls toward the visible history
- **THEN** the pumpkin body visibly reaches each affected row before that row moves
- **AND** rows outside its swept circle remain unchanged

### Requirement: Descending spiders steal start-page elements

The nine descending spiders SHALL choose up to three available, fully visible targets from the welcome greeting, model-selector button, attachment control and history rows through existing semantic/public selectors. They SHALL descend to their targets, weave a visible hold and climb above the viewport with the snapshots attached. Carriers and cargo SHALL share transforms and timing. Originals SHALL keep layout, data and focus, return before eleven seconds, and be immediately restored on user interaction, source mutation, unmount or reduced motion. Focused/expanded controls and hidden/clipped targets SHALL be skipped. Reduced motion SHALL leave originals unchanged and show static spiders. Missing targets SHALL retain the decorative spider fallback. No core component, library, backend or persistence changes are allowed. The existing spiders notification SHALL describe the theft and retain the secret-phrase hint.

#### Scenario: Spider leaves with its prize
- **WHEN** the spider scene finds a visible eligible welcome element
- **THEN** its carrier reaches the element, wraps it and climbs with its inert snapshot, keeping their relative positions fixed until fully above the viewport
- **AND** the original returns at scene completion or immediately on input
