Slicing strategy: vertical. It is a single slice: the string and the app-edge formatting land together, and the test locks them in. Library code is not touched.

## 1. i18n string

- [x] 1.1 In `apps/chat/src/i18n/locales/en.json`, change `voiceRecording.tooLarge` to `"Audio recording exceeds the {{maxSize}} limit. Please shorten the recording and try again."`. Do not add any new keys, and leave `VoiceRecordingI18nKeys.TooLarge` in `apps/chat/src/constants/translation-keys.ts` unchanged.

## 2. App-edge formatting

- [x] 2.1 In `apps/chat/src/hooks/conversation/useAudioTranscription.ts`, import `formatFileSize` from `@epam/ai-dial-chat-shared` (add it to the existing `isAudioTranscriptionSupported` import). In the `AudioTranscriptionErrorReason.TooLarge` branch, call `t(VoiceRecordingI18nKeys.TooLarge, { maxSize: formatFileSize(error.limitBytes ?? transcribeSizeLimitBytes) })`, and add `transcribeSizeLimitBytes` to the `handleTranscribeAudio` `useCallback` dependencies. Use extensionless relative imports, and do not change the other branches.
- [x] 2.2 Architecture guard: confirm the diff does not touch `libs/chat-hooks/src/conversation/useTranscribeAudio/*`. `AudioTranscriptionError.limitBytes` stays a raw number, and no i18n or unit knowledge enters a library.

## 3. Tests

- [x] 3.1 In `apps/chat/src/hooks/conversation/tests/useAudioTranscription.spec.ts`, keep the existing `it.each` reason→key table, and add behavior-named cases that capture the `t` options (e.g. make the `react-i18next` mock's `t` a `vi.fn` that returns the key and records its options). Cover these cases:
  - `TooLarge` with `limitBytes` 5,242,880 translates `voiceRecording.tooLarge` with `{ maxSize: '5 MB' }`.
  - `TooLarge` with `limitBytes` 5,000,000 gives `{ maxSize: '4.8 MB' }`.
  - `TooLarge` without `limitBytes` falls back to the config value (`config.transcribeSizeLimitBytes`), formatted.
- [x] 3.2 Verification: `npm run test:file -- apps/chat/src/hooks/conversation/tests/useAudioTranscription.spec.ts`

## 4. Close-out

- [x] 4.1 Confirm that no doc quotes the old string. The existing references in `apps/chat/README.md:59` and `apps/chat-api/README.md:186` describe the limit, not the message, so no doc update is expected. `docs/` does not describe this message either.
- [x] 4.2 Run `npm run verify:changed` after the slice, then close the change with exactly one `npm run verify:full`.
