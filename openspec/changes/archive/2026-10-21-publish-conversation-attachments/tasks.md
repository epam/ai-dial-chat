# Tasks

Slicing: vertical slices (publish, read-time resolution, unpublish). Read `apps/chat-api/AGENTS.md` before backend tasks. Relative imports are extensionless.

## 1. Publish attachment files

- [x] 1.1 Add the published-file namespace builder to `apps/chat-api/src/publish/publish-target.util.ts` next to `getPublishedIconTargetUrl`; verify with `npm run test:file -- apps/chat-api/src/publish/tests/publish-target.util.spec.ts` (nested path, spaces, non-ASCII, root folder)
- [x] 1.2 Extract the attachment traversal from `apps/chat-api/src/share/utils/share-resource.util.ts` so share keeps its exact output, and add a conversation-attachment helper in `apps/chat-api/src/conversations/utils/` that collects file and folder URLs (own bucket only, folders split out, legacy `metadata/` folder form recognised); verify with the share util's existing spec (share unchanged) and the helper's spec (stages, citations, fragment, duplicates, foreign and public buckets, inline data, metadata form)
- [x] 1.3 Expand folders with `FilesListingService.expandFolderContents` and reject with `PayloadTooLargeException` above `PUBLISH_ATTACHMENTS_MAX_FILES` (default 1000, read through `ConfigService`; declare it in `apps/chat-api/src/config/environment.config.ts` next to `ARCHIVE_UPLOAD_MAX_FILES` and document it in `apps/chat-api/README.md` and `apps/chat-api/.env.template`); verify with a spec covering nesting, pagination, the limit and the default
- [x] 1.4 Verify individually referenced files exist with bounded concurrency and fail with 422 `conversationAttachmentMissing` (message naming the files plus a `missingFiles` array; error DTO modelled on `conversation-model-hidden-error.dto.ts`) in `apps/chat-api/src/conversations/conversation-publish.service.ts`; verify with `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-publish.service.spec.ts`
- [x] 1.5 Add the file `ADD` resources to the `createPublication` body; verify with the same spec (resource list, no change for conversations without attachments, history unaffected)
- [x] 1.6 Document the 422 and 413 responses in `conversation-publish.controller.ts`, run `npm run openapi`, `npm run openapi:check`, then build and lint `chat-api-client`; verify the generated client contains the response
- [x] 1.7 Add a case to `apps/chat/src/hooks/publish/tests/usePublishErrorNotification.spec.ts` proving the existing hook shows the server message of a 422 `conversationAttachmentMissing` response; verify with `npm run test:file -- apps/chat/src/hooks/publish/tests/usePublishErrorNotification.spec.ts` (no production change expected)
- [x] 1.8 Run `npm run verify:changed`

## 2. Resolve folder links of published conversations

- [x] 2.1 Add the pure folder-link rewrite function (public bucket conversation path + folder URL, with optional `metadata/` prefix → published folder URL) next to the namespace builder; verify with a spec including round-trip with the namespace builder and the metadata form
- [x] 2.2 Add the published-folder existence check (listing `limit=1`, 60 s cache `conversation-published-folder:{publishedFolderUrl}`) and apply the rewrite from `ConversationService.getConversation` through a new `PublishedFolderAttachmentsService` for conversations from the public bucket only, leaving `ConversationPersistenceService` returning the stored body; verify with `npm run test:file -- apps/chat-api/src/conversations/tests/published-folder-attachments.service.spec.ts apps/chat-api/src/conversations/tests/conversation.service.spec.ts` (public rewritten, unpublished third-party folder untouched, own bucket untouched, file attachments untouched, lookup cached, failure not cached)
- [x] 2.3 Apply it in `ConversationLifecycleService.duplicateConversation` when the source is in the public bucket; verify with `npm run test:file -- apps/chat-api/src/conversations/lifecycle/tests/conversation-lifecycle.service.spec.ts`
- [x] 2.4 Run `npm run verify:changed`

## 3. Unpublish removes attachment files

- [x] 3.1 Confirm via publish history that the conversation is published to the folder, then list its published namespace and add file `DELETE` resources in `ConversationPublishService.unpublish`; verify with `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-unpublish.service.spec.ts` (files present, none present, listing failure, same-named conversation of another author)
- [x] 3.2 Update `docs/` and `openspec` references if `npm run validate:specs` reports drift, then run `npm run validate:specs`

## 4. Final integration

- [x] 4.1 Run the full flow on a running stack (publish with file and folder attachments, approve as admin, open as the second account, duplicate, send a message, unpublish) and record the outcome in the PR description
- [x] 4.2 Run `npm run verify:full` once
