## ADDED Requirements

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
