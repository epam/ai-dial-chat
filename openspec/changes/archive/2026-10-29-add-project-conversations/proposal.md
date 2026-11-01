## Why

The project view page (#9621) shows a project's instructions and context, but the user cannot chat in it. Section 4 of #9621 adds chats to a project: they are stored inside the project, in a `conversations/` folder next to `context/`, so they share its lifecycle (share, publish, download, delete), and their model calls carry the project id so the deployment can apply the project's instructions and context files.

## What Changes

- **Storage.** A project conversation is the file `conversations/{name}` inside the DIAL Core complex resource `projects/{bucket}/{path}`. It has the same JSON body and the same file-name convention (`{deployment}__{title}__{uuid}`) as a top-level conversation. It is never a `conversations/{bucket}/…` resource, so it does not appear in the sidebar list, search or conversation pins.
- **BFF: new `/api/v1/projects/:id/conversations…` endpoints:**
  - list, newest first, with author and title;
  - create from the first message;
  - get, save, rename and delete;
  - completions, stop and attach.

  They are flag-gated like every project endpoint. Writes are owner-only (`canEdit`), and shared and organization projects are read-only.
- **BFF: generation reuse.**
  - `ConversationPersistenceService` routes a `projects/…/conversations/{name}` locator to a new `ProjectConversationStore` (SDK `downloadProjectFile` / `uploadProjectFile` / `deleteProjectFile`). Streaming, background generation and naming stay unforked.
  - Conflict detection is per conversation (a content hash), because Core's `If-Match` on a project file checks the whole project's ETag.
- **BFF: project id in requests.**
  - Each Chat Completions and Responses request of a project conversation carries the `x-project-id` header with the project id, and nothing else project-specific: no system message, no attachment.

  DIAL Core forwards every request header to the deployment on both Chat Completions and Responses, so the header reaches it with no Core change; the deployment resolves the project's instructions and files from it.
- **App: project view.**
  - `ProjectView` gains a main column (`mainContent` slot), and a new presentational `ProjectConversationList` in `libs/projects` renders it.
  - The app fills the main column with the chat input (the existing `NewConversationComposer`, with its model selector), the Chats list (author initials, title, a row menu with Rename and Delete) and the "No outputs or chats yet" empty state.
- **App: project chat route.**
  - `/projects/chat/:bucket/*` reuses `ConversationPage`.
  - The page reads its data from a new `ConversationDataSourceContext`. The default value wraps today's `/api/v1/conversations` calls, and a project value wraps the project endpoints.
- **Changes to existing project flows:**
  - The snapshot no longer inflates `conversations/` entries.
  - `GET /api/v1/projects/:id` returns a `contentVersion`. **BREAKING (internal API):** `PUT` and `DELETE /api/v1/projects/:id` take it in `If-Match` instead of Core's ETag, so a chat write no longer turns an edit or delete into `409 project-changed`.
  - The publish panel warns that the project's chats are published with it.
  - The delete confirmation says the chats are deleted too.
  - The archive download includes them.

## Capabilities

### New Capabilities

- `project-conversations-api`: the BFF endpoints, storage layout, persistence routing and conflict model for conversations stored inside a project, and the project context (`x-project-id`, instructions, context attachments) sent with their completions.
- `project-conversations-ui`: the project view's main column (chat input, Chats list, empty state), the project chat route, `ConversationDataSourceContext`, and the read-only mode for shared and organization projects.

### Modified Capabilities

- `project-detail-api`: the snapshot classifies `conversations/` entries separately and does not inflate them. `GET` adds `contentVersion`, and `PUT`/`DELETE` check it instead of Core's ETag. Conversation entries are re-uploaded as JSON on an edit.
- `project-view-ui`: `ProjectView` gets a main column. The publish panel shows a chats warning, and the delete confirmation mentions chats.
- `project-edit-ui`: the edit page sends `contentVersion` in `If-Match`.
- `navigation-routing`: the `ROUTES.ProjectChat` route, its helpers, and the route matchers that must treat it as a conversation route.

## Impact

**Backend (`apps/chat-api`)**
- New code:
  - `projects/conversations/` (controller, DTOs, list service), registered by `ProjectsModule`, which imports `ConversationModule`; the reverse import never happens, so there is no cycle;
  - `conversations/persistence/project-conversation.store.ts`.
- Changed:
  - `conversation-persistence.service.ts` (routing);
  - `utils/conversation.utils.ts` (`qualifySessionConversationPath` keeps locators);
  - both generation adapters (extra headers);
  - `common/utils/header-value.ts` (`buildProjectIdHeaders`);
  - the streaming and background services (the project id header, replay included);
  - the snapshot, update and delete services in `projects/`.
- The models are `ProjectsController` (`apps/chat-api/src/projects/projects.controller.ts`) and `ConversationController` (`apps/chat-api/src/conversations/conversation.controller.ts`).

**Frontend (`apps/chat`)**
- New:
  - `context/ConversationDataSourceContext.tsx`, following the `ThemeContext` pattern;
  - `pages/ProjectChatPage/`;
  - `hooks/projects/useProjectConversations.ts`;
  - `server-api/project-conversations.api.ts`.
- Changed:
  - `pages/Conversation/Conversation.tsx` (its direct calls move behind the data source);
  - `pages/ProjectViewPage/ProjectViewPage.tsx`;
  - `PublishProjectPanelContainer`;
  - `constants/routes.ts`, `types/routes.ts` and `app/app.tsx`;
  - the `/conversations/*` matchers in `ClientChannelContext`, `SourcesSidebarToggle` and `CelebrationHost`.

**Libraries**
- `libs/projects`: `ProjectView` `mainContent`, new `ProjectConversationList`.
- No lib learns about REST paths, flags, i18n or routing: the host passes rows, strings and callbacks.

**Shared providers and scope creep**
- `ConversationPage` is the main chat page, so moving its data calls behind a context is the riskiest part. The default context value must keep the regular chat byte-for-byte equivalent.

**API and generated client**
- New OpenAPI operations; regenerate with `npm run openapi` / `npm run openapi:check`.

**i18n**
- New user-visible strings under `projects.chats.*`, `projects.chat.*`, `projects.publish.chatsWarning` and an updated delete confirmation.

**Docs**
- `docs/architecture.md` (route, endpoints, new context), `apps/chat-api/README.md`, the `libs/projects` README.

**Dependencies**
- None in DIAL Core: Core forwards request headers, `x-project-id` included, to the deployment on both Chat Completions and Responses.

## Non-goals

- **Outputs:** not a concept yet. The empty state keeps the design's wording.
- **Project conversations outside the project page:** no sidebar, search, pins, duplicate, share or publish of a single project conversation.
- **Cross-tab live updates (watch):** Core resource subscription for files inside a complex resource is unverified. The project chat page re-reads the title after the first reply instead.
- **Editable shares and collaborative chats:** writes stay owner-only.
- **Moving a conversation between projects, or between a project and the top level.**

## Alternatives considered

- **Store project chats as top-level `conversations/{bucket}/projects/{project}/…` with a link to the project.**
  - Pros: no Core contention, and the existing APIs work unchanged.
  - Cons:
    - the recursive sidebar listing picks the chats up;
    - share, publish, download and delete of the project would not include them;
    - the user asked for storage inside the project.

  Rejected.
- **Replace the injected persistence with the `CONVERSATION_PERSISTENCE` port.** Only `ConversationNamingService` injects the token today, and streaming, background and lifecycle take the concrete class. Widening every signature to a location object touches about 40 call sites. Rejected in favour of routing by locator inside the concrete service.
- **A forked project streaming pipeline.** It duplicates background generation, stop and attach. Rejected.
- **Keep Core's ETag for edits.** Every chat message would make a concurrent edit fail. Rejected for `contentVersion`.

## Acceptance criteria

- Sending a message from the project page creates `conversations/{name}` inside the project, opens `/projects/chat/…` and streams the reply. The request carries `x-project-id` and is otherwise the same as a top-level chat's.
- The Chats list shows the project's conversations newest first, with author initials and titles, and opens one on click. An empty project shows the empty state.
- Rename and Delete work from the list. Shared and organization projects show the list and open chats read-only, without the input, Rename or Delete.
- Project conversations never appear in the sidebar.
- A chat written while the edit page is open does not make the save `409`, and a real concurrent edit of `PROJECT.md` or `context/` still does.
- The regular `/conversations/*` page behaves exactly as before, and its existing tests pass unchanged.
- BFF and frontend tests listed in the specs pass. `npm run validate:docs`, `validate:specs` and `openapi:check` pass.

## Rollback

- Everything is behind `PROJECTS_ENABLED`. Turning it off hides the page, and `FeatureGuard` rejects the endpoints.
- A code revert leaves `conversations/` files inside projects, where they stay inert (`otherEntries`) and are carried through edits verbatim.
- The `contentVersion` change ships the BFF and the app together. Reverting both restores ETag-based edits.
