## Context

- The TASK badge and its backing fields (`isScheduledTask`, `scheduleId`, `runId`, `isUnread` on `ConversationListItemDto`) were added by `openspec/changes/archive/2026-08-04-mark-scheduled-task-conversations/` and are already read in `ConversationsContext.tsx` and `ConversationPanelView.tsx:258-295`, but `scheduleId`/`runId` are not forwarded anywhere past the badge today.
- `Conversation.tsx` fetches the single-conversation object via `apiGetConversation(id)`, whose response does **not** carry scheduler fields (confirmed against `openspec/specs/conversations-api/spec.md`); the archived change deliberately deferred adding them there. This design does not revisit that decision — it resolves scheduler identifiers from the already-loaded `ConversationsContext.conversations` list instead, keyed by `conversationIdsMatch` (`apps/chat/src/utils/conversation-id-match.ts:9-10`).
- `ConversationSourcesPanel.tsx` (app) and `libs/source-panel`'s `ConversationSourcesPanel` are already split along the host/lib boundary: the app owns resizing, mobile detection, i18n labels, and attachment derivation; the lib is presentational only (`libs/source-panel/src/models/conversation-sources-panel-props.ts:61-92`). This design must extend that pair without breaking the boundary.
- `ScheduledTaskDetailPage`/`ScheduledTaskDetailView` already implement History (infinite scroll, status icons, skeletons) and Details (Model via `useDeployments`, Instructions via `MDMessageViewer`) for the full detail page. This change needs a **subset** of the same data and visual language inside the conversation UI, so duplication risk is high; the design must state exactly what is shared vs. re-implemented.
- No Accordion/Disclosure component is used anywhere in the codebase today. The UI Kit MCP lookup resolved one candidate: `DialAccordion` (1.0, no 2.0 replacement) — controlled via `expanded`/`onToggle`, header renders `title`/`description` + rotating chevron, `nonCollapsible` available but unused here.
- `scheduledTasksEnabled` currently gates the Scheduled Tasks nav entry and the four dedicated pages (frontend) plus the BFF routes (backend, via `FeatureGuard`), but explicitly does **not** gate the TASK badge. This change adds new callers of `getScheduledTask`/`listScheduledTaskRuns`, which are backend-gated (403 when disabled) — so, unlike the badge, this change's *requests* must be frontend-gated too, to avoid firing calls that will always fail for disabled users.

## Goals / Non-Goals

**Goals:**
- Single, deduplicated ownership of "is this a scheduled-task conversation, and what's its task/run data" — consumed by both the message-area banner and the sources panel.
- Correct identifier resolution (list-item lookup + `conversationIdsMatch`), not badge/DOM/string parsing.
- Concurrent, cancellable, per-conversation-scoped fetches with no cross-conversation state leakage.
- Reuse of `useScheduledTaskRuns`, the run mapper/formatter, the status enum, and the shared markdown renderer — no parallel implementations.
- Library isolation preserved: no host/API/routing/feature-flag knowledge enters `libs/source-panel` (or any other hand-authored lib) directly.
- Independent failure domains: task-detail, run-history, and existing attachment/source errors never black out sibling content.

**Non-Goals:**
- Adding scheduler fields to the single-conversation `GET /api/v1/conversations` response, or any other backend contract change.
- A Process section, run-details endpoint/view, row-click navigation, or task mutation (edit/pause/resume/delete/run-now) from the conversation UI.
- Auto-opening the right sidebar.
- A new generic accordion component — `DialAccordion` already exists and is adopted as-is.
- Changing how the TASK badge itself is computed, rendered, or flag-gated.

## Decisions

### 1. State ownership: a new app-level context, `ActiveScheduledTaskContext`

**Chosen:** A dedicated React context provider (`apps/chat/src/context/ActiveScheduledTaskContext.tsx`, following the `ThemeContext.tsx` pattern: `createContext<T | undefined>(undefined)`, memoized value, `useActiveScheduledTask()` guard hook) mounted once in `app.tsx` above the sibling pair `<main>{routes}</main>` / `<ConversationSourcesPanel />` (the same level currently confirmed at `app.tsx:306-483`). It owns:
- Matching the current route's conversation id (read internally via `useLocation`/`useParams` the same way `Conversation.tsx` does) against `useConversations().conversations` using `conversationIdsMatch`.
- Deriving `{ scheduleId, runId } | null` from the matched item, gated additionally by `useFeatureFlag('scheduledTasksEnabled')`.
- Owning the two concurrent fetches (`getScheduledTask`, first page of `useScheduledTaskRuns`) and exposing `{ scheduleId, runId, task, taskState: 'idle'|'loading'|'error'|'success', history: UseScheduledTaskRunsResult, isFeatureEnabled }`.

