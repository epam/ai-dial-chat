# Proposal

## Why

Publishing a conversation copies only the conversation itself. Its attachments — single files and attached folders — stay in the author's private bucket, so the published copy points at resources no other user can read. For a conversation built around a folder of documents (RAG agents, Echo) the published chat is useless, and an administrator reviewing the request sees no files at all ([epam/ai-dial-chat#2143](https://github.com/epam/ai-dial-chat/issues/2143), reproduced on chat 2.0 with an Echo conversation).

`ConversationPublishService.publish` (`apps/chat-api/src/conversations/conversation-publish.service.ts`) sends exactly one resource to Core's `createPublication`: the conversation. Share already solves the equivalent problem (`ShareInvitationService.getConversationRelatedResourceUrls`, `apps/chat-api/src/share/invitation/share-invitation.service.ts`), and catalog publish already ships an app's icon file next to the app (`getPublishedIconTargetUrl`, `apps/chat-api/src/publish/publish-target.util.ts`, #9446).

## Problem

DIAL Core (read-only reference, never changed by us) constrains the solution:

- A publication resource must be a file; a folder source or target is rejected (`Source resource is folder`).
- Core rewrites attachment links in the published conversation copy (`PublicationUtil.replaceConversationLinks`) only when the link equals the URL of a file published in the **same** publication. A folder attachment (`url: files/{bucket}/docs/`, see `dialFolderPathToAttachment` in `libs/chat-hooks/src/files/dial-file-to-attachment.ts`) therefore keeps pointing at the author's bucket even if every file inside it is published.
- `ADD` of an existing target fails; `ADD_IF_ABSENT` silently skips it, which would let two colleagues' same-named files collide without any error.

## What Changes

- **Publish** collects the conversation's file attachments (message attachments, stage attachments and citation sources — the same collector share uses), expands folder attachments into their files recursively, keeps only files of the author's own bucket, and adds each file to the same publication as an `ADD` resource. Core then rewrites file attachment links itself.
- Published files live in a per-conversation namespace so same-named files of different authors cannot collide: `files/public/{folderPath}/{conversationResourceName}/{path relative to the author bucket}`. This follows the icon precedent (`{targetResourceName}/{fileName}`) and keeps folder structure.
- A file referenced by the conversation that no longer exists makes publish fail with a typed error whose message names the missing file(s); nothing is published partially. The existing publish error notification already shows the server message, so the web client needs no change.
- **Folder attachments are rewritten on read.** When a conversation in the public bucket is read, and when it is duplicated, each folder attachment URL whose published folder actually exists in the conversation's namespace is rewritten to that published folder. A folder that was not published (for example one shared by a third user) is left untouched. Both folder forms are handled: chat 2.0's `files/{bucket}/…/` and the legacy `metadata/files/{bucket}/…/` form (type `application/vnd.dial.metadata+json`) that Core also recognises and that older conversations carry. The attachment stays a single folder attachment for the viewer. Core cannot do this itself, and the published copy cannot be edited after Core creates it.
- **Unpublish** also deletes the published files: once the publish history confirms this conversation was published to that folder, it lists the conversation's published namespace and adds a `DELETE` resource per file to the same removal request.
- No change to the publish request/response DTOs, to `libs/*`, or to Core.

## Capabilities

### New Capabilities

- `conversation-published-attachments`: which attachments of a conversation are published with it, where they land, how folder attachments are resolved for viewers, and how they are removed on unpublish.

### Modified Capabilities

- `conversation-publish-api`: publish sends attachment files as additional `ADD` resources and fails with a typed error when an attachment is missing.
- `conversation-unpublish-api`: unpublish removes the published attachment files together with the conversation.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Do nothing / publish only the conversation (current) | Rejected — the reported bug. |
| Publish files only, leave folder links as they are | Rejected — issue #2143 is specifically about folders; the folder link would still point at the private bucket. |
| Publish a temporary snapshot of the conversation with the folder replaced by a file list | Rejected — folder would become N file attachments for viewers, the published resource would have a different source identity (breaks publish history and unpublish pairing), and the snapshot needs cleanup. |
| **Publish files + rewrite folder URLs on read (chosen)** | Folder stays a folder for viewers; contained in `apps/chat-api`; reuses share's collector, the archive folder walker and the icon target layout. |
| Change Core to rewrite folder links | Out of scope by policy — Core is read-only reference for this repository. |

## Assumptions and unknowns

- A viewer's agent is assumed to accept a folder under `files/public/...` as an attachment and read it with the viewer's own permissions, exactly as it does for a private folder: public files are readable by every authenticated user and Core resolves folder content server-side.
- Core imposes no resource-count limit we could find in its publication code. The file-count limit follows the repository's existing precedent for expanding folders: archive download (`ARCHIVE_MAX_FILES`, default 1000, `413 Payload Too Large`, `apps/chat-api/src/files/archive/files-archive-download.service.ts`) and archive upload (`ARCHIVE_UPLOAD_MAX_FILES`, default 1000). Share has no limit because it grants the folder prefix instead of listing files.
- Conversations published before this change have no published files. Because the read-time rewrite applies only when the published folder exists, their folder links are simply left as they are (already unreadable for viewers); no migration is needed.

## Non-goals

- Publishing files from other users' buckets or from the public bucket (matches share and icon publishing).
- Rewriting folder links for clients other than chat-api consumers (other API clients keep the raw link).
- Rewriting file links — Core does that.
- Files referenced only from a conversation's `playback` or `replay` stacks: Core rewrites links there but the attachment collector (like share's) does not read them. Known gap, not a regression.
- A total-bytes limit (archive download has one, but a single file is already bounded by the upload size limit) and deduplicating content across conversations.
- Any change in `ai-dial-core`.

