## ADDED Requirements

### Requirement: The penguin turns one page element into the tree star

The system SHALL provide a finite 20-second `PenguinStar` scene. A potted fir SHALL stand near the composer before a black-and-white penguin wearing sunglasses and a Santa hat enters directly from the side. The penguin SHALL visually pull one eligible idle starter prompt, or an eligible model selector when no starter qualifies, into its flipper. The borrowed element SHALL crumple into a paper ball, transform into a star and leave the flipper in one throw that lands on the fir crown. The penguin SHALL react, bow and leave alone; the original page element SHALL return when the scene ends or is interrupted. The fir pot SHALL stay planted throughout.

#### Scenario: Starter suggestion is available

- **WHEN** the New Year gift selects PenguinStar and a visible idle starter button qualifies
- **THEN** that button visually leaves its place, reaches the penguin's flipper, becomes a paper ball and then a star, while the underlying application state is unchanged
- **AND** the star lands on the fir and the original button is restored by the end

#### Scenario: No eligible starter

- **WHEN** no starter qualifies but an idle model selector does
- **THEN** the selector supplies the visual element for the same handoff without being clicked or changing model selection
- **AND** if neither qualifies, the scene plays with decorative paper and changes no host control

### Requirement: Borrowing is bounded and reversible

The scene MUST scan at most four candidates from each host-provided anchor and select only a connected, visible, viewport-contained, reasonably sized, unfocused, enabled control with a neutral resting transform. It MUST animate at most one original control using a bounded WAAPI transform/opacity effect. It MUST NOT click, clone, reparent, detach, mutate its value, focus, selection or inline style, or change chat data. Completion and any interruption MUST cancel the owned animation so its original resting appearance returns.

#### Scenario: User interrupts the pickup

- **WHEN** the user types, focuses or clicks, scrolls, navigates, resizes, hides the tab or the target changes
- **THEN** scene playback stops promptly and the borrowed control returns to its original appearance without affecting the user's action

### Requirement: Responsive and accessible presentation

The full story SHALL run on mobile and RTL with direction-aware side entrance and nearby but separate penguin/tree positions. The welcome heading, starter prompts, composer text and controls SHALL remain readable; if the rim is crowded, the cast SHALL use a decorative snow stage. The scene layer SHALL be inert, aria-hidden and pointer-transparent. Reduced motion, unsupported required APIs and failed player loading SHALL show static penguin/tree/star art without borrowing a control.

#### Scenario: Narrow RTL start page

- **WHEN** a 360px RTL host has a crowded composer rim
- **THEN** the cast stands on the decorative stage, the eligible control may still fly to the penguin, and host text and controls remain operable

### Requirement: Resources and existing event behavior remain bounded

The scene MUST use one lazy-loaded Lottie player, at most one short WAAPI animation, at most 140 generated SVG artwork nodes, 32 animated properties, 80 keys per property and 120 KB serialized composition data. It MUST use no external asset, filter, mask, per-frame host measurement or React update. All observers, listeners, timers and animations MUST be released on stop. Existing GiftWrapping, Snow, Confetti and Sleigh scenes, `UI_EVENT` selection, translated notification, gift activation and confetti secret phrase SHALL remain available.

#### Scenario: Host disables PenguinStar

- **WHEN** the host excludes PenguinStar from the event selection
- **THEN** the gift chooses among the remaining allowed scenes and confetti secret-phrase behavior is unchanged
