## Why

The current voice recording UI conflates audio capture with transcription, adds unnecessary friction via a confirm/discard step, and has a waveform visualisation that feels janky. Models capable of understanding audio attachments directly don't need transcription, so the flow should treat the recorded audio like any other file attachment — simpler, faster, and model-capability-aware.

## What Changes

- **BREAKING** Replace `isTranscriptionSupported` prop with `isAudioMessageSupported` on `ConversationInput`; the mic button is shown only when the active model supports audio messages.
- **BREAKING** Remove the stopped/review state (accept/discard step). When the user stops recording the audio file is immediately attached to the message input — no extra confirm click required.
- **BREAKING** Remove transcription flow: `onTranscribeAudio` prop and all uploading/transcribing/error states that were specific to transcription are removed. The audio blob is attached via the existing `onAttachFile` (or equivalent attachment) callback.
- Replace the red dot recording indicator with a live MM:SS elapsed timer shown on the left of the waveform.
- Change the waveform animation from a left-to-right growing history to a sliding/scrolling window — new bars appear on the right and old ones scroll off the left, giving a continuous real-time feel.

## Capabilities

### New Capabilities

- (none — all changes are modifications to the existing capability)

### Modified Capabilities

- `voice-recording-ui`: Requirements are changing across the mic-button gating condition, the recording/stopped state machine, the waveform animation behaviour, the timer indicator, and the attachment vs. transcription flow.

## Impact

- `libs/conversation-input/` — `ConversationInput` component and its voice-recording sub-components (`VoiceBar`, `useVoiceRecorder` hook, waveform canvas logic).
- `apps/chat/src/` — any call site that passes `isTranscriptionSupported` or `onTranscribeAudio` to `ConversationInput` must be updated to pass `isAudioMessageSupported` instead.
- `libs/chat-shared/` — any shared types/interfaces referencing transcription props need updating.
- No backend changes required; audio is attached as a regular file, not routed through a transcription endpoint.
