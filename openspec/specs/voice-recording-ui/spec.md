# voice-recording-ui Specification

## Purpose

The mic button and the voice bar that replaces the conversation input while a recording is in progress.
## Requirements
### Requirement: Mic button in ConversationInput

`Input` and `ConversationInput` SHALL render the microphone GhostIconButton in the action bar when `isAudioMessageSupported` is true and assistant streaming is inactive, except during the existing send-button exit transition. The default accessible label and tooltip SHALL be `Dictate`, overridable with `micLabel`. It SHALL start dictation, remain available with existing draft text/attachments or active attachment uploads, and respect `isInputDisabled`. The button SHALL use a 24 px icon in a 40 px desktop control and at least a 44 px mobile touch target. When the library caller omits the transcription callback, the legacy audio attachment fallback SHALL remain available.

#### Scenario: Dictation available

- **WHEN** dictation is supported and the input is enabled and not streaming
- **THEN** the microphone has the Dictate accessible label and hover tooltip
- **AND** activation starts recording for recognition after Stop

#### Scenario: Dictation unavailable or input disabled

- **WHEN** dictation support is false or absent, or assistant streaming is active
- **THEN** the microphone is hidden
- **WHEN** dictation support is true but `isInputDisabled` is true
- **THEN** the microphone cannot start capture

#### Scenario: Existing content or upload

- **WHEN** text, attachments or an attachment upload already exists
- **THEN** these alone do not disable or hide Dictate

---

### Requirement: Voice bar replaces conversation input during recording

The voice bar SHALL replace the textarea inside the existing input border for both dictation and attachment recording, beginning when microphone permission is requested. The draft SHALL remain in `useMessageState` while its textarea is unmounted. Existing attachment cards and any welcome heading SHALL remain present. The waveform SHALL occupy the first input content row below any attachment tray; the add/model/send action row SHALL be unavailable. Processing and error states SHALL continue to withhold the textarea until the voice session closes.

#### Scenario: Recording starts from either entry point

- **WHEN** the user chooses Dictate or Record voice
- **THEN** the waveform and voice controls replace the textarea
- **AND** keyboard text entry and message sending are unavailable, including while permission is pending

#### Scenario: Discard restores input

- **WHEN** the user cancels capture or processing
- **THEN** the normal input returns with its previous draft and attachments

#### Scenario: Stop in dictation mode

- **WHEN** the user presses Stop
- **THEN** the microphone is released after the final recorder events and processing status is displayed while recognition is pending
- **AND** successful recognition restores the textarea with appended text and focus

#### Scenario: Stop in attachment mode

- **WHEN** the user presses Stop for Record voice
- **THEN** the complete recording enters the existing attachment validation/upload pipeline and the textarea returns with unchanged draft text

---

### Requirement: Recording state — live scrolling waveform and red controls

During recording the voice bar SHALL display a pulsing recording dot, animated bar-histogram canvas, filled stop-square button and discard button, without an elapsed-time counter. The dot SHALL use the existing voice accent token and the waveform the existing voice waveform token. Stop SHALL finalize the selected mode: attach the file for Record voice or await recognition for Dictate. Discard SHALL abort the session without delivering a new file or transcript.

The waveform SHALL use the existing 200-slot ring buffer, 3 px bars and 1 px gaps, minimum 3 px bar height and amplitude scaling capped to the canvas height. Animation SHALL advance by one pixel per RAF tick, sample after a complete bar step, and draw only the bars that fit the canvas. The RAF loop SHALL run only during Recording and be cancelled on state change or unmount. The symmetric microphone/stop/discard icons SHALL NOT be directionally mirrored.

#### Scenario: Live waveform

- **WHEN** microphone samples arrive during Recording
- **THEN** bars animate across the waveform without showing elapsed-time text
- **AND** the stop-square and discard controls remain available

#### Scenario: Stop dispatches the chosen mode

- **WHEN** Stop is activated in attachment mode or dictation mode
- **THEN** capture ends and the complete file is delivered through the corresponding attachment or transcription callback exactly once

#### Scenario: Discard during capture

- **WHEN** the discard control is activated
- **THEN** capture and animation stop, no new attachment/transcript is delivered, and the original input returns

---

