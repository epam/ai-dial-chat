## 1. Resolver contract: metadata URL injected into the lib

- [x] 1.1 Add `resolveDialFileMetadataUrl: (fileId: string) => string | undefined` to the `AttachmentCanvasUrlResolvers` interface in `libs/chat-hooks/src/files/attachment-canvas.ts`, documented like the existing `resolveDialFileDownloadUrl` member.
- [x] 1.2 Add `resolveDialFileMetadataUrl` to `apps/chat/src/utils/dial-file.ts`, mirroring `resolveDialFileDownloadUrl` but targeting `/api/v1/files/metadata?bucket=…&path=…` (per the existing `file-metadata-get` capability's query-param contract).
- [x] 1.3 Wire the new resolver into `apps/chat/src/utils/attachment-display-resolvers.ts`'s `attachmentCanvasUrlResolvers` object.
- [x] 1.4 Run `npm run test:file -- apps/chat/src/utils/tests/dial-file.spec.ts` (or the existing test file for `dial-file.ts`, adding a case for `resolveDialFileMetadataUrl` if a test file already exists for `resolveDialFileDownloadUrl`) to confirm the new resolver's URL shape.

## 2. Cache-freshness core in `libs/chat-hooks`

- [x] 2.1 Change `blobCache`/`textCache` value types from `LRUCache<string, Promise<Blob>>`/`LRUCache<string, Promise<string>>` to `LRUCache<string, { etag: string | undefined; promise: Promise<Blob> }>` / the text equivalent, in `libs/chat-hooks/src/files/attachment-canvas.ts`.
- [x] 2.2 Add a private helper (e.g. `fetchCurrentEtag(fileId, resolvers)`) that resolves `resolvers.resolveDialFileMetadataUrl(fileId)`, fetches it, and returns the parsed `etag` string, or `undefined` if the URL cannot be resolved, the fetch fails, the response is non-2xx, or the body has no `etag` field. Never throw — a validator failure is signaled by returning `undefined`, per design.md's "unusable validator ⇒ bypass cache" rule.
- [x] 2.3 Rewrite `fetchDialBlob`/`fetchDialText` to: resolve the attachment's `fileId` alongside the download URL (both callers already have the raw `files/{bucket}/{path}` id available), call the etag helper, and only consult/write the LRU cache when the helper returned a defined `etag`. When the helper returns `undefined`, skip the cache read/write entirely and fetch content directly (this also naturally handles hosts where `resolveDialFileMetadataUrl` returns `undefined`, e.g. non-`files/`-id inputs).
- [x] 2.4 On a cache-eligible path: compare the fetched `etag` to the existing entry's `etag` (if any); on match, return the existing entry's `promise`; on mismatch or no entry, delete any stale entry, create the new content-fetch `Promise`, store `{ etag, promise }` synchronously before awaiting, and keep the existing "delete on rejection" behavior for retry-ability.
- [x] 2.5 Update `resolveAttachmentBlobUrl`/`resolveAttachmentText`'s call sites to pass through whatever the callee needs to resolve both the download URL and the `fileId` for the metadata resolver (they already extract/hold the DIAL file id when calling `resolvers.resolveDialUrl`/`resolveDialFileDownloadUrl` — verify the id is available unchanged, or resolve it once and pass it to both helpers).
- [x] 2.6 Update the JSDoc above `blobCache`/`textCache` (currently "Cleared on conversation navigation via `clearAttachmentCache()`") to describe the new per-read ETag revalidation, keeping the existing note about `clearAttachmentCache()` as a coarse supplementary clear.

## 3. Test coverage

- [x] 3.1 In `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts`, extend the fake `AttachmentCanvasUrlResolvers` fixture with a mockable `resolveDialFileMetadataUrl`, and add a `fetch` mock/helper that can return a given `etag` (or a failure) for the metadata URL independently of the content URL.
- [x] 3.2 Add a test: unchanged `etag` across two resolutions of the same URL results in exactly one content-fetch call (cache hit preserved) — covers `chat-hooks-attachment-cache-freshness`'s "cached body reused" and the `chat-hooks-domain-utilities` MODIFIED scenario for the unchanged case.
- [x] 3.3 Add a test: differing `etag` across two resolutions of the same URL results in two content-fetch calls, and the second resolution's result reflects the second fetch's content, not the first's — covers "overwritten resource" (both the same-conversation and cross-conversation framing collapse to the same code path/test, since the cache has no conversation awareness).
- [x] 3.4 Add a test: a failing/erroring metadata call causes a content fetch to be issued even when a cache entry already exists for that URL, and the existing (now unverifiable) entry is not returned.
- [x] 3.5 Add a test: a metadata response with no `etag` field behaves the same as a failed metadata call (bypasses the cache).
- [x] 3.6 Add a test: two concurrent resolutions of the same URL, observing the same `etag`, issue only one content-fetch call (dedup preserved under the new validation step).
- [x] 3.7 Add a test: a rejected content fetch (e.g. simulated `403`) removes its cache entry, and a subsequent resolution of the same URL retries the network rather than replaying the rejection (existing retry coverage, re-verified against the new cache-entry shape).
- [x] 3.8 Add a test for the "superseded write" ordering: start fetch 1 for a URL, change the mocked `etag` and start+resolve fetch 2 for the same URL before fetch 1's content promise resolves, then let fetch 1 resolve; assert a subsequent resolution of that URL is validated against fetch 2's `etag` and reuses fetch 2's cached body, not fetch 1's.
- [x] 3.9 Confirm the existing local-`File`/inline-`data` test cases still pass unmodified (no metadata call, no cache interaction) — add an explicit assertion that `resolveDialFileMetadataUrl`/`fetch` for metadata is never called on those paths if not already asserted.
- [x] 3.10 Run `npm run test:file -- libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` and confirm all cases (existing + new) pass.

## 4. Manual verification

- [x] 4.1 Start the app (`npm run start:all`), reproduce the GH-8718 repro: generate `ua-de.txt` in conversation A, open its preview, generate `ua-de.txt` with different content in conversation B, open its preview, and confirm the new content shows without a page refresh.
- [x] 4.2 Regenerate a same-named file inside a single conversation (no navigation) and confirm the preview shows the new content on reopen without a refresh.
- [x] 4.3 Confirm the once-cached, unchanged case still opens instantly with no visible network re-fetch of the file body (e.g. via browser devtools network tab — only the small metadata request should appear on the second open).

## 5. Documentation and repo-wide checks

- [x] 5.1 If `libs/chat-hooks/README.md` documents `AttachmentCanvasUrlResolvers` or its members, update it to include `resolveDialFileMetadataUrl` in the same change.
- [x] 5.2 Run `npm run validate:docs` (touches a lib's public API — `AttachmentCanvasUrlResolvers` gains a member).
- [x] 5.3 Run `npm run verify:changed` for the affected projects (`chat-hooks`, `chat`) to cover lint/typecheck/test/build for the changed slice.
- [x] 5.4 Run `npm run verify:full` once before marking the change complete.
