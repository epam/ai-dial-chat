## MODIFIED Requirements

### Requirement: A direct write of an application copies its first-level private dependencies and its icon

When `POST /api/v1/catalog/applications/:entityId/copy-to-org-unit` (see `org-units-api`) copies an application of the caller's own bucket into an org-unit folder, the backend SHALL also copy, in the same call, the application's first-level private dependencies and its icon, and SHALL write the application so that it refers to the copies. The dependencies are the ones `publish-dependencies-api` lists for the saved application, limited as in `application-publish-dependencies`: only resources in the caller's own bucket, and no `file` dependency (Core copies and relinks the files a schema marks when it copies the application). A dependency's own references SHALL NOT be copied or rewritten; they are read only to detect a folder, as "An application that is written together with a dependency that refers to a folder is written directly only by a DIAL admin" defines.

Each dependency SHALL be written to the same per-application namespace publishing uses (`{type}/public/{folderPath}/.{applicationResourceName}.deps/{sourceBucket}/{path}`), where `{folderPath}` is the destination folder and `{applicationResourceName}` is the last segment of the application's own target. A dependency whose target already exists SHALL be reused: not copied again and not overwritten, and the application SHALL still refer to it. The user's own application SHALL NOT be modified: its references are rewritten in a temporary copy in the user's bucket, which is copied into the unit and deleted before the call returns, on success and on failure.

The request and the success response (`{ id }`, the id of the application in the public bucket) SHALL NOT change shape. An application with neither private dependencies nor an own icon SHALL produce exactly the single copy it produced before this change. Other entity types SHALL be unaffected.

#### Scenario: Application with private skills is saved into a unit folder
- **GIVEN** an application whose schema marks two private skills as `dial:resource`
- **WHEN** the owner saves it into `Delivery/Teams`, a unit folder they may write to
- **THEN** both skills are copied under `.{application}.deps` in that folder, the application is copied with references to those copies, and the response is `200` with the application's id

#### Scenario: Dependency already copied is reused
- **GIVEN** one of the dependencies already exists at its target in the folder
- **WHEN** the application is saved into that folder again under a new version
- **THEN** that dependency is not copied again and the application refers to the existing one

#### Scenario: Dependency in another user's bucket is left alone
- **GIVEN** an application refers to a private prompt in the caller's bucket and to a private prompt in a colleague's bucket
- **WHEN** it is saved into a unit folder
- **THEN** only the caller's prompt is copied and rewritten; the reference to the colleague's prompt is unchanged

#### Scenario: Application without dependencies or icon
- **WHEN** an application with no private references and no own icon is saved into a unit folder
- **THEN** one copy is made, exactly as before this change

#### Scenario: Original is untouched
- **WHEN** the write succeeds or fails
- **THEN** the user's own application is byte-identical to what it was before, and no temporary copy remains

#### Scenario: Second level is not copied
- **GIVEN** a private application the saved application uses refers to a private skill itself
- **WHEN** the saved application is written into a unit folder
- **THEN** the dependency application is copied and its skill is not

## ADDED Requirements

### Requirement: An application that is written together with a dependency that refers to a folder is written directly only by a DIAL admin

When the direct write of an application would copy a dependency of type application, and that dependency's own schema refers to a folder of files (a value that is a resource url ending with `/`), the backend SHALL write it only for a caller who is a DIAL admin, as for a folder referenced by the application itself ("An application that refers to a folder is written directly only by a DIAL admin", a requirement of `route-folder-reference-apps-to-request`, which defines who a DIAL admin is). For any other caller it SHALL answer `422` with the same code `folderReferenceNeedsRequest` and the same message as the own-folder refusal, and SHALL NOT write or copy anything, including the icon and the temporary copy. Only a dependency that would be copied is read: a dependency whose target already exists in the unit, a dependency in another user's bucket and a dependency of any other type are not. Only dependencies one level below the saved application are read, and a folder they refer to is detected, never copied. A dependency that cannot be read SHALL fail the call, answered like any other failed read of DIAL Core (`503`), never be treated as free of folders. The refusal takes precedence over the taken-target `409` and the missing-namespace `403` for such a caller, as the own-reference refusal does. The check SHALL be skipped for a DIAL admin and, leaving DIAL Core as the authority, when the caller's rights cannot be read or org units are off for the deployment. It SHALL run before the rights check of this capability. Unreadable single files and folders in the public bucket are not covered: DIAL Core still answers for them.

#### Scenario: Dependency refers to a folder, regular user
- **GIVEN** a user who is not a DIAL admin and a Quick App that uses a private application that refers to the folder `files/{bucket}/{name}__1.0.0/`
- **WHEN** they ask for the direct write into `Delivery/Teams`
- **THEN** the response is `422` with code `folderReferenceNeedsRequest` and nothing is written

#### Scenario: Dependency refers to a folder, DIAL admin
- **GIVEN** a DIAL admin and the same Quick App
- **WHEN** they ask for the direct write
- **THEN** the application and its dependency are copied as before

#### Scenario: Dependency already in the unit
- **GIVEN** the target of that dependency already exists in the unit
- **WHEN** a regular user asks for the direct write
- **THEN** the dependency is not read for folders and the write proceeds

#### Scenario: Dependency without a folder
- **WHEN** a regular user writes an application whose application dependency refers only to plain files
- **THEN** the write proceeds as before

#### Scenario: Reused dependency and a dependency with a folder
- **GIVEN** a regular user and an application with two application dependencies, one already in the unit and one that refers to a folder
- **WHEN** they ask for the direct write
- **THEN** only the second is read and the response is `422` with code `folderReferenceNeedsRequest`

#### Scenario: Dependency of another type
- **WHEN** the application's dependencies are toolsets, prompts or skills
- **THEN** no dependency is read for folders

#### Scenario: Dependency cannot be read
- **WHEN** reading a dependency to be copied fails
- **THEN** the call answers `503` and nothing is written

#### Scenario: Rights cannot be read
- **WHEN** the caller's org-unit rights cannot be read
- **THEN** the check is skipped and DIAL Core's own answers apply
