## Context

- **Pins.** Pinned projects already exist. `UserConfigContext` (`apps/chat/src/context/UserConfigContext.tsx`) holds `pinnedProjectIds` and `setPinnedProject` / `replacePinnedProjectId`, and only the Projects page and the project view read them.
- **Sidebar list.** The sidebar's chat block is `ConversationListSection` (`libs/conversation-panel`). It is one `react-window` virtual list of flat `VirtualRow`s: group headers and conversation items, in `Indicator` variant. `ConversationPanelView` fills it from `ConversationsContext`.
- **Live updates.**
  - `useProjects` follows every listed project with one `POST /api/v1/projects/watch` stream.
  - `useProjectWatch` follows one project, through the shared `runProjectWatch` helper.
  - A project conversation write changes the project's aggregate `etag`, so a new answer is an `UPDATE`.
- **Read state.** Project read state (`isUnread` on the listing, `PATCH …/viewed`) comes from #9681. Marks go through one serialized queue, `projectViewedWriter` in `apps/chat/src/hooks/projects/projects-client.ts`.

The Figma frame "Chat - Project - See all" (`ao2NXcmfF23QrZigbiHC8M`, node `17:14375`) gives this layout:

| Element | Measure |
| --- | --- |
| Panel | 336px wide. The top section has `p-4 gap-4`, a 40px header, and nav items with `gap-1`, each `p-2` with a 24px icon. |
| Chats block | `pt-4 px-4`, with an 8px gap under the "Chats and tasks" header (`ps-2`, actions `gap-2`, 24px icon buttons). |
| Section | `py-2` and a 2px row gap. The 24px label has `px-2 py-1`. |
| Row | 32px high, `px-2`, 2px gap. A 24px icon slot holds the 16px point or briefcase. The title is 14/24 (`dial-small-text`) and the shape is a pill. |
| Nested row | x = 28, 276px wide. The guide line is at x = 20, from y + 5 of the first nested row to 5px above the See all row's bottom. |
| See all | Same row box, no icon, text in `text-secondary`. |
| Footer | `px-4 py-3`. |

All of this matches the code today, except that `Indicator` rows render `ps-0` and, without actions, `pe-3` (`libs/conversation-panel/src/components/ConversationRow/ConversationRow.tsx`, `getButtonPaddingEnd` in `libs/conversation-panel/src/utils/conversation-row.ts`). The design moves the point 8px in.

The design shows 10 nested chats and a See all row, which matches the user's decision: see all only above 10 chats.

## Goals / Non-Goals

**Goals:**

- Show every pinned project with up to 10 newest chats and a See all row in the Pinned section, live.
- Keep `libs/conversation-panel` free of project knowledge, and keep the DIAL-Core-backed loading in `libs/chat-hooks`.
- Match the design's spacing, including the new 8px row padding.

**Non-Goals:**

- Collapsing a single project, showing unpinned projects, row actions on nested chats, and drag-and-drop for project rows.
- Any BFF, OpenAPI or storage change.
- A real ARIA tree widget with roving focus (see D4).

## Decisions

### D1. One multi-project hook in `libs/chat-hooks`, not N `useProjectConversations`

`usePinnedProjectChats(client, projectIds, options)` holds a `Map<projectId, Snapshot>`. A snapshot is the details, the kept rows, `hasMore`, a per-project `AbortController`, and a coalescing flag pair. Each id loads `getProject` and `listProjectConversations` in parallel, then resolves pending titles for the 10 kept rows.

