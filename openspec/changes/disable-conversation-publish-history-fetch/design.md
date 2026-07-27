## Context

`PublishConversationPanelContainer` (`apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`) fetched `GET /api/v1/conversations/publish-history` via `getConversationPublishHistory` in a `useEffect` keyed on `[isOpen, conversationPath]`. The endpoint currently returns a 503 from DIAL Core in production (#7897), so every panel open produced a failed request and a history-load error surfaced to the user, with no compensating value since the history list was always empty anyway.

The fetch has already been removed from the component as an immediate fix; this design records the resulting state shape and the plan to restore history visibility once the backend is fixed.

## Goals / Non-Goals

**Goals:**

- Stop calling the broken endpoint from the panel, eliminating the guaranteed failed request and console error.
- Keep the panel fully functional otherwise: folder selection, folder creation, and publish submission are unaffected.
- Keep the revert path cheap: the endpoint wrapper (`getConversationPublishHistory`) and its types stay in place, unused.

**Non-Goals:**

- Fixing the backend 503 itself (tracked separately in #7897, outside this repo's frontend scope for this change).
- Removing or renaming `getConversationPublishHistory`, its DTOs, or the backend endpoint/spec (`conversation-publish-api` is untouched).
- Changing repeat-request eligibility. Publishing creates an admin-approval request, so a prior publication in the selected folder SHALL NOT disable another submission or produce a duplicate/replace warning (#7896).

## Decisions

- **Freeze `history` at `[]` via non-updating `useState` rather than deleting the state entirely.** `history`, `isHistoryLoading`, `hasHistoryError` are still threaded into `usePublishFlow` and `StandalonePublishPanel` exactly as before, so no downstream prop contracts change — only the values are now constant. This keeps the diff minimal and the re-enable step (restoring the `useEffect`) a pure addition rather than a rewrite.
- **Treat publish history as informational, not as a deduplication or authorization input.** A publish submission creates a new admin-approval request. Restoring history retrieval SHALL NOT make repeat submission to the same folder unavailable.
- **Keep `getConversationPublishHistory` and its server-api wrapper in place, unused.** Deleting it would make the revert a bigger diff and risk drifting from the generated-client method name (`getConversationPublishHistory` operationId). Leaving it dead is acceptable short-term technical debt, flagged by the tasks.md follow-up.
- **No feature flag.** The condition (backend 503) is binary and known at the time of this change, not something that needs runtime toggling per environment; a hard-coded removal plus a tracked follow-up task is simpler than introducing a flag for a single known outage.

## Risks / Trade-offs

- [Users cannot inspect prior publish requests while the endpoint is disabled] → Accepted temporarily because the history call currently fails deterministically; folder selection and request submission remain available.
- [Restoring history could accidentally reintroduce duplicate blocking through shared publish-flow state] → Mitigated by the explicit requirement and a follow-up test that repeat conversation publish requests remain enabled with non-empty history.

## Migration Plan

- No data migration. Ship as a normal frontend change.
- Rollback: revert the two touched files (`PublishConversationPanelContainer.tsx`, its spec) to restore the fetch immediately if needed.
- Forward path once #7897 is fixed: restore the `useEffect` fetch (git history has the exact prior implementation), re-add the removed history tests, verify that non-empty history does not block another request, and archive the temporary history-visibility delta.

## Open Questions

- None — scope is fixed to the frontend fetch removal; backend fix timing is out of this change's control.
