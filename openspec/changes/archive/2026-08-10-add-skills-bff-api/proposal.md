## Why

DIAL Core exposes a Skills resource (`ResourceType.SKILL`, confirmed in the SDK schema — `node_modules`-equivalent sibling checkout `ai-dial-typescript-sdk/src/schema.ts:3897,3929`) with a full CRUD + grouping-folder API, but `apps/chat-api` has no domain that proxies it. Skills cannot currently be listed, downloaded, uploaded, deleted, organized into grouping folders, shared, or published through the BFF. The frontend has no way to build a skills UI because there is no server-side contract to build against, and the browser must never hold a DIAL Core access token to call Core directly (see `docs/` auth architecture, session-cookie BFF pattern already used by `apps/chat-api/src/files/`, `apps/chat-api/src/deployments/`).

**Problem**: no authenticated, versioned BFF surface exists for any skill operation.

**Solution**: add a `apps/chat-api/src/skills/` domain, following the same facade + focused-services architecture already proven for `apps/chat-api/src/deployments/` (see `openspec/specs/deployments-toolsets-service-decomposition/spec.md` and `apps/chat-api/src/deployments/deployments.service.ts:1-47`) and the same streaming/multipart conventions already proven for `apps/chat-api/src/files/` (`apps/chat-api/src/files/download/files-download.service.ts`, `apps/chat-api/src/files/upload/files-upload.service.ts`). Ten operations under `/api/v1/skills` cover list, list-files, download, upload, delete, per-file download/upload/delete, and grouping-folder create/delete, plus a documented negative contract for grouping-folder download.

This is spec-only: this change produces `proposal.md`/`design.md`/`tasks.md`/delta specs. No production code is implemented here.

## What Changes

