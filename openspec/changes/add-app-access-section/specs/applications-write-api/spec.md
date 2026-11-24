# Spec Delta

## ADDED Requirements

### Requirement: Resource dependencies on create and update
`POST /api/v1/applications` and `PATCH /api/v1/applications/:applicationName` SHALL accept an optional `resourceDependencies` array of `{ linkId, target: { url }, access: ["READ"|"WRITE"], required? }` entries, validated by the DTO (non-empty `linkId`, `target.url` limited to a pattern that is a superset of what DIAL Core accepts: it starts with one of the seven resource types, has no empty segment, no whitespace, no `*`, no `.` or `..` segment, allows the `{current-user}` placeholder and percent-encoded segments, and is at most 1024 characters, so an entry already stored by an administrator can be sent back unchanged; Core remains the authority, non-empty `access` of `READ`/`WRITE`, at most 100 entries) and sent to DIAL Core as `resource_dependencies` entries with `kind` `dial.resourceLink`. Response and request DTOs SHALL carry Swagger metadata so the generated client exposes the field; the operations keep their `operationId`s and their generated SDK method names. When the field is absent on update, the service SHALL leave the stored `resource_dependencies` as read, so Core sees an unchanged list. When present, it SHALL replace the stored list; an empty array SHALL clear it. Authorization is unchanged: any user allowed to write the application; Core decides whether a change is permitted.

#### Scenario: Create with dependencies
- **WHEN** an authenticated user POSTs a valid body with one `resourceDependencies` entry targeting `files/{current-user}/` with `["READ"]`
- **THEN** DIAL Core receives that entry as `resource_dependencies` and the endpoint answers as for any successful create

#### Scenario: Update without the field keeps the stored list
- **WHEN** an authenticated user PATCHes only the description
- **THEN** the request sent to DIAL Core carries the stored list unchanged (the read-modify-write echoes it) and the stored list and its approval are kept

#### Scenario: A stored administrator entry round-trips
- **WHEN** an update carries a stored entry targeting `files/public/policies/` with `["READ"]` together with a new entry
- **THEN** the DTO accepts both and Core receives both unchanged

#### Scenario: Invalid entry
- **WHEN** an entry has an empty `access` or a `target.url` outside the allowlist pattern
- **THEN** the endpoint answers 400 and does not call DIAL Core

### Requirement: Reading the stored resource dependencies
`GET /api/v1/applications/:applicationName/resource-dependencies` SHALL return `{ resourceDependencies: [...] }` for the named application, read from DIAL Core with the caller's own token, in the same camelCase entry shape that create and update accept. The endpoint SHALL be URI-versioned, documented with `@ApiOperation` and an `@ApiResponse` per status, and exposed by the generated client as `getApplicationResourceDependencies` with a response DTO class. It SHALL NOT be cached. Authorization is the caller's own access to the application, enforced by DIAL Core; Core errors map through the existing typed status mapping (401, 403, 404, 502, 503).

#### Scenario: Stored list returned
- **WHEN** an authenticated user requests the list of an application that declares one entry
- **THEN** the response holds that entry

#### Scenario: Application without a list
- **WHEN** the application declares none
- **THEN** the response holds an empty array

#### Scenario: No access
- **WHEN** Core answers 403 or 404 for the application
- **THEN** the endpoint answers with the same typed status

### Requirement: The update body still carries the author's metadata
The update endpoint keeps requiring `name` and fully replaces the display fields it receives. A request that changes only `resourceDependencies` SHALL therefore still carry the current `name` and the current values of the other display fields; this change SHALL NOT make `name` optional.

#### Scenario: Access-only change
- **WHEN** a client PATCHes the current name, description, icon and locales together with a new `resourceDependencies`
- **THEN** the stored display fields are unchanged and only the list differs

### Requirement: Dependency change refused by DIAL Core
When DIAL Core answers 403 because user-authored resource dependencies are not allowed, the create and update endpoints SHALL answer `403 Forbidden` with `code` `applicationResourceDependenciesNotAllowed` and a fixed message that does not repeat Core's text. Any other 403 SHALL keep its existing mapping, including `applicationDependentResourceMissing`.

#### Scenario: Core refuses a user's change
- **WHEN** Core answers 403 with a body naming `allowUserAuthoredDependencies`
- **THEN** the endpoint answers 403 with `code` `applicationResourceDependenciesNotAllowed`

#### Scenario: Other 403 unchanged
- **WHEN** Core answers 403 starting with `Failed to access application resource`
- **THEN** the endpoint answers 403 with `code` `applicationDependentResourceMissing`
