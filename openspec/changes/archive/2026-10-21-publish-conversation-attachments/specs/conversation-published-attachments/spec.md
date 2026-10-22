# Spec Delta

## Purpose

Defines which attachments of a conversation are published together with it, where the published files live, how an attached folder keeps working for viewers of the published copy, and how the files are removed when the conversation is unpublished.

## ADDED Requirements

### Requirement: Publishing a conversation publishes the files its attachments reference

When a conversation is published, the backend SHALL collect the DIAL file resources it references and publish each one in the same DIAL Core publication request as the conversation, as an `ADD` resource whose `sourceUrl` is the file and whose `targetUrl` is the published file path defined by "Published attachment files live in a per-conversation namespace".

The collected set SHALL be built from the same places, and with the same normalization, as the related resources of a conversation share (see `conversation-share`, "Sharing a conversation includes its related DIAL file resources"): message-level attachments, execution-stage attachments and citation source attachments; both `url` and `reference_url`; only values starting with `files/` (after an optional legacy `metadata/` prefix on folder attachments); a `#fragment` removed; duplicates collapsed. Share's own output SHALL NOT change. Files referenced only from a conversation's `playback` or `replay` stacks are not collected. Inline `data` attachments and external URLs SHALL NOT be collected.

Only files in the caller's own bucket SHALL be published. A reference to a file in another user's bucket or in the public bucket SHALL be left unchanged and SHALL NOT be added to the request, and its presence SHALL NOT make the publish fail.

A conversation with no collectable attachments SHALL produce exactly the same Core request as before this change.

#### Scenario: File attachment is published with the conversation

- **GIVEN** an owned conversation references `files/bucket-123/docs/report.pdf` in a message attachment
- **WHEN** the owner publishes it to `Organization/Shared chats`
- **THEN** the Core request contains the conversation resource and an `ADD` resource for `files/bucket-123/docs/report.pdf`

#### Scenario: Same file referenced several times is published once

- **GIVEN** the same file is referenced by several messages, stages or citations, possibly with a `#page=2` fragment
- **WHEN** the conversation is published
- **THEN** the file appears once in the Core request, without the fragment

#### Scenario: Files outside the author's bucket are not published

- **GIVEN** a conversation references a file in another user's bucket and a file in the public bucket
- **WHEN** it is published
- **THEN** neither file is added to the Core request and the publish succeeds

#### Scenario: Conversation without attachments is unchanged

- **GIVEN** a conversation with no `files/` references
- **WHEN** it is published
- **THEN** the Core request contains only the conversation resource, identical to the request sent before this change

### Requirement: Folder attachments are published as the files they contain

A folder attachment is an attachment whose `url` starts with `files/` and ends with `/`, or the legacy form whose `url` is `metadata/` followed by such a value (type `application/vnd.dial.metadata+json`). The `metadata/` prefix SHALL be ignored when collecting and SHALL be preserved when the URL is rewritten. The backend SHALL expand each folder attachment in the caller's own bucket recursively, following listing pagination to the end, and publish every file found as an `ADD` resource. Nested folder structure SHALL be preserved in the published paths. Folder entries themselves SHALL NOT be sent to Core as resources (Core rejects folders).

The total number of files published for one conversation SHALL NOT exceed a configurable maximum (default 1000, the same default as archive download and archive upload). When the maximum would be exceeded, publish SHALL fail with `413 Payload Too Large` whose message states the number of files found and the maximum, and no publication SHALL be created.

#### Scenario: Folder with nested subfolders

- **GIVEN** the conversation has a folder attachment `files/bucket-123/docs/` containing `a.pdf` and `sub/b.pdf`
- **WHEN** it is published
- **THEN** the Core request contains `ADD` resources for `files/bucket-123/docs/a.pdf` and `files/bucket-123/docs/sub/b.pdf` and no resource for either folder

#### Scenario: Empty folder

- **GIVEN** the folder attachment contains no files
- **WHEN** the conversation is published
- **THEN** only the conversation resource (and any other attachment files) is sent and the publish succeeds

#### Scenario: Folder larger than one listing page

- **GIVEN** the folder holds more files than one listing page returns
- **WHEN** the conversation is published
- **THEN** every file of the folder is published

#### Scenario: Legacy metadata folder attachment

- **GIVEN** the conversation has an attachment of type `application/vnd.dial.metadata+json` with `url: metadata/files/bucket-123/docs/`
- **WHEN** it is published
- **THEN** the files of `docs/` are published exactly as for a plain folder attachment

#### Scenario: File cap exceeded

- **WHEN** the files collected for one conversation exceed the configured maximum
- **THEN** publish fails with `413 Payload Too Large` naming the file count and the maximum, and Core's `createPublication` is not called

### Requirement: Published attachment files live in a per-conversation namespace

The published path of an attachment file SHALL be `files/public/{folderPath}/{conversationResourceName}/{path of the file relative to the author's bucket}`, where `{folderPath}` is the publish target folder and `{conversationResourceName}` is the last segment of the published conversation's own `targetUrl`. Path segments of the source file SHALL be carried over unchanged. The namespace SHALL be derived by one shared function used by publish, unpublish and the folder-link resolution on read, so all three always agree.

#### Scenario: Same-named folders of two authors do not collide

