## Why

When a user switches the active model or agent mid-conversation, the change is completely invisible in the conversation timeline. The only visual update is the model selector control in the input bar. This means:

- Users lose track of which model produced which responses when they switch models partway through a conversation.
- If a user reopens an old conversation, there is no record of which model answered which questions.
- The input bar icon updates, but nothing in the message history reflects the transition point — all assistant responses look identical regardless of which model generated them.

Adding a persistent status message at the moment of model change makes the conversation timeline permanently self-explanatory: readers can immediately see where the switch happened both in the current session and when the conversation is reopened later. Displaying the agent icon next to every assistant response (not only in the input bar) makes it immediately clear which model produced each reply — especially valuable in multi-model conversations.

## What Changes

- **New `MessageRole.Status`** added to the `MessageRole` enum in `libs/chat-shared/src/models/chat.ts`. Status messages carry a machine-readable `eventType` and a human-readable label; they are never sent to the AI backend.
- **`ModelChangedStatusMessage` shape** in the same file: a `Message` with `role: MessageRole.Status`, `custom_content.event_type: 'model_changed'`, `custom_content.previousModelId`, and `custom_content.newModelId`.
- **`createModelChangedMessage()` factory** in `apps/chat/src/utils/message-factory.ts` that builds the status message from two deployment IDs.
- **`useModelChangeEffect` hook** in `apps/chat/src/hooks/useModelChangeEffect.ts` that watches `DeploymentsContext.selectedItemId` and appends a status message to the active conversation whenever the selection changes during an open conversation.
- **Status messages persisted to the backend** via `POST /api/v1/conversations/messages`. `CreateMessageDto` is extended with an optional `eventType` field; the backend stores status messages alongside regular chat messages. When the conversation is reloaded, the status messages are restored from the server — model-change history is permanent.
- **`StatusMessageBubble` component** in `libs/conversation-messages/src/components/MessageBubble/StatusMessageBubble.tsx`. Renders a horizontally-centred, muted inline row: `[DeploymentIcon] Model changed to <name>` — no message actions, no rating, no copy button.
- **`MessageBubble` router updated** to dispatch `role === MessageRole.Status` to `StatusMessageBubble`.
- **Agent icon shown on every assistant `MessageBubble`** — a small deployment icon (matching the input-bar icon) is added to the header of each `AssistantMessageBubble`. The icon reflects whichever deployment was active at the time that message was generated, derived from the deployment ID stored on the message (see `Message.deploymentId` below).
- **`Message.deploymentId` field** added to the `Message` interface in `libs/chat-shared/src/models/chat.ts`. Populated on every assistant message creation in `createMessagePair()` from the currently selected deployment ID. Stored and restored with the message.
- **`ConversationView` updated** to resolve deployment metadata (icon URL, display name) and pass a `deploymentLookup` map through to both `StatusMessageBubble` and `AssistantMessageBubble`.
- **i18n key** `"conversation.statusMessage.modelChanged"` added to `apps/chat/src/i18n/locales/en.json`.

## Capabilities

### New Capabilities

- `conversation-model-change-indicator`: A status message is automatically inserted and persisted in the conversation timeline when the user changes the active model or agent. The status message survives page reload and is visible whenever the conversation is reopened. Each assistant response displays the icon of the deployment that generated it, making multi-model conversations immediately readable at a glance.

### Modified Capabilities

_None — no existing spec files require requirement-level changes._

## Impact

| Area | Change |
|---|---|
| `libs/chat-shared/src/models/chat.ts` | Add `MessageRole.Status`; add `StatusMessageCustomContent` shape; add `deploymentId?: string` to `Message` |
| `apps/chat/src/utils/message-factory.ts` | Add `createModelChangedMessage()` factory; populate `deploymentId` in `createMessagePair()` |
| `apps/chat/src/hooks/useModelChangeEffect.ts` | New hook — watches model selection, appends and persists status message |
| `apps/chat/src/pages/Conversation/Conversation.tsx` | Call `useModelChangeEffect`; pass `deploymentLookup` to message renderer |
| `libs/conversation-messages/src/components/MessageBubble/StatusMessageBubble.tsx` | New component |
| `libs/conversation-messages/src/components/MessageBubble/AssistantMessageBubble.tsx` | Add deployment icon to message header |
| `libs/conversation-messages/src/components/MessageBubble/MessageBubble.tsx` | Route `MessageRole.Status` to `StatusMessageBubble`; pass `deploymentLookup` entry to `AssistantMessageBubble` |
| `apps/chat-api/src/conversations/dto/create-message.dto.ts` | Add optional `eventType?: 'model_changed'` and `deploymentId?: string` |
| `apps/chat-api/src/conversations/conversation.service.ts` | Persist status messages and `deploymentId` on message records |
| `libs/chat-api-client/` | Regenerated after DTO change |
| `apps/chat/src/server-api/conversations.api.ts` | Thread `eventType` and `deploymentId` through message creation calls |
| `apps/chat/src/i18n/locales/en.json` | New `conversation.statusMessage.modelChanged` key |

**Scope note:** `MessageRole.Status` messages are never forwarded to the AI streaming endpoint — the streaming payload builder filters by `role !== MessageRole.Status`. Backend changes are limited to the message DTO and service layer; no DIAL Core integration is affected.

**i18n:** One new user-visible string is introduced. It goes through `react-i18next` under the existing `conversation` domain key.
