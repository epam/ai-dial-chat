## 1. Shared Types (libs/chat-shared)

- [x] 1.1 Add `StageStatus` enum to `libs/chat-shared/src/models/chat.ts` with `Completed = 'completed'` and `Failed = 'failed'` values
- [x] 1.2 Add `Stage` interface to `libs/chat-shared/src/models/chat.ts` with fields `index: number`, `name: string`, `status: StageStatus | null`
- [x] 1.3 Extend `StreamChunkDelta` in `libs/chat-shared/src/models/chat.ts` with optional `custom_content?: { stages?: Stage[] }`
- [x] 1.4 Add optional `stages?: Stage[]` to the `Message` interface in `libs/chat-shared/src/models/chat.ts`
- [x] 1.5 Re-export `StageStatus` and `Stage` from `libs/chat-shared/src/index.ts`
- [x] 1.6 Run `npm nx build chat-shared` and confirm zero TypeScript errors

## 2. Streaming Handler (apps/chat)

- [x] 2.1 In `apps/chat/src/pages/Conversation/Conversation.tsx`, update `onChunk` to read `chunk.choices[0]?.delta?.custom_content?.stages`
- [x] 2.2 Implement upsert-by-index merge: for each incoming stage replace the entry with matching `index` or append if not found, then sort ascending by `index`
- [x] 2.3 Apply the merge inside the functional `setConversation` updater alongside the existing text-token accumulation
- [x] 2.4 Confirm that chunks without `custom_content` leave existing `stages` intact
- [x] 2.5 Run `npm nx typecheck chat` (or build) to confirm zero errors in `Conversation.tsx`

## 3. StagesPanel Component (apps/chat)

- [x] 3.1 Create folder `apps/chat/src/components/StagesPanel/` and file `StagesPanel.tsx`
- [x] 3.2 Define `StagesPanelProps` interface: `stages: Stage[]`, `isStreaming: boolean`, `defaultOpen?: boolean`
- [x] 3.3 Implement collapsed/expanded toggle state with `useState(true)` default; update based on `defaultOpen` prop on mount
- [x] 3.4 Render panel header row with `role="button"`, `aria-expanded`, `aria-label` using i18n key `stages.panel.collapseAriaLabel`; bind `onClick` and `onKeyDown` (Enter / Space) handlers
- [x] 3.5 Render panel header label using i18n key `stages.panel.header` (default `"Steps"`)
- [x] 3.6 Render stage list with `role="list"`; each row uses `role="listitem"`
- [x] 3.7 Map stage status to icon: `null` → `<IconLoader2 className="animate-spin" />`, `StageStatus.Completed` → `<IconCheck />`, other → `<IconX />`
- [x] 3.8 Add i18n keys `stages.panel.header` and `stages.panel.collapseAriaLabel` to `apps/chat/src/i18n/locales/en.json`

## 4. ConversationView Integration

- [x] 4.1 Import `StagesPanel` and `Stage` into `ConversationView.tsx`
- [x] 4.2 For each assistant message with a non-empty `stages` array, render `<StagesPanel stages={msg.stages} isStreaming={isStreaming} />` immediately above the `<MessageBubble>`
- [x] 4.3 Ensure `isStreaming` is `true` only for the last message while `isAssistantTyping` is `true`
- [x] 4.4 Confirm user messages and assistant messages without stages do not render `StagesPanel`

## 5. Tests

- [x] 5.1 Create `apps/chat/src/components/StagesPanel/tests/StagesPanel.spec.tsx`
- [x] 5.2 Write test: renders all stage rows when open
- [x] 5.3 Write test: `status: null` → `IconLoader2` with `animate-spin`
- [x] 5.4 Write test: `status: StageStatus.Completed` → `IconCheck`
- [x] 5.5 Write test: non-null non-completed status → `IconX`
- [x] 5.6 Write test: clicking the header toggles panel open/closed
- [x] 5.7 Write test: pressing Enter on the header toggles panel
- [x] 5.8 Run `npm nx test chat` and confirm all new tests pass

