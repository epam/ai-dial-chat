# Spec Delta

## MODIFIED Requirements

### Requirement: Runtime limits
The system SHALL support `CONTENT_SOURCES_CACHE_TTL_MS` (default 30 minutes), `CONTENT_SOURCES_TIMEOUT_MS` (default 10 seconds), `CONTENT_SOURCES_UPSTREAM_CONCURRENCY` (default 8, 1–64), `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE` (default 64, 0–1024) and `CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY` (default 8, 1–64), and SHALL enforce fixed ceilings of 1 MiB per document, 10 MiB per asset and 200 documents per source.

#### Scenario: Defaults
- **WHEN** the TTL, timeout and admission variables are unset
- **THEN** the cache TTL is 30 minutes, the upstream timeout is 10 seconds, the upstream concurrency is 8 per host and credential, the upstream queue holds 64 waiters and each user may have 8 concurrent cache-miss requests

#### Scenario: Invalid admission limit
- **WHEN** `CONTENT_SOURCES_UPSTREAM_CONCURRENCY` is `0`, `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE` is negative, or any of the three admission variables is not an integer or is above its maximum
- **THEN** startup fails with a validation error naming the variable

#### Scenario: Queue disabled
- **WHEN** `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE` is `0` and every upstream slot for a host and credential is taken
- **THEN** a further upstream call to that host and credential fails at once with 429 (or is served stale when a stale value exists)
