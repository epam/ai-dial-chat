# project-remove-from-list Specification

## Purpose
Lets a user drop a project that was shared with them from their own list, without affecting the owner or other recipients: the `ProjectView` action, the eligibility rule, the pinned-menu and view-page entry points, the confirmation, the discard call and its after-effects. Also defines the owner-only revoke-access action, which removes recipients' access while preserving the owner's project.

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

`isProjectSharedWithMe` in `libs/chat-hooks/src/project/project-sharing.ts` (exported from `@epam/ai-dial-chat-hooks/project`) SHALL treat a project as removable from the user's list when, and only when, its `source` is `ProjectSource.Shared` and `canManage` is `false`. An owned project (`canManage: true`) and a public project (source `organization`) SHALL NOT offer the action in any surface. The same file's `getPinnedProjectMenuActions` SHALL return the `PinnedProjectMenuAction` values a pinned project's menu offers (Unpin, Edit, Publish, Share, RevokeAccess, Delete, RemoveFromMyList) in display order, and `usePinnedProjectsPanel` SHALL map each to its label, icon and handler using the project the Pinned section already loaded (`projectsById`); the view page SHALL read them from the loaded `ProjectDetailsDto`.

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

Both surfaces SHALL show one shared confirmation: the lib component `ProjectRemoveFromListConfirmation` of `@epam/ai-dial-projects` (a non-danger `ConfirmationDialog` from `@epam/ai-dial-chat-shared` that takes every string through optional `labels` with English defaults), filled by a thin app adapter with translations, titled `ButtonsI18nKeys.RemoveFromMyList`, naming the project and listing the consequences: the user loses access, other people keep theirs, a new invitation is needed to regain access. While the discard is pending the confirm button SHALL show a loading state and reject duplicate submissions. Cancel and dismiss SHALL send nothing.

#### Scenario: Cancel sends nothing

- **WHEN** the user cancels the confirmation
- **THEN** no request is sent and the project stays listed

#### Scenario: Double confirm sends one request

- **WHEN** the user activates confirm twice while the first request is pending
- **THEN** `discardSharedCatalogItem` is called once

### Requirement: Discard removes only the caller's access

The discard, unpin and error ordering SHALL live in `useProjectRemoveFromList` of `libs/chat-hooks/src/project/use-project-remove-from-list.ts`, which receives `discardShared`, `setPinned`, `onRemoved`, `onError`, `onUnpinFailed` and `onSettled` from the host and sends nothing twice while pending; the app adapter `apps/chat/src/hooks/projects/useProjectRemoveFromList.ts` supplies them. On confirm the app SHALL call `discardSharedCatalogItem(project.id)` (`apps/chat/src/server-api/share.api.ts`), i.e. `POST /api/v1/share/discard` with `{ "itemId": "projects/{bucket}/{path}" }`. No new endpoint, DTO or generated-client change is required: `DiscardSharedCatalogItemDto` already accepts the `projects/` prefix, and the call is not wrapped by a `Raw` method. The owner's project and other recipients' access SHALL be unchanged.

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

### Requirement: Owners can revoke project access

The owner SHALL be offered Revoke access in the project view action menu (desktop and mobile) and the pinned-project menu. Eligibility SHALL follow the loaded project's `canManage`; recipients, including editors, and organization projects without management rights SHALL NOT offer it. The backend independently checks ownership.

`ProjectView` SHALL accept optional `onRevokeAccess` and `ProjectViewLabels.revokeAccessLabel` (English default: 'Revoke access'). The library renders the action only when its callback is supplied and contains no API, ownership, routing or i18n integration. `getPinnedProjectMenuActions` in `libs/chat-hooks/src/project/project-sharing.ts` SHALL include `PinnedProjectMenuAction.RevokeAccess` after Share for owners.

`apps/chat/src/components/ProjectRevokeAccessConfirmation/ProjectRevokeAccessConfirmation.tsx` SHALL name the project and explain that recipients lose access, share links stop working, and the owner's copy remains. It SHALL use the existing destructive confirmation with keyboard navigation, focus return, and pre-mounted live feedback. Pending requests SHALL block confirmation and dismissal. Mobile and RTL behavior inherit the existing components without physical layout properties.

