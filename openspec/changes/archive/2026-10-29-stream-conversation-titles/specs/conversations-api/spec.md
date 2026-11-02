## ADDED Requirements

### Requirement: Finite incremental conversation title stream

`POST /api/v1/conversations/titles/stream` SHALL accept `StreamConversationTitlesBodyDto` containing 1–500 `ids`, each a full conversation resource URL validated with the parser in `apps/chat-api/src/conversations/utils/conversation-resource-id.ts`. Each ID SHALL retain the existing 4096-character limit; UTF-8 `JSON.stringify(ids)` SHALL be limited to 256 KiB. Duplicate identical IDs SHALL produce one outcome in first-occurrence order of admission. The endpoint SHALL require the ordinary authenticated session and CSRF checks, with no new role or feature flag. Resource access SHALL remain governed by Core.

The OpenAPI operation SHALL be `streamConversationTitles`. The documented success body SHALL be a `text/event-stream` string, with `ConversationTitleStreamEventDto` and its discriminated event DTOs exposed in components. `ConversationsApi.streamConversationTitlesRaw` SHALL supply the raw response body to the adapter in `apps/chat/src/server-api/conversations.api.ts`; no application component or shared UI library SHALL construct the endpoint or decode a generated ordinary JSON response as a stream.

Example request:

```json
{
  "ids": [
    "conversations/example/model__First",
    "conversations/example/model__Second"
  ]
}
```

Example successful HTTP 200 response, where the second item finishes first:

```text
: init

data: {"type":"title","id":"conversations/example/model__Second","title":"Second renamed title"}

data: {"type":"title","id":"conversations/example/model__First","title":"First renamed title"}

data: {"type":"done","reason":"complete","processed":2,"total":2}

```

Each resolved title SHALL be emitted as soon as it is ready and the response is writable. The service SHALL NOT wait for a whole batch before emission or before filling a newly available read slot. Events SHALL never contain messages. A missing/forbidden item SHALL emit `{"type":"unavailable","id":"..."}`. An individually failed upstream read SHALL emit `{"type":"item_error","id":"...","code":"upstream_error"}` or code `timeout`. Each accepted distinct ID SHALL receive at most one item outcome; `processed` counts all such outcomes. Complete streams SHALL have `processed === total`. A budget completion SHALL leave untouched IDs without item outcomes for a later request.

Validation/auth/admission errors before headers SHALL be HTTP 400 (invalid IDs/count), 401 (authentication), 403 (CSRF), 413 (input byte bound), or 503 (stream capacity); any upstream setup failure before headers SHALL map to 502/503. After headers, a fatal error SHALL emit `{"type":"error","status":503,"code":"unavailable"}` or use the paired status/code `401`/`unauthenticated` or `502`/`upstream_error`, and close without a `done` event. Core authentication rejection, 429, queue unavailability, or five consecutive upstream read failures SHALL terminate the stream. Successful Core reads SHALL reset the consecutive-failure count. An EOF without `done`/`error` SHALL be an interrupted stream, never proof of completion. Existing list and JSON title endpoint contracts SHALL remain unchanged.

#### Scenario: Fast title bypasses a slow peer

- **WHEN** one read remains unresolved and another title in the same request resolves
- **THEN** the resolved title frame reaches the HTTP client before the slow read settles
- **AND** the freed worker admits the next ID without a batch-wide wait

#### Scenario: Validation occurs before upstream work

- **WHEN** the ID array is empty, oversized, malformed, or contains encoded traversal/control characters
- **THEN** the request fails with 400 or 413 before headers are opened or Core reads begin

#### Scenario: Exact identity survives normalization

- **WHEN** a valid ID contains a literal percent escape or two requested aliases share a normalized resource
- **THEN** Core reads preserve the resource path and coalesce where appropriate
- **AND** each response outcome uses its exact requested ID

#### Scenario: Missing and successful resources coexist

- **WHEN** Core rejects one item with 403/404 and resolves another
- **THEN** the stream emits an unavailable outcome for the first and a title for the second, then completes with both counted

#### Scenario: Upstream session or capacity fails after headers

- **WHEN** Core rejects authentication or the read gate becomes unavailable after the stream starts
- **THEN** a terminal error describes 401 or 503 without changing the already-sent HTTP status
- **AND** no new work or successful terminal frame follows it

### Requirement: Bounded continuous title scheduling

