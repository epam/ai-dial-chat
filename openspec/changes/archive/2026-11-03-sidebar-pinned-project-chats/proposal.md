## Why

A user who pinned a project wants to open its chats from anywhere, as they do with pinned regular chats. Today a pinned project is visible only on the Projects page (`pinnedProjectIds` in `apps/chat/src/context/UserConfigContext.tsx:28`), and reaching one of its chats takes two page loads: the project view, then the chat (issue #9689, a follow-up to #9621 and #9681).

## What Changes

**1. Pinned projects in the sidebar's Pinned section**

- Behind `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`, `PROJECTS_ENABLED_ROLES`), the sidebar's Pinned section lists each pinned project before the pinned chats, in `pinnedProjectIds` order.
- A project row has the project icon, the truncated name, and a ⋮ menu. The menu has Unpin for every caller. When `canEdit` is true it adds Edit, Publish, Share and Delete, matching `ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx:252`).
- Under the project row come its chats, newest first, at most **10**. They are indented, with a vertical guide line on the inline-start side. Each chat row has the status point (outline when read, filled when unread) and the truncated title, like the other sidebar rows.
- When the project has **more than 10** chats, a **See all** row with its own ⋮ follows. It opens the project view page, whose Chats list already pages with See more. This differs from the issue's "up to 5", as the user requested.
- A project with no chats shows only its row.
- Activating a chat marks it read at once and opens `ProjectChatPage` (`getProjectConversationRoute`). The open chat is highlighted (`aria-current="page"`) in the tree.
- The project rows cannot be collapsed. Collapsing the Pinned section hides them with the rest of the section.
- **Search:** while a query is typed, a project stays in the tree when its name matches, with all its listed chats. Otherwise it stays when at least one of its listed chats matches, and only the matching chats are shown. Matches are highlighted with the kit `Highlight`. The Origin filter keeps a project when its source maps to the active tab (Personal → My chats, Shared → Shared, Organization → Organization). The Type filter `Task` hides every project.

**2. Live updates through one subscription, as on the Projects page**

- One `POST /api/v1/projects/watch` stream follows every pinned project. This is the model of `useProjects` (`libs/chat-hooks/src/project/use-projects.ts:121`), which follows every listed project with one stream. It reuses the shared reconnect helper `runProjectWatch` (`libs/chat-hooks/src/project/project-watch-stream.ts`). The BFF endpoint does not change.
- An `UPDATE` whose `etag` differs from the project's loaded `etag` triggers a silent, coalesced refresh of that project's details and chat list. A new, renamed, deleted or newly answered chat then updates without a reload.
- A `DELETE` removes the project from the tree, and the host drops the pin (`replacePinnedProjectId(id, null)`).
- A dropped stream reconnects with backoff and refreshes every pinned project once. A watch that cannot be opened is not retried during the visit, and the tree keeps working without live updates.
- Unread state comes from `isUnread` of `GET /api/v1/projects/:id/conversations`, so it matches the project view page. A viewed mark recorded by `ProjectChatPage` or `ProjectViewPage` clears the dot in the tree too.

**3. Panel spacing from the design**

The Figma frame "Chat - Project - See all" (file `ao2NXcmfF23QrZigbiHC8M`, node `17:14375`) keeps the panel's outer grid. That grid is a 16px panel gutter, the 8px gap under the "Chats and tasks" header, 8px vertical padding per section, 24px section headers, 32px rows with a 2px gap, and a footer of `px-4 py-3`. The current code already matches all of it.

One thing changed: an `Indicator` row now has **8px inline padding on both sides**, so its status point lines up under the section label. Today's rows have `ps-0` and, without actions, `pe-3`. Every sidebar row (regular chats, project rows, nested chats, See all) takes the new padding.

Nested rows sit 28px in from the list's inline start. The guide line runs 20px from the inline start, at the centre of the project icon. It is inset 5px at both ends, from the first nested row to the See all row (or to the last chat when there is no See all).

**4. Code layout**

- `libs/chat-hooks` gets a new headless hook, `usePinnedProjectChats`. It loads, trims, watches and refreshes the pinned projects' trees through the injected `ProjectsApiClient`.
- `libs/conversation-panel` renders the project, nested chat and See all rows from props. It has no knowledge of projects as a DIAL concept.
- `apps/chat` adapts the hook. It owns the routes, the pin store, the menu actions and their overlays (`ProjectShareOverlay`, `PublishProjectPanelContainer`, the delete confirmation), and the strings.

## Capabilities

### New Capabilities

- `sidebar-pinned-project-chats`: `usePinnedProjectChats` (loading, the 10-chat cap and `hasMore`, title resolution, the single watch, coalesced refresh, delete, viewed marks) and the app adapter (gating, ordering, routes, active chat, the ⋮ actions and their overlays, search and filter rules, strings).

### Modified Capabilities

- `conversation-history-panel`: `ConversationList` and `ConversationListSection` accept `pinnedProjects` and render project, nested chat and See all rows inside the Pinned section. This covers the guide line, the a11y levels, search and filter rules, and drag-and-drop exclusions. `Indicator` rows also take the design's 8px inline padding. `ConversationPanel` (the `Avatar` panel) is unchanged.
- `project-conversation-read-state`: the serialized viewed writer in `apps/chat/src/hooks/projects/projects-client.ts` notifies app listeners after each successful write. The sidebar then clears a dot that `ProjectChatPage` or the project view's Chats list recorded. The issue names `project-conversations-ui` for this, but the queue requirement lives in `project-conversation-read-state`, so that is the spec that changes.

