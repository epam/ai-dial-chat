# Tasks

## 1. Configuration and registry

- [x] 1.1 Add `CONTENT_SOURCES_CONFIG`, `CONTENT_SOURCES_CREDENTIALS`, `CONTENT_SOURCES_CACHE_TTL_MS`, `CONTENT_SOURCES_TIMEOUT_MS` to `config/env/integrations.env.ts` and the snapshot in `config/tests/environment-composition.spec.ts`; verify `npm exec nx test chat-api` passes the composition spec and the vars are absent from client-config
- [x] 1.2 Implement the registry service (closed schema, defaults, credential cross-check, field-only error messages) and register it; verify with a registry spec covering valid/empty/duplicate id/non-https/unknown field/missing credential/malformed JSON/no secrets in errors
- [x] 1.3 Document the env vars in `apps/chat-api/.env.template` (public examples `github.com/epam` and `gitlab.example.com` only) and the `apps/chat-api/README.md` env table; run `npm run validate:docs`

## 2. Path safety and provider adapters

- [x] 2.1 Implement path normalization/containment and `include`/`assetsPath` matching with a small in-repo glob matcher (no new dependency); verify with a path-safety spec (absolute, backslash, NUL, `..`, encoded variants, `./` equivalence)
- [x] 2.2 Implement the shared fetch wrapper (timeout, no redirects, byte cap, error mapping, auth header per provider); verify with specs for 401/403/404/timeout/oversize and that no token reaches logs
- [x] 2.3 Implement the GitHub adapter (tree incl. truncated flag, raw contents, commit dates); verify with mocked-`fetch` specs for pagination, truncation warning, created/updated dates
- [x] 2.4 Implement the GitLab adapter (paginated tree, raw files, commit dates, encoded project id/path); verify with mocked-`fetch` specs for pagination, dates, group/sub/project encoding

## 3. Cache and service

- [x] 3.1 Implement the cache service (key by source+ref+path, single-flight, stale-if-error, per-path date entries, concurrency ≤ 4 limiter); verify with specs for single upstream call under concurrent requests, stale served on refresh failure, TTL expiry
- [x] 3.2 Implement the content-sources service (listing assembly: titles, sort numeric-aware, 200 cap, dates; document and asset reads; asset extension allowlist); verify with service specs for each sort mode, file vs directory, `date: none`

## 4. HTTP surface

- [x] 4.1 Add the admission service and telemetry (bounded labels, result categories); verify 429 without upstream call and that unknown ids collapse to one label
- [x] 4.2 Extract the SVG CSP constant to `common/` and reuse it in `themes/theme.controller.ts` and the new controller; verify existing theme specs still pass
- [x] 4.3 Add DTOs, controller (`/api/v1/content-sources/...`, versioned, full `@ApiResponse` set, handler names per design) and `ContentSourcesModule`, import it in `AppModule`; verify with supertest specs for 401, unknown source 404, 400 on bad paths, 404/502/503 mappings, document body unchanged, asset headers (Content-Type, nosniff, Cache-Control, SVG CSP)
- [x] 4.4 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`; verify the three operations appear with the expected SDK method names and no generated file is hand-edited

## 5. Documentation and integration

- [x] 5.1 Add a README section on token scopes (GitLab `read_api`, GitHub Contents read), egress hosts, Markdown-sanitization expectation for clients, and the config example; run `npm run validate:docs`
- [x] 5.2 Update `docs/architecture.md` (new `content-sources` backend domain and controller base path); run `npm run validate:docs`
- [ ] 5.3 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`, and `npm run validate:specs`; verify all pass and start the app with config unset (404) and with a sample config (listing resolves against a mocked upstream)