**Alternatives considered:**
| Option | Verdict |
|---|---|
| (1) Dedicated app-level context (chosen) | One source of truth, mountable once, consumed by both the banner and the sources panel without prop drilling through `ConversationPage`/`app.tsx`. Matches the existing `ThemeContext`/`SourcesSidebarContext` convention of app-level contexts for cross-cutting concerns. |
| (2) App-level hook/provider mounted above both consumers | Functionally near-identical to (1) — a hook still needs a provider to avoid two independent instances (banner and panel are siblings, not parent/child, per `app.tsx:306-483`), so this collapses into (1) once state must be shared across siblings rather than passed down one tree. Rejected as a distinct option — implemented as (1). |
| (3) Extend `SourcesSidebarContext` | Rejected per proposal guidance: `SourcesSidebarContext` today owns only panel open/close + `messages` (`apps/chat/src/context/SourcesSidebarContext.tsx`); folding in scheduler fetch/lifecycle would turn a UI-visibility context into a data-fetching store and couple the banner (which must render even when the panel is closed) to sidebar-open state. |
| (4) Separate requests in both consumers | Rejected — duplicates the concurrent-fetch/cancel logic, risks the banner and panel disagreeing on loading/error state for the same task, and duplicates the `scheduledTasksEnabled` gate in two places. |

### 2. Identifier resolution and timing

`ActiveScheduledTaskContext` re-derives `{ scheduleId, runId }` on every change of: route conversation id, `conversations` array reference, or feature-flag value. Because `ConversationsContext` loads asynchronously and a user can deep-link directly to a conversation URL, the derived value starts as `'resolving'` (distinct from `'not-a-task-conversation'`) until `conversations.isLoading` becomes `false` at least once for the current identity session. `ConversationPage`/`ConversationView` render unconditionally regardless of this state — only the banner and the panel's task sections react to it. This satisfies "the normal conversation must remain usable while scheduler metadata is being resolved."

Once `{ scheduleId, runId }` are resolved as present, they are treated as immutable for that "task session"; if the user navigates to a different conversation belonging to the **same** `scheduleId`, task-detail is not refetched (keyed by `scheduleId` with a ref-cached last-fetched id), but `runId`-derived UI (current-run highlight, summary timestamp) updates immediately since it's derived from already-loaded `history.items` plus the new `runId`, not a fetch.

### 3. Request lifecycle

Each fetch owner uses the existing per-effect `cancelled` flag + `AbortController` convention (`useFavicon.ts` pattern; `useScheduledTaskRuns.ts:59` already does this for history). `getScheduledTask` is wrapped in a small new fetch effect inside the context (not a new hook) since it's a single request with no pagination; `useScheduledTaskRuns(scheduleId, enabled)` is reused unmodified. Both effects key off `scheduleId`; changing `scheduleId` (including to `null`) resets `task` to `'idle'`/`undefined` before the new effect runs, so a slow response for a stale `scheduleId` cannot land in state for the new one (checked via the `cancelled` flag before every `setState`).

### 4. Task summary banner placement

**Chosen:** Add a neutral `topContent?: ReactNode` slot to `ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`), rendered inside the existing scrollable message container, above the `messages.map(...)` block (`ConversationView.tsx:563-576`), scrolling together with messages rather than floating. `ConversationPage` renders `<ConversationView topContent={<ScheduledTaskConversationBanner />} .../>` only when `useActiveScheduledTask()` reports a task-conversation; the banner component itself lives at the app level (`apps/chat/src/components/ScheduledTaskConversationBanner/`) and is the only consumer of `useActiveScheduledTask()` for summary rendering.

**Alternatives considered:** Adding scheduler-specific props directly to `ConversationView`/`libs/conversation-messages` was rejected per the proposal's explicit instruction and per library isolation (`ConversationView` is app-level already, but `libs/conversation-messages` is not, and the message list itself must stay agnostic of scheduler concepts). A `topContent` slot is the smallest, most neutral extension point and has precedent in the "narrow, host-agnostic slot" pattern used for `SidebarPanel`'s `title`/`leftActions`/`rightActions`.

The banner is a plain rendered component, not a message — it is never added to `messages`, never persisted, and disappears on navigation away since it's driven by route-derived context state, not conversation content.

### 5. Right-panel composition: presentational History/Details in `libs/scheduled-tasks`, composed via `libs/source-panel`'s new slot prop

