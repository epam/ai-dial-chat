# Projects reuse

A host builds the Projects pages from two packages: `@epam/ai-dial-projects`
renders them, and `@epam/ai-dial-chat-hooks/project` holds the project
requests and data hooks. The host owns routing, feature gating, i18n,
notifications, pins and the configured generated client. Import UI Kit
base/theme styles once at the host root.

## What each package provides

| Concern                                               | Package and export                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Project requests over a configured `ProjectsApi`      | `createProjectsApiClient(projectsApi)` from `@epam/ai-dial-chat-hooks/project`                             |
| Projects list, one project, create and save           | `useProjects`, `useProject`, `useCreateProject`, `useSaveProject` (each takes the client first)            |
| Pin, downloads and delete of the open project         | `useProjectActions(client, project, handlers)` — messages, pins and navigation come through `handlers`     |
| A project's chats: load, page, rename, delete         | `useProjectConversations(client, projectId)`                                                               |
| DTO → view models and form errors                     | `mapProjectDtoToItem`, `mapProjectDetailsToViewModel`, `mapStoredContextFiles`, `getProjectFormError`      |
| Context-file limits from the client config            | `resolveByteLimit`, `resolveExtensionList`, `getMimeTypesForExtensions` and the `DEFAULT_PROJECT_*` values |
| Projects page, New/Edit form, project view            | `Projects`, `ProjectCreateForm`, `ProjectView` from `@epam/ai-dial-projects`                               |
| The project's chat column and the chat breadcrumb bar | `ProjectConversationsPanel` (with `ProjectView.mainContent`) and `ProjectChatHeader`                       |

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

DIAL Chat keeps these in `apps/chat` because they depend on its own contexts:
the chat input (`NewConversationComposer`, fed by its deployments and tools
contexts), the project chat page's `ConversationDataSourceContext` value, the
publish panel container, the file-manager picker and every `*Labels` hook that
resolves strings through i18n. Its hooks in `apps/chat/src/hooks/projects/` are
one-line adapters that bind the shared hooks to the app's client and contexts.
