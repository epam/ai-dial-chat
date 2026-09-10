## REMOVED Requirements

### Requirement: onUploadAudio and onTranscribeAudio callbacks on ConversationInput

**Reason**: The library no longer manages storage URLs or separate upload and recognition steps. Stop replaces the old checkmark confirmation.

**Migration**: Supply the host-owned `onTranscribeAudio(file, signal): Promise<string>` callback described below. Move upload into the app adapter. Use the existing attachment pipeline for Record voice.

### Requirement: App-layer onUploadAudio implementation

**Reason**: Dictation upload belongs inside the single app-level transcription callback, rather than a separate public library prop.

**Migration**: Use `useAudioTranscription.handleTranscribeAudio`, which validates and uploads the completed file with the session AbortSignal before recognition.

### Requirement: App-layer onTranscribeAudio implementation via collectStream

**Reason**: The current app consumes complete transcription responses through its ASR or selected-deployment adapter. It does not accumulate speech results through collectStream or the historical conversations endpoint.

**Migration**: Use configured ASR through TranscriptionApi or the existing selected-deployment chat wrapper. Append the completed result to the draft through the input callback.

## MODIFIED Requirements

### Requirement: Audio format detection

The `useVoiceRecorder` hook SHALL choose a supported MediaRecorder format in this order: `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/webm`, then the browser default. The completed File SHALL contain all recorder blobs, including the final event, and use the actual recorder MIME type when provided. Its extension SHALL follow that MIME type. A standalone timeslice blob SHALL NOT be submitted for recognition.

#### Scenario: Preferred format supported

- **WHEN** the browser supports `audio/webm;codecs=opus`
- **THEN** that format is requested and the recorder's actual MIME type is retained in the completed File

#### Scenario: Browser-selected fallback

- **WHEN** none of the preferred types is supported and the browser records `audio/mp4`
- **THEN** the complete File has MIME type `audio/mp4` and an `.mp4` extension

## ADDED Requirements

### Requirement: Host-owned file-to-text callback

`Input` and `ConversationInput` SHALL accept optional `onTranscribeAudio?: (file: File, signal: AbortSignal) => Promise<string>`. The library SHALL invoke it once with the complete recording in dictation mode after Stop. It SHALL contain no API routes, generated clients, auth, environment, deployment selection or upload storage conventions. `useAudioTranscription` in the app SHALL own validation, upload, provider routing and retries. Record voice SHALL bypass this callback even when supplied.

#### Scenario: Upload fails

- **WHEN** the app callback cannot upload the recording
- **THEN** no recognition request is made and the callback rejects to the recorder's error state

#### Scenario: Standalone library caller has no transcription callback

- **WHEN** a library caller starts and stops the microphone without providing recognition
- **THEN** the existing attachment callback receives the completed file

### Requirement: App-owned complete-file upload and routing

The app SHALL validate the complete dictation File against `transcribeSizeLimitBytes` before upload, reject only when its size exceeds the limit, and upload once through the existing file adapter using the user's bucket and session AbortSignal. It SHALL prefer `asrModelId` from AppConfigContext; otherwise it SHALL use the selected audio-capable deployment. Recognition retries SHALL reuse the uploaded URL. The same hook SHALL serve new conversation, existing conversation and app preview.

#### Scenario: File exceeds the configured limit

- **WHEN** the completed recording exceeds `transcribeSizeLimitBytes`
- **THEN** `voiceRecording.tooLarge` is surfaced before any upload or recognition request

#### Scenario: Dedicated ASR configured

- **WHEN** `asrModelId` is configured and the voice-input UI feature is enabled
- **THEN** dictation uses the ASR adapter even if the selected conversation model accepts no audio

#### Scenario: Selected-deployment fallback

- **WHEN** ASR is not configured and the selected deployment accepts audio
- **THEN** the app uses the existing `/api/v1/chat/completions` wrapper with the recorded audio attachment and transcription-only instruction
- **AND** no fragment or speech-text streaming request is used

### Requirement: Existing transcription API and generated client contract

`POST /api/v1/transcription` SHALL accept `TranscribeAudioDto` with string `audioUrl` and `mimeType` fields and return a JSON object with a `transcript` string. It SHALL use the configured ASR deployment via the shared DIAL SDK and the authenticated user's bearer token. Existing session and CSRF protection SHALL remain in force; this change SHALL introduce no additional role policy, endpoint, cache or per-route throttle.

Example request:

```json
{"audioUrl":"files/example-bucket/uploads/2026-09/voice-example.webm","mimeType":"audio/webm;codecs=opus"}
```

Example success body:

```json
{"transcript":"Please summarize this document."}
```

Invalid DTO fields SHALL use the existing 400 validation response. Unauthenticated or forbidden requests SHALL retain existing 401/403 handling. Missing ASR configuration SHALL yield 500. Upstream 429/503 SHALL yield 503, forwarding Retry-After when present; other upstream errors SHALL use the shared DIAL mapper, including 502 for other upstream server failures and 503 for connectivity failures. Existing shared 4xx mappings SHALL remain unchanged.

The OpenAPI operationId and SDK method SHALL remain `transcribeAudio`. Frontend callers SHALL use the normal `TranscriptionApi.transcribeAudio` method through `apps/chat/src/server-api/api-client.ts` and `chat.api.ts`, with request `{ transcribeAudioDto: { audioUrl, mimeType } }` and response `{ transcript?: string }` as currently generated. Swagger-generated 503 response headers SHALL document Retry-After. The selected-deployment fallback SHALL retain the documented `customContent`/`custom_content` generator exception at the app edge.

#### Scenario: Temporary ASR unavailability

- **WHEN** Core rejects ASR with 429 or 503 and `Retry-After: 30`
- **THEN** the API responds with 503 and preserves `Retry-After: 30`
- **AND** the generated client's rejected response retains the header for retry handling

#### Scenario: Empty model content

- **WHEN** ASR returns no message content
- **THEN** the response contains an empty transcript and the input leaves the draft unchanged

### Requirement: Bounded cancellable recognition retries

`withTranscriptionRetry` SHALL retry only recognition on HTTP 429/502/503/504, with at most two retries and at most 90 seconds of accumulated retry waiting. This waiting budget SHALL NOT be represented as a total request timeout. Retry-After SHALL accept seconds or an HTTP date and have a one-second minimum wait. A delay beyond the remaining budget SHALL end processing with an unavailable error rather than retry early. Without a valid header, 429/503 SHALL wait 30 then 60 seconds, and 502/504 SHALL wait 2 then 4 seconds. Upload errors and other recognition failures SHALL NOT be retried by this helper.

#### Scenario: Retry succeeds

- **WHEN** recognition fails temporarily then succeeds
- **THEN** it uses the same uploaded recording and the input inserts the result once

#### Scenario: Retry budget exhausted

- **WHEN** attempts or retry waiting exceed the allowed budget
- **THEN** the app reports `voiceRecording.busy` and retains the draft

#### Scenario: Cancel retry delay

- **WHEN** the session is aborted during a retry delay
- **THEN** the timer is cleared and no further recognition attempt starts
