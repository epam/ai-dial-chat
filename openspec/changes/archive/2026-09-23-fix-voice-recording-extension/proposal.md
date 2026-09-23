## Why

Record voice creates WebM audio named `.webm`, while the attachment UI derives `.weba` from its audio MIME type. Downloads retain the original filename, so the visible type and saved extension disagree.

## What Changes

- Select recording filename extensions from the shared MIME table, including `.weba` for `audio/webm`, while preserving the recorder's MIME type and bytes.
- Cover recording callbacks and the Record voice upload path with regression tests.
- Document the filename contract in the voice specification and library README.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `voice-recording-ui`: Recorded audio filenames use the same MIME extension mapping as attachment labels.

## Impact

The implementation is limited to `libs/conversation-input/src/hooks/useVoiceRecorder.ts` and existing tests. It reuses host-independent utilities from the existing `chat-shared` peer; no app integration enters the library. No API, dependency, translation, layout, RTL, or accessibility changes are needed.

## Acceptance Criteria

WebM recordings, including MIME values with codec parameters, enter the attachment pipeline with a `.weba` filename and their original audio MIME type. Other known recording formats use the shared audio extensions; unknown types retain the subtype fallback. Tests cover attachment and dictation delivery and the Record voice menu on mobile and desktop.

## Non-goals and Compatibility

No transcoding, download-header changes, or renaming of existing stored attachments. Only new recording filenames change. Reverting the extension lookup restores the previous behavior without data migration.