- **GIVEN** two colleagues each attach a folder `docs/` containing `report.pdf` (different content) to two conversations and publish them to the same Organization folder
- **WHEN** both publishes are made
- **THEN** both succeed and their files are stored under different conversation namespaces

#### Scenario: Folder structure is preserved

- **GIVEN** `files/bucket-123/docs/sub/b.pdf` is published with conversation `my-chat` to `Org`
- **THEN** its published path is `files/public/Org/my-chat/docs/sub/b.pdf`

### Requirement: A missing attachment file fails publish with a readable error

If any individually referenced attachment file (not a file found inside an expanded folder) does not exist at publish time, the backend SHALL fail the publish before calling Core's `createPublication`, with a client error carrying the stable code `conversationAttachmentMissing`, a message that names the missing file URLs, and the same URLs in a `missingFiles` field. Nothing SHALL be published partially. The existing publish error notification SHALL show that message.

#### Scenario: Deleted file is referenced

- **GIVEN** the conversation references `files/bucket-123/old.pdf`, which was deleted
- **WHEN** the owner publishes it
- **THEN** the response is a client error with `code: conversationAttachmentMissing` listing `files/bucket-123/old.pdf`, and no publication is created

#### Scenario: Error is shown to the user

- **WHEN** the web client receives `conversationAttachmentMissing`
- **THEN** the publish error notification shows the server message naming the missing file(s) instead of a generic failure

### Requirement: Folder attachments of a published conversation resolve to the published folder

Core does not rewrite a folder attachment link in the published conversation copy, so the backend SHALL resolve it when the copy is read. When a conversation stored in the public bucket is returned, each message attachment whose `url` is a folder URL (`files/{bucket}/…/`, or the legacy `metadata/files/{bucket}/…/` form) of a bucket other than the public bucket SHALL be returned with `url` rewritten to `files/public/{conversation public path}/{path relative to {bucket}}` (keeping the `metadata/` prefix when the original had it), where `{conversation public path}` is the published conversation's own path without its `conversations/` prefix. The rewrite SHALL apply only when that published folder exists; a folder whose published counterpart does not exist (a folder in another user's bucket that was never published, a folder with no files, a conversation published before this change) SHALL keep its original URL. The attachment SHALL remain one folder attachment (its `title` and other fields unchanged). Conversations outside the public bucket SHALL be returned unchanged, and so SHALL attachments that are not folders.

The rewrite SHALL apply to the conversation returned to callers, not to the version used to save a conversation.

When a conversation from the public bucket is duplicated, the stored copy SHALL carry the same rewritten URLs, so the duplicate's folder attachments remain readable by the user who duplicated it.

Existence of a published folder MAY be cached for at most 60 seconds.

#### Scenario: Viewer opens a published conversation with a folder attachment

- **GIVEN** the published conversation `conversations/public/Org/my-chat` has a folder attachment `files/bucket-123/docs/`
- **WHEN** another user reads that conversation
- **THEN** the folder attachment's `url` is `files/public/Org/my-chat/docs/` and it is still one folder attachment

#### Scenario: Folder that was not published keeps its URL

- **GIVEN** a published conversation has a folder attachment `files/other-user/shared-docs/` that the author did not own, so it was not published
- **WHEN** another user reads the conversation
- **THEN** that attachment's `url` is returned unchanged

#### Scenario: Legacy metadata folder attachment is resolved

- **GIVEN** a published conversation has an attachment with `url: metadata/files/bucket-123/docs/` whose published folder exists
- **WHEN** another user reads it
- **THEN** the `url` is `metadata/files/public/Org/my-chat/docs/`

#### Scenario: Owner's own conversation is untouched

- **WHEN** a conversation from the user's own bucket is read
- **THEN** its attachment URLs are returned exactly as stored

#### Scenario: Duplicate of a published conversation

- **WHEN** a user duplicates a conversation from the public bucket
- **THEN** the duplicate is stored in the user's bucket with the rewritten folder URL

#### Scenario: File attachments are not rewritten

- **GIVEN** a published conversation has a file attachment whose link Core already rewrote
- **WHEN** it is read
- **THEN** that link is returned unchanged

### Requirement: Unpublishing a conversation removes its published attachment files

When a conversation is unpublished from a folder, the backend SHALL first confirm from the conversation's publish history that it is published to that folder. Only then SHALL it list the files under that conversation's published namespace (recursively, to the end of the listing) and send a `DELETE` resource for each of them in the same removal request as the conversation. When the history does not show the conversation published to that folder, only the conversation `DELETE` resource SHALL be sent, as before this change, so one author's request can never name another author's files. A conversation published without attachments SHALL produce the same single-resource request as before this change.

#### Scenario: Unpublish with published files

- **GIVEN** the conversation was published to `Org` with two attachment files
- **WHEN** it is unpublished from `Org`
- **THEN** the removal request contains a `DELETE` resource for the conversation and one for each of the two published files

#### Scenario: Another author's same-named conversation

- **GIVEN** another user's conversation with the same resource name is published to the folder and the caller's conversation is not
- **WHEN** the caller requests unpublish for that folder
- **THEN** the removal request contains no file `DELETE` resources

#### Scenario: Unpublish of a conversation that had no attachments

- **WHEN** a conversation published without attachments is unpublished
- **THEN** the removal request contains only the conversation `DELETE` resource
