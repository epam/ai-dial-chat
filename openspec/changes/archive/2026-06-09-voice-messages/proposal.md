## Why

Typing long messages is slow and friction-heavy, especially on mobile. Allowing users to record a voice message and have it transcribed by the currently selected model lets them compose inputs hands-free and faster, using capabilities the model already provides.

## What Changes

- Add a microphone icon button to the right side of `ConversationInput`. Shown only when the selected model supports audio input (detected from `inputAttachmentTypes`); hidden entirely otherwise. Not disabled when other attachment uploads are in progress.
- Introduce a **voice bar** that replaces the conversation input during recording and post-recording review. It shares the same `welcomeText` header as the regular input. The bar itself is 56 px tall (40 px inner height + `py-2` padding) with `px-3 gap-2` and `Controls/Background/Neutral` background.
- **During recording**: voice bar shows a red dot circle indicator on the left of the waveform, a live animated waveform, and a red mic button on the right. Clicking the mic stops recording.
- **After stopping**: waveform freezes; X (discard) and a white-checkmark-in-accent-primary-circle (confirm) buttons appear. On mobile the waveform is always full-width and buttons (mic during recording; X and checkmark after stopping) are always on a separate line below, right-aligned.
- **On confirm (checkmark)**:
  1. Upload the recorded audio file to DIAL storage (same path as regular attachment upload). Show a generic loader.
  2. Send the storage reference as an attachment in a message to the currently selected model.
  3. On success: extract the transcript, populate the conversation input with it, clear the audio, and return to the normal input view.
  4. On upload or transcription failure: remain on the voice bar and display an error — red border around the bar and an error text (UI kit) underneath.
- Extend the backend API to pass `inputAttachmentTypes` from DIAL Core through to API consumers on model/deployment objects.
- Add a client-side utility `isAudioTranscriptionSupported` that returns `true` when `inputAttachmentTypes` contains `"*/*"` or `"audio/*"`.

## Capabilities

### New Capabilities

- `voice-recording-ui`: In-browser microphone recording UI — mic button in conversation input, voice bar with live waveform, stop/discard/confirm controls, error states, mobile layout variant.
- `voice-transcription`: Upload recorded audio to DIAL storage, send as attachment to the selected model, insert the resulting transcript into the conversation input.

### Modified Capabilities

- `conversation-input-attachments`: `inputAttachmentTypes` from the selected model is now also used for audio capability detection client-side.
- `deployments-api`: Backend must pass `inputAttachmentTypes` from DIAL Core through to API consumers on model/deployment DTOs.

## Impact

- **`libs/conversation-input`**: New mic button and voice bar component; show/hide logic based on `inputAttachmentTypes`.
- **`apps/chat-api` (NestJS backend)**: Extend model/deployment DTOs and DIAL Core mapping to include `inputAttachmentTypes`.
- **New client utility** `isAudioTranscriptionSupported(inputAttachmentTypes: string[]): boolean` — in a shared lib.
- **Reuses** existing DIAL storage upload infrastructure and chat completions attachment flow.
- **Browser API**: Uses `MediaRecorder` / `getUserMedia`; requires microphone permission at runtime.
