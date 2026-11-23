## MODIFIED Requirements

### Requirement: ProjectChatPage hosts a project conversation

`ProjectChatPage` (`apps/chat/src/pages/ProjectChatPage/ProjectChatPage.tsx`), at `ROUTES.ProjectChat`, SHALL:

- render `NotFoundPage` when `projectsEnabled` is off;
- parse the route with `parseProjectConversationRouteParams`. On `null` it renders the project not-found state with a link back to `/projects`;
- load the project with `useProject(projectId)` for its name and `canEdit`. When the opening project page passed `ProjectChatNavigationState.project` (`apps/chat/src/models/project-chat.ts`) for the same project id in router state, the page renders the chat from it at once, captured on mount because `ConversationPage` clears the router state, and the details replace it when they arrive; a details failure other than `404` or `403` then keeps the chat open. Without it, `Spinner` shows while loading;
- when `useProject` reports `isAccessDenied` (the details read answered `403`), render the same centred kit `StateScreen` it uses for not-found, even when router state supplied a summary, because the caller can no longer read or write the project's chats: the title is `t(ProjectsI18nKeys.ViewAccessDenied)` ("You no longer have access to this project"), the description is `t(ProjectsI18nKeys.ViewAccessDeniedDescription)` ("The owner may have stopped sharing it or deleted it."), and the only action is the `PrimaryButton` `t(ProjectsI18nKeys.ViewBrowseProjects)` navigating to `ROUTES.Projects`. No Retry is offered;
- wrap `ConversationPage` in `ConversationDataSourceContext.Provider` with the project value, and pass it the parsed `conversationId` (the page's optional `conversationId` prop; it defaults to the `/conversations/*` splat);
- render a breadcrumb (`ProjectChatHeader`). On desktop it is portalled into the start cell of `ChatLayout`'s top bar through `ChatLayoutHeaderSlotContext` (`apps/chat/src/context/ChatLayoutHeaderSlotContext.tsx`), beside the sources toggle, with no border of its own; on mobile, where that bar is hidden, it is a bar above the conversation: a back `GhostIconButton` named `projects.chat.backToProject` (with `IconArrowNarrowLeft`, `aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`, `rtl:scale-x-[-1]`), then the project name truncated with `EllipsisTooltip`, linking to `getProjectViewRoute(projectId)`.

**Who may write.** `canEdit` is `true` for the owner and for a recipient with edit access (see the `project-detail-api` capability). For both, the project value of `ConversationDataSourceContext` is writable: the input, regenerate, message edit and delete, and rating work as in a regular chat. The conversation is read-only only when `canEdit` is `false` (a view-only recipient or an organization project). `ProjectChatNavigationState.project.canEdit` keeps the same meaning: whether the caller may write the project's chats.

The page owns no conversation state: `ConversationPage` and `GenerationContext` own it, as for a regular chat. The generation-registry key is the stripped path `{bucket}/{projectPath}/conversations/{name}`. It begins with a bucket id and therefore does not collide with a regular bucket-relative path in practice.

**RTL impact:** none for the access-denied screen. It is a centred `StateScreen` with a non-directional alert icon.

#### Scenario: Read-only shared project chat

- **WHEN** a view-only recipient (`canEdit: false`) opens a conversation of a project shared with them
- **THEN** the conversation renders read-only: no input and no regenerate or edit actions, and no Duplicate action

#### Scenario: A shared editor's chat is writable

- **WHEN** a recipient with edit access (`canEdit: true`, `canManage: false`) opens a conversation the owner started
- **THEN** the input, regenerate and message edit actions render, and sending a message posts to `POST /api/v1/projects/{id}/conversations/completions`

#### Scenario: Back to project

- **WHEN** the user activates the breadcrumb's back button
- **THEN** the router is at `getProjectViewRoute(projectId)`

#### Scenario: Chat of a project the caller lost access to

- **WHEN** a recipient opens a project chat URL, router state carries a summary for that project, and `getProject` then rejects with `403`
- **THEN** the chat is replaced by "You no longer have access to this project" with "Back to projects", which navigates to `/projects`, and no conversation input renders
