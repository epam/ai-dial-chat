**Slicing strategy**: vertical, risk-first for the foundation slice. Slice 1 proves the highest-risk piece (identifier matching + concurrent, cancellable, flag-gated fetch lifecycle in a new context) in isolation with unit tests before any UI consumes it. Slices 2–7 each add one visible, independently verifiable capability on top (banner, then panel-side presentational extraction, then panel composition, then pagination, then error isolation, then i18n/a11y/RTL/responsive polish), so the feature is demoable after slice 2 and complete after slice 7. Every slice ends with `npm exec nx lint/test <project>` for each touched project; a final `nx affected` run closes the change.

## 1. `ActiveScheduledTaskContext` — identifier resolution and fetch lifecycle (risk-first foundation)

- [x] 1.1 Create `apps/chat/src/context/ActiveScheduledTaskContext.tsx` following the `ThemeContext.tsx` pattern: `createContext<T | undefined>(undefined)`, a `useMemo`-wrapped value, and a guarded `useActiveScheduledTask()` hook that throws when used outside `ActiveScheduledTaskProvider`.
- [x] 1.2 Inside the provider, derive the active route conversation id (same wildcard route param read as `apps/chat/src/pages/Conversation/Conversation.tsx:61`) and match it against `useConversations().conversations` using `conversationIdsMatch` from `apps/chat/src/utils/conversation-id-match.ts` — do not use `.includes()` or raw `===`.
- [x] 1.3 Derive the tri-state `'resolving' | 'not-a-task-conversation' | { scheduleId, runId }` per `scheduled-task-conversation-context` spec's "Active conversation is matched to scheduler metadata" requirement, including the `useFeatureFlag('scheduledTasksEnabled')` gate and the `conversations.isLoading`-aware `'resolving'` state for direct navigation.
- [x] 1.4 Add a fetch effect for `getScheduledTask(scheduleId)` (from `apps/chat/src/server-api/scheduled-tasks.api.ts`) using the `cancelled`-flag + `AbortController` convention from `apps/chat/src/hooks/useFavicon.ts`, exposing `taskState: 'idle' | 'loading' | 'error' | 'success'` and the resolved `ScheduledTaskDto`.
- [x] 1.5 Wire `useScheduledTaskRuns(scheduleId, enabled)` (reused unmodified from `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`) into the context value as `history`, enabled only when a valid `scheduleId` is resolved.
- [x] 1.6 Implement reset-on-`scheduleId`-change (task state resets before the new fetch starts) and the same-`scheduleId`/different-`runId` short-circuit that skips refetching `getScheduledTask` and instead re-derives the current-run view from already-loaded `history.items`.
- [x] 1.7 Mount `ActiveScheduledTaskProvider` in `apps/chat/src/app/app.tsx` above the existing sibling pair `<main>{routes}</main>` / `<ConversationSourcesPanel />` (confirmed composition point at `app.tsx:306-483`).
- [x] 1.8 Add `apps/chat/src/context/tests/ActiveScheduledTaskContext.spec.tsx` (existing sibling-file test convention for `context/`, e.g. `ConversationsContext.spec.tsx`, used instead of a per-file `tests/` folder) covering: canonical-id matching via `conversationIdsMatch`, `'resolving'` during conversation-list loading, feature-flag-disabled short-circuit, concurrent start of both fetches, stale-response rejection on rapid `scheduleId` switches, and no-refetch-of-task-detail when only `runId` changes for the same `scheduleId`.
- [x] 1.9 Verify: `npm exec nx lint chat`, `npm exec nx test chat`.

## 2. Task-summary banner above conversation messages

