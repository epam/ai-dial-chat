## MODIFIED Requirements

### Requirement: Managed configuration observability

The backend SHALL emit, per instance:

- the counter `dial.chat.managed_config.refresh` by `outcome` (`accepted`, `verified`, `not_published`, `denied`, `unavailable`, `rejected_<reason>`, `late_discarded`);
- the histogram `dial.chat.managed_config.refresh.duration` in seconds;
- the observable gauge `dial.chat.managed_config.snapshot.age` in seconds;
- the observable gauge `dial.chat.managed_config.state` by `state`.

Labels SHALL be limited to the configured instance identifiers and these fixed values. A state transition SHALL be logged once, with the instance, the revision identifier, and the reason. Every pod SHALL log one line at startup, in every mode, naming the mode, the instance mapping, the active keys, the refresh interval, the maximum staleness, and whether a reader key is set. Each read SHALL be logged at debug level with the instance, the read result, the refresh outcome, the active revision, and the duration. Logs and metrics SHALL NOT contain payloads, configuration values, roles, credentials, or response bodies. Liveness and readiness SHALL NOT depend on managed state.

#### Scenario: Rejection is observable without contents

- **WHEN** a candidate is rejected with `invalid_payload`
- **THEN** `refresh{instance="chat-dev",outcome="rejected_invalid_payload"}` increments and one error log names the instance, revision, and reason, without payload text

#### Scenario: Health is independent of Studio

- **WHEN** the state of every instance is `stale`
- **THEN** `GET /api/health` still reports healthy

#### Scenario: Startup line names the settings without the key

- **WHEN** a pod starts in `active` mode with `MANAGED_CONFIG_INSTANCES=ai-dial-chat=ai-dial-chat`, `MANAGED_CONFIG_ACTIVE_KEYS=onboarding.hints`, and a reader key
- **THEN** one log line names the mode, the mapping, `onboarding.hints`, the cadence, and "reader key set", and does not contain the key
