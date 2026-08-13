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

### Requirement: onUploadAudio and onTranscribeAudio callbacks on ConversationInput

`ConversationInputProps` SHALL accept two optional callbacks:

```ts
onUploadAudio?: (file: File, contentType: string) => Promise<string>
onTranscribeAudio?: (audioUrl: string) => Promise<string>
```

`onUploadAudio` receives the recorded `File` and its MIME type; resolves with the DIAL storage URL.
`onTranscribeAudio` receives the storage URL; resolves with the transcript text string.

The lib SHALL call these sequentially on checkmark confirm: first `onUploadAudio`, then `onTranscribeAudio` with the returned URL.

#### Scenario: Upload then transcription called in sequence

- **WHEN** the user confirms a recording
- **THEN** `onUploadAudio` is called first with the recorded file
- **THEN** `onTranscribeAudio` is called with the URL returned by `onUploadAudio`

#### Scenario: Transcription skipped when upload fails

- **WHEN** `onUploadAudio` rejects
- **THEN** `onTranscribeAudio` is NOT called
- **THEN** the voice bar enters error state

---

### Requirement: App-layer onUploadAudio implementation

The app (`apps/chat/src`) SHALL implement `onUploadAudio` by reusing the existing `uploadFile` infrastructure:

1. Wrap the `File` in an `Attachment` with the provided `contentType`.
2. Call `uploadFile(bucket, buildUploadPath(attachment), file)`.
3. Return the `url` from the response.

#### Scenario: Audio file uploaded to DIAL storage

- **WHEN** `onUploadAudio` is called with a recorded audio `File`
- **THEN** the file is uploaded to DIAL storage via the existing upload endpoint
- **THEN** the returned DIAL storage URL is a valid path accepted by `AttachmentDto.url`

---

### Requirement: App-layer onTranscribeAudio implementation via collectStream

The app SHALL implement `onTranscribeAudio` using a `collectStream` utility (`apps/chat/src/utils/collect-stream.ts`) that:

1. POSTs to `POST /api/conversations/completions` with body:
   ```json
   {
     "model": "<selectedModelId>",
     "message": "Transcribe the audio, return the content only, no extra",
     "custom_content": { "attachments": [{ "url": "<audioUrl>", "type": "<audioMimeType>" }] }
   }
   ```
2. Reads the SSE response stream, accumulating `content` deltas from each `data:` event.
3. Resolves with the full accumulated string when the stream closes or a `[DONE]` sentinel is received.
4. Rejects on any `event: error` SSE event or a non-2xx HTTP status.

#### Scenario: Successful transcription returns text

- **WHEN** the model returns a non-empty SSE stream with content deltas
- **THEN** `onTranscribeAudio` resolves with the full concatenated transcript

#### Scenario: Transcription failure rejects

- **WHEN** the completions endpoint returns a non-2xx status or an SSE error event
- **THEN** `onTranscribeAudio` rejects
- **THEN** the voice bar enters error state

#### Scenario: Transcript placed in conversation input

- **WHEN** `onTranscribeAudio` resolves
- **THEN** the transcript string is set as the conversation input text
- **THEN** the voice bar is dismissed and the normal input is shown

---

### Requirement: Audio format detection

The `useVoiceRecorder` hook SHALL detect the best supported MIME type at initialisation using `MediaRecorder.isTypeSupported()`, preferring in order:
1. `audio/webm;codecs=opus`
2. `audio/ogg;codecs=opus`
3. `audio/webm`
4. Browser default (empty string)

The detected MIME type SHALL be passed as `contentType` to `onUploadAudio`.

#### Scenario: Best supported format selected

- **WHEN** the browser supports `audio/webm;codecs=opus`
- **THEN** recordings are made in `audio/webm;codecs=opus` and that type is passed to `onUploadAudio`

#### Scenario: Fallback format used when preferred unavailable

- **WHEN** the browser does not support `audio/webm;codecs=opus` but supports `audio/webm`
- **THEN** recordings are made in `audio/webm`