- [x] 2.1 Add an optional `topContent?: ReactNode` prop to `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`), rendered inside the scrollable message container immediately above the `messages.map(...)` block (`ConversationView.tsx:563-576`).
- [x] 2.2 Create `apps/chat/src/components/ScheduledTaskConversationBanner/ScheduledTaskConversationBanner.tsx` consuming `useActiveScheduledTask()`: shows `task.displayName` once `taskState === 'success'`, a skeleton/compact placeholder while `'loading'`, and a scoped retry action (no message-area disruption) on `'error'`; shows the matching run's formatted timestamp (reused via `mapScheduledTaskRunDtoToItem` from `apps/chat/src/utils/map-scheduled-task-run-dto.ts`, since `formatRunTimestamp` itself is a private helper) only once `history.items` contains a run with `id === runId`.
- [x] 2.3 Add an inline-end "Task details" navigation action to the banner using the SPA router (`react-router` `Link`) targeting `getScheduledTaskDetailRoute(scheduleId)` from `apps/chat/src/constants/routes.ts`, with a chevron icon that mirrors via `rtl:scale-x-[-1]`.
- [x] 2.4 In `apps/chat/src/pages/Conversation/Conversation.tsx`, pass `topContent={<ScheduledTaskConversationBanner />}` to `ConversationView` only when `useActiveScheduledTask()`'s derived state is a scheduled-task conversation; pass nothing otherwise.
- [x] 2.5 Ensure the banner is never added to `messages`/persisted — confirm no code path in this slice touches conversation message state.
- [x] 2.6 Apply mobile-first, logical-property Tailwind classes (`ms-*`/`me-*`, no `ml-*`/`mr-*`) so the banner wraps safely at 360px without introducing horizontal scroll.
- [x] 2.7 Add `ScheduledTaskConversationBanner/tests/ScheduledTaskConversationBanner.spec.tsx` covering: name+timestamp once both load, name-only before the matching run loads, loading skeleton, error state not hiding messages, and the "Task details" link's target href/navigation call.
- [x] 2.8 Verify: `npm exec nx lint chat`, `npm exec nx test chat`.

## 3. Extract shared presentational History list into `libs/scheduled-tasks`

- [x] 3.1 Read `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx`'s current inline History rendering (rows, status icons, skeleton rows, empty/error states) to establish the exact markup/props being extracted.
- [x] 3.2 Create `libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/ScheduledTaskRunHistoryList.tsx` accepting only `items: ScheduledTaskRunItem[]`, `isLoading`, `isLoadingMore`, `error: Error | null`, `currentRunId?: string`, an optional `footer?: ReactNode` slot rendered after the rows/skeletons, and localized label props (empty-state text, error/retry text) — no fetching, no routing, no host imports, and no built-in pagination-trigger mechanism (neither scroll sentinel nor button lives inside the lib; see design Decision 7).
- [x] 3.3 Implement current-run row treatment: visual highlight (accent-tinted pill background, matching the Figma "Right panel - Expanded sections" frame, node `143:6606`) plus `aria-current="true"` (or equivalent accessible text) on the row whose `id === currentRunId`, per the "current-run" scenarios in `conversation-sources-sidebar`'s spec — color is never the only signal.
- [x] 3.4 Refactor `ScheduledTaskDetailView.tsx` to render `ScheduledTaskRunHistoryList`, passing its existing sentinel `<li>` + scroll-listener effect as the `footer` prop so its shipped infinite-scroll behavior is unchanged; do not change `ScheduledTaskDetailView`'s external prop contract or observable behavior.
- [x] 3.5 Update/port existing `ScheduledTaskDetailView` history tests (co-located `tests/` folder) to keep passing against the refactored composition; add `ScheduledTaskRunHistoryList/tests/ScheduledTaskRunHistoryList.spec.tsx` for the extracted component directly (rows, skeleton, empty, error+retry, current-run marking, arbitrary `footer` rendering).
- [x] 3.6 Architecture guard: confirm `libs/scheduled-tasks/src/components/ScheduledTaskRunHistoryList/**` imports nothing from `apps/**`, `@epam/chat-api-client`, routing, i18n, or feature flags — only domain types, `@epam/ai-dial-ui-kit`, `@tabler/icons-react`, and `@epam/ai-dial-chat-shared`.
- [x] 3.7 Verify: `npm exec nx lint scheduled-tasks`, `npm exec nx test scheduled-tasks`.

## 4. Extract shared presentational Details summary into `libs/scheduled-tasks`

