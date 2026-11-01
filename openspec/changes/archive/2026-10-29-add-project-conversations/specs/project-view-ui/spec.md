## MODIFIED Requirements

### Requirement: ProjectView is a host-agnostic presentational component in libs/projects

`libs/projects` SHALL export:

- `ProjectView`;
- the `ProjectViewProps`, `ProjectViewLabels`, `ProjectViewStyles`, `ProjectViewModel` and `ProjectContextFileItem` types;
- `ProjectConversationList` and its types (see the `project-conversations-ui` capability).

The lib SHALL NOT import `@epam/ai-dial-chat-api-client`, REST paths, feature flags, i18n, the router or app contexts.

Props:

| Prop | Type |
| --- | --- |
| `project` | `ProjectViewModel \| null`, where `ProjectViewModel` is `{ name: string; description: string; instructions: string; contextFiles: ProjectContextFileItem[] }` and `ProjectContextFileItem` is `{ name: string; contentType: string }` |
| `isLoading` | optional `boolean`, default `false` |
| `hasError` | optional `boolean`, default `false` |
| `isNotFound` | optional `boolean`, default `false` |
| `isPinned` | `boolean` |
| `isPinPending` | optional `boolean`, default `false` |
| `contextSearchQuery` | `string` |
| `onContextSearchQueryChange` | `(query: string) => void` |
| `onBack` | `() => void` |
| `onTogglePin` | `() => void` |
| `onPublish` | optional `() => void`; hidden when omitted |
| `onEdit` | optional `() => void`; hidden when omitted |
| `onShare` | optional `() => void`; hidden when omitted |
| `onDelete` | optional `() => void`; hidden when omitted |
| `onDownload` | `() => void` |
| `onOpenFile` | `(fileName: string) => void` |
| `onRetry` | `() => void` |
| `onBrowseProjects` | `() => void` |
| `mainContent` | optional `ReactNode`: the main column's content |
| `labels` | `ProjectViewLabels` |
| `styles` | optional `ProjectViewStyles`, applied via `buildCssVars` |

**Main column.** When `mainContent` is supplied, the loaded layout renders it in a `<section>` before the Details `<aside>`:

- it is named by `labels.mainContentLabel`, a new optional label;
- it is `flex-1 min-w-0`, with `24px 32px` padding on `desktop`;
- its content is centered at the design's 748px max width.

On `mobile` the section stacks above the Details panel. Without `mainContent`, the layout is unchanged, so the Details panel is pushed to the inline end. The lib renders the node as given: the chat input and the Chats list are composed by the host.

Every declared prop SHALL be read. Read-only mode is expressed only by omitting `onEdit`, `onDelete`, `onShare` and `onPublish`. The lib has no `isReadOnly` flag, so a prop cannot contradict the callbacks.

