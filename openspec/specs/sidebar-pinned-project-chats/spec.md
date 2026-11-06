# sidebar-pinned-project-chats Specification

## Purpose

Pinned projects in the navigation sidebar's Pinned section: `usePinnedProjectChats` in `libs/chat-hooks` (loading each pinned project's newest chats through the injected client, one watch stream for every pin, coalesced per-project refresh, delete handling and viewed marks) and the `apps/chat` adapter `usePinnedProjectsPanel` with its routes, active chat, ⋮ actions and overlays, gated by `projectsEnabled`.

## Requirements

### Requirement: usePinnedProjectChats loads each pinned project's newest chats through the injected client

`libs/chat-hooks` SHALL export `usePinnedProjectChats`, `PINNED_PROJECT_CHATS_LIMIT` (`10`) and the types below from the `@epam/ai-dial-chat-hooks/project` entry point (`libs/chat-hooks/src/project/use-pinned-project-chats.ts`):

```ts
usePinnedProjectChats(
  client: Pick<
    ProjectsApiClient,
    | 'getProject'
    | 'listProjectConversations'
    | 'getProjectConversationTitles'
    | 'watchProjects'
  >,
  projectIds: string[],
  options: PinnedProjectChatsOptions,
): PinnedProjectChatsResult;

interface PinnedProjectChatsOptions {
  /** No request is sent and `projects` is empty while `false`. */
  enabled: boolean;
  /** The project no longer exists (a watch `DELETE`, or `404` on a read). Called at most once per id. */
  onProjectDeleted: (projectId: string) => void;
}

interface PinnedProjectChats {
  /** The project's details as last read; `canEdit`, `contentVersion` and `conversationCount` feed the host's actions. */
  project: ProjectDetailsDto;
  /** At most `PINNED_PROJECT_CHATS_LIMIT` chats, newest first. */
  chats: PinnedProjectChat[];
  /** The project has more chats than `chats` holds. */
  hasMore: boolean;
}

interface PinnedProjectChat {
  id: string;
  title: string;
  isUnread?: boolean;
}

interface PinnedProjectChatsResult {
  /** Loaded projects, in `projectIds` order; an id that failed to load is absent. */
  projects: PinnedProjectChats[];
  /** True until every id of the current `projectIds` settled once. */
  isLoading: boolean;
  /** Clears a chat's unread state locally until a read reports a newer version. Sends no request. */
  markViewed: (conversationId: string) => void;
  /** Silently re-reads one loaded project, through the same per-project gate as a watch event. */
  refresh: (projectId: string) => void;
}
```

For every id in `projectIds`, the hook SHALL:

- call `client.getProject(id, signal)` and `client.listProjectConversations(id, signal)` in parallel;
- keep the first `PINNED_PROJECT_CHATS_LIMIT` listing items, in listing order (newest first), and set `hasMore` when the listing has more items;
- when any kept item has `isTitlePending`, call `client.getProjectConversationTitles(id, names)` once with the kept pending names. If that call fails, the file-name titles stay.

The hook SHALL also follow these rules:

- A `404` from `getProject` SHALL drop the project and call `onProjectDeleted(id)`. Any other `getProject` failure on the first load keeps the project out of `projects` and retries the load after 1, 2, 4, 8 and 16 seconds, then gives up. No error is surfaced, and removing the id cancels a pending retry.
- A failed listing keeps the project row with `chats: []` and `hasMore: false`.
- Adding an id loads only that id, and removing an id drops it without a request. Reordering the ids re-sorts `projects` without a request.
- Every request is aborted on unmount, when `enabled` turns `false`, and for an id that leaves `projectIds`.
- The hook never constructs a client, reads a route or a pin store, shows a toast, or navigates.

**Owner of the state:** `usePinnedProjectChats` holds the per-project snapshots and the viewed marks. `apps/chat` derives the lib props from them and owns nothing else.

#### Scenario: A project with twelve chats

- **WHEN** a pinned project's listing has 12 items
- **THEN** `chats` holds the first 10 in listing order, and `hasMore` is `true`

#### Scenario: A project with exactly ten chats

- **WHEN** the listing has 10 items
- **THEN** `chats` holds all 10, and `hasMore` is `false`

#### Scenario: Pending titles are resolved for the kept rows only

- **WHEN** the 3rd and the 12th listing items have `isTitlePending: true`
- **THEN** `getProjectConversationTitles` is called once with the 3rd item's name only

#### Scenario: A pin of a project that no longer exists

- **WHEN** `getProject` for a pinned id answers `404`
- **THEN** that project is absent from `projects`, and `onProjectDeleted` is called once with its id

