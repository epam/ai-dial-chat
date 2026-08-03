## 1. Backend — expose inputAttachmentTypes

- [x] 1.1 Add `inputAttachmentTypes?: string[]` to `DeploymentItemDto` in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` with `@ApiProperty`
- [x] 1.2 Map `input_attachment_types` from DIAL Core response to `inputAttachmentTypes` in `deployments.service.ts`
- [x] 1.3 Add `inputAttachmentTypes?: string[]` to `DeploymentItem` interface in `libs/chat-shared/src/models/deployment.ts`
- [x] 1.4 Copy `inputAttachmentTypes` through in the deployment mapping in `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`
- [x] 1.5 Run `npm run openapi` to regenerate `@epam/chat-api-client` and verify the field appears in the generated DTO
- [x] 1.6 Update `deployments.service.spec.ts` to cover `inputAttachmentTypes` mapping (present and absent source field)

## 2. Shared utility

- [x] 2.1 Create `libs/chat-shared/src/utils/is-audio-transcription-supported.ts` with `isAudioTranscriptionSupported(types?: string[]): boolean`
- [x] 2.2 Export the utility from `libs/chat-shared/src/index.ts`
- [x] 2.3 Add unit tests for all four scenarios (wildcard, audio MIME, no audio, undefined)

## 3. App-layer — collectStream utility

- [x] 3.1 Create `apps/chat/src/utils/collect-stream.ts` — `collectStream(url, body): Promise<string>` that POSTs to the completions endpoint, reads the SSE stream, accumulates content deltas, and rejects on error events or non-2xx status

## 4. App-layer — audio upload and transcription callbacks

- [x] 4.1 Implement `onUploadAudio` in `apps/chat/src/hooks/conversation/useConversationHandlers.ts` — wrap the audio `File` as an `Attachment` and reuse `uploadFile` / `buildUploadPath`
- [x] 4.2 Implement `onTranscribeAudio` using `collectStream`, sending the fixed transcription prompt with the audio URL as an attachment and the selected model ID
- [x] 4.3 Derive `isTranscriptionSupported` from the selected deployment's `inputAttachmentTypes` using `isAudioTranscriptionSupported` and pass it down to `ConversationInput`
- [x] 4.4 Wire `onUploadAudio`, `onTranscribeAudio`, and `isTranscriptionSupported` into the `ConversationInput` usage in `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`

## 5. lib/conversation-input — props and types

- [x] 5.1 Add `isTranscriptionSupported?: boolean`, `onUploadAudio?`, and `onTranscribeAudio?` to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`
- [x] 5.2 Thread the three new props through to `InputProps` in `libs/conversation-input/src/models/Input.ts`

## 6. lib/conversation-input — useVoiceRecorder hook

- [x] 6.1 Create `libs/conversation-input/src/hooks/useVoiceRecorder.ts` implementing the 5-state machine (idle / recording / stopped / uploading / error)
- [x] 6.2 Implement audio format detection using `MediaRecorder.isTypeSupported()` with the preferred fallback order
- [x] 6.3 Implement `getUserMedia` + `MediaRecorder` recording start/stop with `NotAllowedError` catch → error state
- [x] 6.4 Implement `AnalyserNode` waveform sampling at ~30 fps via `requestAnimationFrame`; compute RMS amplitude per frame and accumulate into a `Float32Array` history. On stop, cancel the RAF loop and preserve the last written frame (do not re-read the analyser after stop).
- [x] 6.5 Implement confirm flow: call `onUploadAudio` then `onTranscribeAudio` sequentially; transition to uploading → idle (success) or error (failure)
- [x] 6.6 Implement discard and cancel transitions (X button, X during uploading)

## 7. lib/conversation-input — VoiceBar component

- [x] 7.1 Create `libs/conversation-input/src/components/VoiceBar/VoiceBar.tsx` — desktop layout: red dot (recording only) · waveform canvas · controls (mic / X+checkmark / loader+X)
- [x] 7.2 Implement mobile layout: waveform full-width on row 1, buttons right-aligned on row 2 (both during recording and after)
- [x] 7.3 Implement error state: red border around bar, UI kit error text below
- [x] 7.4 Implement the waveform `<canvas>` renderer: accumulate one RMS amplitude value per RAF frame into a history buffer; render full history as 3 px-wide vertical bars with 1 px gap, colour `--text-primary`, amplitude scaled ×6 (clamped to 1). Attach `ResizeObserver` so the canvas redraws at the correct width on every layout change. Canvas height: `h-8` mobile / `h-6` desktop.
- [x] 7.5 Add mic ghost icon button (UI kit `GhostIconButton`, 40 px / 24 px icon) with red icon during recording

## 8. lib/conversation-input — integrate into ConversationInput / Input

- [x] 8.1 Add mic ghost icon button to the right of the action bar in `Input.tsx`; show only when `isTranscriptionSupported` is `true` **and the message field is empty** (`!message.trim()`)
- [x] 8.2 Render `VoiceBar` (replacing the input body) when voice state is not `idle`; keep `welcomeText` header visible above with correct gap
- [x] 8.3 On successful transcription, set the transcript as the input text value and return to idle state

## 9. Verification

- [x] 9.1 Verify mic button appears/disappears based on selected model's `inputAttachmentTypes`
- [x] 9.2 Verify full happy-path flow: record → stop → confirm → upload → transcribe → transcript in input
- [x] 9.3 Verify upload failure shows red border + error text; retry works
- [x] 9.4 Verify transcription failure shows red border + error text; retry works
- [x] 9.5 Verify X discards at every state (stopped, uploading, error) and restores normal input
- [x] 9.6 Verify mobile layout: waveform full-width, buttons on separate row in all states
- [x] 9.7 Verify microphone permission denial shows error state in voice bar