**Chosen (two coordinated changes):**
1. Extract the presentational run-row list (status icon, timestamp/duration label, skeleton rows, empty/error state) currently inline in `ScheduledTaskDetailView`'s History card into a shared, host-agnostic component in `libs/scheduled-tasks` (e.g. `ScheduledTaskRunHistoryList`), accepting only `items: ScheduledTaskRunItem[]`, `isLoading`, `isLoadingMore`, `error`, `hasMore`, `onLoadMore`, `currentRunId?`, and localized label props — no fetching, no routing. `ScheduledTaskDetailView` is refactored to consume this shared component instead of its inline markup; its own observable behavior/requirements are unchanged (no delta spec needed for `scheduled-task-detail-page`, per the "only if requirements change" rule — this is a pure internal refactor of an already-host-agnostic component into a shared location within the same lib family).
2. Add a small "Details" presentational component (`ScheduledTaskDetailsSummary`, same lib) accepting `modelDisplayName?: string`, `instructionsMarkdown?: string`, `renderInstructions?: (markdown: string) => ReactNode` (mirroring `ScheduledTaskDetailView`'s existing `renderInstructions`/`instructionsMarkdown` contract so both call sites can pass the same `MDMessageViewer`-backed renderer from the app).
3. Add two narrow, host-agnostic composition props to `libs/source-panel`'s `ConversationSourcesPanelProps`: `title?: ReactNode` (panel header override — passed through to the underlying `SidebarPanel`'s existing `title` prop) and `additionalSections?: ReactNode` (rendered before Uploaded/Generated/Sources, matching the required ordering). `ConversationSourcesPanel.tsx` (app) composes `additionalSections={<><History accordion using ScheduledTaskRunHistoryList/><Details accordion using ScheduledTaskDetailsSummary/></>}` and passes `title={task?.displayName ?? conversation.name}`.

