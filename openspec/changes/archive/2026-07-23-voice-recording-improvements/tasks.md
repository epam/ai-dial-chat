## 1. Prop Interface Changes

- [x] 1.1 Remove `isTranscriptionSupported` and `onTranscribeAudio` props from `ConversationInput` in `libs/conversation-input/`; add `isAudioMessageSupported: boolean` and `onAttachAudio: (blob: Blob) => void`
- [x] 1.2 Update any shared TypeScript interfaces in `libs/chat-shared/` that reference the removed transcription props
- [x] 1.3 Update the call site in `apps/chat/src/` that passes the old props to `ConversationInput` — pass `isAudioMessageSupported` instead and wire `onAttachAudio` to the existing attachment pipeline (create a `File` from the blob, name it `voice-<iso-timestamp>.webm`, and attach it)

## 2. State Machine Simplification

- [x] 2.1 Simplify `useVoiceRecorder` state machine: remove `stopped`, `uploading`, and transcription `error` states; keep only `idle`, `recording`, and `permission-error`
- [x] 2.2 On stop (user clicks red mic button), call `onAttachAudio(blob)` immediately and transition to `idle` — no review step
- [x] 2.3 Remove the X (discard) button from the stopped state; the X button remains available only during `recording` and `permission-error`

## 3. Recording Timer

- [x] 3.1 Add an elapsed-seconds counter to `useVoiceRecorder` that increments every second via `setInterval` while `status === 'recording'`; reset to 0 when transitioning to `idle`
- [x] 3.2 Render the counter as a `MM:SS` formatted text node on the left side of the voice bar (replacing the red dot), using a monospaced/tabular-nums style so the width doesn't jump

## 4. Sliding-Window Waveform

- [x] 4.1 Replace the growing amplitude history array with a fixed-length ring buffer (200 slots) in the waveform canvas logic
- [x] 4.2 Update the RAF loop: each tick appends one RMS sample to the ring buffer (overwriting the oldest), then redraws all 200 bars across the full canvas width — new bars on the right, old bars scrolling left
- [x] 4.3 Ensure `ResizeObserver` re-renders the ring buffer content at the new canvas width without resetting the buffer

## 5. Voice Bar UI Cleanup

- [x] 5.1 Remove the confirm (checkmark-in-circle) button and the loading spinner from `VoiceBar` — they were only used in the stopped/uploading states
- [x] 5.2 Remove the red border and error text UI that was specific to transcription upload errors (keep the permission-denied error path)
- [x] 5.3 Update the mobile two-row layout: Row 1 = timer + waveform (full width); Row 2 = red mic button (recording) or X button (permission-error), right-aligned
- [x] 5.4 Add i18n keys for any new or changed user-visible strings (timer aria-label, updated permission-error message)

## 6. Spec Update

- [x] 6.1 Apply this change's delta spec to `openspec/specs/voice-recording-ui/spec.md` (archive step will do this automatically via `opsx:archive`, but verify the canonical spec reflects all changes)

## 7. Verification

- [x] 7.1 Run `npm exec nx lint conversation-input` and fix any errors
- [x] 7.2 Run `npm exec nx typecheck conversation-input` (or `npm exec nx build conversation-input`) and resolve type errors
- [x] 7.3 Manually test the recording flow in the browser: start recording, verify timer ticks and waveform scrolls smoothly, stop recording, verify audio attachment appears in the input
- [x] 7.4 Verify the mic button is hidden when `isAudioMessageSupported` is `false`
- [x] 7.5 Verify microphone permission denial shows the error state with an X button to dismiss
