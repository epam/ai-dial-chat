# Spec: conversation-input-shared-hooks

## Purpose

Specifies four shared hooks under `apps/chat/src/hooks/conversation/` — `useAttachmentUpload`, `useAudioTranscription`, `useModelSelectorLabels`, `useChatSettingsFormConfig` — that consolidate logic previously duplicated across `ConversationRoute.tsx`, `Conversation.tsx`, `ConversationView.tsx`, and `useConversationHandlers.ts`. These are internal implementation-unit contracts (inputs/outputs/behavior of the hooks themselves), not new user-facing product capabilities.

---

## Requirements

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

`apps/chat/src/hooks/conversation/useAudioTranscription.ts` SHALL accept `{ selectedDeploymentId?: string | null }` and return `{ isAudioMessageSupported: boolean; isVoiceRecordingSupported: boolean; handleTranscribeAudio: TranscribeAudio }`. It SHALL be the single audio-capability and recognition entry point used by `ConversationRoute.tsx`, `Conversation.tsx` and `AppPreviewChat.tsx`.

The hook SHALL read every other input from context rather than from its parameters: the bucket from `useUser()`, `asrModelId` and `transcribeSizeLimitBytes` from `useAppConfig().config`, the deployment list from `useDeployments()`, and the effective voice-input flag from `useUiFeature(OverlayFeature.VoiceInput)`. It SHALL NOT accept `bucket`, `transcribeSizeLimitBytes` or `asrModelId` as parameters.

The hook SHALL derive two distinct capability flags, memoised with `useMemo` for the deployment lookup:

- `isVoiceRecordingSupported` SHALL be `true` only when the voice-input feature is enabled **and** the deployment resolved by `findDeploymentByIdOrReference(items, selectedDeploymentId)` reports audio support through `isAudioTranscriptionSupported(inputAttachmentTypes)`.
- `isAudioMessageSupported` SHALL be `true` when the voice-input feature is enabled **and** either `asrModelId` is configured or `isVoiceRecordingSupported` is `true`.

Upload, provider routing, size validation and retries SHALL be delegated to `useTranscribeAudio` from `@epam/ai-dial-chat-hooks`, configured with the generated `transcriptionApi` and `filesApi` instances, `transcribeWithDeployment: transcribeAudio` from `server-api/chat.api`, the resolved bucket, `maxSizeBytes: transcribeSizeLimitBytes`, and `asrModelId` only when `isAudioMessageSupported` is `true`. The hook SHALL NOT implement upload or recognition itself, and SHALL NOT reference the removed `transcribeAudioWithAsrModel` wrapper.

