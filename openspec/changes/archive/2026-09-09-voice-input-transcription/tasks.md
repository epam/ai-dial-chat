## 1. Complete-recording dictation

Slicing strategy: vertical. First establish complete-recording-to-draft behavior, then widen to attachment recording and all composer entry points, then close with compatibility and validation. Checkboxes describe work already implemented; verification results below distinguish successful checks from attempted repository-wide gates. Source edits preserve extensionless TypeScript imports and frontend bundler resolution.

- [x] 1.1 Implement the complete-file session in `libs/conversation-input/src/hooks/useVoiceRecorder.ts` and the host-neutral callback in `src/models/Voice.ts`. Preserve actual MIME, cancellation, duplicate Stop protection and cleanup before recognition.

  **Verification:** `npm run test:file -- libs/conversation-input/src/hooks/tests/useVoiceRecorder.spec.ts`.

- [x] 1.2 Insert completed text into the latest draft in `libs/conversation-input/src/components/Input/Input.tsx`, preserving whitespace, attachments and cancellation behavior without automatic sending.

  **Verification:** `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.voice.spec.tsx libs/conversation-input/src/components/Input/tests/Input.recording.spec.tsx`.

- [x] 1.3 Adapt validation, upload and ASR/deployment routing in `apps/chat/src/hooks/conversation/useAudioTranscription.ts` and `apps/chat/src/server-api/chat.api.ts`; use the configured TranscriptionApi singleton in `api-client.ts`.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/conversation/tests/useAudioTranscription.spec.ts`. Architecture guard: no routes, generated clients, app contexts, auth/environment/feature configuration, provider details, storage conventions or telemetry enter `libs/conversation-input`; the file-and-signal callback carries host behavior.

## 2. Separate audio attachment recording and UI

Depends on slice 1; both actions share its capture lifecycle.

- [x] 2.1 Add explicit attachment mode and Record voice before Settings in `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`; wire it from `Input.tsx` through the ordinary attachment pipeline and label the microphone Dictate.

  **Verification:** `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.recording.spec.tsx libs/conversation-input/src/components/AddAttachmentButton/tests/AddAttachmentButton.spec.tsx libs/conversation-input/src/components/AddAttachmentButton/tests/AddAttachmentButton.prompts.spec.tsx`. The integration test exercises menu order and attachment delivery with recognition configured on both mobile and desktop.

- [x] 2.2 Replace the textarea with VoiceBar during capture, processing and error in `Input.tsx`; retain draft state and existing attachments. Keep accessible Stop/discard controls, polite statuses and error alerts in `VoiceBar.tsx`.

  **Verification:** `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.recording.spec.tsx libs/conversation-input/src/components/Input/tests/Input.spec.tsx`. Synthetic Chromium checks exercise the production Input at 360, 769, 1280 and 1920 px with simulated upload/recognition.

- [x] 2.3 Wire separate capabilities and existing voice-input gating through `useAudioTranscription.ts`, `NewConversationComposer.tsx`, `ConversationView.tsx`, `pages/Conversation/Conversation.tsx` and `pages/AppsEditor/AppPreviewChat.tsx`. ASR availability must not grant audio attachment support to text-only models.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/conversation/tests/useAudioTranscription.spec.ts`; app typecheck/lint plus inspection of all three adapters.

- [x] 2.4 Add/update `voiceRecording.*` strings in `apps/chat/src/i18n/locales/en.json` and pass translated labels through the composers. Expose optional resolved labels/capabilities in `libs/conversation-input/src/models/Input.ts` and `ConversationInput.ts`.

  **Verification:** `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.recording.spec.tsx`; `npm run validate:docs` checks the documented public API.

- [x] 2.5 Check RTL isolation and responsive semantics in `Input.tsx`, `VoiceBar.tsx` and `AddAttachmentButton.tsx`: logical alignment, symmetric icons without mirroring, inherited direction, and mobile touch targets. Preserve the existing waveform's time direction.

  **Verification:** `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.recording.spec.tsx`; source inspection and library lint confirm logical styling. Mobile/desktop browser geometry checks are recorded below; no dedicated Arabic browser run is claimed.

## 3. Temporary ASR failure handling

Depends on the app adapter in slice 1; retries remain independent of capture mode.

- [x] 3.1 Preserve Core 429/503 and Retry-After in `apps/chat-api/src/transcription/transcription.service.ts`, `transcription.controller.ts` and `transcription-unavailable.exception.ts`; add service and real Nest HTTP response tests under `transcription/tests`.

  **Verification:** `npm run test:file -- apps/chat-api/src/transcription/tests/transcription.service.spec.ts apps/chat-api/src/transcription/tests/transcription.controller.spec.ts`.

- [x] 3.2 Regenerate the transcription OpenAPI response/header documentation from backend annotations into `libs/chat-api-client/openapi.json`, keeping the existing operation and generated normal method. Preserve the explicitly documented selected-deployment generator exception in `chat.api.ts`.

  **Verification:** Previously run `npm run openapi`, `npm run openapi:check` and generated-client validation. The service/controller tests above cover response behavior. Generated artifacts are not hand-edited; the pre-existing success-status annotation mismatch is recorded in design follow-ups.

- [x] 3.3 Implement upload-once, bounded retry waiting and cancellation in `apps/chat/src/server-api/transcription-retry.ts` and `useAudioTranscription.ts` with dedicated unit tests.

  **Verification:** `npm run test:file -- apps/chat/src/server-api/tests/transcription-retry.spec.ts apps/chat/src/hooks/conversation/tests/useAudioTranscription.spec.ts`.

## 4. Documentation and completion

Depends on slices 1–3. No unrelated refactoring or source fixes belong in this documentation pass.

- [x] 4.1 Update `libs/conversation-input/README.md`, `apps/chat/README.md` and `apps/chat-api/README.md`. Consolidate this proposal/design/task set and write deltas against the existing voice-recording-ui and voice-transcription requirements.

  **Verification:** `npm run validate:docs`, `openspec validate voice-input-transcription --strict`, and a read-only check that every MODIFIED/REMOVED requirement exists in its baseline spec.

- [x] 4.2 Run targeted library/app lint and type checks, `npm run verify:changed` after the completed slice, and one final `npm run verify:full` for the implementation iteration. Record limitations rather than marking the full gate successful.

  **Verification:** Evidence below. This later documentation-only consolidation reruns OpenSpec and documentation validation, without new ASR calls or a redundant full implementation test run.
