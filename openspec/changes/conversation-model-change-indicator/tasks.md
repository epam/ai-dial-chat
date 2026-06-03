## 1. Orient and inspect

- [x] 1.1 Read `libs/chat-shared/src/models/chat.ts` end-to-end to confirm the exact `MessageRole` enum values, `Message` interface shape, and `MessageCustomContent` type before adding `Status`, `StatusMessageCustomContent`, and `deploymentId`
- [x] 1.2 Read `apps/chat/src/utils/message-factory.ts` to confirm the existing `createMessagePair` signature before adding `createModelChangedMessage()` and the `deploymentId` parameter
- [x] 1.3 Read `apps/chat/src/context/DeploymentsContext.tsx` to confirm `selectedItemId`, `items`, and the hook export name (`useDeployments`) before writing `useModelChangeEffect`
- [x] 1.4 Read `apps/chat/src/pages/Conversation/Conversation.tsx` end-to-end to understand where `messages` state lives, how `addMessage` / `startStream` are called, how `conversationId` is available, and where `useModelChangeEffect` should be inserted
- [x] 1.5 Read `libs/conversation-messages/src/components/MessageBubble/MessageBubble.tsx` to confirm the current routing logic and props interface before adding the `Status` branch and `deploymentLookup` prop
- [x] 1.6 Read `libs/conversation-messages/src/components/MessageBubble/AssistantMessageBubble.tsx` end-to-end to understand the existing layout and Tailwind classes before adding the deployment icon header
- [x] 1.7 Locate the streaming payload builder — search for where `messages` are serialised before being sent to DIAL Core and confirm the exact filter point
- [x] 1.8 Read `apps/chat/src/server-api/conversations.api.ts` to confirm the existing message creation helper and where `postMessage` should be added
- [x] 1.9 Read `apps/chat-api/src/conversations/dto/create-message.dto.ts` (or equivalent) to confirm the current DTO shape before adding `eventType` and `deploymentId` fields
- [x] 1.10 Read `apps/chat/src/i18n/locales/en.json` to confirm the `conversation` key structure before adding the two new `statusMessage` keys
- [x] 1.11 Read `libs/conversation-input/src/components/Input/DeploymentIcon.tsx` to understand the icon fallback pattern that will be replicated inline in `AssistantMessageBubble`
- [x] 1.12 Search for `resolveDeploymentIconUrl` to confirm the utility's location and signature before using it in the deployment lookup map
- [x] 1.13 Confirm `@tabler/icons-react` is already a dependency of `libs/conversation-messages` (check its `package.json`) — `IconInfoCircleFilled` is needed for `StatusMessageBubble`

## 2. Extend shared types

- [x] 2.1 Add `Status = 'status'` to the `MessageRole` enum in `libs/chat-shared/src/models/chat.ts`
- [x] 2.2 Add `StatusMessageCustomContent` interface:
  ```typescript
  export interface StatusMessageCustomContent {
    event_type: 'model_changed';
    previous_deployment_id: string | null;
    new_deployment_id: string;
  }
  ```
- [x] 2.3 Add `deploymentId?: string` to the `Message` interface in `libs/chat-shared/src/models/chat.ts`
- [x] 2.4 Export `StatusMessageCustomContent` from `libs/chat-shared/src/index.ts` if other types from that file are re-exported there

## 3. Update message factories

- [x] 3.1 Add `createModelChangedMessage(previousDeploymentId: string | null, newDeploymentId: string): Message` to `apps/chat/src/utils/message-factory.ts`; set `role: MessageRole.Status`, `content: ''`, `deploymentId: newDeploymentId`, and `custom_content` typed as `StatusMessageCustomContent`
- [x] 3.2 Update `createMessagePair()` in the same file to accept `deploymentId: string | undefined` as a new parameter and set it on the assistant message; update all call sites in `Conversation.tsx` to pass `selectedItemId ?? undefined`

## 4. Guard the streaming payload

- [x] 4.1 In the streaming payload builder (confirmed in step 1.7), add `.filter((m) => m.role !== MessageRole.Status)` before the messages array is serialised into the DIAL Core request; ensure `MessageRole` is imported

## 5. Backend: status message persistence

- [x] 5.1 No dedicated `CreateMessageDto` or per-message POST endpoint is needed — status messages persist as part of the whole-conversation `saveConversation` blob automatically

## 6. Guard streaming payload (backend)

- [x] 6.1 `streamCompletion` in `ConversationService` filters `MessageRole.Status` before building the DIAL Core request — status messages never reach the LLM

## 7. Add `useModelChangeEffect` hook