## Non-goals

- Collapsing a single project row, or persisting any per-project expanded state.
- Showing unpinned projects, or their chats, in the sidebar.
- Searching chats beyond the 10 listed per project. See all and the project view page cover the rest.
- Drag-and-drop of project rows or nested chats, or moving a chat into or out of a project.
- Actions on nested chat rows (rename, delete, share). Those stay on the project view page.
- Any BFF or OpenAPI change.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. One watch for all pinned projects (chosen)** | Same shape as `useProjects` on the Projects page: one DIAL Core subscription per tab for the whole tree, one reconnect loop, and per-project coalescing. Changing the pins reopens the stream, which is rare. |
| B. One `useProjectWatch` per pinned project | Rejected. N streams and N reconnect loops per tab, and hooks cannot be called in a loop, so it would need a component per project. |
| C. Reload on focus or on an interval | Rejected. It is not live, the issue requires live updates, and it repeats requests while nothing changes. |
| Data: `listProjects` once instead of `getProject` per pin | Rejected. `ProjectDto` has no `etag` to skip a stale event, and no `contentVersion` that Delete must send. Pins are user-chosen and few, so one details read and one listing per pin is acceptable. |
| Rendering: a separate project tree above the virtual list | Rejected. It would scroll apart from the Pinned header and break the single virtualized list and its keyboard order. The rows become new kinds of `VirtualRow` instead. |
| Reuse `useProjectConversations` per project | Rejected. It is a one-project hook that pages by 20 and owns rename and delete. The sidebar needs N projects, 10 rows and no mutations. The `toRows` viewed-mark rule is extracted and shared instead. |

## Acceptance criteria

- With projects enabled, a pinned project shows in the Pinned section with up to 10 of its newest chats nested under it. The rows have the guide line, status points and truncated titles, as in the design. With the flag off, nothing changes and no project request is sent.
- See all appears only when a project has more than 10 chats, and it opens the project view page.
- Activating a chat opens `ProjectChatPage` and highlights the row. An unread chat loses its dot at once. Read and unread state matches the project view page after a reload.
- The project row's ⋮ offers Unpin for everyone, plus Edit, Publish, Share and Delete when `canEdit` is true. Each action behaves as on the project view page.
- A new, renamed, deleted or newly answered chat, a project rename, and a project delete update the tree without a reload. A burst of events causes at most one refresh in flight per project, plus one trailing refresh.
- A search filters the nested chats as described and highlights matches. The Origin and Type filters treat the tree as described.
- Sidebar rows have the design's 8px inline padding. Nested rows are indented 28px. The guide line sits at 20px with 5px end insets.
- Keyboard users reach every project, chat and See all row and their ⋮ menus in reading order. Screen readers hear the nesting level and position (`aria-level`, `aria-posinset`, `aria-setsize`). The guide line and indentation mirror in RTL through logical properties.
- Unit tests cover the hook (load, cap, `hasMore`, titles, watch events, coalescing, delete, unavailable watch, viewed marks) and the new lib rows. App tests cover gating, actions and navigation.
- The `conversation-history-panel` and `project-conversation-read-state` specs and the READMEs of `libs/conversation-panel` and `libs/chat-hooks` are updated. `npm run validate:docs` and `npm run validate:specs` pass.

## Impact

- **Shared libs (scope flag):**
  - `libs/chat-hooks` (`src/project/`): new `usePinnedProjectChats` and its model types, exported from the `@epam/ai-dial-chat-hooks/project` entry point. The viewed-mark rule is extracted from `use-project-conversations.ts` into a shared internal helper.
  - `libs/conversation-panel`:
    - new `VirtualRowKind` members, a `PinnedProjectGroup` model, and props on `ConversationList` and `ConversationListSection`;
    - new `*Labels` fields (`seeAllLabel`, `seeAllAriaLabel`) and a `projectGuideLine` color;
    - project and See all rows reuse `itemTitleClassName` and `textSecondary`;
    - the `Indicator` row padding.
  - Host knowledge stays out of both libs. Requests go through the injected client. Routes arrive as `href` values and `onSelect*` callbacks. Pins and deletes are handled by host callbacks, and strings arrive through `*Labels`.
- **App (`apps/chat`):**
  - A new `usePinnedProjectsPanel` adapter in `hooks/projects/`, used by `ConversationPanelView`.
  - The actions' overlays are mounted beside the panel's existing overlays.
  - `useProjectActions` gains an option to stay on the current page after a delete.
  - `projects-client.ts` gains the viewed-write listener.
- **i18n:** two new keys:
  - `conversationPanel.seeAll` ("See all").
  - `conversationPanel.seeAllProjectChats` ("See all chats in {{name}}"), the accessible name of a See all row. It starts with the visible text and names the project (WCAG 2.4.9 and 2.5.3).
  - The menu items reuse `ButtonsI18nKeys.Unpin`, `Edit`, `Publish`, `Share` and `Delete`, and their trigger reuses `ButtonsI18nKeys.MoreActions`.
- **BFF / OpenAPI:** none.
- **Flags:** everything is gated by `FeatureKey.ProjectsEnabled`. No new flag.
- **Rollback / compatibility:** nothing is breaking. Every new lib prop is optional, and a host that passes no `pinnedProjects` renders exactly as today. To revert, revert the change. No stored data changes.
