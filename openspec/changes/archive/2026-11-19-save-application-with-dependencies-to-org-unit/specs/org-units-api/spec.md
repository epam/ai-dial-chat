# Spec Delta

## MODIFIED Requirements

### Requirement: An own catalog entity can be copied into an org-unit folder
`POST /api/v1/catalog/:entityType/:entityId/copy-to-org-unit` (`operationId: copyCatalogEntityToOrgUnit`, in the publish module, versioned like its siblings) SHALL copy the caller's own entity into `folderPath` of the `public` bucket under the same name, without a publication request, and answer `200` with `{ id }`, the id of the copy. The body is `{ folderPath }`: plain text, non-empty (the public root is never a target), validated like the publish `folderPath`. The endpoint SHALL be gated by `features.orgUnitsEnabled` and answer `403` while it is off, without calling DIAL Core. `entityType` SHALL be one of `application`, `toolset`, `prompt` and `skill`; any other type SHALL answer `400`. The entity SHALL lie in the caller's own bucket, checked against the bucket of the session user before any Core call, otherwise `403`. `entityId` is a bare name or a full id for applications and toolsets, and the full `{type}/{bucket}/{path}` id for prompts and skills (a bare name answers `400`). The BFF SHALL add no right or per-type rule of its own for a toolset, prompt or skill: DIAL Core's `403` (no `write`, or a Core rule) and `409` reach the caller through `mapDialHttpStatus`, and a copy that would replace an existing target SHALL answer `409`, never overwrite. After a successful copy the caches the write made stale (applications, toolsets) SHALL be cleared, and a failure of that clearing SHALL NOT fail the response.

For an application the endpoint SHALL also copy its first-level private dependencies and its icon, as `org-unit-application-dependencies` defines. It SHALL check, before the first copy, that the caller holds `write` in the folder's unit on the namespace of the application and of every dependency it is about to copy, and answer `403` naming the missing namespaces otherwise; this is the only right the BFF decides itself, and it is skipped when the caller's rights cannot be read. The request body, the operation id, the DTOs and the success response SHALL NOT change; only the documented `403` description of the operation gains the dependency case. Cache clearing after the write SHALL cover the application and every dependency of type application or toolset that was copied.

#### Scenario: Writer copies an own application into a unit folder
- **WHEN** the flag is on and a user calls the endpoint for their own application with `folderPath` `Delivery/Teams` and Core accepts the copy
- **THEN** the response is `200` with the id of the copy in the public bucket

#### Scenario: Application with private dependencies
- **WHEN** the application refers to private skills in the caller's bucket and the user may write `applications` and `skills` in the unit
- **THEN** the skills are copied with the application and the response is `200` with the application's id

#### Scenario: Missing namespace for a dependency
- **WHEN** the application refers to a private toolset and the user may not write `toolsets` in the unit
- **THEN** the response is `403` naming `toolsets` and DIAL Core is not asked to copy anything

#### Scenario: Flag off
- **WHEN** `features.orgUnitsEnabled` is off
- **THEN** the response is `403` and DIAL Core is not called

#### Scenario: Entity in another bucket
- **WHEN** `entityId` names a resource in another user's bucket
- **THEN** the response is `403` and DIAL Core is not called

#### Scenario: Same name already in the folder
- **WHEN** the folder already holds an entity with this name
- **THEN** the response is `409` and nothing is overwritten

#### Scenario: Core refuses the write
- **WHEN** DIAL Core answers the copy with `403`
- **THEN** the BFF answers `403`

#### Scenario: Type without a copy
- **WHEN** `entityType` is `project` or `model`
- **THEN** the response is `400` and DIAL Core is not called

#### Scenario: Prompt or skill given by a bare name
- **WHEN** `entityType` is `prompt` or `skill` and `entityId` is not a full resource path
- **THEN** the response is `400`
