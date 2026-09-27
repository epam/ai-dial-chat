## MODIFIED Requirements

### Requirement: New Year demonstrates reusable visual effects

The new-year module SHALL provide an existing-slot icon override, a gift trigger, decorative garland, snow, confetti and flying-sleigh scenes. The secret `happy new year` SHALL activate confetti. The Halloween bat decorative fallback and New Year sleighs SHALL reuse the same generic flying-character rendering and trajectory options; story-driven Halloween scenes such as Witches SHALL own their measured choreography. Its labels SHALL cover the notification title, the gift's accessible name and the snow, confetti and sleigh messages; DIAL Chat SHALL keep supplying them from newYear.toastTitle, giftLabel, snowToastMessage, confettiToastMessage and sleighToastMessage. Each effect SHALL respect reduced motion with static visible positions. Touch/Enter/Space SHALL activate the same trigger; decorative art SHALL remain aria-hidden and shall not capture clicks. Layout SHALL support 360/900 mobile and 1280/1920 desktop widths and RTL, without adding a welcome-area logo block. The theme wordmark and browser favicon SHALL be unchanged; no configured icon slot means no added slot.

#### Scenario: Reduced-motion New Year

- **WHEN** a user with reduced motion selects a New Year scene
- **THEN** its characters or particles remain static and visible until cleanup and the localized notification still announces the scene
