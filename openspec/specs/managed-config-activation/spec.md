# managed-config-activation Specification

## Purpose
Defines how a Chat deployment moves from environment-only configuration to managed values in controlled stages. It covers how managed values and feature policies combine with environment overrides, local capabilities, availability windows, and role targeting, and how foreign application payloads are delivered.

## Requirements

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

The compared keys SHALL be every managed key of the current build, whatever version the snapshot uses. Each comparison SHALL produce `equal`, `differs`, `env_shadowed` (an explicit environment value would win), or `absent`. Results SHALL be counted per key in `dial.chat.managed_config.shadow.comparison`, and logged once per revision without values.

#### Scenario: Environment value would shadow a managed value

- **WHEN** the mode is `shadow`, `ONBOARDING_HINTS` holds a local tour, and the snapshot sets `onboarding.hints`
- **THEN** the comparison for `onboarding.hints` is `env_shadowed`

#### Scenario: Shadow mode compares only the managed tour

- **WHEN** the mode is `shadow` and a fresh 1.0.0 snapshot that sets only `onboarding.hints` is accepted on a 1.1.0 build
- **THEN** ten comparisons are produced, and only the one for `onboarding.hints` is other than `absent`; each of the nine 1.1.0 keys is `absent`

#### Scenario: Published event shadowed by the environment

- **WHEN** the mode is `shadow`, `UI_EVENT=halloween` is set, and a 1.1.0 snapshot sets `ui.activeEventId` to `new-year`
- **THEN** the comparison for `ui.activeEventId` is `env_shadowed`

#### Scenario: Malformed environment list does not shadow

- **WHEN** the mode is `shadow`, `ANNOUNCEMENTS` holds malformed JSON, and the snapshot sets `announcement.items`
- **THEN** the comparison for `announcement.items` is `differs` (or `equal` if the published list is empty), never `env_shadowed`

### Requirement: Foreign application payload delivery

In `active` mode, for a served application identifier other than `ai-dial-chat` that has a mapping and a usable captured snapshot, `GET /api/v1/client-config` SHALL include `appConfig` with `schemaVersion`, `schemaSha256`, `revisionId`, `publishedAt`, and the accepted `payload` unchanged. When the snapshot is not usable, `appConfig` SHALL be omitted. The typed `features` and `config` of that response SHALL keep the `ai-dial-chat` environment-driven values. `ai-dial-chat` responses SHALL never contain `appConfig`.

#### Scenario: Launchpad receives its payload

- **WHEN** `launchpad=launchpad-dev` is mapped, the mode is `active`, and `launchpad-dev` is `fresh` with payload `{"blocks":[{"id":"news"}]}`
- **THEN** `GET /api/v1/client-config?appId=launchpad` includes `appConfig.payload` equal to `{"blocks":[{"id":"news"}]}`

#### Scenario: Stale foreign payload is withheld

- **WHEN** `launchpad-dev` is `stale`
- **THEN** the response has no `appConfig`, and `metadata.managed.state` is `stale`

### Requirement: Celebration delivery keys activate as a group

In `active` mode, `MANAGED_CONFIG_ACTIVE_KEYS` SHALL list all four `ui.celebrationDelivery.*` keys (`mode`, `revision`, `externalScenes`, `externalEvents`) or none of them. A partial list SHALL fail startup, naming `MANAGED_CONFIG_ACTIVE_KEYS` and the missing keys. Outside `active` mode the rule SHALL NOT apply.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Partial delivery group is refused

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=ui.activeEventId,ui.celebrationDelivery.mode`
- **THEN** startup fails and the message names `MANAGED_CONFIG_ACTIVE_KEYS`, `ui.celebrationDelivery.revision`, `ui.celebrationDelivery.externalScenes` and `ui.celebrationDelivery.externalEvents`

#### Scenario: Whole group is accepted

- **WHEN** the mode is `active` and the list holds `ui.activeEventId` and the four delivery keys
- **THEN** startup succeeds and the startup line lists the five keys

#### Scenario: Partial group outside active mode

- **WHEN** the mode is `shadow` and the list holds only `ui.celebrationDelivery.mode`
- **THEN** startup succeeds with the existing warning that the list is ignored

### Requirement: Managed announcements and celebrations match their environment output

For an active 1.1.0 key whose variable is not explicitly set, the client-config field SHALL equal what the same content produces through the key's environment variable. That covers the sanitized `announcementDescription`, the normalized `announcements`, `activeEventId`, `celebrationsEnabledByDefault`, and the one `celebrationDelivery` object built from the four delivery keys.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Sanitized description

- **WHEN** `announcement.description` is active and the fresh snapshot sets `<b>Maintenance</b> tonight <script>alert(1)</script><a href="https://status.example.com" onclick="x()">status</a>`
- **THEN** `config.announcementDescription` is `<b>Maintenance</b> tonight <a href="https://status.example.com" target="_blank" rel="noopener noreferrer">status</a>`, exactly the value the same text in `ANNOUNCEMENT_DESCRIPTION` produces

#### Scenario: Title is never markup

- **WHEN** `announcement.title` is active and the snapshot sets `<b>New</b> release`
- **THEN** `config.announcementTitle` is the literal text `<b>New</b> release`

#### Scenario: Normalized announcement list

- **WHEN** `announcement.items` is active and the snapshot sets two items: one with a padded title and no severity, one with a link whose `href` passes the schema pattern but is not a parseable URL (`https://[`)
- **THEN** `config.announcements` holds only the first item, with a trimmed title, `severity` `info`, `description` `null` and `link` `null`, and a warning is logged for the dropped item, exactly as from `ANNOUNCEMENTS`

