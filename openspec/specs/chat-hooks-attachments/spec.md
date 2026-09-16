# chat-hooks-attachments Specification

## Purpose

Reusable, host-agnostic attachment hooks exported by `@epam/ai-dial-chat-hooks`: debounced-batched upload to DIAL Core storage, and default attachment-click dispatch (download / canvas preview).

## Requirements

### Requirement: Debounced-batched attachment upload hook

`@epam/ai-dial-chat-hooks` SHALL export a hook (the generalized form of
`apps/chat`'s `useAttachmentUpload`) that uploads files to DIAL Core storage
against an already-configured generated-client API instance, and that
coalesces a burst of offline/network upload failures into a single debounced
callback rather than firing one notification per failed file. The hook SHALL
build the DIAL storage path for each file using a library-owned pure
function equivalent to `apps/chat`'s `buildUploadPath`, described purely in
terms of the DIAL bucket/path convention (no app-chosen segment).

`useAttachmentUpload` SHALL accept `filesApi`, the resolved `bucket`, an
optional `onNetworkError: (fileNames: string[]) => void` callback, and optional
`debounceMs` (default `700`). The configured client contract SHALL be
`Pick<FilesApi, 'uploadFile'> & Partial<Pick<FilesApi, 'listFiles'>>`;
the hook SHALL NOT construct or configure a client itself.

The hook SHALL return `handleUploadAttachment(attachment: Attachment)`
resolving to `UploadedAttachmentResult` (`{ url, name }`, exported by
`@epam/ai-dial-chat-shared`). When an upload fails while offline, it SHALL
reject with an error tagged `AttachmentErrorReason.Network`; other terminal
upload errors SHALL propagate to the caller.

#### Scenario: Successful upload resolves with the stored URL and name

- **WHEN** a consumer calls `handleUploadAttachment` with an `Attachment` while
  online
- **THEN** the promise resolves with `{ url, name }` describing the uploaded
  file's DIAL storage location and actual stored filename

#### Scenario: A burst of offline failures is batched into one callback

- **WHEN** three uploads fail in quick succession because the browser is
  offline, within the configured debounce window
- **THEN** `onNetworkError` is called exactly once with all three file
  names, not three times

#### Scenario: A failure outside the debounce window is reported separately

- **WHEN** one upload fails, the debounce window elapses, and then a second
  upload fails
- **THEN** `onNetworkError` is called twice, once per failure

### Requirement: Attachment conflicts skip names already stored in the month folder

`useAttachmentUpload` SHALL upload into `uploads/<YYYY-MM>/` using
`uploadMode: 'create-only'`. It SHALL keep a local upload-path allocator
scoped to the bucket and month, reserving distinct filenames for concurrent
and repeated uploads and inserting ` (n)` before the extension when needed.
It SHALL NOT overwrite an existing file to resolve a conflict.

When `uploadFile` rejects with `response.status === 409` and a retry remains,
the hook SHALL mark the attempted name as taken. If the injected client
provides `listFiles`, it SHALL list the attempted upload's month folder in
the same bucket and merge the returned item names into the allocator before
allocating another name. Listing SHALL add to existing reservations rather
than replace them, including reservations held by in-flight uploads.

Listing SHALL occur only after a conflict. If `listFiles` is absent or its
request fails, the hook SHALL preserve its local reservations and continue
with suffix-based retries. There SHALL be at most five retries after the
initial upload attempt. A sixth conflicting upload SHALL reject without
another listing or upload attempt. Non-conflict upload errors SHALL NOT
trigger this conflict-retry flow.

#### Scenario: Stored names beyond the retry budget are skipped after remount

- **WHEN** a newly mounted uploader attaches `Screenshot.png` to a month folder
  containing `Screenshot.png` and `Screenshot (1).png` through `Screenshot (12).png`
- **AND** the initial upload returns 409 and `listFiles` returns those names
- **THEN** the next upload attempts `Screenshot (13).png` in create-only mode
- **AND** a successful upload resolves with its URL and `name: 'Screenshot (13).png'`
- **AND** the hook does not upload to each intervening occupied name

#### Scenario: A successful initial upload needs no listing

- **WHEN** the initial upload succeeds
- **THEN** the hook does not call `listFiles`

#### Scenario: Concurrent uploads retain distinct reservations after listing

- **WHEN** two same-named uploads encounter conflicts and list the same folder
- **THEN** merging either listing preserves the other upload's reserved name
- **AND** the uploads retry under distinct names and resolve to distinct URLs

#### Scenario: A client without listing remains supported

- **WHEN** the injected client provides only `uploadFile` and an upload conflicts
- **THEN** the hook retries with the next locally available suffixed name
- **AND** every retry remains create-only

#### Scenario: A failed listing falls back to suffix retries

- **WHEN** uploading `file.pdf` returns 409 and the subsequent listing fails
- **AND** `file (1).pdf` is locally available and its upload succeeds
- **THEN** the hook resolves with the URL and name of `file (1).pdf`
- **AND** the listing failure does not itself fail the attachment

#### Scenario: Persistent conflicts remain bounded even with a stale listing

- **WHEN** every upload attempt returns 409 and listings omit the conflicting names
- **THEN** the hook makes at most six upload attempts and five listing requests
- **AND** it retains names learned from conflicts despite the stale listings
- **AND** it rejects with the final conflict after exhausting the retry budget

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

Before passing the filename to `triggerAnchorDownload` or `triggerBlobDownload`,
the hook SHALL call `ensureDownloadFilename(name, url, contentType)` to guarantee
a file extension is present. The function returns `name` unchanged when it already
ends with an extension; otherwise it appends the extension extracted from the last
path segment of `url`, then falls back to `MIME_TYPE_EXT_MAP[contentType]`, and
finally returns `name` as-is when neither source provides an extension.

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
  and triggers a browser download from the resolved URL, using a filename
  produced by `ensureDownloadFilename`

#### Scenario: Download filename gets extension from the URL when the name has none

- **WHEN** a consumer calls `handleAttachmentClick` with a `DisplayAttachment`
  whose `name` is `'Thermo Fisher 10-K Summary'` and whose `url` path ends with
  `'ThermoFisher_2024.xlsx'`
- **THEN** the triggered download uses the filename `'Thermo Fisher 10-K Summary.xlsx'`

#### Scenario: Download filename falls back to MIME-type extension when the URL has none

- **WHEN** a consumer calls `handleAttachmentClick` with a `DisplayAttachment`
  whose `name` has no extension, whose `url` path segment has no extension, and
  whose `contentType` is `'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`
- **THEN** the triggered download uses a filename ending in `.xlsx`

#### Scenario: Canvas-previewable reference attachment opens the canvas

- **WHEN** a consumer calls `handleAttachmentClick` with an attachment that has
  no `url`/`data` but a PDF `referenceUrl` with a page anchor
- **THEN** the hook opens the canvas scrolled to that page instead of
  attempting a direct download

#### Scenario: isDownloadableAttachment reflects the DIAL file-id convention

- **WHEN** a consumer calls `isDownloadableAttachment` with a
  `DisplayAttachment` whose `url` is not a DIAL file id and has no `data`
- **THEN** it returns `false`
