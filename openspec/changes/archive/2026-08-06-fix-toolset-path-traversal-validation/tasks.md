## 1. Validator

- [x] 1.1 Add `IsSafeToolsetName` decorator (`apps/chat-api/src/common/validators/safe-toolset-name.validator.ts`) that composes the existing `DEPLOYMENT_ID_PATTERN` character allowlist with a segment check rejecting empty/`.`/`..` path segments. (Revised from the original plan of a slash-free regex — that would have broken legitimate `/`-containing custom-toolset paths; see design.md Decisions.)
- [x] 1.2 In `apps/chat-api/src/toolsets/dto/get-toolset.dto.ts`, replace `@Matches(DEPLOYMENT_ID_PATTERN)` with `@IsSafeToolsetName()` on `toolsetName`.

## 2. Tests

- [x] 2.1 In `apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts`, add a case asserting `GET /api/v1/toolsets/..%2Fetc%2Fpasswd` returns `400 Bad Request` and that the toolsets service method is never called.
- [x] 2.2 Add/extend cases confirming existing valid names still pass: `my-toolset`, `folder.toolset-v1`, `@org/toolset:tag`, plus a new case for the legitimate slash-containing custom-toolset path `toolsets/bucket/folder/toolset-name`.
- [x] 2.3 Ran `npm exec nx test chat-api` — all 106 chat-api toolsets tests pass (31 controller tests including the 4 new/changed cases).

## 3. Verification

- [x] 3.1 Ran `npm exec nx lint chat-api` — 0 errors (2 pre-existing warnings unrelated to this change).
- [x] 3.2 Verified via the existing supertest-driven integration test suite (exercises the full pipeline: `ValidationPipe`, URI versioning, global prefix) that `GET /api/v1/toolsets/..%2Fetc%2Fpasswd` returns `400`, not `404`, and never calls the toolsets service. A live `npm run start:api` + curl/session-cookie run was not performed (no test session infra in this environment) — the integration test is the equivalent evidence.
- [x] 3.3 Ran `npm exec nx test chat-api -- deployments` — all 126 deployments tests pass, including the existing `GET /api/v1/deployments/..%2Fetc%2Fpasswd/limits` → `400` case, confirming that route needs no change (second half of GitHub issue #7925 is already fixed by #8140).
