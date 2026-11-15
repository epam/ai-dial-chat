Slicing strategy: **vertical, lib-first**. Each slice can be verified on its own. Slices 1–2 build the lib surface from static props. Slice 3 builds the data hook in isolation. Slice 4 joins them in the app end to end (load, render, open). Slices 5–6 widen it with live read state and actions, and slice 7 closes docs and verification.

Rules that apply to every slice:

- Relative imports stay extensionless.
- **Architecture guard** for every task under `libs/*`: no `/api` paths, no `@epam/ai-dial-chat-api-client` import outside `libs/chat-hooks`, no server-api, app context, route, feature flag, i18n, storage or env access in the lib.

## 1. Indicator row padding from the design (`libs/conversation-panel`)

- [x] 1.1 In `libs/conversation-panel/src/components/ConversationRow/ConversationRow.tsx`, change the `Indicator` button's start padding from `ps-0` to `ps-2`.
- [x] 1.2 In `getButtonPaddingEnd` (`libs/conversation-panel/src/utils/conversation-row.ts`), take the row variant and return `pe-2` for an `Indicator` row without actions. `Avatar` rows keep `pe-3`, and the `pe-9` trigger room stays.
- [x] 1.3 Add tests:
  - `ConversationRowIndicator.spec.tsx`: an `Indicator` row without actions has `ps-2` and `pe-2`.
  - `conversation-row.spec.ts`: `getButtonPaddingEnd` returns each variant's padding.

  Update any assertion that pinned the old classes.

  **Verification:** `npm run test:file -- libs/conversation-panel/src/components/ConversationRow/tests/ConversationRowIndicator.spec.tsx`, `npm run test:file -- libs/conversation-panel/src/utils/tests/conversation-row.spec.ts`

## 2. Pinned project rows in `ConversationList` (`libs/conversation-panel`)

- [x] 2.1 Add `libs/conversation-panel/src/models/pinned-projects.ts`:
  - `PinnedProjectGroup` and `PinnedProjects`, with JSDoc on every field.
  - The `projectGuideLine` field of `ConversationListColors`, and `seeAllLabel` / `seeAllAriaLabel` in `ConversationListLabels` (`models/conversation-list.ts`).
  - Export the new types from `libs/conversation-panel/src/index.ts`.
- [x] 2.2 Add `VirtualRowKind.Project`, `ProjectConversation` and `ProjectSeeAll` (`types/virtual-row.ts`), with the matching row shapes in `models/virtual-row.ts`. Nested rows carry `projectId`, `posInSet`, `setSize`, `isFirstNested` and `isLastNested`. Return `INDICATOR_ITEM_ROW_HEIGHT` for them in `getRowHeight` (`utils/conversation-row.ts`).
- [x] 2.3 Add a pure `filterPinnedProjects(projects, { searchQuery, activeFilter, activeTypeFilter, hiddenSources })` to `libs/conversation-panel/src/utils/conversation-filter.ts`. It applies the spec rules: a name match keeps all rows, a chat match keeps only the matching chats and drops See all, origin follows `source` (default `FilterTab.MyChats`), and `Task` hides every project. Unit-test every rule in `utils/tests/conversation-filter.spec.ts`.

  **Verification:** `npm run test:file -- libs/conversation-panel/src/utils/tests/conversation-filter.spec.ts`
- [x] 2.4 Add the row components:
  - `libs/conversation-panel/src/components/ProjectRow/ProjectRow.tsx` with `ProjectRow.module.scss`. It has the briefcase icon (`IconBriefcase`, 16px, `DIAL_KIT_ICON_STROKE`, `aria-hidden`), a `Highlight` name, `href` as a native link, the ⋮ `Dropdown` through `getActions`, `aria-level="1"`, and `aria-current` when `activeProjectId` matches.
  - `ProjectSeeAllRow` in the same folder. It shows `seeAllLabel`, has `aria-label={seeAllAriaLabel(name)}` and a ⋮, and uses the `textSecondary` color.
  - The nested presentation of `ConversationRow`: 28px `padding-inline-start`, no actions, not draggable, `aria-level="2"`, `aria-posinset` and `aria-setsize`.
  - The guide-line `::before` (`inset-inline-start: 20px`, 5px end insets, `--cp-project-guide-line` with fallback `var(--stroke-secondary, #d1dbea)`), set through `buildCssVars` in `ConversationList`.
  - Focus-visible matches hover.
- [x] 2.5 Wire `pinnedProjects` through `ConversationList` (`components/ConversationList/ConversationList.tsx`) and `RowRenderer`:
  - Emit project rows before the pinned items, and render the Pinned header when either exists. A list whose only rows are projects is not empty.
  - Call `onSelectProject`, `onSelectConversation(id, projectId)` and `onSeeAll`. Never call the list's own `onSelectConversation` for nested rows.
  - Exclude the new rows from drag and drop in `utils/drag.ts`.
  - Forward the prop from `ConversationListSection` (`components/ConversationListSection/ConversationListSection.tsx`).
