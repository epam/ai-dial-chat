# Design

## Context

See `proposal.md` for the motivation. Today:

- `usePinnedProjectsPanel` (`apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`) maps each pinned project to a `PinnedProjectGroup` and passes `pinnedProjects` to the list. It already reads the open chat's route (`chatRoute.projectId`, `activeConversationId`) and `useUserConfig()`, which exposes `pinnedProjectIds` and a `status`.
- `ConversationList` (`libs/conversation-panel/src/components/ConversationList/ConversationList.tsx`) builds a flat virtual row list; `buildProjectRows` (`utils/conversation-row.ts`) emits the project row, one row per chat and a See all row. `ProjectRow` renders the icon, the name through `RowLink`, and the ⋮ menu.
- The list is virtualized and flat. There is no nested `<ul>`; the only element that contains the rows is the `role="list"` container whose `id` is `listId`.
- `ConversationList` and `ConversationListSection` own the search text; `filterPinnedProjects` keeps a project when its name matches (with all its chats) or when some chats match (with only those).
- The My chats and Organization sections collapse through `expandedGroups` in memory only. The sidebar's own expanded flag is the one persisted UI state in the panel, and it is persisted at the app edge (`navigation-sidebar`).

## Goals / Non-Goals

**Goals:**

- Give the lib a controlled, optional collapse API and keep every decision about storage, routing and the active chat in `apps/chat`.
- Keep the virtual list correct: a collapsed project contributes one row, and every later section moves up with no gap.

**Non-Goals:**

- Anything the proposal excludes. No change to `usePinnedProjectChats` or `libs/chat-hooks`: it already returns everything the adapter needs.

## Decisions

### 1. Controlled props on the existing group and tree types

`PinnedProjectGroup` gains `isExpanded?: boolean` (an absent value means expanded) and `PinnedProjects` gains `onToggleProject?: (projectId: string) => void`. The chevron renders only when `onToggleProject` is set, so a host that passes neither gets today's rendering.

Alternatives: a `collapsedProjectIds: ReadonlySet<string>` on `PinnedProjects` (one object for the host to keep stable, but the group no longer carries its own state and the lib needs a lookup per row); an uncontrolled lib state with an `onChange` (rejected: the issue says the app owns the state, and the app must also drive the temporary reveal).

### 2. Collapsing happens in `buildProjectRows`

`buildProjectRows(project, isExpanded)` returns only the `Project` row for a collapsed project, and `RowRenderer` passes the toggle state and `listId` to `ProjectRow`. Nothing else changes in the list: a fixed-height row model needs no height bookkeeping, and the scroll-to-active effect already runs on `virtualRows`, so a chat revealed later still scrolls into view.

Alternative: keep the rows and hide them with CSS. Rejected: the virtualized list would still allocate their height.

### 3. The search override lives in the lib; the stored state does not

The lib owns the query, so it computes the effective expansion: `isExpanded !== false`, or a non-empty `searchQuery` with at least one chat of the project matching. A project that matches only by name stays as the host has it. The override is derived on every render and never reported through `onToggleProject`.

Alternative: the host passes the query back down. Rejected: the app would have to duplicate the search state the panel owns.

### 4. The app stores **collapsed** ids and reveals temporarily

`usePinnedProjectsPanel` keeps:

- `collapsedIds`: `useLocalStorage<string[]>(StorageKey.CollapsedPinnedProjects, [])`, the single place a click writes to.
- `revealedIds`: a `Set` in memory that holds the project of the most recently opened chat, so the highlighted chat is visible. A later chat of another project replaces it; leaving the chat routes keeps it until the page reloads.

A project is shown expanded when it is not in `collapsedIds` or is in `revealedIds`. `onToggleProject(id)` flips what the user sees: from expanded it adds the id to `collapsedIds` and removes it from `revealedIds`; from collapsed it removes the id from `collapsedIds`. The reveal runs **once per change of the open chat**, for `chatRoute.projectId` (it replaces the previous reveal), so a user can still collapse the project of the open chat afterwards. It keys on the route's project id, not on membership in the 10 loaded chats, so it needs no wait for the load.

Reading and writing go through `useLocalStorage`, so unavailable storage degrades to in-memory state without an error, as for the sidebar's expanded flag.

