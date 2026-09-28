## MODIFIED Requirements

### Requirement: Event modules plug into one shared runtime

CelebrationProvider, exported by `@epam/ai-dial-celebrations`, SHALL own the loaded event module, current scene and previous click selection. Hosts SHALL supply the event registry as loaders keyed by event ID and SHALL pass the active event ID; in DIAL Chat the app-level `CelebrationHost` passes `config.activeEventId` only on the exact start-page route `/` once the user config is ready, so the selected compiled module loads only there. Modules SHALL declare an ID, optional icon override, decoration component, scene definitions with per-scene durations and label IDs, click scene IDs, English default labels, and optional secret trigger. Header, Navigation and Composer SHALL contain no event-specific imports or branches. Modules SHALL receive decoration callbacks instead of importing the provider. Loading errors, unknown identifiers and an absent provider SHALL leave ordinary chat usable with no celebration. Stale module completions SHALL NOT activate after the host's reset key or active event ID changes. Context values and expensive scene layouts SHALL be memoized.

#### Scenario: Register a second occasion
- **WHEN** the registry includes New Year and config.activeEventId is new-year
- **THEN** the same application integration displays the New Year module without Halloween artwork or event-specific caller changes

#### Scenario: A stale module finishes loading
- **WHEN** the selected module finishes loading after the user leaves `/` or selects another event
- **THEN** its decoration and scenes SHALL remain absent

### Requirement: New Year demonstrates reusable visual effects

The new-year module SHALL provide an existing-slot icon override, a gift trigger, decorative garland, snow, confetti and flying-sleigh scenes. The secret `happy new year` SHALL activate confetti. Bats, witches and sleighs SHALL reuse the same generic flying-character rendering and trajectory options. Its labels SHALL cover the notification title, the gift's accessible name and the snow, confetti and sleigh messages; DIAL Chat SHALL keep supplying them from newYear.toastTitle, giftLabel, snowToastMessage, confettiToastMessage and sleighToastMessage. Each effect SHALL respect reduced motion with static visible positions. Touch/Enter/Space SHALL activate the same trigger; decorative art SHALL remain aria-hidden and shall not capture clicks. Layout SHALL support 360/900 mobile and 1280/1920 desktop widths and RTL, without adding a welcome-area logo block. The theme wordmark and browser favicon SHALL be unchanged; no configured icon slot means no added slot.

#### Scenario: Reduced-motion New Year
- **WHEN** a user with reduced motion selects a New Year scene
- **THEN** its characters or particles remain static and visible until cleanup and the localized notification still announces the scene
