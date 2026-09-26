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

The voice bar SHALL replace the textarea inside the existing input border for both dictation and attachment recording, beginning when microphone permission is requested. The draft SHALL remain in `useMessageState` while its textarea is unmounted. Existing attachment cards and any welcome heading SHALL remain present. The waveform SHALL occupy the first input content row below any attachment tray; the model/send action row SHALL be unavailable, but the voice bar's own attach-file control SHALL remain present, disabled for the recording's duration (see Requirement: Attach a file during recording). Processing SHALL continue to withhold the textarea. An error SHALL end the active voice presentation immediately, restore and focus the textarea, and display the error alert alongside the normal input.

#### Scenario: Recording starts from either entry point

- **WHEN** the user chooses Dictate or Record voice
- **THEN** the waveform and voice controls replace the textarea
- **AND** keyboard text entry and message sending are unavailable, including while permission is pending

#### Scenario: Discard restores input

- **WHEN** the user cancels capture or processing
- **THEN** the normal input returns with its previous draft and attachments

#### Scenario: Stop in dictation mode

- **WHEN** the user presses Stop
- **THEN** the microphone is released after the final recorder events, the waveform freezes at its last drawn state, and a processing spinner replaces the stop control while recognition is pending
- **AND** discard remains available to cancel the pending recognition
- **AND** successful recognition restores the textarea with appended text and focus

#### Scenario: Stop in attachment mode

- **WHEN** the user presses Stop for Record voice
- **THEN** the complete recording enters the existing attachment validation/upload pipeline and the textarea returns with unchanged draft text

#### Scenario: Dictation processing fails

- **WHEN** recognition fails after the user presses Stop
- **THEN** the waveform and voice controls disappear, the unchanged draft and normal input return with focus, and the error alert remains visible
- **AND** the user can immediately start another recording

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

The waveform `<canvas>` element SHALL be 26 px tall at every viewport width, matching the single-line textarea's line-height (`dial-body-paragraph-text`, 26px), so the input's overall height does not change when recording starts or stops.

A `ResizeObserver` SHALL be attached to the canvas so that the histogram redraws at the correct pixel width whenever the flex layout changes. Resizing SHALL NOT reset the ring buffer; it only redraws the existing buffer content at the new width.

#### Scenario: No height jump when recording starts

- **WHEN** the host input is at its collapsed single-line height and the user starts recording
- **THEN** the voice bar's total content height (waveform row plus controls row) matches the collapsed input's height, and the input does not visibly grow or shrink

#### Scenario: A resize redraws without losing history

- **WHEN** the flex layout changes width while recording
- **THEN** the `ResizeObserver` triggers a redraw at the new pixel width
- **AND** the already-captured waveform history remains in the ring buffer

### Requirement: Waveform full-width, buttons on separate line at every viewport width

At every viewport width, the first voice-bar row SHALL contain the dot and waveform spanning the full width, and the second row SHALL contain the attach-file control aligned to the inline start and the discard/stop/spinner controls aligned to the inline end. The discard control SHALL precede the filled stop-square control during recording; only discard and the processing spinner SHALL remain during processing. An error SHALL unmount the voice bar and restore the normal input. These controls SHALL have at least 44 px touch targets. Layout SHALL inherit document direction and use logical alignment; the waveform's time animation SHALL retain its existing direction.

#### Scenario: Recording at any width

- **WHEN** either mode records at any viewport width, mobile or desktop
- **THEN** the waveform fills the first row, the attach control and discard/stop/spinner controls occupy the next row, and no textarea or horizontal overflow is present

---

### Requirement: Attach a file during recording

The voice bar's second row SHALL render, at its inline start, the same attach-file control (`+`, including its menu) used by the normal footer's add button — not a separate reduced control. It SHALL be disabled for the entire duration of an active recording session (Recording and Processing), so a prompt, skill or file cannot be selected while the textarea is unmounted and the draft cannot yet reflect the choice, and SHALL otherwise follow the same visibility rules as the footer's add button (hidden when attachments are disabled, `hideAttachFile`, or the add button is hidden entirely) and respect the input-disabled state.

#### Scenario: Attach disabled while recording

- **WHEN** the recorder is actively Recording or awaiting recognition (Processing)
- **THEN** the voice bar's `+` control is rendered but disabled
- **WHEN** recognition enters Error
- **THEN** the voice bar is removed and the normal input controls return, and the `+` control is enabled again

