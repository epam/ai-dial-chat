# Fix: run details show the deployment used for that run

## Why

Issue [#9045](https://github.com/epam/ai-dial-chat/issues/9045) (P2): for a
scheduled task whose deployment was changed between runs, the run-details
panel on a run's conversation (sources panel → Details section) shows the
scheduler's **current** deployment instead of the deployment that actually
executed that run. The panel resolved the Model field from
`activeScheduledTask.task?.model` — the schedule's latest saved settings — so
every run's details display the same (possibly post-hoc) deployment.

## What Changes

- **Problem:** run details display `task.model` (schedule's current settings).
- **Solution:** the run conversation's own `model.id` — already fetched by the
  Conversation page — is published through `SourcesSidebarContext` (alongside
  the messages it already publishes) and the panel's Details section resolves
  the deployment display name from it (`findDeploymentByIdOrReference` +
  `resolveLocalizedText`, raw id fallback).
- **Non-goals:** no `ScheduledTaskRunItem`/lib changes, no backend or OpenAPI
  changes, no per-run deployment on the history rows, no filename parsing.
- **Acceptance criteria:** opening run N's conversation shows the deployment
  that executed run N in the Details section, regardless of later edits to
  the schedule; regression test covers the divergent-deployment case.

**Alternatives considered** (evaluated during implementation, rejected):

1. Parse the deployment id from the run conversation's `.scheduler/.../{deploymentId}__{title}__{runId}` resource path — rejected: filename heuristic duplicates backend parsing rules (versioned application ids, `applications/` nesting) and needs percent-decoding.
2. Extend `ScheduledTaskRunItem` with a per-run display name set in `mapScheduledTaskRunDtoToItem` — rejected: run history is paginated (10 newest), so an older run's item is often not loaded when its conversation is open.
3. Chosen: reuse the already-fetched conversation DTO's `model.id`, published through the existing sidebar context — no new request, typed, always available once the conversation loads.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `conversation-sources-sidebar`: the "Details section shows resolved model and rendered instructions" requirement — the Model field's source changes from the schedule's current `model` to the run conversation's own model id.

## Impact

- `apps/chat/src/context/SourcesSidebarContext.tsx` — additive `conversationModelId` / `setConversationModelId` (same shape as the existing `messages`/`setMessages` pair).
- `apps/chat/src/pages/Conversation/Conversation.tsx` — the existing messages-publish effect also publishes `conversation.assistantModelId || conversation.model.id`; unmount clears it.
- `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` — Details Model field resolves from `conversationModelId`; removes the `as string` cast.
- Tests: the three affected specs updated/extended.
- **Scope-creep flag:** touches the shared `SourcesSidebarContext` consumed by several components — the change is additive (new optional field), existing consumers are unaffected.
- No `libs/*` changes — no lib-boundary implications.

**Rollback / backward compatibility:** not breaking; a plain revert restores the
previous behavior. No data, API, or persistence migration involved.
