## MODIFIED Requirements

### Requirement: Further clicks reveal other characters

The bat scene SHALL stage the three-bat crosswind story when a usable composer is available, with its own eighteen-second lifetime. When attachment space or the composer is unavailable it SHALL retain sixteen small bats with staggered curved flights and flapping wings. The cat scene SHALL stage the gravity-testing story on eligible interface anchors, with a decorative crossing cat as fallback. The witch scene SHALL stage the two-witch “Wrong spell” lesson with a twenty-second animation and a 20.5-second mount lifetime. Each scene SHALL announce its own translated notification and respect the same navigation, configured-lifetime and click-through guarantees.

Every added animation SHALL be disabled under reduced motion. Characters and wisps SHALL remain visible in separated static positions, not frozen off-screen. All character drawings SHALL be decorative SVG, with no sound.

#### Scenario: Another character scene is selected

- **WHEN** random pumpkin selection chooses bats, the cat or witches
- **THEN** the corresponding characters play their scene and its translated notification announces the secret phrase
- **AND** reduced motion displays separated static characters while navigation and scene deadlines still remove the effect

## ADDED Requirements

### Requirement: Witches teach a bounded spell lesson using page buttons

Witches SHALL show an apprentice and a mentor with distinct expressive poses. They SHALL arrive by broom, the apprentice SHALL levitate eligible button copies and turn them into recognizable frog-like buttons, then try to herd their jumps with her broom and accidentally enchant the broom. The mentor SHALL undo the spell and return the buttons to their original positions. Departure SHALL include a final small broom hop and apprentice reaction. Gestures, spell arrival, jumps, broom interactions and restoration SHALL share a coherent timeline.

The scene SHALL borrow at most two desktop or one mobile visible idle buttons through host-supplied composer/starter anchors. Targets SHALL contain at most 40 descendants and measure no more than 240×64px / 15,360px². Hidden, clipped, focused, disabled, expanded or editable targets SHALL be skipped. Copies SHALL retain recognizable content and remain inert, aria-hidden and pointer-transparent. The real composer SHALL never be copied or moved; draft, focus, selection, layout and application data SHALL remain intact.

`HalloweenWitches` SHALL own a stable per-activation plan and temporary artwork. The existing CelebrationProvider SHALL retain selection, event loading, notifications and replacement. The existing `halloween.witchesToastMessage`, `UI_EVENT`/activeEventId gate and scene ID SHALL remain; no new feature flags, strings, API, telemetry, persistence or shared cache SHALL be introduced.

#### Scenario: The lesson goes wrong and the mentor fixes it

- **WHEN** Witches plays with eligible buttons
- **THEN** arrival and levitation precede frog-like hops, the broom-herding attempt and broom enchantment
- **AND** the mentor restores the buttons before both witches depart with the final broom-hop joke

#### Scenario: Only one button or no usable targets exist

- **WHEN** only one safe target exists or the scene is mobile
- **THEN** the same story uses at most one button
- **WHEN** no safe targets or composer are available
- **THEN** a bounded two-witch broom-only lesson plays without borrowing UI

#### Scenario: Character motion preserves cause and weight

- **WHEN** a witch casts, herds a button or reacts to the enchanted broom
- **THEN** the spell originates at the posed hand, broom contact precedes the chased hop, and the recoil follows the spell's arrival
- **AND** flight arcs, hop anticipation/landing and delayed hat/cloak settling make the characters' different temperaments readable without increasing the resource budgets
- **AND** a returned copy remains visible until its original has fully regained visibility, before departure begins

#### Scenario: RTL and reduced motion

- **WHEN** the host uses RTL
- **THEN** movement attaches to actual target coordinates and button text is not mirrored
- **WHEN** reduced motion is enabled or WAAPI is unsupported
- **THEN** a static, visible two-witch composition appears with no target collection, snapshots or active animation

### Requirement: Witches performance and cleanup are bounded

The scene SHALL use no more than 24 candidate buttons, 32 ancestor checks per candidate, two witches, two/one desktop/mobile snapshots, 48 active WAAPI animations and 160 keyframes per track. Geometry and styles SHALL be cached during preparation; ongoing playback SHALL use precomputed transform/opacity tracks without per-frame layout reads, React updates or JavaScript animation loops. No animated filters, full-screen raster redraw loop, unbounded particles or new animation dependency SHALL be added. Only actual relevant anchor mutations/resizing SHALL trigger geometry revalidation for cancellation.

All originals SHALL return before departure. Input/composition, pointer down, focus changes, scrolling, resizing, source changes, hidden documents, changed reduced-motion/mobile preferences, scene replacement and unmount SHALL cancel preparation/playback and restore originals immediately. Cleanup SHALL cancel every owned animation, remove snapshots, clear timers and disconnect listeners/observers idempotently. Failed snapshot or animation setup SHALL leave the chat usable. A canceled activation SHALL never restart from deferred work.

#### Scenario: Steady playback stays within the budget

- **WHEN** the scene plays without host changes after preparation
- **THEN** it respects copy/animation/keyframe budgets and performs no further layout reads or React updates per frame

#### Scenario: User resumes interacting

- **WHEN** typing, focus, pointer interaction, scrolling, resizing or a motion-preference change interrupts playback
- **THEN** originals are restored, copies disappear and all owned resources stop without changing the draft or focus

#### Scenario: Repeated activation and failed setup

- **WHEN** scenes repeatedly start and stop, including a failed animation setup
- **THEN** no animation, timer, observer or hidden original accumulates
- **AND** an unrelated toast portal disappearing does not cancel otherwise valid playback
