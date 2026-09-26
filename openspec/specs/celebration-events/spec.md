# celebration-events Specification

## Purpose

A shared start-page celebration runtime that loads one configured seasonal event, handles decorative scenes and secret phrases, and isolates their lifecycle from ordinary chat.

## Requirements

### Requirement: Event modules plug into one shared runtime

CelebrationProvider SHALL own the active event, loaded module, current scene and previous click selection. A static registry SHALL load the selected compiled module only on the exact start-page route `/`. Modules SHALL declare an ID, optional icon override, decoration component, scene definitions with per-scene durations and translated notification keys, click scene IDs, notification title, and optional secret trigger. Header, Navigation and Composer SHALL contain no event-specific imports or branches. Modules SHALL receive decoration callbacks instead of importing the provider. Loading errors, unknown identifiers and an absent provider SHALL leave ordinary chat usable with no celebration. Stale module completions SHALL NOT activate after navigation or a config change. Context values and expensive scene layouts SHALL be memoized.

#### Scenario: Register a second occasion
- **WHEN** the registry includes New Year and config.activeEventId is new-year
- **THEN** the same application integration displays the New Year module without Halloween artwork or event-specific caller changes

#### Scenario: A stale module finishes loading
- **WHEN** the selected module finishes loading after the user leaves `/` or selects another event
- **THEN** its decoration and scenes SHALL remain absent

### Requirement: Shared playback has bounded lifetime and random selection

Each activation SHALL replace the current scene. Click selection SHALL exclude the previous click scene if another valid choice exists; a one-scene pool SHALL remain usable and an empty pool SHALL be inert. The active scene SHALL unmount at its own durationMs deadline, and navigation or event changes SHALL immediately cancel it. The provider SHALL render one viewport portal with no pointer events and aria-hidden; rendering failures in decorative components SHALL be isolated from the rest of chat. No persistence, telemetry, new API request or audio SHALL be added for playback.

#### Scenario: Different durations
- **WHEN** a shorter scene replaces a longer scene
- **THEN** its own deadline determines cleanup and the former scene's timer cannot dismiss a later scene

#### Scenario: Consecutive random activations
- **WHEN** a user activates an event with multiple click scenes twice
- **THEN** the second scene differs from the first

### Requirement: Secret triggers and notification hints belong to the event

Only the loaded, selected event on `/` SHALL intercept an exact nonempty normalized secret phrase in the start-page composer. Normalization SHALL preserve Unicode letters and numbers and ignore letter case, surrounding whitespace and punctuation. Substrings SHALL NOT match. Events with no secret trigger SHALL send all text normally. Every scene notification for an event with a secret SHALL interpolate its declared hintPhrase; secret triggers SHALL reference existing scenes. Existing conversation routes SHALL continue sending normally.

#### Scenario: A non-Latin phrase
- **WHEN** the configured phrase is written using Cyrillic or Arabic letters and the user sends the same phrase with punctuation or case differences
- **THEN** matching preserves those letters and triggers the intended scene

#### Scenario: Event has no secret
- **WHEN** an event omits secretTrigger
- **THEN** no composer text is consumed and notifications receive no secret hint

### Requirement: New Year demonstrates reusable visual effects

The new-year module SHALL provide an existing-slot icon override, a gift trigger, decorative garland, snow, confetti and flying-sleigh scenes. The secret `happy new year` SHALL activate confetti. Bats, witches and sleighs SHALL reuse the same generic flying-character rendering and trajectory options. Keys SHALL include newYear.toastTitle, giftLabel, snowToastMessage, confettiToastMessage and sleighToastMessage. Each effect SHALL respect reduced motion with static visible positions. Touch/Enter/Space SHALL activate the same trigger; decorative art SHALL remain aria-hidden and shall not capture clicks. Layout SHALL support 360/900 mobile and 1280/1920 desktop widths and RTL, without adding a welcome-area logo block. The theme wordmark and browser favicon SHALL be unchanged; no configured icon slot means no added slot.

#### Scenario: Reduced-motion New Year
- **WHEN** a user with reduced motion selects a New Year scene
- **THEN** its characters or particles remain static and visible until cleanup and the localized notification still announces the scene
