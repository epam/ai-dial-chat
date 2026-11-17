## MODIFIED Requirements

### Requirement: Activation modes

`MANAGED_CONFIG_MODE` SHALL control the effect of managed snapshots:

- **`off`.** No snapshot is read. Every response, cache key, header, and browser behavior equals the behavior before this capability.
- **`shadow`.** Snapshots are read, verified, and compared. Responses, cache keys, guard decisions, and refresh hints are unchanged.
- **`active`.** Managed values and policies apply to the keys listed in `MANAGED_CONFIG_ACTIVE_KEYS`, and managed metadata, refresh hints, and foreign payloads are delivered.

A change of mode SHALL be a deployment configuration change. The backend SHALL NOT switch modes by itself in response to failures. Turning managed reading off is an explicit rollback.

**Feature flag:** The mode and key list are the controls. `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` are not involved. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Off is unchanged

- **WHEN** the mode is `off` and the existing configuration characterization tests run
- **THEN** every resolved value, response body, cache key, and warning equals the recorded result

#### Scenario: Shadow does not change responses

- **WHEN** the mode is `shadow` and a fresh snapshot sets `onboarding.hints` to a tour, while `ONBOARDING_HINTS` is unset
- **THEN** `config.onboardingHints` stays `[]`, and the response has no `metadata.managed`, `metadata.nextRefreshAt`, or `appConfig`

#### Scenario: Failure never switches the mode

- **WHEN** the mode is `active` and every refresh fails for an hour
- **THEN** the mode stays `active`, and managed state is reported as `stale`


### Requirement: Per-key activation

