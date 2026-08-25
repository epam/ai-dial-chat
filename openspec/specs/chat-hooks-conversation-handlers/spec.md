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
