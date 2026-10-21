# Design

## Context

See `proposal.md` for the problem. Current state, all in `apps/chat-api`:

- `ConversationPublishService.publish` sends one `ADD` resource (the conversation); `unpublish` sends one `DELETE`.
- Share already collects a conversation's file URLs (`collectConversationResourceUrls`, `apps/chat-api/src/share/utils/share-resource.util.ts`) and keeps only the conversation's own bucket (`getResourceBucket`, `apps/chat-api/src/publish/publish-target.util.ts`). It does not expand folder attachments.
- Catalog publish already ships an app icon in the same publication and nests it under the target resource name (`getPublishedIconTargetUrl`). `getPublishableIconUrl` is the model for filtering to the author's bucket and rejecting `..`.
- `FilesListingService.expandFolderContents` (`apps/chat-api/src/files/listing/files-listing.service.ts`) recursively lists a folder with pagination and returns bucket-relative decoded paths; it is used for archive download.
- `ConversationPersistenceService.getConversation` is the read path for conversations (including the public bucket); `ConversationLifecycleService.duplicateConversation` reads through `dialClient` directly and already post-processes foreign data (`neutralizeForeignPendingMessages`).
- DIAL Core (read-only reference): publication resources must be files; link rewriting in the published conversation covers only exact file URLs published in the same publication (`custom_content.attachments`, plus playback and replay stacks); Core copies sources into the review bucket when the publication is created and validates every source (`exists`, read access); a duplicate target fails `ADD`, a missing target fails `DELETE`.

Follows `apps/chat-api/AGENTS.md` (thin controller, typed HTTP exceptions, SDK via `DialClientService`, Logger). No `libs/*` is touched, so the library isolation rule is not in play.

## Goals / Non-Goals

**Goals:**
- One reusable "conversation attachments" unit that collects, expands and maps attachment files and is used by publish, unpublish and the read-time folder resolution.
- Keep every user-visible and Core-visible contract unchanged except the added resources and two new errors (422 missing attachment, 413 too many files).

**Non-Goals:**
- Changing Core, publish DTOs, publish history semantics, or `libs/*`.
- Resolving folder links for API clients other than through chat-api reads.
- De-duplicating identical file content across conversations.

## Decisions

**D1. Share the traversal, not the policy.** The places searched (messages, stages, citations; `url` and `reference_url`; fragment stripping) are extracted from share's collector into one traversal used by both share and the new conversation-attachment helper. Share's output stays byte-for-byte the same (it ignores the legacy `metadata/` folder form today; changing that would alter what share grants and is out of scope). The new helper additionally recognises folders — a trailing `/`, with an optional legacy `metadata/` prefix that Core itself understands — and separates them from files. Alternatives: a second independent collector (rejected, would drift from share); making share expand folders (out of scope; share grants the folder prefix itself).

**D2. Author's bucket only.** Same rule as share and icon publishing. Alternative: also publish files the author can read in other buckets (rejected: would publish another user's data to the whole organization).

**D3. Namespace `files/public/{folderPath}/{conversationResourceName}/{bucket-relative path}`.** Direct extension of the icon precedent (`{targetResourceName}/{fileName}`) which keeps relative path so a folder URL can be mapped back by a pure function. The conversation resource name is unique inside the target folder because Core rejects a second conversation with the same target, so the namespace is unique without a counter. `ADD` (not `ADD_IF_ABSENT`) is deliberate: `ADD_IF_ABSENT` would silently skip a same-path file and the published chat would show someone else's content. Source path segments are carried verbatim (already encoded in the URL), as the icon precedent does with `getResourceName(iconUrl)`. One function in `publish-target.util.ts` builds the namespace so publish, unpublish and read-time mapping cannot diverge.

**D4. Resolve folder links on read, not on publish.** Core makes the published copy and we cannot edit it afterwards. The read path rewrites folder attachment URLs of conversations from the public bucket, **only when the published folder exists** (a listing of limit 1 on the target path, cached for 60 seconds under `conversation-published-folder:{publishedFolderUrl}`; unpublish only creates a removal request that an administrator approves later, so the entry is left to expire instead of being invalidated). The check is what keeps a folder the author never owned — say one shared with them — pointing where it did instead of at a namespace that was never created, and it makes pre-change conversations fall through unchanged. The rewrite lives in `ConversationService.getConversation`, the read behind the conversation endpoint, through a dedicated `PublishedFolderAttachmentsService`; `ConversationPersistenceService` — which streaming, naming and saving read through — keeps returning the stored body, so a read-modify-write save can never persist rewritten URLs. `duplicateConversation` applies the same function so a duplicate persists readable URLs. Chosen over (a) a snapshot conversation (changes resource identity, breaks history/unpublish pairing, needs cleanup, turns the folder into a file list) and (b) a frontend-only rewrite (misses duplicate persistence and every other chat-api consumer). Only message `attachments` are rewritten, because that is where folder attachments are created (`dialFolderPathToAttachment`); stage and citation attachments reference files, which Core rewrites.

