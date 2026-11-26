## MODIFIED Requirements

### Requirement: A unit writer saves directly into a unit folder
When a save panel's committed destination is a folder inside an org unit whose owner grants `write` on the resource type's namespace, and the rights are `Ready`, Save SHALL write the resource into that folder directly and SHALL NOT create a publication request, except for an application that refers to a folder of files saved by a user who is not a DIAL admin, which takes the publication request (see `resource-save-panel`). This holds for a user who is not an admin; an admin on a folder inside a unit takes the same direct path, while for a DIAL admin plain `public/` outside units is unchanged. The panel SHALL NOT show the admin-approval banner for such a destination. Success is reported through the existing operation notifications as a save into the folder, not as "publish requested". A destination outside every unit keeps the current sequence (save in place, then a publication request). The owning unit's `read` right alone never selects the direct path.

For an application the direct path also copies its first-level private dependencies (`org-unit-application-dependencies`), which needs `write` in the same unit on the namespace of each of them. When the panel knows the dependencies (a schema-form application, from the list the panel loads), a unit folder where the user lacks `write` on the namespace of any of them SHALL be disabled with a reason that names the missing types, through the same disabled-row channel as the application's own namespace. When the panel cannot know them (an application with an embedded editor), the check runs on the server after the save, and a refusal is reported as a failure of the write into the folder with the server's reason, except the folder-reference refusal (`folderReferenceNeedsRequest`), after which the save continues with the publication request. The application's icon needs `write` on `files` but never disables a folder (see `org-unit-application-dependencies`).

A publish panel writes directly only where `A publish panel writes directly when the user may approve publications` says; otherwise it creates a request that someone with `read` and `write` on `publications` in the unit approves, for a unit as for plain `public/`.

**Known risk (Core rules the chat neither prevents nor handles).** A copy by a non-admin into a unit makes Core reset `forward_auth_token` on the copy, keep interceptors but not add new ones, and drop the admin consent of declared `resource_dependencies`; files an application's schemas point to are duplicated and need `read` on each (a folder is never copied for a non-admin, so such an application takes the publication request instead). The same rules apply to the copies of an application's dependencies. Users meet these rules with a direct write, from the Save panel and, where the user may approve publications, from the Publish panel.

The direct path honours Core's per-type limits:
- **Skills and projects.** A name equal to a unit's folder name is refused by Core with 409; the chat shows Core's refusal on the name field and has no client-side rule of its own.
- **Any type.** Moving a resource between two units, or into or out of the plain part of `public/`, is refused by Core; the panel offers a copy from the user's own bucket only. A resource shared with the user (not in the user's own bucket) cannot be the source, as in the Save panel today.
- A Core 403 or 409 on the write keeps the panel open with the existing assertive error, and nothing else is changed.

#### Scenario: Editor saves a Quick App into a unit
- **WHEN** a user with `write` on `applications` in unit `Delivery` keeps the version and saves a Quick App to `Delivery/Teams`
- **THEN** the application is written into `Delivery/Teams` and no publication request is created

#### Scenario: Reader cannot take the direct path
- **WHEN** the user holds only `read` on `applications` in `Sales`
- **THEN** `Sales` is disabled in the save panel and no write is sent

#### Scenario: Missing namespace of a known dependency
- **GIVEN** a schema-form application whose form values refer to a private toolset, and a user with `write` on `applications` but not on `toolsets` in unit `Delivery`
- **WHEN** the user opens the Save panel and browses to `Delivery/Teams`
- **THEN** the folder is disabled with a reason naming toolsets and Save is not offered for it

#### Scenario: Missing namespace found after the save
- **GIVEN** a Quick App whose saved state now refers to a private prompt, and a user without `write` on `prompts` in the unit
- **WHEN** the user saves it into the unit folder
- **THEN** the application is saved in the user's own bucket, nothing is written into the unit, and the notification names the failure with the server's reason

#### Scenario: Outside units the flow is unchanged
- **WHEN** a non-admin saves to the folder `Shared/Reports` under no unit
- **THEN** the resource is saved in place and a publication request is created, as before this change

#### Scenario: No admin-approval banner for a unit destination
- **WHEN** the committed destination is a folder inside a unit the user may write to
- **THEN** the admin-approval banner is not shown

#### Scenario: Skill named like a unit folder
- **WHEN** the user saves a skill whose name equals a unit folder name and Core answers 409
- **THEN** the panel stays open and shows the failure on the name field

