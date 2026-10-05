# conversation-input-shared-hooks Specification

## Purpose

Specifies four shared hooks that consolidate logic previously duplicated across the new-chat composer (`apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`), `Conversation.tsx`, `ConversationView.tsx` and `useConversationHandlers`. `useAttachmentUpload` and `useChatSettingsFormConfig` are headless hooks in `libs/chat-hooks` (`@epam/ai-dial-chat-hooks`); `useAudioTranscription` and `useModelSelectorLabels` live in `apps/chat/src/hooks/conversation/`. These are internal implementation-unit contracts (inputs/outputs/behavior of the hooks themselves), not new user-facing product capabilities.

---

## Requirements

### Requirement: useAttachmentUpload hook

`useAttachmentUpload` in `libs/chat-hooks/src/conversation/useAttachmentUpload/useAttachmentUpload.ts` (exported from `@epam/ai-dial-chat-hooks`) SHALL accept `{ filesApi: Pick<FilesApi, 'uploadFile'> & Partial<Pick<FilesApi, 'listFiles'>>; bucket: string | undefined; onNetworkError?: (filenames: string[]) => void; debounceMs?: number }` and return `{ handleUploadAttachment: (attachment: Attachment) => Promise<UploadedAttachmentResult> }`, where `UploadedAttachmentResult` (from `@epam/ai-dial-chat-shared`) is `{ url, name }` — the DIAL Core file URL and the name actually stored. The hook SHALL NOT construct a client; the caller injects an already-configured `filesApi`. It SHALL be the single attachment-upload implementation used by `NewConversationComposer.tsx` (which passes the app's `filesApi`, a notification callback, and `debounceMs: NETWORK_ERROR_DEBOUNCE_MS` from `apps/chat/src/constants/upload.ts`) and by the lib's own `useConversationHandlers`.

Each upload SHALL get a collision-free path: the file name is reduced to its last `/` segment and sanitized with `sanitizeFileName`, then a per-bucket, per-month allocator from `createUploadPathAllocator` assigns `uploads/<YYYY-MM>/<name>`, adding a ` (n)` suffix when the name is already taken. Uploads use `uploadMode: 'create-only'`; on a 409 conflict the hook marks the name taken, best-effort lists the folder via `filesApi.listFiles` when provided, and retries with a new name up to 5 times.

#### Scenario: Successful upload while online

- **WHEN** `handleUploadAttachment` is called with a valid attachment while the browser is online and a bucket is available
- **THEN** the hook uploads the file via `filesApi.uploadFile` with `uploadMode: 'create-only'` at the allocated `uploads/<YYYY-MM>/...` path, and resolves with `{ url, name }`

#### Scenario: Name collision is resolved without overwriting

- **WHEN** two attachments with the same name are uploaded, or the server answers a `create-only` upload with 409
- **THEN** the later upload is stored under a ` (n)`-suffixed name and the resolved `name` reflects that stored name

#### Scenario: Upload attempted while offline

- **WHEN** an upload fails for one or more attachments while `navigator.onLine` is `false`
- **THEN** the hook tags the thrown error with `AttachmentErrorReason.Network`, batches the affected filenames over the `debounceMs` window (default `700`), and invokes `onNetworkError` once per batch with the list of filenames

#### Scenario: No onNetworkError callback provided

- **WHEN** `useAttachmentUpload` is used without an `onNetworkError` callback
- **THEN** the hook still performs offline detection and debounced batching internally without throwing, and simply does not emit a notification

### Requirement: useAudioTranscription hook

`apps/chat/src/hooks/conversation/useAudioTranscription.ts` SHALL accept `{ selectedDeploymentId?: string | null }` and return `{ isAudioMessageSupported: boolean; isVoiceRecordingSupported: boolean; handleTranscribeAudio: TranscribeAudio }`. It SHALL be the single audio-capability and recognition entry point used by `NewConversationComposer.tsx`, `Conversation.tsx` and `AppPreviewChat.tsx`.

The hook SHALL read every other input from context rather than from its parameters: the bucket from `useUser()`, `asrModelId` and `transcribeSizeLimitBytes` from `useAppConfig().config`, the deployment list from `useDeployments()`, and the effective voice-input flag from `useUiFeature(OverlayFeature.VoiceInput)`. It SHALL NOT accept `bucket`, `transcribeSizeLimitBytes` or `asrModelId` as parameters.

The hook SHALL derive two distinct capability flags, memoised with `useMemo` for the deployment lookup:

- `isVoiceRecordingSupported` SHALL be `true` only when the voice-input feature is enabled **and** the deployment resolved by `findDeploymentByIdOrReference(items, selectedDeploymentId)` reports audio support through `isAudioTranscriptionSupported(inputAttachmentTypes)`.
- `isAudioMessageSupported` SHALL be `true` when the voice-input feature is enabled **and** either `asrModelId` is configured or `isVoiceRecordingSupported` is `true`.

Upload, provider routing, size validation and retries SHALL be delegated to `useTranscribeAudio` from `@epam/ai-dial-chat-hooks`, configured with the generated `transcriptionApi` and `filesApi` instances, `transcribeWithDeployment: transcribeAudio` from `server-api/chat.api`, the resolved bucket, `maxSizeBytes: transcribeSizeLimitBytes`, and `asrModelId` only when `isAudioMessageSupported` is `true`. The hook SHALL NOT implement upload or recognition itself, and SHALL NOT reference the removed `transcribeAudioWithAsrModel` wrapper.

`handleTranscribeAudio` SHALL be memoised with `useCallback` and SHALL translate failures into host-facing messages through `t()` with keys from `VoiceRecordingI18nKeys`: `Unavailable` when dictation is not supported or the reason is `AudioTranscriptionErrorReason.Unavailable`, `TooLarge` (interpolating `maxSize: formatFileSize(error.limitBytes ?? transcribeSizeLimitBytes)`) for `TooLarge`, `Busy` for `Busy`, and `Failed` for any other failure. When the caller's `AbortSignal` is already aborted, the original error SHALL be rethrown untranslated so cancellation is distinguishable from failure.

Feature gating is the existing `OverlayFeature.VoiceInput` (`voice-input`) entry resolved from `ENABLED_UI_FEATURES`; the hook introduces no role gate of its own. RTL impact: none — the hook renders no UI.

#### Scenario: Recognition is delegated to the shared hook

- **WHEN** `handleTranscribeAudio` is called with a recording while `isAudioMessageSupported` is `true`
- **THEN** the call is forwarded to `useTranscribeAudio`, which performs the upload and routes recognition to the ASR adapter when `asrModelId` is configured and to the selected deployment otherwise
- **AND** the hook itself issues no upload or transcription request

#### Scenario: Dictation attempted while unsupported

- **WHEN** `handleTranscribeAudio` is called while `isAudioMessageSupported` is `false`
- **THEN** it rejects with `t(VoiceRecordingI18nKeys.Unavailable)` before any upload or recognition request

#### Scenario: Oversized recording surfaces a translated message

- **WHEN** `useTranscribeAudio` raises `AudioTranscriptionError` with reason `TooLarge` and a `limitBytes` value
- **THEN** `handleTranscribeAudio` rejects with `t(VoiceRecordingI18nKeys.TooLarge, { maxSize: formatFileSize(limitBytes) })`

#### Scenario: The two capability flags diverge

- **WHEN** `asrModelId` is configured, the voice-input feature is enabled, and the selected deployment accepts no audio MIME type
- **THEN** `isAudioMessageSupported` is `true` and `isVoiceRecordingSupported` is `false`
- **AND** the caller renders the Dictate microphone while omitting the "Record voice" menu item

#### Scenario: Cancellation is not translated

- **WHEN** recognition rejects and the caller's `AbortSignal` is already aborted
- **THEN** the original error is rethrown unchanged rather than replaced by a `voiceRecording.*` message

### Requirement: useModelSelectorLabels hook

`apps/chat/src/hooks/conversation/useModelSelectorLabels.ts` SHALL accept `{ isLoading, error, itemCount }` and return an object with `ariaLabel`, `loading`, `error`, `empty`, `searchPlaceholder`, `closeLabel`, and `unavailableTooltip` fields, sourced via `useTranslation()` using keys from `DeploymentSelectorI18nKeys` and `BasicI18nKeys` (`BasicI18nKeys.SearchPlaceholder`) in `translation-keys.ts`. `loading`, `error` and `empty` are `undefined` unless the matching state applies. No raw string literals are used for any label.

#### Scenario: Labels are consistent across both surfaces

- **WHEN** `NewConversationComposer.tsx` and `ConversationView.tsx` both render a model selector using `useModelSelectorLabels`
- **THEN** both surfaces display identical label text and language-key resolution for the same `isLoading`/`error`/`itemCount` inputs

### Requirement: useChatSettingsFormConfig hook

`useChatSettingsFormConfig` in `libs/chat-hooks/src/useChatSettingsFormConfig/useChatSettingsFormConfig.ts` (exported from `@epam/ai-dial-chat-hooks`) SHALL be headless and accept a discriminated-union options object — `{ mode: 'local'; values: { responseFormat; systemPrompt; temperature }; onValuesChange; deploymentFeatures?; isQuickApp? }` for new-chat usage or `{ mode: 'conversation'; conversation; onConversationChange; deploymentFeatures?; isQuickApp? }` for existing-conversation usage — plus optional `labels?: Partial<ChatSettingsFormLabels>` (English defaults inside the hook) and `onSaved?: () => void`. It SHALL return a flat `UseChatSettingsFormConfigResult`: `features` (`systemPrompt`, `temperature`, `responseFormat: true`), the current `responseFormat`, `systemPrompt` and `temperature`, `onSave`, and the label strings (`menuItemLabel`, `title`, field labels, `temperatureLabels` as a `[precise, neutral, creative]` tuple, `saveLabel`, `saveDisabledTooltip`). The hook SHALL NOT call `t()` or show notifications itself.

The app supplies translations through `apps/chat/src/hooks/conversation/useChatSettingsFormLabels.ts`, which builds `ChatSettingsFormLabels` from `BasicI18nKeys.Settings` and `ChatSettingsI18nKeys`, and passes `onSaved` to show a success notification with `savedNotification`.

When `isQuickApp` is `true`, the returned `features.temperature` SHALL be `false` regardless of `deploymentFeatures?.temperature` — a Quick App's orchestrator configuration sets its own fixed temperature, so the per-conversation temperature control MUST stay hidden. Callers (`NewConversationComposer.tsx`, `ConversationView.tsx`) SHALL derive `isQuickApp` via `isQuickAppSchema({ id: selectedDeployment?.applicationTypeSchemaId })`.

#### Scenario: Temperature is hidden for Quick App deployments

- **WHEN** `useChatSettingsFormConfig` is called with `isQuickApp: true` and `deploymentFeatures.temperature === true`
- **THEN** the returned `features.temperature` is `false`, so no temperature slider is rendered, in both new-chat (`NewConversationComposer`) and existing-conversation (`ConversationView`) usage

#### Scenario: Local mode wires values directly

- **WHEN** `useChatSettingsFormConfig` is called with `mode: 'local'` from `NewConversationComposer.tsx`
- **THEN** the returned `responseFormat`, `systemPrompt` and `temperature` reflect the passed-in `values`, and `onSave` invokes `onValuesChange` with the merged values (then `onSaved`) without persisting to a conversation

#### Scenario: Conversation mode wires the target conversation

- **WHEN** `useChatSettingsFormConfig` is called with `mode: 'conversation'` from `ConversationView.tsx`
- **THEN** the returned values reflect the given `conversation` (`responseFormat`, `prompt`, and `temperature` defaulting to `0.5`), and `onSave` invokes `onConversationChange` with the updated conversation (then `onSaved`)

#### Scenario: Shared label wiring is identical across modes

- **WHEN** the app uses the hook in either `mode: 'local'` or `mode: 'conversation'`
- **THEN** both surfaces pass the same `useChatSettingsFormLabels()` result as `labels`, so every label resolves via the same `BasicI18nKeys` / `ChatSettingsI18nKeys` keys with no per-surface divergence

#### Scenario: Labels fall back to English when omitted

- **WHEN** the hook is called without `labels`
- **THEN** every returned label uses the hook's English default (e.g. `title: 'Settings'`, `saveLabel: 'Apply changes'`)