`ProjectViewPage` maps the DTO into `ProjectViewModel` with `mapProjectDetailsToViewModel` (`libs/chat-hooks/src/project/project-mapping.ts`). Each `contentType` comes from `inferMimeTypeFromPath` (`@epam/ai-dial-chat-shared`), falling back to `application/octet-stream`.

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag`, `react-router` and `react-i18next`
- **THEN** none of them occurs

#### Scenario: Omitted callbacks hide actions

- **WHEN** `ProjectView` renders without `onEdit`, `onDelete`, `onShare` and `onPublish`
- **THEN** no Edit, Delete, Share or Publish control is rendered, and Pin and Download are

#### Scenario: Main column renders before the Details panel

- **WHEN** `ProjectView` renders a loaded project with `mainContent={<p>chats</p>}`
- **THEN** a `<section>` named by `labels.mainContentLabel` contains "chats" and precedes the Details `<aside>` in DOM order

#### Scenario: No main column without mainContent

- **WHEN** `ProjectView` renders without `mainContent`
- **THEN** no main-column `<section>` renders

### Requirement: Project actions run through app-owned adapters

`useProjectActions` (`apps/chat/src/hooks/projects/useProjectActions.ts`) SHALL own the side effects for one loaded project.

**Download.** `downloadProjectArchive(id)` calls `projectsApi.downloadProjectRaw` and passes the raw `Response` to `triggerBrowserDownload` (`apps/chat/src/utils/file-download.ts`) with the fallback name `{name}.zip`.

- Success calls `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Downloaded, { name })`.
- Failure calls `showErrorNotification` with `projects.actions.downloadError`.

**Open file.** `downloadProjectContextFile(id, fileName)` works the same way, through `downloadProjectFileRaw`.

**Delete.**

- The page opens `DeleteConfirmationDialog` (`@epam/ai-dial-chat-shared`). Its title is `projects.actions.deleteConfirmTitle` (interpolating `{{name}}`), and its labels are the shared confirm and cancel labels. Its body is:
  - `projects.actions.deleteConfirmDescription` when the loaded project has `conversationCount: 0`;
  - otherwise `projects.actions.deleteConfirmWithChatsDescription`, pluralised by `count` (`_one` / `_other`), which says the project's chats are deleted too.
- Confirming calls `deleteProject(id, contentVersion)`, and the dialog shows `isLoading` while the request runs.
- **Success:** `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Deleted, { name })`, then `replacePinnedProjectId(id, null)` (the BFF already removed the pin), then `navigate(ROUTES.Projects, { replace: true })`, so Back does not reopen the deleted project.
- **`409 project-changed`:** close the dialog, show `showErrorNotification` with `projects.errors.changedElsewhere`, and call `retry()`.
- **Other failures:** `showErrorNotification` with `projects.actions.deleteError`. The dialog stays open.

**Share.** `SharePopoverContainer` is rendered with `itemId={id}` and `canEditAccess={false}`.

**Publish.** `PublishProjectPanelContainer` is rendered with `projectId`, `projectName`, `conversationCount`, `onClose` and `returnFocusRef` (the Publish trigger).

**Gating.** `onPublish`, `onEdit`, `onShare` and `onDelete` are passed to `ProjectView` only when `project.canEdit` is `true`. Pin and Download are always passed.

`NotifiableEntity` (`apps/chat/src/types/entity-notification.ts`) gains `Project`, with its entries in `apps/chat/src/utils/entity-notification.ts`.

#### Scenario: Delete confirms, deletes and navigates

- **WHEN** the user chooses Delete, then confirms
- **THEN** `deleteProject` is called with the loaded `contentVersion`, a success toast is shown, and the router is at `/projects`

#### Scenario: Delete confirmation mentions chats

- **WHEN** the loaded project has `conversationCount: 3`, and the user chooses Delete
- **THEN** the dialog body is `projects.actions.deleteConfirmWithChatsDescription_other` with `count: 3`

#### Scenario: Delete on a changed project

- **WHEN** `deleteProject` rejects with `409` and `code: 'project-changed'`
- **THEN** the "changed by someone else" toast is shown, and the project is reloaded

#### Scenario: Shared project is read-only

- **WHEN** the loaded project has `canEdit: false`
- **THEN** Edit, Delete, Share and Publish are absent, and Pin and Download work

#### Scenario: Download the archive

- **WHEN** the user chooses Download
- **THEN** `downloadProjectRaw` is called, and the browser receives `{name}.zip`

### Requirement: Projects can be published through the standalone publish panel

`PublishProjectPanelContainer` (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`) SHALL follow the structure of `PublishConversationPanelContainer`:

- `StandalonePublishPanel` from `@epam/ai-dial-publish-panel`;
- `usePublishFolders`, `usePublishErrorNotification` and `getPublishRules`.

It submits through `publishCatalogEntity({ entityType: CatalogPublishEntityType.Project, entityId: projectId, publishCatalogEntityDto })` from `apps/chat/src/server-api/publish.api.ts`. On success it calls `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.PublishRequested, { name })`. Its strings come from `projects.publish.*` keys, plus the shared publish keys where they exist.

`CatalogPublishEntityType` in `libs/chat-hooks/src/catalog/publish.ts` SHALL gain `'project'`. `CatalogEntityType` in `libs/chat-shared` is not changed.

**Chats warning.** DIAL Core publishes a project as a whole, `conversations/` included. When `conversationCount > 0`, the container renders a kit `Notification` with the warning variant through `StandalonePublishPanel`'s `renderSummary`, after the resource title, so `libs/publish-panel` is not changed.

- Its text is `projects.publish.chatsWarning`, pluralised by `count`: "This project's {{count}} chats will be published with it and visible to everyone who can see the project."
- The warning does not block submission: publishing stays the user's choice.
- It sits inside the panel's labelled region, so screen readers read it with the summary.

#### Scenario: Publish request

- **WHEN** the user selects a folder and submits
- **THEN** `POST /api/v1/catalog/project/{encoded id}/publish` is sent, and a "publish requested" toast is shown

#### Scenario: Chats warning on a project with chats

- **WHEN** the panel opens for a project with `conversationCount: 2`
- **THEN** a warning `Notification` with `projects.publish.chatsWarning_other` (`count: 2`) renders, and Submit stays enabled

#### Scenario: No warning without chats

- **WHEN** the panel opens for a project with `conversationCount: 0`
- **THEN** no chats warning renders
