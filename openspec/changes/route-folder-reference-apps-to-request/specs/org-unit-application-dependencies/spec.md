## ADDED Requirements

### Requirement: An application that refers to a folder is written directly only by a DIAL admin

When `POST /api/v1/catalog/applications/:entityId/copy-to-org-unit` (see `org-units-api`) is asked to copy an application whose schema refers to a folder of files, the backend SHALL write it only for a caller who is a DIAL admin. For any other caller it SHALL answer `422` with the code `folderReferenceNeedsRequest` and a message saying the application refers to a folder and has to be published through a request, and SHALL NOT write or copy anything. A folder reference is a value the application's schema marks as a resource whose url is a folder of files (it ends with `/`) in the caller's own bucket or in another user's bucket. Folders in the public bucket and files the caller cannot read are not covered by this check: DIAL Core still answers for them. The caller is a DIAL admin when the org-units rights say so (`hasAdminAccess` of `org-units-api`), which is stricter than DIAL Core's own notion on a deployment without admin rules, so such a deployment sends a folder-reference application through the request. The check SHALL run before any copy, including the single copy of an application with no other dependency, and before the rights check of this capability. It SHALL be skipped, leaving DIAL Core as the authority, when the caller's rights cannot be read or org units are off for the deployment. Other entity types and applications without a folder reference SHALL be unaffected, and a DIAL admin SHALL get exactly what they got before this change.

#### Scenario: Regular user, folder reference
- **GIVEN** a user who is not a DIAL admin, with `write` on applications in the unit, and an application that refers to the folder `files/{bucket}/{name}__1.0.0/`
- **WHEN** they ask for the direct write into `Delivery/Teams`
- **THEN** the response is `422` with code `folderReferenceNeedsRequest` and nothing is copied

#### Scenario: DIAL admin, folder reference
- **GIVEN** a DIAL admin and the same application
- **WHEN** they ask for the direct write
- **THEN** the application is copied as before and the response is `200` with its id

#### Scenario: Regular user, no folder reference
- **GIVEN** a user who is not a DIAL admin and an application that refers only to private prompts and a plain file
- **WHEN** they ask for the direct write
- **THEN** the write proceeds as before

#### Scenario: Unit admin who is not a DIAL admin
- **GIVEN** a user with the `admin` role in the unit, who is not a DIAL admin, and an application that refers to a folder of their files
- **WHEN** they ask for the direct write into a folder of that unit
- **THEN** the response is `422` with code `folderReferenceNeedsRequest`

#### Scenario: Folder only, no other dependency
- **GIVEN** a user who is not a DIAL admin and an application whose only reference is a folder, with no private dependency and no icon
- **WHEN** they ask for the direct write
- **THEN** the response is `422` and DIAL Core is not asked to copy anything

#### Scenario: Other entity types
- **WHEN** a toolset, prompt or skill is copied into a unit folder
- **THEN** the folder-reference check does not apply

#### Scenario: Org units off
- **WHEN** `features.orgUnitsEnabled` is off
- **THEN** the endpoint answers `403` as before and the check is not reached

#### Scenario: Rights cannot be read
- **WHEN** the caller's org-unit rights cannot be read
- **THEN** the check is skipped and DIAL Core's own answers apply