## Acceptance criteria

1. Publishing a conversation with attached files and an attached folder produces one publication whose resources contain the conversation plus every file, under the per-conversation namespace.
2. An administrator sees the files in the publication request; after approval they exist under `files/public/...`.
3. A second user opens the published conversation read-only: file attachments open, the folder attachment is still one folder attachment and resolves to the published folder. After Duplicate, the copy's folder attachment uses the published path and can be sent to an agent.
4. Two authors publishing same-named folders to the same Organization folder both succeed and do not read each other's files.
5. A conversation referencing a deleted file cannot be published; the error names the file and nothing is created in Core.
6. Unpublish removes the conversation and its published files in one request.
7. A folder attachment that was not published (another user's shared folder) keeps its original URL in the published conversation.
8. Conversations carrying the legacy `metadata/files/…/` folder attachment are published and resolved the same way.

## Rollback / compatibility

Additive. Reverting the code restores the previous single-resource publish; already published files stay in `files/public/...` and are harmless. Published conversation copies are never modified by us, so there is nothing to migrate. No breaking API change.

## Impact

- `apps/chat-api/src/conversations/conversation-publish.service.ts` (publish, unpublish), a new conversation-attachment helper in `apps/chat-api/src/conversations/utils/` that shares its traversal with `apps/chat-api/src/share/utils/share-resource.util.ts` (share output unchanged), `apps/chat-api/src/publish/publish-target.util.ts` (published file target URL), `apps/chat-api/src/files/listing/files-listing.service.ts` (`expandFolderContents` reuse), `apps/chat-api/src/conversations/conversation.service.ts`, a new `published-folder-attachments.service.ts` and `apps/chat-api/src/conversations/lifecycle/conversation-lifecycle.service.ts` (rewrite on read and duplicate), and a new `apps/chat-api/src/files/listing/files-listing.module.ts` so conversations can use the files listing without importing the files module.
- Frontend: none. The existing publish error notification already renders the server's error message.
- No `libs/*` changes, no new dependencies. One new optional environment variable, `PUBLISH_ATTACHMENTS_MAX_FILES` (default 1000), declared in `apps/chat-api/src/config/environment.config.ts` and documented in `apps/chat-api/README.md` and `apps/chat-api/.env.template`, mirroring `ARCHIVE_UPLOAD_MAX_FILES`.
