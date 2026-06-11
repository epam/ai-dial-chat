# Implementation Tasks: Edit Message Save & Submit Tooltip

## 1. Prepare i18n Strings

- [x] 1.1 Verify or add i18n key for "Wait for attachment to load" tooltip in ChatI18nKeys (check if `waitForAttachmentToLoad` exists in `@/src/constants/chat.i18n`)
- [x] 1.2 Verify or add i18n key for "Please type message" tooltip in ChatI18nKeys
- [x] 1.3 Verify or add i18n key for "Wait for transcription to complete" tooltip in ChatI18nKeys
- [x] 1.4 If new keys added, update all locale translation files (Russian, French, etc.) with appropriate translations

## 2. Update UserMessage Component

- [x] 2.1 Open `@/src/components/Chat/ChatMessage/ChatMessageContent/UserMessage.tsx`
- [x] 2.2 Import `tooltipProps` type from `@epam/ai-dial-ui-kit` if not already present
- [x] 2.3 Create tooltip content generation logic that determines tooltip text based on disable conditions:
  - If `isUploadingAttachmentPresent`: use "Wait for attachment to load"
  - Else if `isContentEmptyAndNoAttachments`: use "Please type message"
  - Else if `isUserMessageTranscribing`: use "Wait for transcription to complete"
  - Else: `null` (no tooltip)
- [x] 2.4 Add `tooltipProps` object to the Save & Submit button with:
  - `tooltip`: the generated tooltip text (from 2.3)
  - `hideTooltip`: true when button is enabled (all disable conditions false)
  - `isTriggerClickable`: true (to allow clicking the button while tooltip is visible)
  - `triggerClassName`: appropriate classes (follow SendMessageButton pattern)
- [x] 2.5 Verify button still disables correctly with new tooltipProps added

## 3. Update AssistantMessage Component

- [x] 3.1 Open `@/src/components/Chat/ChatMessage/ChatMessageContent/AssistantMessage.tsx`
- [x] 3.2 Import `tooltipProps` type from `@epam/ai-dial-ui-kit` if not already present
- [x] 3.3 Create tooltip content generation logic that determines tooltip text based on disable conditions:
  - If `isUploadingAttachmentPresent`: use "Wait for attachment to load"
  - Else if `isContentEmptyAndNoAttachments`: use "Please type message"
  - Else: `null` (no tooltip, no transcription condition for assistant messages)
- [x] 3.4 Add `tooltipProps` object to the Save & Submit button with:
  - `tooltip`: the generated tooltip text (from 3.3)
  - `hideTooltip`: true when button is enabled (all disable conditions false)
  - `isTriggerClickable`: true
  - `triggerClassName`: appropriate classes (follow SendMessageButton pattern)
- [x] 3.5 Verify button still disables correctly with new tooltipProps added

## 4. Code Review & Polish

- [x] 4.1 Run lint only on changed files, ignoring pre-existing errors: `npm run nx lint chat -- --quiet` (use `--quiet` to suppress warnings and only report new errors introduced by this change)
- [x] 4.2 Run format only on changed files: `npx prettier --write apps/chat/src/components/Chat/ChatMessage/ChatMessageContent/UserMessage.tsx apps/chat/src/components/Chat/ChatMessage/ChatMessageContent/AssistantMessage.tsx`
- [x] 4.3 Verify TypeScript compilation: `npm run nx build chat` (or relevant build command)
- [x] 4.4 Review both modified files for consistency in tooltip handling and styling

## 5. Testing & Verification

- [x] 5.1 Start dev server: `npm run nx serve chat`
- [x] 5.2 In browser, initiate editing a user message and verify:
  - Tooltip "Wait for attachment to load" appears when trying to upload a file and button is disabled
  - Tooltip "Please type message" appears when message is empty and button is disabled
  - Tooltip "Wait for transcription to complete" appears during active transcription
  - Tooltip is hidden when message content is present and no uploads are pending
- [x] 5.3 In browser, initiate editing an assistant message and verify:
  - Tooltip "Wait for attachment to load" appears when trying to upload a file and button is disabled
  - Tooltip "Please type message" appears when message is empty and button is disabled
  - Tooltip is hidden when message content is present and no uploads are pending
  - (No transcription tooltip for assistant messages)
- [x] 5.4 Verify tooltip positioning, styling, and click behavior match other tooltips in the app (e.g., Send button)

## 6. Create/Update Unit Tests

- [x] 6.1 Find or create unit test file for UserMessage.tsx (typically `UserMessage.test.tsx` co-located or in `__tests__/`)
- [x] 6.2 Add unit tests for tooltip generation logic in UserMessage: assert correct tooltip text for each disable condition (file uploading, empty content, transcription) and that tooltip is hidden when enabled
- [x] 6.3 Find or create unit test file for AssistantMessage.tsx
- [x] 6.4 Add unit tests for tooltip generation logic in AssistantMessage: assert correct tooltip text for each applicable disable condition (file uploading, empty content) and that tooltip is hidden when enabled
- [x] 6.5 Run unit tests for changed files: `npm run nx test chat`

