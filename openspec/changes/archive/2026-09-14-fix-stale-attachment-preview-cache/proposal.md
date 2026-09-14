## Why

Attachment preview content is cached in-memory by download URL
(`libs/chat-hooks/src/files/attachment-canvas.ts`'s `blobCache`/`textCache`)
with no freshness check: once a URL has resolved, every later open of that
same URL replays the cached bytes forever, even after the underlying DIAL
file has been overwritten with different content. Generating a text file
with a name that resolves to a DIAL resource that was previously fetched —
either an outright overwrite in the same conversation, or a second
conversation's model output landing at the same bucket/path — reproduces
GH-8718: the preview shows the old file's content until a full page reload
clears the cache. `apps/chat/src/app/app.tsx`'s existing
`clearAttachmentCache()` on route `pathname` change cannot fix this, because
regenerating a file inside the *same* conversation never changes `pathname`
at all, and the reported cross-conversation case shows the same failure mode
whether or not a route change intervenes. The preview must reflect the
current bytes for a resource without requiring a refresh.

## What Changes

- Add a freshness check to the shared attachment blob/text cache in
  `libs/chat-hooks/src/files/attachment-canvas.ts`: before serving a cached
  body for a DIAL download URL, validate the resource's current ETag (via
  the existing `GET /api/v1/files/metadata` endpoint) against the ETag
  recorded when that cached body was fetched. Reuse the cached body only on
  an exact ETag match; on any mismatch, missing ETag, or a failed/unusable
  validation call, discard the stale entry and fetch fresh content instead
  of silently serving what is cached.
- Store an ETag alongside each cached blob/text promise (cache entries move
  from `Promise<Blob | string>` to `{ etag: string | undefined; promise:
  Promise<Blob | string> }`), so a later open can compare rather than only
  invalidate-on-write.
- Add a `resolveDialFileMetadataUrl` resolver to the
  `AttachmentCanvasUrlResolvers` contract (mirroring the existing
  `resolveDialFileDownloadUrl`), implemented at the app edge in
  `apps/chat/src/utils/dial-file.ts` and wired through
  `useAttachmentCanvasResolvers.ts` — the lib gets a URL to fetch, never
  bucket/path construction, auth, or the generated API client.
- Preserve existing behavior: request de-duplication for concurrent opens of
  the same URL, retry-ability of failed fetches, local-`File`/inline-`data`
  attachment paths untouched, and `clearAttachmentCache()` on `pathname`
  change untouched (kept as a coarse defense-in-depth, not the fix).
- Guard against a slow, now-superseded validation-or-fetch response
  clobbering a newer cache entry or a newer preview render (a later open of
  the same URL, or a cache clear, must win over an in-flight older request).
- No REST contract change: `GET /api/v1/files/metadata` already returns
  `etag` (per the `file-metadata-get` capability) and needs no modification.
  Conditional download (`If-None-Match` / `304`) was evaluated and rejected
  for this change — the DIAL Core SDK's `downloadFile` operation declares no
  `If-None-Match` request header or `304` response, so end-to-end conditional
  download is not available without upstream changes; this is recorded as a
  capability gap, not implemented.

## Capabilities

### New Capabilities

- `chat-hooks-attachment-cache-freshness`: cache identity, ETag-based
  revalidation, invalidation, and concurrency rules for the shared
  blob/text attachment content cache in `libs/chat-hooks`.

### Modified Capabilities

- `chat-hooks-domain-utilities`: the existing "Caching behavior is unaffected
  by the injected parameter" scenario for the moved
  `apps/chat/src/utils/attachment-canvas.ts` content-resolution functions
  (now `libs/chat-hooks/src/files/attachment-canvas.ts`) is superseded —
  a second resolution of the same URL is no longer unconditionally served
  from the LRU cache; it is served from cache only when revalidation
  confirms the ETag is unchanged.

## Impact

- `libs/chat-hooks/src/files/attachment-canvas.ts` — cache entry shape,
  `fetchDialBlob`/`fetchDialText`, new metadata-validation helper.
- `libs/chat-hooks/src/files/tests/attachment-canvas.spec.ts` — new
  freshness/invalidation/concurrency test cases alongside the existing
  dedup/retry/clear coverage.
- `AttachmentCanvasUrlResolvers` (exported type) — new
  `resolveDialFileMetadataUrl` member; every implementer of the interface
  must supply it.
- `apps/chat/src/utils/dial-file.ts` — new
  `resolveDialFileMetadataUrl` implementation (mirrors
  `resolveDialFileDownloadUrl`, targets `/api/v1/files/metadata`).
- `apps/chat/src/hooks/attachment/useAttachmentCanvasResolvers.ts` — wires
  the new resolver into `attachmentCanvasUrlResolvers`.
- `apps/chat/src/utils/attachment-display-resolvers.ts` (the object
  `attachmentCanvasUrlResolvers` referenced above) — add the new resolver.
- No backend/OpenAPI changes; no new environment variables or feature
  flags; no i18n or RTL impact (no new user-visible strings, no directional
  UI).