- [x] 4.1 Create `libs/scheduled-tasks/src/components/ScheduledTaskDetailsSummary/ScheduledTaskDetailsSummary.tsx` accepting `modelDisplayName?: string`, `instructionsMarkdown?: string`, `renderInstructions?: (markdown: string) => ReactNode`, and localized label props (`modelLabel`, `instructionsLabel`) — mirroring `ScheduledTaskDetailView`'s existing `instructionsMarkdown`/`renderInstructions` contract.
- [x] 4.2 Investigated: `ScheduledTaskDetailView`'s Model field renders inside its "Details" column interleaved with `description`/`repeatsLabel`/`activeWindowLabel` (all sharing one `gap-5` column), while Instructions renders alone in a separate "Configuration" column — they are not adjacent, unlike in `ScheduledTaskDetailsSummary`'s stacked layout. Forcing the shared component in here would require splitting it or changing the page's visual structure, which task 4.2's own constraint ("do not change ScheduledTaskDetailView's ... description, or Repeats rendering") rules out. Decision: leave `ScheduledTaskDetailView`'s Model/Instructions markup as-is (a few lines, not worth forcing); `ScheduledTaskDetailsSummary` is used fresh only by the new conversation-sources-panel Details section (slice 6), which does stack Model+Instructions per the Figma reference.
- [x] 4.3 Add `ScheduledTaskDetailsSummary/tests/ScheduledTaskDetailsSummary.spec.tsx` covering: model display-name rendering, raw-id fallback rendering, markdown-formatted instructions via the injected `renderInstructions`, and absence of any edit control.
- [x] 4.4 Architecture guard: confirm the new component has no host/API/routing imports — `modelDisplayName` and `renderInstructions` are the only integration points, matching the app-level-adapter pattern in the design.
- [x] 4.5 Verify: `npm exec nx lint scheduled-tasks`, `npm exec nx test scheduled-tasks`.

## 5. Host-agnostic composition slots on `libs/source-panel`

- [x] 5.1 Add `title?: ReactNode` and `additionalSections?: ReactNode` to `ConversationSourcesPanelProps` in `libs/source-panel/src/models/conversation-sources-panel-props.ts`, both optional and passed through unchanged (no scheduler-specific typing).
- [x] 5.2 Update `libs/source-panel/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` to forward `title` to the underlying `SidebarPanel`'s existing `title` prop and to render `additionalSections` before the existing Uploaded/Generated/Sources body content, inside the same scrollable region.
- [x] 5.3 Update `libs/source-panel`'s existing `ConversationSourcesPanel` tests to assert the two new props are optional and additive: omitting them reproduces today's exact output; supplying them renders `title` in the header and `additionalSections` ahead of the existing sections.
- [x] 5.4 Architecture guard: confirm `libs/source-panel/**` still has no imports from `apps/**`, `@epam/chat-api-client`, routing, i18n, feature flags, or `libs/scheduled-tasks` — the new props are plain `ReactNode` slots only.
- [x] 5.5 Verify: `npm exec nx lint source-panel`, `npm exec nx test source-panel`.

## 6. Compose History/Details into `ConversationSourcesPanel` (app) with collapsible sections

- [x] 6.1 In `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`, read `useActiveScheduledTask()` alongside the existing `useSourcesSidebar()`/`useConversationSources()` calls.
- [x] 6.2 Build the panel `title` prop: `task.displayName` when `taskState === 'success'`, else the active conversation's title (fallback for `'loading'`/`'error'`/non-task).
- [x] 6.3 Update the panel-empty computation so the panel is never considered empty when the active conversation is a scheduled-task conversation, per the `conversation-sources-sidebar` MODIFIED requirement — existing non-task empty-state behavior stays unchanged.
- [x] 6.4 Compose `additionalSections` as two controlled `DialAccordion`s from `@epam/ai-dial-ui-kit` (History default `expanded=true`, Details default `expanded=false`), each keyed/reset by `scheduleId` so switching conversations restores the defaults; History wraps `ScheduledTaskRunHistoryList` fed by `history` from the context, Details wraps `ScheduledTaskDetailsSummary` fed by `task.model` (resolved via `useDeployments()`, same pattern as `ScheduledTaskDetailPage.tsx:106`) and `task.prompt` rendered through `MDMessageViewer` from `@epam/ai-dial-chat-shared`.
- [x] 6.5 Ensure search (`leftActions`) and download-all (`rightActions`) continue to operate only on `uploaded`/`generated`/`sources` and are unaffected by History/Details content, per spec; hide the search input when there is no searchable file/source content even if task sections render.
- [x] 6.6 Ensure section order for scheduled-task conversations is History, Details, Uploaded Files, Generated Files, Sources.
- [x] 6.7 Verify `DialAccordion`'s actual collapsed-content mount behavior (render in the running app or via a targeted test); if collapsed content stays mounted, wrap it in `inert={!expanded}` per `.claude/rules/a11y.md` so it drops out of the tab order, closing design.md's open question.
- [x] 6.8 Update `apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx` (create the `tests/` folder if absent) covering: task sections render for a scheduled-task conversation even with empty files/sources; non-task conversations render unchanged; section order; title fallback across `taskState` values; search/download-all isolation from task sections; History defaults expanded and Details defaults collapsed; both reset when `scheduleId` changes; collapsed content is not keyboard-reachable.
- [x] 6.9 Verify: `npm exec nx lint chat`, `npm exec nx test chat`.

