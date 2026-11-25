## Why

DIAL frontends (first consumer: `ai-dial-launchpad`, a separate repo) need to render Markdown documents — release notes, guides — that live in GitHub or GitLab repositories. Doing this from the browser would require shipping repository tokens to the client and widening the CSP `connect-src`/`img-src` allowlists. A server-configured proxy in `chat-api` keeps credentials server-side and keeps the browser talking only to its own origin.

## What Changes

- Add a `content-sources` NestJS module to `apps/chat-api` exposing three session-protected, versioned read-only endpoints under `/api/v1/content-sources/:sourceId`: source listing, single Markdown document, and image asset bytes.
- Add server-only configuration: `CONTENT_SOURCES_CONFIG` (source registry JSON, validated at startup; an invalid value fails startup), `CONTENT_SOURCES_CREDENTIALS` (secret token map), and `CONTENT_SOURCES_CACHE_TTL_MS` / `CONTENT_SOURCES_TIMEOUT_MS` plus fixed size limits (1 MiB document, 10 MiB asset, 200 documents per source). Unset config means the module is enabled with no sources, so every source id returns 404.
- Add GitHub and GitLab provider adapters behind one interface (`listDocuments`, `readFile`, `fileDate`) with tree pagination, GitHub truncated-tree handling, and per-path commit dates fetched with concurrency of at most 4.
- Add cached upstream access (keyed by source + ref + path) with single-flight and stale-if-error.
- Add strict path validation, an asset extension allowlist, safe response headers (nosniff, sandboxed CSP for SVG, private cache), a defined upstream-error → HTTP-status mapping, per-user admission throttling and telemetry modelled on `custom-api`.
- Document the env vars (`.env.template`, `apps/chat-api/README.md`), required token scopes and egress; regenerate `@epam/ai-dial-chat-api-client`.

Out of scope: writes, webhooks/cache invalidation, server-side HTML rendering, exposing sources through client-config, any chat UI usage.

## Capabilities

### New Capabilities

- `content-sources-config`: server-only source registry and credential configuration, its validation, defaults and startup failure behavior.
- `content-sources-api`: the read-only listing, document and asset endpoints — path safety, response contracts, error mapping, caching behavior, throttling and telemetry.

### Modified Capabilities

<!-- None: no existing spec's requirements change. -->

## Impact

- Code: new `apps/chat-api/src/content-sources/` module; registration in `apps/chat-api/src/app/app.module.ts`; new env fields in `apps/chat-api/src/config/env/integrations.env.ts` and the snapshot in `config/tests/environment-composition.spec.ts`.
- API: three new `GET` operations in the OpenAPI document; regenerated `libs/chat-api-client` (generated files are not hand-edited).
- Docs: `apps/chat-api/.env.template`, `apps/chat-api/README.md`, `docs/architecture.md` (new backend domain folder and controller base path).
- Operations: new outbound HTTPS egress from `chat-api` to configured GitHub/GitLab hosts; new secret (`CONTENT_SOURCES_CREDENTIALS`).
- Dependencies: none new (global `fetch`, the existing `cache-manager`; `include` globs use a small in-repo matcher — see design).
