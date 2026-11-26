## MODIFIED Requirements

### Requirement: The empty chat carries seasonal decoration with a pumpkin trigger

While Halloween is the selected, loaded event on the start page, `NewConversationComposer` SHALL render `CelebrationDecor` (from `@epam/ai-dial-celebrations`, which renders the event's `HalloweenDecor`) inside its welcome-screen region whenever the celebration is enabled and the composer is not in its inline layout: a single cobweb pinned to the region's inline-end top corner with a spider perched on it, and a pumpkin button rendered before the decoration layer so the spider paints over it. `CelebrationDecor` SHALL render the selected event decoration, or nothing when the runtime is disabled. HalloweenDecor receives an onActivate callback and does not read config or select scenes.

The webs SHALL stay faint — they frame the screen rather than compete with it — and the faintness SHALL live on the web drawing, not on the corner wrapper, so the spiders keep their contrast.

Each pumpkin click SHALL randomly select ghosts, a web-weaving celebration, bats, a cat that tests gravity on interface buttons, flying witches, a ghost train, a claw portal, perched ravens, candy rain, invisible paw prints, or dancing skeletons. Every scene SHALL be eligible on the first click. Later clicks SHALL exclude the preceding pumpkin scene, with all other scenes equally eligible. Each click SHALL replace the active effect. Keyboard Enter/Space and touch SHALL use the same selection behaviour.

Every celebration SHALL raise a success notification and SHALL clear itself after its configured scene duration, which SHALL outlast its finite artwork animations. Footprints is the one exception: its 12000ms deadline equals its 12000ms story, and the provider starts the deadline at activation while the story starts only after the scene has measured its targets, so the deadline can cut the story's last frames by that preparation delay. Scenes without an entry in `HALLOWEEN_SCENE_DURATIONS` (ghosts, web, descending spiders) SHALL default to `HALLOWEEN_BURST_DURATION_MS` (14000ms); bats, cat and witches use their scene duration plus 500ms, and the six additional click scenes use individual deadlines: train 12000ms, portal 10000ms, ravens 13000ms, candy `CANDY_DEADLINE_MS` (35500ms), footprints 12000ms and skeletons `SKELETON_DEADLINE_MS` (12000ms). Repeating the same celebration SHALL restart its animations rather than leave the layer untouched.

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

#### Scenario: Footprints has no margin before its deadline

- **WHEN** Footprints plays uninterrupted
- **THEN** the provider clears the scene 12000ms after activation, while its 12000ms story starts only once the targets are measured, so the last frames of the final prints and grin can be cut
- **AND** every other scene with an entry in `HALLOWEEN_SCENE_DURATIONS` finishes its story before its deadline

### Requirement: Further clicks reveal other characters

The bat scene SHALL stage the three-bat crosswind story when a usable composer is available, with its own eighteen-second lifetime. When attachment space or the composer is unavailable it SHALL retain sixteen small bats with staggered curved flights and flapping wings. The cat scene SHALL stage the gravity-testing story on eligible interface anchors, with a decorative crossing cat as fallback. The witch scene SHALL stage the two-witch “Wrong spell” lesson with a twenty-second animation and a 20.5-second mount lifetime. Each scene SHALL announce its own translated notification and respect the same navigation, configured-lifetime and click-through guarantees.

Every added animation SHALL be disabled under reduced motion. Characters SHALL remain visible in separated static positions, not frozen off-screen. All character drawings SHALL be decorative SVG, with no sound.

#### Scenario: Another character scene is selected

- **WHEN** random pumpkin selection chooses bats, the cat or witches
- **THEN** the corresponding characters play their scene and its translated notification announces the secret phrase
- **AND** reduced motion displays separated static characters while navigation and scene deadlines still remove the effect

### Requirement: Secret scenes interact through temporary page snapshots

Secret scenes SHALL interact through existing selectors without edits to core page components: history scenes read the host-supplied `CelebrationAnchors` `historyContainer` and `historyRowLink`; mummy reads the host-supplied `composer` anchor. The library SHALL NOT name an app class for either. Mummy SHALL walk in from a side, plant both hands against the visible composer and make unsuccessful pushing efforts while the input remains stationary until at least 36% of its timeline. It SHALL then lean harder and move the full-size input snapshot horizontally, slowly at first and continuously until it completely leaves the viewport. Mummy and input SHALL move together while in contact. The original composer SHALL retain focus and draft, including when triggered from its focused textarea. Cauldron SHALL pull up to two visible rows into its brew and return them as bubbles. Mimic SHALL extend a tongue to up to two neighboring rows, visibly wrap them with its tip and keep the row bundle attached while retracting. Tongue, wrapping loop and snapshots SHALL share capture/pull progress and one clock. Rows SHALL stay in place until contact; the chest SHALL remain open until swallowing, then chew and spit the rows back. Pumpkin bowling SHALL calculate collisions between its rendered circular body and the visible title bounds of history rows (clipped to their containers, excluding empty trailing space) along one viewport-space trajectory. Only rows intersecting that trajectory SHALL scatter (up to six), with distinct rotations. Each row SHALL remain stationary until its own contact time, briefly hold its scattered position, then return to its original position. Ball travel, rotation and row motion SHALL share a synchronized timeline, including when the panel is on the opposite side in RTL. Scenes SHALL temporarily animate only the originals' opacity, preserving layout and data, and restore them by the end of their respective timelines. Copies SHALL preserve presentation and scroll positions, have unique IDs, and remain inert and aria-hidden. Copies SHALL NOT retain navigation links. Snapshot work SHALL be bounded to 1500 elements per target.

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

#### Scenario: Targets come from host anchors

- **WHEN** a host supplies `historyContainer`, `historyRowLink` and `composer` anchors with its own class names
- **THEN** the history scenes borrow rows matching those anchors, Mummy pushes the composer matching that anchor, and no library code depends on the host's class names

#### Scenario: Bowling hits only rows in its path
- **WHEN** the pumpkin rolls toward the visible history
- **THEN** the pumpkin body visibly reaches each affected row before that row moves
- **AND** rows outside its swept circle remain unchanged

### Requirement: Skeletons playback is bounded and reversible

Skeletons SHALL measure at most four composer candidates and one greeting heading (at most 16 text nodes) with cached reads and at most 32 ancestor checks, SHALL create no DOM snapshot and SHALL never animate or mutate a live control or its text. The one exception is the greeting heading's last word: Skeletons SHALL hide it only visually through a CSS custom highlight, without changing the heading's DOM, text, focus or selection, and SHALL remove the highlight at the end of the timeline or on any interruption. It SHALL use at most 22 animations, 80 keyframes per track, 100 SVG nodes and two timers besides the deadline, without filters, masks, raster images or per-frame geometry reads or React updates.

#### Scenario: Interaction interrupts the skeletons

- **WHEN** typing/composition, pointer/focus, scrolling, resize, a relevant composer or greeting change, a hidden document, changed mobile/motion/anchor settings, replacement or unmount interrupts playback
- **THEN** all owned animations, timers, highlights, listeners and observers are released idempotently and the draft, focus and selection are unchanged
- **AND** cancelled preparation cannot restart later

#### Scenario: Only the greeting word is hidden, and only visually

- **WHEN** Skeletons steals the greeting's last word
- **THEN** that word's glyphs are hidden through a CSS custom highlight while the heading's DOM, text, focus and selection stay unchanged
- **AND** no other live control or text is hidden, animated or mutated
