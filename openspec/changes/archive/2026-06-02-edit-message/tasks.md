## 1. Extend Input component (libs/conversation-input)

- [x] 1.1 Add `initialAttachments?: Attachment[]` prop to `InputProps` in `libs/conversation-input/src/models/ConversationInput.ts` and initialize attachment state from it on mount in `Input.tsx`
- [x] 1.2 Add `renderFooterActions?: (helpers: { canSend: boolean; onSend: () => void }) => ReactNode` prop to `InputProps` and replace the send/stop/model-selector JSX block in `Input.tsx` with a conditional that calls `renderFooterActions` when provided
- [x] 1.3 Verify existing `Input` behaviour is unchanged: lint + build `conversation-input` lib (`pnpm nx lint conversation-input && pnpm nx build conversation-input`)

## 2. Create EditMessageInput component (libs/conversation-input)

- [x] 2.1 Create `libs/conversation-input/src/components/EditMessageInput/EditMessageInput.tsx` — wraps `Input` with `initialAttachments` and `renderFooterActions` rendering Cancel (neutral) and Save & Submit (primary) buttons
- [x] 2.2 Define `EditMessageInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`: `message`, `initialAttachments`, `onCancel`, `onSave(message, attachments)`, string props for button labels and aria labels
- [x] 2.3 Export `EditMessageInput` and `EditMessageInputProps` from `libs/conversation-input/src/index.ts`
- [x] 2.4 Lint + build lib to confirm no boundary violations

## 3. Wire edit state and handler in the app hook

- [x] 3.1 Add `editingMessageIds: Set<string>` state and `handleEditMessage`, `handleCancelEdit` to `useConversationHandlers` in `apps/chat/src/hooks/conversation/useConversationHandlers.ts`
- [x] 3.2 Implement `handleEditMessage(messageId, text, attachments)`: convert attachments → DTOs, update `messages[idx]`, slice to `[0..idx+1]`, append new empty assistant placeholder, `setConversation`, `saveConversation`, `startStream`, clear all `editingMessageIds`
- [x] 3.3 Guard `handleEditMessage` with `if (isStreaming) return` (same pattern as `handleRegenerateMessage`)
- [x] 3.4 Implement `handleCancelEdit(messageId)` — removes `messageId` from `editingMessageIds`

## 4. Update conversation-messages lib

- [x] 4.1 Add `onEdit?: () => void` to `MessageActionsProps` (already defined — verify it exists) and pass it through in `buildMessageActions.ts` when the message role is `User`
- [x] 4.2 Pass `onEdit` through `UserMessageBubble` props down to `MessageActions` (it is currently omitted at the call site in `UserMessageBubble.tsx`)

## 5. Wire ConversationView (apps/chat)

- [x] 5.1 Pass `onEdit: () => handleStartEdit(msg.id)` into `buildMessageActions` inside `ConversationView.tsx`, where `handleStartEdit` adds the id to `editingMessageIds`
- [x] 5.2 In `ConversationView.tsx`, conditionally render `<EditMessageInput>` in place of `<UserMessageBubble>` when `editingMessageIds.has(msg.id)`, passing `onCancel={handleCancelEdit}` and `onSave={handleEditMessage}`
- [x] 5.3 Disable the edit button (pass `disabled` to `onEdit` or omit handler) when `isStreaming` is `true`

## 6. i18n

- [x] 6.1 Add `"saveAndSubmit": "Save & Submit"` and `"cancel": "Cancel"` (if not already present) under `"actions"` in `apps/chat/src/i18n/locales/en.json`
- [x] 6.2 Add i18n key constants to `apps/chat/src/constants/translation-keys.ts` if not present
- [x] 6.3 Pass translated label strings from `ConversationView` into `EditMessageInput` props (lib takes strings, not keys)

## 7. Verification

- [x] 7.1 Run `pnpm nx lint conversation-input conversation-messages chat` — fix any errors
- [x] 7.2 Run `pnpm nx build conversation-input conversation-messages chat` — confirm clean build
- [x] 7.3 Run `pnpm nx affected --target=test --base=origin/development` — confirm no regressions
- [x] 7.4 Manual smoke test: edit a message, verify truncation and re-stream; open two edits, submit one, verify the other is silently cancelled; cancel an edit, verify original message restored
