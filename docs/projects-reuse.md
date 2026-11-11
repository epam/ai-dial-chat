# Projects reuse

A host builds the Projects pages from two packages: `@epam/ai-dial-projects`
renders them, and `@epam/ai-dial-chat-hooks/project` holds the project
requests and data hooks. The host owns routing, feature gating, i18n,
notifications, pins and the configured generated client. Import UI Kit
base/theme styles once at the host root.

## What each package provides

| Concern                                                   | Package and export                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project requests over a configured `ProjectsApi`          | `createProjectsApiClient(projectsApi)` from `@epam/ai-dial-chat-hooks/project`                                                                                                                                                                                                                                                                                                                                                                   |
| Projects list, one project, create and save               | `useProjects`, `useProject`, `useCreateProject`, `useSaveProject` (each takes the client first)                                                                                                                                                                                                                                                                                                                                                  |
| Pin, downloads and delete of the open project             | `useProjectActions(client, project, handlers)` — messages, pins and navigation come through `handlers`; a host that owns the delete dialog state passes `isDeleteOpen` and `onDeleteOpenChange`                                                                                                                                                                                                                                                  |
| A project's chats: load, page, rename, delete             | `useProjectConversations(client, projectId)`                                                                                                                                                                                                                                                                                                                                                                                                     |
| DTO → view models and form errors                         | `mapProjectDtoToItem`, `mapProjectDetailsToViewModel`, `mapStoredContextFiles`, `getProjectFormError`                                                                                                                                                                                                                                                                                                                                            |
| Opening a context file or output in the attachment canvas | `useProjectFilePreview` plus the key and attachment helpers (`toProjectPreviewKey`, `toProjectContextFileAttachment`, …) from `@epam/ai-dial-chat-hooks/project`; the host passes the canvas callbacks and the locator builder                                                                                                                                                                                                                   |
| A project chat's data source for a conversation page      | `createProjectConversationDataSource` from `@epam/ai-dial-chat-hooks/project` and the `ConversationDataSource` contract from `./conversation`; the host supplies the stream base path, CSRF accessors, routes and viewed-mark queue                                                                                                                                                                                                              |
| Starting a chat from the project's input                  | `createProjectChat` and `classifyProjectChatCreateError`; the host keeps deployments, tools, skill mentions, toasts and navigation                                                                                                                                                                                                                                                                                                               |
| The New and Edit project form state                       | `useProjectDraft`; the host keeps the unsaved-changes guard, toasts and navigation                                                                                                                                                                                                                                                                                                                                                               |
| Publish history of an open publish panel                  | `usePublishHistory` from `@epam/ai-dial-chat-hooks/catalog`; the host supplies the request and its mapping                                                                                                                                                                                                                                                                                                                                       |
| Unpublish of a published project                          | `useUnpublishableFolders` from `@epam/ai-dial-chat-hooks/catalog` decides who may unpublish and from which folders; pass `ProjectView.onUnpublish` once it resolves with folders. The host keeps the confirmation, the request and the toasts (`apps/chat/src/hooks/projects/useProjectUnpublish.ts` is the reference). Pass `isOwner: false` for projects: the personal project keeps Publish and only its public copy offers Unpublish (#9800) |
| Context-file limits from the client config                | `resolveByteLimit`, `resolveExtensionList`, `getMimeTypesForExtensions` and the `DEFAULT_PROJECT_*` values                                                                                                                                                                                                                                                                                                                                       |
| Projects page, New/Edit form, project view                | `Projects`, `ProjectCreateForm`, `ProjectView` from `@epam/ai-dial-projects`                                                                                                                                                                                                                                                                                                                                                                     |
| The project's chat column and the chat breadcrumb bar     | `ProjectConversationsPanel` (with `ProjectView.mainContent`) and `ProjectChatHeader`                                                                                                                                                                                                                                                                                                                                                             |

## Wiring

```tsx
import {
  createProjectsApiClient,
  useProject,
} from '@epam/ai-dial-chat-hooks/project';

/* Created once, with the host's configured generated client. */
const projectsClient = createProjectsApiClient(projectsApi);

const project = useProject(projectsClient, projectId, isProjectsEnabled);
```

The hooks expose no feature-key strings: the host keeps gating at its edge and
passes `enabled`. `useProjectActions` reports failures as a
`ProjectActionError` and `getProjectFormError` as a `ProjectFormErrorReason`,
so the host maps each to its own message.

## What stays in the host

The host decides when the form's name is locked. DIAL Chat passes
`isNameReadOnly` on every project edit page, including the owner's, and
translates `labels.nameReadOnlyHint` ("The project name can't be changed after
creation") for both the tooltip and persistent helper text. New-project names
remain editable. Edit saves use the loaded project's name, not a changed draft
name; instructions and context files remain editable.

DIAL Chat keeps these in `apps/chat` because they depend on its own contexts,
router, i18n or `server-api`: the chat input (`NewConversationComposer`, fed by
its deployments and tools contexts), the project chat page's
`ConversationDataSourceContext` value, the publish panel container, the
react-router edge of the unsaved-changes guard (`useBuilderLeaveGuard`, built on
the shared `useUnsavedChangesLeaveGuard` from `@epam/ai-dial-chat-shared`), the Share overlay, the
file-manager modal, every `*Labels` hook that resolves strings through i18n, and
the translation of each error and toast. Its pages call the shared hooks directly
with the app's `projectsClient`
(`apps/chat/src/hooks/projects/projects-client.ts`). Action and sharing adapters
bind configured operations, pins, notifications and navigation to the shared hooks. The
bindings that remain are thin: `apps/chat/src/utils/project-file-preview.ts`
(the locator scheme), `apps/chat/src/utils/project-conversation-data-source.ts`
(stream base path, CSRF store, routes, viewed-mark queue) and
`apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts` (download and
toast over the shared `useSkillFileSystemPicker`).

For owner access revocation, pass `ProjectView.onRevokeAccess` and translate
`labels.revokeAccessLabel`. The pinned menu exposes
`PinnedProjectMenuAction.RevokeAccess` for the same owner permission.
`useProjectRevokeAccess(client, project, handlers)` and
`useProjectShareRecipients(client)` come from `@epam/ai-dial-chat-hooks/project`.
Pass the same stable, already-configured `ProjectSharingClient` to both hooks;
success synchronizes recipient state only among menus using that client.
`handlers.onRevoked(project)` and `handlers.onError(project, requestId)` keep
notifications and dialog state outside the library.
`ProjectRevokeAccessConfirmation` from `@epam/ai-dial-projects` receives
`isOpen`, `projectName`, `isRevoking`, `onConfirm`, `onClose` and translated
`labels`. App adapters bind configured operations and translations.
Success preserves the owner's project, pins and route. Failure keeps the
confirmation available for retry. Recipients continue to use Remove from My List.

Use `ProjectView.onActionMenuOpenChange` to refresh host-owned action eligibility
when either responsive menu opens. DIAL Chat requests the share recipient count,
shows Revoke access only for a confirmed positive count (hidden initially, at zero,
and on lookup failure), and updates both mounted menus immediately after
successful revoke. Every menu open refreshes the count, including after re-sharing.
