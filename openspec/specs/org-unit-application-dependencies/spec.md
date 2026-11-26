# org-unit-application-dependencies Specification

## Purpose
Saving an application into an org-unit folder by a direct write also brings the private resources it refers to and its own icon into that folder, so the shared copy works for the unit's members instead of pointing at the author's private files and resources.

## Requirements

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

### Requirement: Write access to every needed namespace is checked before the first copy

Before it copies anything, the backend SHALL check that the caller holds `write` in the destination folder's org unit on the namespace of the application and on the namespace of every dependency it is about to copy (`applications`, `toolsets`, `prompts`, `skills`; a reused dependency needs none). If any is missing it SHALL answer `403` with a message that names the missing namespaces, and SHALL NOT write anything. The check SHALL use the same unit rights the Save panel uses (`org-units-api`, `org-units-folder-permissions`). It SHALL be skipped, leaving DIAL Core as the authority, when the caller's rights cannot be read or org units are off for the deployment.

The Save panel's hint before the save is broader than this check: it judges every dependency the dependencies endpoint lists (the caller's own and files), including one whose copy already exists in the unit and so would be reused, which the server needs no right for. A folder can therefore be disabled in the panel for a namespace the server would not need; the server's check after the save remains the authority.

#### Scenario: No write on the dependency's namespace
- **GIVEN** the user may write `applications` in unit `Delivery` but not `toolsets`, and the saved application refers to a private toolset
- **WHEN** the application is saved into `Delivery/Teams`
- **THEN** the response is `403` naming `toolsets` and nothing is copied

#### Scenario: Rights cannot be read
- **WHEN** the org-unit rights cannot be read
- **THEN** the check is skipped and DIAL Core's own answers apply

#### Scenario: Core still refuses
- **WHEN** the check passes and DIAL Core answers `403` to a copy
- **THEN** the response is `403`, copies made before it stay, and the temporary copy is deleted

### Requirement: The icon is copied when the user may write files, and never blocks the write

When the application's `iconUrl` is an uploaded file in the caller's own bucket, the backend SHALL copy it to `files/public/{folderPath}/{applicationResourceName}/{icon file name}` and SHALL write the application with `iconUrl` pointing at that copy, provided the caller holds `write` on `files` in the destination folder's unit. Without that right, or when copying the icon fails, the application SHALL still be written, with its icon reference removed from the shared copy (the member sees the default icon); the user's own application keeps its icon. An `iconUrl` that is a theme icon name, an absolute URL, or a file outside the caller's bucket SHALL be left as it is. When copying the icon conflicts with a file already at the target, that file SHALL be reused only if it is present there; otherwise the icon SHALL be dropped as for any failed copy. A retry whose icon has the same file name as an earlier copy keeps the earlier file.

#### Scenario: Icon copied with write on files
- **GIVEN** an application with an uploaded icon and `write` on `files` in the unit
- **WHEN** it is saved into a unit folder
- **THEN** the icon file is copied into the folder's namespace and the shared copy's `iconUrl` points at it

#### Scenario: No write on files
- **GIVEN** an application with an uploaded icon and no `write` on `files` in the unit
- **WHEN** it is saved into a unit folder
- **THEN** the application is written without an icon reference, the original keeps its icon, and the response is `200`

#### Scenario: Theme icon
- **WHEN** the application's icon is a theme icon name
- **THEN** it is copied unchanged and no file is copied

### Requirement: A failure stops the write and a retry completes it

If planning, copying a dependency, copying the icon (other than as described above) or copying the application fails, the backend SHALL answer with the failure and SHALL NOT report success. It SHALL NOT fall back to copying the application alone. It SHALL NOT delete the copies already made: dependencies already written remain under their namespace, so that saving again reuses them and completes the write. Core's `409` for an application target that already exists SHALL be returned as it is.

#### Scenario: A dependency copy fails
- **WHEN** copying the second of two dependencies is refused by DIAL Core
- **THEN** the response carries Core's mapped error, the first dependency stays, no application copy is written, and the temporary copy is deleted

#### Scenario: Retry after a partial failure
- **GIVEN** a previous attempt left one dependency copied
- **WHEN** the user saves again
- **THEN** that dependency is reused, the rest are copied, and the application is written

#### Scenario: Application target already exists
- **WHEN** the folder already holds the application under the same name
- **THEN** the response is `409` and nothing is overwritten

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
