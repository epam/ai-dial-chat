## MODIFIED Requirements

### Requirement: Export a single conversation without attachments as JSON

The system SHALL let a user export one conversation, without attachments, from the conversation's context menu. `useConversationExport` (`libs/chat-hooks/src/conversation/useConversationExport/useConversationExport.ts`, exported from `@epam/ai-dial-chat-hooks/conversation-transfer`) SHALL fetch the full conversation through the injected generated-client operation `ConversationsApi.getConversation({ path })`, where `path` comes from the host's `normalizeConversationPath(conversationId)`. A `429` response SHALL be retried up to 5 attempts, waiting `Retry-After` seconds when present and otherwise `2000 ms × attempt`. The conversation is serialized into the JSON v5 envelope, wrapped in a `Blob` of type `application/json`, and downloaded with `triggerBlobDownload(blob, filename)` from `@epam/ai-dial-chat-shared` (`libs/chat-shared/src/utils/file-download.ts`); no new `<a download>` is hand-rolled. Like every other export mode, this path SHALL create a queue job (see the export-queue requirement) so the user has one consistent place to see the status of every export they trigger, even ones that complete almost immediately. The downloaded file SHALL be named per the file-naming requirement.

Because this mode ships no attachment bytes, the system SHALL remove every attachment reference from the exported conversation — `custom_content.attachments`, each stage's `attachments`, each message annotation's `body.source` (the cited document), and the `body.source` of each entry in the conversation-level citation pool `customViewState.annotations` (see the `conversation-custom-view-state` capability) — keeping each annotation's quote, title and target. Every other `customViewState` key SHALL be kept verbatim. The pool is untrusted persisted JSON: when `customViewState.annotations` is not an array, it SHALL be left as it is, and a `null` or non-object entry in it SHALL be kept unchanged rather than thrown on. A kept reference is a `files/{bucket}/{path}` id in the exporting user's bucket: the importing user either cannot read it (403 on every preview) or, re-importing their own file, gets back the very attachments the mode excluded (issues #8663, #9003). A pool reference is not redundant with the message citation it was copied from: once the message citation loses its source, the citation renderer resolves the same `<cit>` from the pool, so a pool reference left behind is still opened.

#### Scenario: Without-attachments export carries no attachment references

- **GIVEN** a conversation whose messages carry attachments, stage attachments, and a citation with a source document
- **WHEN** the user chooses Export → "without attachments"
- **THEN** the downloaded `.json` contains no `files/…` reference to any of them, and the citation keeps its quote

#### Scenario: Pool citation sources are stripped too

- **GIVEN** a conversation whose `customViewState` is `{ annotations: [<html_tag citation citing files/{bucket}/a.pdf>], layout: 'wide' }`
- **WHEN** the user chooses Export → "without attachments", or "Export all conversations"
- **THEN** the exported pool entry has no `body.source`, keeps its quote, title and target, and `customViewState.layout` is still `'wide'`

#### Scenario: A malformed pool does not break export

- **GIVEN** a conversation whose `customViewState.annotations` is a string, or an array containing `null`
- **WHEN** the conversation is exported without attachments
- **THEN** the export succeeds and the malformed value or entry is carried through unchanged

#### Scenario: Single JSON export downloads immediately

- **GIVEN** a user opens a conversation's context menu
- **WHEN** the user chooses Export → "without attachments"
- **THEN** the conversation content is fetched, a `.json` file containing the v5 envelope with that one conversation in `history` is downloaded, and a queue job tracks the operation to completion

#### Scenario: Fetch failure surfaces an error and downloads nothing

- **GIVEN** the conversation-content fetch fails
- **WHEN** the user chooses Export → "without attachments"
- **THEN** an error toast is shown and no file is downloaded

---

### Requirement: Export a single conversation with attachments as a `.dial` ZIP

The system SHALL let a user export one conversation, with attachments, producing a `.dial` ZIP archive (built with `fflate`) that contains the conversation's JSON v5 envelope plus every referenced attachment file. The set of referenced files SHALL be collected from every place a conversation can carry one — `custom_content.attachments`, the attachments of each entry in `custom_content.stages` (how an agent returns a generated file), the `body.source.attachment` of each entry in `custom_content.annotations` (a citation source document), and the `body.source.attachment` of each entry in the conversation-level citation pool `customViewState.annotations` — reading both `url` and `reference_url`. Pool entries are visited after every message, and a `null`, non-object or source-less pool entry, or a pool that is not an array, contributes nothing. The pool can reference a file no remaining message references (its entries accumulate and are never removed when a message is deleted or regenerated), and a later turn's `<cit>` resolves through it (issue #9002), so a pool-only file SHALL be bundled like any other. A trailing `#…` display anchor (e.g. a PDF `#page=N`) SHALL be stripped before a reference is resolved to `{bucket, path}`, since it is not part of the stored resource path. Each attachment SHALL be fetched through the injected generated-client operation `FilesApi.downloadFileRaw({ bucket, path })` (the existing `GET /api/v1/files/download` endpoint), and placed inside the archive under a `res/<relative-path>/<filename>` layout. Attachment fetches SHALL run with a bounded parallelism of at most 5 concurrent requests. This path SHALL create a queue job (see the export-queue requirement) because it is a potentially long operation; the app remains fully usable while it runs. The downloaded file SHALL be named per the file-naming requirement.

The backend share flow (`collectConversationResourceUrls` in `apps/chat-api/src/share/utils/share-resource.util.ts`) does not yet visit the pool; export and import cover it regardless, and aligning the share flow is tracked separately.

#### Scenario: ZIP export bundles conversation and attachments

- **GIVEN** a conversation with two attachments
- **WHEN** the user chooses Export → "with attachments"
- **THEN** a `.dial` archive is downloaded containing the conversation JSON envelope and both attachment files under `res/…`

#### Scenario: Attachment fetches are throttled

- **GIVEN** a conversation referencing 12 attachments
- **WHEN** the ZIP export runs
- **THEN** no more than 5 attachment download requests are in flight at any moment

#### Scenario: Stage and citation files are bundled too

- **GIVEN** a conversation whose assistant turn produced a file inside an execution stage and cites a source document through an annotation
- **WHEN** the ZIP export runs
- **THEN** both files are fetched and written under `res/…` alongside the message-level attachments

#### Scenario: A file referenced only by the citation pool is bundled

- **GIVEN** a conversation whose `customViewState.annotations` cites `files/{bucket}/sources/old.pdf` and no message references that file
- **WHEN** the ZIP export runs
- **THEN** `old.pdf` is fetched once and written under `res/sources/old.pdf`

#### Scenario: A file cited by both a message and the pool is fetched once

- **GIVEN** a message citation and its pool copy both reference `files/{bucket}/sources/spec.pdf#page=7`
- **WHEN** the ZIP export runs
- **THEN** exactly one download is requested for `sources/spec.pdf`

#### Scenario: A reference carrying a display anchor resolves to the file itself

- **GIVEN** a citation referencing `files/{bucket}/sources/spec.pdf#page=7`
- **WHEN** the ZIP export runs
- **THEN** the download is requested for `sources/spec.pdf` (without `#page=7`) and the archive entry is `res/sources/spec.pdf`

#### Scenario: A failed attachment is skipped with a warning

- **GIVEN** one attachment of several fails to download
- **WHEN** the ZIP export runs
- **THEN** that attachment is omitted from the archive, a warning toast informs the user, the archive containing the remaining files is still downloaded, and the job settles as `Warning`
