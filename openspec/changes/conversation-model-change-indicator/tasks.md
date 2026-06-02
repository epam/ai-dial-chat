## 1. Orient and inspect

- [ ] 1.1 Read `libs/chat-shared/src/models/chat.ts` end-to-end to confirm the exact `MessageRole` enum values, `Message` interface shape, and `MessageCustomContent` type before adding `Status`, `StatusMessageCustomContent`, and `deploymentId`
- [ ] 1.2 Read `apps/chat/src/utils/message-factory.ts` to confirm the existing `createMessagePair` signature before adding `createModelChangedMessage()` and the `deploymentId` parameter
- [ ] 1.3 Read `apps/chat/src/context/DeploymentsContext.tsx` to confirm `selectedItemId`, `items`, and the hook export name (`useDeployments`) before writing `useModelChangeEffect`
- [ ] 1.4 Read `apps/chat/src/pages/Conversation/Conversation.tsx` end-to-end to understand where `messages` state lives, how `addMessage` / `startStream` are called, how `conversationId` is available, and where `useModelChangeEffect` should be inserted
- [ ] 1.5 Read `libs/conversation-messages/src/components/MessageBubble/MessageBubble.tsx` to confirm the current routing logic and props interface before adding the `Status` branch and `deploymentLookup` prop
- [ ] 1.6 Read `libs/conversation-messages/src/components/MessageBubble/AssistantMessageBubble.tsx` end-to-end to understand the existing layout and Tailwind classes before adding the deployment icon header
- [ ] 1.7 Locate the streaming payload builder — search for where `messages` are serialised before being sent to DIAL Core and confirm the exact filter point
- [ ] 1.8 Read `apps/chat/src/server-api/conversations.api.ts` to confirm the existing message creation helper and where `postMessage` should be added
- [ ] 1.9 Read `apps/chat-api/src/conversations/dto/create-message.dto.ts` (or equivalent) to confirm the current DTO shape before adding `eventType` and `deploymentId` fields
- [ ] 1.10 Read `apps/chat/src/i18n/locales/en.json` to confirm the `conversation` key structure before adding the two new `statusMessage` keys
- [ ] 1.11 Read `libs/conversation-input/src/components/Input/DeploymentIcon.tsx` to understand the icon fallback pattern that will be replicated inline in `AssistantMessageBubble`
- [ ] 1.12 Search for `resolveDeploymentIconUrl` to confirm the utility's location and signature before using it in the deployment lookup map
- [ ] 1.13 Confirm `@tabler/icons-react` is already a dependency of `libs/conversation-messages` (check its `package.json`) — `IconInfoCircleFilled` is needed for `StatusMessageBubble`

## 2. Extend shared types

- [ ] 2.1 Add `Status = 'status'` to the `MessageRole` enum in `libs/chat-shared/src/models/chat.ts`
- [ ] 2.2 Add `StatusMessageCustomContent` interface:
  ```typescript
  export interface StatusMessageCustomContent {
    event_type: 'model_changed';
    previous_deployment_id: string | null;
    new_deployment_id: string;
  }
  ```
- [ ] 2.3 Add `deploymentId?: string` to the `Message` interface in `libs/chat-shared/src/models/chat.ts`
- [ ] 2.4 Export `StatusMessageCustomContent` from `libs/chat-shared/src/index.ts` if other types from that file are re-exported there

## 3. Update message factories

- [ ] 3.1 Add `createModelChangedMessage(previousDeploymentId: string | null, newDeploymentId: string): Message` to `apps/chat/src/utils/message-factory.ts`; set `role: MessageRole.Status`, `content: ''`, `deploymentId: newDeploymentId`, and `custom_content` typed as `StatusMessageCustomContent`
- [ ] 3.2 Update `createMessagePair()` in the same file to accept `deploymentId: string | undefined` as a new parameter and set it on the assistant message; update all call sites in `Conversation.tsx` to pass `selectedItemId ?? undefined`

## 4. Guard the streaming payload

- [ ] 4.1 In the streaming payload builder (confirmed in step 1.7), add `.filter((m) => m.role !== MessageRole.Status)` before the messages array is serialised into the DIAL Core request; ensure `MessageRole` is imported

## 5. Backend: extend `CreateMessageDto`

- [ ] 5.1 Add `@ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['model_changed']) eventType?: string` to `CreateMessageDto` in `apps/chat-api/src/conversations/dto/create-message.dto.ts`
- [ ] 5.2 Add `@ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) deploymentId?: string` to the same DTO
- [ ] 5.3 Update `ConversationService` (or equivalent message-creation handler) to persist `eventType` and `deploymentId` on the message record when provided
- [ ] 5.4 Regenerate the API client: `npm exec nx build chat-api-client --skip-nx-cache`