Alternative: persist the reveal too, or reveal as a standing rule. Rejected: a standing rule would make the project of the open chat impossible to collapse, and persisting would let navigation overwrite the user's choice.

### 5. Stale ids are pruned against the pins, once the user config is ready

An effect intersects `collapsedIds` with `pinnedProjectIds` and writes only when something is removed. It runs only when `projectsEnabled` is on and `useUserConfig().status` is ready: before that, `pinnedProjectIds` is `[]` and the pass would erase every stored id. It compares with the pins, not with the loaded projects, because a project whose load failed is still pinned. This also catches an unpin on another device.

Alternatives: never prune (a re-pinned project returns collapsed, the list only grows); prune in `handleUnpin` and `handleProjectDeleted` only (misses other tabs and devices).

### 6. Chevron and row

- `ProjectRow` renders a separate `<button type="button">` before the name, outside the `RowLink` anchor, so a click on it cannot navigate or change the active chat.
- `aria-expanded`, `aria-controls={listId}` (the pattern of `ConversationGroupHeader`; a flat virtual list has no nested list to point at, so the container is the controlled region), `aria-label` from `ConversationListLabels.expandProjectLabel` / `collapseProjectLabel`.
- Icon: `IconChevronDown` when expanded, `IconChevronRight` when collapsed with `rtl:scale-x-[-1]`, `DIAL_KIT_ICON_STROKE`, `aria-hidden`.
- The button is a 24px box like the ⋮ trigger (`size-6`) with a round hover background. No larger hit area: rows are fixed-height virtual rows, no control in the panel enlarges its target, and the design fixes the look.
- **Leading slot.** The project icon (briefcase) and the chevron share the row's 24px leading slot. At rest the slot shows the briefcase, expanded or collapsed. While the row is hovered, has focus within, or its menu is open, the slot shows the chevron in the project's state and the ⋮ trigger shows at the trailing end. Hovering the chevron itself adds its round background while the row keeps its highlight (the row highlight follows the `li`, because the chevron is a sibling of the row button). A pointer press on the chevron does not take focus, so `focus-within` does not keep the chevron and the ⋮ shown after the pointer leaves; the keyboard still reaches and reveals it. On `mobile` (the workspace's `max-width: 1279px` variant) the chevron is always shown in place of the briefcase, because Tailwind gates `hover` behind `@media (hover: hover)` and a hidden button would still catch taps; the ⋮ trigger and the unread dot keep the panel's existing touch behaviour. The chevron button stays in the tab order while hidden and is revealed by focus within, exactly as the ⋮ trigger is (`opacity-0` with `group-hover` and `group-focus-within` on the row, no touch-specific fallback in the panel).
- Colors and typography follow the lib theming rules: new colors, if any, come through `ConversationListColors` and `buildCssVars`.

### 7. Unread dot on a collapsed project

`hasUnread` is derived in the lib from `project.conversations.some((c) => c.isUnread)` and drawn in the row's trailing slot, only while the project is collapsed, with the same dot, hidden label and hover/focus/open-menu hiding as an `Avatar` conversation row. `PinnedProjectGroup` and the adapter gain no field. It covers the 10 chats the sidebar loads: a project with an unread chat beyond them shows no dot.

### 8. Strings

Two `ConversationListLabels` fields (`expandProjectLabel`, `collapseProjectLabel`) with English defaults; `apps/chat` fills them from `ConversationPanelI18nKeys.ExpandProject` / `CollapseProject`. `en.json` is the only locale file. No new feature flag, telemetry or cache.

## Risks / Trade-offs

- [Search expands a project the user collapsed, and the chevron then appears to do nothing] → The click still flips the stored state; the project stays open while the query matches.
- [localStorage is per browser and not per user] → Accepted, as for the theme, panel widths and the sidebar flag. A shared browser shares the collapse state.
- [A collapsed project looks the same as an expanded one at rest, apart from its missing chats] → The design has no resting indicator; the unread dot is the only signal, and hovering shows the chevron.
- [Unread dot misses chats beyond the loaded ten] → Documented in the spec; the project page remains the full view.
- [The id list grows with unpinned projects until the next pass] → Bounded by the number of projects a user pins; pruned on the next load.
- [Re-pinning a project within a session keeps its collapsed state until the next prune] → Harmless: it returns as the user left it.

## Open Questions

None.
