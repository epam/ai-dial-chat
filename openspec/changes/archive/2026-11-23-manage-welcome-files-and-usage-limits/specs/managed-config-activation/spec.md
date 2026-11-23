## MODIFIED Requirements

### Requirement: Per-key activation

`MANAGED_CONFIG_ACTIVE_KEYS` SHALL list full registry keys, comma-separated. It SHALL be empty by default. Outside `active` mode it SHALL be ignored, with one startup warning naming the ignored keys, so that changing only the mode is a complete rollback. In `active` mode each listed key SHALL be a managed key of the current schema version (a `management` of kind `managed-config` or `managed-feature` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`). Any other key SHALL fail startup with a message naming the variable and the key. Keys that are not listed SHALL keep their environment behavior. A key of the current version SHALL be accepted even when the instance's snapshot uses an older version that lacks the key; it then supplies no value.

#### Scenario: Local-only key is refused

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=footer.html`
- **THEN** environment validation fails and names `MANAGED_CONFIG_ACTIVE_KEYS` and `footer.html`

#### Scenario: Changing only the mode rolls back

- **WHEN** a deployment running `active` with `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints` restarts with `MANAGED_CONFIG_MODE=off` and the key list unchanged
- **THEN** startup succeeds, a warning names the ignored key, and `onboarding.hints` has its environment behavior

#### Scenario: Unmapped ai-dial-chat keeps environment behavior

- **WHEN** the mode is `active`, `onboarding.hints` is listed, `ONBOARDING_HINTS` holds a tour, and only `launchpad` is mapped
- **THEN** `ai-dial-chat` gets that tour in `config.onboardingHints` with no `metadata.managed`

#### Scenario: Unlisted managed key keeps its environment value

- **WHEN** the mode is `active`, `MANAGED_CONFIG_ACTIVE_KEYS` is empty, and a fresh snapshot sets `onboarding.hints`
- **THEN** `config.onboardingHints` keeps its environment or default value

#### Scenario: Key the current schema does not manage is refused

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints,mcpApps.theme` while the current schema is 1.2.0
- **THEN** environment validation fails and names `MANAGED_CONFIG_ACTIVE_KEYS` and `mcpApps.theme`

#### Scenario: 1.1.0 keys are accepted

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints,announcement.title,announcement.description,announcement.items,ui.activeEventId,ui.celebrationsEnabledByDefault`
- **THEN** startup succeeds

#### Scenario: 1.2.0 keys are accepted

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS` lists the five 1.1.0 keys above plus `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent`, `usageLimits.spendingLimitsMode` and `features.usageLimitsControl`
- **THEN** startup succeeds

#### Scenario: Active key missing from an older snapshot

- **WHEN** `announcement.title` is active, `ANNOUNCEMENT_TITLE` is not set, and the instance's fresh snapshot uses schema `1.0.0`
- **THEN** `config.announcementTitle` is `null` (the registry default) and `metadata.managed.state` is `fresh`

### Requirement: Managed feature gates

For an active managed feature of a mapped `ai-dial-chat`, the effective value SHALL be `true` only when every condition holds:

1. The configured enabled bit, taken from the explicit environment value, otherwise the managed `enabled`, otherwise the registry default, is `true`.
2. The captured state is usable.
3. The payload contains a feature state for the key.
4. The feature's local capability is available (`isCapabilityAvailable` in `apps/chat-api/src/app-config/feature-capabilities.ts`).
5. The availability window is active at the captured instant.
6. Role targeting matches.
7. The deployment role gate of the feature, when it declares one, allows the caller.

These gates SHALL apply to every schema version that exports a managed feature. Schemas 1.0.0 and 1.1.0 export none; 1.2.0 exports `features.usageLimitsControl`, which has no local capability rule and no deployment role gate, so conditions 4 and 7 always hold for it. An explicit environment `true` SHALL NOT satisfy any condition other than the first. An explicit environment `false` SHALL make the feature `false`. A feature that is not active SHALL keep its environment behavior.

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

#### Scenario: Usage-limits control follows a published window

- **WHEN** `features.usageLimitsControl` is active, `USAGE_LIMITS_CONTROL_ENABLED` is unset, and a fresh 1.2.0 snapshot sets `{ "enabled": true, "availability": { "startsAt": "2026-12-01T00:00:00Z" } }`
- **THEN** `features.usageLimitsControl` is `false` before that instant and `true` from it, without a new publication

#### Scenario: Usage-limits control for a targeted role

- **WHEN** the snapshot sets `{ "enabled": true, "targeting": { "roles": ["beta"] } }` and the caller's verified roles are `["staff"]`
- **THEN** `features.usageLimitsControl` is `false` for that caller and `true` for a caller with `beta`

#### Scenario: Explicit environment true overrides a published off

- **WHEN** the feature is active, `USAGE_LIMITS_CONTROL_ENABLED=true` is explicit, and a fresh snapshot sets `{ "enabled": false }` with no window or targeting
- **THEN** the feature is `true`, because the explicit variable supplies the configured bit; removing the variable makes it `false`

## ADDED Requirements

### Requirement: Managed welcome text, tab list and usage limits match their environment output

For `welcomeScreen.description`, `fileManager.availableTabs`, `usageLimits.warningThresholdPercent` and `usageLimits.spendingLimitsMode`, the same raw value SHALL produce the same client-config field from an explicit environment variable and from an active key in a usable 1.2.0 snapshot. An explicit variable SHALL still win. When the state is unusable, the registry default SHALL apply.

#### Scenario: Welcome text from Config Studio

- **WHEN** `welcomeScreen.description` is active, `WELCOME_SCREEN_DESCRIPTION` is unset, and a fresh snapshot sets `  Ask me anything  `
- **THEN** `config.welcomeScreenDescription` equals what the same value in `WELCOME_SCREEN_DESCRIPTION` produces

#### Scenario: Tab list from Config Studio

- **WHEN** `fileManager.availableTabs` is active, `FILE_MANAGER_AVAILABLE_TABS` is unset, and a fresh snapshot sets `["organization", "my_files"]`
- **THEN** `config.fileManagerTabs` is `["my_files", "organization"]`, in the fixed order, as from `FILE_MANAGER_AVAILABLE_TABS=organization,my_files`

#### Scenario: Usage values from Config Studio

- **WHEN** both usage keys are active, their variables are unset, and a fresh snapshot sets threshold `90` and mode `enforce`
- **THEN** `config.usageLimitsWarningThresholdPercent` is `90` and `config.spendingLimitsMode` is `"enforce"`

#### Scenario: Explicit mode still wins

- **WHEN** `usageLimits.spendingLimitsMode` is active, `SPENDING_LIMITS_MODE=enforce` is explicit, and the snapshot sets `off`
- **THEN** `config.spendingLimitsMode` is `"enforce"`, and shadow mode would report `env_shadowed` for the key

#### Scenario: Stale snapshot drops to defaults

- **WHEN** the four keys are active, their variables are unset, and the state is `stale`
- **THEN** the fields are `null`, all four tabs, `75` and `"off"`, and `metadata.managed.state` is `stale`

#### Scenario: Activated before publication

- **WHEN** `usageLimits.spendingLimitsMode` is active, `SPENDING_LIMITS_MODE` was removed, and the fresh snapshot does not set the key
- **THEN** `config.spendingLimitsMode` is `"off"`, the registry default
