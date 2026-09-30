## ADDED Requirements

### Requirement: Handler callbacks keep their identity across conversation updates

`useConversationHandlers` SHALL read the current conversation from `state.conversationRef.current` inside `handleRegenerateMessage`, `handleRateMessage`, `handleButtonSelect`, `handleEditMessage` and the internal `submitStarter` (which `handleButtonSelect` and `handleConfirmStarter` call), instead of closing over the `conversation` parameter. `conversation` SHALL NOT appear in those callbacks' `useCallback` dependencies. Each callback's identity therefore changes only when one of its other inputs changes: `conversationId`, `isStreaming`, the injected APIs, `resolveModelId`, `startStream`, `toolConfigurationValue`, or (for `handleButtonSelect`) `submitStarter`, which is itself stable across conversation updates. A new `conversation` object, such as one per stream chunk, does not change it.

Behavior is unchanged:

- each callback operates on the latest conversation (the ref is assigned on every `setConversation` path the hooks own);
- the guards (`isStreaming`, missing conversation, role checks) apply to the latest conversation;
- `handleRegenerateMessage` still assigns `state.conversationRef.current` synchronously before `setConversation` and `startStream`.

This follows the existing "handleConfirmDelete reads the conversation ref" requirement. There is no host-facing API change.

#### Scenario: Callbacks are stable across a conversation update

- **GIVEN** the hook rendered with conversation `c1`
- **WHEN** it re-renders with a new conversation object `c2` (same id), with `isStreaming` and all injected dependencies unchanged
- **THEN** `handleRegenerateMessage`, `handleRateMessage`, `handleButtonSelect` and `handleEditMessage` are the same function references as before

#### Scenario: A stable callback acts on the latest conversation

- **GIVEN** the hook rendered with `c1`, then `state.conversationRef.current` set to `c2` whose message 1 has rating `Like`
- **WHEN** `handleRateMessage(1, null)` is called through the reference obtained while `c1` was current
- **THEN** the rating is cleared on `c2`'s message 1, and the persisted conversation is derived from `c2`
