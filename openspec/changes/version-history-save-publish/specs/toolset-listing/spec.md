# Spec Delta

## ADDED Requirements

### Requirement: Toolset list items expose versionGroupId

Each item of `GET /api/v1/toolsets` SHALL gain the same optional `versionGroupId?: string` that `DeploymentItemDto` exposes (see `deployments-api`): the toolset's owner bucket, folder and base name without the `__<version>` suffix, shared by every version of one toolset saved by one owner in one folder, computed by the BFF with the same function. The list response shape and every existing field SHALL be unchanged, the field SHALL be documented in the OpenAPI schema, and `libs/chat-api-client` SHALL be regenerated.

#### Scenario: Versions of one toolset share the group
- **WHEN** the list holds `toolsets/abc/Search__1.0.0` and `toolsets/abc/Search__2.0.0`
- **THEN** both items carry the same `versionGroupId`

#### Scenario: Existing consumers are unaffected
- **WHEN** a consumer reads the list without knowing `versionGroupId`
- **THEN** every field it already reads is present and unchanged
