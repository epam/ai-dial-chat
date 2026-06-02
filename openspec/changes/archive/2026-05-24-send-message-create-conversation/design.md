## Context

The app currently manages all conversation messages as local state inside `ConversationRoute`, rendered at `/`. There is no conversation identity, no addressable URL, no backend persistence, and no way for a user to return to or share a conversation. This design introduces a `ConversationContext`, a `/conversations/:conversationId` route, and a `POST /api/v1/conversations` backend endpoint so that every conversation has a stable, bookmarkable URL and is persisted on the server.

## Goals / Non-Goals

**Goals:**

- Persist new conversations to the backend via `POST /api/v1/conversations`.
- Assign a server-returned ID to each conversation.
- Redirect the user to `/conversations/:conversationId` immediately after the conversation is created.
- Load the correct conversation (by ID) when the page is mounted at that URL.
- Own conversation state in a React Context backed by the typed API helpers.
- Share the `Conversation` and `Message` types between frontend and backend via `libs/chat-shared`.

**Non-Goals:**

- `GET /api/v1/conversations/:id` — fetching a saved conversation from the API (future slice).
- Conversation list / sidebar — listing past conversations.
- Multi-tab sync.
- Authentication-scoped conversations — conversations are anonymous in this slice.

## Decisions

### 1. Shared types in `libs/chat-shared`

**Decision:** Add `libs/chat-shared/src/models/chat.ts` with `Message` and `Conversation` interfaces, export from `libs/chat-shared/src/index.ts`. Both `apps/chat` (via `@epam/ai-dial-chat-shared`) and `apps/chat-api` (same import path) use these types.

**Rationale:** AGENTS.md §1 mandates: "Shared types live in `libs/chat-shared` and are imported as `@epam/ai-dial-chat-shared`. Do not duplicate them in the app." Moving types here eliminates duplication between the frontend `types/index.ts` `Message` type and the new backend DTO.

### 2. Backend: new `conversations` domain

**Decision:** Introduce `apps/chat-api/src/conversations/` with `conversation.controller.ts`, `conversation.service.ts`, `conversation.module.ts`, and `dto/create-conversation.dto.ts`. Follow the `themes` domain as the reference pattern.

**API endpoint:**

```
POST /api/v1/conversations
Content-Type: application/json
Body: { "firstMessage": "<string, 1–4000 chars>" }

201 Created
{ "id": "<uuid>", "messages": [{ "id": "...", "role": "user", "content": "...", "timestamp": "..." }], "createdAt": "<ISO-8601>" }

400 Bad Request — invalid body (empty message, exceeds length)
500 Internal Server Error — unexpected persistence failure
```

**Persistence (this slice):** In-memory `Map<string, Conversation>` in the service. Backend persistence (database) is a follow-up slice.

**Rate limiting:** `@Throttle({ default: { limit: 20, ttl: 60000 } })` on `POST /conversations` — tighter than global 100 req/min because conversation creation is a heavier operation.

### 3. ID generation: backend-assigned UUID

**Decision:** The server generates the UUID via Node's `crypto.randomUUID()` inside `ConversationService.createConversation`. The client receives the ID in the 201 response and navigates to `/conversations/<id>`.

**Rationale:** Server-assigned IDs prevent collisions in a multi-user or multi-tab scenario, and keep ID generation authoritative. The client no longer needs `crypto.randomUUID()`.

**Alternative considered:** Client-generated UUID sent in the request body — rejected because the server cannot trust client-supplied IDs without extra validation.

### 4. Frontend: `ConversationContext` calls the API

**Decision:** `ConversationContext.createConversation(firstMessage)` calls `post<Conversation>('/api/v1/conversations', { firstMessage })` using the typed `post` helper from `apps/chat/src/server-api/base.ts`. On success it stores the conversation in context state and returns the server-assigned ID for the redirect.

**Alternative considered:** Keep localStorage as the primary store and fire-and-forget the API call. Rejected — if the POST fails the navigation should not happen (no ghost conversations at unknown URLs).

### 5. `createConversation` typed API helper

**Decision:** Add `apps/chat/src/server-api/conversations.api.ts` with a `createConversation(firstMessage: string): Promise<Conversation>` function that wraps `post<Conversation>`. Components and context import from this file, not from `base.ts` directly.

### 6. Redirect on first message

**Decision:** `ConversationContext.createConversation` is `async`. The caller (`handleSend` in `ConversationRoute`) `await`s it and then calls `useNavigate()('/conversations/<id>')`. The welcome screen at `/` remains; it no longer holds message state.

### 7. `ConversationPage` reads `:conversationId` from params

**Decision:** `ConversationPage` calls `useParams<{ conversationId: string }>()` and retrieves the matching `Conversation` from `ConversationContext`. If the ID is not in context state (cold load, direct URL), the page renders a "conversation not found" message with `role="alert"`. A future `GET /api/v1/conversations/:id` endpoint will enable re-hydration.

### 8. Lazy-loaded `ConversationPage`

**Decision:** Registered in `app.tsx` with `React.lazy`. Named-export pattern:

```ts
const ConversationPage = React.lazy(() =>
  import('@/components/ConversationPage/ConversationPage').then((m) => ({
    default: m.ConversationPage,
  })),
);
```

## Risks / Trade-offs

- **In-memory persistence** → Conversations are lost on server restart. Accepted for this slice; a persistence layer (database) is the follow-up.
- **Cold URL load returns "not found"** → Navigating directly to `/conversations/:id` after a server restart shows "not found" because the in-memory store is empty. Mitigated by the future GET endpoint + context re-hydration.
- **No auth scoping** → Any client can POST a conversation. Acceptable for a demo; auth guard is a follow-up.
- **`crypto.randomUUID()` on Node** → Available since Node 15+. Confirmed available in current environment.
- **Back navigation** → Pressing Back from `/conversations/:id` goes to `/` (welcome screen). Acceptable for this slice.

## Migration Plan

No data migration required. Existing messages in `localStorage` under key `'chat-messages'` are abandoned — not migrated. A returning user sees the welcome screen and must start a new conversation.

Rollback: revert the `app.tsx` route addition, remove `ConversationContext`, remove `apps/chat-api/src/conversations/`, and remove the `ConversationsModule` import from `app.module.ts`. The old `ConversationRoute` + localStorage key `'chat-messages'` can be restored from git.

## Open Questions

- Should the welcome screen optimistically navigate before the POST resolves? (Current decision: no — wait for 201.)
- Rate limit on POST: 20/min acceptable? Adjust based on load testing in the next slice.
