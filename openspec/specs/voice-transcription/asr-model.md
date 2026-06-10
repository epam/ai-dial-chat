### Requirement: ASR_MODEL environment variable

The backend (`apps/chat-api`) SHALL accept an optional `ASR_MODEL` environment variable.

| Variable | Type | Required | Default | Purpose |
|---|---|---|---|---|
| `ASR_MODEL` | string | No | — | Deployment ID of a dedicated speech-to-text model |
| `TRANSCRIBE_SIZE_LIMIT_BYTES` | integer | No | `5242880` (5 MB) | Maximum audio file size accepted for transcription |

When `ASR_MODEL` is set, it takes precedence over the deployment-based transcription path for all users.

---

### Requirement: GET /api/v1/config endpoint

The backend SHALL expose a `GET /api/v1/config` endpoint that returns app-level feature configuration.

Response body:

```ts
{
  asrModelId: string | null;          // null when ASR_MODEL is not configured
  transcribeSizeLimitBytes: number;   // default 5242880
}
```

#### Scenario: ASR_MODEL configured

- **WHEN** `ASR_MODEL` is set in the environment
- **THEN** `GET /api/v1/config` returns `{ asrModelId: "<value>", transcribeSizeLimitBytes: <limit> }`

#### Scenario: ASR_MODEL not configured

- **WHEN** `ASR_MODEL` is absent
- **THEN** `GET /api/v1/config` returns `{ asrModelId: null, transcribeSizeLimitBytes: <limit> }`

---

### Requirement: POST /api/v1/transcription endpoint

The backend SHALL expose a `POST /api/v1/transcription` endpoint that transcribes audio using `ASR_MODEL`.

Request body:

```ts
{
  audioUrl: string;   // DIAL storage URL of the uploaded audio
  mimeType: string;   // MIME type of the audio (e.g. "audio/webm;codecs=opus")
}
```

Response body:

```ts
{
  transcript: string;
}
```

The endpoint SHALL:
1. Reject with `500 Internal Server Error` if `ASR_MODEL` is not configured.
2. Forward the request to DIAL Core at `{DIAL_CORE_URL}/openai/deployments/{ASR_MODEL}/chat/completions` with the audio URL as an attachment.
3. Return the content of `choices[0].message.content` from the DIAL Core response.

#### Scenario: Successful transcription

- **WHEN** `POST /api/v1/transcription` is called with a valid DIAL storage URL
- **AND** `ASR_MODEL` is configured
- **THEN** the response contains `{ transcript: "<text>" }`

#### Scenario: ASR_MODEL not configured

- **WHEN** `POST /api/v1/transcription` is called
- **AND** `ASR_MODEL` is not set
- **THEN** the endpoint responds with `500 Internal Server Error`

---

### Requirement: AppConfigContext in the frontend

The app (`apps/chat/src`) SHALL maintain an `AppConfigContext` that fetches `GET /api/v1/config` once on mount and makes `asrModelId` and `transcribeSizeLimitBytes` available to all child components.

On fetch failure the context SHALL silently fall back to defaults (`asrModelId: null`, `transcribeSizeLimitBytes: 5242880`) so the app degrades gracefully to the deployment-based path.

---

### Requirement: isTranscriptionSupported when ASR_MODEL is set

When `asrModelId` is non-null (i.e. `ASR_MODEL` is configured), `isTranscriptionSupported` SHALL be `true` regardless of the selected deployment's `inputAttachmentTypes`.

When `asrModelId` is null, `isTranscriptionSupported` SHALL fall back to `isAudioTranscriptionSupported(selectedDeployment.inputAttachmentTypes)` as specified in `spec.md`.

#### Scenario: ASR model configured — mic always available

- **WHEN** `ASR_MODEL` is set
- **AND** the selected deployment does not support any audio MIME type
- **THEN** the microphone button is still shown

#### Scenario: No ASR model — mic depends on deployment

- **WHEN** `ASR_MODEL` is not set
- **AND** the selected deployment does not include any audio MIME type in `inputAttachmentTypes`
- **THEN** the microphone button is hidden

---

### Requirement: onTranscribeAudio routing

The app SHALL route `onTranscribeAudio` calls based on `asrModelId`:

| Condition | Transcription path |
|---|---|
| `asrModelId != null` | `POST /api/v1/transcription` with `{ audioUrl, mimeType }` |
| `asrModelId == null` | Existing deployment-based path (`POST /api/v1/chat/completions` using selected deployment) |

---

### Requirement: Audio file size validation

Before uploading audio, the app SHALL check `file.size > transcribeSizeLimitBytes` and throw an error if exceeded.

This causes the voice bar to enter the error state before any upload is attempted.

#### Scenario: File within limit

- **WHEN** the recorded audio file size is ≤ `transcribeSizeLimitBytes`
- **THEN** upload proceeds normally

#### Scenario: File exceeds limit

- **WHEN** the recorded audio file size is > `transcribeSizeLimitBytes`
- **THEN** `onUploadAudio` throws before calling the upload endpoint
- **THEN** the voice bar enters error state