- [x] 2.6 Add `ProjectRow/tests/ProjectRow.spec.tsx` and extend `ConversationList/tests/ConversationList.spec.tsx` with the spec scenarios: 10 chats + See all with levels and positions, no See all without `hasMore`, activation callbacks, search by chat and by name, the Task filter, no drag, RTL logical classes, and no change without `pinnedProjects`. Use role, label and text queries.

  **Verification:** `npm run test:file -- libs/conversation-panel/src/components/ProjectRow/tests/ProjectRow.spec.tsx`, `npm run test:file -- libs/conversation-panel/src/components/ConversationList/tests/ConversationList.spec.tsx`
- [x] 2.7 RTL check: grep the new files for `ml-`/`mr-`/`pl-`/`pr-`/`left`/`right` and replace them with logical properties. Confirm the briefcase icon is not mirrored.
- [x] 2.8 Run the `lib-theming` and `i18n-strings` audits on `libs/conversation-panel`: no hardcoded colors or typography in JSX, and every string from `*Labels` with an English default.

  **Verification:** `npm run verify:changed`

## 3. `usePinnedProjectChats` (`libs/chat-hooks`)

- [x] 3.1 Extract the viewed-mark rule (`ViewedMarks`, the `toRows` unread decision) from `libs/chat-hooks/src/project/use-project-conversations.ts` into `libs/chat-hooks/src/project/project-viewed-marks.ts`, and switch `useProjectConversations` to it with no behaviour change.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/project-hooks.spec.ts`
- [x] 3.2 Add `libs/chat-hooks/src/project/use-pinned-project-chats.ts`:
  - `PINNED_PROJECT_CHATS_LIMIT`, the option and result types, and per-id parallel loads of `getProject` and `listProjectConversations`.
  - The 10-row cap and `hasMore`, and one titles call for the kept pending rows.
  - `404` → `onProjectDeleted`. Other errors drop the row, and a failed listing gives empty chats.
  - The id-set diffing with a per-id `AbortController`, and `markViewed` through `project-viewed-marks.ts`.
  - Export it from the `@epam/ai-dial-chat-hooks/project` entry point (`libs/chat-hooks/src/project/index.ts` or the entry the package maps).
- [x] 3.3 Add the single watch to the same hook:
  - `runProjectWatch` over the sorted ids (capped at 1000), opened after the first load settles.
  - A per-project coalesced silent refresh and the etag skip.
  - `DELETE` handling, refresh-all on reconnect, an unavailable ref, and reopening on an id-set change only.
- [x] 3.4 Add `libs/chat-hooks/src/project/tests/use-pinned-project-chats.spec.ts`, covering every scenario of the `sidebar-pinned-project-chats` hook requirements:
  - the 12- and 10-chat caps, pending titles, `404`, disabled;
  - a new answer, the etag skip, a burst, `DELETE`, an unavailable watch, pinning another project;
  - a refresh racing a mark, and a newer answer.

  **Verification:** `npm run test:file -- libs/chat-hooks/src/project/tests/use-pinned-project-chats.spec.ts`

  **Verification:** `npm run verify:changed`

## 4. Sidebar tree end to end (`apps/chat`)

- [x] 4.1 Add `apps/chat/src/hooks/projects/usePinnedProjectsPanel.ts`. It calls `usePinnedProjectChats(projectsClient, pinnedProjectIds, …)` gated by `useFeatureFlag('projectsEnabled')`, and `onProjectDeleted` calls `replacePinnedProjectId(id, null)`.
  - It maps snapshots to `PinnedProjectGroup`s: `getProjectViewRoute` / `getProjectConversationRoute` hrefs, and the source → `FilterTab` mapping.
  - It finds the active chat through `parseProjectConversationRouteParams`, forces `isUnread: false` on it, and passes `activeProjectId` on the view and edit routes.
  - Its callbacks go through `onOpenRoute`. Return a memoised `pinnedProjects` object.
- [x] 4.2 Add an `onOpenRoute` prop to `ConversationPanelView` (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`), implemented in `apps/chat/src/app/app.tsx` (close the mobile drawer, then navigate).
  - `ConversationPanelView` calls `usePinnedProjectsPanel` and passes `pinnedProjects` to `ConversationListSection`.
  - It passes the active project chat id as `activeConversationId` while the `ProjectChat` route is open.
  - It adds `seeAllLabel` / `seeAllAriaLabel` to `sectionLabels`.
