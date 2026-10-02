## ADDED Requirements

### Requirement: Load-time auto-start joins a generation that is already running

`ConversationPage.loadConversation` (`apps/chat/src/pages/Conversation/Conversation.tsx`) auto-starts a `ContinueLastUser` stream when the loaded conversation's last message is a user message. It SHALL pass `{ resumeOnConflict: true }` to `startStream` for that auto-start, and only for that call.

A load can find a user-last conversation while the backend is still generating its answer. This happens when the page is reloaded after the first message of a new conversation, before the backend has saved its start state. The backend then rejects the auto-start with `409`, and the opted-in handover in `chat-hooks-conversation-stream` joins the running generation. The page SHALL NOT start another completion for the path while that handover runs, and SHALL NOT send a client conversation save built from the conflict placeholder.

State ownership: the decision lives in `ConversationPage`; the handover state lives in `useConversationStream`. No context is added.

User-initiated sends, regenerate, edit, starter submissions and `AppPreviewChat` SHALL NOT pass the option. A `409` for them keeps showing `generationConflictMessage`, as issue #8688 requires.

No new i18n keys, no RTL impact, no new ARIA requirements: the existing typing indicator and conflict text are reused. Not gated by `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`.

#### Scenario: Reload in the pre-start window shows the persisted answer

- **GIVEN** a new conversation whose stored copy is `[user]` while the backend's generation for it is registered but has not saved its start state
- **WHEN** the page is reloaded and `loadConversation` auto-starts the stream, which the backend rejects with `409`
- **THEN** the typing indicator stays visible, no conflict text is shown, and once the generation finishes the page shows the server copy `[user, assistant answer]`

#### Scenario: No duplicate turn and no stale save

- **WHEN** the reload scenario above completes
- **THEN** exactly one completion request was sent after the reload, the displayed conversation contains the user message once, and no `saveConversation` call was made for the path while the handover ran

#### Scenario: A user-initiated send still shows the conflict

- **WHEN** the user sends a message in a conversation that another tab is already generating, and the backend responds `409`
- **THEN** the placeholder shows `generationConflictMessage`, exactly as before this change
