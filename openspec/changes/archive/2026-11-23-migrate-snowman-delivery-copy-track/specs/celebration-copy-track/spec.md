# Spec Delta

## Purpose

Runtime behaviour of the `interaction-copy-track-v1` adapter. An authored Lottie asset at reference geometry plays on measured host geometry, and decorative DOM copies of host content follow authored tracks on the Lottie clock. Only geometry rules live in code. Defined by S7 batch 1 (#9226), and first used by `snowman-delivery`.

## ADDED Requirements

### Requirement: The copy-track adapter needs an anchored placement and a capable browser

A scene that requires `interaction-copy-track-v1` SHALL use `composer-anchor-v1` placement and `direction: none`, and SHALL require no other `interaction-*` capability. It SHALL run only where `ResizeObserver`, `MutationObserver` and `Element.prototype.animate` exist. Otherwise the scene SHALL be unsupported, or SHALL show its poster without loading the player or the data.

#### Scenario: Viewport placement
- **WHEN** a scene requires `interaction-copy-track-v1` with `viewport-stage-v1` placement
- **THEN** it is unsupported, and a known event keeps its bundled scene

#### Scenario: Two adapters
- **WHEN** a scene requires both `interaction-copy-track-v1` and `interaction-cat-borrow-v1`
- **THEN** it is unsupported

#### Scenario: No Web Animations
- **WHEN** `Element.prototype.animate` is missing and a copy-track scene activates
- **THEN** the poster renders, and neither the player nor the data is requested

### Requirement: Stages are fixed by the adapter and measured once

The adapter SHALL define three stage templates. Each template derives a floor line, a stance and a free band from `anchors.composer`, `anchors.starterList` and `anchors.welcomeRegion`, measured once at preparation:

- `ledge`: under the bottom starter row
- `rim`: on the composer's upper edge
- `platform`: below the lowest host content

The rules belong to the capability ID, and a change to them is a new ID.

#### Scenario: Starters below the composer
- **WHEN** the starter row lies below the composer and a free band below the row fits the section's cast band
- **THEN** the `ledge` stage qualifies, with its floor at the borrowed card's bottom plus the card's height plus the authored reach

#### Scenario: Band blocked by host text
- **WHEN** a stage's band at every allowed span length intersects the heading, the composer's content or a starter other than the borrowed one
- **THEN** that stage does not qualify, and the next section is tried

#### Scenario: Geometry changes after preparation
- **WHEN** a watched anchor or measured target moves or changes after preparation
- **THEN** the scene ends, every original is restored, and nothing renders

### Requirement: Copy roles are fixed by the adapter

The adapter SHALL define exactly two copy roles:

- `starter-card` copies one eligible starter button as an inert computed-style clone, and hides the original by opacity.
- `composer-word` copies the first text run of the composer textarea's value or placeholder as an inert span over a background cover, and never touches the textarea.

Eligibility and node limits are adapter rules.

#### Scenario: Eligible card
- **WHEN** a starter button is enabled, unfocused, not hovered, untransformed, within the size limits, unclipped, in the viewport and within 40 nodes
- **THEN** it can fill the `starter-card` role, and at most four starter buttons are inspected

#### Scenario: Word copy leaves the textarea alone
- **WHEN** a `composer-word` copy plays
- **THEN** the textarea's value, placeholder, selection, focus and attributes are unchanged before, during and after the scene

#### Scenario: No word available
- **WHEN** the textarea has no text run, or no opaque background exists behind it
- **THEN** the `composer-word` role is unresolved, and a section that needs it does not qualify

### Requirement: The first qualifying section in authored order plays

The asset SHALL declare one or more sections. Each names one stage and at most one copy role. The adapter SHALL try them in authored order and play the first whose stage qualifies and whose role resolves. When none qualifies, the preparation SHALL fail and the poster SHALL show.

#### Scenario: SnowmanDelivery order
- **WHEN** the snowman asset declares `ledge` with a card, `rim` with a card, `rim` with no copy, and `platform` with no copy, in that order
- **THEN** the chosen section matches the compiled scene's stage choice for the same geometry

#### Scenario: Nothing fits
- **WHEN** no section qualifies
- **THEN** the poster shows, and no host element is copied or hidden

### Requirement: Variant windows are spliced without moving later beats

A section MAY replace parts of the shared trunk with its own windows. Each replaced trunk range and its window SHALL have equal duration and matching poses at both ends. The adapter SHALL splice them through one time remap on the rig precomposition, so every later beat keeps its composition time.

#### Scenario: Drawn-sled story
- **WHEN** the `rim` section with no copy plays
- **THEN** its rig-sized sled's window replaces the trunk from the pickup to the end, exit included, and the impact, head flight and return beats keep their authored composition times

#### Scenario: Rim-card slot
- **WHEN** the `rim-card` section plays
- **THEN** its pickup and its slot return replace the ledge card's, and the card copy returns to its own row above the composer

#### Scenario: Unequal splice
- **WHEN** a window's duration differs from the trunk range it replaces
- **THEN** the asset is malformed, and the preparation fails before playback

### Requirement: Station keyframes are bound, stretched or followed, never generated

Keyframes on the adapter's track layers SHALL be:

- **bound**: translated to a measured anchor
- **stretched**: moved between the two neighbouring bound anchors in proportion to the key's own track's progress across the range
- **followed**: a rigid group translated with its anchor

Travel toward −x SHALL mirror the whole stage rather than individual keys.

The adapter SHALL NOT change keyframe times, easing or count.

#### Scenario: Longer slide
- **WHEN** the span solver picks a slide longer than the authored reference
- **THEN** the push keys move in proportion between the seat and impact anchors, the snowbank and the tree move with their anchors, and every keyframe time is unchanged

#### Scenario: An offset object on the glide
- **WHEN** the sled corner, authored behind the seat, moves through the glide at a span shorter than the reference
- **THEN** it stays the same distance behind the seat at every key

#### Scenario: Unbound keyframe
- **WHEN** a track keyframe lies outside every bind, stretch or follow range
- **THEN** the asset is malformed, and the preparation fails before playback

### Requirement: A resting object stays where it was put

A track keyframe equal to the one before it SHALL keep that keyframe's bound value, whichever range the scene has moved on to.

#### Scenario: The card rests at the crash while the snowman recovers by the tree
- **WHEN** the scene binds the snowman to the far anchor after the crash and the card copy has not moved since it settled
- **THEN** the card copy stays at the crash, bound to the span end, until it is picked up

### Requirement: The span length comes from two authored references

Every stretchable anchor SHALL have two authored reference positions, at the minimum and at the maximum span. The adapter SHALL choose the longest span that the stage's band and the viewport allow, searching from the maximum down in 8 px steps and in both directions. It SHALL place each stretchable anchor by linear interpolation between its references.

#### Scenario: Narrow viewport
- **WHEN** only a span shorter than the maximum fits
- **THEN** the head-flight distance shrinks with it, so the head's speed stays within 20 % of the sled's speed at separation

#### Scenario: Below the minimum
- **WHEN** even the minimum span does not fit in either direction
- **THEN** the stage does not qualify

### Requirement: A section can lay out from its own references

A root null named `<base>#<kind>[,<kind>…]` SHALL override `<base>` for the named sections only: a stretchable reference `anchor:<name>` or `anchor:<name>@min` for `span-start`, `span-end` and `far`; the position of a follow group `ct-follow:<anchor>`; or the keyframes of `ct-travel`. The adapter SHALL solve the span, bind, stretch and carry the travel against the chosen section's references, and drop every override from the prepared composition.

#### Scenario: Drawn sled at the rig's size
- **WHEN** `rim` and `platform` override the span and far references, the snowbank group and the travel with the rig-sized sled's layout
- **THEN** they fit the same viewports as the compiled `rim-sled` and `platform` stages, and the sled front still meets the snowbank at impact

#### Scenario: Override for an undeclared section
- **WHEN** an override is parented, names a section the asset does not declare, names a base outside the list, or repeats another override's base for the same section
- **THEN** the asset is malformed, and the preparation fails before the page is measured

### Requirement: Follow groups and the band stay on the base references

A follow group SHALL move to its measured anchor plus its authored offset from the base reference, whichever section plays. The band SHALL reach past `far` by its overhang from the base `far` reference in every section.

#### Scenario: The tree with a nearer far reference
- **WHEN** the chosen section overrides `far` with a nearer reference
- **THEN** the tree group still stands at the measured far anchor plus its authored offset from the base `far` reference

### Requirement: Step cycles repeat to cover the measured distance

An authored step-cycle window SHALL repeat a whole number of times. The count is the measured distance divided by the authored stride, rounded. The time remap SHALL fit the repetitions into the window's fixed composition time.

#### Scenario: Long return walk
- **WHEN** the return walk covers three times the authored distance
- **THEN** it plays three times as many cycles in the same composition time, and each planted foot slides at most 4 CSS px per stance

#### Scenario: Cycle pose mismatch
- **WHEN** a cycle's first and last poses differ beyond tolerance
- **THEN** the asset is malformed

### Requirement: A repeated cycle's stride matches the measured distance

The adapter SHALL scale each repeated cycle's stride to the measured distance per repetition. A track keyframe inside the cycle SHALL keep its time and easing, and its x offset from the track's keyframe at the cycle start SHALL be multiplied by the measured distance divided by the count times the authored stride. A track with no keyframe at the cycle start SHALL be left as authored.

#### Scenario: Few cycles on a phone
- **WHEN** a mobile return walk holds three to five stances at any span the solver allows
- **THEN** each planted foot slides at most 4 CSS px per stance

### Requirement: Copies follow authored two-dimensional tracks

Each resolved copy SHALL follow its role's authored track (x, y, rotation, opacity) after the same binding as the track layers. The copy SHALL be visible only between its entry and restore markers. The original SHALL be hidden only in that window and restored at its end. Copies SHALL never be mirrored or scaled.

#### Scenario: Card rides the sled
- **WHEN** the `starter-card` copy is on its track during the ride
- **THEN** the copy's corner stays within 2 CSS px of the snowman's grip and seat contact markers

#### Scenario: Card returns to its slot
- **WHEN** the restore marker is reached
- **THEN** the copy is within 0.5 px and 0.01° of the original's rect, the original fades back in, and the copy is removed

### Requirement: Conditional layers follow the chosen section's copy

A layer whose name starts with `ct-if:copy` SHALL be visible only when the chosen section resolves a copy role. A layer whose name starts with `ct-if:no-copy` SHALL be visible only when it resolves none. The adapter SHALL change only the opacity of these layers, on its private data copy.

#### Scenario: Drawn sled
- **WHEN** the chosen section has no copy role
- **THEN** the drawn sled layer is visible, and no host element is copied or hidden

### Requirement: Malformed copy-track assets fail before playback

The adapter SHALL validate the asset before playback, with the same rules as the themes check:

- slots are singletons
- the `ct:` marker grammar and order hold
- splices pair and match in duration
- every track keyframe is covered by a range
- each stretchable anchor has both references
- cycles close
- every section names a known stage and role
- every section override names declared sections and an overridable base

Any violation SHALL fail the preparation and show the poster.

#### Scenario: Unknown role
- **WHEN** a section names a copy role that `interaction-copy-track-v1` does not define
- **THEN** the preparation fails before playback, and the poster shows

### Requirement: Copies and the Lottie scene share one clock

Copy animations SHALL start on the `timelineZeroMs` the session reports on the first rendered frame. During playback the scene SHALL do no per-frame host layout reads, geometry polling or React state updates. After a main-thread stall, contact SHALL recover within 2 CSS px on the next frame, with no cumulative drift.

#### Scenario: Injected long task
- **WHEN** the S8 rollout check blocks the main thread for 200 ms mid-ride under 4× CPU throttling
- **THEN** the copy is back within 2 px of its contact on the next frame, and the story ends within one frame of its authored time

### Requirement: Every termination restores the page exactly once

On completion, cancellation, failure or unmount, the adapter SHALL stop the copy animations, remove the copies, restore every original and release observers and listeners exactly once. Pointer, keyboard, focus, input, composition, scroll, resize and a hidden document SHALL cancel the scene.

#### Scenario: Typing during a word copy
- **WHEN** the user types into the composer while a `composer-word` copy is on screen
- **THEN** the scene cancels, the copy and its cover are removed in the same task, and the typed text is unaffected

### Requirement: Copy-track scenes stay decorative and host-agnostic

The scene and its copies SHALL be `inert`, `aria-hidden` and pointer-transparent. Copies SHALL keep unique IDs and drop `href`, `name` and `autofocus`. The adapter SHALL read only host-supplied anchor class names and the supplied direction. Manifests SHALL carry no selectors, code or parameters. The adapter adds no string, flag, telemetry or cache.

#### Scenario: Keyboard user during playback
- **WHEN** a keyboard user presses Tab while the card copy rides
- **THEN** focus never enters the scene or the copy, the scene is cancelled, the original is visible, and focus moves to the next host control

### Requirement: Copy-track preparation time is measured

Preparation, from the data's arrival to a ready private copy, SHALL be measured on the live host DOM under 4× CPU throttling before any production rollout of a copy-track scene (S8, #9227). Its p95 SHALL be at most 50 ms on desktop and mobile layouts.

#### Scenario: Preparation benchmark
- **WHEN** the S8 rollout check runs the preparation 20 times at 1280 px and at 390 px under 4× throttling
- **THEN** the reported p95 is at most 50 ms
