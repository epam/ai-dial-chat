## MODIFIED Requirements

### Requirement: New Year demonstrates reusable visual effects

The new-year module SHALL provide an existing-slot icon override, a gift trigger, decorative garland, and the `NewYearScene` scenes `penguin-star` (PenguinStar: a penguin borrows a page control and folds it into the tree's star), `gift-wrapping` (GiftWrapping: two elves gift-wrap the composer until the helper's pull on a loose ribbon winds it around the master instead, who hops away bound in a chest bow). The gift click pool (`NEW_YEAR_CLICK_SCENES`) SHALL contain only penguin-star; the secret pool SHALL contain only gift-wrapping. Their deadlines SHALL remain `PENGUIN_STAR_MS + 2500` (22500 ms), `GIFT_WRAPPING_MS + 2500` (18500 ms) respectively. The secret `happy new year` SHALL activate only gift-wrapping. Snow, confetti and sleigh SHALL NOT be registered, exported as NewYearScene members or offered as stories. The Halloween bat decorative fallback SHALL retain its generic flying-character rendering and trajectory options; story-driven Halloween scenes such as Witches SHALL own their measured choreography. Its labels SHALL cover the notification title, the gift's accessible name and the penguin-star and gift-wrapping messages; DIAL Chat SHALL keep supplying them from newYear.toastTitle, giftLabel, penguinStarToastMessage and giftWrappingToastMessage (`NewYearI18nKeys`). The English defaults for the two story scenes SHALL be `Every tree deserves a star. Send "{{phrase}}" in the start-page chat for a secret surprise.` (penguinStarToastMessage) and `Some gifts have a mind of their own. Send "{{phrase}}" in the start-page chat for a secret surprise.` (giftWrappingToastMessage). Each effect SHALL respect reduced motion with static visible positions. Touch/Enter/Space SHALL activate the same trigger; decorative art SHALL remain aria-hidden and shall not capture clicks. Layout SHALL support 360/900 mobile and 1280/1920 desktop widths and RTL, without adding a welcome-area logo block. The theme wordmark and browser favicon SHALL be unchanged; no configured icon slot means no added slot.

#### Scenario: Gift click can select a New Year story scene

- **WHEN** a user activates the New Year gift trigger and the event is enabled
- **THEN** only `penguin-star` plays until its own deadline and the notification shows `newYear.penguinStarToastMessage` with the secret phrase interpolated when the event's secret trigger is enabled

#### Scenario: Reduced-motion New Year

- **WHEN** a user with reduced motion selects a New Year scene
- **THEN** its characters remain static and visible until cleanup and the localized notification still announces the scene


#### Scenario: Secret phrase selects only the elves

- **WHEN** a user enters `happy new year` and GiftWrapping is enabled
- **THEN** only `gift-wrapping` plays and its localized notification includes the secret hint

#### Scenario: Assigned scene is disabled

- **WHEN** the host disables the only scene assigned to a trigger
- **THEN** that trigger does not fall back to the other story, and the secret phrase is not consumed when GiftWrapping is disabled