`libs/chat-hooks/src/project/use-project-revoke-access.ts` owns mutation state and SHALL call the configured client supplied by the caller with the full project id. The app adapter `apps/chat/src/hooks/projects/useProjectRevokeAccess.ts` supplies translated notifications and the configured operations from `apps/chat/src/server-api/share.api.ts`. The existing normal generated `ShareApi.revokeSharedAccess` method uses `RevokeSharedAccessDto` and `RevokeSharedAccessResponseDto`: `POST /api/v1/share/revoke`, request `{"itemId":"projects/owner/q4"}`, response `{"success":true}`. No new endpoint or generated-client change is required; existing validation, authentication, ownership and upstream-error handling apply.

The action SHALL reuse `buttons.revokeAccess`, `buttons.cancel` and existing `catalog.details.revokeShare.*` confirmation, consequence, status, success and error translations. It inherits `projectsEnabled` gating with no new cache, TTL, flag or telemetry. Success SHALL close the dialog and notify without deleting the project, changing pins or navigating. Failure SHALL notify with a request trace id when available and keep the confirmation available for retry. Mutation callbacks use `useCallback`; a ref blocks duplicate in-flight requests.

#### Scenario: Owner revokes from either surface

- **GIVEN** a project with `canManage: true`
- **WHEN** the owner opens Revoke access from its page or pinned menu and confirms
- **THEN** the full project id is sent to the revoke endpoint once
- **AND** success closes the confirmation while preserving the owner's project, route and pin

#### Scenario: Recipient cannot revoke others' access

- **GIVEN** a shared project with `canManage: false`, including one with `canEdit: true`
- **THEN** neither surface offers Revoke access
- **AND** Remove from My List remains available with its existing semantics

#### Scenario: Cancellation and request failure

- **WHEN** the owner cancels before confirming
- **THEN** no revoke request is sent
- **WHEN** a confirmed request fails
- **THEN** an error notification is shown and the confirmation can be retried
- **AND** no navigation, unpin or project deletion occurs

### Requirement: Revoke visibility follows current recipients

The app SHALL request the existing share recipient count when either project actions menu opens, only for a project the caller can manage. Revoke access SHALL be hidden by default, including before and during the initial lookup. Only a confirmed positive count SHALL offer it. A zero count or failed lookup SHALL hide it. Reopening a menu SHALL refresh the count, so a newly accepted share can restore the action.

`libs/chat-hooks/src/project/use-project-share-recipients.ts` owns per-mounted-surface counts keyed by project id, with no persistent cache or TTL. Successful revoke SHALL immediately set that project's count to zero in every mounted project menu using the same configured client. Different client instances SHALL be isolated. In-flight count responses started before revoke SHALL be discarded. Failure or cancellation SHALL NOT clear counts. Unmounting SHALL unsubscribe and ignore pending results.

The host SHALL pass `ProjectView.onActionMenuOpenChange` to request current eligibility for both responsive menus; the library SHALL only forward this callback, with no sharing API knowledge. Pinned menus use their existing open callback. The existing generated recipient-count endpoint and DTOs are unchanged.

#### Scenario: Successful revoke updates both menus

- **GIVEN** the owner sees Revoke access for a shared project
- **WHEN** revoke succeeds from either surface
- **THEN** both menus hide the action immediately
- **AND** an older recipient-count response cannot restore it

#### Scenario: Reload and sharing again

- **WHEN** a menu opens after a page reload and its recipient count resolves to zero
- **THEN** Revoke access is hidden
- **WHEN** a later menu open resolves to a positive count after a new share is accepted
- **THEN** Revoke access is offered again

### Requirement: Reusable project revoke contracts

The project entry point of `libs/chat-hooks` SHALL export `ProjectSharingClient`, `useProjectShareRecipients`, `useProjectRevokeAccess`, `ProjectRevokeAccessHandlers` and `notifyProjectAccessRevoked`. Both hooks take an already-configured stable client; the package SHALL NOT create clients or access app contexts, i18n, routing, auth or environment configuration. Success and error notifications are host callbacks.

`libs/projects/src/components/ProjectRevokeAccessConfirmation/ProjectRevokeAccessConfirmation.tsx` SHALL own the presentational dialog with `ProjectRevokeAccessConfirmationProps` and `ProjectRevokeAccessConfirmationLabels`. It receives the name, open/pending state and confirmation/dismissal callbacks, with English defaults for every label. It SHALL contain no generated DTOs, client calls, hooks from chat-hooks or i18n. The app component supplies translations and connects the mutation hook. Shared confirmation components retain styling, responsive layout, keyboard behavior and live feedback.

#### Scenario: Independent configured clients

- **GIVEN** menus using two different configured sharing clients
- **WHEN** a project is revoked through one client
- **THEN** only menus using that client clear their recipient state
