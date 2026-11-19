## MODIFIED Requirements

### Requirement: Per-key activation

`MANAGED_CONFIG_ACTIVE_KEYS` SHALL list full registry keys, comma-separated. It SHALL be empty by default. Outside `active` mode it SHALL be ignored, with one startup warning naming the ignored keys, so that changing only the mode is a complete rollback. In `active` mode each listed key SHALL be a managed key of the current schema version (a `management` of kind `managed-config` or `managed-feature` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`). Any other key SHALL fail startup with a message naming the variable and the key. Keys that are not listed SHALL keep their environment behavior.

#### Scenario: Local-only key is refused

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=footer.html`
- **THEN** environment validation fails and names `MANAGED_CONFIG_ACTIVE_KEYS` and `footer.html`

#### Scenario: Changing only the mode rolls back

- **WHEN** a deployment running `active` with `MANAGED_CONFIG_ACTIVE_KEYS=welcomeScreen.description` restarts with `MANAGED_CONFIG_MODE=off` and the key list unchanged
- **THEN** startup succeeds, a warning names the ignored key, and `welcomeScreen.description` has its environment behavior

#### Scenario: Unmapped chat-ui keeps environment behavior

- **WHEN** the mode is `active`, `features.usageLimitsControl` is listed, `USAGE_LIMITS_CONTROL_ENABLED=true`, and only `launchpad` is mapped
- **THEN** `ai-dial-chat` gets `features.usageLimitsControl=true` with no `metadata.managed`, and `FeatureGuard` allows it

#### Scenario: Unlisted managed key keeps its environment value

- **WHEN** the mode is `active`, only `welcomeScreen.description` is listed, and a fresh snapshot also sets `usageLimits.warningThresholdPercent` to `80`
- **THEN** `config.usageLimitsWarningThresholdPercent` keeps its environment or default value

### Requirement: Managed feature gates

For an active managed feature of a mapped `ai-dial-chat`, the effective value SHALL be `true` only when every condition holds:

1. The configured enabled bit, taken from the explicit environment value, otherwise the managed `enabled`, otherwise the registry default, is `true`.
2. The captured state is usable.
3. The payload contains a feature state for the key.
4. The feature's local capability is available (`isCapabilityAvailable` in `apps/chat-api/src/app-config/feature-capabilities.ts`).
5. The availability window is active at the captured instant.
6. Role targeting matches.
7. The deployment role gate of the feature, when it declares one, allows the caller.

An explicit environment `true` SHALL NOT satisfy any condition other than the first. An explicit environment `false` SHALL make the feature `false`. A feature that is not active SHALL keep its environment behavior.

#### Scenario: Environment false is a kill switch

- **WHEN** `features.usageLimitsControl` is active, `USAGE_LIMITS_CONTROL_ENABLED=false`, and a fresh snapshot sets `enabled: true` with no window or targeting
- **THEN** `features.usageLimitsControl` is `false`

#### Scenario: Environment true cannot bypass unusable policy

- **WHEN** the feature is active, `USAGE_LIMITS_CONTROL_ENABLED=true`, and the state is `unavailable`
- **THEN** the feature is `false`

#### Scenario: Environment true cannot bypass a window

- **WHEN** the feature is active, `USAGE_LIMITS_CONTROL_ENABLED=true`, and the fresh snapshot sets `enabled: false` with `availability.endsAt` in the past
- **THEN** the feature is `false`

#### Scenario: Feature absent from a usable snapshot

- **WHEN** the feature is active and a fresh snapshot has `"features": {}`
- **THEN** the feature is `false`

#### Scenario: Managed policy enables the feature

- **WHEN** the feature is active, its variable is unset, and a fresh snapshot sets `{ "enabled": true }`
- **THEN** the feature is `true` for every caller

### Requirement: Server guards enforce managed policy

`FeatureGuard` and every `FeatureFlagsService.isEnabled` caller SHALL evaluate active managed features with the same gates and captured-snapshot rules as `GET /api/v1/client-config`, for `appId` `ai-dial-chat`, independently of any browser flag or cached response.

#### Scenario: Guard and client config agree

- **WHEN** an active managed feature is closed for a user because of targeting
- **THEN** a handler protected by `@RequireFeature` for that feature answers `403` for that user, and `client-config` reports the feature as `false`

#### Scenario: Guard ignores a stale browser

- **WHEN** a browser still holds `features.<key>=true` from a response returned before the window ended
- **THEN** the guarded endpoint answers `403` after `endsAt`

### Requirement: Shadow comparison

In `shadow` mode, each accepted or re-verified `ai-dial-chat` snapshot SHALL be compared with the effective values computed without it:

- every managed configuration key's normalized managed value;
- every managed feature's gate result for an anonymous context.

Each comparison SHALL produce `equal`, `differs`, `env_shadowed` (an explicit environment value would win), or `absent`. Results SHALL be counted per key in `dial.chat.managed_config.shadow.comparison`, and logged once per revision without values.

#### Scenario: Environment value would shadow a managed value

- **WHEN** the mode is `shadow`, `ANNOUNCEMENT_TITLE=Local` is set, and the snapshot sets `announcement.title`
- **THEN** the comparison for `announcement.title` is `env_shadowed`

### Requirement: Foreign application payload delivery

In `active` mode, for a served application identifier other than `ai-dial-chat` that has a mapping and a usable captured snapshot, `GET /api/v1/client-config` SHALL include `appConfig` with `schemaVersion`, `schemaSha256`, `revisionId`, `publishedAt`, and the accepted `payload` unchanged. When the snapshot is not usable, `appConfig` SHALL be omitted. The typed `features` and `config` of that response SHALL keep the `ai-dial-chat` environment-driven values. `ai-dial-chat` responses SHALL never contain `appConfig`.

#### Scenario: Launchpad receives its payload

- **WHEN** `launchpad=launchpad-dev` is mapped, the mode is `active`, and `launchpad-dev` is `fresh` with payload `{"blocks":[{"id":"news"}]}`
- **THEN** `GET /api/v1/client-config?appId=launchpad` includes `appConfig.payload` equal to `{"blocks":[{"id":"news"}]}`

#### Scenario: Stale foreign payload is withheld

- **WHEN** `launchpad-dev` is `stale`
- **THEN** the response has no `appConfig`, and `metadata.managed.state` is `stale`