#### Scenario: A first load that fails for another reason

- **WHEN** the first `getProject` for a pinned id answers `500`, and the retry a second later succeeds
- **THEN** the project is absent from `projects` until the retry, then present, and `onProjectDeleted` is not called

#### Scenario: Disabled

- **WHEN** `enabled` is `false`
- **THEN** no request is sent, `projects` is empty, and `isLoading` is `false`

### Requirement: One watch stream follows every pinned project and refreshes the changed one

When `client.watchProjects` is defined, `enabled` is `true` and the first load of the current id set has settled, `usePinnedProjectChats` SHALL open **one** watch through `runProjectWatch` (`libs/chat-hooks/src/project/project-watch-stream.ts`). The watch covers the sorted ids of the **loaded** projects of `projectIds`, capped at the 1000 ids the BFF accepts. An id whose load failed stays out of the watch, because the BFF rejects the whole watch when one project is not readable; it joins the watch once a retry loads it. This is the model `useProjects` (`libs/chat-hooks/src/project/use-projects.ts`) uses for the Projects page.

- An `UPDATE` or `CREATE` for a loaded project whose `etag` differs from `project.etag` SHALL run a silent refresh of that project. The refresh re-reads the details, the listing and the kept pending titles. An event without `etag` is never skipped. An event for an id that is not loaded is ignored.
- Refreshes SHALL be coalesced **per project**. At most one runs per project at a time. Events during a run set one pending flag, and one trailing refresh runs after it. A refresh shows no loading state, keeps the previous snapshot on failure, and handles a `404` as a delete.
- A `DELETE` SHALL drop the project, cancel its pending refresh, call `onProjectDeleted(id)`, and reopen the stream without it.
- After a successful reconnect, every loaded project SHALL be refreshed once, through the same per-project gate.
- When the first open fails, or the reconnect delays run out, the watch SHALL be marked unavailable for that id set. No retry follows for the same set and no error is surfaced, and the tree keeps its loaded data. A different id set tries the watch once again.
- A change of the id set SHALL close the stream and open one for the new set. A new `onProjectDeleted` identity SHALL NOT reopen it.

#### Scenario: A new answer in a pinned project

- **GIVEN** the tree shows project P with `etag: '"a1"'`
- **WHEN** an `UPDATE` for P with `etag: '"b2"'` arrives
- **THEN** `getProject` and `listProjectConversations` are called once more for P only, and the refreshed chats replace P's rows without a loading state

#### Scenario: An event for the loaded version

- **WHEN** an `UPDATE` for P carries P's loaded `etag`
- **THEN** no request is sent

#### Scenario: A burst of events

- **WHEN** five `UPDATE` events with distinct etags for P arrive during one refresh of P
- **THEN** exactly one more refresh of P starts after it settles

#### Scenario: Deleted elsewhere

- **WHEN** a `DELETE` for P arrives
- **THEN** P leaves `projects`, and `onProjectDeleted` is called once with P's id

#### Scenario: A Core without project events

- **WHEN** the first `watchProjects` call rejects
- **THEN** no retry is scheduled, and the loaded tree stays

#### Scenario: An unreadable pin does not stop the watch

- **GIVEN** projects P and Q are pinned, and `getProject` for Q answers `403`
- **WHEN** the first load settles
- **THEN** one stream opens for P only, and P keeps receiving refreshes

#### Scenario: Pinning another project

- **WHEN** a project is added to `projectIds`
- **THEN** the old stream is aborted, the new project loads, and one stream for the new id set opens

### Requirement: A viewed mark keeps a chat read until a newer version is read

`markViewed(conversationId)` SHALL set `isUnread` to `false` on that chat at once and remember the `updatedAt` the chat had in the last listing. Any later listing SHALL keep the chat read until it reports an `updatedAt` newer than the remembered one. This is the rule `useProjectConversations` already applies (`libs/chat-hooks/src/project/use-project-conversations.ts`). It SHALL be moved into one internal helper that both hooks call, not copied.

#### Scenario: A refresh in flight does not bring the dot back

- **GIVEN** a refresh of P is in flight with a listing read before the mark
- **WHEN** the user marks chat C read, and the refresh then settles reporting C unread with the same `updatedAt`
- **THEN** C stays read

#### Scenario: A newer answer turns the chat unread again

- **WHEN** a later listing reports C unread with a newer `updatedAt`
- **THEN** C is unread

### Requirement: The app shows pinned projects in the sidebar's Pinned section