## 6. Frontend: add `postMessage` to `conversations.api.ts`

- [ ] 6.1 Add `postMessage(conversationId: string, message: Message): Promise<void>` to `apps/chat/src/server-api/conversations.api.ts`; call the generated client's message-creation method, threading `message.id`, `message.role`, `message.content`, `message.deploymentId`, and `(message.custom_content as StatusMessageCustomContent | undefined)?.event_type`

## 7. Add `useModelChangeEffect` hook

- [ ] 7.1 Create `apps/chat/src/hooks/useModelChangeEffect.ts` with signature `useModelChangeEffect(conversationId: string | undefined, addMessage: (msg: Message) => void): void`
- [ ] 7.2 Read `selectedItemId` from `useDeployments()`; store the initial value in `useRef` (do NOT fire on mount — only on subsequent changes)
- [ ] 7.3 In `useEffect([conversationId, selectedItemId])`: guard against `!conversationId` and `prevIdRef.current === selectedItemId`; update `prevIdRef.current`; when `selectedItemId` is non-null, call `addMessage(msg)` then `postMessage(conversationId, msg).catch(...)` for optimistic persist

## 8. Wire `useModelChangeEffect` into `Conversation.tsx`

- [ ] 8.1 Call `useModelChangeEffect(conversationId, addMessage)` in `apps/chat/src/pages/Conversation/Conversation.tsx`
- [ ] 8.2 Build `deploymentLookup` map with `useMemo` over `items` from `useDeployments()`; resolve `icon_url` via `resolveDeploymentIconUrl`; fall back to `display_name ?? id`
- [ ] 8.3 Pass `deploymentLookup` to the messages list renderer / `MessageBubble`

## 9. Build `StatusMessageBubble` (Figma node 613:8730)

