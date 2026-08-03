## Why

Issue #7728 reports that `PATCH /api/v1/user-config/toolsets` returns `403 Forbidden —
"Origin check failed"` when called from Postman/curl, blocking QA from independently
exercising test cases TC-18 through TC-23. Investigation shows the 403 is the intended
behavior of `CsrfGuard` (`apps/chat-api/src/auth/csrf/csrf.guard.ts`) protecting a mutating,
session-authenticated endpoint — it is not a defect to fix in the guard, and the endpoint
must stay both session- and CSRF-protected. The real gaps are:

1. **No documented procedure** for exercising a CSRF-protected mutation endpoint from an
   external HTTP client. `docs/auth/testing-current-auth-implementation.md` still says "Not
   implemented yet: ... CSRF guard", which is stale — the guard has since shipped
   (`csrf.guard.ts`) but the doc was never updated with guidance for testing against it.
2. **Two spec-documented scenarios have no HTTP-level test proof.** The `user-config-toolset-management` spec already documents "Installing an already-installed toolset is idempotent" (TC-20) and "Uninstalling a missing toolset ID is a no-op" (TC-21), but the existing
   `user-config.controller.integration.spec.ts` mocks `UserConfigService`, so these two
   scenarios are only verified at the unit level (`user-config.service.spec.ts`), never
   through the real HTTP path with the real service wired in.

Issue #7728 also raised a claimed `is_installed` (snake_case) vs. `isInstalled` (camelCase)
field-naming mismatch, referencing #7727. Investigation found no snake_case usage anywhere in
current code (DTO, service, or spec) for this endpoint — `UpdateInstalledDto.isInstalled` is
camelCase throughout, consistent with `openspec/specs/user-config-toolset-management/spec.md`.
This finding is not actionable against current code; no naming fix is proposed here.

## What Changes

- Update `docs/auth/testing-current-auth-implementation.md`: correct the stale "CSRF guard
  not implemented yet" line, and add a new section documenting how to exercise a
  CSRF-protected mutation endpoint from an external HTTP client (obtaining the session
  cookie and `X-CSRF-Token` via `GET /api/v1/auth/me`, and matching the `Origin`/`Referer`
  header to `CORS_ORIGIN`), so QA has a supported path to run TC-18–TC-23 against a real
  deployment without needing a guard bypass.
- Add HTTP-level integration test coverage in
  `apps/chat-api/src/user-config/tests/user-config.controller.integration.spec.ts` (or a
  sibling spec wiring the real `UserConfigService`) for:
  - TC-20: installing an already-installed toolset ID does not duplicate it in
    `toolsets.installed`.
  - TC-21: uninstalling a toolset ID that is not present is a 204 no-op that leaves
    `toolsets.installed` unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-config-toolset-management`: no behavior changes to the endpoint itself; adds an
  explicit "tests cover this surface end-to-end" requirement (mirroring the existing
  `spa-auth-session` spec's "Tests cover the auth integration surface" pattern) naming the
  HTTP-level idempotency/no-op scenarios that must be proven through the real service, not a
  mocked one.

## Impact

- `docs/auth/testing-current-auth-implementation.md` — doc update, no behavior change.
- `apps/chat-api/src/user-config/tests/user-config.controller.integration.spec.ts` (or a new
  sibling spec) — new/extended tests only, no production code change.
- No change to `apps/chat-api/src/user-config/user-config.controller.ts`,
  `user-config.service.ts`, `update-installed.dto.ts`, or `CsrfGuard`.
