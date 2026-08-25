## ADDED Requirements

### Requirement: Debounced-batched attachment upload hook

`@epam/ai-dial-chat-hooks` SHALL export a hook (the generalized form of
`apps/chat`'s `useAttachmentUpload`) that uploads files to DIAL Core storage
against an already-configured generated-client API instance, and that
coalesces a burst of offline/network upload failures into a single debounced
callback rather than firing one notification per failed file. The hook SHALL
build the DIAL storage path for each file using a library-owned pure
function equivalent to `apps/chat`'s `buildUploadPath`, described purely in
terms of the DIAL bucket/path convention (no app-chosen segment).

The hook SHALL accept the configured files-API instance, an
`onNetworkErrorBatch: (fileNames: string[]) => void` callback, and a debounce
duration in milliseconds, and SHALL return a function that uploads a single
file and resolves to an `Attachment` (from `@epam/ai-dial-chat-shared`) or
rejects with an error tagged `AttachmentErrorReason` (also from
`@epam/ai-dial-chat-shared`).

#### Scenario: Successful upload resolves with an Attachment

- **WHEN** a consumer calls the returned upload function with a `File` while
  online
- **THEN** the promise resolves with an `Attachment` describing the uploaded
  file's DIAL storage location

#### Scenario: A burst of offline failures is batched into one callback

- **WHEN** three uploads fail in quick succession because the browser is
  offline, within the configured debounce window
- **THEN** `onNetworkErrorBatch` is called exactly once with all three file
  names, not three times

#### Scenario: A failure outside the debounce window is reported separately

- **WHEN** one upload fails, the debounce window elapses, and then a second
  upload fails
- **THEN** `onNetworkErrorBatch` is called twice, once per failure

### Requirement: Default attachment-click dispatch hook

`@epam/ai-dial-chat-hooks` SHALL export a hook (the generalized form of
`apps/chat`'s `useAttachmentAction`) that, given a `DisplayAttachment` (from
`@epam/ai-dial-chat-shared`), dispatches the appropriate default click
behavior: download a DIAL-hosted or inline-`data` attachment, open a
reference-only PDF attachment in the canvas (via `@epam/ai-dial-attachment-canvas`'s
`useAttachmentCanvas`) scrolled to its referenced page when present, or
otherwise open/download the reference as-is. The hook SHALL own `isDialFileId`
(a pure `files/`-prefix check) as a library-owned function, since that
detection is DIAL Core protocol-level and identical for any DIAL-Core-backed
consumer. It SHALL NOT own the file-id-to-download-URL resolution itself,
since that encodes the app's own file-download endpoint (observed in
`apps/chat` as a `/api/v1/files/download` BFF route) — the hook SHALL instead
accept a required `resolveDownloadUrl: (fileId: string) => string | undefined`
parameter and use it wherever a DIAL file id needs to become a downloadable
URL.

The hook SHALL return `{ handleAttachmentClick: (attachment: DisplayAttachment)
=> void }`. It SHALL also export the standalone `isDownloadableAttachment:
(attachment: DisplayAttachment) => boolean` and `downloadAttachment:
(attachment: DisplayAttachment, resolveDownloadUrl: (fileId: string) => string
| undefined) => boolean` functions the hook is built on, for callers that need
the download decision outside the click handler (e.g. a "download all"
action).

#### Scenario: Downloadable DIAL file is downloaded

- **WHEN** a consumer calls `handleAttachmentClick` with a `DisplayAttachment`
  whose `url` is a DIAL file id
- **THEN** the hook calls the supplied `resolveDownloadUrl` with that file id
  and triggers a browser download from the resolved URL

#### Scenario: Canvas-previewable reference attachment opens the canvas

- **WHEN** a consumer calls `handleAttachmentClick` with an attachment that has
  no `url`/`data` but a PDF `referenceUrl` with a page anchor
- **THEN** the hook opens the canvas scrolled to that page instead of
  attempting a direct download

#### Scenario: isDownloadableAttachment reflects the DIAL file-id convention

- **WHEN** a consumer calls `isDownloadableAttachment` with a
  `DisplayAttachment` whose `url` is not a DIAL file id and has no `data`
- **THEN** it returns `false`
