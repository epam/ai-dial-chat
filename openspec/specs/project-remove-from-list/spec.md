# project-remove-from-list Specification

## Purpose
Lets a user drop a project that was shared with them from their own list, without affecting the owner or other recipients: the `ProjectView` action, the eligibility rule, the pinned-menu and view-page entry points, the confirmation, the discard call and its after-effects.

## Requirements
### Requirement: ProjectView offers "Remove from My List" when the host supplies it

`ProjectView` (`libs/projects/src/components/ProjectView/ProjectView.tsx`) SHALL accept an optional `onRemoveFromMyList?: () => void` prop (documented in `libs/projects/src/models/project-view-props.ts`) and an optional `ProjectViewLabels.removeFromMyListLabel?: string`, defaulting to the lib's English `'Remove from My List'`.

When `onRemoveFromMyList` is supplied, `ProjectView` SHALL render the action in the ⋮ `ActionMenu` (both the desktop and the mobile copy) in the position Delete takes for an owner, with `IconTrashX` from `@tabler/icons-react`, `stroke={DIAL_KIT_ICON_STROKE}` and `aria-hidden`, but WITHOUT the `danger` treatment: it removes only the caller's own access. A recipient never has `onDelete`, so the two never render together.

The lib SHALL perform no request and SHALL know nothing about sharing, ownership, sources, endpoints or the discard API; the host expresses all of that only by supplying or omitting `onRemoveFromMyList`.

#### Scenario: Callback present renders the action

- **GIVEN** `ProjectView` renders with `onRemoveFromMyList` and without `onDelete`
- **THEN** a "Remove from My List" item renders in the ⋮ menu, with no danger treatment

#### Scenario: Callback absent renders nothing

- **GIVEN** `onRemoveFromMyList` is omitted
- **THEN** no "Remove from My List" action renders

#### Scenario: Host label overrides the default

- **GIVEN** `labels.removeFromMyListLabel` is `'Retirer de ma liste'`
- **THEN** the action is named `'Retirer de ma liste'`

### Requirement: Only projects shared with the user are removable

The app SHALL treat a project as removable from the user's list when, and only when, its `source` is `ProjectSource.Shared` and `canManage` is `false`. An owned project (`canManage: true`) and a public project (source `organization`) SHALL NOT offer the action in any surface. The pinned menu SHALL read these fields from the project the Pinned section already loaded (`projectsById` in `usePinnedProjectsPanel`); the view page SHALL read them from the loaded `ProjectDetailsDto`.

#### Scenario: Shared project is removable

- **GIVEN** a project with `source: shared` and `canManage: false`
- **THEN** both surfaces offer "Remove from My List"

#### Scenario: Owned or organization project is not removable

- **GIVEN** a project with `canManage: true`, or with `source: organization`
- **THEN** neither surface offers "Remove from My List"

### Requirement: Pinned project menu offers "Remove from My List"

For a removable project, the ⋮ menu of a pinned project (`getActions` in `apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`) SHALL list "Remove from My List" after the actions the recipient already has (Unpin, and Edit when `canEdit`), using `ButtonsI18nKeys.RemoveFromMyList`, `IconTrashX` at `DIAL_ICON_SIZE.MD` with `stroke={DIAL_KIT_ICON_STROKE}`, and the non-danger `text-secondary` icon treatment. Selecting it SHALL open the confirmation through a new `PinnedProjectActionKind.RemoveFromMyList` handled in `PinnedProjectActionOverlays`; it SHALL NOT discard directly.

#### Scenario: Recipient sees the entry in the pinned menu

- **GIVEN** a pinned shared project with `canEdit: false`
- **WHEN** its ⋮ menu opens
- **THEN** the items are Unpin and Remove from My List

#### Scenario: Selecting it asks for confirmation

- **WHEN** the user selects "Remove from My List" in the pinned menu
- **THEN** the confirmation opens and no discard request has been sent

### Requirement: Project view page offers "Remove from My List"

`ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL pass `onRemoveFromMyList` to `ProjectView` for a removable project, opening the same confirmation, and SHALL omit it otherwise. The page SHALL fill `removeFromMyListLabel` from `useProjectViewLabels` with `t(ButtonsI18nKeys.RemoveFromMyList)`.

#### Scenario: Preview menu of a shared project

- **GIVEN** the user opens a shared project's view page
- **THEN** the page menu offers "Remove from My List" and no Delete

#### Scenario: Preview menu of an owned project

- **GIVEN** the user opens their own project's view page
- **THEN** the page menu offers Delete and no "Remove from My List"

### Requirement: Confirmation precedes the discard and states its consequences

Both surfaces SHALL show one shared confirmation (`ConfirmationDialog` from `@epam/ai-dial-chat-shared`, non-danger variant) titled `ButtonsI18nKeys.RemoveFromMyList`, naming the project and listing the consequences: the user loses access, other people keep theirs, a new invitation is needed to regain access. While the discard is pending the confirm button SHALL show a loading state and reject duplicate submissions. Cancel and dismiss SHALL send nothing.

#### Scenario: Cancel sends nothing

- **WHEN** the user cancels the confirmation
- **THEN** no request is sent and the project stays listed

#### Scenario: Double confirm sends one request

- **WHEN** the user activates confirm twice while the first request is pending
- **THEN** `discardSharedCatalogItem` is called once

### Requirement: Discard removes only the caller's access

On confirm the app SHALL call `discardSharedCatalogItem(project.id)` (`apps/chat/src/server-api/share.api.ts`), i.e. `POST /api/v1/share/discard` with `{ "itemId": "projects/{bucket}/{path}" }`. No new endpoint, DTO or generated-client change is required: `DiscardSharedCatalogItemDto` already accepts the `projects/` prefix, and the call is not wrapped by a `Raw` method. The owner's project and other recipients' access SHALL be unchanged.

On success the app SHALL: show a success notification naming the project; remove the project from the user's pins (`replacePinnedProjectId(project.id, null)`); refresh the Pinned section and the Projects list so the project disappears; and, when the current route shows that project (view, edit or chat), navigate to `ROUTES.Projects` with `replace: true`. A removal from the sidebar while another route is open SHALL keep that route.

On rejection the app SHALL show an error notification carrying the request's trace id and leave the project, its pin and the route untouched; the dialog SHALL close.

#### Scenario: Successful removal from the sidebar

- **WHEN** the user confirms removal of a pinned shared project from the sidebar on an unrelated route
- **THEN** `discardSharedCatalogItem` is called once with the project id, a success notification shows, the project leaves the Pinned section and the Projects list, and the route is unchanged

#### Scenario: Successful removal from the view page

- **WHEN** the user confirms removal on that project's view page
- **THEN** the same call is made, the project is unpinned, and the app navigates to the Projects list replacing the entry so Back does not reopen it

#### Scenario: Failed removal changes nothing

- **WHEN** `discardSharedCatalogItem` rejects
- **THEN** an error notification with the trace id shows, the project stays listed and pinned, and the route is unchanged

#### Scenario: Not shared with the caller

- **WHEN** the BFF answers 403 because the project is no longer shared with the caller
- **THEN** the error notification shows and the project is re-read so a stale entry can leave the list

### Requirement: Strings, direction and accessibility

The action label SHALL reuse `ButtonsI18nKeys.RemoveFromMyList`, and the confirmation, success and error copy SHALL reuse the existing entity-neutral `CatalogI18nKeys.DetailsUnshare*` strings in `apps/chat/src/constants/translation-keys.ts` rather than duplicate them; no new locale entry is added. `libs/projects` SHALL receive only the action label through `ProjectViewLabels`. `IconTrashX` is symmetric, so no RTL mirroring is needed; any new layout uses logical properties. The action is a menu item reachable by keyboard; the confirmation traps focus and returns it to the opening control (the pinned ⋮ trigger or the page menu). The feature has no flag of its own and follows the existing `projectsEnabled` flag; it adds no telemetry or cache.

#### Scenario: Keyboard flow

- **WHEN** a keyboard user opens the pinned ⋮ menu, selects the action and cancels with Escape
- **THEN** focus returns to the ⋮ trigger
