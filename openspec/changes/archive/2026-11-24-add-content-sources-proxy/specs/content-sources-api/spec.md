# Spec Delta

## Purpose

Defines the authenticated, read-only HTTP API through which frontends list and read Markdown documents and images from configured GitHub and GitLab sources without holding repository tokens.

## ADDED Requirements

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
- **WHEN** `path` is `../secrets.md` or `docs/../../x.md`
- **THEN** the response is 400 and no upstream call is made

#### Scenario: Backslash or NUL
- **WHEN** `path` contains `\` or a NUL character
- **THEN** the response is 400

#### Scenario: Percent sign in a file name
- **WHEN** a listed document path contains a literal `%` (for example `docs/100%.md`) and that path is requested
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
The system SHALL cache upstream results keyed by source, ref and normalized path for the configured TTL, SHALL coalesce concurrent identical upstream requests into one, and SHALL serve a stale cached value when a refresh fails.

#### Scenario: Single flight
- **WHEN** several requests for the same uncached document arrive concurrently
- **THEN** exactly one upstream request is made

#### Scenario: Stale if error
- **WHEN** a cached entry has expired and the upstream refresh fails
- **THEN** the stale value is returned instead of an error

#### Scenario: Degraded listing is not pinned
- **WHEN** a document title or date could not be read for a non-fatal reason and fell back to the file name or null
- **THEN** the listing is returned but not cached, so the next request retries

#### Scenario: Commit dates
- **WHEN** a source has `date` of `created` or `updated`
- **THEN** per-path commit dates are fetched with at most 4 concurrent upstream requests and cached per path

### Requirement: Per-user throttling
The system SHALL limit concurrent content-source requests per authenticated user and globally, consistently with other server modules, and SHALL answer 429 without an upstream call when a limit is reached.

#### Scenario: Limit reached
- **WHEN** a user exceeds the per-user in-flight limit
- **THEN** the response is 429 and no upstream request is made

### Requirement: Telemetry
The system SHALL record call duration and a bounded result category labelled with the configured source id, and SHALL NOT record tokens, document paths or upstream URLs; unknown source ids SHALL collapse to a single constant label.

#### Scenario: Unknown id guess
- **WHEN** a client requests many distinct unconfigured ids
- **THEN** telemetry attribute cardinality does not grow
