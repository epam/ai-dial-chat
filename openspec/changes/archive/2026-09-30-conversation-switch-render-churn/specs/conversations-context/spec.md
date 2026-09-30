## ADDED Requirements

### Requirement: In-place list updaters preserve the list reference on a no-op update

`ConversationsProvider` (`apps/chat/src/context/ConversationsContext.tsx`) owns the `conversations` state. Its in-place updaters SHALL return the previous `conversations` array reference from their `setConversations` updater when the update would change no item:

- `updateConversationTitle(id, title)`, when no item matches `id` or when the matching item's `title` already equals `title`;
- `removeConversationFromList(id)`, when no item matches `id`;
- the optimistic write in `pinConversation(id, isPinned)`, when no item matches `id` or when the matching item's `isPinned` already equals `isPinned`.

When an update does change an item, the updater SHALL keep its current behavior: a new array, a new object for the changed item only, and every other item keeping its identity. Returning the previous reference lets React skip the state update, so no `useConversations()` consumer re-renders and no memo derived from `conversations` recomputes.

This requirement adds no endpoint, cache, feature flag, user-visible string, RTL behavior, accessibility semantic or telemetry event. `pinConversation` still issues its API request even when the optimistic write was a no-op.

#### Scenario: Title update with the current title keeps the list reference

- **GIVEN** the provider has loaded a list that contains a conversation titled "Plan"
- **WHEN** `updateConversationTitle` is called with that conversation's id and "Plan"
- **THEN** `conversations` is the same array reference as before the call

#### Scenario: Title update with a new title replaces only the matched item

- **GIVEN** the provider has loaded a list that contains a conversation titled "Plan"
- **WHEN** `updateConversationTitle` is called with that conversation's id and "Roadmap"
- **THEN** `conversations` is a new array, the matched item's `title` is "Roadmap", and every other item is the same object reference as before

#### Scenario: Removing an unknown id keeps the list reference

- **WHEN** `removeConversationFromList` is called with an id that matches no item
- **THEN** `conversations` is the same array reference as before the call

#### Scenario: Pinning an already-pinned conversation keeps the list reference

- **GIVEN** a loaded conversation with `isPinned: true`
- **WHEN** `pinConversation` is called with its id and `true`
- **THEN** `conversations` is the same array reference immediately after the call

### Requirement: Opening a conversation whose name is unchanged does not rewrite the list

When `ConversationPage` loads a conversation and passes the loaded `name` to `updateConversationTitle`, and the list item's `title` already equals that name, the `conversations` array reference SHALL remain unchanged. Conversation switches therefore do not start a second pass through every consumer of the list.

#### Scenario: Navigating to a conversation with a matching title

- **GIVEN** the conversation list contains an item whose `title` equals the `name` the conversation API returns for it
- **WHEN** the user navigates to that conversation and `loadConversation` completes
- **THEN** the `conversations` array reference is the same as before the navigation