#### Scenario: Delivery object from managed values

- **WHEN** the delivery group is active and the snapshot sets `mode` `prefer-external`, `revision` `2026-12-01.1`, `externalScenes` `["new-year/snowman-delivery"]` and `externalEvents` `["company-anniversary"]`
- **THEN** `config.celebrationDelivery` is `{ "mode": "prefer-external", "revision": "2026-12-01.1", "externalScenes": [{ "eventId": "new-year", "sceneId": "snowman-delivery" }], "externalEvents": ["company-anniversary"] }`

#### Scenario: Season switch without a redeploy

- **WHEN** `ui.activeEventId` is active, `UI_EVENT` is not set, the snapshot with `halloween` is replaced by a newly published revision with `new-year`, and the next refresh accepts it
- **THEN** the next `GET /api/v1/client-config` returns `config.activeEventId` `new-year`, and `metadata.managed.revisionId` names the new revision

#### Scenario: Explicit environment still wins

- **WHEN** `ui.activeEventId` is active, `UI_EVENT=halloween` is set, and the snapshot sets `new-year`
- **THEN** `config.activeEventId` is `halloween`

#### Scenario: Environment kill switch for external packs

- **WHEN** the delivery group is active, `UI_EVENT_DELIVERY_MODE=bundled` is set explicitly, and the snapshot sets `prefer-external`
- **THEN** `config.celebrationDelivery.mode` is `bundled`

### Requirement: Unusable managed state falls back to environment and defaults

For an active 1.1.0 key, a `degraded` state SHALL keep serving the last accepted snapshot. A `stale`, `unavailable` or `not_published` state SHALL serve the explicit environment value, or the registry default when no variable is set. In every case `metadata.managed.state` SHALL report the state. A managed failure SHALL never change `MANAGED_CONFIG_MODE` or the active key list.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Degraded keeps the last publication

- **WHEN** the banner title was accepted from revision `R1` and the next read fails with a timeout
- **THEN** `config.announcementTitle` is still `R1`'s title and `metadata.managed.state` is `degraded`

#### Scenario: Unpublished instance

- **WHEN** `announcement.items` and `ui.activeEventId` are active, `ANNOUNCEMENTS` is not set, `UI_EVENT=halloween` is set, and the instance answers `not_published`
- **THEN** `config.announcements` is `[]`, `config.activeEventId` is `halloween`, and `metadata.managed.state` is `not_published`

#### Scenario: Stale snapshot

- **WHEN** the delivery group is active, no delivery variable is set, and the snapshot is older than the maximum staleness
- **THEN** `config.celebrationDelivery` is the registry default (`bundled`, revision `"0"`, empty lists) and `metadata.managed.state` is `stale`

### Requirement: Rollback by publishing an earlier revision

Publishing an earlier revision's payload again (Studio's rollback) SHALL be an ordinary new revision for Chat: it SHALL be accepted under its schema version and replace the active snapshot on the next successful read. No Chat restart and no ENV change SHALL be needed.

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Rolling back an announcement

- **WHEN** revision `R2` replaced `R1`'s announcements, and an editor rolls back to `R1`, which publishes `R3` with `R1`'s payload
- **THEN** after the next accepted read `config.announcements` equals what `R1` produced and `metadata.managed.revisionId` is `R3`

#### Scenario: Rolling back to a 1.0.0 revision

- **WHEN** the rollback target was published under schema `1.0.0` and is republished against `1.0.0`
- **THEN** the new revision is accepted against `ai-dial-chat-1.0.0.json`, and the 1.1.0 keys resolve from explicit ENV or their registry defaults

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
