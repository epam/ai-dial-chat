## Purpose

Defines how a Chat deployment moves from environment-only configuration to managed values in controlled stages. It covers how managed values and feature policies combine with environment overrides, local capabilities, availability windows, and role targeting, and how foreign application payloads are delivered.

## ADDED Requirements

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

- **WHEN** the mode is `shadow` and a fresh snapshot sets `welcomeScreen.description` to `Hello`, while `WELCOME_SCREEN_DESCRIPTION` is unset
- **THEN** `config.welcomeScreenDescription` stays `null`, and the response has no `metadata.managed`, `metadata.nextRefreshAt`, or `appConfig`

#### Scenario: Failure never switches the mode

- **WHEN** the mode is `active` and every refresh fails for an hour
- **THEN** the mode stays `active`, and managed state is reported as `stale`

### Requirement: Per-key activation

`MANAGED_CONFIG_ACTIVE_KEYS` SHALL list full registry keys, comma-separated. It SHALL be empty by default and SHALL be accepted only when the mode is `active`. Each listed key SHALL be a managed key of the current schema version (a `management` of kind `managed-config` or `managed-feature` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`). Any other key SHALL fail startup with a message naming the variable and the key. Keys that are not listed SHALL keep their environment behavior.

#### Scenario: Local-only key is refused

- **WHEN** `MANAGED_CONFIG_ACTIVE_KEYS=footer.html`
- **THEN** environment validation fails and names `MANAGED_CONFIG_ACTIVE_KEYS` and `footer.html`

#### Scenario: Unlisted managed key keeps its environment value

- **WHEN** the mode is `active`, only `welcomeScreen.description` is listed, and a fresh snapshot also sets `usageLimits.warningThresholdPercent` to `80`
- **THEN** `config.usageLimitsWarningThresholdPercent` keeps its environment or default value

### Requirement: Managed value resolution

For an active configuration key, the selected value SHALL be the explicit environment value when the variable is explicitly present, otherwise the managed value from a usable captured snapshot, otherwise the registry default. The managed value SHALL pass through the same client-config normalization as an environment value. A key omitted from the payload SHALL mean that the publication supplies no value. When the captured state is not usable, the selected value SHALL be the explicit environment value or the registry default. The response SHALL report the unusable state through `metadata.managed.state`.

#### Scenario: Managed value applies

- **WHEN** `welcomeScreen.description` is active, `WELCOME_SCREEN_DESCRIPTION` is not explicitly set, and the fresh snapshot sets it to `Welcome`
- **THEN** `config.welcomeScreenDescription` is `Welcome`

#### Scenario: Explicit environment value wins

- **WHEN** the same key is active, `WELCOME_SCREEN_DESCRIPTION=Local` is set, and the snapshot sets `Welcome`
- **THEN** `config.welcomeScreenDescription` is `Local`

#### Scenario: Shared normalization

- **WHEN** `announcement.description` is active and the managed value contains `<script>alert(1)</script><b>x</b>`
- **THEN** `config.announcementDescription` is the same sanitized markup an environment value would produce

#### Scenario: Stale snapshot falls back to the declared default and reports it

- **WHEN** `usageLimits.warningThresholdPercent` is active, its variable is unset, and the state is `stale`
- **THEN** `config.usageLimitsWarningThresholdPercent` is `75` and `metadata.managed.state` is `stale`

### Requirement: Managed feature gates

For an active managed feature, the effective value SHALL be `true` only when every condition holds:

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

### Requirement: Availability window evaluation

A feature state without `availability` SHALL have no time restriction. With `availability`, the window SHALL be active when `startsAt` is absent or the instant is at or after `startsAt`, and when `endsAt` is absent or the instant is before `endsAt`. Timestamps are UTC instants. The schema accepts no offsets, and acceptance rejects impossible dates and inverted windows. The window SHALL be evaluated at every capture, including on an unchanged snapshot and on a `degraded` snapshot. The response cache SHALL NOT serve a result past the next boundary.

#### Scenario: Inclusive start

- **WHEN** `startsAt` is `2026-12-01T00:00:00Z` and the captured instant is `2026-12-01T00:00:00.000Z`
- **THEN** the window is active

#### Scenario: Exclusive end

- **WHEN** `endsAt` is `2026-12-01T00:00:00Z` and the captured instant is `2026-12-01T00:00:00.000Z`
- **THEN** the window is inactive

#### Scenario: Window opens on an unchanged snapshot

- **WHEN** a fresh snapshot sets `startsAt` 30 s in the future and no new revision is published
- **THEN** a capture 31 s later reports the feature as `true` without a new publication

#### Scenario: Window ends while degraded

- **WHEN** the snapshot is `degraded` because Core is down and its `endsAt` passes
- **THEN** the feature becomes `false` at `endsAt`

#### Scenario: Rolled-back window stays ended

- **WHEN** Studio publishes a rollback whose payload restores a feature state with an `endsAt` already in the past
- **THEN** the new revision is accepted and the feature is `false`

### Requirement: Role targeting

A feature state without `targeting` SHALL have no role restriction. With `targeting.roles`, the caller SHALL match when at least one of the caller's verified session roles, read through the provider's `rolesClaim` by `apps/chat-api/src/auth/user-roles.service.ts`, is in the list. A caller without a session SHALL never match a role list. An empty role list cannot reach evaluation, because schema validation rejects it. Targeting SHALL be evaluated together with, not instead of, the feature's deployment role gate.

#### Scenario: Targeted user

- **WHEN** a fresh snapshot sets `{ "enabled": true, "targeting": { "roles": ["beta"] } }` and the caller's verified roles are `["beta","staff"]`
- **THEN** the feature is `true`

#### Scenario: Anonymous caller

- **WHEN** the same snapshot applies and the request has no session
- **THEN** the feature is `false`

#### Scenario: Unverified role claim is ignored

- **WHEN** a request carries a header or query value naming the role `beta` and the session's verified roles do not include it
- **THEN** the feature is `false`

### Requirement: Server guards enforce managed policy

`FeatureGuard` and every `FeatureFlagsService.isEnabled` caller SHALL evaluate active managed features with the same gates and captured-snapshot rules as `GET /api/v1/client-config`, for `appId` `chat-ui`, independently of any browser flag or cached response.

#### Scenario: Guard and client config agree

- **WHEN** an active managed feature is closed for a user because of targeting
- **THEN** a handler protected by `@RequireFeature` for that feature answers `403` for that user, and `client-config` reports the feature as `false`

#### Scenario: Guard ignores a stale browser

- **WHEN** a browser still holds `features.<key>=true` from a response returned before the window ended
- **THEN** the guarded endpoint answers `403` after `endsAt`

### Requirement: Shadow comparison

In `shadow` mode, each accepted or re-verified `chat-ui` snapshot SHALL be compared with the effective values computed without it:

- every managed configuration key's normalized managed value;
- every managed feature's gate result for an anonymous context.

Each comparison SHALL produce `equal`, `differs`, `env_shadowed` (an explicit environment value would win), or `absent`. Results SHALL be counted per key in `dial.chat.managed_config.shadow.comparison`, and logged once per revision without values.

#### Scenario: Environment value would shadow a managed value

- **WHEN** the mode is `shadow`, `ANNOUNCEMENT_TITLE=Local` is set, and the snapshot sets `announcement.title`
- **THEN** the comparison for `announcement.title` is `env_shadowed`

### Requirement: Foreign application payload delivery

In `active` mode, for a served application identifier other than `chat-ui` that has a mapping and a usable captured snapshot, `GET /api/v1/client-config` SHALL include `appConfig` with `schemaVersion`, `schemaSha256`, `revisionId`, `publishedAt`, and the accepted `payload` unchanged. When the snapshot is not usable, `appConfig` SHALL be omitted. The typed `features` and `config` of that response SHALL keep the `chat-ui` environment-driven values. `chat-ui` responses SHALL never contain `appConfig`.

#### Scenario: Launchpad receives its payload

- **WHEN** `launchpad=launchpad-dev` is mapped, the mode is `active`, and `launchpad-dev` is `fresh` with payload `{"blocks":[{"id":"news"}]}`
- **THEN** `GET /api/v1/client-config?appId=launchpad` includes `appConfig.payload` equal to `{"blocks":[{"id":"news"}]}`

#### Scenario: Stale foreign payload is withheld

- **WHEN** `launchpad-dev` is `stale`
- **THEN** the response has no `appConfig`, and `metadata.managed.state` is `stale`
