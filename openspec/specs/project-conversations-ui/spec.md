# project-conversations-ui Specification

## Purpose

The app and lib side of project chats: `ConversationPage` reading through `ConversationDataSourceContext`, `ProjectChatPage` hosting a project conversation, the host-agnostic list, panel and header in `libs/projects`, the project view's chat input and Chats list, and their i18n, responsive, RTL and accessibility requirements.

## Requirements

### Requirement: ConversationPage reads its data through ConversationDataSourceContext

`apps/chat/src/context/ConversationDataSourceContext.tsx` SHALL follow the `ThemeContext` pattern (`createContext<T | undefined>`, a memoised value, a guard hook). It provides a `ConversationDataSource` to `ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`):

| Member | Type | Purpose |
| --- | --- | --- |
| `transport` | `ConversationStreamTransport` | stream, stop, attach and get for `useConversationStream` |
| `getConversation` | `(id, signal?) => Promise<ConversationResponseDto>` | load and custom-viewer reload |
| `saveConversation` | `(path, body) => Promise<ConversationResponseDto>` | model change, status messages |
| `handlersApi` | `Pick<ConversationsApi, 'saveConversation' \| 'deleteConversation'>` | `useConversationHandlers` |
| `watchTitle` | `(id, previousName, onUpdated) => () => void` | the title update after the first reply |
| `getConversationRoute` | `(id) => string` | navigation after duplicate or custom-viewer create |
| `getExitRoute` | `() => string` | where a deleted or missing conversation navigates |
| `isReadOnly` | `(id) => boolean` | read-only mode |
| `listSync` | `{ updateTitle, bumpActivity, remove, refresh } \| null` | sidebar list side effects |
| `canDuplicate` | `boolean` | the read-only Duplicate action |
| `notFoundMessageKey` | optional `ProjectsI18nKeys` | the toast when the conversation cannot be loaded; the page's own message when unset |

**Default value.** `regularConversationDataSource` (`apps/chat/src/utils/regular-conversation-data-source.ts`) wraps exactly today's calls:

- `conversationStreamTransport`;
- `server-api/conversations.api.ts`;
- `ConversationsContext`'s watch and list functions;
- `getConversationRoute`, `ROUTES.Root`;
- the bucket-based read-only rule.

The provider supplies it at `AppRoot` level, so `/conversations/*` and `/` behave exactly as before. `useConversationDataSource` returns the nearest provided value, or the regular one when no provider overrides it (it needs `ConversationsContext`, so it fails outside `ConversationsProvider`), which keeps a bare `<ConversationPage />` working as before.

**Project value.** `createProjectConversationDataSource({ projectId, canEdit })` (`apps/chat/src/utils/project-conversation-data-source.ts`) uses:

- `createChatStreamApi({ completionsBasePath: '/api/v1/projects/{encodeURIComponent(projectId)}/conversations' })`, plus `getProjectConversation` for the transport;
- `server-api/project-conversations.api.ts` for get, save and delete;
- `watchTitle`: re-reads the conversation after the first reply completes, up to 5 times with the backoff `refreshConversations` uses, and reports a changed `name`;
- `getConversationRoute = getProjectConversationRoute`;
- `getExitRoute = () => getProjectViewRoute(projectId)`;
- `isReadOnly = () => !canEdit`;
- `listSync: null`;
- `canDuplicate: false`.

`transport.watchConversation` resolves without opening a subscription.

The direct server-api calls, the `/conversations` routing and the read-only rule in `ConversationPage` SHALL move behind the data source. The component then has no import of `server-api/conversations.api`. The data-source objects are module constants or `useMemo` keyed by `projectId` and `canEdit`, so the page's effects do not re-run on every render.

#### Scenario: Regular chat is unchanged

- **WHEN** the existing `ConversationPage` tests run against the default provider
- **THEN** they pass without changes, and the same server-api calls are made

#### Scenario: Project chat streams through the project base path

- **WHEN** a message is sent in `projects/a1b2c3/q4/conversations/x`
- **THEN** the request goes to `POST /api/v1/projects/projects%2Fa1b2c3%2Fq4/conversations/completions` with `path: 'a1b2c3/q4/conversations/x'`

#### Scenario: Missing project conversation exits to the project

- **WHEN** loading a project conversation fails with `404`
- **THEN** a `projects.chat.notFound` error toast is shown, the router is at the project's view route, and no sidebar list function is called

### Requirement: ProjectChatPage hosts a project conversation

