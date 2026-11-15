# Proposal

## Why

Since #9689 a pinned project lists its newest chats under its row in the sidebar's Pinned section, up to ten of them plus **See all**. A user with a few pinned projects scrolls past dozens of nested rows to reach **My chats** and **Organization**. Issue #9753 asks for a chevron on the project row that collapses and expands the project, with the state surviving a reload.

## Problem

- The nested rows of a pinned project are always visible, so projects the user is not working on push every section below them out of view.
- There is no way to hide them.

## Solution

- The project row gets a chevron toggle. Collapsed, the project shows only its row (name and ⋮); the nested chats, the guide line and **See all** are removed from the virtual list, so the sections below move up.
- `libs/conversation-panel` takes the state and an `onToggleProject` callback through props and stores nothing. `apps/chat` owns the state and keeps the **collapsed** project ids in `localStorage`, the same way it keeps the sidebar's own expanded state and the publish destination folders.
- Opening a chat of a collapsed project, and searching for a chat inside one, expand it **temporarily**. Only a click on the chevron writes to storage.
- A collapsed project that holds unread chats shows the unread dot on its row. This is not in the issue; it is added because a collapse would otherwise hide the only signal that a project has something new.

## What Changes

- `libs/conversation-panel`: `PinnedProjectGroup.isExpanded?` and `PinnedProjects.onToggleProject?`; a chevron toggle in `ProjectRow` (`aria-expanded`, `aria-controls` the list id, label from `ConversationListLabels`); `buildProjectRows` drops the nested rows of a collapsed project; a search-driven override and an unread dot on a collapsed row; README.
- `apps/chat`: `usePinnedProjectsPanel` owns the collapsed ids (`StorageKey.CollapsedPinnedProjects`) and the temporary reveal, prunes ids that are no longer pinned, and passes `isExpanded` and `onToggleProject`; two new strings in `ConversationPanelI18nKeys` and `en.json`, the only locale file.
- Specs and docs: `conversation-history-panel`, `sidebar-pinned-project-chats`, the `libs/conversation-panel` README.
- With `onToggleProject` absent the lib renders as before: no chevron, every project expanded.

## Non-goals

- Persisting the state in DIAL Core or the user config, or syncing it between devices.
- Persisting the collapse state of the **My chats** and **Organization** sections, which stays in memory as today.
- Changing the Pinned header, the ⋮ actions, the 10-chat limit or the **See all** row.
- Enlarging the chevron's hit area. It is the same 24px target as the row's ⋮ trigger; rows are fixed-height virtual rows and no neighbouring control in the panel has a larger one.
- A new feature flag, a new context, a BFF or OpenAPI change.

## Acceptance criteria

- The chevron collapses and expands a pinned project; clicking it neither navigates nor changes the active chat.
- The ⋮ menu works in both states; hover states match the design.
- The state survives a reload; a project the user has not touched is expanded.
- Opening a chat of a collapsed project, or a search that matches one of its chats, shows the chat without writing to storage.
- The toggle is a keyboard-operable button with `aria-expanded`, `aria-controls` and a translated label; in RTL the chevron is mirrored.
- Specs and the README describe the behaviour; `npm run validate:specs` and `npm run validate:docs` pass.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| In-memory state only | Rejected: the issue requires the state to survive a reload. |
| User config in DIAL Core (as pins) | Rejected: no Core change for a per-device UI preference. Every UI preference in the repo is in `localStorage`; the user config holds pins, installs and the selected deployment. |
| URL parameter | Rejected: the state is per user, not per page. |
| `localStorage`, **collapsed** ids (chosen) | A project with no entry is expanded, so a newly pinned project needs no write and a stale id is harmless. |
| `localStorage`, **expanded** ids | Rejected: every pin would need a write to be expanded by default. |

## Closest existing code

- `apps/chat/src/hooks/conversation-panel/useConversationPanelRouteState.ts`: the sidebar's own expanded flag in `localStorage` through `useLocalStorage`, with the lib receiving only `isCollapsed` and `onToggleCollapse` (spec `navigation-sidebar`).
- `apps/chat/src/hooks/publish/usePublishFolders.ts`: a stored `string[]` kept at the app edge for a lib hook that never touches storage.
- `libs/conversation-panel/src/components/ConversationGroupHeader/ConversationGroupHeader.tsx`: `aria-expanded` and `aria-controls={listId}` on a toggle of the virtualized list.

## Library isolation

The lib receives `isExpanded` and `onToggleProject` and renders; it never reads storage, the route, the user config or the language. The storage key, the persistence, the pruning and the reveal on the active chat stay in `usePinnedProjectsPanel` and `StorageKey`, at the app edge.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-history-panel`: the Pinned section's project rows collapse and expand; the new props, the chevron, the search override and the unread dot.
- `sidebar-pinned-project-chats`: the app owns and persists the collapsed ids, reveals the project of the opened chat, prunes stale ids; two new strings.

`project-conversations-ui` is named in the issue but is not modified: it specifies the project view page and `libs/projects`, not the sidebar tree.

## Impact

- `libs/conversation-panel` (`models/pinned-projects.ts`, `models/conversation-list.ts`, `utils/conversation-row.ts`, `ProjectRow`, `RowRenderer`, `ConversationList`, README).
- `apps/chat` (`usePinnedProjectsPanel`, `types/storage-key.ts`, `translation-keys.ts`, locale files).
- i18n: two new user-visible strings (`Expand project`, `Collapse project`).
- Rollback and compatibility: additive and not breaking. Reverting the change leaves an unused `collapsedPinnedProjects` entry in `localStorage`, which nothing reads.
