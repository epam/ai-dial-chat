## Purpose

Allow authored celebration scenes to borrow at most two small interface buttons along reversible paths synchronized with character contact.

## ADDED Requirements

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