#### Scenario: Attach control hidden

- **WHEN** the host has no attach-file capability for the input
- **THEN** the `+` control is absent from the voice bar's second row

---

### Requirement: Microphone permission error

`useVoiceRecorder` SHALL catch microphone access failures, release acquired media resources, clear the failed session, and enter Error. The normal input SHALL return immediately with the saved draft and focus, and SHALL display the error with `role="alert"` without a discard step. Starting another recording SHALL clear the previous error. Browser-supplied error messages may be retained; the host SHALL provide translated fallback recording-error text.

#### Scenario: Permission denied

- **WHEN** the browser rejects microphone permission
- **THEN** an error is displayed with `role="alert"`, no upload or recognition begins, and the original input is restored immediately

### Requirement: Record voice menu action

The desktop add-menu dropdown and mobile bottom sheet SHALL insert Record voice immediately before Chat settings, after preceding attachment/tools/prompts entries that are present. If settings is absent, Record voice SHALL still be available as the last item. `recordVoiceLabel` SHALL override its default text. Selection SHALL close the menu and request microphone recording immediately in attachment mode, even when a transcription callback is configured. The item SHALL be absent when resolved recording support is false, attachments are disabled, or assistant streaming is active. The add trigger SHALL respect the input-disabled state.

#### Scenario: Menu order and activation

- **WHEN** attachment, prompts, voice and settings entries are available on mobile or desktop
- **THEN** their order is Attach file, Prompts, Record voice, Settings
- **WHEN** Record voice is selected
- **THEN** the menu closes and recording begins without an additional confirmation

### Requirement: Recorded audio filename matches its MIME type

`useVoiceRecorder` SHALL select the completed file's extension using the shared MIME-to-extension table after normalizing the actual recorder MIME type for lookup. WebM audio SHALL use `.weba`, Ogg audio SHALL use `.oga`, and MP4 audio SHALL use `.m4a`. Unknown MIME types SHALL retain the subtype fallback. The file SHALL retain the recorder's MIME type, including codec parameters, and all captured bytes. This contract SHALL apply to attachment and dictation delivery. Existing stored attachments SHALL retain their names.

#### Scenario: Record voice produces downloadable WebM audio

- **WHEN** the user stops Record voice with recorder MIME `audio/webm` or `audio/webm;codecs=opus`
- **THEN** the file entering the attachment validation/upload pipeline has a `.weba` filename
- **AND** its MIME type and captured bytes are preserved
- **AND** its filename extension agrees with the attachment type label and the suggested download filename

#### Scenario: Other browser audio formats

- **WHEN** the recorder produces `audio/ogg;codecs=opus` or `audio/mp4`
- **THEN** the completed file uses `.oga` or `.m4a`, respectively, and retains its original MIME type

#### Scenario: Dictation and legacy attachment fallback

- **WHEN** a completed recording is delivered to transcription or to the attachment fallback without transcription
- **THEN** the same MIME-based filename extension contract applies

#### Scenario: Unmapped format

- **WHEN** the recorder reports an audio MIME type absent from the shared extension table
- **THEN** the filename uses its normalized MIME subtype as the extension and retains the original MIME type

### Requirement: Voice labels and accessible feedback

The app SHALL pass translated labels to the library using `voiceRecording.micLabel`, `recordVoiceLabel`, `transcribing`, `failed`, `busy`, `unavailable`, `tooLarge`, `stopRecordingLabel` and `discardRecordingLabel` under the same `voiceRecording` namespace. The library SHALL keep English defaults and SHALL NOT import i18n. Processing and completed transcript feedback SHALL use polite status regions; errors SHALL use alerts. Interactive actions SHALL be keyboard-operable and decorative icons/canvas SHALL be hidden from assistive technology. Stop SHALL receive initial focus in the mounted recording controls, and successful dictation SHALL focus the restored textarea. No keyboard-editable textarea SHALL remain hidden in the DOM during either recording mode.

#### Scenario: Processing feedback

- **WHEN** Dictate is awaiting recognition
- **THEN** a spinner replaces the stop control, its accessible name is announced politely via the spinner's status role, and cancellation remains available

#### Scenario: Transcript delivered

- **WHEN** a nonempty transcript is appended
- **THEN** a polite status region announces it and the restored draft can be edited
