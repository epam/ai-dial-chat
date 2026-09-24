## Context

`useTranscribeAudio` (in `libs/chat-hooks/src/conversation/useTranscribeAudio/useTranscribeAudio.ts:69-74`) throws `AudioTranscriptionError(TooLarge, maxSizeBytes)` before uploading. The app-edge hook `apps/chat/src/hooks/conversation/useAudioTranscription.ts` turns that reason into a translated `Error`. `ConversationInput` then shows the message in its error alert, which already uses `role="alert"` (see the `voice-recording-ui` spec). Currently the raw number is interpolated into `"Audio exceeds the {{limit}} byte limit."`.

## Goals / Non-Goals

**Goals:** show the limit in human-readable units, give the user a recovery step, and keep all formatting and translation at the app edge.

**Non-Goals:** changing the limit, its enforcement, the library error contract, the alert UI, or the other voice error messages.

## Decisions

1. **Format with the existing `formatFileSize`** from `@epam/ai-dial-chat-shared`, which `apps/chat` already imports in `ConversationView.tsx` and `DialFileManagerModal.tsx`. Every other "too large" message in the app uses it, so all size messages stay consistent. Rejected alternative: an `Intl.NumberFormat` unit formatter. It would be locale-aware but would be the only one in the app, and would make this message format sizes differently from the attachment and file-manager messages.
2. **Fall back to the configured `transcribeSizeLimitBytes`** when `limitBytes` is absent. This is safer than an empty string, which would read "exceeds the  limit". `limitBytes` is typed as optional, although the library always sets it for `TooLarge`. `transcribeSizeLimitBytes` is already destructured from `useAppConfig()` in the hook, so adding it to the `useCallback` dependency list is the only memoization change.
3. **Rename the interpolation variable to `maxSize`**, the name used by `attachments.fileTooLarge.message`, `dialFileManager.uploadFileTooLarge` and `skillEditor.error.fileTooLarge`. The enum key `VoiceRecordingI18nKeys.TooLarge` (`apps/chat/src/constants/translation-keys.ts:1206`) is unchanged.
4. **Keep the library unchanged.** `AudioTranscriptionError.limitBytes` stays a raw number, so the library has no knowledge of units or i18n. This is consistent with the library-isolation rules.

No new endpoint, context, UI surface, feature flag, cache or telemetry is added. RTL impact: none, since the message is plain text in an existing alert that follows the direction set on `<html>`. Accessibility: unchanged, as the existing `role="alert"` announces the new text.

## Risks / Trade-offs

- [The `MB`/`KB` suffix stays English under a future non-English locale] → This is the same limitation every size message has today. It is recorded as a non-goal, and any fix belongs in `formatFileSize` so it applies app-wide.
- [An operator sets a limit that isn't a whole number of MB, e.g. 5,000,000 bytes, which shows as `4.8 MB`] → This is accurate, and it is how the attachment limit is already shown.
- [A host translation override still uses `{{limit}}`] → None exists in this repo. The rollback is a single revert.

## Migration Plan

None. The frontend-only change ships with the next build, and a revert restores the old string.

## Open Questions

- The wording follows issue option 2. If product prefers option 1 or 3, only the `en.json` value (and the literal in the spec scenario) changes.
