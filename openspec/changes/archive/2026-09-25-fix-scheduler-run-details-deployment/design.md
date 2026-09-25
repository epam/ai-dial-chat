## Context

For a scheduled-task conversation, the sources panel renders a History and a
Details section (hosted in `ConversationSourcesPanel.tsx`, spec'd by
`conversation-sources-sidebar`). The Details section's Model field resolved
`activeScheduledTask.task?.model` — the schedule's current saved settings —
which diverges from the deployment that executed the run whenever the
schedule is edited between runs (issue #9045).

The authoritative per-run value is the run conversation's own `model.id`,
returned by `GET /api/v1/conversations?path=...` — the Conversation page
already fetches it (`apiGetConversation`) but kept it in local state.

## Goals / Non-Goals

**Goals:**

- Run details show the deployment that actually executed that run.
- Reuse data already fetched — no new request.

**Non-Goals:**

- Per-run deployment display on history rows.
- Any `libs/*`, backend, or OpenAPI change.

## Decisions

1. **Source: the run conversation's `model.id`** (published as
   `conversation.assistantModelId || conversation.model.id` — the same
   expression the page already passes as `initialModelId` to
   `ConversationView`), not the schedule's current `model`.
2. **Transport: `SourcesSidebarContext`** — the page already publishes the
   conversation's messages there (`apps/chat/src/context/SourcesSidebarContext.tsx:22`,
   `setMessages` pattern); the model id rides the same channel as an additive
   `conversationModelId` / `setConversationModelId` pair. Publishes in the
   same effect as `setMessages`; cleared on page unmount alongside
   `setMessages([])`.
3. **Resolution in the panel:** `findDeploymentByIdOrReference` +
   `resolveLocalizedText`, raw id fallback — the resolution shape the panel
   and `ScheduledTaskDetailPage` already use.
4. **While the conversation is loading** (`conversationModelId` still
   `undefined`), the Model field is omitted rather than showing a wrong value
   (`ScheduledTaskDetailsSummary` hides the field when the value is absent).

## Risks / Trade-offs

- The Model field is briefly absent while a run conversation loads — accepted
  over showing the wrong (current) deployment.
- The shared context gains two fields; all existing consumers read unaffected
  fields, and specs that mock the context were updated.
- No memoisation-sensitive surface: the model id is a string compared by
  identity in `useMemo` deps.