**D5. Missing file: fail fast, typed.** Individually referenced files are verified (file metadata, with bounded concurrency so a conversation with many attachments is not a sequence of round trips) before `createPublication`; the failure carries `conversationAttachmentMissing`, a server message naming the files, and a `missingFiles` array, following the typed-code precedent of `conversationModelHidden` (`dto/conversation-model-hidden-error.dto.ts`) and the existing pre-flight conflict checks in `publish`. The web client needs no change: `usePublishErrorNotification` already shows the server message, as it does for the pending-generation conflict. Files found while expanding a folder exist by construction. Alternative: let Core's 400 surface (rejected: not user-readable and names one file at a time).

**D6. Unpublish lists the live namespace, after confirming ownership.** The service first confirms through the existing publish-history resolution (`resolvePublicationsForSource`) that this conversation is published to the requested folder; otherwise no file `DELETE` is added, so a same-named conversation of another author cannot make a request that names someone else's files. The file `DELETE` targets then come from listing `public/{folderPath}/{conversationResourceName}/` (recursive), because Core fails a `DELETE` of a missing target and the live listing is the only list guaranteed to exist; it also works for conversations whose publication record is no longer readable. Alternative: read file resources from the original publication (rejected: stale if a file was removed by an admin).

**D7. File-count limit follows the archive precedent.** `FilesArchiveDownloadService` expands folders with `expandFolderContents`, then rejects with `PayloadTooLargeException` ("Archive would contain N files, max is M") when the count exceeds `ARCHIVE_MAX_FILES` (default 1000); archive upload does the same with `ARCHIVE_UPLOAD_MAX_FILES` (default 1000). Publish does the same after expansion and before any Core call, with a new optional `PUBLISH_ATTACHMENTS_MAX_FILES` (default 1000) read through `ConfigService`, declared in `environment.config.ts` and documented in the chat-api README and `.env.template`, as the nestjs rules require. A separate variable (not `ARCHIVE_MAX_FILES`) so tuning archive downloads does not silently change what can be published. No byte limit is added.

**D8. A listing-only module.** `FilesListingService` is provided by a new `FilesListingModule` (imported by `FilesModule` and by the conversations module) instead of importing `FilesModule` into the conversations module. Importing `FilesModule` would reorder controller registration and rewrite about a thousand lines of the generated OpenAPI document and client for no behavioral reason.

**Authorization.** No new endpoint. Publish and unpublish keep the authenticated-session requirement; the bucket always comes from the session. Reading public files for the unpublish listing and the read-time rewrite needs no extra permission.

**Caching.** One new entry: `conversation-published-folder:{publishedFolderUrl}`, TTL 60 seconds, expiry only (the published folder changes when an administrator approves a publication or removal, which chat-api does not observe). The existing `conversation-publish-history:{sourceUrl}` key is still invalidated on publish and unpublish.

**i18n / UI.** No frontend change and no new i18n keys: the error text is the backend message, like `PUBLISH_WHILE_GENERATING_MESSAGE`, displayed by the existing publish error path. No feature flag.

## Risks / Trade-offs

- [Large folders make the publish request big or slow] → the file-count limit, one listing pass with pagination, and a clear 413 error; Core's own body limit is unknown.
- [Storage grows: each publication copies files again] → accepted for safety; unpublish removes them.
- [Extra I/O on reading a published conversation with folder attachments] → one cached `limit=1` listing per folder attachment, 60 s TTL; zero cost for conversations without folder attachments.
- [Files referenced only from `playback`/`replay` stacks are not published] → known gap shared with share; recorded in the proposal.
- [A published folder that contained no files is never created, so its link is left as is] → acceptable; there was nothing to read.
- [A file deleted by an admin between listing and approval] → Core rejects at approval as it does today for any resource; out of scope.

## Migration Plan

No data migration. Deploy chat-api only; the web client is unchanged. Rollback = revert; already published files stay in `files/public/...`.
