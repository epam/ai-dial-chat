## 1. Verify the coverage claim before deleting anything

- [x] 1.1 Confirm `config-registry-and-env-provider/spec.md` states the `asr.modelId` and `asr.transcribeSizeLimitBytes` registry entries with `envVar`, `valueType` and defaults (`null` / `5242880`), covering the `ASR_MODEL environment variable` requirement
- [x] 1.2 Confirm `client-config-endpoint/spec.md` states `GET /api/v1/client-config`, the `config.asrModelId` / `config.transcribeSizeLimitBytes` fields, both ASR scenarios, and the existing `GET /api/v1/config is removed` requirement
- [x] 1.3 Confirm `app-config-context/spec.md` states the `config.*` nesting, the safe defaults in loading and error states, and the auth-gated fetch
- [x] 1.4 Confirm `voice-transcription/spec.md` states the `POST /api/v1/transcription` contract (operationId `transcribeAudio`, 500 on missing `ASR_MODEL`, 429/503 → 503 with `Retry-After`), the ASR-vs-deployment routing rule, and the `transcribeSizeLimitBytes` pre-upload validation
- [x] 1.5 Confirm `voice-dictation/spec.md` states the `isAudioMessageSupported` / `isVoiceRecordingSupported` derivation and the Dictate-available / Record-voice-absent scenario
- [x] 1.6 If any fact in `asr-model.md` has no owner found above, move it into the owning capability as an added requirement instead of dropping it, and note the addition in the delta

## 2. Remove the superseded spec

- [x] 2.1 Delete `openspec/specs/voice-transcription/asr-model.md`
- [x] 2.2 Grep the repository for links to `asr-model.md` (`openspec/`, `docs/`, `README.md`, `AGENTS.md`) and repoint or remove each one
- [x] 2.3 Run `npm run validate:docs` to confirm no relative markdown link is left dangling

## 3. Correct the shared-hook spec

- [x] 3.1 Replace the `useAudioTranscription hook` requirement in `openspec/specs/conversation-input-shared-hooks/spec.md` with the `MODIFIED` block from this change's delta
- [x] 3.2 Verify the rewritten requirement against `apps/chat/src/hooks/conversation/useAudioTranscription.ts` — parameters, return fields, the `useTranscribeAudio` delegation, and every `VoiceRecordingI18nKeys` member it names
- [x] 3.3 Confirm no other requirement in that spec mentions `handleUploadAudio`, `isTranscriptionSupported`, or `transcribeAudioWithAsrModel`

## 4. Drop the dead test mocks

- [x] 4.1 Remove the `handleUploadAudio` and `isTranscriptionSupported` fields from the `useAudioTranscription` mock in `apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx`
- [x] 4.2 Remove the `isTranscriptionSupported` field from the `useAudioTranscription` mock in `apps/chat/src/pages/AppsEditor/tests/AppPreviewChat.spec.tsx`
- [x] 4.3 Confirm each remaining mock field matches the hook's `Result` interface exactly, and that neither suite asserts on a removed field
- [x] 4.4 Run `npm run test:file -- apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx` and `npm run test:file -- apps/chat/src/pages/AppsEditor/tests/AppPreviewChat.spec.tsx`

## 5. Verify

- [x] 5.1 Run `openspec validate sync-voice-input-spec-drift --strict` and resolve any reported issue
- [ ] 5.2 Run `npm run verify:changed` — blocked by pre-existing `@epam/chat-api` and `mcp-app-sandbox` typecheck errors already present in the working tree, in files this change does not touch. `@epam/chat` typecheck + lint and both affected suites pass; re-run once the branch typecheck is green.
- [x] 5.3 Re-read the delta's seven `**Migration**` lines against the specs they name, so the archived record stays accurate

## 6. Archive

- [x] 6.1 Archive the change (archived ahead of merge by explicit request, with `--skip-specs` since tasks 2.1 and 3.1 had already applied both deltas to the main specs by hand)
- [x] 6.2 Check whether the archive left an empty `openspec/specs/voice-transcription/asr-model.md`; delete the file if a stub remains (the open question in `design.md`)
- [x] 6.3 Confirm `openspec/specs/voice-transcription/` contains only `spec.md`
