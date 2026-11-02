## MODIFIED Requirements

### Requirement: New Year demonstrates reusable visual effects

The new-year module SHALL provide an existing-slot icon override, a gift trigger and a decorative garland. It SHALL provide these `NewYearScene` scenes:

- `penguin-star` (PenguinStar): a penguin borrows a page control and folds it into the tree's star.
- `gift-wrapping` (GiftWrapping): two elves gift-wrap the composer until the helper's pull on a loose ribbon winds it around the master instead, who hops away bound in a chest bow.
- `reindeer-takeoff` (ReindeerTakeoff): two reindeer walk along the composer rim, free a gift ribbon caught on an inert copy of a word from the editor, and take flight leaving a snow trail.
- `snowman-delivery` (SnowmanDelivery): a pompous snowman sleds on a borrowed starter card to deliver a present to a tree, loses his head in the branches on impact, recovers it and returns the card.

**Pools.**

- The gift click pool (`NEW_YEAR_CLICK_SCENES`) SHALL contain exactly penguin-star and snowman-delivery, and a gift click SHALL pick between the enabled ones at random.
- The secret pool SHALL contain gift-wrapping and reindeer-takeoff. The secret `happy new year` SHALL select enabled scenes without consecutive repeats, independently of gift clicks.

**Deadlines** SHALL be:

- `PENGUIN_STAR_MS + 2500` (22500 ms);
- `GIFT_WRAPPING_MS + 2500` (18500 ms);
- `SNOWMAN_DELIVERY_MS + 2500` (27500 ms);
- `REINDEER_TAKEOFF_MS + 2500` (25500 ms).

Snow, confetti and sleigh SHALL NOT be registered, exported as NewYearScene members or offered as stories.

The Halloween bat decorative fallback SHALL retain its generic flying-character rendering and trajectory options. Story-driven Halloween scenes such as Witches SHALL own their measured choreography.

**Labels.**

- The event's labels SHALL cover the notification title, the gift's accessible name, and the penguin-star, gift-wrapping, snowman-delivery and reindeer-takeoff messages.
- DIAL Chat SHALL keep supplying them from `newYear.toastTitle`, `giftLabel`, `penguinStarToastMessage`, `giftWrappingToastMessage`, `snowmanDeliveryToastMessage` and `newYear.reindeerTakeoffToastMessage` (`NewYearI18nKeys`).
- The English defaults for the four story scenes SHALL be:
  - penguinStarToastMessage: `Every tree deserves a star. Send "{{phrase}}" in the start-page chat for a secret surprise.`
  - giftWrappingToastMessage: `Some gifts have a mind of their own. Send "{{phrase}}" in the start-page chat for a secret surprise.`
  - snowmanDeliveryToastMessage: `Delivered in one piece, almost. Send "{{phrase}}" in the start-page chat for a secret surprise.`
  - reindeerTakeoffToastMessage: `A little attention goes a long way. Send "{{phrase}}" in the start-page chat for another secret surprise.`

**Presentation.**

- Each effect SHALL respect reduced motion with static visible positions.
- Touch, Enter and Space SHALL activate the same trigger.
- Decorative art SHALL remain aria-hidden and SHALL NOT capture clicks.
- Layout SHALL support 360/900 mobile and 1280/1920 desktop widths and RTL, without adding a welcome-area logo block.
- The theme wordmark and browser favicon SHALL be unchanged; no configured icon slot means no added slot.

#### Scenario: Gift click can select a New Year story scene

- **WHEN** a user activates the New Year gift trigger, the event is enabled and both click scenes are enabled
- **THEN** exactly one of `penguin-star` or `snowman-delivery` plays until its own deadline
- **AND** the notification shows that scene's message (`newYear.penguinStarToastMessage` or `newYear.snowmanDeliveryToastMessage`), with the secret phrase interpolated when the event's secret trigger is enabled

#### Scenario: One click scene disabled

- **WHEN** the host disables `snowman-delivery` for the New Year event
- **THEN** every gift click plays `penguin-star`, and disabling `penguin-star` instead makes every click play `snowman-delivery`

#### Scenario: Reduced-motion New Year

- **WHEN** a user with reduced motion selects a New Year scene
- **THEN** its characters remain static and visible until cleanup and the localized notification still announces the scene

#### Scenario: Secret phrase selects a secret story

- **WHEN** a user enters `happy new year` and both secret scenes are enabled
- **THEN** `gift-wrapping` or `reindeer-takeoff` plays, a repeated phrase picks the other, and the localized notification includes the secret hint

#### Scenario: Assigned scene is disabled

- **WHEN** the host disables every scene assigned to a trigger
- **THEN** that trigger does not fall back to a scene from another pool, and the secret phrase is not consumed when both GiftWrapping and ReindeerTakeoff are disabled
