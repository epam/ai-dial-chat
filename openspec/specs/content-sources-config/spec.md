# Spec: content-sources-config

## Purpose

Defines the server-only configuration through which operators declare GitHub and GitLab content sources and their credentials, and how invalid configuration is rejected at startup.

---

## Requirements

### Requirement: Source registry configuration
The system SHALL read the source registry from the server-only `CONTENT_SOURCES_CONFIG` JSON value (`{"version":1,"sources":[...]}`) and SHALL NOT expose it through client-config or any browser build.

#### Scenario: Valid registry loads
- **WHEN** `CONTENT_SOURCES_CONFIG` contains a valid version-1 registry at startup
- **THEN** every listed source is available by its `id`

#### Scenario: Config is not exposed to the browser
- **WHEN** the client configuration is requested
- **THEN** it contains no source, repository, host or credential information

### Requirement: Empty configuration
The system SHALL treat an unset, empty or whitespace-only `CONTENT_SOURCES_CONFIG` as a registry with no sources, with the module still enabled.

#### Scenario: No sources configured
- **WHEN** `CONTENT_SOURCES_CONFIG` is unset and a client requests any source id
- **THEN** the response is 404

### Requirement: Source entry validation
The system SHALL validate each source against a closed schema: `id` matching `^[a-z0-9][a-z0-9-]{0,63}$` and unique; `title` plain text; `provider` of `github` or `gitlab`; `baseUrl` an https origin; `repository`, `ref`, `kind` (`file`|`directory`) and `path` present; and SHALL reject unknown fields.

#### Scenario: Duplicate id
- **WHEN** two sources share the same `id`
- **THEN** startup fails

#### Scenario: Non-https base URL
- **WHEN** a source `baseUrl` uses `http`, carries a path, query or credentials
- **THEN** startup fails

#### Scenario: Unknown field
- **WHEN** a source contains a field outside the schema
- **THEN** startup fails

### Requirement: Provider-specific fields
The system SHALL default a GitHub `baseUrl` to `https://api.github.com`, SHALL require `baseUrl` for GitLab, and SHALL accept `repository` as `owner/repo` for GitHub and as a numeric id or `group/sub/project` path for GitLab.

#### Scenario: GitHub default host
- **WHEN** a GitHub source omits `baseUrl`
- **THEN** it resolves to `https://api.github.com`

#### Scenario: GitLab without base URL
- **WHEN** a GitLab source omits `baseUrl`
- **THEN** startup fails

### Requirement: Source defaults and options
The system SHALL default `include` to `**/*.md` and `assetsPath` to the folder containing `path` (the folder `path` itself for a directory source), and SHALL accept `sort` (`name-desc`|`name-asc`|`date-desc`), `date` (`created`|`updated`|`none`), and `feed.summaryHeading`.

#### Scenario: Defaults applied
- **WHEN** a directory source omits `include` and `assetsPath`
- **THEN** documents match `**/*.md` and assets are allowed under the source path

#### Scenario: Invalid path in config
- **WHEN** `path` or `assetsPath` is absolute, contains a backslash, NUL, or escapes the repository root with `..`
- **THEN** startup fails

### Requirement: Credential references
The system SHALL read tokens from the secret `CONTENT_SOURCES_CREDENTIALS` JSON map keyed by `credentialId`, and SHALL fail startup when a source references an id absent from the map. A source without `credentialId` SHALL be accessed anonymously.

#### Scenario: Missing credential
- **WHEN** a source references a `credentialId` not present in `CONTENT_SOURCES_CREDENTIALS`
- **THEN** startup fails with a message naming the source id but no token value

#### Scenario: Provider auth header
- **WHEN** an upstream request is made with a credential
- **THEN** GitHub receives `Authorization: Bearer <token>` and GitLab receives `PRIVATE-TOKEN: <token>`

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

### Requirement: Startup failure never leaks secrets
The system SHALL fail startup on any invalid value in these settings, and error messages and logs SHALL identify the offending field without echoing the raw configuration or any token.

#### Scenario: Malformed JSON
- **WHEN** `CONTENT_SOURCES_CREDENTIALS` is malformed JSON
- **THEN** startup fails and neither the logs nor the error contain the raw value