`apps/chat` SHALL adapt the hook in a new `usePinnedProjectsPanel` (`apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`), which `ConversationPanelView` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`) calls. It passes the result to `ConversationListSection` as the `pinnedProjects` prop (see the `conversation-history-panel` capability).

**The adapter**

- It calls `usePinnedProjectChats(projectsClient, pinnedProjectIds, { enabled, onProjectDeleted })`.
  - `projectsClient` comes from `apps/chat/src/hooks/projects/projects-client.ts`, and `pinnedProjectIds` from `useUserConfig()`.
  - `enabled` is `useFeatureFlag('projectsEnabled')` while the app config is ready.
  - `onProjectDeleted` calls `setPinnedProject(id, false)`, because the user config still holds the pin of a project someone else deleted. When that write fails it calls `replacePinnedProjectId(id, null)`, so the rolled-back pin cannot load and report the project again.
- It maps each snapshot to a `PinnedProjectGroup` (the source through `mapProjectSourceToFilterTab` from `@epam/ai-dial-chat-hooks/project`). The group carries:
  - `id` and `name`;
  - `href` from `getProjectViewRoute(id)`, and `source` mapped from the project source (`personal` → `FilterTab.MyChats`, `shared` → `FilterTab.Shared`, `organization` → `FilterTab.Organization`);
  - `hasMore`;
  - `conversations` as `ConversationItem`s, each with `href` from `getProjectConversationRoute(id)` and `isUnread`. `isUnread` is forced to `false` for the open chat.
- The open project chat comes from the `ProjectChat` route params through `parseProjectConversationRouteParams`, and it is passed as the list's `activeConversationId` while that route is open. On the project view and edit routes, the project id is passed as `activeProjectId`.

**Navigation**

Navigation goes through a new `onOpenRoute(path)` prop of `ConversationPanelView`. `apps/chat/src/app/app.tsx` supplies it: it closes the mobile drawer, as `handleSelectConversation` does, then navigates.

- Activating a project row opens `getProjectViewRoute(id)`.
- Activating a nested chat first calls the hook's `markViewed(id)`, then opens `getProjectConversationRoute(id)`.
- Activating See all opens `getProjectViewRoute(id)`.

**Live read state**

The adapter subscribes to the viewed-write listener of `projects-client.ts` (see the `project-conversation-read-state` capability) and calls `markViewed(id)` for every id it reports. A chat read on `ProjectChatPage` or in the project view's Chats list therefore loses its dot in the tree without a reload.

**Memoisation**

- The adapter SHALL return a `useMemo`'d `pinnedProjects` object whose identity changes only when its rows, the active project or a callback change.
- Its callbacks SHALL be `useCallback`s.
- `ConversationListSection` stays memoised, so an unrelated `ConversationPanelView` render does not re-render the list.

**Gating:** behind `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`, `PROJECTS_ENABLED_ROLES`). With the flag off, the adapter passes `undefined`, no project request is sent, and the panel renders no project rows.

#### Scenario: A pinned project appears before the pinned chats

- **GIVEN** projects are enabled, `pinnedProjectIds` is `[P]`, and one regular chat is pinned
- **WHEN** the sidebar renders
- **THEN** the Pinned section lists P's row, P's chats, and then the pinned regular chat

#### Scenario: Opening a nested chat

- **WHEN** the user activates an unread nested chat C of P
- **THEN** C loses its unread dot at once, the router is at `getProjectConversationRoute(C)`, and C's row has `aria-current="page"`

#### Scenario: See all

- **WHEN** the user activates P's See all row
- **THEN** the router is at `getProjectViewRoute(P)`

#### Scenario: Mobile drawer closes

- **GIVEN** a mobile viewport with the navigation drawer open
- **WHEN** the user activates a nested chat
- **THEN** the drawer closes and the chat opens

#### Scenario: A chat read on the project page

- **WHEN** `ProjectChatPage` records C viewed through the serialized writer
- **THEN** C's row in the tree shows as read without a reload

#### Scenario: Projects disabled

- **WHEN** `projectsEnabled` is off
- **THEN** no project row renders and no `getProject`, listing or watch request is sent

### Requirement: The project row's menu offers the caller's project actions

The adapter SHALL build `getActions` for project rows (the See all row is only a link and has no menu) with these entries, in this order:

| Item | Shown | Behaviour |
| --- | --- | --- |
| Unpin (`ButtonsI18nKeys.Unpin`) | always | `setPinnedProject(id, false)`. A rejection shows `ProjectsI18nKeys.ActionsUnpinError` through `showErrorNotification`. |
| Edit (`ButtonsI18nKeys.Edit`) | `project.canEdit` | opens `getProjectEditRoute(id)` through `onOpenRoute` |
| Publish (`ButtonsI18nKeys.Publish`) | `project.canManage` | opens `PublishProjectPanelContainer` for the project, returning focus to the row's ⋮ trigger on close |
| Share (`ButtonsI18nKeys.Share`) | `project.canManage` | opens `ProjectShareOverlay` for the project |
| Delete (`ButtonsI18nKeys.Delete`) | `project.canManage` | opens `ProjectDeleteConfirmation`, the side panel `ProjectViewPage` uses |

`project` is the snapshot's `ProjectDetailsDto` (`usePinnedProjectChats`). So:

- the owner (`canEdit` and `canManage`) gets every item;
- a recipient with edit access (`canEdit: true`, `canManage: false`) gets Unpin and Edit;
- a view-only recipient and an organization project (`canEdit: false`) get Unpin only.

**Overlays.** The overlays SHALL be rendered by a new app component `PinnedProjectActionOverlays` (`apps/chat/src/components/PinnedProjectActionOverlays/PinnedProjectActionOverlays.tsx`). It is mounted with `ConversationPanelView`'s other overlays, portalled out of the sidebar, and it holds at most one open action. Its own guard on the publish panel reads `project.canManage`, the flag the menu item uses.

**Delete.** The confirmed delete SHALL use the app's `useProjectActions` (`apps/chat/src/hooks/projects/useProjectActions.ts`) for the chosen project. That hook gains an optional `leaveOnDelete` option, default `true`:

- The sidebar passes `true` only while the current route is that project's view, edit or chat page.
- With `false`, the success toast is shown and the pin is dropped, but the route does not change.
- A `ProjectChanged` conflict shows `ProjectsI18nKeys.ErrorsChangedElsewhere` and refreshes that project in the tree.
- The sidebar owns the confirmation panel's open state: it passes `isDeleteOpen` (the Delete action is open) and `onDeleteOpenChange`, through which the shared `useProjectActions` reports a cancel, a success or a conflict, and each of them ends the action.

#### Scenario: Owner menu

- **WHEN** the owner opens the ⋮ of their own pinned project
- **THEN** Unpin, Edit, Publish, Share and Delete are offered, in that order

#### Scenario: Editor menu

- **WHEN** a recipient with edit access opens the ⋮ of a pinned shared project
- **THEN** Unpin and Edit are offered, in that order

#### Scenario: View-only shared project menu

- **WHEN** a view-only recipient opens the ⋮ of a pinned shared project
- **THEN** only Unpin is offered

#### Scenario: Unpin

- **WHEN** the user chooses Unpin
- **THEN** the project and its chats leave the Pinned section

#### Scenario: Delete from another page

- **GIVEN** the user is on a regular chat
- **WHEN** they delete a pinned project from its ⋮ and confirm
- **THEN** the success toast is shown, the project leaves the tree, and the route does not change

#### Scenario: Delete while on that project

- **GIVEN** the user is on the project's view page
- **WHEN** they delete it from the sidebar ⋮ and confirm
- **THEN** the router is at `/projects`

### Requirement: Pinned project strings flow through react-i18next

`apps/chat` SHALL add four keys to `apps/chat/src/i18n/locales/en.json`, the only locale file, plus the matching `ConversationPanelI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`:

| Key | Enum member | English |
| --- | --- | --- |
| `conversationPanel.seeAll` | `ConversationPanelI18nKeys.SeeAll` | `See all` |
| `conversationPanel.seeAllProjectChats` | `ConversationPanelI18nKeys.SeeAllProjectChats` | `See all chats in {{name}}` |
| `conversationPanel.expandProject` | `ConversationPanelI18nKeys.ExpandProject` | `Expand project` |
| `conversationPanel.collapseProject` | `ConversationPanelI18nKeys.CollapseProject` | `Collapse project` |

The adapter passes them as the list's `seeAllLabel`, `seeAllAriaLabel`, `expandProjectLabel` and `collapseProjectLabel`. Menu items reuse `ButtonsI18nKeys.Unpin`, `Edit`, `Publish`, `Share` and `Delete`. The ⋮ trigger reuses the existing `actionsLabel` (`ButtonsI18nKeys.MoreActions`). The unread dot reuses the panel's existing unread label. No other string is added.

#### Scenario: Translated See all

- **WHEN** the UI language is not English
- **THEN** the See all row shows `t(ConversationPanelI18nKeys.SeeAll)`, and its accessible name is `t(ConversationPanelI18nKeys.SeeAllProjectChats, { name })`

#### Scenario: Translated chevron label

- **WHEN** the UI language is not English
- **THEN** the chevron's accessible name is `t(ConversationPanelI18nKeys.CollapseProject)` while its project is expanded, and `t(ConversationPanelI18nKeys.ExpandProject)` while collapsed

### Requirement: The pinned project tree adds no flag, metric or cache

The tree SHALL follow these rules:

- **Gating:** `FeatureKey.ProjectsEnabled` only.
- **Telemetry:** no new metric or analytics event. The requests it sends are counted by the existing BFF `MetricsInterceptor`.
- **Caching:** no client-side cache. The snapshots live in the hook's state for the panel's lifetime. The BFF title cache, keyed by the conversation's `updatedAt`, is unchanged.
- **Backend:** no BFF or OpenAPI change.

#### Scenario: No BFF change

- **WHEN** `npm run openapi:check` runs on this change
- **THEN** it passes with no diff

### Requirement: The app owns, persists and prunes the collapsed state of pinned projects

`usePinnedProjectsPanel` (`apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`) SHALL own the collapse state of the pinned projects and pass each group's `isExpanded` and the tree's `onToggleProject` to the list (see the `conversation-history-panel` capability). `libs/chat-hooks` and `libs/conversation-panel` store nothing.

**What is stored.** The ids of the projects the user collapsed are stored as a JSON string array in `localStorage` under the new `StorageKey.CollapsedPinnedProjects` (`apps/chat/src/types/storage-key.ts`), through the app's `useLocalStorage` hook. A project with no entry is expanded, so a newly pinned project is expanded and needs no write. Storage that cannot be read or written SHALL fall back to in-memory state without an error. Only a click on the chevron writes it.

**Temporary expansion.** A project SHALL also show expanded, without any write to storage, when the app revealed it:

- when the open chat changes to a chat of a collapsed project (the project id comes from the `ProjectChat` route), the project is revealed once, so the highlighted chat is visible. The reveal holds one project: opening a chat of another project replaces it, and leaving the chat routes keeps it until the page reloads. The user can collapse it again afterwards, and the reveal does not repeat until the open chat changes;
- a search that matches a chat of the project, which the list derives itself.

**Toggling.** `onToggleProject(id)` flips what the user sees. Collapsing an expanded project (stored or revealed) adds the id to the stored ids and ends its reveal. Expanding a collapsed project removes the id from the stored ids. Toggling neither navigates nor changes the active chat.

**Pruning.** The app SHALL remove from the stored ids every id that is not in `pinnedProjectIds`, and write only when at least one id was removed. The pass runs only while `projectsEnabled` is on and the user config has finished loading, because `pinnedProjectIds` is empty before that and an early pass would erase every stored id. It compares with the pins, not with the projects that loaded, so a project whose read failed keeps its state.

**Memoisation:** the adapter's `pinnedProjects` keeps its identity until a row, an `isExpanded` value, the active project or a callback changes, and its callbacks are `useCallback`s. **Gating:** `FeatureKey.ProjectsEnabled` only, as for the tree. **RTL, telemetry, cache, backend:** none beyond the list's; no BFF or OpenAPI change.

#### Scenario: A collapse survives a reload

- **GIVEN** P is expanded
- **WHEN** the user collapses P and reloads the page
- **THEN** `collapsedPinnedProjects` holds P's id and P renders collapsed

#### Scenario: An untouched project is expanded

- **WHEN** the user pins P and nothing is stored for it
- **THEN** P renders expanded and nothing is written

#### Scenario: Opening a chat of a collapsed project

- **GIVEN** P is collapsed and the user opens a chat of P from the Chats list of its page
- **THEN** P renders expanded with the chat highlighted, and the stored ids are unchanged

#### Scenario: Collapsing the project of the open chat

- **GIVEN** P was revealed for the open chat
- **WHEN** the user activates P's chevron
- **THEN** P collapses, its id is stored, and it stays collapsed until the open chat changes

#### Scenario: A stale id is pruned

- **GIVEN** the stored ids are `[P, Q]` and only P is pinned
- **WHEN** the user config has loaded
- **THEN** the stored ids become `[P]`

#### Scenario: Nothing is pruned before the user config loads

- **GIVEN** the stored ids are `[P]` and the user config is still loading
- **THEN** the stored ids stay `[P]`

#### Scenario: Unavailable storage

- **WHEN** reading or writing `localStorage` throws and the user collapses P
- **THEN** P collapses for the page session and no error is shown