`handleTranscribeAudio` SHALL be memoised with `useCallback` and SHALL translate failures into host-facing messages through `t()` with keys from `VoiceRecordingI18nKeys`: `Unavailable` when dictation is not supported or the reason is `AudioTranscriptionErrorReason.Unavailable`, `TooLarge` (interpolating `limit` from the error's `limitBytes`) for `TooLarge`, `Busy` for `Busy`, and `Failed` for any other failure. When the caller's `AbortSignal` is already aborted, the original error SHALL be rethrown untranslated so cancellation is distinguishable from failure.

Feature gating is the existing `OverlayFeature.VoiceInput` (`voice-input`) entry resolved from `ENABLED_UI_FEATURES`; the hook introduces no role gate of its own. RTL impact: none — the hook renders no UI.

#### Scenario: Recognition is delegated to the shared hook

- **WHEN** `handleTranscribeAudio` is called with a recording while `isAudioMessageSupported` is `true`
- **THEN** the call is forwarded to `useTranscribeAudio`, which performs the upload and routes recognition to the ASR adapter when `asrModelId` is configured and to the selected deployment otherwise
- **AND** the hook itself issues no upload or transcription request

#### Scenario: Dictation attempted while unsupported

- **WHEN** `handleTranscribeAudio` is called while `isAudioMessageSupported` is `false`
- **THEN** it rejects with `t(VoiceRecordingI18nKeys.Unavailable)` before any upload or recognition request

#### Scenario: Oversized recording surfaces a translated message

- **WHEN** `useTranscribeAudio` raises `AudioTranscriptionError` with reason `TooLarge` and a `limitBytes` value
- **THEN** `handleTranscribeAudio` rejects with `t(VoiceRecordingI18nKeys.TooLarge, { limit: limitBytes })`

#### Scenario: The two capability flags diverge

- **WHEN** `asrModelId` is configured, the voice-input feature is enabled, and the selected deployment accepts no audio MIME type
- **THEN** `isAudioMessageSupported` is `true` and `isVoiceRecordingSupported` is `false`
- **AND** the caller renders the Dictate microphone while omitting the "Record voice" menu item

#### Scenario: Cancellation is not translated

- **WHEN** recognition rejects and the caller's `AbortSignal` is already aborted
- **THEN** the original error is rethrown unchanged rather than replaced by a `voiceRecording.*` message

### Requirement: useModelSelectorLabels hook

`apps/chat/src/hooks/conversation/useModelSelectorLabels.ts` SHALL accept `{ isLoading, error, itemCount }` and return an object with `ariaLabel`, `loading`, `error`, `empty`, `searchPlaceholder`, `closeLabel`, and `unavailableTooltip` string fields, sourced via `useTranslation()` using keys from `DeploymentsI18nKeys` and `BasicI18nKeys` in `translation-keys.ts`. No raw string literals are used for any label.

#### Scenario: Labels are consistent across both surfaces

- **WHEN** `ConversationRoute.tsx` and `ConversationView.tsx` both render a model selector using `useModelSelectorLabels`
- **THEN** both surfaces display identical label text and language-key resolution for the same `isLoading`/`error`/`itemCount` inputs

### Requirement: useChatSettingsFormConfig hook

`apps/chat/src/hooks/conversation/useChatSettingsFormConfig.ts` SHALL accept a discriminated-union options object — `{ mode: 'local'; values: ChatSettingsValues; onValuesChange; deploymentFeatures?; isQuickApp? }` for new-chat usage or `{ mode: 'conversation'; conversation; onConversationChange; deploymentFeatures?; isQuickApp? }` for existing-conversation usage — and return the `chatSettings` prop object expected by `@epam/ai-dial-conversation-input` (features, values, `onSave`, and all i18n label strings sourced from `ChatSettingsI18nKeys` / `ChatI18nKeys.ChatSettings`).

When `isQuickApp` is `true`, the returned `features.temperature` SHALL be `false` regardless of `deploymentFeatures?.temperature` — a Quick App's orchestrator configuration sets its own fixed temperature, so the per-conversation temperature control MUST stay hidden. Callers (`NewConversationComposer.tsx`, `ConversationView.tsx`) SHALL derive `isQuickApp` via `isQuickAppSchema({ id: selectedDeployment?.applicationTypeSchemaId })`.

#### Scenario: Temperature is hidden for Quick App deployments

- **WHEN** `useChatSettingsFormConfig` is called with `isQuickApp: true` and `deploymentFeatures.temperature === true`
- **THEN** the returned `chatSettings.features.temperature` is `false`, so no temperature slider is rendered, in both new-chat (`AppPreviewChat`'s pre-conversation composer) and existing-conversation (`ConversationView`) usage

#### Scenario: Local mode wires values directly

- **WHEN** `useChatSettingsFormConfig` is called with `mode: 'local'` from `ConversationRoute.tsx`
- **THEN** the returned `chatSettings.values` reflects the passed-in `values`, and `onSave` invokes `onValuesChange` with the updated values without persisting to a conversation

#### Scenario: Conversation mode wires the target conversation

- **WHEN** `useChatSettingsFormConfig` is called with `mode: 'conversation'` from `ConversationView.tsx`
- **THEN** the returned `chatSettings.values` reflects the given `conversation`'s settings, and `onSave` invokes `onConversationChange` with the updated conversation

#### Scenario: Shared label wiring is identical across modes

- **WHEN** the hook is used in either `mode: 'local'` or `mode: 'conversation'`
- **THEN** every i18n label string in the returned `chatSettings` object resolves via the same `ChatSettingsI18nKeys` / `ChatI18nKeys.ChatSettings` keys, with no per-surface label divergence
