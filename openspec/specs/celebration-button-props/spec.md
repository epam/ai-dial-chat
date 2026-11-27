# celebration-button-props Specification

## Purpose

Allow authored celebration scenes to borrow at most two small interface buttons along reversible paths synchronized with character contact.

## Requirements

### Requirement: Borrowing uses eligible inert copies
The capability SHALL copy at most two buttons on desktop and one on mobile, each at most 40 nodes and 64 by 56 CSS pixels. Focused, editable, expanded, disabled, clipped or transformed targets SHALL remain untouched. Authored contact offsets SHALL bind once to measured centers.

#### Scenario: Eligible button
- **WHEN** the actor reaches a valid button
- **THEN** its inert copy starts at the measured center on the animation clock while the real control retains layout, data and focus behavior

### Requirement: Invalid assets fail before mutation
The capability SHALL validate bounded tracks, finite coordinates, identity transforms, unique references, hierarchy, ordered entry/restore markers and returned prop positions before borrowing. Cached assets SHALL remain unchanged. Unsupported clients SHALL preserve their existing scene selection.

#### Scenario: Malformed track
- **WHEN** a track contains invalid geometry or inconsistent contact times
- **THEN** the scene uses its static fallback without hiding a real control

### Requirement: Every termination restores originals
Completion, interaction, focus, scrolling, target changes, viewport changes, hidden tabs, navigation and unmount SHALL remove copies and cancel animations/listeners immediately. No per-frame host measurements or React updates SHALL be introduced.

#### Scenario: Typing during pickup
- **WHEN** the user types while a button is borrowed
- **THEN** its original is immediately visible, the copy and characters disappear, and the draft remains available

### Requirement: Contact translations keep the cast inside the viewport
Borrowing SHALL occur only when a conservative authored artwork envelope remains inside the viewport for the full blended contact motion. Invalid bounds SHALL fail before mutation. When bounds are absent, the complete composition rectangle SHALL be used. Unsafe contacts SHALL use drawn props without moving or hiding real controls.

#### Scenario: Return near the right edge on mobile
- **WHEN** an otherwise eligible button would move a visible character outside a 360px viewport during return
- **THEN** the scene uses drawn snow and both characters remain visible

#### Scenario: Blended contacts
- **WHEN** nonnegative authored contact weights sum to at most one
- **THEN** every accepted translation and all interpolated blends keep the artwork envelope within the viewport

### Requirement: Scene eligibility precedes pair selection
Scene-specific button eligibility SHALL be applied before candidate pair ranking. Rejected candidates SHALL NOT displace eligible alternatives. Discovery limits and the behavior of scenes without a predicate SHALL remain unchanged.

#### Scenario: Wide selector beside small buttons
- **WHEN** two eligible small buttons are adjacent to an ineligible wide model selector
- **THEN** discovery chooses both small buttons rather than discarding one after pair selection

## Integration contract

Playback state and cancellation remain owned by `CelebrationProvider` in
`libs/celebrations/src/context/CelebrationContext.tsx`. Button mapping and transient
copy cleanup belong to `libs/celebrations/src/utils/button-props-adapter.ts`; hosts
supply anchors and asset loaders through the existing scene contract. No new
backend endpoint, generated-client operation, cache, telemetry or user-visible
label is introduced. Cached source assets are never mutated.

The adapter is admitted by the `interaction-button-props-v1` capability, with no
new `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES` key. Geometry preparation occurs
once per playback; there is no new memoisation requirement or per-frame React
state. Copies are inert and inaccessible to keyboard interaction; real controls
retain their accessible names and focus behavior. Physical measured positions
work in RTL without mirroring text, and reduced motion uses a static poster.
