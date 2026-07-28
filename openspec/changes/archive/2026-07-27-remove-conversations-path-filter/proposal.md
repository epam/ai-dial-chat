## Why

`GET /api/v1/conversations/list` accepts an optional `path` query parameter meant to scope the listing to a DIAL Core subfolder. Issue #7927 found the feature broken (404 instead of scoped results); after a partial fix (#8016) it is still broken — the shared-with-me source ignores `path` entirely, so a scoped request never actually returns only conversations under that folder. Auditing the frontend shows no caller ever passes `path`: the wrapper in `apps/chat/src/server-api/conversations.api.ts` forwards it, but every call site omits it. Rather than fix the shared-resources gap for a parameter nobody uses, remove the `path` filter entirely.

## What Changes

- **BREAKING**: Remove the `path` query parameter from `GET /api/v1/conversations/list` (`ListConversationsQueryDto`, controller, service). The endpoint always returns the full recursive listing from the user's bucket root, as it already does when `path` is omitted.
- Remove the folder-path normalization step (trailing-slash handling, segment-encoding of `folderPath`) from `ConversationService.listConversations` and pass the DIAL Core calls their existing root arguments directly.
- Remove the scoped-path 404-tolerance branch (`isEmptyScopedFolder`) from the user-bucket resilience handling — a 404 on the user-bucket call is once again always a fatal, propagated error (this was already true for the bucket-root case; it now applies unconditionally).
- Drop `path` from the frontend `conversations.api.ts` wrapper's `listConversations` params.
- Regenerate `libs/chat-api-client` (`npm run openapi && npm run openapi:check`) after the Swagger/DTO change to drop `path` from the generated `ConversationsApi`.
- Delete or update tests that assert `path` forwarding/normalization/scoped-404 behavior in `conversation.controller.integration.spec.ts` and `conversation.service.spec.ts`.
- Delete the standalone `conversation-list-path-filter` spec (fully superseded — no requirement in it survives) and strip all `path`-related requirement text and scenarios from `conversations-api/spec.md`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `conversations-api`: `GET /api/v1/conversations/list` no longer accepts a `path` query parameter; the three-way parallel fetch, resilience, and integration-test requirements drop all `path`-related text and scenarios.
- `conversation-list-path-filter`: capability removed entirely (spec file deleted).

## Impact

- `apps/chat-api/src/conversations/dto/list-conversations-query.dto.ts` — remove `path` field.
- `apps/chat-api/src/conversations/conversation.controller.ts` — stop passing `query.path` to the service.
- `apps/chat-api/src/conversations/conversation.service.ts` — remove `path` param, folder normalization, and the scoped-404-tolerance branch from `listConversations`.
- `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`, `conversation.service.spec.ts` — remove/update `path`-related tests.
- `apps/chat/src/server-api/conversations.api.ts` — drop `path` from the wrapper's param type and forwarding.
- `libs/chat-api-client` (generated) — regenerated to drop `path` from `ConversationsApi.listConversations`.
- `openspec/specs/conversation-list-path-filter/spec.md` — deleted.
- `openspec/specs/conversations-api/spec.md` — `path`-related requirement text and scenarios removed.
