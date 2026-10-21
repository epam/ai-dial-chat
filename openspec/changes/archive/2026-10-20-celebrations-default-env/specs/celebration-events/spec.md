## MODIFIED Requirements

### Requirement: Event modules plug into one shared runtime

CelebrationProvider, exported by `@epam/ai-dial-celebrations`, SHALL own the loaded event module, current scene and previous click selection. Hosts SHALL supply the event registry as loaders keyed by event ID and SHALL pass the active event ID; in DIAL Chat the app-level `CelebrationHost` passes `config.activeEventId` only on the exact start-page route `/` once the user config is ready **and** the effective celebrations preference is on (`useCelebrationPreference().isEnabled` from `apps/chat/src/hooks/celebration/useCelebrationPreference.ts`: the user's stored choice, otherwise the operator default `config.celebrationsEnabledByDefault`, which is `true` unless `UI_EVENT_ENABLED_BY_DEFAULT` turns it off), so the selected compiled module loads only there. Modules SHALL declare an ID, optional icon override, decoration component, scene definitions with per-scene durations and label IDs, click scene IDs, English default labels, and optional secret trigger. Header, Navigation and Composer SHALL contain no event-specific imports or branches. Modules SHALL receive decoration callbacks instead of importing the provider. Loading errors, unknown identifiers and an absent provider SHALL leave ordinary chat usable with no celebration. Stale module completions SHALL NOT activate after the host's reset key or active event ID changes. Context values and expensive scene layouts SHALL be memoized.

#### Scenario: Register a second occasion
- **WHEN** the registry includes New Year, config.activeEventId is new-year and the effective celebrations preference is on
- **THEN** the same application integration displays the New Year module without Halloween artwork or event-specific caller changes

#### Scenario: A stale module finishes loading
- **WHEN** the selected module finishes loading after the user leaves `/` or selects another event
- **THEN** its decoration and scenes SHALL remain absent

#### Scenario: The operator default shows the event to a user who never chose
- **GIVEN** config.activeEventId is halloween, config.celebrationsEnabledByDefault is true and nothing is stored under `StorageKey.CelebrationsEnabled`
- **WHEN** the start page renders
- **THEN** `CelebrationHost` passes `halloween`

#### Scenario: The operator turned the default off and the user has not opted in
- **GIVEN** config.activeEventId is halloween, config.celebrationsEnabledByDefault is false and the user never turned celebrations on
- **WHEN** the start page renders
- **THEN** `CelebrationHost` passes `null`, and no decoration, scene, icon replacement or secret phrase is active

#### Scenario: The user turned celebrations off
- **GIVEN** config.activeEventId is halloween, config.celebrationsEnabledByDefault is true and `'false'` is stored under `StorageKey.CelebrationsEnabled`
- **WHEN** the start page renders
- **THEN** `CelebrationHost` passes `null`