## 7. "Show more" button wiring for the History section inside the sources panel

- [x] 7.1 In the app-level History composition (from 6.4), render a "Show more" `GhostButton`/`NeutralButton` as `ScheduledTaskRunHistoryList`'s `footer` prop, wired to `onClick={history.loadMore}`.
- [x] 7.2 Render the button only while `history.hasMore === true`; hide it once `hasMore` becomes `false`.
- [x] 7.3 Disable the button (and show its busy state) while `history.isLoadingMore === true`, preventing duplicate clicks from firing overlapping requests.
- [x] 7.4 Confirm (via test) that the button is not interactable while the History accordion is collapsed, per the collapsible-sections requirement (no separate panel-open/expanded guard needed beyond the accordion itself, since the button lives inside the section's content).
- [x] 7.5 Confirm pagination stops once `history.hasMore` becomes `false` and that appended rows do not reset scroll position.
- [x] 7.6 Extend `ConversationSourcesPanel.spec.tsx` (or a dedicated `tests/` file) with: clicking "Show more" triggers exactly one `loadMore` call; the button is disabled while `isLoadingMore`; the button is absent once `hasMore` is `false`; the button/rows are not reachable while History is collapsed; overlapping-id pages still render deduplicated (delegated to the already-tested `useScheduledTaskRuns`, verified here only at the integration level).
- [x] 7.7 Verify: `npm exec nx lint chat`, `npm exec nx test chat`.

## 8. Error isolation across task-detail, run-history, and attachments/sources

- [x] 8.1 In `ActiveScheduledTaskContext`, map `getScheduledTask` `404` responses to a distinct `taskState: 'unavailable'` (task deleted but conversation still exists) separate from generic `'error'`, per the `conversation-sources-sidebar` error-isolation requirement.
- [x] 8.2 Ensure `401`/`403`/`429`/`502`/`503` responses from `getScheduledTask`/`listScheduledTaskRuns` flow through the existing app-wide API error/notification handling (reuse whatever mechanism `apps/chat/src/server-api/*` already surfaces for these codes) without redirecting away from the conversation.
- [x] 8.3 Wire independent retry actions: the banner's retry re-triggers only `getScheduledTask`; the History section's retry re-triggers only `useScheduledTaskRuns.refetch`/`loadMore` — confirm neither retry path re-triggers the other's request.
- [x] 8.4 Confirm (via test) that a run-history failure leaves the Details section rendered when `getScheduledTask` succeeded, and that a task-detail failure/`404` leaves the History section and existing file/source sections rendered.
- [x] 8.5 Add/extend unit tests in `ActiveScheduledTaskContext.spec.tsx` and `ConversationSourcesPanel.spec.tsx` for: 404 → `'unavailable'` state and localized unavailable text; 429/502/503 → existing notification path invoked, no redirect; scoped retry behavior; run-history error not hiding Details; task-detail error not hiding History/attachments.
- [x] 8.6 Verify: `npm exec nx lint chat`, `npm exec nx test chat`.

## 9. i18n keys

- [x] 9.1 Add `scheduledTasks.conversationBanner.*` keys (loading, unavailable, retry aria-label, "Task details" action label + aria-label) to `apps/chat/src/i18n/locales/en.json`; retry button text itself reuses `scheduledTasks.list.retryLabel`.
- [x] 9.2 Add `scheduledTasks.conversationPanel.*` keys (`modelLabel`, `currentRunLabel`) to `en.json`. History/Details section titles reuse `scheduledTasks.detail.historyTitle`/`scheduledTasks.create.detailsSectionTitle`; the "Show more" button reuses the pre-existing `buttons.showMore` (discovered during implementation — avoids the duplicate-key rule); unavailable/error text reuses `scheduledTasks.conversationBanner.unavailableLabel` and `scheduledTasks.list.retryLabel`.
- [x] 9.3 Expose the new keys through the existing typed key-map convention (extended `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`).
- [x] 9.4 Replace any hardcoded English literals introduced in slices 1–8 with `t(...)` calls against the new/reused keys.
- [x] 9.5 Verify: `npm exec nx lint chat`.

## 10. RTL and accessibility verification

- [x] 10.1 Verified the "Task details" chevron mirrors correctly (`rtl:scale-x-[-1]`, our own code). Investigated `DialAccordion`'s chevron (`node_modules/@epam/ai-dial-ui-kit`): it contains no `rtl:` classes at all — the expand/collapse chevron rotates 90° regardless of direction and is not mirrored for RTL. Per `.claude/rules/a11y.md` scope boundary, a gap inside an installed `@epam/ai-dial-ui-kit` component is out of scope for a fix here; noted rather than patched.
- [x] 10.2 Confirmed logical Tailwind classes are used throughout the new components (`ps-6`/`pe-2`/`ps-5`/`gap-x-*`/`gap-y-*`) — no `ml-*`/`mr-*`/`pl-*`/`pr-*` introduced.
- [x] 10.3 Confirmed via test and DOM inspection: `DialAccordion` triggers are real `<button>` elements (native Enter/Space activation), expose `aria-expanded`/`aria-controls`, and fully unmount collapsed content (no `role="region"` div rendered at all when collapsed) — collapsed content is unreachable by Tab without needing the defensive `inert` wrapper, which remains in place regardless.
- [x] 10.4 Added `role="alert"` to `ScheduledTaskRunHistoryList`'s error message and `role="status"` to its empty-state message (a pre-existing gap in the original `ScheduledTaskDetailView` inline markup, fixed as part of the extraction since it's the same lines). Details/banner error states already used `role="alert"`/`role="status"`.
- [x] 10.5 Added `aria-controls`/`id` pairing assertion to `ConversationSourcesPanel.spec.tsx`; `aria-current`/current-run accessible-name assertions already covered in `ScheduledTaskRunHistoryList.spec.tsx` (slice 3).
- [x] 10.6 Verify: `npm exec nx lint chat scheduled-tasks source-panel`, `npm exec nx test chat scheduled-tasks source-panel`.

