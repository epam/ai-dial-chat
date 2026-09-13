# chat-hooks-conversation-handlers Specification

## Purpose

Reusable hook exported by `@epam/ai-dial-chat-hooks` composing send/regenerate/edit/delete/rate/starter conversation orchestration on top of `useAttachmentUpload` and `useConversationStream`, without importing app-owned context, routing, or a configured API client singleton.

## Requirements

### Requirement: Composed send/regenerate/edit/delete/rate/starter orchestration
`@epam/ai-dial-chat-hooks` SHALL export `useConversationHandlers`, built on
the library's own `useAttachmentUpload` and `useConversationStream`
contracts, exposing send, regenerate, delete/confirm, rate, starter
submission, and edit/cancel/resubmit handlers plus their associated
pending-UI state, without importing `DeploymentsContext`, `react-router`,
or a configured API client singleton.

#### Scenario: Send creates an optimistic message pair before streaming
- **WHEN** `handleSend(message, attachments)` is called
- **THEN** a user message and an empty assistant placeholder are appended
  to conversation state before `startStream` is invoked

#### Scenario: Regenerate truncates at the assistant message
- **WHEN** `handleRegenerateMessage(messageIndex)` is called on an
  assistant message while not streaming
- **THEN** conversation state is truncated to that index with the message
  cleared, and streaming restarts for it

#### Scenario: Delete removes a user+assistant pair
- **WHEN** `handleConfirmDelete` runs for a user message index followed by
  an assistant message
- **THEN** both messages are removed and the conversation is saved via the
  injected `conversationsApi`

#### Scenario: Deleting the last message deletes the conversation
- **WHEN** `handleConfirmDelete` empties the conversation to nothing or to
  a single status message
- **THEN** the conversation is deleted via the injected `conversationsApi`
  and `onConversationDeleted` is called

### Requirement: handleConfirmDelete reads the conversation ref, not a state updater
`handleConfirmDelete` SHALL compute the post-delete message list from
`state.conversationRef.current` (a synchronous snapshot read outside
`setConversation`) rather than inside a `setConversation` functional
update, so the delete side effects (`conversationsApi.deleteConversation`/
`saveConversation`, `onConversationDeleted`) run outside React's render
phase and are not subject to React re-invoking an impure state updater.
Callers MUST keep `state.conversationRef.current` synchronized with the
conversation identified by `conversationId` on every state change — the
hook has no way to detect a stale or mismatched ref, and a caller that
lets the two drift (e.g. updating `conversation` state on a route change
without also writing the ref) risks deleting/saving the wrong messages
under the current `conversationId`'s path.

#### Scenario: Confirm-delete is a no-op when the ref was never synced
- **WHEN** `handleConfirmDelete` runs while `state.conversationRef.current`
  is `null`
- **THEN** no API call is made and `onConversationDeleted` is not called

#### Scenario: Confirm-delete derives its result from the ref, not the conversation prop
- **WHEN** `state.conversationRef.current` holds different messages than
  the `conversation` value passed as a prop to `useConversationHandlers`
- **THEN** the deleted/saved message list reflects
  `state.conversationRef.current`'s messages, not the prop's

#### Scenario: Rate is optimistic with revert on failure
- **WHEN** `handleRateMessage(messageIndex, rating)` is called and the
  injected `rateApi.rateMessage` call rejects
- **THEN** the message's rating is reverted to its previous value and the
  handler returns `false`

#### Scenario: Starter submission with confirmation gate
- **WHEN** `handleButtonSelect(starter, ...)` is called for a starter whose
  `dial:widgetOptions.confirmationMessage` is set
- **THEN** the starter is held as `pendingStarterContext` instead of being
  submitted immediately, until `handleConfirmStarter` is called

### Requirement: Starter text comes from the clicked button, not the group
`getStarterSubmitText` and `getStarterDisplayText` SHALL resolve a starter's
own `dial:widgetOptions.populateText` in preference to the `description`
passed alongside it. `description` is the schema property's shared
intro/question text and is constant for every button in a group, so it SHALL
be used only as a fallback for a starter that carries no text of its own.
`getStarterSubmitText` SHALL keep returning `''` for a submit button whose
`populateText` is explicitly `null`; `getStarterDisplayText` SHALL fall back
to `starter.title` in that case. `submitStarter` SHALL derive the optimistic
user message's content from `getStarterDisplayText`.

#### Scenario: Each button of a described group submits its own text
- **WHEN** `handleButtonSelect(starter, 'button', 'Follow-Up Questions')` is
  called for two starters with different `populateText` values
- **THEN** each call streams that starter's own `populateText`, and neither
  streams `'Follow-Up Questions'`

#### Scenario: Description still fills in for a starter with no text
- **WHEN** a non-submit starter has `populateText: null` and a `description`
  is supplied
- **THEN** `getStarterSubmitText` returns the `description`

### Requirement: Injected model resolution and navigation outcome
The hook SHALL accept a `resolveModelId` function in place of reading
`DeploymentsContext`/a fixed-model override directly, and an
`onConversationDeleted` callback in place of calling `react-router`'s
`navigate` directly.

#### Scenario: Model id is resolved per call, not cached
- **WHEN** `resolveModelId`'s return value changes between two calls to
  `handleSend`
- **THEN** each call to `startStream` uses the model id `resolveModelId`
  returned for that specific call

#### Scenario: Conversation deletion never imports routing
- **WHEN** `handleConfirmDelete` empties the conversation
- **THEN** the hook calls `onConversationDeleted()` and performs no
  `react-router` navigation itself

### Requirement: Tool configuration and network-error batching preserved
The hook SHALL preserve folding an active `toolConfigurationValue` into
every outgoing completion's `custom_content.configuration_value`, and
SHALL preserve `useAttachmentUpload`'s debounced network-error batching
for `handleUploadAttachment`.

#### Scenario: Active tool configuration is forwarded on send
- **WHEN** `toolConfigurationValue` has at least one active entry and
  `handleSend` is called
- **THEN** the outgoing `custom_content.configuration_value` includes
  `toolConfigurationValue`

#### Scenario: Concurrent offline upload failures are batched
- **WHEN** multiple attachments fail to upload while offline within the
  debounce window
- **THEN** `showNetworkError` (forwarded from `useAttachmentUpload`) is
  called once with all failed filenames