- [x] 4.3 Add the i18n keys `conversationPanel.seeAll` and `conversationPanel.seeAllProjectChats` to `apps/chat/src/i18n/locales/en.json` and every other locale file (English placeholder), with `ConversationPanelI18nKeys.SeeAll` / `SeeAllProjectChats` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 4.4 Add `apps/chat/src/hooks/projects/tests/usePinnedProjectsPanel.spec.ts` and extend `apps/chat/src/components/ConversationPanel/tests/ConversationPanelViewSidebar.spec.tsx` with these cases:
  - The project renders before the pinned chats.
  - A nested chat opens its route, loses its dot and is `aria-current`.
  - See all opens the view.
  - The mobile drawer closes.
  - With the flag off, no project request is sent and no project row renders.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/projects/tests/usePinnedProjectsPanel.spec.ts`, `npm run test:file -- apps/chat/src/components/ConversationPanel/tests/ConversationPanelViewSidebar.spec.tsx`

  **Verification:** `npm run verify:changed`

## 5. Read state reaches the tree (`apps/chat`)

- [x] 5.1 In `apps/chat/src/hooks/projects/projects-client.ts`, add `subscribeProjectConversationViewed`, and make `markProjectConversationViewed` notify listeners after a successful `projectViewedWriter.enqueue`. A failure or `drop` notifies no one, and a throwing listener is isolated.
- [x] 5.2 Subscribe in `usePinnedProjectsPanel` and call `markViewed` for each reported id. Unsubscribe on unmount.
- [x] 5.3 Add `apps/chat/src/hooks/projects/tests/projects-client.spec.ts`, covering a success that notifies, a failure that does not, and unsubscribe. Extend `usePinnedProjectsPanel.spec.ts` with "a chat read on the project page loses its dot".

  **Verification:** `npm run test:file -- apps/chat/src/hooks/projects/tests/projects-client.spec.ts`, `npm run test:file -- apps/chat/src/hooks/projects/tests/usePinnedProjectsPanel.spec.ts`

## 6. Project row actions (`apps/chat`)

- [x] 6.1 Add the `leaveOnDelete` option (default `true`) to `apps/chat/src/hooks/projects/useProjectActions.ts`. With `false`, notify and unpin but do not navigate. Extend `apps/chat/src/hooks/projects/tests/useProjectActions.spec.ts`.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectActions.spec.ts`
- [x] 6.2 Add `getActions` to `usePinnedProjectsPanel`:
  - Unpin for everyone, with the `ActionsPinError` toast on failure.
  - Edit, Publish, Share and Delete when `canEdit`, with the existing `ButtonsI18nKeys` labels.
  - It is used for both the project and the See all rows.
- [x] 6.3 Add `apps/chat/src/components/PinnedProjectActionOverlays/PinnedProjectActionOverlays.tsx` (`memo` default export, `Props`). It hosts `ProjectShareOverlay`, `PublishProjectPanelContainer` (focus returns to the ⋮ trigger) and the delete `DeleteConfirmationDialog`, with the `ProjectViewPage` copy and `useProjectActions({ leaveOnDelete })`.
  - `leaveOnDelete` is `true` only on that project's view, edit or chat route.
  - A `ProjectChanged` conflict refreshes that project.
  - Mount it in `ConversationPanelView`'s `overlays` fragment.
- [x] 6.4 Add `apps/chat/src/components/PinnedProjectActionOverlays/tests/PinnedProjectActionOverlays.spec.tsx`, and extend `usePinnedProjectsPanel.spec.ts`, with these cases:
  - the owner menu order and the shared-project Unpin-only menu;
  - Unpin removes the tree;
  - delete from another page keeps the route, and delete on that project goes to `/projects`;
  - Share and Publish open their overlays.

  **Verification:** `npm run test:file -- apps/chat/src/components/PinnedProjectActionOverlays/tests/PinnedProjectActionOverlays.spec.tsx`, `npm run test:file -- apps/chat/src/hooks/projects/tests/usePinnedProjectsPanel.spec.ts`

  **Verification:** `npm run verify:changed`

## 7. Docs, specs and final verification

- [x] 7.1 Update `libs/conversation-panel/README.md`: the `pinnedProjects` prop with a compiling example, the `PinnedProjectGroup` / `PinnedProjects` types, the `seeAllLabel` / `seeAllAriaLabel` labels, the `projectGuideLine` color with its default, the `Indicator` padding, and any new public `dial-cp-*` class.
- [x] 7.2 Update `libs/chat-hooks/README.md`: `usePinnedProjectChats`, `PINNED_PROJECT_CHATS_LIMIT` and the exported types, with a compiling example.
- [x] 7.3 Check `docs/architecture.md` for the sidebar and projects description and add the pinned-project tree and its watch. No new route, context, endpoint or lib is added. Use the `dial-docs` skill to find any other doc describing the sidebar's Pinned section.
- [x] 7.4 Run `npm run validate:docs` and `npm run validate:specs`, and fix what they report.
- [x] 7.5 Run the `code-review-and-quality` five-axis review on the branch.
- [x] 7.6 Run `npm run verify:full` once to close the change.

## Follow-ups (out of scope, record only)

- [ ] F.1 A batched BFF read of the pinned projects' trees, if the per-pin request count shows up in the metrics.
- [ ] F.2 A real ARIA tree widget for the sidebar (roving focus, arrow keys), if screen-reader testing shows that `aria-level` on list items is not enough.
- [ ] F.3 Align the sidebar footer with the design, which draws it over the scrolling list.
