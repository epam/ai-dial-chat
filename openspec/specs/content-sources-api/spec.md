# Spec: content-sources-api

## Purpose

Defines the authenticated, read-only HTTP API through which frontends list and read Markdown documents and images from configured GitHub and GitLab sources without holding repository tokens.

---

## Requirements

### Requirement: Authenticated versioned endpoints
The system SHALL serve `GET /api/v1/content-sources/:sourceId`, `GET /api/v1/content-sources/:sourceId/document?path=` and `GET /api/v1/content-sources/:sourceId/asset?path=`, each requiring a valid session, and SHALL publish them with typed OpenAPI response DTOs.

#### Scenario: Unauthenticated request
- **WHEN** a request has no valid session
- **THEN** the response is 401 and no upstream call is made

#### Scenario: Unknown source
- **WHEN** `:sourceId` is not configured
- **THEN** the response is 404

### Requirement: Source listing
The source endpoint SHALL return `{id,title,kind,feed,webUrl,documents:[{path,title,date|null}]}`, where each document `title` is the first H1 of the document or, when none exists, its file name, and `webUrl` is the repository web page of the source.

#### Scenario: Directory source
- **WHEN** a directory source is requested
- **THEN** documents matching `include` under `path` are returned, sorted per `sort` with numeric-aware name comparison, at most 200 entries

#### Scenario: File source
- **WHEN** a file source is requested
- **THEN** exactly one document is returned

#### Scenario: Dates disabled
- **WHEN** the source `date` is `none`
- **THEN** every document `date` is null

### Requirement: Truncated listings
When the upstream tree listing is truncated, the system SHALL return the partial list and log a warning rather than fail.

#### Scenario: GitHub truncated tree
- **WHEN** GitHub reports `truncated: true`
- **THEN** the available documents are returned and a warning is logged

### Requirement: Document retrieval
The document endpoint SHALL return `{path,title,date,markdown,webUrl}` with the Markdown text unchanged, and SHALL accept only a normalized path inside the source root that matches `include`.

#### Scenario: Valid document
- **WHEN** a listed document path is requested
- **THEN** its Markdown is returned byte-for-byte without link or image rewriting

#### Scenario: Path outside the source
- **WHEN** the path is not inside the source root or does not match `include`
- **THEN** the response is 404

#### Scenario: Oversized document
- **WHEN** the document exceeds 1 MiB
- **THEN** the response is 502

### Requirement: Path safety
The system SHALL reject any `path` that is absolute, contains a backslash or NUL, or whose `..` segments escape the root, SHALL normalize paths before using them in cache keys or upstream requests, and SHALL NOT derive upstream hosts from request input.

#### Scenario: Traversal attempt
- **WHEN** `path` starts with `..` or its `..` segments climb above the source root
- **THEN** the response is 400 and no upstream call is made

