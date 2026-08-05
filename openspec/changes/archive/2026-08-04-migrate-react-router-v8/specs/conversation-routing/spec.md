## MODIFIED Requirements

### Requirement: The /conversations/:conversationId route renders the correct conversation

The application SHALL declare a React Router route at `/conversations/:conversationId` in `apps/chat/src/app/app.tsx`. The route SHALL render a lazy-loaded `<ConversationPage>` component. `ConversationPage` SHALL read `:conversationId` from `useParams`, retrieve the matching `Conversation` from `ConversationContext`, and display its messages. State ownership: `ConversationContext` holds a `Map<string, Conversation>` populated from API responses. `ConversationPage` uses `React.memo`.

#### Scenario: Known conversation ID renders messages

- **WHEN** the user navigates to `/conversations/<id>` for a conversation present in context
- **THEN** `<ConversationPage>` mounts, retrieves the `Conversation` from context, and the message log is visible with `role="log"` and `aria-live="polite"`

#### Scenario: Unknown conversation ID redirects to home page with notification

- **WHEN** the user navigates to `/conversations/does-not-exist`
- **THEN** `<ConversationPage>` detects the conversation is not present in context, displays an error notification with the message "The conversation was not found." (translated via `ChatI18nKeys.ConversationNotFound`), and navigates to `/` (home page). The notification SHALL be shown exactly once per failed conversation ID, even if the load attempt is retried
