# Spec Delta

## MODIFIED Requirements

### Requirement: Create toolset accepts a target folder and create-only
The create toolset body SHALL accept optional `folderPath: string` (`@IsValidFilePath()`) and `createOnly: boolean` (default `false`). The storage path SHALL become `{folderPath}/{name}__{version}`, with each segment encoded. With `createOnly`, the write uses `If-None-Match: *`. Whether a toolset with the same displayed name and version already exists is decided first, by the duplicate check below, which rejects with `409` before any write. Only once that check passes, on Core's 412 precondition failure the BFF SHALL retry at the next candidate path (`{folderPath}/{name}-2__{version}`, `{name}-3__{version}`, …, up to 20 candidates in total, the same limit applications use), each attempt again with `If-None-Match: *`, keeping the displayed name the caller supplied and returning the `id` of the path actually created. The retry places a new toolset next to a toolset that still holds the path under a different displayed identity (a renamed toolset), or next to a concurrent create that raced the check. Only when every candidate is taken SHALL the BFF answer `409` `Toolset version already exists`. Without either field, behaviour is unchanged.

#### Scenario: New version is created, never overwritten
- **WHEN** a toolset is created with `{ name: "search", version: "1.1.0", createOnly: true }` and an own toolset displayed as `search` version `1.1.0` already exists in the target folder
- **THEN** the response is `409` with `code` `name-taken-toolset` and the existing toolset is unchanged

#### Scenario: Name of a renamed toolset is reused
- **WHEN** a toolset created as `old` was later renamed to `search`, and the caller creates a toolset `old` version `1.0.0` with `createOnly: true`
- **THEN** the renamed toolset is untouched and the new toolset is created at `old-2__1.0.0` with the displayed name `old`

#### Scenario: Every candidate path is taken
- **WHEN** all 20 candidate paths respond 412
- **THEN** the response is `409` `Toolset version already exists` and no cache is invalidated

## ADDED Requirements

### Requirement: Toolset writes reject a duplicate name and version

`POST /api/v1/toolsets`, `PATCH /api/v1/toolsets/:toolsetName` and
`POST /api/v1/toolsets/:toolsetName/move` SHALL apply the duplicate rule of the
`resource-name-uniqueness` capability against the Toolsets tab of the caller's own bucket
before writing: toolset resources and applications whose `interfaces` include `mcp`. A
create is compared when it is create-only. The folder compared is the target folder
(`folderPath` on create and move; the stored folder on update). On update and move the
toolset's stored identity (name, version, folder) and ownership SHALL be read from the
fresh toolsets list entry whose id matches the toolset being written, and the version
SHALL be defaulted exactly as the write defaults it (absent means the platform default)
before comparing, so an omitted version is not mistaken for a change. The comparison SHALL
run on update only when the displayed name or version changes, and on move for the target
folder, excluding the toolset being written; only after the identity is seen to change is
the deployments list read. A toolset the caller does not own, or one missing from the list,
is not compared.

A duplicate SHALL answer `409` with `code` `name-taken-toolset` or `name-taken-agent`
according to the conflicting entity, and no DIAL Core write. The error codes SHALL be a
Swagger-visible enum so the generated client exposes them. The OpenAPI operations
`createToolset`, `updateToolset` and `moveToolset` keep their operation ids and DTOs; their
`409` responses SHALL describe both conflict shapes, and the generated client SHALL be
regenerated (`npm run openapi`). Frontend callers keep using the same generated methods.

Cache: the check reads current data (see `resource-name-uniqueness`); a rejected write
invalidates nothing. A successful write keeps invalidating `toolsets:list:{userSub}` as
today.

#### Scenario: Toolset blocked by an MCP-capable agent

- **WHEN** an own agent with `interfaces` `chat` and `mcp` named `search` version `1.0.0` exists in the bucket root and the caller posts a toolset `{ "name": "search", "version": "1.0.0", "createOnly": true }`
- **THEN** the response is `409` with `code` `name-taken-agent` and no toolset is written

#### Scenario: Toolset blocked by another toolset whose path differs

- **WHEN** an own toolset created as `old` was renamed to `search`, its version is `1.0.0`, and the caller creates a toolset `search` version `1.0.0` in the same folder
- **THEN** the response is `409` with `code` `name-taken-toolset` even though no path collides

#### Scenario: Rename into an existing identity

- **WHEN** the caller updates own toolset `a` version `1.0.0` to name `b` and an own toolset `b` version `1.0.0` exists in the same folder
- **THEN** the response is `409` with `code` `name-taken-toolset`

#### Scenario: Move into a folder with the same identity

- **WHEN** the caller moves own toolset `search` version `1.0.0` into a folder that already holds an own toolset `search` version `1.0.0`
- **THEN** the response is `409` with `code` `name-taken-toolset` and the source is unchanged

#### Scenario: Description-only update

- **WHEN** the caller updates only the description of an own toolset
- **THEN** no duplicate check runs and the response is `200`

#### Scenario: Omitted version on update is not a change

- **WHEN** the caller updates own toolset `search` stored at version `1.0.0` with a body that omits `version`
- **THEN** the omitted version is treated as the default `1.0.0`, equals the stored value, and no duplicate check runs
