## Why

`GET /api/v1/toolsets/:toolsetName` validates the path parameter against `DEPLOYMENT_ID_PATTERN`, which explicitly allows `.` and `/` in the character class. As a result a path-traversal payload such as `..%2Fetc%2Fpasswd` (Express decodes it to `../etc/passwd` before the DTO validator runs) passes validation, reaches the DIAL Core lookup, and returns `404 Not Found` instead of the `400 Bad Request` the existing spec (`openspec/specs/toolset-lookup/spec.md`, "Toolset name path parameter validation") already requires. Reported in GitHub issue #7925.

The sibling route `GET /api/v1/deployments/:deployment/limits` was checked against the same issue report and is unaffected — it already uses `@IsSafeDeploymentId()` (added in #8140) and has a passing integration test proving traversal payloads are rejected with `400` before any upstream call. No change is needed there; that part of the issue reflects a report against a pre-#8140 commit.

## What Changes

- Add a new `IsSafeToolsetName` validator (`apps/chat-api/src/common/validators/safe-toolset-name.validator.ts`) that keeps `DEPLOYMENT_ID_PATTERN`'s existing character allowlist (still blocks `;`, `,`, `{`, `}`, `&`, whitespace, etc.) but additionally rejects any `/`-delimited path segment that is empty, `.`, or `..` — closing the traversal gap while still accepting the legitimate `/`-containing custom-toolset path format (`toolsets/{bucket}/{path}`, used by `ToolsetsService.parseDialToolsetResource`). A slash-free allowlist (mirroring the `models` route) was considered and rejected during design — it would reject legitimate custom-toolset lookups.
- Replace `@Matches(DEPLOYMENT_ID_PATTERN)` with `@IsSafeToolsetName()` on `GetToolsetDto.toolsetName` (`apps/chat-api/src/toolsets/dto/get-toolset.dto.ts`). This DTO is also used by the `PATCH`/`DELETE`/`login`/`logout` toolset routes, so the fix applies there too.
- Add a regression test asserting `GET /api/v1/toolsets/..%2Fetc%2Fpasswd` returns `400 Bad Request` and never invokes the toolsets service/DIAL Core call, plus a test confirming a legitimate slash-containing name still passes.
- No change to `apps/chat-api/src/deployments/dto/get-deployment.dto.ts` — its existing `@IsSafeDeploymentId()` validation is correct and already covered by tests.
- **Explicitly out of scope**: `DEPLOYMENT_ID_PATTERN` itself carries the same latent traversal exposure in three other DTOs (`applications/dto/get-application.dto.ts`, `external-services/dto/get-external-service.dto.ts`, `conversations/dto/create-conversation.dto.ts`). These are not part of GitHub issue #7925 and are not fixed here — flagged as a candidate follow-up.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `toolset-lookup`: "Toolset name path parameter validation" requirement is corrected. The previous wording (`Allowed characters: [a-zA-Z0-9_\-.:@]`, no slash) was itself wrong — it contradicted the toolset service's own `/`-separated custom-toolset path format — and was never actually enforced by the implementation either. The corrected requirement keeps `/` allowed for legitimate paths and instead rejects empty/`.`/`..` path segments, and states explicitly that validation runs after URL-decoding.

## Impact

- `apps/chat-api/src/common/validators/safe-toolset-name.validator.ts` — new validator (new file).
- `apps/chat-api/src/toolsets/dto/get-toolset.dto.ts` — validator swap on `toolsetName`.
- `apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts` — add traversal-rejection and slash-legitimate-name test cases.
- No frontend, DTO contract (field names/shapes), or OpenAPI schema changes.
