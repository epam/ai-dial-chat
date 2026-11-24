# Design

## Context

`apps/chat-api` already has the pattern this change follows: `custom-api` parses a server-only JSON env value in a registry service that throws field-identifying errors at startup, guards calls with an in-flight admission service, and records bounded-cardinality OpenTelemetry metrics. `themes` already serves SVG with a sandboxed CSP (`default-src 'none'; style-src 'unsafe-inline'; sandbox`). A global `CacheModule` (`createAppCacheOptions`, `cache-manager` 7) is registered in `AppModule`. Env fields live in `config/env/integrations.env.ts` and are listed in `config/tests/environment-composition.spec.ts`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One module, one provider interface, two adapters; a third provider means one new adapter file.
- Browser never sees a token, a repository host or an upstream URL it can steer.
- Bounded upstream load: caching, single-flight, concurrency caps.

**Non-Goals:**
- No new cache backend, no distributed single-flight (per-process only, like `custom-api` admission).
- No Markdown parsing beyond extracting the first H1 and an optional summary section; no HTML.

## Decisions

1. **Module layout** `apps/chat-api/src/content-sources/`: `content-sources-registry.service.ts` (parse/validate, mirrors `parseCustomApiRegistry`), `providers/{content-provider.ts,github.provider.ts,gitlab.provider.ts}`, `content-sources-path.ts` (pure normalization), `content-sources-cache.service.ts`, `content-sources.service.ts`, `content-sources-admission.service.ts`, `content-sources-telemetry.ts`, controller, `dto/`. *Alternative:* extend `custom-api` — rejected: it proxies DIAL Core with the user's token; this proxies third-party hosts with server credentials, so the trust model differs.

2. **Provider interface** `listDocuments(source) → {entries, truncated}`, `readFile(source, path, maxBytes) → {text|bytes}`, `fileDate(source, path, mode) → Date|null`. Adapters receive an already-resolved source and credential; they never see request input except a normalized, root-validated path. Upstream URLs are built from `source.baseUrl` (validated https origin) plus encoded path segments; destination origin is asserted equal to `baseUrl` origin, as in `resolveCustomApiDestination`.
   - GitHub: `GET /repos/{owner}/{repo}/git/trees/{ref}?recursive=1` (truncated flag → partial list + warning); contents via `GET /repos/{r}/contents/{path}?ref=` with `Accept: application/vnd.github.raw`; dates via `GET /repos/{r}/commits?path=&sha=&per_page=1` (`updated` = latest commit; `created` = last page of `per_page=1` using the `Link` header).
   - GitLab: `GET /api/v4/projects/{url-encoded id or path}/repository/tree?recursive=true&per_page=100&page=n` (paginate via `x-next-page`, stop at the 200-document cap); files via `.../repository/files/{encoded path}/raw?ref=`; dates via `.../repository/commits?path=&ref_name=` (`created` = last page).

3. **Fetch wrapper** is shared: `AbortSignal.timeout(CONTENT_SOURCES_TIMEOUT_MS)`, `redirect: 'error'` so a redirect cannot leave the configured origin, streamed body read with a byte cap (rejecting early on `Content-Length` and while streaming). Error mapping happens in one place: 404→404, 401/403→502 with a credential-problem log (source id only; surfaced to telemetry as its own result category), except a 403 carrying `x-ratelimit-remaining: 0` or `Retry-After`, which is the upstream throttling us and maps to 503, abort/network→503, over-cap→502, other 5xx→502.

4. **Path handling** is a pure function: reject empty, absolute, backslash, NUL, percent-decoded variants that reintroduce those; `posix.normalize`; reject a result starting with `..`. Then containment check against the source root (documents) or `assetsPath` (assets). Malformed path → 400; well-formed but outside root, not matching `include`, or not found → 404. `include` is matched against the path relative to the source root by a small in-repo glob matcher (`*`, `?`, `**`, `{a,b}`) rather than `minimatch`: `minimatch` is only a transitive, override-pinned dependency in this repo, and the supported syntax is deliberately minimal. `assetsPath` default is `dirname(path)` for a file source and `path` for a directory source; configuration validation rejects an `assetsPath` that is not a valid repository-relative path. *Open point resolved:* release notes referencing `../images` work because `assetsPath` may be above `path`; the asset request path itself is resolved by the client against the document path, then normalized by the server.

5. **Caching** — a `ContentSourcesCacheService` over **dedicated** `cache-manager` instances, not the app-wide `CACHE_MANAGER` (an LRU of 100 small shared entries that one listing would evict). Two stores so bytes and metadata cannot evict each other: `meta` (listings and per-path dates; entries are small; capacity `64 sources × (200 documents + 1 listing)`, derived from the registry ceilings) and `content` (documents and assets; 128 entries, each at most 512 KiB, so at most 64 MiB; larger bodies are streamed through uncached). Key `content-sources:{sourceId}:{ref}:{kind}:{normalizedPath}`. Each entry stores `{value, storedAt}` with a physical TTL of `4 × CONTENT_SOURCES_CACHE_TTL_MS` and a logical freshness of `CONTENT_SOURCES_CACHE_TTL_MS`: past freshness we refresh; if the refresh throws, we return the stale value (except for an upstream 404, which is an answer) and log at warn. Single-flight is an in-process `Map<key, Promise>` removed in `finally`. A value may opt out of storing through a `cacheable` predicate.

