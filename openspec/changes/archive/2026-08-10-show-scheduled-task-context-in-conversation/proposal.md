## Why

A conversation created by a scheduled task shows a **TASK** badge in the conversation panel (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:283-285`, added by `openspec/changes/archive/2026-08-04-mark-scheduled-task-conversations/`), but opening that conversation gives no indication of which task produced it, when the run happened, or how to reach the task's full detail/history. The `ConversationListItemDto` already carries `scheduleId`/`runId` for exactly this purpose (`openspec/specs/conversations-api/spec.md:232-244`), and `getScheduledTask`/`listScheduledTaskRuns` already exist (`openspec/specs/scheduled-tasks-api/spec.md:13,248-300`), but nothing in the conversation UI reads them. Users have to leave the conversation and search the Scheduled Tasks list to find run history or task configuration for what they're looking at.

## What Changes

- Add an app-level orchestration owner (context/hook) that, for the active conversation route, matches the route's conversation id against `ConversationsContext.conversations` (via `conversationIdsMatch`, `apps/chat/src/utils/conversation-id-match.ts:9-10`) and, when the matched item has `isScheduledTask === true` with both `scheduleId` and `runId` present, concurrently fetches `getScheduledTask(scheduleId)` and the first page of `useScheduledTaskRuns(scheduleId, true)`.
- Render a compact, non-persisted task-summary banner above the conversation messages (task `displayName`, current run timestamp once loaded, a "Task details" link to `getScheduledTaskDetailRoute(scheduleId)`).
- Extend the right-side conversation sources panel (`libs/source-panel` via `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`) with two new collapsible sections — **History** (run list, infinite scroll, current-run highlight) and **Details** (Model, Instructions) — rendered before the existing Uploaded files / Generated files / Sources sections, only for scheduled-task conversations. Panel header falls back from task `displayName` to the conversation title while loading.
- Reuse existing building blocks without duplication: `useScheduledTaskRuns`, `mapScheduledTaskRunDtoToItem`/`formatRunTimestamp`, `ScheduledTaskRunStatus`, deployments-context model resolution (`apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx:106`), and the shared `MDMessageViewer` markdown renderer (`libs/chat-shared/src/components/MarkdownRenderer/`).
- Introduce a collapsible section pattern (no existing Accordion/Disclosure precedent in the codebase — confirmed by investigation) built on the same host-agnostic composition approach as `SidebarPanel` (`libs/sidebar/src/models/panel-props.ts:49-79`), backed by `@epam/ai-dial-ui-kit`'s accordion/disclosure primitive (API to be confirmed against the installed package version before implementation).
- Explicitly **do not** implement a Process section, run-details view, row-click navigation, task editing/pause/resume/delete, or an auto-opening right panel.
- No backend changes: everything needed (`scheduleId`, `runId`, `isScheduledTask`, `getScheduledTask`, `listScheduledTaskRuns`) already exists. The single-conversation `GET /api/v1/conversations` gap noted in the archived change's risk section is **not** closed by this change — we resolve scheduler metadata from the already-loaded conversation list item instead, deliberately avoiding that follow-up.

## Capabilities

### New Capabilities

- `scheduled-task-conversation-context`: app-level state ownership that matches the active conversation to its scheduler metadata, fetches task details and run history concurrently, manages request lifecycle (reset/abort/stale-response handling) and feature-flag gating, and renders the conversation-side task-summary banner from that state.

### Modified Capabilities

- `conversation-sources-sidebar`: adds ordered, collapsible History and Details sections for scheduled-task conversations ahead of the existing file/source sections, with panel-header title fallback, search/download-all isolation from the new sections, and preserved existing behavior (resizing, mobile, open/close, empty states) for all conversations.

## Impact

- **Frontend app (`apps/chat`)**: new context/hook under `apps/chat/src/context/` (or `apps/chat/src/hooks/`), a new banner component under `apps/chat/src/components/`, changes to `ConversationPage`/`ConversationView` composition to render the banner, changes to `ConversationSourcesPanel.tsx` to pass History/Details data into the sources panel, new i18n keys in `apps/chat/src/i18n/locales/en.json`.
- **Libraries**: likely additive, narrowly-typed composition props on `libs/source-panel` (e.g. `title`, `additionalSections`) or new host-agnostic presentational components in `libs/scheduled-tasks` reusing existing run-row rendering conventions from `ScheduledTaskDetailView`. No changes to `libs/chat-api-client`, no new REST endpoints, no changes to `apps/chat-api`.
- **No breaking changes**: purely additive UI for conversations that are scheduled-task-originated; all other conversations render exactly as today. Rollback is a revert of the app/lib changes — no data migration, no persisted schema change, no API contract change.