#### Scenario: Backslash or NUL
- **WHEN** `path` contains `\` or a NUL character
- **THEN** the response is 400

#### Scenario: Percent sign in a file name
- **WHEN** a listed document path contains a literal percent sign and that path is requested
- **THEN** the path is taken literally and the document is returned

#### Scenario: Equivalent spellings share a cache entry
- **WHEN** `a/./b.md` and `a/b.md` are requested
- **THEN** both resolve to the same normalized path and cache entry

### Requirement: Asset delivery
The asset endpoint SHALL return the file bytes only for a normalized path within the source's `assetsPath` whose extension is png, jpg, jpeg, gif, webp or svg, with `Content-Type` derived from the extension, `X-Content-Type-Options: nosniff` and `Cache-Control: private, max-age=3600`.

#### Scenario: Image outside assetsPath
- **WHEN** a path resolves outside `assetsPath`
- **THEN** the response is 404

#### Scenario: Disallowed extension
- **WHEN** the extension is not in the allowlist (for example `.html`)
- **THEN** the response is 400

#### Scenario: SVG
- **WHEN** an SVG asset is returned
- **THEN** the response carries the same sandboxed Content-Security-Policy used for theme icons

#### Scenario: Oversized asset
- **WHEN** the asset exceeds 10 MiB
- **THEN** the response is 502

### Requirement: Upstream error mapping
The system SHALL map upstream failures to: upstream 404 → 404, upstream 401/403 → 502 (logged as a credential problem without the token), timeout or unreachable upstream → 503, oversized content → 502.

#### Scenario: Credential rejected
- **WHEN** the upstream answers 401 or 403
- **THEN** the response is 502 and the log names the source id as a credential problem without any token

#### Scenario: Upstream rate limit
- **WHEN** the upstream answers 403 with an exhausted rate limit (`x-ratelimit-remaining: 0` or a `Retry-After` header)
- **THEN** the response is 503 and it is not logged as a credential problem

#### Scenario: Upstream timeout
- **WHEN** the upstream does not respond within the configured timeout
- **THEN** the response is 503

### Requirement: Caching and resilience
The system SHALL cache upstream results keyed by source, ref and normalized path for the configured TTL, SHALL coalesce concurrent identical upstream requests into one, and SHALL serve a stale cached value when a refresh fails or cannot start because no upstream slot, queue position or per-user miss allowance is available.

#### Scenario: Single flight
- **WHEN** several requests for the same uncached document arrive concurrently
- **THEN** exactly one upstream request is made

#### Scenario: Stale if error
- **WHEN** a cached entry has expired and the upstream refresh fails
- **THEN** the stale value is returned instead of an error

#### Scenario: Stale when no slot is available
- **GIVEN** a cached entry has expired and its stale value is still retained
- **WHEN** its refresh cannot start because the upstream queue is full, the queue wait timed out or the user's miss limit is reached
- **THEN** the stale value is returned with 200 instead of 429 or 503
- **AND** `dial.chat.content_sources.stale_served` is incremented for the source

#### Scenario: Degraded listing is not pinned
- **WHEN** a document title or date could not be read for a non-fatal reason and fell back to the file name or null
- **THEN** the listing is returned but not cached, so the next request retries

#### Scenario: Admission failure is not a degraded listing
- **WHEN** a title or date read during listing assembly cannot start because the queue wait timed out
- **THEN** the listing fails (or is served stale) instead of falling back to file names or null dates

#### Scenario: Commit dates
- **WHEN** a source has `date` of `created` or `updated`
- **THEN** per-path commit dates are fetched with at most 4 concurrent upstream requests per listing and cached per path

### Requirement: Cache hits bypass admission
A request that is answered entirely from fresh cache entries SHALL take no admission slot of any kind, SHALL make no upstream call and SHALL never be answered with 429, however many such requests one user or all users have in flight.

#### Scenario: Burst of cached hits above the former limit
- **GIVEN** an asset of a configured source is in the cache and fresh
- **WHEN** one user sends 20 concurrent requests for that asset
- **THEN** all 20 responses are 200 with the asset bytes
- **AND** no upstream request is made

#### Scenario: Cached hits while the upstream is saturated
- **GIVEN** every upstream slot and queue position for a source's host and credential is taken
- **WHEN** a request for a fresh cached document of that source arrives
- **THEN** the response is 200 from the cache without waiting

### Requirement: Upstream concurrency per host and credential
Every upstream call to a hosting provider (tree or listing page, file read, commit lookup) SHALL take a slot from a limit shared by all sources with the same `baseUrl` and `credentialId` (sources without a credential share their host's anonymous limit). The limit SHALL be `CONTENT_SOURCES_UPSTREAM_CONCURRENCY` concurrent calls (default 8) per chat-api process. A slot SHALL be held until the upstream response body has been read or the call has failed.

#### Scenario: Cold burst stays within the limit
- **GIVEN** the upstream concurrency is 8 and nothing is cached
- **WHEN** one or more users send 20 concurrent requests for 20 distinct assets of sources sharing a host and credential
- **THEN** at no moment are more than 8 upstream requests to that host with that credential in progress
- **AND** all 20 responses are 200 when each upstream call completes within the timeout

#### Scenario: Separate credentials do not share a limit
- **GIVEN** two sources on the same host with different `credentialId` values
- **WHEN** the first source's limit is saturated
- **THEN** an upstream call for the second source starts without waiting

#### Scenario: Slot released after every outcome
- **WHEN** an upstream call succeeds, fails with an upstream error, exceeds its deadline or is aborted
- **THEN** its slot is released and the next queued call starts

#### Scenario: Listing draws from the same limit
- **WHEN** a directory listing is assembled while other requests use the same host and credential
- **THEN** the listing runs at most 4 upstream calls at once and each of them counts against the shared limit

### Requirement: Bounded upstream queue
An upstream call that finds no free slot SHALL wait first-in first-out in a queue of at most `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE` waiters (default 64) per host and credential. A call that cannot be queued because the queue is full SHALL fail with 429 without an upstream request. A call that has not started when `CONTENT_SOURCES_TIMEOUT_MS` has passed since it was queued SHALL fail with 503 without an upstream request.

#### Scenario: Queued call starts when a slot frees
- **GIVEN** all slots for a host and credential are taken and one call is queued
- **WHEN** a running call finishes
- **THEN** the queued call starts before any call queued after it, and before any newly arriving call

#### Scenario: Full queue answers 429
- **GIVEN** all slots and all queue positions for a host and credential are taken
- **WHEN** a request needing an upstream call to that host and credential arrives and nothing stale is cached for it
- **THEN** the response is 429 and no upstream request is made for it

#### Scenario: Wait timeout answers 503
- **GIVEN** all slots for a host and credential stay taken
- **WHEN** a queued call has waited `CONTENT_SOURCES_TIMEOUT_MS` and nothing stale is cached for it
- **THEN** the response is 503, the call leaves the queue, and no upstream request is made for it

### Requirement: Listing reads wait for capacity
The upstream calls a listing makes while it is assembled (tree or listing pages, title reads, commit lookups) SHALL count against the same per-host-and-credential limit and SHALL wait first-in first-out for a slot up to `CONTENT_SOURCES_TIMEOUT_MS`, but SHALL NOT be refused because the queue is full: they are already bounded per listing, and a refusal would discard the listing's completed reads.

#### Scenario: Listing waits instead of failing on a full queue
- **GIVEN** all slots and all queue positions for a host and credential are taken
- **WHEN** an uncached listing of a source on that host and credential is requested
- **THEN** its tree, title and date reads wait for slots and the listing is returned with 200, while other calls arriving meanwhile still answer 429

### Requirement: Per-user cache-miss fairness
The system SHALL limit, per authenticated user (identity provider and subject), the number of concurrent requests that start upstream work to `CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY` (default 8). A request counts once, from the first upstream load it starts until it completes. A request served from fresh cache entries, or only by joining a load another request already started, SHALL NOT count.

#### Scenario: Miss limit reached
- **GIVEN** a user has 8 requests in flight that each started an upstream load
- **WHEN** the same user sends a 9th request for content that is not cached
- **THEN** the response is 429 and no upstream request is made for it

#### Scenario: Joining an in-flight load does not count
- **GIVEN** a user has 8 requests in flight that each started an upstream load
- **WHEN** the same user sends another request for a document one of them is already loading
- **THEN** that request waits for the shared load and receives its result instead of 429

#### Scenario: Cached hits beside the miss limit
- **GIVEN** a user has 8 requests in flight that each started an upstream load
- **WHEN** the same user requests a fresh cached asset
- **THEN** the response is 200 from the cache

### Requirement: Client disconnect cancels unneeded upstream work
When the client of a request disconnects before its response is sent, the system SHALL stop waiting on that request's behalf. An upstream load that no remaining request is waiting for SHALL leave the queue if it is queued, or be aborted if it is running. A running call's slot SHALL stay taken until that call settles. A cancelled load SHALL NOT be cached.

#### Scenario: Abandoned queued call leaves the queue
- **GIVEN** a request's upstream call is queued and no other request is waiting for the same load
- **WHEN** the client disconnects
- **THEN** the call leaves the queue without an upstream request

#### Scenario: Shared load survives one disconnect
- **GIVEN** two requests wait for the same upstream load
- **WHEN** one client disconnects
- **THEN** the load continues and the other request receives its result

### Requirement: Telemetry
The system SHALL record call duration and a bounded result category labelled with the configured source id, and SHALL NOT record tokens, document paths or upstream URLs; unknown source ids SHALL collapse to a single constant label.

#### Scenario: Unknown id guess
- **WHEN** a client requests many distinct unconfigured ids
- **THEN** telemetry attribute cardinality does not grow

### Requirement: Example exchange
The endpoints SHALL use the shapes below; the document `markdown` is returned exactly as stored.

#### Scenario: Listing and document
- **WHEN** an authenticated client requests `GET /api/v1/content-sources/release-notes`
- **THEN** the response is 200 with `{"id":"release-notes","title":"Release notes","kind":"directory","feed":{"summaryHeading":"Summary"},"webUrl":"https://github.com/epam/ai-dial-chat/tree/development/docs/releases","documents":[{"path":"docs/releases/1.0.0.md","title":"Release 1.0.0","date":"2025-03-01T10:00:00.000Z"}]}`
- **AND** `GET /api/v1/content-sources/release-notes/document?path=docs/releases/1.0.0.md` returns 200 with `{"path":"docs/releases/1.0.0.md","title":"Release 1.0.0","date":"2025-03-01T10:00:00.000Z","markdown":"# Release 1.0.0\n…","webUrl":"https://github.com/epam/ai-dial-chat/blob/development/docs/releases/1.0.0.md"}`

### Requirement: Generated client operations
The endpoints SHALL be published in OpenAPI as the operations `getContentSource`, `getContentSourceDocument` and `getContentSourceAsset`, with response DTOs for the listing and document and a binary image response for the asset; the generated client SHALL expose them as `ContentSourcesApi` methods of the same names, and callers use the plain methods for JSON and the `Raw` method for the asset response headers.

#### Scenario: Client regenerated
- **WHEN** the OpenAPI document is generated
- **THEN** `ContentSourcesApi` in `@epam/ai-dial-chat-api-client` contains the three operations and `npm run openapi:check` passes

### Requirement: Cache keys, TTL and invalidation
Cached values SHALL be keyed `content-sources:{sourceId}:{ref}:{kind}:{normalizedPath}`, fresh for `CONTENT_SOURCES_CACHE_TTL_MS` (default 30 minutes), kept four times longer for stale-if-error, and never invalidated by an event: they expire, or are lost on restart. Documents and assets above 512 KiB SHALL be served without being cached, and a listing whose title or date fell back SHALL not be cached.

#### Scenario: Expiry
- **WHEN** an entry is older than the TTL and the upstream is healthy
- **THEN** the next request refreshes it

### Requirement: Telemetry metrics
The system SHALL record the histogram `dial.chat.content_sources.call.duration` labelled by configured source id (or `unknown`), operation (`list`, `document`, `asset`) and result category (`success`, `bad_request`, `not_found`, `admission_rejected`, `upstream_queue_full`, `upstream_credentials`, `upstream_error`, `unavailable`, `client_closed`, `internal_error`), and the counter `dial.chat.content_sources.stale_served` labelled by source id.

#### Scenario: Rejected credential
- **WHEN** the upstream answers 401 or a non-rate-limit 403
- **THEN** the call is recorded with result `upstream_credentials`

#### Scenario: Full queue versus miss limit
- **WHEN** one request is refused because the upstream queue is full and another because its user reached the miss limit
- **THEN** the first is recorded with result `upstream_queue_full` and the second with `admission_rejected`

#### Scenario: Client disconnect
- **WHEN** the client disconnects before the response is sent
- **THEN** the call is recorded with result `client_closed`, not `unavailable`

### Requirement: Upstream queue wait metric
The system SHALL record the histogram `dial.chat.content_sources.upstream.queue.duration`, the seconds each upstream call waited for a slot, labelled by configured source id and queue outcome (`admitted`, `queue_full`, `timed_out`, `cancelled`). No content-sources metric attribute SHALL carry a host, credential id, path, token or user.

#### Scenario: Queue wait recorded
- **WHEN** an upstream call is admitted immediately, admitted after waiting, refused because the queue is full, times out in the queue or is cancelled while queued
- **THEN** one `dial.chat.content_sources.upstream.queue.duration` sample is recorded with outcome `admitted`, `admitted`, `queue_full`, `timed_out` or `cancelled` respectively

### Requirement: Access is per session
The system SHALL authorize content-source requests by session only: any authenticated user can read every configured source, with no per-user or per-role filtering.

#### Scenario: Private repository
- **WHEN** a source uses a credential for a private repository and any signed-in user requests it
- **THEN** the content is returned
