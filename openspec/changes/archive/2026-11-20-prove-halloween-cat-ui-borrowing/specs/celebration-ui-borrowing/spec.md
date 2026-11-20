# Spec Delta

## Purpose

How a pack scene borrows live interface controls through reversible copies while its authored Lottie motion stays in contact with them: the runtime behaviour of the `interaction-cat-borrow-v1` adapter. It covers target and anchor resolution, marker and slot rules, station retargeting, story and fall timing, copy tracks, single-clock synchronization, readiness, restoration and budgets. Defined by S4 (#9223).

## ADDED Requirements

### Requirement: The cat-borrow adapter needs an anchored placement and a capable browser

A scene that requires `interaction-cat-borrow-v1` SHALL be supported only when all of these hold:

- its placement, and every variant placement, is `composer-anchor-v1`
- it declares `direction: none`
- the browser provides `Element.prototype.animate`, `ResizeObserver` and `MutationObserver`

Otherwise `LottieScene` SHALL treat the scene as unsupported and render its poster. It SHALL load neither the player nor the data.

#### Scenario: Adapter on a viewport stage
- **WHEN** a scene requires `interaction-cat-borrow-v1` and declares `viewport-stage-v1` placement
- **THEN** the scene is unsupported, its poster renders, and no animation data or player is requested

#### Scenario: Mirrored cat-borrow scene
- **WHEN** a cat-borrow scene declares `direction: mirror`
- **THEN** the scene is unsupported, because the adapter derives every side from physical geometry

#### Scenario: No Web Animations support
- **WHEN** `Element.prototype.animate` is undefined and a cat-borrow scene activates
- **THEN** the poster renders, and the player is not imported

### Requirement: Targets are discovered once, within the borrowing limits

After the player and data load, the adapter SHALL measure once. It applies the button rules of the compiled Cat (`libs/celebrations/src/halloween/utils/halloween-cat-targets.ts`) to buttons in the host composer and starter list. It SHALL borrow at most two buttons, each with ≤ 60 descendants, ≤ 300 × 96 px and ≤ 24,000 px². It SHALL skip focused, editable, disabled, expanded, hidden, clipped, inert and aria-hidden buttons. The composer SHALL be an anchor only.

#### Scenario: A focused button is never borrowed
- **WHEN** the nearest composer button has focus at activation
- **THEN** that button is not a target, and its focus, rectangle and styles stay unchanged

#### Scenario: An oversized control is skipped
- **WHEN** a candidate button measures 320 × 40 px
- **THEN** it is not borrowed, and the next eligible button is used

#### Scenario: The composer is never copied
- **WHEN** a cat-borrow scene plays on an eligible composer that holds a draft and a selection
- **THEN** no copy of the composer exists, the composer is never transformed, and its draft, focus and selection stay unchanged

### Requirement: Physical anchors and the story come from measured geometry

The adapter SHALL resolve these anchors and sides:

- `entry-edge` and `exit-edge`: viewport edges
- `perch`: the composer's top edge above the first stand point
- `prize-0` and `prize-1`: each button's near inline edge on its bottom edge

A button is reachable only when the authored push fits before the viewport edge and the stand point fits inside the cat margins. Two reachable buttons give `two-prizes`, one gives `one-prize`, none gives `crossing`.

#### Scenario: Two reachable buttons
- **WHEN** an eligible composer has two reachable buttons
- **THEN** the two-prize story plays, and the cat works the first button from the side its center prefers

#### Scenario: A button too close to the viewport edge
- **WHEN** the authored push would carry a button within 3 px of the viewport edge on both sides
- **THEN** that button is not reachable, and the story uses the remaining buttons

#### Scenario: No composer
- **WHEN** no composer is eligible and the placement fallback is `stage-anchor`
- **THEN** the crossing story plays around the synthetic anchor, and no button is borrowed

### Requirement: Station keyframes are retargeted, never generated

The adapter SHALL change only these values:

- the values of the `cat-root` position keyframes and the sign of the `cat-facing` x-scale keyframes. Each such keyframe is bound by a `cat:bind:<anchor>` marker range, and keeps its authored offset from that anchor's `anchor:<anchor>` reference null, mirrored when the measured side differs from the authored one
- the `cat-floor` slot
- the time-remap track of `cat-rig`

Keyframe times, counts and easing SHALL stay as authored.

#### Scenario: Wide desktop composer
- **WHEN** the asset is authored around a reference perch and plays above a composer 900 px wide
- **THEN** the cat lands on the measured composer's top edge, and every other `cat-root` keyframe in the perch range keeps its authored offset from the perch

#### Scenario: Keyframes are not added
- **WHEN** preparation finishes
- **THEN** every layer of the private copy has the same keyframe count and the same keyframe times as the loaded asset

### Requirement: Paw contact holds at every contact marker

At each `cat:contact:<prize>` marker, the cat's paw contact point SHALL lie on the copy's near edge within 2 CSS px horizontally. It SHALL lie between the copy's top and bottom. This SHALL hold at 360, 390, 1280 and 1920 px widths, in LTR and RTL, and for button heights from 20 to 96 px. Reach comes only from the anchored stand point, never from per-frame measurement or computed joint angles.

#### Scenario: Contact frames across layouts
- **WHEN** the browser matrix samples the rendered frame nearest each contact marker for every width in LTR and RTL with real `ConversationInput` geometry
- **THEN** the paw is within 2 CSS px of the copy's near edge in every frame, and the frames are saved with the change's evidence

#### Scenario: A tall starter button
- **WHEN** the borrowed button is 56 px tall
- **THEN** the paw touches its near edge at the authored height above its baseline, inside the button's side edge

### Requirement: Copies follow the authored track, then physics

Up to the `cat:release:<prize>` marker, each copy SHALL follow its `prize-N` track: x (mirrored by side), rotation and opacity. After release it SHALL fall by `y = drop · p²` at 2000 px/s² onto the first starter button below it, or else to 2 px above the viewport bottom, and tilt toward its side by at most 12°. The last copy rebounds to `min(0.32 · drop, 0.75 · cat size)`. Copies only translate and rotate.

#### Scenario: Fall onto a starter button
- **WHEN** a starter button lies 40 px below the released button and overlaps its pushed span by at least 16 px
- **THEN** the copy lands on that button's top edge after `√(2 · drop / 2000)` s

#### Scenario: RTL copy text
- **WHEN** a copy of a button with Arabic text is pushed and falls in an RTL document
- **THEN** the copy is never mirrored, and its text reads as in the original

### Requirement: Story sections and fall time use a bounded time remap

On a private copy, the adapter SHALL write a piecewise-linear time remap on `cat-rig`, never on the root, that does both of these:

- **Section.** Select `two-prizes`; the prefix up to `cat:branch:one-prize` followed by the one-prize tail; or `crossing`.
- **Fall.** For a `cat:landing:<prize>` marker with a duration, map the authored fall (`cat:release:<prize>` to the landing) onto the physical fall at whatever speed the measured drop needs. The authored elastic range after the landing then absorbs the difference at a speed of 0.8–1.25, so later motion keeps its authored time. When the elastic range would need a speed outside that bound, the prize is unreachable.

#### Scenario: Recoil follows the physical landing
- **WHEN** the last copy's physical fall is 180 ms longer than the authored fall
- **THEN** the cat's authored recoil starts within one frame of the copy's landing, and the departure keeps its authored time

#### Scenario: A drop the elastic range cannot absorb
- **WHEN** the second button's drop needs an elastic speed above 1.25
- **THEN** the second button is unreachable, and the one-prize story plays with the first button

#### Scenario: Crossing section
- **WHEN** the crossing story is selected
- **THEN** only the crossing section plays, the composition ends at that section's end, and no button is borrowed

### Requirement: Malformed markers or slots fail before playback

Preparation SHALL fail before playback, and the poster SHALL show, when any of these holds:

- a `cat:` marker is unknown, out of range or duplicated within a section. Only `cat:contact` repeats, up to four times per prize
- `cat:bind` ranges overlap or leave a `cat-root` keyframe unbound
- markers break the order entry, contact, release, landing, restore
- a reserved layer is missing, duplicated or malformed

Markers outside `cat:` SHALL be ignored.

#### Scenario: Duplicate bind marker
- **WHEN** the asset has two `cat:bind:perch` ranges in the same section
- **THEN** preparation fails, the poster shows for `posterDurationMs`, and no copy is created or original touched

#### Scenario: Foreign markers
- **WHEN** the asset also carries markers named `intro` and `{"note":"draft"}`
- **THEN** they are ignored, and the scene plays

### Requirement: Copies and the cat share one clock

The copies' animations, and the originals' opacity animations, SHALL start once, with their start time set to the `timelineZeroMs` that the session reports on the first rendered frame. Both clocks derive from `document.timeline`. After a skipped or long frame, the next rendered frame SHALL show the paw and the copy at the same composition time. Drift SHALL NOT accumulate, and a compositor-driven copy MAY lead by at most the skipped frame.

#### Scenario: Long task during a push
- **WHEN** a 200 ms main-thread task occurs while the paw pushes a copy
- **THEN** after the next rendered frame the paw is within 2 CSS px of the copy edge again, and the remaining timeline is not delayed

#### Scenario: Cancelled before the first frame
- **WHEN** the scene is cancelled after `play()` but before the first rendered frame
- **THEN** no copy or original animation was started, and the copies are removed

### Requirement: Readiness covers the renderer and the copies

Copies SHALL be cloned during preparation, within the existing snapshot budget. They are attached hidden in a scene-owned layer beneath the renderer when the renderer is created. Playback SHALL start only after the session's readiness. A snapshot failure SHALL be a failure before playback, and the poster SHALL show. Apply SHALL record the preparation time under 4× CPU throttling against a 50 ms target.

#### Scenario: Snapshot budget exceeded
- **WHEN** cloning a borrowed button throws because it exceeds the snapshot budget
- **THEN** preparation fails, the poster shows, and no original is hidden or animated

### Requirement: Every termination restores the page exactly once

These endings SHALL remove the copies once, cancel the originals' opacity animations once, release every listener, observer and timer once, and never restart the activation:

- completion
- cancellation: interaction, scroll outside the scene, resize, a hidden document, a target that moves by more than 0.5 px, mutates or disconnects, an environment change, or a reset key change
- failure
- unmount

A failure after the first frame SHALL render nothing and start no fallback scene in that activation.

#### Scenario: Repeated activations and interruptions
- **WHEN** the scene is activated and interrupted 20 times at varied phases: loading, before the first frame, mid-push, after release and during the rebound
- **THEN** no copy remains, no original is hidden or holds an animation, no listener, observer, timer or renderer node remains, and the heap after collection returns to within the recorded tolerance

#### Scenario: Player error mid-story
- **WHEN** the player emits `error` 12 s into playback
- **THEN** the originals are visible at once, the scene renders nothing, and the bundled Cat does not start until the next activation

#### Scenario: An unrelated notification
- **WHEN** a notification portal appears and disappears without moving any borrowed target or the composer
- **THEN** the story continues to the end

### Requirement: Borrowing scenes stay decorative and host-agnostic

The scene and its copies SHALL be `inert`, aria-hidden and pointer-transparent. Copies keep unique IDs and drop `href`, `name` and `autofocus`. Anchors arrive only as class names through `CelebrationEnvironment`, and manifests carry no selectors, code or parameters. State lives in `LottieScene` and its session, with the playback object memoised. There is no new string, feature flag, telemetry or cache.

#### Scenario: Keyboard user during playback
- **WHEN** a keyboard user presses Tab while the cat pushes a copy
- **THEN** focus never enters the scene or a copy, the scene is cancelled, the original is visible, and focus moves to the next host control

#### Scenario: Unrelated host re-render
- **WHEN** the host re-renders while the scene plays and its inputs are unchanged
- **THEN** the session is not restarted, and no copy is re-created
