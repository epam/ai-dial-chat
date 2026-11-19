# Spec Delta

## MODIFIED Requirements

### Requirement: An own catalog entity can be copied into an org-unit folder
`POST /api/v1/catalog/:entityType/:entityId/copy-to-org-unit` (`operationId: copyCatalogEntityToOrgUnit`, in the publish module, versioned like its siblings) SHALL copy the caller's own entity into `folderPath` of the `public` bucket under the same name (or, when `asPublication` is `true`, under the name a publication of that version would use), without a publication request, and answer `200` with `{ id }`, the id of the copy. The body is `{ folderPath, asPublication?, version? }`: `folderPath` is plain text, non-empty (the public root is never a target), validated like the publish `folderPath`; `asPublication` is an optional boolean (default `false`) that marks the call as the Publish panel's direct write; `version` is optional, validated like the publish `version`, and, only with `asPublication` `true`, replaces for an application or a toolset the `__{version}` suffix of the stored name exactly as the publish endpoint derives its target (the same name is used for the application's `.{application}.deps` folder), so a check of the publish target and this copy address the same path. Without `asPublication` the stored name is kept and the request behaves as before. The endpoint SHALL be gated by `features.orgUnitsEnabled` and answer `403` while it is off, without calling DIAL Core. `entityType` SHALL be one of `application`, `toolset`, `prompt` and `skill`; any other type SHALL answer `400`. The entity SHALL lie in the caller's own bucket, checked against the bucket of the session user before any Core call, otherwise `403`. `entityId` is a bare name or a full id for applications and toolsets, and the full `{type}/{bucket}/{path}` id for prompts and skills (a bare name answers `400`). The BFF SHALL add no right or per-type rule of its own for a toolset, prompt or skill: DIAL Core's `403` (no `write`, or a Core rule) and `409` reach the caller through `mapDialHttpStatus`, and a copy that would replace an existing target SHALL answer `409`, never overwrite. After a successful copy the caches the write made stale (applications, toolsets) SHALL be cleared, and a failure of that clearing SHALL NOT fail the response.

For an application the endpoint SHALL also copy its first-level private dependencies and its icon, as `org-unit-application-dependencies` defines. It SHALL check, before the first copy, that the caller holds `write` in the folder's unit on the namespace of the application and of every dependency it is about to copy, and answer `403` naming the missing namespaces otherwise; these are the only rights the BFF decides itself, and the check is skipped when the caller's rights cannot be read. When `asPublication` is `true`, the caller SHALL also be a DIAL admin or hold both `read` and `write` on `publications` in the folder's unit (the right to approve a publication request into it); without it the answer is `403` naming `publications` and nothing is copied, for every entity type, versioned or not. A request without `asPublication` is not subject to this extra right. The check is a policy of the Publish panel's mode, decided on the server so a stale panel is refused before any copy; DIAL Core's own `write` check stays the authority. The operation id and the success response SHALL NOT change; the request DTO gains the optional `asPublication` and `version`, and the documented `403` description gains the dependency and `publications` cases. A `409` for an existing target SHALL carry the same machine-readable code as the publish endpoint's taken target, so a client recognises it with the check it already has. Cache clearing after the write SHALL cover the application and every dependency of type application or toolset that was copied.

#### Scenario: Writer copies an own application into a unit folder
- **WHEN** the flag is on and a user calls the endpoint for their own application with `folderPath` `Delivery/Teams` and Core accepts the copy
- **THEN** the response is `200` with the id of the copy in the public bucket

#### Scenario: Application with private dependencies
- **WHEN** the application refers to private skills in the caller's bucket and the user may write `applications` and `skills` in the unit
- **THEN** the skills are copied with the application and the response is `200` with the application's id

#### Scenario: Missing namespace for a dependency
- **WHEN** the application refers to a private toolset and the user may not write `toolsets` in the unit
- **THEN** the response is `403` naming `toolsets` and DIAL Core is not asked to copy anything

#### Scenario: Copy named like a publication
- **WHEN** the caller sends `asPublication` `true` and `version` `2.0` for the own application `applications/{bucket}/Helper__1.0` with `folderPath` `Delivery/Teams`
- **THEN** the copy lands at `applications/public/Delivery/Teams/Helper__2.0` and the response carries that id

#### Scenario: Publish mode without the right to approve publications
- **WHEN** the caller sends `asPublication` `true` and holds `write` on `applications` but not `read` and `write` on `publications` in the unit
- **THEN** the response is `403` naming `publications` and DIAL Core is not asked to copy anything

#### Scenario: Taken target after a racing copy
- **WHEN** another resource appears at the target between the check and the copy
- **THEN** the response is `409` with the taken-target code

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
