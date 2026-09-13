## MODIFIED Requirements

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
