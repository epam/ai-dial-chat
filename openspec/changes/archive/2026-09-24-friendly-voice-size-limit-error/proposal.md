## Why

When a voice recording is larger than the configured transcription limit, the composer shows `Audio exceeds the 5242880 byte limit.` ([#9013](https://github.com/epam/ai-dial-chat/issues/9013)). A raw byte count is hard to read, and the message doesn't tell the user what to do next. Other "too large" messages in the app already show sizes in human-readable units (`Max file size is 5 MB.`), so voice input is the odd one out.

## Problem

- `apps/chat/src/hooks/conversation/useAudioTranscription.ts:75-80` passes `error.limitBytes` (a raw number) straight into `voiceRecording.tooLarge`.
- `apps/chat/src/i18n/locales/en.json:1197` reads `"Audio exceeds the {{limit}} byte limit."`. It says nothing about how to recover.

## What Changes

- The app-edge `TooLarge` branch in `useAudioTranscription` formats the limit with the existing `formatFileSize` helper from `@epam/ai-dial-chat-shared` (`libs/chat-shared/src/utils/format-file-size.ts:6`). If `limitBytes` is missing, it falls back to the configured `transcribeSizeLimitBytes`. This follows the sibling pattern in `apps/chat/src/components/ConversationView/ConversationView.tsx:427-433` and `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx:270`.
- `voiceRecording.tooLarge` is reworded to issue option 2 (more actionable): `Audio recording exceeds the {{maxSize}} limit. Please shorten the recording and try again.` The interpolation variable is renamed from `limit` to `maxSize` to match the sibling keys `attachments.fileTooLarge.message`, `dialFileManager.uploadFileTooLarge` and `skillEditor.error.fileTooLarge`.
- No library, backend, config or API change. `AudioTranscriptionError` in `libs/chat-hooks` keeps passing raw `limitBytes`, and turning that number into text stays at the app edge.

## Non-goals

- Changing the size limit itself (`TRANSCRIBE_SIZE_LIMIT_BYTES`, default 5 MB) or where it is enforced.
- Limiting recording duration, or warning the user before they hit the limit while recording.
- Localizing the unit suffix (`MB`/`KB`). `formatFileSize` returns English units everywhere in the app today, and changing that is a separate, app-wide concern.
- Rewording the other voice errors (`failed`, `busy`, `unavailable`).

## Alternatives considered

Issue option 1 (`…Maximum size is 5 MB.`) gives no next step. Option 3 is the most verbose and says "message" even when the recording is an attachment. **Option 2** is actionable and still short, so it fits the inline alert. It is recorded as an assumption that can be swapped by editing only `en.json`. Rejected: a new locale-aware formatter (`Intl.NumberFormat` with `unit: 'megabyte'`). It would be the only such formatter in the app and would drift from every other size message.

## Acceptance criteria

- With the default limit (5,242,880 bytes), an oversized recording shows `Audio recording exceeds the 5 MB limit. Please shorten the recording and try again.`
- A limit that isn't a whole number of MB is shown the way `formatFileSize` shows it (e.g. 5,000,000 → `4.8 MB`). No raw byte count ever appears.
- The draft is still preserved and nothing is uploaded, as today.
- The `useAudioTranscription` unit test asserts that the formatted `maxSize` is passed to `voiceRecording.tooLarge`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `voice-transcription`: the "file exceeds the configured limit" scenario now requires a human-readable limit and a recovery hint.

## Impact

- **Code:** `apps/chat/src/hooks/conversation/useAudioTranscription.ts`, its spec `apps/chat/src/hooks/conversation/tests/useAudioTranscription.spec.ts`, and `apps/chat/src/i18n/locales/en.json`. `en.json` is the only locale file, so no other locale needs updating.
- **i18n:** one existing key reworded, with its interpolation variable renamed (`limit` → `maxSize`). No new keys. `VoiceRecordingI18nKeys.TooLarge` is unchanged.
- **Libs:** none touched, so library isolation isn't affected.
- **Scope creep:** none. No shared lib or global provider changes.
- **Rollback / compat:** not breaking. The only exposed contract is the English string. Reverting the single commit restores the old message. Hosts that override `voiceRecording.tooLarge` with a custom translation using `{{limit}}` would need to switch to `{{maxSize}}`. No such override exists in this repo.
