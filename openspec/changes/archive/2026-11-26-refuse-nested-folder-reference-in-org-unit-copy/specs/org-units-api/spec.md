## MODIFIED Requirements

### Requirement: An own catalog entity can be copied into an org-unit folder
`POST /api/v1/catalog/:entityType/:entityId/copy-to-org-unit` (`operationId: copyCatalogEntityToOrgUnit`, in the publish module, versioned like its siblings) SHALL copy the caller's own entity into `folderPath` of the `public` bucket under the same name (or, when `version` is given, under the name a publication of that version would use), without a publication request, and answer `200` with `{ id }`, the id of the copy. The body is `{ folderPath, version? }`: `folderPath` is plain text, non-empty (the public root is never a target), validated like the publish `folderPath`; `version` is optional, validated like the publish `version`, and replaces for an application or a toolset the `__{version}` suffix of the stored name exactly as the publish endpoint derives its target (the same name is used for the application's `.{application}.deps` folder), so a check of the publish target and this copy address the same path. Without `version` the stored name is kept and the request behaves as before (the Save panel sends none). The endpoint SHALL be gated by `features.orgUnitsEnabled` and answer `403` while it is off, without calling DIAL Core. `entityType` SHALL be one of `application`, `toolset`, `prompt` and `skill`; any other type SHALL answer `400`. The entity SHALL lie in the caller's own bucket, checked against the bucket of the session user before any Core call, otherwise `403`. `entityId` is a bare name or a full id for applications and toolsets, and the full `{type}/{bucket}/{path}` id for prompts and skills (a bare name answers `400`). The BFF SHALL add no right or per-type rule of its own for a toolset, prompt or skill: DIAL Core's `403` (no `write`, or a Core rule) and `409` reach the caller through `mapDialHttpStatus`, and a copy that would replace an existing target SHALL answer `409`, never overwrite. After a successful copy the caches the write made stale (applications, toolsets) SHALL be cleared, and a failure of that clearing SHALL NOT fail the response.

For an application the endpoint SHALL also copy its first-level private dependencies and its icon, as `org-unit-application-dependencies` defines. It SHALL refuse, before any copy, an application that refers to a folder of files, or that uses a dependency to be copied that refers to one, when the caller is not a DIAL admin, with `422` and the machine-readable code `folderReferenceNeedsRequest`, as `org-unit-application-dependencies` defines. It SHALL check, before the first copy, that the caller holds `write` in the folder's unit on the namespace of the application and of every dependency it is about to copy, and answer `403` naming the missing namespaces otherwise; these and the folder-reference refusal are the only rules the BFF decides itself, and both checks are skipped when the caller's rights cannot be read. The operation id and the success response SHALL NOT change; the request DTO gains the optional `version`, the documented `403` description gains the dependency case, and the documented responses gain the `422` with its code. The `publications` right is not checked here: it only decides which mode the Publish panel offers, and DIAL Core does not enforce it on a copy. A `409` for an existing target SHALL carry the machine-readable code of the publish endpoint's taken target (`TargetExists`) when the BFF itself found the target (its check before the first copy) or when a read of the target after a `409` from DIAL Core confirms it exists; any other `409` from Core, for example a skill or project named like a unit folder, keeps no code. The code is added for every caller; status and message do not change. Cache clearing after the write SHALL cover the application and every dependency of type application or toolset that was copied.

#### Scenario: Writer copies an own application into a unit folder
- **WHEN** the flag is on and a user calls the endpoint for their own application with `folderPath` `Delivery/Teams` and Core accepts the copy
- **THEN** the response is `200` with the id of the copy in the public bucket

#### Scenario: Application with private dependencies
- **WHEN** the application refers to private skills in the caller's bucket and the user may write `applications` and `skills` in the unit
- **THEN** the skills are copied with the application and the response is `200` with the application's id

#### Scenario: Missing namespace for a dependency
- **WHEN** the application refers to a private toolset and the user may not write `toolsets` in the unit
- **THEN** the response is `403` naming `toolsets` and DIAL Core is not asked to copy anything

#### Scenario: Folder reference, caller not a DIAL admin
- **WHEN** the application refers to a folder of files and the caller is not a DIAL admin
- **THEN** the response is `422` with code `folderReferenceNeedsRequest` and DIAL Core is not asked to copy anything

#### Scenario: Folder reference in a dependency, caller not a DIAL admin
- **WHEN** an application dependency that would be copied refers to a folder of files and the caller is not a DIAL admin
- **THEN** the response is `422` with code `folderReferenceNeedsRequest` and nothing is written

#### Scenario: Copy named like a publication
- **WHEN** the caller sends `version` `2.0` for the own application `applications/{bucket}/Helper__1.0` with `folderPath` `Delivery/Teams`
- **THEN** the copy lands at `applications/public/Delivery/Teams/Helper__2.0` and the response carries that id

#### Scenario: Version on a name without a version suffix
- **WHEN** the caller sends `version` `2.0` for a prompt or for an application whose stored name has no `__` suffix
- **THEN** the copy keeps the stored name, as a publication would

#### Scenario: Taken target after a racing copy
- **WHEN** another resource appears at the target between the check and the copy, and a read of the target confirms it
- **THEN** the response is `409` with the taken-target code

#### Scenario: Core conflict that is not a taken target
- **WHEN** DIAL Core answers `409` for a skill named like a unit folder and the target does not exist
- **THEN** the response is `409` without the taken-target code

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