Reference: [DIAL Chat — Chat, node 613:8730](https://www.figma.com/design/WJEnj2fH07plvGmpXsswle/DIAL-Chat--Chat?node-id=613-8730)

- [ ] 9.1 Create `libs/conversation-messages/src/components/MessageBubble/StatusMessageBubble.tsx` with props `{ eventType: 'model_changed'; previousDeploymentName: string | null; newDeploymentName: string }`
- [ ] 9.2 Render a full-width info banner container:
  ```tsx
  <div className="flex items-center gap-[var(--spacing-03,12px)] p-[var(--spacing-03,12px)] rounded-[var(--radius-1,4px)] border border-[var(--stroke/info)] bg-[var(--background/info)] overflow-hidden w-full">
  ```
- [ ] 9.3 Inside the container, render `<IconInfoCircleFilled size={20} className="shrink-0 text-[color:var(--text&icon/primary)]" />` from `@tabler/icons-react` — this is the info icon from the Figma design, **not** a deployment icon
- [ ] 9.4 Render the text wrapper and two text spans:
  ```tsx
  <div className="flex items-center gap-[var(--spacing-01,4px)] flex-1 min-w-0 text-sm leading-5 text-[color:var(--text&icon/primary)]">
    <span className="font-semibold shrink-0">
      {t('conversation.statusMessage.modelChangedTitle')}
    </span>
    <span className="font-normal flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
      {t('conversation.statusMessage.modelChangedBody', {
        from: previousDeploymentName ?? '…',
        to: newDeploymentName,
      })}
    </span>
  </div>
  ```
- [ ] 9.5 Export `StatusMessageBubble` from the file; add to `libs/conversation-messages/src/index.ts` if that file re-exports bubble components

## 10. Add deployment icon to `AssistantMessageBubble`

- [ ] 10.1 Add optional props `deploymentIconUrl?: string` and `deploymentDisplayName?: string` to `AssistantMessageBubbleProps` in `AssistantMessageBubble.tsx`
- [ ] 10.2 Render a 16 × 16 deployment icon in the message header when `deploymentIconUrl` or `deploymentDisplayName` is provided; use an inline `<img onError={...}>` with `IconRobot` / `IconApps` fallback (same pattern as `DeploymentIcon` in `libs/conversation-input`, replicated inline to respect lib isolation); when both props are absent, render nothing — legacy messages are unaffected

## 11. Update `MessageBubble` router

- [ ] 11.1 Import `StatusMessageBubble` and `StatusMessageCustomContent` in `MessageBubble.tsx`
- [ ] 11.2 Add `deploymentLookup?: Record<string, { iconUrl?: string; displayName: string }>` to `MessageBubbleProps`
- [ ] 11.3 Add the `MessageRole.Status` branch; read `deploymentLookup` for `new_deployment_id` and `previous_deployment_id`:
  ```tsx
  if (message.role === MessageRole.Status) {
    const cc = message.custom_content as StatusMessageCustomContent;
    return (
      <StatusMessageBubble
        eventType={cc.event_type}
        previousDeploymentName={
          cc.previous_deployment_id
            ? (deploymentLookup?.[cc.previous_deployment_id]?.displayName ?? cc.previous_deployment_id)
            : null
        }
        newDeploymentName={
          deploymentLookup?.[cc.new_deployment_id]?.displayName ?? cc.new_deployment_id
        }
      />
    );
  }
  ```
- [ ] 11.4 In the `MessageRole.Assistant` branch, read `deploymentLookup[message.deploymentId ?? '']` and pass `deploymentIconUrl` and `deploymentDisplayName` to `AssistantMessageBubble`
- [ ] 11.5 Fix any TypeScript exhaustive-switch errors triggered by the new `MessageRole.Status` variant elsewhere in the codebase

## 12. Add i18n keys

- [ ] 12.1 Add to `apps/chat/src/i18n/locales/en.json` under the `"conversation"` key:
  ```json
  "statusMessage": {
    "modelChangedTitle": "Model switched.",
    "modelChangedBody": "The model has been switched from {{from}} to {{to}}."
  }
  ```

## 13. Add tests

- [ ] 13.1 Create `apps/chat/src/hooks/tests/useModelChangeEffect.spec.tsx`; test: no message appended on mount, message appended when `selectedItemId` changes, `postMessage` called with the status message, no append when `conversationId` is undefined, no append when `selectedItemId` is null after change
- [ ] 13.2 Create `libs/conversation-messages/src/components/MessageBubble/tests/StatusMessageBubble.spec.tsx`; test: renders `IconInfoCircleFilled`, renders the `modelChangedTitle` translation key, renders the `modelChangedBody` with `from` and `to` interpolated, renders `"…"` as `from` when `previousDeploymentName` is null
- [ ] 13.3 Create or update `libs/conversation-messages/src/components/MessageBubble/tests/AssistantMessageBubble.spec.tsx`; test: renders deployment icon when `deploymentIconUrl` is provided, renders nothing extra when both deployment props are absent
- [ ] 13.4 Update `apps/chat/src/utils/tests/stream.spec.ts`: verify `MessageRole.Status` messages are excluded from the DIAL Core payload
- [ ] 13.5 Update `apps/chat/src/utils/tests/message-factory.spec.ts`: verify `createModelChangedMessage` shape (`role: Status`, `deploymentId`, `custom_content`); verify `createMessagePair` sets `deploymentId` on the assistant message
- [ ] 13.6 Add backend unit tests in `apps/chat-api/src/conversations/`: `POST .../messages` with valid `eventType: 'model_changed'` and `deploymentId` returns 201; with disallowed `eventType` returns 400; without these fields still returns 201

## 14. Final verification

- [ ] 14.1 Run `npm exec nx lint chat-shared` — no lint errors
- [ ] 14.2 Run `npm exec nx build chat-shared` — builds cleanly
- [ ] 14.3 Run `npm exec nx lint conversation-messages` — no lint errors in `StatusMessageBubble`, `AssistantMessageBubble`, or `MessageBubble`
- [ ] 14.4 Run `npm exec nx build conversation-messages` — builds cleanly
- [ ] 14.5 Run `npm exec nx lint chat-api` — no lint errors after DTO change
- [ ] 14.6 Run `npm exec nx test chat-api` — all backend tests pass
- [ ] 14.7 Run `npm exec nx build chat-api` — backend compiles cleanly
- [ ] 14.8 Run `npm exec nx lint chat-api-client` — generated client passes lint
- [ ] 14.9 Run `npm exec nx build chat-api-client` — generated client builds cleanly
- [ ] 14.10 Run `npm exec nx lint chat` — no lint errors in `Conversation.tsx`, `useModelChangeEffect.ts`, `message-factory.ts`, `stream.ts`, or `conversations.api.ts`
- [ ] 14.11 Run `npm exec nx test chat` — all frontend tests pass
- [ ] 14.12 Run `npm exec nx build chat` — frontend compiles cleanly with no TypeScript errors
