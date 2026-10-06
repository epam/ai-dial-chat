# Spec: conversation-routing

## Purpose

Conversation URLs: creating a conversation on the first message, redirecting to its route, loading a conversation from its URL, and appending subsequent messages.

## Requirements

### Requirement: Sending the first message creates a conversation via the API and redirects to its URL

When the user submits a message from the welcome screen at `/` (`ROUTES.Root`, rendered by `ConversationRoute` in `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` through `NewConversationComposer`), the application SHALL call `POST /api/v1/conversations` through `createConversation` from `apps/chat/src/server-api/conversations.api.ts` (a thin wrapper over the generated `conversationsApi.createConversation`) with the first message, the selected deployment id, and any attachments, tool configuration, or skills as `custom_content`. The BFF responds `201` with the created conversation and its server-assigned `id`.

`ConversationRoute`'s `handleCreateConversation` SHALL then persist the composer's chat settings (`prompt`, `temperature`, `responseFormat`) with `saveConversation`, and navigate with `useNavigate()` to `getConversationRoute(conversation.id)` (`/conversations/<encoded id>`), passing the saved conversation as router state (`state: { conversation }`). Navigation MUST NOT occur until the create request resolves. If the follow-up save fails after the conversation was created, the application SHALL still navigate to the new conversation (so a retry cannot create a duplicate) and surface the error.

`getConversationRoute` (in `apps/chat/src/constants/routes.ts`) SHALL percent-encode each id segment (decoding it safely first, to avoid double-encoding) and SHALL return `/` when any segment is empty, `.`, or `..`.

#### Scenario: First send navigates to /conversations/:id

- **WHEN** the user types a message in the welcome screen input and sends it
- **THEN** `POST /api/v1/conversations` is called, the browser URL changes to `/conversations/<id>` for the id returned by the server, and the conversation page is rendered with the user's message visible

#### Scenario: Navigation waits for API response

- **WHEN** the create request is pending
- **THEN** the URL remains `/` and no navigation occurs until the request resolves

#### Scenario: API error prevents navigation

- **WHEN** `POST /api/v1/conversations` rejects
- **THEN** the URL remains `/` and `NewConversationComposer` shows an error notification with the API error message, or `ChatI18nKeys.CreateConversationError` when none is available

#### Scenario: Unsafe id segment does not leave the conversations subtree

- **WHEN** `getConversationRoute` is called with an id containing a `..` segment
- **THEN** it returns `/`

---

### Requirement: The /conversations/* route renders the correct conversation

The application SHALL declare a React Router route at `/conversations/*` in `apps/chat/src/app/app.tsx`, inside the `ChatLayout` route, wrapped in `RouteErrorBoundary` and `Suspense`. The route SHALL render the lazy-loaded `ConversationPage` exported from `apps/chat/src/pages/Conversation/Conversation.tsx`. `ConversationPage` SHALL read the conversation id from the `*` splat param via `useParams`, use the conversation passed as router state when present, and otherwise fetch it with `getConversation`. After using a router-state snapshot it SHALL replace the history entry with `state: null` so a hard refresh re-fetches from the server.

The message list SHALL render in `ConversationView` inside a container with `role="log"`, `aria-live="polite"`, and `aria-relevant="additions"`.

#### Scenario: Known conversation ID renders messages

- **WHEN** the user navigates to `/conversations/<id>` for an existing conversation
- **THEN** `ConversationPage` mounts, loads the conversation, and the message log is visible with `role="log"` and `aria-live="polite"`

#### Scenario: Load failure redirects to home page with notification

- **WHEN** the user navigates to `/conversations/does-not-exist` and loading the conversation fails
- **THEN** `ConversationPage` displays an error notification with the message "The conversation was not found." (`ChatI18nKeys.ConversationNotFound`), removes the id from the conversation list when the error is a not-found error, and navigates to `/`. The notification SHALL be shown at most once per failed conversation ID, even if the load is retried

#### Scenario: ConversationPage is code-split

- **WHEN** the application bundle is built
- **THEN** `ConversationPage` is emitted in its own chunk loaded through `React.lazy`; `app.tsx` starts importing that chunk at module evaluation so the `Suspense` fallback is skipped on first navigation

---

### Requirement: Subsequent messages in a conversation append to the existing conversation

After the first message creates the conversation, every additional message sent on the `/conversations/<id>` page SHALL be appended to the loaded conversation without navigation. `handleSend` from `useConversationHandlers` (`libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts`), wrapped in `useCallback`, SHALL append the new user message and an assistant placeholder to the page's conversation state and start a streamed completion with `CompletionMode.Append`. The assistant response SHALL come from the streamed completion, not from a simulated reply.

#### Scenario: Sending a second message appends to the conversation

- **WHEN** the user sends a second message while on `/conversations/<id>`
- **THEN** the URL does NOT change, and the new message appears in the message log

#### Scenario: Assistant response streams into the placeholder

- **WHEN** the user sends a message
- **THEN** an assistant placeholder is appended immediately and filled by the streamed completion for that conversation

---

### Requirement: useConversations hook throws when used outside ConversationsProvider

The conversation-list context lives in `apps/chat/src/context/ConversationsContext.tsx`. Its consumer hook `useConversations` SHALL throw a descriptive error (`'useConversations must be used inside ConversationsProvider'`) when called outside of a `<ConversationsProvider>`.

#### Scenario: Hook throws outside provider

- **WHEN** `useConversations` is called in a component that is not wrapped in `<ConversationsProvider>`
- **THEN** the thrown error message is `'useConversations must be used inside ConversationsProvider'`

---

### Requirement: Context value is memoised to prevent unnecessary re-renders

The `ConversationsContext` value MUST be wrapped in `useMemo` over its state and callbacks. This prevents all consumers from re-rendering on every parent render, following the pattern established by `ThemeContext`.

#### Scenario: Context value is memoised

- **WHEN** `ConversationsProvider` re-renders due to an unrelated parent state change
- **THEN** the context value reference is stable and consumers do not re-render unnecessarily
