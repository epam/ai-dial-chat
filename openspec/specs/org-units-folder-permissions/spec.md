# org-units-folder-permissions Specification

## Purpose
What every save and publish folder tree allows inside a DIAL Core org unit, decided by the current user's rights there: unusable folders are disabled with a reason, and a user who may write into a unit saves directly, without a request. Plain `public/` outside units is unchanged.

## Requirements

### Requirement: Every folder tree applies the same unit rights
Every panel that lists public-bucket folders as a destination SHALL decide each folder with the same rule source, `useOrgUnitsContext()`, through `useOrgUnitFolderGuards`: the save panels of the Quick App, schema-form app, custom app, toolset, prompt and skill editors (`apps/chat/src/components/ResourceSavePanelContainer/ResourceSavePanelContainer.tsx`) and the publish panels of the catalog (`apps/chat/src/components/CatalogView/CatalogView.tsx`), conversations (`apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`) and projects (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`). The rule applies only while `features.orgUnitsEnabled` is on and the rights status is `Ready`; otherwise no folder is disabled and nothing else changes. Core stays the authority: a client check never replaces Core's answer, and a Core 403 keeps its existing error handling.

For a folder inside a unit, the resource type decides the Core namespace (`applications` for a Quick App and any other application, `toolsets`, `prompts`, `skills`, `projects`, `conversations`), and the owning unit is the nearest unit above the folder (see `org-units-client-state`):
- a **save** destination is usable when the owner grants `write` on that namespace;
- a **publish** destination is usable when a publication request can be sent: the owner grants `read` on that namespace.
A DIAL admin may use every folder. In the Save panel only the Organization root is judged; a Personal folder is never disabled, whatever its name. A folder outside every unit is never disabled by this change: the Organization root and plain `public/` folders keep today's save-then-request and request flows.

The File storage page and file-manager modals are not covered.

#### Scenario: Save panel disables a unit without write
- **WHEN** the flag is on, the rights are `Ready`, and the Change folder view of a Quick App save lists the unit `Sales` where the user holds only `read` on `applications`
- **THEN** the `Sales` row is disabled and cannot be selected

#### Scenario: Publish panel disables a unit without read
- **WHEN** the user opens the publish panel of a prompt and the unit `Marketing` grants no `read` on `prompts`
- **THEN** the `Marketing` row is disabled

#### Scenario: Plain public folder stays usable
- **WHEN** the tree lists `Shared/Reports`, which lies under no unit, and the user is not an admin
- **THEN** the row is enabled in the save panel and in the publish panel

#### Scenario: Same rule in every panel
- **WHEN** one user holds `write` on `applications` and `read` on `prompts` in unit `Delivery`
- **THEN** the Quick App save panel enables `Delivery`, and the prompt save panel disables it

#### Scenario: Personal folder named like a unit
- **WHEN** the Save tree's Personal root holds a folder `Acme` while the unit `Acme/` grants the user no `write`
- **THEN** the Personal folder stays enabled; only Organization-root destinations are matched against units

#### Scenario: Flag off
- **WHEN** `features.orgUnitsEnabled` is off
- **THEN** no row in any panel is disabled and no rights request is made

#### Scenario: Rights not loaded
- **WHEN** the rights read failed or is still running
- **THEN** no row is disabled

### Requirement: A disabled row explains itself and cannot be chosen
A row that the rule disables SHALL render disabled (`aria-disabled="true"`), SHALL NOT change the destination on click, Enter or Space, and SHALL stay in the keyboard order so a screen-reader user can reach it and hear the reason. Its reason SHALL be a visible tooltip on hover and focus, and also reach assistive technology through an accessible description (`aria-describedby`) so touch and keyboard users are not left without it. The reason text is typed by the resource: for a save, "You have no access to save your {type} to this folder."; for a publish, "You have no access to publish your {type} to this folder." `{type}` is the resource word ("QuickApp" for a Quick App, "application" for any other application, "toolset", "prompt", "skill", "conversation", "project"), chosen in one place, `getOrgUnitAccessReasonKey` in `apps/chat/src/utils/org-unit-access.ts`. A disabled folder SHALL still expand and collapse, and its child folders are decided by their own owner, so a child the user may use stays selectable. Search keeps showing a matching disabled row. Inline folder creation (the trailing button and the per-row "Add child" / "Add sibling" items) SHALL be offered under a disabled folder only as the folder rule allows, and never creates under a folder the user cannot use. A destination already committed in the save panel that becomes disabled after a rights refresh SHALL be shown as not allowed and SHALL disable the panel's Save until another folder is chosen.

All strings come from `*Labels` props with English defaults in the libraries and from `t()` with keys declared in an i18n key enum in `apps/chat`, one key per resource type for each of the save and publish texts. RTL: the tooltip placement and any row marker use logical properties and `start`/`end` placement. Accessibility target is WCAG 2.1 AAA: the disabled state SHALL NOT be shown by color or opacity alone, and the reason is never hover-only. Phone behaviour belongs to the folder tree component: this change passes the disabled state and the reason and follows how the file manager shows a disabled row through its `getDisabledTooltip`; it adds no phone-specific layout of its own.

#### Scenario: Click on a disabled row
- **WHEN** the user clicks a disabled row
- **THEN** the pending destination does not change and no request is sent

#### Scenario: Keyboard user hears the reason
- **WHEN** keyboard focus reaches a disabled row
- **THEN** the tooltip shows and the row's accessible description reads "You have no access to save your QuickApp to this folder."

#### Scenario: Children of a disabled folder
- **WHEN** a disabled unit folder is expanded and one child folder lies in a unit where the user holds `write`
- **THEN** that child is enabled and selectable

#### Scenario: Committed destination loses access
- **WHEN** the committed save destination becomes disabled after a refresh
- **THEN** the main view marks it as not allowed and Save is disabled

### Requirement: A unit writer saves directly into a unit folder
When a save panel's committed destination is a folder inside an org unit whose owner grants `write` on the resource type's namespace, and the rights are `Ready`, Save SHALL write the resource into that folder directly and SHALL NOT create a publication request. This holds for a user who is not an admin; an admin on a folder inside a unit takes the same direct path, while for a DIAL admin plain `public/` outside units is unchanged. The panel SHALL NOT show the access rules editor or the admin-approval banner for such a destination (Core stores no rules inside units). Success is reported through the existing operation notifications as a save into the folder, not as "publish requested". A destination outside every unit keeps the current sequence (save in place, then a publication request). The owning unit's `read` right alone never selects the direct path.

For an application the direct path also copies its first-level private dependencies (`org-unit-application-dependencies`), which needs `write` in the same unit on the namespace of each of them. When the panel knows the dependencies (a schema-form application, from the list the panel loads), a unit folder where the user lacks `write` on the namespace of any of them SHALL be disabled with a reason that names the missing types, through the same disabled-row channel as the application's own namespace. When the panel cannot know them (an application with an embedded editor), the check runs on the server after the save, and a refusal is reported as a failure of the write into the folder with the server's reason. The application's icon needs `write` on `files` but never disables a folder (see `org-unit-application-dependencies`).

Publications are unchanged everywhere: a publish panel always creates a request that someone with `read` and `write` on `publications` in the unit approves, for a unit as for plain `public/`.

**Known risk (Core rules the chat neither prevents nor handles).** A copy by a non-admin into a unit makes Core reset `forward_auth_token` on the copy, keep interceptors but not add new ones, and drop the admin consent of declared `resource_dependencies`; files an application's schemas point to are duplicated and need `read` on each (folders are not copied). The same rules apply to the copies of an application's dependencies. Users meet these rules with direct save, since the chat copies into the shared space directly only there.

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

#### Scenario: No access rules for a unit destination
- **WHEN** the committed destination is a folder inside a unit the user may write to
- **THEN** the access rules editor and the admin-approval banner are not shown

#### Scenario: Skill named like a unit folder
- **WHEN** the user saves a skill whose name equals a unit folder name and Core answers 409
- **THEN** the panel stays open and shows the failure on the name field

#### Scenario: Publish is still a request
- **WHEN** the same user opens the publish panel of that Quick App and chooses `Delivery/Teams`
- **THEN** a publication request is created, not a direct write

#### Scenario: Core refuses the write
- **WHEN** Core answers 403 to the direct write
- **THEN** the panel stays open with its controls enabled and the failure announced assertively