**Alternatives considered:**
| Option | Verdict |
|---|---|
| Presentational components in `libs/scheduled-tasks` + neutral slots in `libs/source-panel` (chosen) | Reuses the exact row/status/skeleton rendering already proven in `ScheduledTaskDetailView`, keeps `libs/source-panel` ignorant of the scheduler domain (it only knows "here is a `ReactNode` slot"), and keeps `libs/scheduled-tasks` — which already depends on the scheduler domain model — as the one place owning that presentation. |
| Build History/Details directly inside `libs/source-panel` | Rejected — would import scheduler-domain types (`ScheduledTaskRunItem`, status enum) into a lib whose only job today is generic attachments/sources, expanding its concern surface and duplicating rendering already built in `libs/scheduled-tasks`. |
| Build History/Details entirely at the app level (`apps/chat/src/components/...`), skip lib extraction | Rejected — would duplicate the row/skeleton/status-icon markup already implemented in `ScheduledTaskDetailView` inside `libs/scheduled-tasks`, directly violating "avoid duplicating the existing run-history rendering." |
| Pass raw section markup as `contentBefore` inserted above the whole panel (outside `SidebarPanel`'s scroll region) | Rejected — the required order interleaves with existing sections inside the same scrollable body, so the slot must live inside the panel's content flow, not before it. |

`libs/source-panel` and `libs/scheduled-tasks` remain independent; the app is the only place that imports both and wires one into the other's slot, preserving `apps may import from libs; libs may not import from each other's domain concerns` in spirit (both are `type:ui` libs importing only `chat-shared`, per the module-boundary rule — neither imports the other).

### 6. Collapsible sections: `DialAccordion`

Both History and Details render as one `DialAccordion` each, controlled (`expanded`/`onToggle`) rather than uncontrolled, so the app can reset both to their default state (History expanded, Details collapsed) whenever `scheduleId` changes — matching "when the active conversation changes, reset the sections to their default state." `DialAccordion` already provides the keyboard-operable header button, chevron rotation, and (per its own component contract) internal `aria-expanded` wiring; RTL chevron mirroring is verified against the installed component (if `DialAccordion`'s chevron isn't already RTL-aware, wrap it per `.claude/rules/rtl.md`'s `rtl:scale-x-[-1]` pattern at the call site — confirmed during implementation against the rendered DOM, not assumed here). Collapsed content is unmounted (not just visually hidden) when using `DialAccordion` in controlled mode with content only rendered while `expanded` — this must be verified against `DialAccordion`'s implementation; if it instead hides via CSS while keeping children mounted, the call site wraps `children` in `inert={!expanded}` per `.claude/rules/a11y.md`'s focus-trap rule.

### 7. Pagination trigger: explicit "Show more" button, not scroll

**Chosen:** Per explicit product direction (confirmed against the Figma "Right panel - Expanded sections" frame, node `143:6606`), the sources panel's History section paginates via an explicit **"Show more" button** rendered after the loaded rows, not a scroll-triggered sentinel. `useScheduledTaskRuns`'s existing `loadMore`/`hasMore`/`isLoadingMore` (page size 20, offset-by-consumed-rows, append-without-resort, id-based dedup — `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`) are reused unmodified; only the trigger mechanism differs from `ScheduledTaskDetailPage`'s existing infinite-scroll History card, which is **not** changed by this decision.

`ScheduledTaskRunHistoryList` (the shared presentational component, Decision 5) does not hardcode either trigger mechanism — it accepts an optional `footer?: ReactNode` slot rendered after the rows/skeletons. Each host supplies its own trigger:
- `ScheduledTaskDetailView` keeps supplying its existing sentinel `<li>` + scroll-listener effect as `footer`, preserving its shipped infinite-scroll behavior unchanged.
- The conversation sources panel supplies a "Show more" button as `footer`, wired to `onClick={history.loadMore}`, `disabled` while `history.isLoadingMore`, and rendered only while `history.hasMore` is `true`.

This keeps the lib ignorant of which trigger pattern a given host uses, avoids a `loadMoreVariant` prop/branch inside the lib, and lets each host's pagination affordance evolve independently.

**Alternatives considered:** A `loadMoreVariant: 'scroll' | 'button'` prop on the shared component was rejected — it would require the lib to own two different interaction implementations (an `IntersectionObserver` effect and a button) and to know about panel-open/section-expanded host state either way, which the `footer` slot approach avoids entirely by pushing the decision to whichever component composes the slot.

### 8. Feature-flag interaction

`ActiveScheduledTaskContext` reads `useFeatureFlag('scheduledTasksEnabled')` once and treats the derived task-conversation state as `null` (same as "not a task conversation") whenever the flag is `false`, regardless of `isScheduledTask`/`scheduleId`/`runId` on the list item. This is a deliberate divergence from the badge's flag-independence (item 21 of investigation): the badge has no dependent network calls, but this context's very purpose is to call flag-gated BFF endpoints, so gating at the source avoids guaranteed 403s and keeps behavior consistent with the other four scheduled-tasks pages.

## Risks / Trade-offs

- **[Risk]** Extracting `ScheduledTaskRunHistoryList` out of `ScheduledTaskDetailView` touches an already-shipped, spec'd surface (`scheduled-task-detail-page`). → **Mitigation:** the extraction is scoped to a pure lift-and-shift with no behavior change; the existing `scheduled-task-detail-page` spec's scenarios remain the acceptance test for that page, re-run as regression after the refactor slice, before any conversation-facing work depends on the shared component.
- **[Risk]** Two independent fetch owners (`getScheduledTask` in the new context, and the pre-existing `useScheduledTaskRuns`) could drift in their cancellation semantics since they're not the same hook. → **Mitigation:** both key off the same `scheduleId` state value and both check the same `cancelled`-flag-before-`setState` convention; a dedicated unit test asserts that switching `scheduleId` twice in quick succession leaves only the last one's results in state.
- **[Risk]** `DialAccordion`'s exact focus/inert/RTL behavior is unverified beyond its documented prop table (no live rendering available in this session). → **Mitigation:** design commits to the `expanded`-gated-render / `inert` fallback strategy in Decision 6 so implementation has a concrete fallback if the shipped component's internals don't already satisfy the a11y rule; a dedicated a11y task in tasks.md verifies this against the real component before merge.
- **[Risk]** Adding `additionalSections`/`title` to `ConversationSourcesPanelProps` is a public prop-surface change to a shared lib. → **Mitigation:** both new props are optional and additive; existing consumers (non-task conversations) pass neither and see no change, verified by existing `ConversationSourcesPanel` tests continuing to pass unmodified.
- **[Trade-off]** Resolving scheduler identifiers from the conversation-list item (not the single-conversation fetch) means a task banner/panel cannot appear until `ConversationsContext` has loaded at least once, which is slightly slower on a cold deep-link than if the identifiers came from `getConversation`. Accepted per the proposal's explicit choice not to touch the `conversations-api` backend contract in this change.

## Migration Plan

Purely additive frontend/lib change; no data migration, no feature flag introduced for this change itself (it rides on the existing `scheduledTasksEnabled`), no backend deploy coordination. Rollback is a plain revert of the app/lib commits — no persisted state or API contract is touched. Roll out behind the existing `scheduledTasksEnabled` flag's current audience; no separate staged rollout is required since disabled-flag users see no behavior change beyond the pre-existing badge.

## Open Questions

- Does `DialAccordion`'s shipped implementation already unmount collapsed content and manage `aria-expanded`/focus correctly, or does the call site need the `inert`/conditional-render fallback from Decision 6? To confirm empirically during implementation (task includes a dedicated a11y verification step).
- Does an existing generic "element entered viewport" hook already exist under `apps/chat/src/hooks/` that `ScheduledTaskDetailView`'s infinite scroll relies on, reusable as-is for the panel's scroll container? To confirm during the History-section implementation slice rather than assumed here.
