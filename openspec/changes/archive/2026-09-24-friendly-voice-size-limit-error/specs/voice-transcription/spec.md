## MODIFIED Requirements

### Requirement: App-owned complete-file upload and routing

The app SHALL validate the complete dictation File against `transcribeSizeLimitBytes` before upload, reject only when its size exceeds the limit, and upload once through the existing file adapter using the user's bucket and session AbortSignal. It SHALL prefer `asrModelId` from AppConfigContext; otherwise it SHALL use the selected audio-capable deployment. Recognition retries SHALL reuse the uploaded URL. The same hook SHALL serve new conversation, existing conversation and app preview.

When the limit is exceeded, the app-edge hook `useAudioTranscription` SHALL translate `voiceRecording.tooLarge` with a `maxSize` interpolation value produced by `formatFileSize` from `@epam/ai-dial-chat-shared`. The value SHALL be based on the error's `limitBytes`, falling back to the configured `transcribeSizeLimitBytes` when `limitBytes` is absent. The message SHALL never contain a raw byte count, and SHALL tell the user to shorten the recording and try again. The English text SHALL be `Audio recording exceeds the {{maxSize}} limit. Please shorten the recording and try again.` `AudioTranscriptionError` in `libs/chat-hooks` SHALL continue to carry the raw `limitBytes` number; unit formatting and translation SHALL stay in the app.

#### Scenario: File exceeds the configured limit

- **WHEN** the completed recording exceeds `transcribeSizeLimitBytes`
- **THEN** `voiceRecording.tooLarge` is surfaced before any upload or recognition request

#### Scenario: Default limit is shown in megabytes

- **WHEN** the completed recording exceeds the default 5,242,880-byte limit
- **THEN** the error alert reads `Audio recording exceeds the 5 MB limit. Please shorten the recording and try again.`
- **AND** the draft is preserved and no upload is attempted

#### Scenario: Non-integral limit is formatted, not shown in bytes

- **WHEN** `transcribeSizeLimitBytes` is 5,000,000 and the recording exceeds it
- **THEN** `maxSize` is `4.8 MB`, as returned by `formatFileSize`

#### Scenario: Error without limitBytes falls back to the configured limit

- **WHEN** an `AudioTranscriptionError` with reason `TooLarge` has no `limitBytes`
- **THEN** `maxSize` is `formatFileSize(transcribeSizeLimitBytes)`

#### Scenario: Dedicated ASR configured

- **WHEN** `asrModelId` is configured and the voice-input UI feature is enabled
- **THEN** dictation uses the ASR adapter even if the selected conversation model accepts no audio

#### Scenario: Selected-deployment fallback

- **WHEN** ASR is not configured and the selected deployment accepts audio
- **THEN** the app uses the existing `/api/v1/chat/completions` wrapper with the recorded audio attachment and transcription-only instruction
- **AND** no fragment or speech-text streaming request is used