### Requirement: Canvas sizing

The waveform `<canvas>` element SHALL be:
- `h-8` (32 px) on mobile breakpoints.
- `h-6` (24 px) on desktop breakpoints, to fit alongside the voice bar's controls on one row.

A `ResizeObserver` SHALL be attached to the canvas so that the histogram redraws at the correct pixel width whenever the flex layout changes (e.g. on breakpoint change). Resizing SHALL NOT reset the ring buffer; it only redraws the existing buffer content at the new width.

#### Scenario: Canvas height follows the breakpoint

- **WHEN** the voice bar is rendered at a mobile viewport and then at a desktop viewport
- **THEN** the canvas is `h-8` on mobile and `h-6` on desktop

#### Scenario: A resize redraws without losing history

- **WHEN** the flex layout changes width while recording
- **THEN** the `ResizeObserver` triggers a redraw at the new pixel width
- **AND** the already-captured waveform history remains in the ring buffer

### Requirement: Mobile layout — waveform full-width, buttons on separate line

At the project's mobile breakpoint (up to 768 px), the first voice-bar row SHALL contain the dot and waveform, and the second row SHALL contain the controls aligned to the inline end. The discard control SHALL precede the filled stop-square control during recording; only discard SHALL remain during processing or error. These controls SHALL have at least 44 px touch targets. At desktop widths (from 769 px), waveform and controls SHALL share a row. Layout SHALL inherit document direction and use logical alignment; the waveform's time animation SHALL retain its existing direction.

#### Scenario: Mobile recording

- **WHEN** either mode records at 360 px width
- **THEN** the waveform fills the first row, controls occupy the next row, and no textarea or horizontal overflow is present

#### Scenario: Desktop recording

- **WHEN** either mode records at a desktop width
- **THEN** the waveform and controls share the first content row in place of the textarea

---

### Requirement: Microphone permission error

`useVoiceRecorder` SHALL catch microphone access failures, release acquired media resources, and enter Error. The voice bar SHALL display an error alert and discard control; dismissing it SHALL restore the saved draft. Browser-supplied error messages may be retained; the host SHALL provide translated fallback recording-error text.

#### Scenario: Permission denied

- **WHEN** the browser rejects microphone permission
- **THEN** an error is displayed with `role="alert"`, no upload or recognition begins, and discard restores the original input

### Requirement: Record voice menu action

The desktop add-menu dropdown and mobile bottom sheet SHALL insert Record voice immediately before Chat settings, after preceding attachment/tools/prompts entries that are present. If settings is absent, Record voice SHALL still be available as the last item. `recordVoiceLabel` SHALL override its default text. Selection SHALL close the menu and request microphone recording immediately in attachment mode, even when a transcription callback is configured. The item SHALL be absent when resolved recording support is false, attachments are disabled, or assistant streaming is active. The add trigger SHALL respect the input-disabled state.

#### Scenario: Menu order and activation

- **WHEN** attachment, prompts, voice and settings entries are available on mobile or desktop
- **THEN** their order is Attach file, Prompts, Record voice, Settings
- **WHEN** Record voice is selected
- **THEN** the menu closes and recording begins without an additional confirmation

### Requirement: Voice labels and accessible feedback

The app SHALL pass translated labels to the library using `voiceRecording.micLabel`, `recordVoiceLabel`, `transcribing`, `failed`, `busy`, `unavailable`, `tooLarge`, `stopRecordingLabel` and `discardRecordingLabel` under the same `voiceRecording` namespace. The library SHALL keep English defaults and SHALL NOT import i18n. Processing and completed transcript feedback SHALL use polite status regions; errors SHALL use alerts. Interactive actions SHALL be keyboard-operable and decorative icons/canvas SHALL be hidden from assistive technology. Stop SHALL receive initial focus in the mounted recording controls, and successful dictation SHALL focus the restored textarea. No keyboard-editable textarea SHALL remain hidden in the DOM during either recording mode.

#### Scenario: Processing feedback

- **WHEN** Dictate is awaiting recognition
- **THEN** its processing label is announced politely and cancellation remains available

#### Scenario: Transcript delivered

- **WHEN** a nonempty transcript is appended
- **THEN** a polite status region announces it and the restored draft can be edited
