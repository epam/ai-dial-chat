# voice-recording-ui Specification

## Purpose

The mic button and the voice bar that replaces the conversation input while a recording is in progress.

## Requirements

### Requirement: Mic button in ConversationInput

`ConversationInput` SHALL render a ghost icon button (UI kit `GhostIconButton`, 40 px outer / 24 px icon) on the right side of the action bar when `isAudioMessageSupported` is `true`. The button SHALL be hidden when `isAudioMessageSupported` is `false` or not provided. The button SHALL remain visible regardless of whether there is text in the message field or attachments in the tray.

The mic button SHALL remain visible and interactive regardless of whether other attachment uploads are in progress.

#### Scenario: Mic button shown when audio messages are supported

- **WHEN** `isAudioMessageSupported` is `true`
- **THEN** the mic ghost icon button is rendered in the action bar

#### Scenario: Mic button hidden when audio messages are not supported

- **WHEN** `isAudioMessageSupported` is `false` or not provided
- **THEN** no mic button is rendered

#### Scenario: Mic button visible during active attachment upload

- **WHEN** an attachment upload is in progress and `isAudioMessageSupported` is `true`
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
- **THEN** the audio blob is immediately added as an attachment to the message input
- **THEN** the voice bar is removed and the normal conversation input is restored

---

### Requirement: Recording state — live scrolling waveform and red controls

During recording the voice bar SHALL display:
- A pulsing red recording dot on the left of the waveform (`--ci-voice-accent`, fallback `--text-error`). No elapsed-time counter is shown.
- A live animated bar-histogram waveform rendered on a `<canvas>` element. A fixed-length ring buffer (200 slots) holds one RMS amplitude sample per `requestAnimationFrame` tick at ~60 fps. Each tick overwrites the oldest slot, advancing the write index, so the oldest bars scroll off the left edge and new bars appear on the right — giving a smooth scrolling effect. The canvas renders all 200 slots as narrow vertical bars (3 px wide, 1 px gap) spanning the canvas width. Bar heights are scaled by ×6 (clamped to canvas height) with a minimum height of 3 px. Bar colour is `--ci-voice-waveform` (fallback `--text-primary`).
- A red mic icon button on the right. Clicking it stops recording, immediately attaches the audio blob as a `File` attachment, and returns to idle.
- An X (discard) button on the right. Clicking it discards the recording without attaching anything and returns to idle.

The RAF loop runs only while `state === 'recording'` and is cancelled when recording stops or the component unmounts.

#### Scenario: No elapsed-time counter during recording

- **WHEN** recording is active
- **THEN** no elapsed-time text is rendered
- **THEN** a pulsing red recording dot is visible to the left of the waveform

#### Scenario: Waveform scrolls during recording

- **WHEN** recording is active and microphone input is received
- **THEN** the waveform canvas updates at ~60 fps via `requestAnimationFrame`
- **THEN** each tick appends a new RMS bar on the right; older bars scroll toward the left
- **THEN** bars are narrow vertical pieces (3 px wide, 1 px gap) coloured using `--ci-voice-waveform`

#### Scenario: Mic button is red during recording

- **WHEN** recording is active
- **THEN** the mic button icon is rendered in red

#### Scenario: Clicking red mic button stops recording and attaches audio

- **WHEN** the user clicks the mic button during recording
- **THEN** recording stops
- **THEN** the audio blob is immediately added as a file attachment to the message input
- **THEN** the voice bar is removed and the normal conversation input is restored

#### Scenario: Clicking X discards recording

- **WHEN** the user clicks the X button during recording
- **THEN** the recording is discarded with no attachment added
- **THEN** the voice bar is removed and the normal conversation input is restored

---

### Requirement: Canvas sizing

The waveform `<canvas>` element SHALL be:
- `h-8` (32 px) on mobile breakpoints.
- `h-6` (24 px) on desktop breakpoints, to fit within the single-row layout alongside controls.

A `ResizeObserver` SHALL be attached to the canvas so that the histogram redraws at the correct pixel width whenever the flex layout changes (e.g. on breakpoint change). Resizing SHALL NOT reset the ring buffer; it only redraws the existing buffer content at the new width.

#### Scenario: Canvas height follows the breakpoint

- **WHEN** the voice bar is rendered at a mobile viewport and then at a desktop viewport
- **THEN** the canvas is `h-8` on mobile and `h-6` on desktop

#### Scenario: A resize redraws without losing history

- **WHEN** the flex layout changes width while recording
- **THEN** the `ResizeObserver` triggers a redraw at the new pixel width
- **AND** the already-captured waveform history remains in the ring buffer

---

### Requirement: Mobile layout — waveform full-width, buttons on separate line

On mobile breakpoints the voice bar SHALL use a two-row layout:
- **Row 1**: the recording dot on the left (during recording) followed by the waveform canvas filling the remaining width.
- **Row 2**: buttons right-aligned. During recording: X button then red mic button.

This two-row layout SHALL apply in both recording and error states.

#### Scenario: Mobile recording layout

- **WHEN** the viewport is at mobile breakpoint and recording is active
- **THEN** the recording dot and waveform occupy the full row width
- **THEN** the X and red mic buttons appear on a separate row, right-aligned

---

### Requirement: Microphone permission error

If the browser denies microphone access, the `useVoiceRecorder` hook SHALL catch the `NotAllowedError` from `getUserMedia` and transition to an error state with an appropriate message. The voice bar SHALL be shown in the error state with a red border and the error text below it.

#### Scenario: Microphone permission denied

- **WHEN** the user clicks the mic button and the browser denies microphone access
- **THEN** the voice bar is shown in error state with a permission-denied error message
- **THEN** the X button is visible to dismiss and return to normal input
