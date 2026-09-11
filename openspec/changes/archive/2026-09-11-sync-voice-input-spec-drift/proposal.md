## Why

`openspec/specs/voice-transcription/asr-model.md` predates the `2026-09-09-voice-input-transcription` change and was never carried forward. It still describes a single microphone button gated by an `isTranscriptionSupported` flag, a `GET /api/v1/config` endpoint, and an `onUploadAudio` callback — none of which exist. Because it is the only spec that appears to answer "when is the microphone visible?", a reader lands on it, concludes the toolbar microphone records an audio attachment, and files a bug against correct code. That already happened once.

The contradiction is now explicit inside openspec: `client-config-endpoint/spec.md` carries a requirement titled **"GET /api/v1/config is removed"**, while `asr-model.md` still specifies that endpoint as live.

`openspec/specs/conversation-input-shared-hooks/spec.md` carries the same generation of drift for `useAudioTranscription`, so two specs agree with each other and disagree with the source.

## What Changes

- **Delete `openspec/specs/voice-transcription/asr-model.md`.** Every one of its seven requirements is already owned — correctly and currently — by another capability, so the file is a stale duplicate rather than a document to repair:

  | `asr-model.md` requirement | Current owner |
  | --- | --- |
  | `ASR_MODEL environment variable` | `config-registry-and-env-provider` — `asr.modelId` / `asr.transcribeSizeLimitBytes` entries with `envVar` and defaults |
  | `GET /api/v1/config endpoint` | `client-config-endpoint` — the real path, `appId` query, ASR happy-path scenarios, **and** an explicit "GET /api/v1/config is removed" requirement |
  | `POST /api/v1/transcription endpoint` | `voice-transcription/spec.md` — _Existing transcription API and generated client contract_, including the 502/503 + `Retry-After` mapping `asr-model.md` never had |
  | `AppConfigContext in the frontend` | `app-config-context` — including the `config.*` nesting and the auth-gated fetch |
  | `isTranscriptionSupported when ASR_MODEL is set` | `voice-dictation` — _Effective voice-input feature gating_, whose scenarios distinguish Dictate from Record voice |
  | `onTranscribeAudio routing` | `voice-transcription/spec.md` — _App-owned complete-file upload and routing_ |
  | `Audio file size validation` | `voice-transcription/spec.md` — same requirement |

  Nothing is lost by the deletion; five specs already say all of it, and say it accurately.

- Correct the `useAudioTranscription hook` requirement in `conversation-input-shared-hooks`: parameters are `{ selectedDeploymentId? }` (bucket, ASR id and size limit are read from `useUser` / `useAppConfig` / `useUiFeature`, not passed in), the return is `{ isAudioMessageSupported, isVoiceRecordingSupported, handleTranscribeAudio }`, upload and recognition are delegated to `useTranscribeAudio` from `@epam/ai-dial-chat-hooks`, size-limit and unavailability failures surface as translated `voiceRecording.*` messages, and the removed `transcribeAudioWithAsrModel` no longer appears.

- Delete the dead `handleUploadAudio` / `isTranscriptionSupported` fields from the two `useAudioTranscription` test mocks that still declare them.

No runtime behavior changes. This change makes the specs describe what the code already does.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `voice-transcription`: the `asr-model.md` file and all seven of its requirements are removed as superseded duplicates. `voice-transcription/spec.md` itself is unchanged — it was verified against the source and is accurate.
- `conversation-input-shared-hooks`: the `useAudioTranscription hook` requirement is restated against the current parameters, return shape, delegation and error mapping.

## Impact

- **Specs removed:** `openspec/specs/voice-transcription/asr-model.md`.
- **Specs modified:** `openspec/specs/conversation-input-shared-hooks/spec.md` (one requirement).
- **Specs verified, no edit needed:** `voice-recording-ui/spec.md`, `voice-dictation/spec.md`, `voice-transcription/spec.md`, `client-config-endpoint/spec.md`, `app-config-context/spec.md`, `config-registry-and-env-provider/spec.md`.
- **Code:** test-only. `apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx` and `apps/chat/src/pages/AppsEditor/tests/AppPreviewChat.spec.tsx` mock `useAudioTranscription` with fields the hook does not return.
- **No impact:** backend endpoints, `useAudioTranscription` itself, library props, i18n keys, and the `@epam/ai-dial-chat-api-client` contract are unchanged.
- **Risk:** the one judgment call is deleting rather than repairing `asr-model.md`. It rests on the coverage table above — if a reviewer finds a fact in it that no other spec carries, that fact moves to its owning capability instead of the file surviving.
