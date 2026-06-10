## Why

The `implement-conversation-panel` change shipped with specs written against a planned design that diverged during implementation — the list endpoint path, pagination model, library name, and DTO shapes all differ from what was built. In parallel, two follow-up improvements are needed: (1) the conversation panel open/closed state resets on every page reload because it is held only in React state; and (2) `listConversations` always fetches from the root with `recursive=true`, making it impossible to browse a specific subfolder path, which is required to distinguish "My Files" root from named subfolders.

## What Changes

- **Spec sync** — update `specs/conversations-api` and the `implement-conversation-panel` delta specs to match the shipped `GET /api/v1/conversations/list` endpoint (cursor-based pagination via `nextToken`, DIAL Core backed, `ConversationListResponseDto` shape). Update capability name references from `libs/conversation-history` to `libs/conversation-panel`.
- **Panel open/close persistence** — add a `useLocalStorage` hook that reads and writes a boolean key to `localStorage`. Replace the plain `useState` for `isHistoryPanelOpen` in `app.tsx` with this hook so the panel position survives page reloads.
- **`listConversations` path parameter** — add an optional `path` query parameter to `GET /api/v1/conversations/list`. When `path` is omitted or `''`, the current behavior is preserved (recursive listing from the bucket root, i.e. "My Files"). When `path` is supplied, DIAL Core is queried with that path as the folder prefix so only conversations under that path are returned.

## Capabilities

### New Capabilities

- `conversation-panel-open-state`: Persist the conversation panel open/closed boolean to `localStorage` via a new `useLocalStorage` hook; panel state survives page reloads.
- `conversation-list-path-filter`: Optional `path` query parameter on `GET /api/v1/conversations/list`; empty string or omitted means root ("My Files"); a non-empty value scopes the listing to that DIAL Core folder path.

### Modified Capabilities

- `conversations-api`: Bring the spec in line with the shipped implementation — `GET /api/v1/conversations/list` (not `/api/v1/conversations`), cursor pagination via `nextToken` (not `limit/offset`), `ConversationListResponseDto` shape, DIAL Core backed. Add `path` parameter to the list endpoint.

## Impact

- **`apps/chat-api`**: `src/conversations/dto/list-conversations-query.dto.ts` — add optional `path: string` field; `conversation.service.ts` — forward `path` to DIAL Core `getConversationMetadata` call; `conversation.controller.ts` — expose `path` query param via Swagger.
- **`apps/chat`**: new `apps/chat/src/hooks/useLocalStorage.ts`; `app.tsx` — replace `useState(false)` with `useLocalStorage('conversationPanelOpen', false)`.
- **`libs/chat-api-client`**: regenerate after Swagger change to pick up `path` param in `listConversations`.
- **`apps/chat/src/server-api/conversations.api.ts`**: forward optional `path` argument to generated client.
- **Specs**: `openspec/specs/conversations-api/spec.md` updated; `openspec/changes/implement-conversation-panel/specs/conversations-api/spec.md` delta updated.
- **No breaking changes** — `path` is optional with a default of `''`; existing callers continue to work unchanged.
