## MODIFIED Requirements

### Requirement: Mic button in ConversationInput

`ConversationInput` SHALL render a ghost icon button (UI kit `GhostIconButton`, 40 px outer / 24 px icon) on the right side of the action bar when `isAudioMessageSupported` is `true` **and the message text field is empty**. The button SHALL be hidden when `isAudioMessageSupported` is `false`, not provided, or when the text field contains non-whitespace characters.

The mic button SHALL remain visible and interactive regardless of whether other attachment uploads are in progress.

#### Scenario: Mic button shown when audio messages are supported and input is empty

- **WHEN** `isAudioMessageSupported` is `true` and the message field is empty
- **THEN** the mic ghost icon button is rendered in the action bar

#### Scenario: Mic button hidden when audio messages are not supported

- **WHEN** `isAudioMessageSupported` is `false` or not provided
- **THEN** no mic button is rendered

#### Scenario: Mic button hidden when message is non-empty

- **WHEN** `isAudioMessageSupported` is `true` but the message field contains non-whitespace text
- **THEN** the mic button is not rendered

#### Scenario: Mic button visible during active attachment upload

- **WHEN** an attachment upload is in progress, `isAudioMessageSupported` is `true`, and the message is empty
- **THEN** the mic button remains visible and interactive

---

### Requirement: Voice bar replaces conversation input during recording

When recording starts, the voice bar SHALL replace the conversation input area. The `welcomeText` header SHALL remain visible above the voice bar with the same `gap-y-8` vertical gap used by the normal input.

The voice bar SHALL have: height 40 px inner + `py-2` vertical padding (56 px total), `px-3` horizontal padding, `gap-2` between elements, and `Controls/Background/Neutral` background.

#### Scenario: Voice bar appears on recording start

- **WHEN** the user clicks the mic button
- **THEN** the conversation input is replaced by the voice bar
- **THEN** the `welcomeText` header remains visible above it

#### Scenario: Normal input restored on discard

- **WHEN** the user clicks X in the voice bar
- **THEN** the voice bar is removed and the normal conversation input is restored

#### Scenario: Normal input restored after recording stops

- **WHEN** the user clicks the red mic button to stop recording
- **THEN** the audio blob is immediately passed to `onAttachAudio`
- **THEN** the voice bar is removed and the normal conversation input is restored with the audio attachment added

---

### Requirement: Recording state — live timer, scrolling waveform, and red mic button

During recording the voice bar SHALL display:
- A live elapsed-time counter on the left showing recording duration in `MM:SS` format, updating every second. This replaces the red dot indicator.
- A live animated bar-histogram waveform rendered on a `<canvas>` element using a fixed-length ring buffer (200 slots). Each animation frame at ~30 fps appends one RMS amplitude value, overwriting the oldest entry. The canvas renders all 200 slots as narrow vertical bars (3 px wide, 1 px gap) spanning the full canvas width. New samples appear on the right; as the buffer fills and wraps, older bars shift left and scroll off, producing a smooth continuous scroll effect. Bar heights are scaled by ×6 (clamped to canvas height). Bar colour is `--text-primary`.
- A red mic icon button on the right. Clicking it stops recording and immediately attaches the audio.

#### Scenario: Timer visible and ticking during recording

- **WHEN** recording is active
- **THEN** the elapsed-time counter in `MM:SS` format is visible on the left of the voice bar
- **THEN** the counter increments by one second each second

#### Scenario: Waveform scrolls smoothly during recording

- **WHEN** recording is active and microphone input is received
- **THEN** the waveform canvas updates at ~30 fps
- **THEN** new amplitude bars appear on the right edge and old bars scroll off the left edge
- **THEN** bars are narrow vertical pieces (3 px wide, 1 px gap) coloured `--text-primary`

#### Scenario: Mic button is red during recording

- **WHEN** recording is active
- **THEN** the mic button icon is rendered in red

#### Scenario: Clicking red mic button stops recording and attaches audio

- **WHEN** the user clicks the mic button during recording
- **THEN** recording stops
- **THEN** the recorded audio blob is immediately passed to `onAttachAudio`
- **THEN** the voice bar is removed and the normal conversation input is restored

---

## REMOVED Requirements

### Requirement: Stopped state — frozen waveform with discard and confirm controls

**Reason**: The stopped/review state is removed. Recording stops immediately attach the audio blob as a message attachment, eliminating the extra confirm click.
**Migration**: No action needed for consumers; the `onTranscribeAudio` prop and all stopped-state UI are removed. The audio blob is now delivered via `onAttachAudio` at the moment recording stops.

---

### Requirement: Uploading state — loader replaces confirm button

**Reason**: Uploading state was specific to the transcription flow, which is removed.
**Migration**: None — attachment upload progress is handled by the existing attachment pipeline in the host app.

---

### Requirement: Error state — red border and error text

**Reason**: The transcription upload/error state is removed. The only remaining error state is microphone permission denial (covered by the microphone permission error requirement below).
**Migration**: None.

---

## MODIFIED Requirements

### Requirement: Canvas sizing

The waveform `<canvas>` element SHALL be:
- `h-8` (32 px) on mobile breakpoints.
- `h-6` (24 px) on desktop breakpoints, to fit within the single-row layout alongside controls.

A `ResizeObserver` SHALL be attached to the canvas so that the histogram redraws at the correct pixel width whenever the flex layout changes (e.g. on breakpoint change). When the canvas width changes, the ring buffer content is preserved and re-rendered at the new width.

#### Scenario: Canvas height on mobile

- **WHEN** the viewport is at mobile breakpoint
- **THEN** the waveform canvas height is 32 px (`h-8`)

#### Scenario: Canvas height on desktop

- **WHEN** the viewport is at desktop breakpoint
- **THEN** the waveform canvas height is 24 px (`h-6`)

#### Scenario: Canvas redraws on resize

- **WHEN** the flex layout changes (e.g. breakpoint change)
- **THEN** the waveform canvas redraws at the new pixel width without losing accumulated history

---

### Requirement: Mobile layout — timer and waveform full-width, button on separate line

On mobile breakpoints the voice bar SHALL use a two-row layout:
- **Row 1**: the elapsed-time counter on the left, then the waveform canvas filling remaining space.
- **Row 2**: buttons right-aligned. During recording: red mic button. During error: X button.

#### Scenario: Mobile recording layout

- **WHEN** the viewport is at mobile breakpoint and recording is active
- **THEN** the timer and waveform occupy the full first row
- **THEN** the red mic button appears on a separate row, right-aligned

---

### Requirement: Microphone permission error

If the browser denies microphone access, the `useVoiceRecorder` hook SHALL catch the `NotAllowedError` from `getUserMedia` and transition to an error state with an appropriate message. The voice bar SHALL be shown in the error state with an X button to dismiss and restore the normal input.

#### Scenario: Microphone permission denied

- **WHEN** the user clicks the mic button and the browser denies microphone access
- **THEN** the voice bar is shown in error state with a permission-denied error message
- **THEN** an X button is visible to dismiss the voice bar and restore normal input
