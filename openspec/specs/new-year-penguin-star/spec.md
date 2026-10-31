# New Year Penguin Star Specification

## Purpose

Defines the interactive New Year scene where a penguin transforms a borrowed page element into a star for the tree.

## Requirements

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

The scene's resources SHALL be bounded:

- one lazy-loaded Lottie player;
- at most one short WAAPI animation;
- at most 140 generated SVG artwork nodes;
- at most 32 animated properties and 80 keys per property;
- at most 120 KB of serialized composition data.

It MUST use no external asset, filter, mask, per-frame host measurement or React update. All observers, listeners, timers and animations MUST be released on stop.

The gift click pool SHALL contain PenguinStar and SnowmanDelivery, and a gift click SHALL pick between the enabled ones at random. The `happy new year` secret phrase SHALL select enabled GiftWrapping or ReindeerTakeoff without consecutive repeats, independently of gift clicks. Existing event selection and translated notifications SHALL remain available. Snow, Confetti and Sleigh SHALL no longer be registered.

#### Scenario: Host disables PenguinStar

- **WHEN** the host excludes PenguinStar from the event selection
- **THEN** the gift plays only SnowmanDelivery when it is enabled, and nothing otherwise
- **AND** the secret phrase still selects enabled GiftWrapping or ReindeerTakeoff without consecutive repeats

### Requirement: Connected penguin acting and handoffs

The existing scene-local Lottie composition SHALL preserve the penguin's monochrome drawing while keeping its working flipper attached to the torso during every lean. The captured page control, paper ball and thrown star SHALL use the rendered flipper's grip, with <=1.5 px handoff error in LTR and RTL. The stage SHALL mirror drawing coordinates once, while host text, selection and restored appearance remain unchanged. Existing host-anchor, provider, interruption, static fallback, timing and resource contracts SHALL remain unchanged; no new state owner, API, strings, flags, telemetry or persistence SHALL be introduced.

#### Scenario: Borrowing and throwing while leaning

- **WHEN** the penguin leans into capture or winds up to throw
- **THEN** its shoulder stays attached to the same point on the torso
- **AND** the captured fragment and released star meet the actual flipper tip in both writing directions

### Requirement: Purposeful walking and continuous star flight

Entrance, approach to the fir and departure SHALL each include alternating short foot lifts coordinated with body travel. During held acting poses the feet SHALL settle. The star SHALL follow one continuous arc from release to the fir without repeated easing stops at intermediate samples. The existing story, 20-second duration, artwork and ceilings of 140 SVG descendants, 32 animated properties, 80 keys per property and 120 KB composition data SHALL remain intact.

#### Scenario: The penguin approaches after decorating the fir

- **WHEN** the penguin walks from its throwing position to the fir
- **THEN** its feet alternate rather than remain in a static pose while sliding
- **AND** both feet settle before the bow

#### Scenario: The released star reaches the crown

- **WHEN** the star leaves the flipper
- **THEN** it follows a continuous arc and joins the crown star without a visible position jump
