## Why

Currently the app has no conversation identity: all messages live on the root `/` route and are shared across the session with no addressable URL. When a user sends the first message there is no way to bookmark, share, or return to a specific conversation. Additionally, there is no backend persistence — conversations exist only in localStorage and are lost when storage is cleared.

## What Changes

- Sending the first message calls `POST /api/v1/conversations` on the backend to persist the new conversation, receives back a server-assigned ID, then redirects to `/conversations/:conversationId`.
- A new dynamic route `/conversations/:conversationId` is added to the React Router config.
- A `ConversationContext` is introduced to own conversation state (id, messages) and the `createConversation` / `sendMessage` actions, which call the backend API instead of writing to localStorage directly.
- The `ConversationRoute` component is replaced by a `ConversationPage` that reads `:conversationId` from the URL and loads the corresponding conversation.
- The existing welcome screen at `/` remains; it no longer holds message state.
- A `Conversation` model (`id`, `messages`, `createdAt`) is added to `libs/chat-shared` so both the frontend and backend share the same type contract.
- A new NestJS `conversations` domain is added to `apps/chat-api` with a versioned REST controller.
- The `navigation-routing` spec is updated to declare the new dynamic route.

## Capabilities

### New Capabilities

- `conversation-routing`: Client-side dynamic route `/conversations/:conversationId` that mounts a conversation page keyed by ID. Covers route registration, redirect-on-send, page load by ID, and API integration.
- `conversations-api`: Backend REST API at `POST /api/v1/conversations` for creating and persisting new conversations.

### Modified Capabilities

- `navigation-routing`: The existing two-route spec gains a third route declaration (`/conversations/:conversationId`), and the welcome screen at `/` is decoupled from message state.

## Impact

- **libs/chat-shared/src/models/chat.ts** — new file: `Message` and `Conversation` shared types.
- **libs/chat-shared/src/index.ts** — re-export `./models/chat.js`.
- **apps/chat-api/src/conversations/** — new NestJS domain: controller, service, module, DTOs.
- **apps/chat-api/src/app/app.module.ts** — register `ConversationsModule`.
- **apps/chat/src/app/app.tsx** — add `/conversations/:conversationId` route.
- **apps/chat/src/context/** — new `ConversationContext.tsx` for conversation state + API calls.
- **apps/chat/src/components/ConversationPage/** — new page component (replaces message logic in `ConversationRoute`).
- **apps/chat/src/server-api/** — new `conversations.api.ts` typed fetch helper.
- **apps/chat/src/i18n/locales/en.json** — no new user-visible strings required.
- No changes to `libs/conversation-input` or `libs/conversation-panel`.