## 11. Responsive verification (mobile/desktop)

- [x] 11.1 Confirmed: the banner (`ScheduledTaskConversationBanner.tsx`) and the composed accordions (`ConversationSourcesPanel.tsx`) use only flex/gap utilities and no `sm:`/`md:`/`lg:`/`xl:` breakpoint prefixes; no new `useIsMobile()`/`useBreakpoint()` calls were needed since neither surface mounts a different subtree per breakpoint.
- [x] 11.2 Confirmed: the existing `isMobile && isOpen ? 'w-full' : undefined` className logic in `libs/source-panel`'s `ConversationSourcesPanel.tsx` is untouched by this change — `additionalSections`/`title` are orthogonal props that don't interact with the mobile-width branch.
- [x] 11.3 The banner uses `flex-wrap`/`break-words`/`min-w-0` (no fixed widths or `whitespace-nowrap` on the name+timestamp text) so it wraps rather than overflows at 360px. `DialAccordion`'s trigger button uses `p-4` (16px) padding around its icon+text, comfortably exceeding the 44×44px minimum target size.
- [x] 11.4 Verify: `npm exec nx lint chat`.

## 12. Final affected-project verification

- [x] 12.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0` and fix any findings.
- [x] 12.2 Run `npm exec nx affected --target=test --base=origin/development-1.0` and fix any findings.
- [x] 12.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` and fix any findings.
- [x] 12.4 Run `npm exec nx affected --target=typecheck --base=origin/development-1.0` (or the project's equivalent target if named differently — confirm via `nx show project chat --json`) and fix any findings.
- [x] 12.5 Confirm the affected-project set includes exactly `chat`, `scheduled-tasks`, and `source-panel` (plus any transitive dependents) — no unrelated projects should be affected by this change.
