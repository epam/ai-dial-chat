## ADDED Requirements

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

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints,welcomeScreen.description` while the current schema is 1.1.0
- **THEN** environment validation fails and names `MANAGED_CONFIG_ACTIVE_KEYS` and `welcomeScreen.description`

#### Scenario: 1.1.0 keys are accepted

- **WHEN** the mode is `active` and `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints,announcement.title,announcement.description,announcement.items,ui.activeEventId,ui.celebrationsEnabledByDefault`
- **THEN** startup succeeds

#### Scenario: Active key missing from an older snapshot

- **WHEN** `announcement.title` is active, `ANNOUNCEMENT_TITLE` is not set, and the instance's fresh snapshot uses schema `1.0.0`
- **THEN** `config.announcementTitle` is `null` (the registry default) and `metadata.managed.state` is `fresh`

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
