## 1. Shared Types (libs/chat-shared)

- [x] 1.1 Add `StageStatus` enum to `libs/chat-shared/src/models/chat.ts` with `Completed = 'completed'`
- [x] 1.2 Add `Stage` interface with fields `index: number`, `name: string`, `status: StageStatus | null`, `content?: string`
- [x] 1.3 Extend `StreamChunkDelta.custom_content` with optional `stages?: Stage[]`
- [x] 1.4 Add optional `stages?: Stage[]` to `MessageCustomContent` (not directly on `Message`)
- [x] 1.5 Re-export `StageStatus` and `Stage` from `libs/chat-shared/src/index.ts`
- [x] 1.6 Build `chat-shared` and confirm zero TypeScript errors

## 2. Streaming Handler (apps/chat)

- [x] 2.1 In `Conversation.tsx`, update `onChunk` to read `chunk.choices[0]?.delta?.custom_content?.stages`
- [x] 2.2 Implement upsert-by-index merge for `stages`; sort ascending by `index` after each merge
- [x] 2.3 Accumulate `stage.content` by appending across chunks for the same stage index
- [x] 2.4 Apply the merge inside the functional `setConversation` updater alongside text-token accumulation
- [x] 2.5 Confirm chunks without `custom_content` leave existing stages intact

## 3. New `libs/conversation-stages` Library

- [x] 3.1 Scaffold library with `package.json` (`"license": "Apache-2.0"`, peer deps including `@epam/ai-dial-conversation-messages`), `vite.config.mts`, `tsconfig.lib.json`
- [x] 3.2 Create `StagesPanelColors` and `StagesPanelProps` interfaces in `src/models/StagesPanel.ts`
- [x] 3.3 Implement `StageIcon` — maps `{status, isLive}` to `DialSpinner` / `IconCircleCheck` / `IconAlertCircle`
- [x] 3.4 Implement `StageMarkdownContent` — wraps `MarkdownRenderer` with stage-specific class overrides and `StageCodeBlock` (copy button on code blocks)
- [x] 3.5 Implement `StageItem` — header row (icon + name); collapses/expands markdown content body when `stage.content` is present; uses CSS grid-rows transition
- [x] 3.6 Implement `StagesPanel` — flat list of `StageItem`s; computes `lastRunningStageIndex` for `isLive` prop; applies `StagesPanelColors` as CSS custom properties
- [x] 3.7 Export `StagesPanel`, `StagesPanelProps`, `StagesPanelColors` from `src/index.ts`
- [x] 3.8 Add `"license": "Apache-2.0"` to `package.json` (required by ORT license scan)

## 4. ConversationView Integration (apps/chat)

- [x] 4.1 Add `messageHasStages` utility to `apps/chat/src/utils/message-utils.ts`
- [x] 4.2 Import `StagesPanel` from `@epam/ai-dial-conversation-stages` in `ConversationView.tsx`
- [x] 4.3 Render `<StagesPanel stages={msg.custom_content?.stages ?? []} isStreaming={...} />` above the `MessageBubble` for assistant messages where `messageHasStages` returns true
- [x] 4.4 Pass `isStreaming={true}` only for the last message while `isAssistantTyping` is true
- [x] 4.5 Confirm user messages and assistant messages without stages do not render `StagesPanel`

## 5. Tests

- [x] 5.1 Create `libs/conversation-stages/src/components/StagesPanel/StagesPanel.spec.tsx`
- [x] 5.2 Write test: renders all stage rows when stages are provided
- [x] 5.3 Write test: `isLive=true` + `status: null` → `DialSpinner`
- [x] 5.4 Write test: `status: StageStatus.Completed` → `IconCircleCheck`
- [x] 5.5 Write test: non-null non-completed status → `IconAlertCircle`
- [x] 5.6 Run `npm exec nx test @epam/ai-dial-conversation-stages` and confirm all tests pass

## 6. CI / ORT Fix

- [x] 6.1 Add `"license": "Apache-2.0"` to `libs/conversation-stages/package.json` to resolve ORT `NO_LICENSE_IN_DEPENDENCY` violation
