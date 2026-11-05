# Spec Delta

## ADDED Requirements

### Requirement: Application writes reject a duplicate name and version

`POST /api/v1/applications`, `PATCH /api/v1/applications/:applicationName`,
`POST /api/v1/applications/:applicationName/versions` (fork) and
`POST /api/v1/applications/:applicationName/move` SHALL apply the duplicate rule of the
`resource-name-uniqueness` capability before writing:

- **Create** compares the new application with the Agents tab of the caller's own bucket
  in the target folder (`folderPath`, default the bucket root).
- **Update** compares the application's new displayed name and version with every tab its
  `interfaces` place it in (read from the fresh deployments list entry whose id matches
  the application; absent means Agents only), only when the name or version changes,
  excluding itself. The stored identity it is compared against comes from that same entry,
  and an omitted version is defaulted as the write defaults it before comparing.
- **Fork** compares the new `version` with the application's name in the target folder.
- **Move** compares the application's identity in the target folder.

A duplicate SHALL answer `409` with `code` `name-taken-agent` or `name-taken-toolset`,
according to the conflicting entity, and write nothing. The codes are the enum defined by
`resource-name-uniqueness`. `createApplication`, `updateApplication`,
`forkApplicationVersion` and `moveApplication` keep their operation ids and DTOs; their
documented `409` responses SHALL describe both conflict shapes and the generated client
SHALL be regenerated. Frontend callers keep using the same generated methods; a Quick App
create uses the same `createApplication` call with `createOnly`. A rejected write
invalidates no cache.

Quick App commit (`POST /api/v1/applications/:applicationName/versions/commit`) writes
within an identity that fork already validated and SHALL NOT repeat the check.

#### Scenario: Second agent with the same name and version

- **WHEN** an own agent `Planner` version `1.1.1` exists in the bucket root and the caller creates an agent `Planner` version `1.1.1` with `createOnly: true`
- **THEN** the response is `409` with `code` `name-taken-agent`, and no `Planner-2__1.1.1` is created

#### Scenario: Rename frees the old name

- **WHEN** an own agent created as `Test_QuickApp` was renamed to `Test_QuickApp_new_version` and the caller creates `Test_QuickApp` version `1.0.0`
- **THEN** the create is accepted at the next free path with displayed name `Test_QuickApp` and the renamed agent is untouched

#### Scenario: Fork to an existing version

- **WHEN** the caller forks own agent `Planner` to version `1.1.1` in a folder that already has an own agent `Planner` version `1.1.1`
- **THEN** the response is `409` with `code` `name-taken-agent` and nothing is copied

#### Scenario: Dual-interface application renamed

- **WHEN** the caller renames own application `A` (interfaces `chat`, `mcp`) to `B` and an own toolset `B` with the same version exists in the same folder
- **THEN** the response is `409` with `code` `name-taken-toolset`

#### Scenario: Application absent from the list is renamed

- **WHEN** the caller renames own application `A` and the fresh deployments list has no entry with its id
- **THEN** the check compares `B` with the Agents tab only