6. **Listing assembly**: list tree → filter by `include`/root → apply cap (200) → fetch dates (if enabled) → read each document straight from the provider (1 MiB cap, not through the content cache, so a listing does not evict the documents readers open) to compute `title` (first H1 else file name); titles and dates live in the cached listing entry → sort (`name-*` numeric-aware via `Intl.Collator(undefined, {numeric:true})`; `date-desc` by date, nulls last, name tiebreak). `summaryHeading` is returned as-is in `feed`; extracting the section is the client's concern. A title or date that cannot be read for a non-fatal reason (upstream 404/5xx for one file) falls back to the file name or `null` and marks the listing **degraded**: it is served but not cached, so the next request retries instead of pinning the fallback for a full TTL. Credential and availability failures abort the listing instead. *Alternative considered:* lazily compute titles on the client — rejected: the contract in the request fixes `title` in the listing.

7. **Throttling** reuses the `custom-api` model: an in-process admission service (global 32 / per-user 4 in-flight, key `providerId:sub`) answering 429. `@nestjs/throttler` is not used because the existing request-rate guard, if any, is applied globally; this keeps content-source fan-out bounded by concurrency, as `custom-api` does. Values are constants, not env vars.

8. **Telemetry** copies `custom-api-telemetry.ts`: histogram `dial.chat.content_sources.call.duration` labelled by `source` (configured id, else `unknown`) and a result category enum (`success`, `not_found`, `bad_request`, `admission_rejected`, `upstream_credentials`, `upstream_error`, `unavailable`, `too_large`, `internal_error`) plus `operation`; stale-served is a separate counter `dial.chat.content_sources.stale_served` labelled by source (`list|document|asset`). No path, URL or token is recorded.

9. **Config** — `CONTENT_SOURCES_CONFIG` and `CONTENT_SOURCES_CREDENTIALS` are permissive strings in `integrations.env.ts` (parsed by the registry service so errors stay field-level, like `CUSTOM_CORE_API_CONFIG`); TTL and timeout are validated ints with the defaults. The registry service throws at construction, which fails Nest bootstrap. Neither value is added to client-config or `CUSTOM_CLIENT_VARIABLES`.

10. **Response headers**: asset sets `Content-Type` from a fixed extension→MIME map (not `mime-types` lookup on arbitrary input), `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=3600`, and the shared SVG CSP. The CSP constant currently lives in `themes/theme.controller.ts`; extract it to `common/` and reuse it from both controllers so the policies cannot drift.

11. **OpenAPI**: handlers named `getContentSource`, `getContentSourceDocument`, `getContentSourceAsset` (become SDK method names); `ApiResponse` for every status; asset documented as `application/octet-stream`-style binary with the allowed image types; run `npm run openapi`, `openapi:check`, then build/lint `chat-api-client`.

12. **Path validation is a denylist plus containment, not an allowlist `@Matches`.** `apps/chat-api/AGENTS.md` asks for an allowlist regex on strings that reach a URL segment. `path` is the exception: repository file names legitimately contain spaces and non-ASCII letters, so an allowlist would answer 400 for documents the listing itself returns. The boundary is `normalizeContentPath` (rejects absolute, backslash, control characters and root escapes; takes the framework-decoded value literally, so `%` is a file-name character, never an escape) followed by source-root and `include`/`assetsPath` containment, all before any upstream call. `sourceId` is likewise not pattern-matched so that every unconfigured id, even a malformed one, answers 404.

13. **Authorization is per session only.** Any authenticated user can read every configured source, including a private repository reached through the server token. There is no per-user or per-role filtering; an operator who needs one adds it in front of or in place of this module. The README states this.

## Risks / Trade-offs

- [Memory growth from cached assets/documents] → physical TTL bounds age; per-entry caps (1 MiB / 10 MiB); only cache assets ≤1 MiB, stream larger ones uncached.
- [GitHub tree truncation or 200-doc cap hides documents] → partial list + warning log; operators narrow `path`/`include`.
- [Rate limits on commit-date calls (N documents × 1–2 calls)] → concurrency 4, per-path cache, TTL 30 min, stale-if-error; `date: none` disables.
- [Per-process single-flight only] → multiple replicas may each fetch once per TTL; acceptable at this scale.
- [Upstream content is untrusted] → Markdown returned unchanged is only safe if the client sanitizes; documented in README; assets restricted to image types with nosniff and sandboxed SVG.
- [SSRF] → hosts only from validated operator config; redirects disabled; no request-derived host or scheme.
- [A leaked token in logs] → error paths log source id and status only; tests assert no token in logs.

## Migration Plan

Additive. Deploy with the two env vars unset (module serves 404s). Enable per environment by setting config and credentials; roll back by unsetting them. No data migration.
