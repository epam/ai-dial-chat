## REMOVED Requirements

### Requirement: ASR_MODEL environment variable

**Reason**: Superseded by the config registry. `ASR_MODEL` and `TRANSCRIBE_SIZE_LIMIT_BYTES` are no longer read directly by feature code; they are declared as registry entries resolved through the provider chain, which this requirement does not describe.

**Migration**: `config-registry-and-env-provider` owns both values — the `asr.modelId` entry (`type='config'`, `valueType='string'`, `visibility='client'`, `envVar='ASR_MODEL'`, `defaultValue=null`), the `asr.transcribeSizeLimitBytes` entry (`valueType='number'`, `envVar='TRANSCRIBE_SIZE_LIMIT_BYTES'`, `defaultValue=5242880`), and the derived `features.asrEnabled` flag. The precedence of a configured ASR over the deployment-based path is stated by `voice-transcription/spec.md` (_App-owned complete-file upload and routing_) and `voice-dictation` (_Host-owned recognition routing_).

---

### Requirement: GET /api/v1/config endpoint

**Reason**: The endpoint does not exist. It was replaced by `GET /api/v1/client-config`, and its removal is already recorded as a requirement in `client-config-endpoint`, which this file directly contradicts. The response shape stated here is also wrong: `asrModelId` and `transcribeSizeLimitBytes` are nested under `config` in `ClientConfigResponseDto`, not returned at the top level.

**Migration**: `client-config-endpoint` owns the endpoint — `GET /api/v1/client-config?appId=<id>`, the `ClientConfigResponseDto` shape, and both ASR scenarios (`ASR_MODEL` set → `config.asrModelId` populated and `features.asrEnabled=true`; absent → `config.asrModelId=null` and `config.transcribeSizeLimitBytes=5242880`).

---

### Requirement: POST /api/v1/transcription endpoint

**Reason**: Duplicated and drifted. The transport description is wrong — the service calls DIAL Core through `@epam/ai-dial-typescript-sdk` (`DialClientService.client.sendChatCompletionRequest`), not a hand-built `{DIAL_CORE_URL}/openai/deployments/{ASR_MODEL}/chat/completions` URL — and the requirement omits the upstream error mapping the endpoint actually implements.

**Migration**: `voice-transcription/spec.md` (_Existing transcription API and generated client contract_) owns the endpoint, including the `TranscribeAudioDto` contract, the `transcribeAudio` operationId, the 500-on-missing-`ASR_MODEL` behaviour, and the 429/503 → 503 mapping that preserves `Retry-After`.

---

### Requirement: AppConfigContext in the frontend

**Reason**: Duplicated and drifted. It names the removed `GET /api/v1/config` route, describes `asrModelId` / `transcribeSizeLimitBytes` as top-level context fields when they live under `config`, and states the provider fetches "once on mount" and "silently falls back to defaults" — the provider waits for `useUser().status` to settle before fetching and sets an error status while retaining the defaults.

**Migration**: `app-config-context` owns the provider — its loading/ready/error states, the `config.asrModelId` / `config.transcribeSizeLimitBytes` fields with their safe defaults in both the loading and error states, the `AbortController` lifecycle, and the requirement that no request is issued while `AuthStatus.Loading`.

---

### Requirement: isTranscriptionSupported when ASR_MODEL is set

**Reason**: The flag does not exist in the codebase, and the requirement describes a single microphone. Since the `2026-09-09-voice-input-transcription` change there are two entry points with different outcomes — the action-bar microphone starts dictation and appends recognized text, while the add-menu "Record voice" item records an audio attachment. Its scenarios ("the microphone button is still shown" / "is hidden") do not say which, and have been read as evidence that the action-bar microphone produces a file.

**Migration**: `voice-dictation` (_Effective voice-input feature gating_) owns the two resolved booleans — `isAudioMessageSupported` enables dictation when the effective `voice-input` feature is on and either ASR or an audio-capable model is available; `isVoiceRecordingSupported` additionally requires the selected model's audio support. Its scenario _Dictation on a model that cannot receive audio_ states the distinction this requirement blurred: Dictate is available and Record voice is absent. The visibility rules for each control are in `voice-recording-ui` (_Mic button in ConversationInput_ and _Record voice menu action_).

---

### Requirement: onTranscribeAudio routing

**Reason**: Duplicated. The routing table is still directionally correct but is a second copy of a rule maintained elsewhere, and it names the removed `/api/v1/config` path in its surrounding context.

**Migration**: `voice-transcription/spec.md` (_App-owned complete-file upload and routing_) owns the rule: the app prefers `asrModelId` from AppConfigContext and otherwise uses the selected audio-capable deployment. `voice-transcription/spec.md` (_Host-owned file-to-text callback_) owns the library-side contract, including that Record voice bypasses the callback even when supplied.

---

### Requirement: Audio file size validation

**Reason**: Duplicated and drifted. It describes an `onUploadAudio` callback that does not exist anywhere in the codebase; validation now happens inside `useTranscribeAudio`, which raises `AudioTranscriptionError` with an `AudioTranscriptionErrorReason` that the app maps to a translated message.

**Migration**: `voice-transcription/spec.md` (_App-owned complete-file upload and routing_) owns the rule — the complete file is validated against `transcribeSizeLimitBytes` before upload and surfaces `voiceRecording.tooLarge` before any upload or recognition request. `voice-recording-ui` (_Microphone permission error_) owns the resulting voice-bar error state.