#### Scenario: Publish is still a request
- **WHEN** the same user, holding `write` on `applications` but not `read` and `write` on `publications` in unit `Delivery`, opens the publish panel of that Quick App and chooses `Delivery/Teams`
- **THEN** a publication request is created, not a direct write

#### Scenario: Folder reference by a user who is not a DIAL admin
- **GIVEN** an application that refers to a folder of files and a user with `write` on `applications` in the unit who is not a DIAL admin
- **WHEN** the user saves it into a folder of the unit
- **THEN** the application is saved, a publication request is created for that folder, and no direct write is made

#### Scenario: Core refuses the write
- **WHEN** Core answers 403 to the direct write
- **THEN** the panel stays open with its controls enabled and the failure announced assertively

### Requirement: A publish panel writes directly when the user may approve publications
When the committed destination of the catalog Publish panel (application, toolset, prompt or skill) is a folder inside an org unit and the rights are `Ready`, the panel SHALL write the entity into that folder directly, and SHALL NOT create a publication request, if and only if the user is a DIAL admin or the owning unit grants all of: `write` on the entity's namespace, `read` on `publications`, and `write` on `publications`. For an application the unit SHALL also grant `write` on the namespace of each private dependency to be copied. The right to approve is what lets the direct path stand in for filing and approving one's own request, which DIAL Core allows (with the known differences below); `read` alone on `publications` never selects it, `write` on `publications` alone never selects it, and neither does `write` on the entity's namespace alone. A folder outside every unit, even for a DIAL admin, keeps the publication request. Conversations and projects keep the request. An application that refers to a folder of files takes the direct path only for a DIAL admin; any other user files a publication request, with the note `catalog.publish.directUnavailableFolder`.

For a direct destination the panel SHALL NOT show the author field or the credentials checkbox: a copy takes neither a display author nor a toolset's credentials. The author of the copy is the source's own author. The panel SHALL show one neutral line that credentials are not shared by a direct save, for a toolset that would otherwise offer them. When the user would otherwise write directly but lacks `write` on the namespace of a dependency the panel knows, the folder SHALL stay usable and the panel SHALL file a publication request as it does today, with a note naming the missing types and saying that a request is sent instead of a direct save; the server checks the namespaces again before the first copy.

**Known differences from an approved publication (Core rules the chat neither prevents nor handles; the known risk of the direct write above applies as well).** The copy keeps the source's author; a toolset is copied without credentials; a non-admin's copy drops the admin consent of declared `resource_dependencies`, which an admin can grant afterwards; the copy keeps the source application's `reference`. No publication record exists, so the item's publish history does not list the folder.

#### Scenario: Unit approver publishes directly
- **GIVEN** unit `Delivery` grants the user `write` on `applications`, and `read` and `write` on `publications`
- **WHEN** the user publishes their application to `Delivery/Teams`
- **THEN** the application is written into `Delivery/Teams`, no publication request is created, and the panel reports a save into the folder

#### Scenario: DIAL admin on a unit folder
- **WHEN** a DIAL admin publishes an application to a folder inside a unit
- **THEN** the same direct write happens, and a folder outside every unit still creates a request

#### Scenario: Only one half of the approval right
- **WHEN** the unit grants `read` but not `write` on `publications`, or `write` but not `read`
- **THEN** the panel creates a publication request

#### Scenario: Write on the entity without publications rights
- **WHEN** the unit grants `write` on `applications` and nothing on `publications`
- **THEN** the panel creates a publication request

#### Scenario: Missing namespace of a dependency
- **GIVEN** an application with a private toolset and a unit that grants `write` on `applications` and the approval right but not `write` on `toolsets`
- **WHEN** the user selects a folder of that unit in the Publish panel
- **THEN** the folder stays selectable, a note names toolsets and says a request is sent instead of a direct save, and submit files a publication request

#### Scenario: Conversation and project panels
- **WHEN** the user publishes a conversation or a project into a unit folder
- **THEN** a publication request is created as before

#### Scenario: Folder reference by a user who is not a DIAL admin
- **GIVEN** a user who holds the approval right in the unit but is not a DIAL admin, and an application that refers to a folder of files
- **WHEN** the user publishes it to a folder of the unit
- **THEN** a publication request is created and the panel shows the folder note

