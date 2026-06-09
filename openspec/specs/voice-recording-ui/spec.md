### Requirement: Mic button in ConversationInput

`ConversationInput` SHALL render a ghost icon button (UI kit `DialGhostIconButton`, 40 px outer / 24 px icon) on the right side of the action bar when `isTranscriptionSupported` is `true` **and the message text field is empty**. The button SHALL be hidden when `isTranscriptionSupported` is `false`, not provided, or when the text field contains non-whitespace characters.

The mic button SHALL remain visible and interactive regardless of whether other attachment uploads are in progress.

#### Scenario: Mic button shown when transcription is supported and input is empty

- **WHEN** `isTranscriptionSupported` is `true` and the message field is empty
- **THEN** the mic ghost icon button is rendered in the action bar

#### Scenario: Mic button hidden when transcription is not supported

- **WHEN** `isTranscriptionSupported` is `false` or not provided
- **THEN** no mic button is rendered

#### Scenario: Mic button hidden when message is non-empty

- **WHEN** `isTranscriptionSupported` is `true` but the message field contains non-whitespace text
- **THEN** the mic button is not rendered

#### Scenario: Mic button visible during active attachment upload

- **WHEN** an attachment upload is in progress, `isTranscriptionSupported` is `true`, and the message is empty
- **THEN** the mic button remains visible and interactive

---

### Requirement: Voice bar replaces conversation input during recording and review

When recording starts, the voice bar SHALL replace the conversation input area. The `welcomeText` header SHALL remain visible above the voice bar with the same `gap-y-8` vertical gap used by the normal input.

The voice bar SHALL have: height 40 px inner + `py-2` vertical padding (56 px total), `px-3` horizontal padding, `gap-2` between elements, and `Controls/Background/Neutral` background.

#### Scenario: Voice bar appears on recording start

- **WHEN** the user clicks the mic button
- **THEN** the conversation input is replaced by the voice bar
- **THEN** the `welcomeText` header remains visible above it

#### Scenario: Normal input restored on discard

- **WHEN** the user clicks X in the voice bar
- **THEN** the voice bar is removed and the normal conversation input is restored

#### Scenario: Normal input restored after successful transcription

- **WHEN** transcription completes successfully
- **THEN** the voice bar is removed, the normal conversation input is restored, and the transcript text is placed in it

---

### Requirement: Recording state — live waveform and red indicators

During recording the voice bar SHALL display:
- A red filled circle (dot) on the left as a recording indicator.
- A live animated bar-histogram waveform rendered on a `<canvas>` element. Each animation frame appends one RMS amplitude value to an accumulated history buffer. The canvas renders that full history as narrow vertical bars (3 px wide, 1 px gap) spanning the canvas width at ~30 fps via `requestAnimationFrame`. Bar heights are scaled by ×6 (clamped to canvas height) so typical speech levels produce clearly visible bars. Bar colour is `--text-primary`.
- A red mic icon button on the right. Clicking it stops recording.

#### Scenario: Recording indicator visible during recording

- **WHEN** recording is active
- **THEN** the red dot indicator is visible on the left of the waveform

#### Scenario: Waveform animates during recording

- **WHEN** recording is active and microphone input is received
- **THEN** the waveform canvas updates at ~30 fps, growing the accumulated amplitude history from left to right
- **THEN** bars are narrow vertical pieces (3 px wide, 1 px gap) coloured `--text-primary`

#### Scenario: Mic button is red during recording

- **WHEN** recording is active
- **THEN** the mic button icon is rendered in red

#### Scenario: Clicking red mic button stops recording

- **WHEN** the user clicks the mic button during recording
- **THEN** recording stops and the state transitions to stopped

---

### Requirement: Stopped state — frozen waveform with discard and confirm controls

After recording stops the voice bar SHALL display:
- The waveform canvas frozen showing the full accumulated amplitude history (the live RAF loop is cancelled; the last frame written by the loop is preserved as-is — no re-read from the analyser).
- An X button (discard) on the right.
- A white checkmark icon inside an accent-primary filled circle (confirm) on the right of the X button.
- The red dot indicator is no longer shown.

