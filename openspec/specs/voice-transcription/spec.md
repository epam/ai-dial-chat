# voice-transcription Specification

## Purpose

Uploading recorded audio and transcribing it into the conversation input.

## Requirements

### Requirement: isAudioTranscriptionSupported utility

`libs/chat-shared` SHALL export a pure utility function:

```ts
export const isAudioTranscriptionSupported = (types?: string[]): boolean =>
  types?.some(t => t === '*/*' || t.startsWith('audio/')) ?? false;
```

It returns `true` when the array contains `"*/*"` or any `"audio/..."` MIME type, and `false` for `undefined`, empty, or non-matching arrays.

#### Scenario: Wildcard type returns true

- **WHEN** `isAudioTranscriptionSupported(['*/*'])` is called
- **THEN** it returns `true`

#### Scenario: Audio MIME type returns true

- **WHEN** `isAudioTranscriptionSupported(['image/png', 'audio/webm'])` is called
- **THEN** it returns `true`

#### Scenario: No audio type returns false

- **WHEN** `isAudioTranscriptionSupported(['image/png', 'application/pdf'])` is called
- **THEN** it returns `false`

#### Scenario: Undefined input returns false

- **WHEN** `isAudioTranscriptionSupported(undefined)` is called
- **THEN** it returns `false`

---

### Requirement: Audio format detection

The `useVoiceRecorder` hook SHALL choose a supported MediaRecorder format in this order: `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/webm`, then the browser default. The completed File SHALL contain all recorder blobs, including the final event, and use the actual recorder MIME type when provided. Its extension SHALL follow that MIME type. A standalone timeslice blob SHALL NOT be submitted for recognition.

#### Scenario: Preferred format supported

- **WHEN** the browser supports `audio/webm;codecs=opus`
- **THEN** that format is requested and the recorder's actual MIME type is retained in the completed File

#### Scenario: Browser-selected fallback

- **WHEN** none of the preferred types is supported and the browser records `audio/mp4`
- **THEN** the complete File has MIME type `audio/mp4` and an `.mp4` extension

---

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
- **AND** the app surfaces the unavailable/busy error immediately without waiting for a frontend retry

#### Scenario: Empty model content

- **WHEN** ASR returns no message content
- **THEN** the response contains an empty transcript and the input leaves the draft unchanged

### Requirement: Bounded cancellable recognition retries

`withTranscriptionRetry` SHALL immediately convert HTTP 429/503 recognition failures to an unavailable/busy error without retrying. It SHALL retry only recognition on HTTP 502/504, with at most two retries and at most 6 seconds of accumulated retry waiting. This waiting budget SHALL NOT be represented as a total request timeout. Retry-After SHALL accept seconds or an HTTP date and have a one-second minimum wait. A delay beyond the remaining budget SHALL end processing with an unavailable error rather than retry early. Without a valid header, 502/504 SHALL wait 2 then 4 seconds. Upload errors and other recognition failures SHALL NOT be retried by this helper.

#### Scenario: Gateway retry succeeds

- **WHEN** recognition receives HTTP 502 or 504 and then succeeds within the retry budget
- **THEN** it uses the same uploaded recording and the input inserts the result once

#### Scenario: Rate limit is not retried

- **WHEN** recognition receives HTTP 429 or 503
- **THEN** the helper reports `voiceRecording.busy` immediately and starts no retry timer

#### Scenario: Retry budget exhausted

- **WHEN** attempts or retry waiting exceed the allowed budget
- **THEN** the app reports `voiceRecording.busy` and retains the draft

#### Scenario: Cancel retry delay

- **WHEN** the session is aborted during a retry delay
- **THEN** the timer is cleared and no further recognition attempt starts
