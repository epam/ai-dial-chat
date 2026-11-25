## ADDED Requirements

### Requirement: Client config publishes the project context count

`GET /api/v1/client-config` SHALL return the positive integer `config.projectContextMaxFiles` from `PROJECT_CONTEXT_MAX_FILES`. The normal generated `getClientConfig` method exposes the optional field for compatibility with older servers. Chat passes the resolved count to the create and edit forms.

#### Scenario: Configured count reaches the editor

- **WHEN** chat-api starts with `PROJECT_CONTEXT_MAX_FILES=500`
- **THEN** client config reports `projectContextMaxFiles: 500`.
