## Why

Users need two distinct microphone actions: editable dictation and an audio attachment. Recognizing short fragments gave unsatisfactory results with the available models/Core, so recognition must process the complete recording after Stop.

This proposal records the final implementation already present in the working tree. It replaces the earlier experimental fragment-capture plan.

## Problem

A single microphone action did not distinguish text entry from audio attachments. Existing specifications also describe obsolete confirmation controls and separate upload/transcription callbacks. The requirements must match the two implemented entry points and their shared recording lifecycle.

## What Changes

- **Dictate** on the microphone button records a complete file, recognizes it after Stop, and appends the result to the draft.
- **Record voice** in the add menu, immediately before Settings, records an audio attachment without recognition.
- The waveform replaces the textarea during recording and processing in both modes. Keyboard input and sending are unavailable; existing draft state and attachments survive.
- The app prefers configured ASR for dictation; audio attachment recording requires audio support from the selected deployment. Both respect the existing voice-input UI feature.
- Transient recognition failures receive bounded, cancellable retries of the uploaded file. Upstream 429/503 remains temporary unavailability with Retry-After preserved.

## Solution

Reuse the existing recorder and attachment pipeline with a mode captured at session start. Keep upload, ASR routing, feature configuration, translations and retry policy at the application edge. Use a file-and-AbortSignal-to-text callback as the library boundary.

## Non-goals

Realtime or fragment recognition, a new provider, a hardcoded Whisper deployment, automatic sending, translation into the interface language, new global contexts, and changes to MCP Apps are outside this change.

## Capabilities

### New Capabilities

- `voice-dictation`: Complete-recording lifecycle, draft insertion, cancellation and availability of the two modes.

### Modified Capabilities

- `voice-recording-ui`: Dictate label/tooltip, Record voice menu entry, waveform placement, and mode-dependent Stop behavior.
- `voice-transcription`: Host callback contract, app-owned upload/routing, actual recording MIME type, and temporary ASR failure handling.

## Impact

The shared library change is deliberate and bounded: `libs/conversation-input/src/hooks/useVoiceRecorder.ts:80` owns capture; `libs/conversation-input/src/components/Input/Input.tsx:50` owns draft insertion; `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx:294` is the menu pattern. No host integration is embedded in the library. `apps/chat/src/hooks/conversation/useAudioTranscription.ts:32` adapts files to the existing `apps/chat/src/server-api/chat.api.ts:51` wrapper and configured TranscriptionApi singleton.

All three composers are wired: new conversation, existing conversation, and app preview. The existing transcription controller/service and generated OpenAPI response description retain temporary unavailability information. No new endpoint, package dependency, persistence schema or global provider is introduced. New/updated strings use `voiceRecording.*` keys, with translated values passed into the library.

## Acceptance criteria

1. Record voice appears before Settings on desktop and mobile; Stop adds one audio file and makes no transcription call.
2. Dictate is the microphone tooltip and accessible label; Stop recognizes one complete recording and appends text without sending or attaching audio.
3. The textarea is absent throughout capture/processing, including pending microphone permission; closing the voice session restores its saved draft.
4. Cancellation, errors, empty recognition and duplicate Stop events do not lose the existing draft or insert stale/duplicate text.
5. Whole-file size validation precedes dictation upload; retry attempts reuse the upload and respect the waiting budget.
6. Targeted tests, library checks, documentation validation and recorded browser evidence support the result. Known repository-wide typecheck failures and simulated ASR coverage remain explicit in the verification record.

## Alternatives and compatibility

Whole-file recognition was selected for complete model context and fewer requests. Fragment recognition was rejected after practical UX feedback; a realtime/browser speech provider would require a separate integration and compatibility policy.

Existing callers that omit `onTranscribeAudio` retain microphone-to-attachment fallback. New optional `isVoiceRecordingSupported` and `recordVoiceLabel` props add the menu mode. The older specification's URL-based `onTranscribeAudio` and `onUploadAudio` pair is superseded by `(file, signal) => Promise<string>`; consumers of that historical contract require an app adapter. Rollback can remove app transcription wiring to restore attachment fallback, or revert the coordinated library/app changes. No environment migration is required.
