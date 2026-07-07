## 1. Unify DIAL error mappers (chat-api backend slice)

- [x] 1.1 Write characterization tests capturing current `handleDialError` (dial-error.ts) and `mapDialHttpStatus`/`handleDialFetchError` (dial-fetch-error.ts) behavior for every covered status (400, 401, 403, 404, 409, 413, 429, 5xx), AbortError, network timeout, and HttpException re-throw
- [x] 1.2 Create `apps/chat-api/src/common/dial/dial-error.mapper.ts` exporting `mapDialHttpStatus(status, context, logger?)`, `handleDialSdkError(error, context, logger?)`, and `handleDialFetchError(err, context, logger, timeoutMs?)`, with HttpException re-throw as the first branch in both entry points
- [x] 1.3 Migrate SDK-path call sites (conversations, files, chat, rate, user-config, transcription, bucket services) from `handleDialError` to `handleDialSdkError`, passing a `logger` at each site for observability parity
- [x] 1.4 Migrate fetch-path call sites (models, applications, deployments, toolsets, application-schemas) from `dial-fetch-error.ts` to the unified `handleDialFetchError`
- [x] 1.5 Consolidate `dial-error.spec.ts` into a single spec covering both entry points; add edge-case tests for AbortError, HttpException re-throw, and 409/413
- [x] 1.6 Delete `apps/chat-api/src/common/utils/dial-error.ts` and `dial-fetch-error.ts` once all call sites are migrated and tests pass
- [x] 1.7 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 2. Unify DIAL resource path encoder (chat-api backend slice)

- [x] 2.1 Write characterization tests against the three existing encoders (`encodeDialResourcePath` in conversation.utils.ts, `encodeDialFileResourcePath` in files.service.ts, `encodeDialToolsetPath` in toolsets.service.ts) for: empty path, single segment, nested paths, already-encoded segments, unicode segments, `%2F` in a segment
- [x] 2.2 Assert all three encoders produce identical output on the task 2.1 fixture set (expected: they match — files uses `safeDecodePathForCompare(segment)` which equals `safeDecodeURIComponent(segment)` for per-segment inputs); unified helper uses `safeDecodeURIComponent` per segment; leave `safeDecodePathForCompare` in `files.service.ts` for full-path comparison only (~lines 713–714)
- [x] 2.3 Create `apps/chat-api/src/common/utils/encode-dial-path.ts` exporting `encodeDialResourcePath(path: string): string`, carrying over the SDK TODO comment from `conversation.utils.ts`
- [x] 2.4 Add `apps/chat-api/src/common/utils/encode-dial-path.spec.ts` with the fixture set from 2.1
- [x] 2.5 Update imports in conversations, files, and toolsets services to the shared helper; replace the inline duplicate encoding in `conversation.service.ts` (~lines 167–170)
- [x] 2.6 Remove the now-unused per-domain encoders (`encodeDialFileResourcePath`, `encodeDialToolsetPath`, and the old `encodeDialResourcePath` in `conversation.utils.ts` if fully replaced by direct imports)
- [x] 2.7 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 3. Shared bucket name validator (chat-api backend slice)

- [x] 3.1 Create `apps/chat-api/src/common/validators/bucket-name.pattern.ts` exporting `BUCKET_NAME_PATTERN` (`/^[\w.-]+$/`) and `BUCKET_NAME_VALIDATION_MESSAGE`, mirroring `deployment-id.pattern.ts`
- [x] 3.2 Replace the inline `@Matches(/^[\w.-]+$/)` in `file-params.dto.ts`, `list-files.dto.ts`, `create-folder.dto.ts`, `delete-files.dto.ts`, `rename-files.dto.ts`, `get-file-metadata.dto.ts`, and `download-archive.dto.ts` with the shared constant
- [x] 3.3 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`, confirming existing DTO/controller tests pass unchanged

## 4. Canonical attachment mapper in chat-shared

- [x] 4.1 Compare `apps/chat/src/utils/attachment-dto-to-display.ts` and `libs/conversation-stages/src/utils/to-display-attachment.ts` line-by-line to enumerate every behavioral difference (audio handling, id fallback, base64 handling)
- [x] 4.2 Create `libs/chat-shared/src/utils/message-attachment-to-display.ts` with a pure mapper accepting optional `resolvePreviewUrl` and `resolvePlayUrl` callbacks, default behavior falling back to `dto.url` and synthesizing a `data:` URL from `dto.data` when present
- [x] 4.3 Add a unit spec for the shared mapper covering: default resolvers, custom resolvers, audio attachments, image attachments, base64 fallback
- [x] 4.4 Export the new mapper (and its types) from `libs/chat-shared/src/index.ts`
- [x] 4.5 Run `npm exec nx test @epam/ai-dial-chat-shared`

## 5. App adapter and app call-site migration

- [x] 5.1 Rewrite `apps/chat/src/utils/attachment-dto-to-display.ts` as a thin wrapper that calls the shared mapper with `resolveCatalogIconUrl` and `resolveDialFileDownloadUrl`-based resolvers, preserving `annotationToDisplayAttachment` in-place
- [x] 5.2 Verify `ConversationMessageItem`, `useConversationSources`, and `useCitationMarkdownComponents` still produce identical output using the app wrapper (no call-site changes expected, since the wrapper keeps the same exported function signature)
- [x] 5.3 Merge/update `attachment-dto-to-display.spec.ts` so it exercises the app wrapper end-to-end (resolvers wired in) against the same cases it covered before
- [x] 5.4 Run `npm exec nx test @epam/chat` and `npm exec nx lint @epam/chat`

## 6. Migrate conversation-stages to the shared mapper

- [x] 6.1 Update `StageItem.tsx` (and any other `conversation-stages` consumer) to import the mapper from `libs/chat-shared` instead of the local `to-display-attachment.ts`
- [x] 6.2 Delete `libs/conversation-stages/src/utils/to-display-attachment.ts` and its spec, moving any still-relevant assertions into the shared mapper spec (task 4.3) or a `StageItem` test
- [x] 6.3 Add/update a `StageItem` test confirming audio attachments now render correctly (previously unsupported)
- [x] 6.4 Run `npm exec nx test conversation-stages`

## 7. Final verification

- [x] 7.1 Run `npm exec nx test chat-api`
- [x] 7.2 Run `npm exec nx lint chat-api`
- [x] 7.3 Run `npm exec nx test @epam/ai-dial-chat-shared`
- [x] 7.4 Run `npm exec nx test conversation-stages`
- [x] 7.5 Run `npm exec nx test @epam/chat`
- [x] 7.6 Run `npm exec nx lint @epam/chat`
- [x] 7.7 Confirm no remaining references to the deleted files (`dial-error.ts`, `dial-fetch-error.ts`, `to-display-attachment.ts`) via a repo-wide grep
