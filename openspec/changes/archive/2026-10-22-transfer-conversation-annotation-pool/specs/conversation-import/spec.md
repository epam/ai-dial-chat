## MODIFIED Requirements

### Requirement: Rewrite attachment references to new upload locations

After re-uploading an archive attachment, the system SHALL rewrite the corresponding reference (`url`, and `reference_url` where present) to the uploaded file's returned `files/{bucket}/{path}` URL, so the imported conversation points at the newly uploaded files. The rewrite SHALL cover every place a conversation can carry a reference — `custom_content.attachments[]`, `custom_content.stages[].attachments[]`, `custom_content.annotations[].body.source.attachment`, and `customViewState.annotations[].body.source.attachment` (the conversation-level citation pool, see the `conversation-custom-view-state` capability) — matching the set the export bundles. Every other `customViewState` key SHALL be kept verbatim, and a pool that is not an array, or a `null` or non-object pool entry, SHALL be left unchanged rather than thrown on. A reference is matched to its upload by file id alone, with any trailing `#…` display anchor (e.g. a PDF `#page=N`) stripped for the lookup and re-appended to the rewritten URL, so an imported citation still opens the page it cited. An anchor is re-appended only when it stays within `/^#[\w.=%-]*$/`; an archive is untrusted input and the anchor from one is persisted into the conversation record, while the only anchor any reader parses is `#page=<digits>` — so an anchor outside that shape SHALL be discarded, leaving the rewritten reference unanchored. The file id SHALL still resolve either way, so the attachment itself is transferred regardless of its anchor. When the upload was suffixed to resolve a name collision, the system SHALL also rewrite the attachment's `title` to the suffixed file name, so the displayed name matches the file actually stored; an attachment uploaded under its original name SHALL keep its original `title` unchanged.

Pool references are collected after every message reference, so they take part in upload planning and ` (n)` suffix allocation in that fixed order, and a file referenced by both a message and the pool is uploaded once and both references point at the same upload.

A reference left unrewritten still points into the exporting user's bucket, which the importing user usually cannot read — the preview and the download then both fail, and the browser saves the error response under the attachment's file name (issue #8708). Missing one of the four reference sites is therefore a correctness defect, not a cosmetic one: a pool reference in particular is what the citation renderer opens for a `<cit>` that a later turn carries (issue #9002).

#### Scenario: Stage and citation references are rewritten too

- **WHEN** a `.dial` archive conversation carries a file produced inside an execution stage and a citation source document
- **THEN** both references are rewritten to their new upload locations, not only the message-level attachments

#### Scenario: Pool citation references are rewritten too

- **WHEN** a `.dial` archive conversation's `customViewState.annotations` cites `files/{oldBucket}/sources/old.pdf`, which no message references, and the archive carries `res/sources/old.pdf`
- **THEN** `old.pdf` is uploaded and the pool entry's `body.source.attachment.url` is rewritten to `files/{userBucket}/uploads/<YYYY-MM>/old.pdf`

#### Scenario: A message citation and its pool copy share one upload

- **WHEN** a message citation and its pool copy both reference `files/{oldBucket}/sources/spec.pdf#page=7`
- **THEN** `spec.pdf` is uploaded once and both references are rewritten to `files/{userBucket}/uploads/<YYYY-MM>/spec.pdf#page=7`

#### Scenario: A rewritten reference keeps its display anchor

- **WHEN** a citation referencing `files/{oldBucket}/sources/spec.pdf#page=7` is uploaded as `spec.pdf`
- **THEN** the rewritten reference is `files/{userBucket}/uploads/<YYYY-MM>/spec.pdf#page=7`

#### Scenario: An anchor no reader parses is not carried onto the rewritten reference

- **WHEN** an archive attachment references `files/{oldBucket}/reports/q1.pdf#"><script>` and is uploaded as `q1.pdf`
- **THEN** the attachment is still uploaded and its reference rewritten to `files/{userBucket}/uploads/<YYYY-MM>/q1.pdf`, with no anchor

### Requirement: Drop references the importing user cannot read

After rewriting the references it re-uploaded, the system SHALL remove every reference that still resolves to a `files/{bucket}/{path}` id in a bucket other than the importing user's own bucket or `public`. This covers a plain `.json` import, which carries no attachment bytes, and an archive attachment that was skipped (missing from the archive, failed validation, or exhausted its conflict retries). Such a reference points into the exporting user's bucket, so the importing user's preview fails with 403 (issue #9003); files exported before export-all stopped carrying references, and old-chat exports, still contain them.

The removal SHALL cover the same four reference sites the rewrite covers: an entry of `custom_content.attachments[]` or `custom_content.stages[].attachments[]` whose `url` is foreign is removed; a foreign `reference_url` (with its `reference_type`) is removed from an otherwise valid attachment, which is removed only when it keeps neither `url` nor `data`; a message citation, or a `customViewState.annotations` pool entry, whose `body.source.attachment.url` is foreign loses its `source` but keeps its quote, title and target. The pool SHALL be covered because removing a message citation's source alone does not stop the citation from opening the file: the citation renderer then resolves the same `<cit>` from the pool entry. Every other `customViewState` key SHALL be kept verbatim, and a pool that is not an array, or a `null` or non-object pool entry, SHALL be left unchanged. Each removed file's name SHALL be reported through the same skipped-attachment warning as an archive attachment that could not be uploaded — once per job, even when a message citation and its pool copy both referenced it — and the conversation SHALL still import. A file another user shared with the importing user is removed too — the import cannot tell it apart from one the user never had access to.

#### Scenario: Another user's JSON export imports without inaccessible references

- **GIVEN** a `.json` file whose conversation references `files/{otherBucket}/q1.pdf` and `files/{userBucket}/mine.pdf`
- **WHEN** the current user imports it
- **THEN** the saved conversation keeps only the `mine.pdf` attachment, and the job settles as a warning naming `q1.pdf`

#### Scenario: A foreign pool source is dropped and the citation no longer opens it

- **GIVEN** a `.json` file whose message citation and its `customViewState.annotations` copy both cite `files/{otherBucket}/cite.txt`, and whose pool also cites `files/{otherBucket}/pool-only.txt`
- **WHEN** the current user imports it
- **THEN** neither the message citation nor any pool entry keeps a `body.source`, the warning names `cite.txt` and `pool-only.txt` once each, and opening the citation requests no file from `{otherBucket}`

#### Scenario: Own and public pool sources are kept

- **GIVEN** a `.json` file whose pool cites `files/{userBucket}/mine.pdf` and `files/public/shared.pdf`
- **WHEN** the current user imports it
- **THEN** both pool entries keep their `body.source` and nothing is reported as skipped

#### Scenario: A skipped archive attachment does not keep its source reference

- **WHEN** an archive conversation references `files/{oldBucket}/absent.pdf` and the archive has no bytes for it
- **THEN** the attachment is removed from the saved conversation and reported as skipped

#### Scenario: Reference rewrite

- **WHEN** an archive attachment originally referenced as `files/{oldBucket}/{path}` is uploaded to the current user's bucket
- **THEN** the message attachment's `url` (and `reference_url` if set) is updated to the new `files/{userBucket}/uploads/<YYYY-MM>/<name>` URL

#### Scenario: Title rewrite on a suffixed upload

- **WHEN** an archive attachment is uploaded under a ` (n)`-suffixed name to resolve a collision
- **THEN** the message attachment's `title` is updated to that suffixed name

#### Scenario: Title left unchanged on a non-suffixed upload

- **WHEN** an archive attachment is uploaded under its original, unsuffixed name
- **THEN** the message attachment's `title` is left as it was in the source file