- **New `apps/chat-api/src/skills/` domain** — `SkillsController`, thin `SkillsService` facade (bound-property delegation, <150 lines, mirroring `apps/chat-api/src/deployments/deployments.service.ts:14-47`), and four-to-five focused injectable services: `SkillsListingService`, optionally `SkillsLookupService`, `SkillsUploadService`, `SkillsDownloadService`, `SkillsMutationService`.
- **10 new endpoints** under `/api/v1/skills`: `listSkills`, `listSkillFiles`, `downloadSkill`, `uploadSkill`, `deleteSkill`, `downloadSkillFile`, `uploadSkillFile`, `deleteSkillFile`, `createSkillGroupingFolder`, `deleteSkillGroupingFolder`. `downloadSkillGroupingFolder`'s only defined success case in the verified SDK schema is none — it has no `200` response at all (only `400`/`403`/`500`); it is covered as a rejection branch of `downloadSkill`, never exposed as its own browser-facing route.
- **SDK upgrade (described, not executed here)**: `@epam/ai-dial-typescript-sdk` from the currently pinned `0.1.0-dev.31` (root `package.json:` / `apps/chat-api/package.json:` — both pin `"@epam/ai-dial-typescript-sdk": "0.1.0-dev.31"`) to `0.1.0-dev.35`, the newest version published to the npm registry as of this analysis (registry dist-tag `development` → `0.1.0-dev.35`, published 2026-08-04; the `latest` dist-tag is stale at `0.1.0-dev.21` and MUST NOT be used for this pin). Verified against a local checkout of the SDK source repository (`ai-dial-typescript-sdk` sibling directory, commit `fa8daa7`) which already contains all 11 skill operations in `src/client.ts`, `src/api-paths.ts`, and `src/schema.ts`.
- **Focused `dial-error.mapper.ts` fix**: `mapDialHttpStatus` (`apps/chat-api/src/common/dial/dial-error.mapper.ts:28-66`) does not special-case `405`, `412`, or `422` — they currently fall through to a generic `BadGatewayException` (502). The verified skill operations return real `405` (invalid operation for a resource kind), `412` (ETag precondition mismatch), and `422` (Core resource validation failure) responses, so this change adds explicit mappings (`MethodNotAllowedException`, `PreconditionFailedException`, `UnprocessableEntityException`) with regression tests, shared by every existing caller of the mapper (no other domain's mapped behavior changes).
- **Generated-client integration**: Swagger DTOs for all 10 operations flow into `libs/chat-api-client/openapi.json` via `npm run openapi`; a new `skillsApi` singleton in `apps/chat/src/server-api/api-client.ts`; a thin `apps/chat/src/server-api/skills.api.ts` wrapper, using `Raw` generated methods for binary downloads and ETag-returning mutations (mirrors `apps/chat/src/server-api/files.api.ts:98-108`, `147-154`).
- **Sharing/publication touch points (narrow, additive)**: `apps/chat-api/src/share/share.service.ts`'s `RESOURCE_KIND_BY_PREFIX` table (`share.service.ts:33-37`) gains a `['skills/', 'SKILL']` entry; `DiscardSharedCatalogItemDto`'s `@Matches` allowlist (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts:5-6`) gains `skills`; `CatalogEntityType` (`apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts:6-10`) gains a `Skill` member. Skills remain whole-resource units for both flows — no per-file share/publish path is added. Cross-domain consumers (`ShareService`, `PublishService`) depend on `SkillsLookupService` directly if a verified consumer need is confirmed during implementation (see design.md D9) — never on the full `SkillsService` facade, matching the `deployments-toolsets-service-decomposition` pattern (`ToolsetsListingService` → `DeploymentsDetailsService` directly).
- **No skill-management UI** — out of scope. No React components, i18n strings, RTL work, or accessibility changes; no existing UI consumer to migrate (verified no `skills` references exist in `apps/chat/src/` UI code, see design.md D10).
- **Not BREAKING** — this adds new routes, a new SDK version pin, and additive DTO/enum members. No existing endpoint's request/response shape, status-code mapping, or route changes. `mapDialHttpStatus`'s 405/412/422 additions are additive for currently-unmapped inputs; every previously-mapped status (400/401/403/404/409/413/429/5xx) is unchanged, verified by the existing `dial-error.mapper.spec.ts` regression suite staying green.

## Capabilities

### New Capabilities

- `skills-bff-api`: the full `/api/v1/skills` BFF contract — 10 operations, request/response DTOs, HTTP/concurrency semantics (ETag, `If-Match`), multipart upload contract, path-validation rules, status-code mapping, rate limits, and the `downloadSkillGroupingFolder` negative-contract behavior.
- `skills-service-decomposition`: the facade-plus-focused-services ownership map for the skills domain (`SkillsListingService`, optional `SkillsLookupService`, `SkillsUploadService`, `SkillsDownloadService`, `SkillsMutationService`, thin `SkillsService` facade), mirroring `deployments-toolsets-service-decomposition`.

### Modified Capabilities

- `dial-error-mapping`: `mapDialHttpStatus` gains explicit `405`/`412`/`422` mappings (new scenarios only; no existing mapped status changes — delta uses `ADDED Requirements`).
- `generated-api-client-integration`: adds a `skillsApi` singleton and documents the `Raw`-method usage pattern for skill binary/ETag operations, alongside the existing `modelsApi`/`deploymentsApi`/`conversationsApi`/`filesApi` singletons.
- `catalog-unshare`: `DiscardSharedCatalogItemDto`'s itemId allowlist is extended to accept `skills/{bucket}/{path}` so a shared skill's recipient can discard access through the existing generic endpoint.
- `catalog-publish-api`: `CatalogEntityType` gains a `Skill` member so a whole skill can be published to the Organization/public bucket through the existing generic endpoint, with an explicitly flagged open question on version/name resolution (skills don't follow the `{name}__{version}` resource-id convention other catalog entities use — see design.md D8).

## Impact

- **New code**: `apps/chat-api/src/skills/` (controller, facade service, `listing/`, `upload/`, `download/`, `mutation/`, optional `lookup/`, `dto/`, `utils/`, module, and matching `tests/` files per `apps/chat-api/AGENTS.md` §1 layout).
- **Modified code**: `apps/chat-api/src/app/app.module.ts` (register `SkillsModule`); `apps/chat-api/src/common/dial/dial-error.mapper.ts` (+405/412/422); `apps/chat-api/src/share/share.service.ts` + `dto/discard-shared-catalog-item.dto.ts`; `apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts`; root `package.json` / `apps/chat-api/package.json` / `package-lock.json` (SDK version bump — described only, not executed in this change); `.env.example` / `apps/chat-api/README.md` (new ingress-limit env vars); `apps/chat/src/server-api/api-client.ts` (new singleton) and new `apps/chat/src/server-api/skills.api.ts`.
- **Generated artifacts**: `libs/chat-api-client/openapi.json` and generated `SkillsApi`/model classes, via `npm run openapi` + `npm run openapi:check`.
- **No impact**: no database, no persistence schema, no existing endpoint's contract, no UI/i18n/RTL/accessibility surface, no feature flag (skills endpoints are available to all authenticated users, matching `file-list`'s "not gated" precedent).
- **Dependency impact**: bumps a pre-release (`dev.N`) SDK dependency — inherently less stable than a semver-tagged release; mitigated by pinning an exact verified version (never a floating range) and running full `chat-api` test/lint/build/OpenAPI-diff verification before merge (see tasks.md Slice 1 and Final Verification).
- **Caching decision**: no caching for skill metadata or binary content in this initial implementation — skill data is user-scoped, permission-sensitive, mutable, and already has ETag-based concurrency control from DIAL Core; caching it would either leak stale permission state or require an invalidation story with no clear trigger event yet (unlike `deployments:list:*`, which is invalidated on a well-known share-accept event). Revisit only if a future change identifies a concrete hot-path (see design.md D7).
- **i18n impact**: none — no user-visible strings; this is a backend-only, UI-less change.
- **Feature-flag impact**: none — no `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` gating, matching the `file-list` precedent (`openspec/specs/file-list/spec.md:69`, "Not gated ... available to all authenticated users").

## Acceptance Criteria

1. All 10 endpoints exist under `/api/v1/skills`, versioned per `apps/chat-api/AGENTS.md` §2, each backed by exactly one focused service method reached through the `SkillsService` facade.
2. `downloadSkillGroupingFolder` is never exposed as an independently browsable route; requesting `downloadSkill` for a path that resolves to a grouping folder returns `400` with a message directing the caller to `listSkills`/`listSkillFiles`.
3. `mapDialHttpStatus` correctly maps `405`, `412`, and `422` with dedicated unit tests, and all pre-existing status mappings remain covered by regression tests that still pass unmodified.
4. Multipart upload validates: absolute paths, empty segments, `.`/`..`, NUL/control characters, `.dial-resource`, `.dial-folder`, reserved segments `files`/`v`, duplicate relative paths, and attempted deletion of `SKILL.md` — each with a rejection unit test.
5. Whole-skill and single-file downloads never buffer the full body in Node memory — `Readable.fromWeb` + `pipeline` + response destruction on failure + upstream `AbortSignal` cancellation on client disconnect, mirroring `apps/chat-api/src/files/files.controller.ts:597-618` / `apps/chat-api/src/files/download/files-download.service.ts`.
6. `ETag`/`If-Match` are forwarded exactly where the verified SDK schema declares support (see design.md D2 — NOT on `createSkillGroupingFolder`, which the schema declares with no request headers at all).
7. Sharing (`create-share-link`, accept-invitation, discard) and publication (`publish`, `publish-history`) both accept a `skills/{bucket}/{path}` whole-resource URL end-to-end, exercised by tests; no per-file share/publish path exists.
8. Every new/changed endpoint has a `chat-api-client` OpenAPI operation with strong types (no `any`), verified by `npm run openapi:check` and manual inspection of generated binary/multipart shapes.
9. `npm exec nx test|lint|typecheck|build chat-api`, `npm run openapi`, `npm run openapi:check`, `npm exec nx build|lint|typecheck chat-api-client`, and the final `nx affected` run against `origin/development-1.0` all pass.

## Alternatives Considered

**A. Path-segment routes (`/api/v1/skills/:bucket/:path/files/:filePath`) instead of query parameters.**
Rejected: skill and file paths may contain `/`, which is exactly the same problem the existing `file-download`/`file-list` BFF already solved with query parameters (`openspec/specs/file-download/spec.md:10`, `apps/chat-api/src/files/files.controller.ts:579-618`). Path segments would require ad-hoc wildcard route matching and double-encoding gymnastics for every nested skill/file path; query parameters need no such handling and keep the skills domain consistent with its closest sibling domain. Rejected on consistency + complexity grounds.

**B. Multipart `files[]`/`relativePaths[]` array contract for whole-skill upload (as originally specified in the task brief) vs. the verified SDK's single `file` (ZIP) field.**
The task brief's assumed contract does not match the verified SDK/OpenAPI schema: `uploadSkillFolder`'s `requestBody` is `multipart/form-data: { file: string (binary) }` — a single field, symmetric with `downloadSkillFolder`'s single `application/zip` response body (`ai-dial-typescript-sdk/src/schema.ts:17420-17427` vs. `17326-17329`). Per the task's own tie-breaking rule ("If the issue text and the released SDK/OpenAPI contract disagree, the released SDK/OpenAPI contract wins"), this proposal adopts the verified single-ZIP-file contract and documents the discrepancy explicitly (design.md D1) rather than inventing an array contract Core does not accept. `uploadSkillFile` (single in-skill file) genuinely does take one `file` field per the schema, which does match the brief.

**C. A separate `SkillsGroupingFolderService` for `createSkillGroupingFolder`/`deleteSkillGroupingFolder` vs. folding them into `SkillsMutationService`.**
Rejected for the same reason `deployments-toolsets-service-decomposition` folded toolset auth into `ToolsetsAuthService` only where it had genuinely separate state — grouping-folder create/delete share no state, no caching, and no additional dependency with `deleteSkill`/`deleteSkillFile`; they are structural mutations like any other delete. A dedicated service would be "another forwarding layer" the task brief explicitly warns against. Kept in `SkillsMutationService`.

**D. Caching skill listings (like `deployments:list:*`, 30s TTL) vs. no caching.**
Rejected for this initial implementation: `deployments:list:*` caching has a well-defined invalidation trigger (share-accept). No equivalent trigger exists yet for skills, and skill content changes (upload/delete) originate from the same BFF that would need to invalidate its own cache — a correctness-sensitive design decision better made once real usage patterns are observed. A conservative no-cache baseline avoids serving stale permission-sensitive data. Revisit if profiling shows list latency is a problem.

## Compatibility and Rollback

**Compatibility**: fully additive at the HTTP contract level — no existing route, DTO, or generated-client method changes shape. The `dial-error.mapper.ts` change is additive for previously-unmapped status codes only.

**Rollback**: because every change is additive, rollback is a straightforward revert of this change's commits: remove `SkillsModule` from `app.module.ts`, delete `apps/chat-api/src/skills/`, revert the `dial-error.mapper.ts`/`discard-shared-catalog-item.dto.ts`/`catalog-entity-params.dto.ts` diffs, revert the SDK version pin, and regenerate `chat-api-client` from the pre-change OpenAPI spec. No data migration, no persisted state, and no frontend UI consumes these endpoints yet, so rollback carries no user-facing risk.

## Security Impact

- The DIAL Core access token is never exposed to the browser; every skill operation is proxied server-side using the authenticated session's bearer token (`getBearerAuthHeaders`, matching every existing domain).
- Every path/file-path/bucket/multipart-filename input is validated against the reserved-marker and traversal rules in design.md D4 before being forwarded to DIAL Core or interpolated into a multipart boundary/filename.
- Upload ingress limits (max file count is not applicable — single-ZIP-file contract — but max bytes per upload and transfer timeout apply) bound resource exhaustion, matching `file-upload`'s `FILE_UPLOAD_MAX_BYTES`/`FILE_TRANSFER_TIMEOUT_MS` precedent.
- DIAL Core remains the sole authorization authority for bucket/skill access — the BFF performs no authorization decisions of its own beyond "does this session have a valid access token."
- No internal Core error payloads, tokens, multipart bodies, or file contents are logged (matches `apps/chat-api/AGENTS.md` §"Never log tokens...").

## Dependency Impact

Bumps `@epam/ai-dial-typescript-sdk` (pre-release channel) from `0.1.0-dev.31` to `0.1.0-dev.35` in root `package.json` and `apps/chat-api/package.json` (described in tasks.md Slice 1; not executed by this spec-only change). This is a pre-release/dev-tagged dependency, so the usual semver compatibility guarantee does not apply — mitigated by: (1) pinning an exact version rather than a range, (2) verifying via the sibling SDK source checkout that no skill-adjacent operation used elsewhere in `chat-api` (`getModel`, `getApplication`, `getToolset`, `listDeployments`, etc.) changed shape between `dev.31` and the `fa8daa7` commit corresponding to `dev.35`, and (3) running the full `chat-api` test suite (which exercises every existing SDK call site) before merge.

## Caching Decision

See "Caching decision" under Impact above and design.md D7 — no caching in this initial implementation.

## i18n Impact

None. Backend-only change; no user-visible strings, no UI surface.

## Feature-Flag Impact

None. Not gated behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`, matching the `file-list` precedent.