`ProjectChatPage` (`apps/chat/src/pages/ProjectChatPage/ProjectChatPage.tsx`), at `ROUTES.ProjectChat`, SHALL:

- render `NotFoundPage` when `projectsEnabled` is off;
- parse the route with `parseProjectConversationRouteParams`. On `null` it renders the project not-found state with a link back to `/projects`;
- load the project with `useProject(projectId)` for its name and `canEdit`. When the opening project page passed `ProjectChatNavigationState.project` (`apps/chat/src/models/project-chat.ts`) for the same project id in router state, the page renders the chat from it at once, captured on mount because `ConversationPage` clears the router state, and the details replace it when they arrive; a details failure other than `404` then keeps the chat open. Without it, `Spinner` shows while loading;
- wrap `ConversationPage` in `ConversationDataSourceContext.Provider` with the project value, and pass it the parsed `conversationId` (the page's optional `conversationId` prop; it defaults to the `/conversations/*` splat);
- render a breadcrumb (`ProjectChatHeader`). On desktop it is portalled into the start cell of `ChatLayout`'s top bar through `ChatLayoutHeaderSlotContext` (`apps/chat/src/context/ChatLayoutHeaderSlotContext.tsx`), beside the sources toggle, with no border of its own; on mobile, where that bar is hidden, it is a bar above the conversation: a back `GhostIconButton` named `projects.chat.backToProject` (with `IconArrowNarrowLeft`, `aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`, `rtl:scale-x-[-1]`), then the project name truncated with `EllipsisTooltip`, linking to `getProjectViewRoute(projectId)`.

The page owns no conversation state: `ConversationPage` and `GenerationContext` own it, as for a regular chat. The generation-registry key is the stripped path `{bucket}/{projectPath}/conversations/{name}`. It begins with a bucket id and therefore does not collide with a regular bucket-relative path in practice.

#### Scenario: Read-only shared project chat

- **WHEN** a user opens a conversation of a project shared with them
- **THEN** the conversation renders read-only: no input and no regenerate or edit actions, and no Duplicate action

#### Scenario: Back to project

- **WHEN** the user activates the breadcrumb's back button
- **THEN** the router is at `getProjectViewRoute(projectId)`

### Requirement: ProjectConversationList is a host-agnostic list in libs/projects

`libs/projects` SHALL export `ProjectConversationList` (`libs/projects/src/components/ProjectConversationList/ProjectConversationList.tsx`) and its `ProjectConversationListProps`, `ProjectConversationListItem` and `ProjectConversationListLabels` types. It imports no REST path, flag, i18n, router or app context.

| Prop | Type |
| --- | --- |
| `items` | `ProjectConversationListItem[]`, where an item is `{ id: string; title: string; authorName?: string }` |
| `isLoading` | optional `boolean` |
| `hasError` | optional `boolean` |
| `onRetry` | `() => void` |
| `onOpen` | `(id: string) => void` |
| `onRename` | optional `(id: string) => void`; the menu item is hidden when omitted |
| `onDelete` | optional `(id: string) => void`; the menu item is hidden when omitted |
| `labels` | `ProjectConversationListLabels` |

**Rendering:**
- a `<section>` named by its `<h2>` `labels.title` ("Chats"). While the project has no chats (not loading, no error, no items) the heading is not rendered and the section is named by `aria-label={labels.title}` instead, so only the empty state shows, as in the design;
- a `<ul>` with one `<li>` per item. Each row is a button named `labels.openLabel(title, authorName)`, containing:
  - `InitialsAvatar` (`@epam/ai-dial-chat-shared`) from `authorName`, `aria-hidden`;
  - the title in `dial-body-text`, truncated to one line with `EllipsisTooltip`.

  Rows have the design's hover and focus-visible background (`--bg-accent-primary-alpha` fallback).
- when `onRename` or `onDelete` is supplied, a ⋮ kit `Dropdown` per row, triggered by a `GhostIconButton` named `labels.moreActionsLabel(title)`, with Rename and Delete. The arrow keys, Enter and Space come from the kit.
- **States:**
  - loading: `Spinner` with `labels.loadingLabel`;
  - error: `labels.errorLabel` and a retry `Button`;
  - empty: `PanelEmptyState` with the list illustration, `labels.emptyTitle` ("No outputs or chats yet") and `labels.emptyDescription` ("Your outputs and chats will appear here once started.").
- Error and empty text are in a `role="status"` region.

`ProjectView`'s Details panel and this list are independent: the host passes the list in `mainContent`.

#### Scenario: Read-only list has no row menu

- **WHEN** `ProjectConversationList` renders without `onRename` and `onDelete`
- **THEN** no ⋮ trigger renders, and rows still open on click

#### Scenario: Empty state

- **WHEN** `items` is empty and neither `isLoading` nor `hasError` is set
- **THEN** "No outputs or chats yet" and its description render

#### Scenario: Keyboard opens a row

- **WHEN** a row has focus and the user presses Enter
- **THEN** `onOpen(id)` is called

### Requirement: The project view's main column holds the chat input and the Chats list

`ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL pass `mainContent` to `ProjectView` as `ProjectConversationsSection` (`apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`). The section renders:

1. **The chat input, only when `project.canEdit`.**
   - It is `NewConversationComposer` with a new `ComposerLayout.Embedded` (`apps/chat/src/types/conversation-composer.ts`): no greeting, no page footer (`FooterMessage`: operator message and app version), the input in normal flow at the top of the column, with the model selector, attachments, tools, the `+` menu's Prompts and Skills entries, the `/` command menu, skill mentions (sent as the first message's `skills`, restored on a failed create) and the deployment's `isChatMessageInputDisabled`, exactly as on the new-conversation screen. Both screens take the prompt and skill wiring from one hook, `useComposerMenus` (`apps/chat/src/hooks/conversation/useComposerMenus.tsx`), so the two composers cannot drift apart.
   - The selection comes from `DeploymentsContext`, and the section calls `restoreDefaultSelection` on mount, as `ConversationRoute` does, so a model restored from a viewed chat does not leak in.
   - Its placeholder is the shared `chat.placeholder` ("How can I help you today?").
2. **`ProjectConversationList`**, fed by `useProjectConversations(projectId)` (`apps/chat/src/hooks/projects/useProjectConversations.ts`).
   - The hook owns `{ items, isLoading, hasError, hasMore, isLoadingMore, retry, loadMore, rename, remove }` in local state. It follows the `useFavicon` pattern: `AbortController` cleanup, async/await.
   - While `hasMore`, the list ends with a Show more button (`buttons.showMore`). `loadMore` requests the next page with `offset` set to the rows already listed, appends it without repeating a row, and a failure keeps the rows and shows `projects.chats.error`.
   - Items map from `ProjectConversationItemDto` (`title`, `author` → `authorName`).

**First message.** Submitting the input SHALL:

1. call `createProjectConversation(projectId, …)` with the same fields `ConversationRoute`'s `handleCreateConversation` sends;
2. save the prompt, temperature and response format through `saveProjectConversation`;
3. `navigate(getProjectConversationRoute(conversation.id), { state: { conversation } })`.

`ConversationPage` then starts the stream, as for a new regular chat. A `413 project-storage-full` shows `projects.chats.storageFull`; other failures show `projects.chats.createError`. In both cases the draft is kept.

**Row actions,** owner only:
- `onOpen` navigates to the project chat route.
- `onRename` opens a kit `Popup` named `projects.chats.renameTitle`, with a labelled `Input` seeded with the title and Save and Cancel buttons (`buttons.save`, `buttons.cancel`). Save, or Enter in the input, trims the value, refuses an empty one inline (`projects.chats.renameEmpty`), and calls `renameProjectConversation`.
- `onDelete` opens `DeleteConfirmationDialog` with `projects.chats.deleteConfirmTitle` (`{{title}}`) and `projects.chats.deleteConfirmDescription`, then calls `deleteProjectConversation`.

Success updates the list in place and shows a toast. Failure shows `projects.chats.renameError` or `projects.chats.deleteError`. Neither dialog can be closed while its request is pending.

After a delete, the project view's chat count (the delete-project message and the publish warning) drops by one without a reload.

**Read-only** (`canEdit: false`): no input, and `onRename`/`onDelete` are omitted, so the list only opens chats.

Handlers are memoised with `useCallback`, and the mapped items with `useMemo`.

#### Scenario: First message opens the new chat

- **WHEN** the owner types a message and sends it on the project page
- **THEN** `createProjectConversation` is called, and the router is at `/projects/chat/{bucket}/{projectPath}/conversations/{name}`, where the reply streams

#### Scenario: Shared project shows chats without the input

- **WHEN** a shared project with two conversations is opened
- **THEN** the Chats list shows both without row menus, and no chat input renders

#### Scenario: Rename from the list

- **WHEN** the owner renames a row to `Login article`
- **THEN** `renameProjectConversation` is called with `newTitle: 'Login article'`, and the row shows the new title

### Requirement: Project conversation strings flow through react-i18next

New strings SHALL be added to `apps/chat/src/i18n/locales/en.json` and to `ProjectsI18nKeys` (`apps/chat/src/constants/translation-keys.ts`), resolved in `useProjectConversationListLabels` (`apps/chat/src/hooks/projects/useProjectConversationListLabels.ts`), which memoises on `t`:

- `projects.view.mainContent` ("Project chats");
- `projects.chats.title` ("Chats");
- `projects.chats.empty` ("No outputs or chats yet");
- `projects.chats.emptyDescription` ("Your outputs and chats will appear here once started.");
- `projects.chats.loading`, `projects.chats.error`;
- `projects.chats.openLabel` ("{{title}}, by {{author}}") and `projects.chats.openLabelNoAuthor` ("{{title}}");
- `projects.chats.moreActions` ("More actions for {{title}}");
- `projects.chats.renameTitle`, `projects.chats.renameInputLabel`, `projects.chats.renameEmpty`, `projects.chats.renameSuccess`, `projects.chats.renameError`;
- `projects.chats.deleteConfirmTitle`, `projects.chats.deleteConfirmDescription`, `projects.chats.deleteSuccess`, `projects.chats.deleteError`;
- `projects.chats.createError`, `projects.chats.storageFull`;
- `projects.chat.backToProject` ("Back to {{name}}");
- `projects.chat.notFound`;
- `projects.publish.chatsWarning_one` / `_other`;
- `projects.actions.deleteConfirmWithChatsDescription_one` / `_other`.

The Rename, Delete, Save, Cancel, Retry and Show more labels reuse `buttons.rename`, `buttons.delete`, `buttons.save`, `buttons.cancel`, `buttons.retry` and `buttons.showMore`. The lib never imports i18n.

#### Scenario: Labels come from the projects namespace

- **WHEN** `ProjectConversationsSection` renders an empty project
- **THEN** the empty state shows the `projects.chats.empty` and `projects.chats.emptyDescription` translations

### Requirement: Project chats are mobile-first, RTL-safe and meet WCAG 2.1 AAA

The project chat surfaces (`ProjectConversationsSection`, `ProjectConversationList`, `ProjectChatPage`) SHALL meet the following:

- **Mobile.** The main column stacks above the Details panel. List rows are full width, and titles truncate, so there is no horizontal scroll. The input keeps the composer's mobile behaviour.
- **RTL.** Only logical properties are used (`ms-*`, `ps-*`, `text-start`, `border-s`). The breadcrumb back arrow mirrors with `rtl:scale-x-[-1]`. The ⋮ icon is symmetric and is not mirrored.
- **a11y.**
  - The Chats section is named by its heading.
  - Rows are buttons with accessible names that include the author.
  - Avatars are `aria-hidden`.
  - Every Tabler icon uses `stroke={DIAL_KIT_ICON_STROKE}`.
  - The row menu is keyboard-operable.
  - The rename and delete dialogs are labelled, focus moves into them and returns to the row's ⋮ trigger on close. After a delete, whose row is gone, focus moves to the row now in its place, the one before it, or the list.
  - The embedded composer is not a landmark of its own: it carries no `Welcome screen` region inside the Chats column.
  - Loading, error and create/rename/delete outcomes are announced through a `role="status"` region or toasts.
  - Text fallbacks resolve to at least 7:1 contrast.
- **Flag.** Everything here is behind `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`). No `ENABLED_FEATURES` role key applies.
- **Observability.** There are no new analytics events. The existing toasts (`notifyOperationSuccess` / `showErrorNotification`) report outcomes, and the BFF logs (see the `project-conversations-api` capability) carry counts only.

#### Scenario: No horizontal scroll on mobile

- **WHEN** the project view with a 200-character chat title renders at 360px width
- **THEN** the document has no horizontal scroll, and the title is truncated with its full text in a tooltip

#### Scenario: Focus after a delete

- **WHEN** the owner deletes the first of two rows
- **THEN** focus moves to the row that is now first

#### Scenario: Delete dialog returns focus

- **WHEN** the user cancels the delete dialog opened from a row's ⋮ menu
- **THEN** focus returns to that row's ⋮ trigger