- [x] 7.1 Create `apps/chat/src/hooks/useModelChangeEffect.ts`; gated by `isConversationLoaded` to suppress spurious status messages on conversation reload
- [x] 7.2 Read `selectedItemId` from `useDeployments()`; store the previous value in `useRef`; sync silently on first load to avoid firing for deployment restoration
- [x] 7.3 In `useEffect([conversationId, selectedItemId, isConversationLoaded])`: guard against `!conversationId`, not loaded, and `prevIdRef.current === selectedItemId`; call `addStatusMessage(msg)` when `selectedItemId` is non-null

## 8. Wire `useModelChangeEffect` into `Conversation.tsx`

- [x] 8.1 Call `useModelChangeEffect(conversationId, addStatusMessage, isConversationLoaded)` in `apps/chat/src/pages/Conversation/Conversation.tsx`
- [x] 8.2 On conversation load, call `setSelectedItemId(getLastDeploymentId(messages))` to restore the last-used agent from history
- [x] 8.3 Pass `deploymentLookup` to `ConversationView` for icon/name resolution

## 9. Build `StatusMessageBubble` (Figma node 613:8730)

Reference: [DIAL Chat — Chat, node 613:8730](https://www.figma.com/design/WJEnj2fH07plvGmpXsswle/DIAL-Chat--Chat?node-id=613-8730)

- [x] 9.1 Create `libs/conversation-messages/src/components/MessageBubble/StatusMessageBubble.tsx` with props `{ titleText?: string; bodyText: string }`
- [x] 9.2 Render a full-width info banner container with correct border/bg tokens
- [x] 9.3 Inside the container, render `<IconInfoCircleFilled size={20} className="shrink-0 ..." />` from `@tabler/icons-react`
- [x] 9.4 Render the text wrapper with bold title span and body span
- [x] 9.5 Export `StatusMessageBubble` from the file; add to `libs/conversation-messages/src/index.ts`

## 10. Add deployment icon to `AssistantMessageBubble`

- [x] 10.1 Add optional props `deploymentIconUrl?: string` and `deploymentDisplayName?: string` to `AssistantMessageBubbleProps`
- [x] 10.2 Render a 28×28 deployment icon badge (Figma node 39:6118) as a sibling left of the message content (node 39:6117); white rounded badge with ~11 % inset; `IconRobot` fallback on error; icon absent for legacy messages

## 11. Update `MessageBubble` router

- [x] 11.1 Import `StatusMessageBubble` and `StatusMessageCustomContent` in `MessageBubble.tsx`
- [x] 11.2 Add `statusTitleText?: string` and `statusBodyText?: string` to `MessageBubbleProps`; app layer passes translated strings
- [x] 11.3 Add the `MessageRole.Status` branch rendering `StatusMessageBubble`
- [x] 11.4 In the `MessageRole.Assistant` branch, pass `deploymentIconUrl` and `deploymentDisplayName` to `AssistantMessageBubble`
- [x] 11.5 Fix TypeScript exhaustive-switch errors triggered by the new `MessageRole.Status` variant

## 12. Add i18n keys

- [x] 12.1 Added `conversation.statusMessage.modelChangedTitle` and `modelChangedBody` to `apps/chat/src/i18n/locales/en.json`; `ConversationI18nKeys` enum added in `translation-keys.ts`; `ConversationView` passes translated strings as `statusTitleText` / `statusBodyText` props to `MessageBubble`

## 13. Add tests

- [x] 13.1 `apps/chat/src/hooks/useModelChangeEffect.spec.ts` — no message on mount, message appended on change, no append when `conversationId` undefined, no append when `isConversationLoaded` false, no spurious message on deployment restore from history
- [x] 13.2 `StatusMessageBubble` tests in `libs/conversation-messages` — renders icon, title, body, null-from fallback
- [x] 13.3 `AssistantMessageBubble` tests — renders icon when `deploymentIconUrl` provided, nothing extra when props absent
- [x] 13.4 `streamCompletion` tests in `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` — verifies `MessageRole.Status` messages are excluded from the DIAL Core payload and all non-status messages are forwarded
- [x] 13.5 `apps/chat/src/utils/tests/message-factory.spec.ts` — verify `createModelChangedMessage` shape; verify `createMessagePair` sets `deploymentId`

## 14. Final verification

- [x] 14.1 `npm exec nx lint chat-shared` — no lint errors
- [x] 14.2 `npm exec nx build chat-shared` — builds cleanly
- [x] 14.3 `npm exec nx lint conversation-messages` — no lint errors
- [x] 14.4 `npm exec nx build conversation-messages` — builds cleanly
- [x] 14.5 `npm exec nx lint chat-api` — no lint errors
- [x] 14.6 `npm exec nx test chat-api` — conversation.service.spec.ts: 8/8 pass
- [x] 14.7 `npm exec nx build chat-api` — backend compiles cleanly
- [x] 14.8 `npm exec nx lint chat` — no lint errors
- [x] 14.9 `npm exec nx test chat` — all frontend tests pass
- [x] 14.10 `npm exec nx build chat` — frontend compiles cleanly
