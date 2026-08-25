## Context

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) fetched `GET /api/v1/catalog/{entityType}/{entityId}/publish-history` via `getCatalogPublishHistory` inside its `getPublishHistory` callback, passed to the shared `Catalog`/`PublishPanel` lib component. The backend endpoint proxies DIAL Core's `getPublications` API — the same Core call used by the conversation publish-history endpoint, which returns a 503 in production (#7897). Since both endpoints hit the same broken Core capability, opening the publish panel for an application or toolset produced the same guaranteed failed request and history-load error already fixed for conversations.

## Goals / Non-Goals

**Goals:**

- Stop calling the broken endpoint from `CatalogView`, eliminating the guaranteed failed request and console error for application/toolset publish.
- Keep the panel fully functional otherwise: folder selection, folder creation, and publish submission are unaffected.
- Keep the revert path cheap: `getCatalogPublishHistory` and `mapPublishHistoryEntryDto` stay in place, unused.
- Mirror the exact approach already taken in `disable-conversation-publish-history-fetch` so both fixes revert together once the backend is fixed.

**Non-Goals:**

- Fixing the backend 503 itself (tracked in #7897, outside this repo's frontend scope).
- Removing `getCatalogPublishHistory`, `mapPublishHistoryEntryDto`, or the backend endpoint/spec (`catalog-publish-api` is untouched).
- Redesigning the publish-history UX — the requirement is suspended, not replaced.

## Decisions

- **Return a constant empty array from `getPublishHistory` rather than deleting the callback.** `PublishPanel`/`PublishHistoryList` still receive a `getPublishHistory` implementation with the same shape, so no downstream prop contracts change — it now always resolves to `[]` instead of fetching. This keeps the diff minimal and the re-enable step a pure addition.
- **Keep `getCatalogPublishHistory` and `mapPublishHistoryEntryDto` in place, unused.** Deleting them would make the revert a bigger diff and risk drifting from the generated-client method name (`getCatalogPublishHistory` operationId).
- **No feature flag.** Same reasoning as the conversation-panel fix: the condition (backend 503) is binary and known, so a hard-coded removal plus a tracked follow-up is simpler than a runtime toggle.

## Risks / Trade-offs

- [Users can no longer see prior publish history for applications/toolsets, and a real fetch failure can't be told apart from "never published"] → Acceptable short-term: matches the already-accepted trade-off in `disable-conversation-publish-history-fetch`, and publish submission itself is unaffected.
- [The spec/code mismatch could be forgotten and become permanent] → Mitigated by recording it as a spec delta and a tasks.md follow-up referencing #7897.

## Migration Plan

- No data migration. Ship as a normal frontend change.
- Rollback: revert the two touched files (`CatalogView.tsx`, its spec) to restore the fetch immediately if needed.
- Forward path once #7897 is fixed: restore the `getCatalogPublishHistory` call in `getPublishHistory` (git history has the exact prior implementation), re-add the removed tests, and archive this change's spec delta alongside `disable-conversation-publish-history-fetch`'s.

## Open Questions

- None — scope is fixed to the frontend fetch removal; backend fix timing is out of this change's control.