The title stream SHALL keep a request-local finite queue and admit at most 25 workers through the cache's process-wide gate, shared with the JSON endpoint. Actual Core title reads SHALL never exceed 25 per process. The global queued-read limit SHALL remain 250, queue wait five seconds and per-read timeout ten seconds. No more than 16 title streams SHALL be retained per process, including setup/cleanup. Queued IDs SHALL NOT all become eagerly started promises or global admission requests.

Admission SHALL stop after 45 seconds and the stream SHALL close by 60 seconds. Admitted work SHALL drain or emit timeout item outcomes; unattempted IDs SHALL remain eligible after `done` with `reason: budget`. A zero-progress budget expiration SHALL terminate with 503 instead of creating a continuation loop. Frames SHALL be serialized through one writer with at most 25 ready item events and 64 KiB per frame. Backpressure SHALL pause further admission; a five-second drain timeout SHALL detach the request and cancel its work. Existing initial comments and 15-second keepalives SHALL be retained. Disconnect, abort, timeout and shutdown SHALL run idempotent cleanup.

An outcome-buffer permit SHALL be reserved before item admission and held through outcome delivery/discard, bounding active plus buffered items to 25 per stream. Blocked producer promises SHALL not form an additional unbounded buffer. The 60-second deadline SHALL also end drain waiting; an unwritable response SHALL close as interrupted rather than delay closure or emit inaccurate terminal counts.

#### Scenario: Multiple clients share the process cap

- **WHEN** concurrent JSON and stream callers request uncached titles
- **THEN** the total active Core reads remains at or below 25 and excess work obeys the bounded queue

#### Scenario: Slow receiver applies backpressure

- **WHEN** the HTTP writable cannot drain while title reads finish
- **THEN** event buffering and new read admission stay bounded
- **AND** a receiver that remains stalled for five seconds is disconnected and its ownership is cancelled

#### Scenario: Work continues beyond one finite request

- **WHEN** a request reaches its admission/lifetime budget with some IDs untouched
- **THEN** it emits item outcomes for admitted work and a budget terminal with truthful processed/total counts
- **AND** untouched IDs can be submitted in a later request without replaying completed outcomes

## MODIFIED Requirements

### Requirement: Bounded isolated title cache

Title caching SHALL store only title-resolution fields, use a 5000-entry bound and five-minute expiry, and scope `conversations:title:<token-digest>:<normalized-resource-id>` keys to a non-reversible digest of the caller's token plus exact resource identity. It SHALL coalesce concurrent equivalent reads. Successful saves, renames and LLM naming SHALL refresh or invalidate affected projections; deletion and newer listing metadata SHALL invalidate stale projections. A prior in-flight read or failure SHALL not overwrite or invalidate a later successful write or delete.

Each consumer of a coalesced read SHALL have independent cancellation ownership. The last consumer leaving SHALL remove queued work or abort the active SDK read, while a remaining consumer SHALL keep it alive. The shared operation SHALL own its abort controller and timeout. The actual read slot SHALL remain occupied until the underlying operation settles. Cancelled operations SHALL NOT populate the cache, and obsolete completion callbacks SHALL NOT delete a newer entry. The existing JSON endpoint SHALL share these rules without changing its public response/error contract.

#### Scenario: Identity isolation

- **WHEN** two different bearer tokens request the same resource ID
- **THEN** one token's cached title is not served from the other token's cache namespace

#### Scenario: Rename wins over earlier refresh

- **WHEN** a body read starts before a successful rename and completes after it
- **THEN** the cache retains the renamed title rather than the earlier fetched name

#### Scenario: Expiry or eviction

- **WHEN** a title's cache lifetime expires or capacity evicts it
- **THEN** metadata listing remains fast and marks it pending for a later bounded request

#### Scenario: One of two consumers disconnects

- **WHEN** a stream and a second JSON/stream caller share a read and only the stream disconnects
- **THEN** the second caller still receives its outcome and the upstream read is not aborted

#### Scenario: Last consumer leaves

- **WHEN** the final consumer aborts while its operation is queued or reading
- **THEN** queued work is removed or the active SDK signal is aborted
- **AND** resources release exactly once without storing a late result or exceeding the global read limit

#### Scenario: Late failure after a newer write

- **WHEN** an older cancelled/read operation fails after a successful write populated the same cache key
- **THEN** its cleanup leaves the newer summary intact