#### Scenario: Waveform frozen after stop

- **WHEN** the user stops recording
- **THEN** the waveform canvas shows the full accumulated amplitude history, frozen at the last RAF-written frame, and no longer animates

#### Scenario: Discard and confirm buttons appear after stop

- **WHEN** the user stops recording
- **THEN** the X button and the checkmark-in-circle button are visible
- **THEN** the red dot indicator is no longer visible

#### Scenario: X button discards recording

- **WHEN** the user clicks X in the stopped state
- **THEN** the recording is discarded and the normal conversation input is restored

---

### Requirement: Uploading state — loader replaces confirm button

While uploading or transcribing, the voice bar SHALL replace the checkmark button with a generic loading spinner. The X button SHALL remain visible and, when clicked, SHALL cancel and discard.

#### Scenario: Loader shown during upload or transcription

- **WHEN** the user clicks the checkmark and upload or transcription is in progress
- **THEN** the checkmark button is replaced by a loading spinner

#### Scenario: X cancels in-flight operation

- **WHEN** the user clicks X during uploading or transcribing
- **THEN** the operation is abandoned and the normal conversation input is restored

---

### Requirement: Error state — red border and error text

When upload or transcription fails the voice bar SHALL:
- Show a red border around the bar.
- Show an error text (UI kit error text component) underneath the bar.
- Show the X button and the checkmark button (retry) — the loader is removed.

#### Scenario: Error state shown on upload failure

- **WHEN** `onUploadAudio` rejects
- **THEN** the voice bar gains a red border
- **THEN** an error message is displayed below the bar
- **THEN** the checkmark (retry) and X buttons are visible

#### Scenario: Error state shown on transcription failure

- **WHEN** `onTranscribeAudio` rejects
- **THEN** the voice bar gains a red border
- **THEN** an error message is displayed below the bar

#### Scenario: Retry clears error and restarts upload

- **WHEN** the user clicks the checkmark in the error state
- **THEN** the error state is cleared and the upload/transcription flow restarts

#### Scenario: X in error state discards and restores input

- **WHEN** the user clicks X in the error state
- **THEN** the recording is discarded and the normal conversation input is restored

---

### Requirement: Canvas sizing

The waveform `<canvas>` element SHALL be:
- `h-8` (32 px) on mobile breakpoints.
- `h-6` (24 px) on desktop breakpoints, to fit within the single-row layout alongside controls.

A `ResizeObserver` SHALL be attached to the canvas so that the histogram redraws at the correct pixel width whenever the flex layout changes (e.g. on breakpoint change).

---

### Requirement: Mobile layout — waveform full-width, buttons on separate line

On mobile breakpoints the voice bar SHALL use a two-row layout:
- **Row 1**: the waveform canvas at full width (red dot on the left during recording).
- **Row 2**: buttons right-aligned. During recording: red mic button. After stopping: X then checkmark. During uploading: X then loader. In error state: X then checkmark.

This two-row layout SHALL apply in both recording and stopped/uploading/error states.

#### Scenario: Mobile recording layout

- **WHEN** the viewport is at mobile breakpoint and recording is active
- **THEN** the waveform occupies the full row width
- **THEN** the red mic button appears on a separate row, right-aligned

#### Scenario: Mobile stopped layout

- **WHEN** the viewport is at mobile breakpoint and recording has stopped
- **THEN** the waveform occupies the full row width
- **THEN** X and checkmark buttons appear on a separate row, right-aligned

---

### Requirement: Microphone permission error

If the browser denies microphone access, the `useVoiceRecorder` hook SHALL catch the `NotAllowedError` from `getUserMedia` and transition to an error state with an appropriate message. The voice bar SHALL be shown in the error state.

#### Scenario: Microphone permission denied

- **WHEN** the user clicks the mic button and the browser denies microphone access
- **THEN** the voice bar is shown in error state with a permission-denied error message
