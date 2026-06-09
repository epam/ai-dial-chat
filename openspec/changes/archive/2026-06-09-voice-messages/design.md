## Context

`ConversationInput` is a library component (`libs/conversation-input`) that delegates file upload and message sending entirely via injected callbacks. Its inner `Input.tsx` renders an action bar with `AddAttachmentButton`, `ModelSelectorControl`, `StopButton`, and `SendButton`.

Full model metadata lives in `DeploymentsContext` (app layer) as `DeploymentItemDto[]`, but only a minimal `DeploymentItem` (id, displayName, iconUrl, type) is propagated to the library. The field `inputAttachmentTypes` exists on `DialModelDto` / `ApplicationDto` from DIAL Core but is not currently surfaced through `DeploymentItemDto` or `DeploymentItem`.

Attachment upload goes through `onUploadAttachment(attachment) → Promise<string>` (DIAL storage URL). Transcription will follow a similar injected-callback pattern to preserve lib isolation.

## Goals / Non-Goals

**Goals:**
- Show a mic button in `ConversationInput` when the selected model supports audio input.
- Provide in-browser recording (live waveform, red dot indicator, stop/discard/confirm controls).
- Upload recorded audio to DIAL storage and send it to the selected model via the existing completions endpoint.
- Populate the conversation input with the returned transcript; surface upload and transcription errors in the voice bar.
- Expose `inputAttachmentTypes` through the backend API and shared model interface.

**Non-Goals:**
- Sending audio as a persistent attachment in a chat message (transcription only — audio is discarded after use).
- Max recording duration limits.
- Dedicated audio playback UI.
- Support for browsers without `MediaRecorder` / `getUserMedia` (feature simply stays hidden).

## Decisions

### 1. Lib isolation — injected callbacks over internal API knowledge

`libs/conversation-input` must not know about DIAL storage paths, API routes, or model selection. The app provides two callbacks:

```ts
onUploadAudio?: (file: File, contentType: string) => Promise<string>  // → DIAL storage URL
onTranscribeAudio?: (audioUrl: string) => Promise<string>             // → transcript text
```

And a computed boolean:

```ts
isTranscriptionSupported?: boolean
```

`isTranscriptionSupported` is computed in the app layer using the new utility:

```ts
// libs/chat-shared/src/utils/is-audio-transcription-supported.ts
export const isAudioTranscriptionSupported = (types?: string[]): boolean =>
  types?.some(t => t === '*/*' || t.startsWith('audio/')) ?? false;
```

**Alternative considered:** Pass the full `DeploymentItem` with `inputAttachmentTypes` into the lib and compute there. Rejected — the lib should not own capability-detection logic tied to DIAL Core semantics.

### 2. Transcription via existing SSE completions endpoint, buffered client-side

No new backend endpoint. `onTranscribeAudio` (injected by the app) calls the existing `POST /api/conversations/completions` with:

```json
{
  "model": "<selectedModelId>",
  "message": "Transcribe the audio, return the content only, no extra",
  "custom_content": { "attachments": [{ "url": "<dialStorageUrl>", "type": "<audioMimeType>" }] }
}
```

The SSE stream is consumed client-side and the accumulated delta text is returned as the transcript once the stream closes. This is implemented as a small `collectStream(url, body): Promise<string>` utility in the app layer (`apps/chat/src/utils/collect-stream.ts`) that reads the SSE `data:` events and concatenates content deltas.

**Alternative considered:** A dedicated `POST /api/transcriptions` backend endpoint making a non-streaming call. Rejected — the project only has the SSE completions endpoint; adding a second transport path adds backend complexity with no benefit.

### 3. Surfacing `inputAttachmentTypes` through the deployment pipeline

Add `inputAttachmentTypes?: string[]` to:

1. `DeploymentItemDto` (`apps/chat-api/src/deployments/dto/deployment-item.dto.ts`) — mapped from `DialModelDto.input_attachment_types`.
2. `DeploymentItem` interface (`libs/chat-shared/src/models/deployment.ts`).
3. The deployment mapping in `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` (copy the field through).

**Alternative considered:** Fetch per-model capabilities separately on demand. Rejected — the list endpoint already has all data; an extra request adds latency and complexity.

### 4. Recording state machine

Five states managed by a `useVoiceRecorder` hook inside `libs/conversation-input`:

| State | Visible UI |
|---|---|
| `idle` | Normal conv input + mic button (if supported) |
| `recording` | Voice bar: red dot · live waveform · red mic button |
| `stopped` | Voice bar: frozen waveform · X button · checkmark button |
| `uploading` | Voice bar: loader (replaces checkmark) |
| `error` | Voice bar: red border · error text below · X button · retry (checkmark) |

Transitions: `idle → recording` (mic click) · `recording → stopped` (mic click) · `stopped → uploading` (checkmark) · `uploading → idle` (success, transcript placed in input) · `uploading → error` (upload or transcription failure) · `stopped/error → idle` (X click).

### 5. Waveform visualization

Use `AnalyserNode` (Web Audio API) to sample `getByteTimeDomainData` at ~30 fps via `requestAnimationFrame`. Render as a bar histogram on a `<canvas>` element. During recording the canvas animates live; after stopping, the last frame is frozen (cancel `requestAnimationFrame`, keep final canvas state).

### 6. Audio format

Use `MediaRecorder` with preferred MIME type `audio/webm;codecs=opus` (Chrome/Edge/Firefox). Fall back to `audio/ogg;codecs=opus`, then `audio/webm`, then the browser default. Detect at hook initialisation with `MediaRecorder.isTypeSupported()`. The detected MIME type is passed as `contentType` to `onUploadAudio` so the backend sets the correct `Content-Type` on the DIAL storage upload.

## Risks / Trade-offs

- **Browser support** → `MediaRecorder` is available in all modern browsers but absent in some WebViews. Since `isTranscriptionSupported` also requires a capable model, the feature simply stays hidden — no degradation needed.
- **SSE stream buffering** → `collectStream` must handle partial chunks, `[DONE]` sentinel, and error events correctly. → Mitigation: use a well-tested SSE parser; treat any `event: error` as a transcription failure.
- **Audio MIME type mismatch** → The model may reject an `audio/webm` file. → Mitigation: `inputAttachmentTypes` already gates capability; the error path is handled with a voice-bar error state.
- **Long audio / large files** → No max-duration enforcement means potentially large uploads. → Accepted for iteration 1; a size warning can be added later.
- **Microphone permission denied** → `getUserMedia` throws `NotAllowedError`. → The `useVoiceRecorder` hook catches this and transitions to `error` state with an appropriate message.

## Open Questions

- None at this stage.
