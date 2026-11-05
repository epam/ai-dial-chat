## MODIFIED Requirements

### Requirement: Project actions run through app-owned adapters

`useProjectActions` (`apps/chat/src/hooks/projects/useProjectActions.ts`) SHALL own the side effects for one loaded project.

**Download.** `downloadProjectArchive(id)` calls `projectsApi.downloadProjectRaw` and passes the raw `Response` to `triggerBrowserDownload` (`libs/chat-hooks/src/files/browser-download.ts`) with the fallback name `{name}.zip`.

- Success calls `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Downloaded, { name })`.
- Failure calls `showErrorNotification` with `projects.actions.downloadError`.

**Open file.** The hook no longer downloads a single context file. Activating a context card opens the file in the attachment canvas (see the `project-context-file-preview` capability), and downloading that one file is the canvas header's Download action.

**Delete.**

- The page opens `ProjectDeleteConfirmation` (`apps/chat/src/components/ProjectDeleteConfirmation/ProjectDeleteConfirmation.tsx`), the app's one project delete dialog, which renders `DeleteConfirmationDialog` (`@epam/ai-dial-chat-shared`). Its title is `projects.actions.deleteConfirmTitle` (interpolating `{{name}}`), and its labels are the shared confirm and cancel labels. Its body is:
  - `projects.actions.deleteConfirmDescription` when the loaded project has `conversationCount: 0`;
  - otherwise `projects.actions.deleteConfirmWithChatsDescription`, pluralised by `count` (`_one` / `_other`), which says the project's chats are deleted too.
- Confirming calls `deleteProject(id, contentVersion)`, and the dialog shows `isLoading` while the request runs.
- **Success:** `notifyOperationSuccess(NotifiableEntity.Project, EntityOperation.Deleted, { name })`, then `replacePinnedProjectId(id, null)` (the BFF already removed the pin), then `navigate(ROUTES.Projects, { replace: true })`, so Back does not reopen the deleted project.
- **`409 project-changed`:** close the dialog, show `showErrorNotification` with `projects.errors.changedElsewhere`, and call `retry()`.
- **Other failures:** `showErrorNotification` with `projects.actions.deleteError`. The dialog stays open.

**Share.** `ProjectShareOverlay` (`apps/chat/src/components/ProjectShareOverlay/ProjectShareOverlay.tsx`) renders `SharePopoverContainer` with:

- `itemId={id}`;
- `canEditAccess` set, so the popover offers the View / Edit access dropdown. Edit creates a link with `ShareLinkAccess.View` and `ShareLinkAccess.Edit`, which the BFF turns into `READ` + `WRITE`;
- `visibilityNote={t(ShareI18nKeys.VisibilityNoteProject)}` and `visibilityNoteEdit={t(ShareI18nKeys.VisibilityNoteEditProject)}`, so the notes name a project and its chats, not a deployment.

`SharePopoverContainer` (`apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx`) gains optional `visibilityNote?: string` and `visibilityNoteEdit?: string` props. Each one, when set, replaces its default (`ShareI18nKeys.VisibilityNote`, `ShareI18nKeys.VisibilityNoteEdit`). The catalog passes neither, so its popover is unchanged.

Changing the access in the popover requests a new link, as for catalog entities (`useShareLink`). A link already handed out keeps the permissions it was created with, and the existing revoke flow removes every recipient's access.

**Publish.** `PublishProjectPanelContainer` is rendered with `projectId`, `projectName`, `conversationCount`, `onClose` and `returnFocusRef` (the Publish trigger).

**Gating.** The page reads two flags from the loaded `ProjectDetailsDto`:

| Callback passed to `ProjectView` | Passed when |
| --- | --- |
| `onEdit` | `project.canEdit` |
| `onPublish`, `onShare`, `onDelete` | `project.canManage` |
| `onTogglePin`, `onDownload`, `onContextFileClick` | always |

`PublishProjectPanelContainer` mounts only while `project.canManage`, as `ProjectShareOverlay` and `ProjectDeleteConfirmation` open only through `onShare` and `onDelete`. So a recipient with edit access (`canEdit: true`, `canManage: false`) sees Edit, and neither Publish, Share nor Delete.

New `en.json` keys, with matching `ShareI18nKeys` members:

| Key | `ShareI18nKeys` member | English |
| --- | --- | --- |
| `share.visibilityNoteProject` | `VisibilityNoteProject` | This project, its chats and its updates will be visible to users with the link. |
| `share.visibilityNoteEditProject` | `VisibilityNoteEditProject` | Anyone with the link will be able to view and edit this project and chat in it. |

Every key SHALL exist in every locale file.

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

#### Scenario: View-only project is read-only

- **WHEN** the loaded project has `canEdit: false` and `canManage: false`
- **THEN** Edit, Delete, Share and Publish are absent, and Pin and Download work

#### Scenario: A shared editor edits but does not manage

- **WHEN** the loaded project has `source: 'shared'`, `canEdit: true` and `canManage: false`
- **THEN** Edit is offered, Publish, Share and Delete are absent, and Pin and Download work

#### Scenario: The owner shares with edit access

- **WHEN** the owner chooses Share on their project
- **THEN** the popover shows the access dropdown and the note `share.visibilityNoteProject`
- **AND** choosing Can edit requests a link with access `['view', 'edit']` and shows `share.visibilityNoteEditProject`

#### Scenario: Download the archive

- **WHEN** the user chooses Download
- **THEN** `downloadProjectRaw` is called, and the browser receives `{name}.zip`

#### Scenario: A context card no longer downloads

- **WHEN** the user activates a context card on the view page
- **THEN** no browser download starts, and the file opens in the canvas
