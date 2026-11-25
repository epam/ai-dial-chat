# Spec Delta

## ADDED Requirements

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

### Requirement: Upstream queue wait metric
The system SHALL record the histogram `dial.chat.content_sources.upstream.queue.duration`, the seconds each upstream call waited for a slot, labelled by configured source id and queue outcome (`admitted`, `queue_full`, `timed_out`, `cancelled`). No content-sources metric attribute SHALL carry a host, credential id, path, token or user.

#### Scenario: Queue wait recorded
- **WHEN** an upstream call is admitted immediately, admitted after waiting, refused because the queue is full, times out in the queue or is cancelled while queued
- **THEN** one `dial.chat.content_sources.upstream.queue.duration` sample is recorded with outcome `admitted`, `admitted`, `queue_full`, `timed_out` or `cancelled` respectively

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Per-user throttling
**Reason**: It limited concurrent HTTP requests (4 per user, 32 per process) before the cache was read, so fresh cache hits were refused with 429, and it did not bound concurrent upstream calls. Replaced by "Cache hits bypass admission", "Upstream concurrency per host and credential", "Bounded upstream queue" and "Per-user cache-miss fairness".
**Migration**: None for clients. The endpoints, status codes and OpenAPI document are unchanged. 429 is now returned only when an upstream queue is full or a user has too many concurrent cache misses, and a client may retry it. Operators tune the new limits with `CONTENT_SOURCES_UPSTREAM_CONCURRENCY`, `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE` and `CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY`.
