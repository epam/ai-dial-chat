# Spec: conversation-routing

## Requirements

### Requirement: Sending the first message creates a conversation via the API and redirects to its URL

When the user submits a message from the welcome screen at `/`, the application SHALL call `POST /api/v1/conversations` with the first message, receive a server-assigned `id` in the 201 response, store the returned `Conversation` in `ConversationContext`, and immediately call `useNavigate()('/conversations/<id>')`. The `createConversation` action is `async`; navigation MUST NOT occur until the POST resolves with 201. State ownership lives in `ConversationContext` (`apps/chat/src/context/ConversationContext.tsx`). The `createConversation` action is exposed via the `useConversation` consumer hook. The typed API call is made via `post<Conversation>` from `apps/chat/src/server-api/conversations.api.ts`.

#### Scenario: First send navigates to /conversations/:id

- **WHEN** the user types a message in the welcome screen input and clicks Send (or presses Enter)
- **THEN** `POST /api/v1/conversations` is called, the browser URL changes to `/conversations/<id>` returned by the server, and the conversation page is rendered with the user's message visible

#### Scenario: Navigation waits for API response

- **WHEN** the POST is pending
- **THEN** the URL remains `/` and no navigation occurs until a 201 is received

#### Scenario: API error prevents navigation

- **WHEN** `POST /api/v1/conversations` returns a non-2xx status
- **THEN** the URL remains `/` and an error state is surfaced to the user

---

### Requirement: The /conversations/:conversationId route renders the correct conversation

The application SHALL declare a React Router route at `/conversations/:conversationId` in `apps/chat/src/app/app.tsx`. The route SHALL render a lazy-loaded `<ConversationPage>` component. `ConversationPage` SHALL read `:conversationId` from `useParams`, retrieve the matching `Conversation` from `ConversationContext`, and display its messages. State ownership: `ConversationContext` holds a `Map<string, Conversation>` populated from API responses. `ConversationPage` uses `React.memo`.

#### Scenario: Known conversation ID renders messages

- **WHEN** the user navigates to `/conversations/<id>` for a conversation present in context
- **THEN** `<ConversationPage>` mounts, retrieves the `Conversation` from context, and the message log is visible with `role="log"` and `aria-live="polite"`

#### Scenario: Unknown conversation ID redirects to home page with notification

- **WHEN** the user navigates to `/conversations/does-not-exist`
- **THEN** `<ConversationPage>` detects the conversation is not present in context, displays an error notification with the message "The conversation was not found." (translated via `ChatI18nKeys.ConversationNotFound`), and navigates to `/` (home page). The notification SHALL be shown exactly once per failed conversation ID, even if the load attempt is retried

#### Scenario: ConversationPage is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/conversations/:id`
- **THEN** `ConversationPage` code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

---

### Requirement: Subsequent messages in a conversation append to the existing conversation

After the first message creates the conversation, every additional message sent on the `/conversations/:id` page SHALL be appended to the existing `Conversation` in `ConversationContext`. No new navigation occurs. The `sendMessage` action on the context handles this and MUST be wrapped in `useCallback` to prevent unnecessary re-renders of `ConversationPage`.

#### Scenario: Sending a second message appends to the conversation

- **WHEN** the user sends a second message while on `/conversations/<id>`
- **THEN** the URL does NOT change, and the new message appears in the message log

#### Scenario: Simulated assistant response appends after delay

- **WHEN** the user sends a message
- **THEN** after a 500 ms delay a simulated assistant response is appended to the conversation and visible in the message log

---

### Requirement: useConversation hook throws when used outside ConversationProvider

The consumer hook `useConversation` SHALL throw a descriptive error (`'useConversation must be used within a ConversationProvider'`) when called outside of a `<ConversationProvider>`. This follows the pattern established by `useTheme` and `useUser` in the codebase.

#### Scenario: Hook throws outside provider

- **WHEN** `useConversation` is called in a component that is not wrapped in `<ConversationProvider>`
- **THEN** React renders an error boundary and the thrown error message is `'useConversation must be used within a ConversationProvider'`

---

### Requirement: Context value is memoised to prevent unnecessary re-renders

The `ConversationContext` value MUST be wrapped in `useMemo`. This prevents all consumers from re-rendering on every parent render, following the pattern established by `ThemeContext`.

#### Scenario: Context value is memoised

- **WHEN** `ConversationProvider` re-renders due to an unrelated parent state change
- **THEN** the context value reference is stable and consumers do not re-render unnecessarily