`MANAGED_CONFIG_ACTIVE_KEYS` SHALL list full registry keys, comma-separated. It SHALL be empty by default. Outside `active` mode it SHALL be ignored, with one startup warning naming the ignored keys, so that changing only the mode is a complete rollback. In `active` mode each listed key SHALL be a managed key of the current schema version (a `management` of kind `managed-config` or `managed-feature` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`). Any other key SHALL fail startup with a message naming the variable and the key. Keys that are not listed SHALL keep their environment behavior.

#### Scenario: Local-only key is refused

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=footer.html`
- **THEN** environment validation fails and names `MANAGED_CONFIG_ACTIVE_KEYS` and `footer.html`

#### Scenario: Changing only the mode rolls back

- **WHEN** a deployment running `active` with `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints` restarts with `MANAGED_CONFIG_MODE=off` and the key list unchanged
- **THEN** startup succeeds, a warning names the ignored key, and `onboarding.hints` has its environment behavior

#### Scenario: Unmapped chat-ui keeps environment behavior

- **WHEN** the mode is `active`, `onboarding.hints` is listed, `ONBOARDING_HINTS` holds a tour, and only `launchpad` is mapped
- **THEN** `ai-dial-chat` gets that tour in `config.onboardingHints` with no `metadata.managed`

#### Scenario: Unlisted managed key keeps its environment value

- **WHEN** the mode is `active`, `MANAGED_CONFIG_ACTIVE_KEYS` is empty, and a fresh snapshot sets `onboarding.hints`
- **THEN** `config.onboardingHints` keeps its environment or default value

#### Scenario: Key the current schema does not manage is refused

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints,welcomeScreen.description` while the current schema is 1.0.0
- **THEN** environment validation fails and names `MANAGED_CONFIG_ACTIVE_KEYS` and `welcomeScreen.description`


### Requirement: Managed value resolution

For an active configuration key, the selected value SHALL be the explicit environment value when the variable is explicitly present, otherwise the managed value from a usable captured snapshot, otherwise the registry default. The managed value SHALL pass through the same client-config normalization as an environment value. A key omitted from the payload SHALL mean that the publication supplies no value. When the captured state is not usable, the selected value SHALL be the explicit environment value or the registry default. The response SHALL report the unusable state through `metadata.managed.state`.

#### Scenario: Managed value applies

- **WHEN** `onboarding.hints` is active, `ONBOARDING_HINTS` is not explicitly set, and the fresh snapshot sets hints with targets `conversation-input`, `new-chat` and `catalog` in that order
- **THEN** `config.onboardingHints` holds those hints in the published order

#### Scenario: Explicit environment value wins

- **WHEN** the same key is active, `ONBOARDING_HINTS` holds a local tour, and the snapshot sets another
- **THEN** `config.onboardingHints` is the local tour

#### Scenario: Shared normalization

- **WHEN** `onboarding.hints` is active and the managed tour has a title with surrounding spaces, a hint without a description and a repeated id
- **THEN** `config.onboardingHints` equals what the same tour in `ONBOARDING_HINTS` produces: trimmed titles, `description: null`, and only the first hint with the repeated id

#### Scenario: Stale snapshot falls back to the declared default and reports it

- **WHEN** `onboarding.hints` is active, its variable is unset, and the state is `stale`
- **THEN** `config.onboardingHints` is `[]` and `metadata.managed.state` is `stale`


### Requirement: Managed feature gates

For an active managed feature of a mapped `ai-dial-chat`, the effective value SHALL be `true` only when every condition holds:

1. The configured enabled bit, taken from the explicit environment value, otherwise the managed `enabled`, otherwise the registry default, is `true`.
2. The captured state is usable.
3. The payload contains a feature state for the key.
4. The feature's local capability is available (`isCapabilityAvailable` in `apps/chat-api/src/app-config/feature-capabilities.ts`).
5. The availability window is active at the captured instant.
6. Role targeting matches.
7. The deployment role gate of the feature, when it declares one, allows the caller.

These gates SHALL apply to every schema version that exports a managed feature; schema 1.0.0 exports none, so in 1.0.0 no feature can be listed in `MANAGED_CONFIG_ACTIVE_KEYS`. An explicit environment `true` SHALL NOT satisfy any condition other than the first. An explicit environment `false` SHALL make the feature `false`. A feature that is not active SHALL keep its environment behavior.

#### Scenario: Environment false is a kill switch

- **WHEN** a managed feature is active, its environment variable is explicitly `false`, and a fresh snapshot sets `enabled: true` with no window or targeting
- **THEN** the feature is `false`

#### Scenario: Environment true cannot bypass unusable policy

- **WHEN** the feature is active, its environment variable is explicitly `true`, and the state is `unavailable`
- **THEN** the feature is `false`

#### Scenario: Environment true cannot bypass a window

- **WHEN** the feature is active, its environment variable is explicitly `true`, and the fresh snapshot sets `enabled: false` with `availability.endsAt` in the past
- **THEN** the feature is `false`

#### Scenario: Feature absent from a usable snapshot

- **WHEN** the feature is active and a fresh snapshot has `"features": {}`
- **THEN** the feature is `false`

#### Scenario: Managed policy enables the feature

- **WHEN** the feature is active, its variable is unset, and a fresh snapshot sets `{ "enabled": true }`
- **THEN** the feature is `true` for every caller


### Requirement: Shadow comparison

In `shadow` mode, each accepted or re-verified `ai-dial-chat` snapshot SHALL be compared with the effective values computed without it:

- every managed configuration key's normalized managed value;
- every managed feature's gate result for an anonymous context.

Each comparison SHALL produce `equal`, `differs`, `env_shadowed` (an explicit environment value would win), or `absent`. Results SHALL be counted per key in `dial.chat.managed_config.shadow.comparison`, and logged once per revision without values.

#### Scenario: Environment value would shadow a managed value

- **WHEN** the mode is `shadow`, `ONBOARDING_HINTS` holds a local tour, and the snapshot sets `onboarding.hints`
- **THEN** the comparison for `onboarding.hints` is `env_shadowed`

#### Scenario: Shadow mode compares only the managed tour

- **WHEN** the mode is `shadow` and a fresh 1.0.0 snapshot is accepted
- **THEN** exactly one comparison is produced, for `onboarding.hints`

