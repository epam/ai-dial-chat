# chat-hooks-attachment-cache-freshness Specification

## Purpose

Cache identity, ETag-based revalidation, invalidation, and concurrency rules for the shared blob/text attachment content cache in `libs/chat-hooks/src/files/attachment-canvas.ts`, so a cached preview body is never served once the underlying DIAL resource has changed.

## Requirements

### Requirement: Cache identity is the full resource id, never the display filename alone

The shared attachment blob/text caches in `libs/chat-hooks/src/files/attachment-canvas.ts` SHALL key every cache entry by the resolved DIAL download URL, which is derived from the attachment's full `files/{bucket}/{path}` resource id (via `resolveDialFileDownloadUrl`/`resolveDialFileBucketAndPath`), never from the attachment's display `name` alone. Two attachments that resolve to different `files/{bucket}/{path}` ids SHALL always occupy distinct cache entries, even when their display names are identical.

#### Scenario: Two different resources sharing a filename do not share a cache entry

- **WHEN** attachment A (`files/bucket-1/generated/report.txt`) and attachment B (`files/bucket-1/generated-2/report.txt`) are both resolved for preview, with different content and different `etag` values from `GET /api/v1/files/metadata`
- **THEN** each resolves and caches independently, and opening B's preview after A's never returns A's cached bytes

### Requirement: A cached body is reused only after its ETag is revalidated as current

Before returning a cached blob/text `Promise` for a given DIAL download URL, `fetchDialBlob`/`fetchDialText` SHALL revalidate freshness by fetching the resource's current metadata through `resolvers.resolveDialFileMetadataUrl(fileId)` and comparing the returned `etag` against the `etag` stored on the cache entry created when that body was fetched. The cached `Promise` SHALL be returned only on an exact match; on any mismatch, on a cache miss, or when the stored entry has no `etag`, the function SHALL discard the stale entry (if any), issue a fresh content fetch, and store the new `{ etag, promise }` pair — captured from the metadata call that immediately preceded the content fetch — before the content fetch settles.

#### Scenario: Unchanged resource reuses the cached body without re-fetching content

- **WHEN** a resource is opened for preview a second time and the metadata call returns the same `etag` recorded on the existing cache entry
- **THEN** the cached `Promise` is returned and no new content-download request is issued

#### Scenario: Overwritten resource in the same conversation is refetched

- **WHEN** a resource is fetched and cached, is then overwritten by regenerating a same-named file in the same conversation (no `pathname` change), and its preview is opened again
- **THEN** the metadata call returns a different `etag` than the cached entry's, the stale entry is discarded, and the newly opened preview shows the newly written content

#### Scenario: Overwritten resource across conversations is refetched

- **WHEN** a resource is fetched and cached from one conversation, is then overwritten by a different conversation regenerating a same-named file at the same underlying `files/{bucket}/{path}` id, and its preview is opened from the second conversation
- **THEN** the metadata call returns a different `etag` than the cached entry's, the stale entry is discarded, and the second conversation's preview shows its own content, never the first conversation's

### Requirement: A missing or failed freshness validation never serves stale content

When the metadata call used for freshness validation fails (network error, non-2xx response) or succeeds without an `etag` in its response body, the cache SHALL be treated as unusable for that request: the lookup/write SHALL be skipped entirely and a fresh content fetch SHALL be issued directly, regardless of whether a cache entry currently exists for that URL. A failed validation call SHALL NOT cause a cached (potentially stale) body to be returned.

#### Scenario: Metadata call fails, content is still fetched fresh

- **WHEN** the metadata call for a cached URL fails (e.g. `500` or network error)
- **THEN** the cache is bypassed for that request, a fresh content fetch is issued, and no cached body is returned

#### Scenario: Metadata response has no ETag, content is fetched fresh

- **WHEN** the metadata call succeeds but its response body has no `etag` field
- **THEN** the cache is bypassed for that request and a fresh content fetch is issued

### Requirement: Request de-duplication and retry-on-failure are preserved under revalidation

Concurrent resolutions for the same URL that observe the same validated `etag` SHALL still de-duplicate onto the single in-flight `Promise`, exactly as before revalidation was added. A content fetch that rejects SHALL still remove its cache entry so a later call retries the network rather than replaying the rejection.

#### Scenario: Concurrent opens of the same unchanged resource de-duplicate onto one fetch

- **WHEN** two previews for the same URL are opened concurrently before either settles, and both observe the same current `etag`
- **THEN** only one content-download request is issued and both callers resolve from that single request

#### Scenario: A failed content fetch is retried, not replayed, on the next open

- **WHEN** a content fetch rejects (e.g. HTTP 403/network failure) after passing freshness validation
- **THEN** the rejected entry is removed from the cache, and the next open of the same URL issues a new content fetch rather than replaying the rejection

### Requirement: A superseded cache write never resurfaces after a newer one

When a resource changes again while an older revalidate-and-fetch sequence for the same URL is still in flight, the cache entry written by the call that observes the newest `etag` SHALL be the one later reads see; an in-flight older sequence completing after a newer one has already written its entry SHALL NOT overwrite that newer entry with its own (older) result.

#### Scenario: A late-resolving older fetch does not clobber a newer cache entry

- **WHEN** call 1 starts a revalidate-and-fetch sequence for a URL, the resource changes again, call 2 starts and completes a revalidate-and-fetch sequence for the same URL (writing its own `{ etag, promise }`) before call 1's content fetch settles, and call 1's fetch then settles
- **THEN** a subsequent open of that URL is validated against call 2's `etag`, not call 1's, and is unaffected by call 1's late completion

### Requirement: Local-file and inline-data attachment paths never use these caches

Attachments resolved from a locally-picked `File` object or from inline base64 `data` SHALL continue to bypass `blobCache`/`textCache` and the metadata-based freshness check entirely, exactly as before this change.

#### Scenario: Locally-picked file bypasses the cache and metadata check

- **WHEN** an attachment carries a `file` (a locally-picked `File` object)
- **THEN** its content resolves directly from that `File` with no metadata call and no cache read or write
