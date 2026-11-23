# Spec Delta

## Purpose

Allow authored celebration packs to carry a visual copy of the composer away and return it without changing the user's actual input.

## ADDED Requirements

### Requirement: Opt-in horizontal composer carry

The runtime SHALL support `interaction-composer-carry-v1` only with composer anchoring and direction `none`. Authored horizontal travel SHALL move one inert snapshot in sync with the characters, return it exactly to rest, and leave copied text unmirrored in RTL. The existing playback session SHALL own transient state; no persistent state or new cache is introduced.

#### Scenario: Out-and-back story
- **WHEN** an eligible composer and supported authored carry track are supplied
- **THEN** the copy follows the finite authored motion from rest to offscreen and back on the player's clock
- **AND** characters retain uniform proportions while composer decorations fit its width

### Requirement: Preserve input and cancel safely

The live input SHALL retain value, focus and selection. Typing, pointer interaction, focus change, geometry invalidation or cancellation SHALL synchronously remove the copy and restore the live element. The snapshot SHALL be inert, hidden from accessibility APIs and bounded to at most 300 cloned nodes.

#### Scenario: Interrupt a pull
- **WHEN** the user types or clicks while the copy is moving
- **THEN** the real composer is restored without losing the draft, selection or the triggering input

### Requirement: Optional measured side or corner attachment

The adapter SHALL support an optional identity null named `composer-side` directly under `composer-carry`. Its static or bounded finite ordered position keys SHALL use normalized x in[-1,1], y in[0,1] and z0. Preparation SHALL map x to measured composer half-width and y to measured height, compensating for the uniform art scale. Artwork attached to this slot SHALL retain uniform proportions. The adapter SHALL NOT change the snapshot's initial position, size or travel semantics for this slot.

#### Scenario: Side and corner binding
- **WHEN** a pack supplies the optional slot at x1/y0.5 or x-1/y1
- **THEN** its origin is mapped respectively to the actual right-edge midpoint or bottom-left corner of the composer copy
- **AND** authored attachment timing remains synchronized with carrier movement

#### Scenario: Existing carry pack
- **WHEN** a carry pack omits the optional slot
- **THEN** its existing artwork placement and snapshot behavior are unchanged

#### Scenario: Invalid optional slot
- **WHEN** the slot is duplicated, non-identity, outside its normalized bounds or has malformed position keys
- **THEN** preparation fails before hiding the live input and uses the existing fallback

### Requirement: Visible space below a side attachment

For a side slot, the source stage height minus the reference anchor's y coordinate SHALL declare the maximum artwork extent below its attachment. Preparation SHALL reserve that extent at the selected uniform scale below the lowest authored attachment, plus20CSSpx to the viewport edge. Insufficient room SHALL use the poster before hiding or copying the input. Packs without the side slot SHALL retain their existing eligibility.

#### Scenario: Bottom-docked composer
- **WHEN** a composer near the viewport bottom leaves insufficient room for the declared side-slot artwork
- **THEN** a static poster appears and no clipped character animation or composer copy starts

#### Scenario: Welcome composer with room below
- **WHEN** the measured composer leaves sufficient space for the authored side-slot extent and viewport margin
- **THEN** the accepted authored positions and movement play without additional scaling or repositioning

### Requirement: Preparation failures remain decorative

Missing or oversized targets and malformed, duplicated or missing required carry slots SHALL produce the existing poster fallback. Reduced motion SHALL use the static fallback. The adapter SHALL not modify cached source data, inspect app state or load external resources; host anchors and loader callbacks remain the only integration boundary.

#### Scenario: Unsupported composer
- **WHEN** the composer cannot be safely copied or its carry track does not return to rest
- **THEN** no live input is hidden and the finite poster fallback is shown

### Requirement: Capability compatibility boundary

The capability SHALL remain opt-in through descriptors and require no new feature flag, production label or telemetry. Existing pack selection and unsupported-capability fallback SHALL remain intact. Publication SHALL require a compatible Themes validator, and deployment SHALL require a runtime that advertises the capability; local preview success alone SHALL NOT establish deployment compatibility.

#### Scenario: Existing scene
- **WHEN** a descriptor does not require composer carry
- **THEN** its existing adapter, selection and playback behavior is preserved
