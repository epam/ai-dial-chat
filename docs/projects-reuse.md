# Projects reuse

A host builds the Projects pages from two packages: `@epam/ai-dial-projects`
renders them, and `@epam/ai-dial-chat-hooks/project` holds the project
requests and data hooks. The host owns routing, feature gating, i18n,
notifications, pins and the configured generated client. Import UI Kit
base/theme styles once at the host root.

## What each package provides

| Concern                                                   | Package and export                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project requests over a configured `ProjectsApi`          | `createProjectsApiClient(projectsApi)` from `@epam/ai-dial-chat-hooks/project`                                                                                                                                                      |
| Projects list, one project, create and save               | `useProjects`, `useProject`, `useCreateProject`, `useSaveProject` (each takes the client first)                                                                                                                                     |
| Pin, downloads and delete of the open project             | `useProjectActions(client, project, handlers)` — messages, pins and navigation come through `handlers`; a host that owns the delete dialog state passes `isDeleteOpen` and `onDeleteOpenChange`                                     |
| A project's chats: load, page, rename, delete             | `useProjectConversations(client, projectId)`                                                                                                                                                                                        |
| DTO → view models and form errors                         | `mapProjectDtoToItem`, `mapProjectDetailsToViewModel`, `mapStoredContextFiles`, `getProjectFormError`                                                                                                                               |
| Opening a context file or output in the attachment canvas | `useProjectFilePreview` plus the key and attachment helpers (`toProjectPreviewKey`, `toProjectContextFileAttachment`, …) from `@epam/ai-dial-chat-hooks/project`; the host passes the canvas callbacks and the locator builder      |
| A project chat's data source for a conversation page      | `createProjectConversationDataSource` from `@epam/ai-dial-chat-hooks/project` and the `ConversationDataSource` contract from `./conversation`; the host supplies the stream base path, CSRF accessors, routes and viewed-mark queue |
| Starting a chat from the project's input                  | `createProjectChat` and `classifyProjectChatCreateError`; the host keeps deployments, tools, skill mentions, toasts and navigation                                                                                                  |
| The New and Edit project form state                       | `useProjectDraft`; the host keeps the unsaved-changes guard, toasts and navigation                                                                                                                                                  |
| Publish history of an open publish panel                  | `usePublishHistory` from `@epam/ai-dial-chat-hooks/catalog`; the host supplies the request and its mapping                                                                                                                          |
| Context-file limits from the client config                | `resolveByteLimit`, `resolveExtensionList`, `getMimeTypesForExtensions` and the `DEFAULT_PROJECT_*` values                                                                                                                          |
| Projects page, New/Edit form, project view                | `Projects`, `ProjectCreateForm`, `ProjectView` from `@epam/ai-dial-projects`                                                                                                                                                        |
| The project's chat column and the chat breadcrumb bar     | `ProjectConversationsPanel` (with `ProjectView.mainContent`) and `ProjectChatHeader`                                                                                                                                                |

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
(`apps/chat/src/hooks/projects/projects-client.ts`); only `useProjectActions`
stays as an adapter, because it binds pins, notifications and navigation. The
bindings that remain are thin: `apps/chat/src/utils/project-file-preview.ts`
(the locator scheme), `apps/chat/src/utils/project-conversation-data-source.ts`
(stream base path, CSRF store, routes, viewed-mark queue) and
`apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts` (download and
toast over the shared `useSkillFileSystemPicker`).
