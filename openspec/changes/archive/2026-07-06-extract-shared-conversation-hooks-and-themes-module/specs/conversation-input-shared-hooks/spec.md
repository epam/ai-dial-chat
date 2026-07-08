## ADDED Requirements

### Requirement: useAttachmentUpload hook

`apps/chat/src/hooks/conversation/useAttachmentUpload.ts` SHALL accept `{ bucket: string | undefined; onNetworkError?: (filenames: string[]) => void }` and return `{ handleUploadAttachment: (attachment: Attachment) => Promise<string> }`. The hook SHALL be the single implementation of attachment upload used by both `ConversationRoute.tsx` and `useConversationHandlers.ts`, replacing the two previously-duplicated inline implementations.

#### Scenario: Successful upload while online

- **WHEN** `handleUploadAttachment` is called with a valid attachment while the browser is online
- **THEN** the hook uploads the file via `server-api/files.api` using the path built by `buildUploadPath`, and resolves with the resulting file path

#### Scenario: Upload attempted while offline

- **WHEN** `handleUploadAttachment` is called for one or more attachments while `navigator.onLine` is `false`
- **THEN** the hook tags the failure with `AttachmentErrorReason.Network`, batches the affected filenames using the `NETWORK_ERROR_DEBOUNCE_MS` debounce window from `constants/upload.ts`, and invokes `onNetworkError` once per batch with the list of filenames

#### Scenario: No onNetworkError callback provided

- **WHEN** `useAttachmentUpload` is used without an `onNetworkError` callback (e.g. from `useConversationHandlers`)
- **THEN** the hook still performs offline detection and debounced batching internally without throwing, and simply does not emit a notification

### Requirement: useAudioTranscription hook

`apps/chat/src/hooks/conversation/useAudioTranscription.ts` SHALL accept `{ bucket, transcribeSizeLimitBytes, asrModelId?, selectedDeploymentId? }` and return `{ handleUploadAudio, handleTranscribeAudio, isTranscriptionSupported }`, consolidating the audio upload and transcription logic previously duplicated between `ConversationRoute.tsx` and `Conversation.tsx`.

#### Scenario: Audio within size limit is transcribed

- **WHEN** `handleTranscribeAudio` is called with a recording whose size is less than or equal to `transcribeSizeLimitBytes`
- **THEN** the hook uploads the audio via `uploadFile` and calls `transcribeAudio` or `transcribeAudioWithAsrModel` (from `server-api/chat.api`) depending on whether `asrModelId` is provided, and resolves with the transcription result

#### Scenario: Audio exceeds size limit

- **WHEN** `handleTranscribeAudio` is called with a recording larger than `transcribeSizeLimitBytes`
- **THEN** the hook rejects/short-circuits without calling `uploadFile` or the transcription API, matching current `Conversation.tsx` behavior

#### Scenario: Transcription support flag reflects deployment capability

- **WHEN** the caller reads `isTranscriptionSupported` for the current `selectedDeploymentId`
- **THEN** its value matches the logic previously implemented inline in `Conversation.tsx` (~lines 99–105), with no behavior change

### Requirement: useModelSelectorLabels hook

`apps/chat/src/hooks/conversation/useModelSelectorLabels.ts` SHALL accept `{ isLoading, error, itemCount }` and return an object with `ariaLabel`, `loading`, `error`, `empty`, `searchPlaceholder`, and `closeLabel` string fields, sourced via `useTranslation()` using keys from `DeploymentsI18nKeys` and `BasicI18nKeys` in `translation-keys.ts`. No raw string literals are used for any label.

#### Scenario: Labels are consistent across both surfaces

- **WHEN** `ConversationRoute.tsx` and `ConversationView.tsx` both render a model selector using `useModelSelectorLabels`
- **THEN** both surfaces display identical label text and language-key resolution for the same `isLoading`/`error`/`itemCount` inputs

### Requirement: useChatSettingsFormConfig hook

`apps/chat/src/hooks/conversation/useChatSettingsFormConfig.ts` SHALL accept a discriminated-union options object — `{ mode: 'local'; values: ChatSettingsValues; onValuesChange; deploymentFeatures? }` for new-chat usage or `{ mode: 'conversation'; conversation; onConversationChange; deploymentFeatures? }` for existing-conversation usage — and return the `chatSettings` prop object expected by `@epam/ai-dial-conversation-input` (features, values, `onSave`, and all i18n label strings sourced from `ChatSettingsI18nKeys` / `ChatI18nKeys.ChatSettings`).

#### Scenario: Local mode wires values directly

- **WHEN** `useChatSettingsFormConfig` is called with `mode: 'local'` from `ConversationRoute.tsx`
- **THEN** the returned `chatSettings.values` reflects the passed-in `values`, and `onSave` invokes `onValuesChange` with the updated values without persisting to a conversation

#### Scenario: Conversation mode wires the target conversation

- **WHEN** `useChatSettingsFormConfig` is called with `mode: 'conversation'` from `ConversationView.tsx`
- **THEN** the returned `chatSettings.values` reflects the given `conversation`'s settings, and `onSave` invokes `onConversationChange` with the updated conversation

#### Scenario: Shared label wiring is identical across modes

- **WHEN** the hook is used in either `mode: 'local'` or `mode: 'conversation'`
- **THEN** every i18n label string in the returned `chatSettings` object resolves via the same `ChatSettingsI18nKeys` / `ChatI18nKeys.ChatSettings` keys, with no per-surface label divergence
