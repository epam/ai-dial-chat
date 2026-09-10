## ADDED Requirements

### Requirement: Complete recording after Stop
The app SHALL record one complete microphone session and SHALL begin upload and recognition only after capture stops. The recorder SHALL collect every audio blob into one file with the actual browser MIME type. Pauses SHALL NOT split or stop capture. Repeated Stop events SHALL NOT duplicate recognition. Sampled silent recordings and recordings shorter than 100 ms SHALL be skipped in dictation mode.

#### Scenario: Continuous speech and pauses
- **WHEN** the user speaks and pauses during a recording
- **THEN** the same recorder remains active and no upload or recognition runs
- **WHEN** the user presses Stop
- **THEN** the complete recording is processed once and the microphone is released before awaiting recognition

### Requirement: Editable dictation with preserved draft
The app SHALL append the nonempty transcription once to the latest draft without sending the message or attaching audio. Existing text and attachments SHALL survive. The waveform and voice controls SHALL replace the textarea while recording or processing in both modes, including pending microphone permission. Keyboard text entry and sending SHALL be unavailable; the original draft SHALL survive. After recognition, the draft SHALL become editable and receive focus. The result SHALL be announced through a polite status region.

#### Scenario: Dictating into an existing draft
- **WHEN** the draft contains text and recognition succeeds after Stop
- **THEN** the result is appended with a separating space when needed and onChange is notified
- **AND** the message is not sent automatically

### Requirement: Separate audio attachment and dictation actions
The microphone button SHALL use Dictate as its default accessible label and tooltip and SHALL select recognition. The add menu SHALL insert Record voice immediately before Settings on mobile and desktop. Selecting it SHALL immediately close the menu and start recording; Stop SHALL add one complete file through the existing attachment pipeline without transcription or text changes. The app SHALL only enable audio attachment recording when voice input is enabled and the selected deployment supports audio; the library SHALL also require enabled attachments and no assistant streaming.

#### Scenario: Record an audio attachment while dictation is configured
- **WHEN** a user chooses Record voice and then Stop
- **THEN** one audio attachment is added, no transcription runs, and the original draft returns

#### Scenario: Dictation on a model that cannot receive audio
- **WHEN** a configured ASR is available but the selected model does not support audio attachments
- **THEN** Dictate is available and Record voice is absent

### Requirement: Host-owned recognition routing
The library SHALL accept an optional file-and-AbortSignal-to-text callback without API, environment, provider or storage details. The app SHALL prefer configured ASR and otherwise use the selected audio-capable deployment. The voice-input flag and complete-recording size limit SHALL be enforced in new chat, existing conversation and app preview.

#### Scenario: Complete file exceeds the limit
- **WHEN** the recorded file is larger than the configured transcription size limit
- **THEN** the app reports an error before upload and preserves the draft

#### Scenario: Library caller omits recognition
- **WHEN** no transcription callback is supplied and the user stops recording
- **THEN** the existing single audio attachment callback receives the completed recording

### Requirement: Cancellation and resource cleanup
Discard and unmount SHALL stop media resources, abort pending recognition and ignore stale results. Stop or cancellation during pending microphone permission SHALL release the acquired stream when permission resolves without starting recognition. Errors SHALL release capture resources and preserve the draft.

#### Scenario: Cancel while recognition is pending
- **WHEN** the user cancels processing and its request later succeeds
- **THEN** the old result does not modify the draft or a newer recording

#### Scenario: Capture fails
- **WHEN** microphone capture or recognition fails
- **THEN** an error is announced and discard returns to the unchanged draft

### Requirement: Bounded temporary failure recovery
The app SHALL retry recognition of the same uploaded file for temporary HTTP 429/502/503/504 failures with at most two retries and 90 seconds of total retry waiting per recording. The ASR endpoint SHALL return HTTP 503 for upstream 429/503 and preserve Retry-After when supplied. The app SHALL honor that delay or stop with an unavailable error if it exceeds the remaining waiting budget.

#### Scenario: Temporary failure then success
- **WHEN** recognition receives a temporary failure followed by success
- **THEN** the app reuses the uploaded file and inserts its text once

#### Scenario: Cancellation during a retry delay
- **WHEN** the user cancels while recognition is waiting to retry
- **THEN** the timer is cancelled and no further recognition request starts

### Requirement: Session and draft state ownership
The recorder hook SHALL own media capture, a session AbortController and the selected recording mode. Input/useMessageState SHALL retain draft state independently of the textarea's presence; useAttachments SHALL own the ordinary attachment tray. Starting a session SHALL freeze the mode and recognition provider for that recording while result delivery uses the latest draft callback. No global voice context or persisted audio queue SHALL be introduced.

#### Scenario: External draft changes while recognition is pending
- **WHEN** the host updates the draft before the current recognition result arrives
- **THEN** the completed transcript is appended to the latest draft rather than overwriting it with a stale copy

#### Scenario: A new session follows cancellation
- **WHEN** a cancelled session finishes after a new recording begins
- **THEN** its result does not alter the new session, its media resources or the draft

### Requirement: Effective voice-input feature gating
The app SHALL derive both capabilities from the existing effective `OverlayFeature.VoiceInput` (`voice-input`) setting in UiFeaturesContext. Operator configuration SHALL remain `ENABLED_UI_FEATURES` with the existing override/default resolution. This change SHALL NOT introduce a new role gate. `isAudioMessageSupported` SHALL enable dictation when the effective feature is on and either ASR or an audio-capable selected model is available. `isVoiceRecordingSupported` SHALL depend on the effective feature and the selected model's audio support. The library SHALL consume these resolved booleans without reading feature configuration.

#### Scenario: Voice input disabled
- **WHEN** the effective voice-input feature is disabled
- **THEN** both Dictate and Record voice are absent even if ASR is configured

#### Scenario: Audio recording without settings
- **WHEN** audio attachment recording is supported but no settings item is configured
- **THEN** Record voice remains available as the last add-menu item
