## 1. useAttachmentUpload

- [x] 1.1 Create `apps/chat/src/hooks/conversation/useAttachmentUpload.ts` accepting `{ bucket, onNetworkError? }` and returning `{ handleUploadAttachment }`, encapsulating `uploadFile`, `buildUploadPath`, offline detection, `NETWORK_ERROR_DEBOUNCE_MS` batching, and `AttachmentErrorReason.Network` tagging
- [x] 1.2 Add `hooks/conversation/tests/useAttachmentUpload.spec.ts` covering: successful upload, offline detection + debounced batch notification, no-callback case
- [x] 1.3 Migrate `pages/ConversationRoute/ConversationRoute.tsx` (~lines 307–364) to consume `useAttachmentUpload`, removing the inline implementation and the duplicated network-error notification JSX
- [x] 1.4 Refactor `hooks/conversation/useConversationHandlers.ts` (~lines 90–126) to use `useAttachmentUpload` internally, passing a `showNetworkError` callback instead of reimplementing upload logic
- [x] 1.5 Extend `useConversationHandlers.spec.ts` upload tests to assert the extracted-hook behavior is preserved
- [x] 1.6 Verify: `npm exec nx test @epam/chat`, `npm exec nx lint @epam/chat`

## 2. useAudioTranscription

- [x] 2.1 Create `apps/chat/src/hooks/conversation/useAudioTranscription.ts` accepting `{ bucket, transcribeSizeLimitBytes, asrModelId?, selectedDeploymentId? }` and returning `{ handleUploadAudio, handleTranscribeAudio, isTranscriptionSupported }`
- [x] 2.2 Move `lastAudioMimeTypeRef`, size-limit check, and `transcribeAudio`/`transcribeAudioWithAsrModel` dispatch into the hook
- [x] 2.3 Move `isTranscriptionSupported` logic from `Conversation.tsx` (~lines 99–105) into the hook (or a small internal `useIsTranscriptionSupported` helper)
- [x] 2.4 Add `hooks/conversation/tests/useAudioTranscription.spec.ts` covering: within-limit transcription, over-limit rejection, transcription-support flag
- [x] 2.5 Migrate `pages/ConversationRoute/ConversationRoute.tsx` (~lines 366–410) and `pages/Conversation/Conversation.tsx` (~lines 107–146) to consume the hook
- [x] 2.6 Verify: `npm exec nx test @epam/chat`, `npm exec nx lint @epam/chat`

## 3. useModelSelectorLabels

- [x] 3.1 Create `apps/chat/src/hooks/conversation/useModelSelectorLabels.ts` accepting `{ isLoading, error, itemCount }` and returning `{ ariaLabel, loading, error, empty, searchPlaceholder, closeLabel }` via `useTranslation()` + `DeploymentsI18nKeys`/`BasicI18nKeys`
- [x] 3.2 Add `hooks/conversation/tests/useModelSelectorLabels.spec.ts` covering label resolution for loading/error/empty/populated states
- [x] 3.3 Migrate `pages/ConversationRoute/ConversationRoute.tsx` (~lines 235–248) and `components/ConversationView/ConversationView.tsx` (~lines 297–310) to consume the hook
- [x] 3.4 Verify: `npm exec nx test @epam/chat`, `npm exec nx lint @epam/chat`

## 4. useChatSettingsFormConfig

- [x] 4.1 Create `apps/chat/src/hooks/conversation/useChatSettingsFormConfig.ts` accepting the `mode: 'local' | 'conversation'` discriminated options object and returning the `chatSettings` prop object for `@epam/ai-dial-conversation-input`
- [x] 4.2 Wire shared `t(ChatSettingsI18nKeys.*)` / `t(ChatI18nKeys.ChatSettings)` label logic once inside the hook for both modes
- [x] 4.3 Add `hooks/conversation/tests/useChatSettingsFormConfig.spec.ts` covering `mode: 'local'` save behavior, `mode: 'conversation'` save behavior, and shared label consistency across modes
- [x] 4.4 Migrate `pages/ConversationRoute/ConversationRoute.tsx` (~lines 187–233) to `mode: 'local'` and `components/ConversationView/ConversationView.tsx` (~lines 429–485) to `mode: 'conversation'`
- [x] 4.5 Remove now-unused duplicated `useMemo` blocks and handler definitions from both surfaces
- [x] 4.6 Verify: `npm exec nx test @epam/chat`, `npm exec nx lint @epam/chat`

## 5. Extract ThemesModule

- [x] 5.1 Create `apps/chat-api/src/themes/themes.module.ts` with `controllers: [ThemeController]`, `providers: [ThemeService]` (no `exports` unless a consumer is found), following `apps/chat-api/src/deployments/deployments.module.ts`
- [x] 5.2 Import `ThemesModule` into `AppModule` alongside `DeploymentsModule`, `ModelsModule`, etc.
- [x] 5.3 Remove direct `ThemeController`/`ThemeService` registration and now-unused imports from `apps/chat-api/src/app/app.module.ts`
- [x] 5.4 Update `themes/tests/theme.controller.spec.ts` and `theme.service.spec.ts` module bootstrapping only if they previously imported `AppModule` directly; leave assertions unchanged
- [x] 5.5 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`

## 6. Full verification

- [x] 6.1 Run `npm exec nx affected --target=test,lint,build --base=origin/development-1.0` and confirm all affected `@epam/chat` and `chat-api` targets pass
- [x] 6.2 Confirm no OpenAPI/generated-client diff: `npm run openapi:check` reports no changes
