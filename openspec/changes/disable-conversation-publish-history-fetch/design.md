## Context

`PublishConversationPanelContainer` (`apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`) fetched `GET /api/v1/conversations/publish-history` via `getConversationPublishHistory` in a `useEffect` keyed on `[isOpen, conversationPath]`. The endpoint currently returns a 503 from DIAL Core in production (#7897), so every panel open produced a failed request and a history-load error surfaced to the user, with no compensating value since the history list was always empty anyway.

The fetch has already been removed from the component as an immediate fix; this design records the resulting state shape and the plan to revert once the backend is fixed, since it is a durable (if temporary) change to the `conversation-publish-flow` capability's behavior.

## Goals / Non-Goals

**Goals:**

- Stop calling the broken endpoint from the panel, eliminating the guaranteed failed request and console error.
- Keep the panel fully functional otherwise: folder selection, folder creation, and publish submission are unaffected.
- Keep the revert path cheap: the endpoint wrapper (`getConversationPublishHistory`) and its types stay in place, unused.

**Non-Goals:**

- Fixing the backend 503 itself (tracked separately in #7897, outside this repo's frontend scope for this change).
- Removing or renaming `getConversationPublishHistory`, its DTOs, or the backend endpoint/spec (`conversation-publish-api` is untouched).
- Redesigning the "already published in this folder" UX — the requirement is suspended, not replaced.

## Decisions

- **Freeze `history` at `[]` via non-updating `useState` rather than deleting the state entirely.** `history`, `isHistoryLoading`, `hasHistoryError` are still threaded into `usePublishFlow` and `StandalonePublishPanel` exactly as before, so no downstream prop contracts change — only the values are now constant. This keeps the diff minimal and the re-enable step (restoring the `useEffect`) a pure addition rather than a rewrite.
- **Keep `getConversationPublishHistory` and its server-api wrapper in place, unused.** Deleting it would make the revert a bigger diff and risk drifting from the generated-client method name (`getConversationPublishHistory` operationId). Leaving it dead is acceptable short-term technical debt, flagged by the tasks.md follow-up.
- **No feature flag.** The condition (backend 503) is binary and known at the time of this change, not something that needs runtime toggling per environment; a hard-coded removal plus a tracked follow-up task is simpler than introducing a flag for a single known outage.

## Risks / Trade-offs

- [Users can silently re-publish a conversation to a folder that already has it, since the "already published" guard can never trigger] → Acceptable short-term: `usePublishFlow`'s design (D2) already treats republish-to-same-folder as unsupported-but-not-catastrophic; this only removes the pre-emptive warning, not any data-safety guarantee enforced server-side.
- [The spec/code mismatch could be forgotten and become permanent] → Mitigated by recording it explicitly as a spec delta (see specs/) and a tasks.md follow-up item referencing #7897, instead of leaving the divergence undocumented.

## Migration Plan

- No data migration. Ship as a normal frontend change.
- Rollback: revert the two touched files (`PublishConversationPanelContainer.tsx`, its spec) to restore the fetch immediately if needed.
- Forward path once #7897 is fixed: restore the `useEffect` fetch (git history has the exact prior implementation), re-add the removed tests, and archive this change's spec delta as no longer in effect.

## Open Questions

- None — scope is fixed to the frontend fetch removal; backend fix timing is out of this change's control.