- **Why details per pin.** `ProjectDetailsDto` carries `etag` (to skip stale events), `canEdit` (the menu), `contentVersion` (Delete's `If-Match`) and `conversationCount` (the delete copy).
- **Why not `listProjects` once.** `ProjectDto` has none of these. Pins are few and user-chosen, so 2–3 requests per pin on load is acceptable.
- **Why not `useProjectConversations` per project.** It pages by 20, owns rename and delete, and is a one-project hook that cannot be called in a loop.
- **Shared read rule.** The viewed-mark rule (`toRows` in `use-project-conversations.ts`) becomes an internal `libs/chat-hooks/src/project/project-viewed-marks.ts`, shared by both hooks.

Fetches run in effects with an `AbortController` per project, and a settled request whose signal was aborted sets no state. The id-set effect diffs the previous ids: it loads the added ones, and aborts and drops the removed ones.

### D2. One watch for the whole tree, as on the Projects page (user decision)

The hook opens one `runProjectWatch` over the sorted ids, keyed by a joined string so a reorder does not reopen it. It opens after the first load of that set settles, so every event can be checked against a loaded `etag`. This is the `useProjects` approach with `useProjectWatch`'s etag skip, applied per project.

- **Refresh gate.** Each project has an `inFlight` / `pending` pair, so a burst on one project never blocks another.
- **Reconnect.** A reconnect refreshes every project through its gate.
- **Unavailable watch.** A ref records it for the hook's lifetime.

| Alternative | Verdict |
| --- | --- |
| One `useProjectWatch` per project | Rejected. N streams per tab, and a component per project. |
| Reuse the Projects page `useProjects` state | Rejected. It is mounted only on that page, and its items lack chats. |
| Polling | Rejected. Not live, and wasteful while idle. |

The project view page keeps its own `useProjectWatch`, so a tab on a pinned project's view has two streams. Each is one DIAL Core subscription. That is acceptable and keeps the two features independent.

### D3. Lib rendering: new `VirtualRow` kinds inside the Pinned group

`ConversationList` builds the Pinned group's rows from `pinnedProjects` first, then the pinned items. For each visible project it emits a `Project` row, then `ProjectConversation` rows and an optional `ProjectSeeAll` row. Each nested row carries `projectId`, `posInSet`, `setSize`, and `isFirstNested` / `isLastNested` for the guide-line insets.

- `RowRenderer` dispatches the new kinds to a new `ProjectRow` component and to `ConversationRow` with a `nested` presentation (indent, guide line, no actions, no drag). It also dispatches to a new `ProjectSeeAllRow`.
- `getRowHeight` returns `INDICATOR_ITEM_ROW_HEIGHT` for all three.
- Search and filter rules live in a pure helper in `libs/conversation-panel/src/utils/conversation-filter.ts`, next to the existing `matchesTab` / `matchesSearch`, with unit tests.
- **Guide line.** Each nested row draws its own segment with a `::before` on its row wrapper, so it stays continuous across virtualized rows. The rule is `inset-inline-start: 20px`, width 1px, `top: 0` / `bottom: -2px` to span the 2px gap. The first row uses `top: 5px` and the last uses `bottom: 5px`.
- **Theming.** The color is `--cp-project-guide-line`, set with `buildCssVars` from `ConversationListColors.projectGuideLine`. The styles go in a new `ProjectRow.module.scss`. The lib already ships `./styles.css`, so the manifest does not change.

A tree rendered outside the virtual list was rejected: it would scroll separately from the Pinned header and break the single tab order.

### D4. Accessibility: levelled list items, not `role="tree"`

`role="tree"` requires roving tabindex, arrow-key navigation, and `aria-expanded` on parents. The whole list today is links in tab order, so converting it would change every row's keyboard model and break existing tests.

ARIA 1.2 allows `aria-level`, `aria-posinset` and `aria-setsize` on `listitem`, so the flat virtual list exposes the nesting while keeping today's keyboard model. Project rows get level 1. Nested and See all rows get level 2 with position and set size, which the virtual list could otherwise not convey.

See all's accessible name includes the project name, which meets WCAG 2.4.9 (link purpose, AAA) and keeps the visible text first (2.5.3).

### D5. Padding change applies to every `Indicator` row

The design's `px-2` is not specific to projects: regular sidebar chats have it too. `Indicator` rows move from `ps-0` to `ps-2`, and from `pe-3` to `pe-2` when they have no actions. `getButtonPaddingEnd` gains the variant, and `Avatar` rows keep `pe-3`. Only `ConversationListSection` renders `Indicator` rows, so `ConversationPanel` is untouched.

### D6. App adapter, actions and overlays

- **Adapter.** `usePinnedProjectsPanel` maps snapshots to `PinnedProjectGroup`s, reads the route for the active chat and project, and supplies the callbacks.
- **Navigation.** It goes through a new `ConversationPanelView` prop, `onOpenRoute`. `app.tsx` implements it like `handleSelectConversation`: close the mobile drawer, then navigate.
- **Overlays.** The ⋮ actions open overlays that already exist as reusable components taking a project id: `ProjectShareOverlay` and `PublishProjectPanelContainer`. They and the delete confirmation are hosted by `PinnedProjectActionOverlays`, rendered with the panel's other overlays (`ConversationPanelView`'s `overlays` fragment). It holds one `{ action, projectId }` state.
- **Delete.** Delete reuses the app `useProjectActions` with the snapshot's `ProjectDetailsDto` and a new `leaveOnDelete` option. Today's call sites keep the default `true`.

### D7. Read state stays consistent through an app-level listener

The sidebar never writes viewed marks itself. Activating a nested chat clears the dot locally (`markViewed`), and `ProjectChatPage` writes the mark once the chat has loaded with no generation, as it does today. When a write succeeds, `projects-client.ts` notifies its listeners, and the adapter calls `markViewed` for that id. So marks recorded on the project pages reach the tree.

The open chat is shown read by the adapter, to hide the moment between a generation-end `UPDATE` and the mark's `PATCH`. This matches the open-chat rule of `ConversationPage`. A listener registry was chosen over a React context: the writer is already module-level state, and the tree lives outside the project pages' providers.

## Risks / Trade-offs

- [Many pins mean many requests on load] → Pins are deliberate. On load the cost is 2 requests per pin, plus 1 for pending titles. Refreshes are per project and coalesced. If this shows up in metrics, a follow-up can add a batched BFF endpoint.
- [Two watch streams while a pinned project's view is open] → Accepted (D2). Both close with their owners.
- [`aria-level` on list items is announced unevenly by screen readers] → Position and set size are still exposed, the See all name carries the project, and the structure is linear and readable without levels. A tree widget is recorded as a possible follow-up.
- [The `text-secondary` See all text is ~6.2:1, below AAA 7:1 for normal text] → It follows the design and the existing group-header token (`textSecondary`). Hosts can override the color, and this is flagged for design review.
- [The `Indicator` padding change shifts every sidebar row 8px] → It is intended by the design. Snapshot and row tests are updated in the same slice.
- [A `getProject` `404` for a stale pin triggers an unpin] → Only an exact `404` does, matching the delete semantics of `ProjectViewPage`. Other errors drop the row silently, without unpinning.

## Migration Plan

- Every new prop is optional, there is no backend change, and nothing is stored. Deploying is a frontend release.
- Rollback is a revert. Pins are untouched, and a reverted build simply shows no projects in the sidebar.

## Open Questions

- What does the See all row's ⋮ offer? The issue gives it its own ⋮, and the frame does not show its content. This plan uses the project row's menu.
- Should the project row be highlighted on the project view and edit pages (`activeProjectId`)? This plan highlights it, as the current-location cue. The design shows no such state.
- The design draws the footer over the scrolling list (absolutely positioned, with a shadow). The code keeps the footer in flow. This change does not alter that.
