## Context

`libs/chat-hooks/src/files/attachment-canvas.ts` keeps two module-level LRU
caches (`blobCache: LRUCache<string, Promise<Blob>>` max 10,
`textCache: LRUCache<string, Promise<string>>` max 50), both keyed by the
DIAL download URL (`/api/v1/files/download?bucket=…&path=…`, built by
`resolveDialFileDownloadUrl` in `apps/chat/src/utils/dial-file.ts` from the
attachment's own `files/{bucket}/{path}` resource id). `fetchDialBlob`/
`fetchDialText` (attachment-canvas.ts:130-173) return the cached `Promise`
unconditionally once one exists for a URL; a failed promise is evicted, a
successful one never is. The cache is cleared wholesale by
`clearAttachmentCache()`, called from `apps/chat/src/app/app.tsx`'s
`useEffect` on route `pathname` change.

**Root cause, confirmed from the code (not assumed):**

- The cache key already encodes the full resource identity (`bucket` +
  decoded `path` from `resolveDialFileBucketAndPath` in
  `libs/chat-hooks/src/files/dial-file.ts`), not the display filename. Two
  attachments that are genuinely different DIAL resources already get
  different cache keys and cannot collide today. GH-8718's two-conversation
  repro (`ua-de.txt` regenerated with different content) can only reproduce
  through this cache if the second generation is written by DIAL Core to the
  **same** `bucket`/`path` as the first — i.e. the "new file" is actually an
  overwrite of the same underlying resource, which the naming (no
  per-generation disambiguation in the addon/tool's output path) makes
  possible. Whether or not that is the case, the defect is the same: a
  once-cached body for a URL is replayed forever, with no check that the
  bytes behind that URL are still what was fetched.
- `clearAttachmentCache()` on `pathname` change is real but insufficient by
  construction: regenerating the same-named file **inside the same
  conversation** (an explicit acceptance criterion) never changes
  `pathname`, so this hook cannot fire for that case at all. It also clears
  the entire cache on every route change rather than the one resource that
  actually changed, which is blunt but harmless — kept as-is.
- The backend forwards only `content-type`/`content-disposition`/
  `content-length` from DIAL Core's download response
  (`SAFE_DOWNLOAD_HEADERS` in `apps/chat-api/src/files/download/files-download.service.ts`).
  No `ETag`/`Last-Modified` reaches the browser on download, and the
  frontend `fetch()` call carries no cache-busting, so there is also no
  validator available for the browser's own HTTP cache to revalidate against
  — the staleness is fully explained by the in-memory `Promise` cache, no
  additional browser-cache investigation changes the fix.
- `GET /api/v1/files/metadata` (`file-metadata-get` capability) already
  proxies DIAL Core's metadata call and already returns `etag` in
  `FileMetadataResponseDto` — confirmed in
  `apps/chat-api/src/files/listing/files-listing.service.ts` and the dedicated `dto/file-metadata-response.dto.ts`.
  This endpoint is explicitly documented as uncached ("Caching: none. File
  metadata changes on every write").

## Goals / Non-Goals

**Goals:**

- A preview opened after a resource's content changed (same URL, new bytes)
  shows the new bytes without a page refresh, whether the change happened in
  the same conversation or a different one.
- A preview opened after a resource's content did *not* change keeps the
  existing no-refetch behavior (cache hit, no network body transfer).
- Preserve today's guarantees: distinct resources never share a cache entry,
  request de-duplication for concurrent opens, retry after a failed fetch,
  and the local-`File`/inline-`data` attachment paths (which never touch
  these caches).
- Never serve a cached body when freshness cannot be proven (missing ETag,
  failed validation call) — fail toward a fresh fetch, not toward stale
  content.
- Stay inside `AGENTS.md`'s library-isolation rule: the freshness check adds
  one more *URL to fetch*, injected by the app, exactly like
  `resolveDialFileDownloadUrl` already is — no bucket/path construction,
  auth, or generated-client knowledge enters `libs/chat-hooks`.

**Non-Goals:**

- No conditional HTTP download (`If-None-Match` / `304`) — investigated and
  rejected for this change (see Decisions).
- No change to the DIAL Core / `@epam/ai-dial-typescript-sdk` contract, no
  OpenAPI regeneration — `GET /api/v1/files/metadata` is reused unchanged.
- No general-purpose caching framework or cross-feature cache abstraction —
  this fixes the one existing cache in `attachment-canvas.ts`.
- No change to how images are handled: `resolveImageCanvasContent` already
  hands the DIAL URL straight to an `<img>` element without going through
  `blobCache`/`textCache` (comment at attachment-canvas.ts:249-255 is
  explicit about sharing the browser's own image cache), so it is out of
  scope.

## Decisions

### Decision: Validate via the existing metadata endpoint's ETag, not conditional download

Three options were compared per the proposal:

1. **Always re-fetch on every open** (no cache) — correct but regresses the
   documented no-refetch behavior for the unchanged case and the existing
   dedup/LRU test coverage in `attachment-canvas.spec.ts`; rejected as
   throwing away working, tested behavior for a fix that doesn't need it.
2. **Validate through `GET /api/v1/files/metadata` before reusing cached
   content** — chosen. The endpoint already exists, already returns
   `etag`, and needs no backend change.
3. **Conditional download** (`If-None-Match` sent on the download request
   itself, expecting `304`) — investigated in
   `node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`: the
   `downloadFile` operation's request has no header parameters and its
   `responses` map has no `304` entry (unlike the SDK's upload/delete
   operations, which do declare `If-None-Match`/`If-Match` conditional
   semantics). Conditional download is therefore not available end-to-end
   without an upstream DIAL Core change. **Recorded as a capability gap**,
   not implemented; revisit if DIAL Core adds conditional GET support for
   files.

Option 2 costs one extra small JSON request per preview open (even on a
cache hit), which is the accepted trade-off for "smallest reliable
solution" — the metadata endpoint is documented as uncached/cheap, and this
only runs when a canvas is actually opened, not on every render.

### Decision: Cache entries carry their ETag; validation happens before every reuse, not just on write

Cache value shape changes from `Promise<Blob>` / `Promise<string>` to:

```ts
interface CachedAttachmentEntry<T> {
  /** ETag captured from the metadata call that preceded this fetch. */
  etag: string | undefined;
  /** The in-flight or resolved content fetch itself. */
  promise: Promise<T>;
}
```

`fetchDialBlob`/`fetchDialText` change to, conceptually:

1. Fetch current metadata for the resource via the new
   `resolvers.resolveDialFileMetadataUrl(fileId)` → `fetch(metadataUrl)` →
   read `etag` from the JSON body.
2. If the metadata call fails (network error, non-2xx, or the body has no
   `etag`), treat the validator as **unusable**: skip the cache entirely
   (do not read or write it) and fetch content directly. This satisfies "a
   missing or unusable validator must trigger a fresh content request" and
   "failed validation must not silently display stale content."
3. If metadata succeeds and returns an `etag`:
   - An existing entry whose `etag` matches → return its `promise` (cache
     hit, no content re-fetch).
   - No entry, or an entry whose `etag` differs → discard any existing
     entry, start a new content fetch, and store `{ etag, promise }`
     immediately (before the content fetch settles), so concurrent callers
     for the same URL still de-duplicate on the in-flight promise exactly as
     today.
4. A failed content fetch still deletes its cache entry on rejection
   (unchanged from today), so it remains retryable.

This is a full metadata check on every open rather than a
write-side-only invalidation, because the cache has no reliable
write-side hook — the LRU lives in `libs/chat-hooks`, which has no
visibility into "a new attachment/message arrived" (that is
conversation-state knowledge the library must not hold, per library
isolation). Checking at read time keeps the freshness proof local to the
one function that decides whether to reuse a cache entry, with no
additional cross-cutting invalidation wiring.

### Decision: New resolver, not a client dependency, carries the metadata URL into the lib

`AttachmentCanvasUrlResolvers` gains:

```ts
export interface AttachmentCanvasUrlResolvers {
  resolveDialFileDownloadUrl: (fileId: string) => string | undefined;
  resolveDialUrl: (attachment: DisplayAttachment) => string | undefined;
  /** Resolves a DIAL Core file id to a fetchable metadata URL (used for cache-freshness validation). */
  resolveDialFileMetadataUrl: (fileId: string) => string | undefined;
}
```

`apps/chat/src/utils/dial-file.ts` implements it exactly like
`resolveDialFileDownloadUrl`, targeting `/api/v1/files/metadata` instead of
`/api/v1/files/download`, and `attachment-display-resolvers.ts` wires it into
`attachmentCanvasUrlResolvers`. The lib still never constructs a bucket/path
pair, never touches auth, and never imports the generated API client or
`apps/chat/src/server-api/files.api.ts` — it is handed a fetchable URL, the
same seam `resolveDialFileDownloadUrl` already uses for content. This keeps
`libs/chat-hooks`'s existing, narrower exception (thin request/response logic
against an already-configured client) untouched: the freshness check is a
plain `fetch()` against an app-supplied URL, exactly like the existing
`fetchDialBlob`/`fetchDialText`, not a new client dependency.

`resolveAttachmentBlobUrl`/`resolveAttachmentText` (the two call sites) need
the attachment's `files/{bucket}/{path}` id, not just the resolved download
URL, to also resolve the metadata URL. Both already have the attachment in
scope; they resolve `resolvers.resolveDialUrl(attachment)` for the download
URL and additionally resolve the metadata URL via the same id extraction
path `resolveDialUrl` uses internally. Concretely,
`resolveDialFileMetadataUrl` is called with the same `files/…` id that
produced the download URL — both `apps/chat/src/utils/dial-file.ts`
functions accept that raw id, so no new plumbing is needed to get from
`DisplayAttachment` to both URLs.

### Decision: Guard against superseded in-flight requests

Two ordering hazards, both handled by making the cache the single source of
truth for "what should currently be displayed," not by tracking request
order explicitly:

- **A late validation-or-fetch response for an old open must not overwrite a
  newer cache entry.** Because step 3 above always writes the new
  `{ etag, promise }` synchronously before awaiting the content fetch, a
  second call for the same URL that starts after a first one already wrote
  its (matching) entry will simply reuse that entry rather than racing it.
  A second call that starts because the resource changed *again* mid-flight
  overwrites the map entry again; the caller of the *first* stale fetch
  still resolves to whatever `Promise` it captured, but nothing in the
  cache can be attributed to it any more, so subsequent reuse only sees the
  latest entry.
- **A late response must not corrupt the currently-open preview.** This is
  already the canvas layer's responsibility, not the cache's: each
  `resolveXCanvasContent` call awaits its own fetch and returns its own
  content object to whichever `useOpenAttachmentCanvas` invocation requested
  it; a stale invocation resolving late only affects its own caller. This
  change does not alter that shape — it only changes what a fetch resolves
  to.

## Risks / Trade-offs

- **Extra round-trip on every open, including cache hits.** →
  Mitigation: the metadata endpoint is small (JSON, no body transfer) and
  documented as uncached/cheap; only triggered on an explicit preview open,
  not per-render or per-poll.
- **Metadata and content can still, in principle, be inconsistent if the
  resource is overwritten between the metadata call and the content
  fetch.** → Accepted per the proposal's scope ("smallest reliable
  solution," not full transactional consistency); the window is one HTTP
  round trip, and a subsequent open re-validates and will show whatever is
  current then. Not worse than today (which has no validation at all).
- **A provider/DIAL Core deployment that omits `etag` (e.g. certain non-Core
  file backends) forces every open to skip the cache.** → Accepted: this is
  exactly the "missing validator ⇒ fetch fresh" rule from the proposal; it
  degrades to today's pre-cache behavior for that resource rather than
  serving unverifiable content, and does not affect resources that do
  report an `etag`.
- **Test surface**: `attachment-canvas.spec.ts`'s existing dedup/retry/clear
  scenarios assume no metadata call; the fake `resolvers` in that spec must
  add `resolveDialFileMetadataUrl`, and cache-hit assertions must also mock
  a matching-ETag metadata response. → Handled explicitly in `tasks.md`.

## Migration Plan

Frontend-only, in-memory cache change with no persisted data and no API
contract change — a normal deploy, no migration or rollback beyond the
usual revert-the-commit path. No feature flag: the freshness check always
applies to previously-unconditional cache reuse, which was already a latent
correctness bug, not a behavior users could have intentionally relied on.

## Open Questions

- None blocking implementation. The conditional-download gap (see Decisions)
  is recorded, not open — it is out of scope until DIAL Core's `downloadFile`
  operation supports `If-None-Match`.
