## Context

The `ConversationInput` component (in `libs/conversation-input/`) currently exposes a voice recording sub-system gated on `isTranscriptionSupported`. Recording ends with a review step (accept/discard), and the accepted audio blob is sent through `onTranscribeAudio` to produce transcript text. Models that accept raw audio files directly (multimodal models) don't need transcription — they need the audio as an attachment. This change re-designs the UX and data flow to match that model.

Current state machine: `idle → recording → stopped (review) → uploading → done | error`.
New state machine: `idle → recording → (auto-attach on stop) → idle`.

## Goals / Non-Goals

**Goals:**
- Replace the transcription-based flow with a direct attachment flow.
- Remove the stopped/review state; stopping recording triggers immediate attachment.
- Replace `isTranscriptionSupported` with `isAudioMessageSupported` as the gate for showing the mic button.
- Show a live MM:SS timer on the left of the voice bar during recording (replacing the red dot).
- Improve waveform smoothness with a fixed-size sliding window rather than a growing history buffer.
- Keep all audio logic inside `libs/conversation-input/`; the app supplies `onAttachAudio(blob: Blob): void` as a callback.

**Non-Goals:**
- Transcription is fully removed; no fallback or toggling between modes.
- No backend changes.
- No changes to how existing file attachments are uploaded or displayed.
- No support for pausing/resuming a recording.

## Decisions

### Decision 1: Immediate attach on stop — no review state

**Chosen**: Cancel the review step; when the user clicks the red mic button (stop), the blob is passed directly to `onAttachAudio`.

**Rationale**: The review step added friction with no clear benefit for short voice messages. If the user wants to discard, they can remove the attachment from the input like any other file.

**Alternative considered**: Keep the review step but auto-play the clip. Rejected — adds more complexity and still interrupts the flow.

### Decision 2: `onAttachAudio(blob: Blob, filename: string): void` callback prop

**Chosen**: `ConversationInput` (and transitively `VoiceBar`) receives a single `onAttachAudio` callback. The app-level adapter converts the blob to a `File`, names it (e.g. `voice-YYYYMMDD-HHmmss.webm`), and passes it through the existing attachment pipeline.

**Rationale**: Keeps the lib boundary clean — the lib hands off a `Blob`, the app decides the filename, MIME normalisation, and upload path. This matches the library isolation rule.

**Alternative considered**: Pass the blob directly to an `onAttachFile(file: File)` prop. Rejected in favour of a named callback so the signature is explicit and the lib doesn't need to construct `File` objects with app-specific metadata.

### Decision 3: Timer replaces the red dot

**Chosen**: A `useInterval`-based elapsed seconds counter increments every second while `status === 'recording'`. Formatted as `MM:SS` and rendered as a monospaced text node on the left side of the voice bar where the red dot was.

**Rationale**: Timer gives actionable information (how long is this clip?). The red dot added no information beyond the red mic button already present.

### Decision 4: Sliding-window waveform

**Chosen**: Replace the growing-history buffer with a fixed-length ring buffer (e.g. 200 slots). Each `requestAnimationFrame` tick appends one RMS sample and overwrites the oldest. The canvas always renders exactly `N` bars across its full width — as new samples arrive, old bars move left and scroll off. This gives a smooth, constant-speed right-to-left scroll effect.

**Rationale**: The growing bar chart looked choppy as the canvas redrew from scratch each frame. A ring buffer means only the newest sample changes per frame; the rest just shift, which is smoother visually and trivially efficient.

**Alternative considered**: CSS `transform: translateX` animation. Rejected — keeping it canvas-only avoids mixing CSS animation with the RAF loop.

### Decision 5: Simplified state machine

Removed states: `stopped`, `uploading`, `error` (transcription-specific). The new machine has only:
- `idle` — no voice bar shown.
- `recording` — voice bar visible with live timer + waveform + red mic button.
- `error` — mic permission denied (or other `getUserMedia` failure); voice bar shown with error text and X button.

The X button (discard) is available during `recording` and `error` states.

## Risks / Trade-offs

- **Accidental attachments** → The user can't preview the clip before it's attached. Mitigation: removing an attachment from the input is a single click (existing remove-attachment UX).
- **Blob size / format** → `MediaRecorder` format varies by browser (`audio/webm` on Chrome, `audio/ogg` on Firefox). The app adapter should normalise or at least pass the correct MIME type through to the model. This is an app-level concern, not a lib concern.
- **Ring buffer length** → 200 samples at ~30 fps ≈ 6.7 s of visible history. At longer recordings the oldest audio is no longer visualised. This is intentional for smoothness. The buffer length could be a prop if needed later.

## Migration Plan

1. Update `ConversationInput` props: remove `isTranscriptionSupported`, `onTranscribeAudio`; add `isAudioMessageSupported`, `onAttachAudio`.
2. Update the single call site in `apps/chat` that passes the old props.
3. Update shared types in `libs/chat-shared` if any transcription-related interfaces are exported there.
4. Remove the stopped/uploading/error-from-transcription sub-states from `useVoiceRecorder`.
5. Rewrite the waveform canvas logic to use the ring buffer.
6. Add the timer display.
7. Update the spec at `openspec/specs/voice-recording-ui/spec.md` (done via this change's delta spec).

No rollback strategy needed — this branch is not yet on a release branch. The old transcription flow can be recovered from git history if needed.

## Open Questions

- What filename format should the app adapter use for the audio blob? Suggest `voice-<iso-timestamp>.webm` but this is an app-level decision.
- Should there be a maximum recording duration cap? Not in scope for this change but worth a future story.
