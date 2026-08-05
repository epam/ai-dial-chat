## Context

`user-config.controller.integration.spec.ts` exercises `PATCH /api/v1/user-config/toolsets`
through `supertest` against a real Nest app, but with `UserConfigService` fully mocked
(`vi.fn()` for every method). That proves the controller wires request → service call
correctly and that the DTO validation rejects bad bodies, but it cannot prove the two
idempotency scenarios already documented in
`openspec/specs/user-config-toolset-management/spec.md` ("Installing an already-installed
toolset is idempotent", "Uninstalling a missing toolset ID is a no-op"), because the mock
never runs the real dedup logic in `updateInstalledEntry`. That logic is only unit-tested
against `UserConfigService` directly today.

Separately, issue #7728's reporter hit the CSRF `Origin` check while trying to hand-test this
endpoint from Postman. `docs/auth/testing-current-auth-implementation.md` is the project's
one auth-testing runbook, but it predates the CSRF guard shipping and still says "Not
implemented yet: ... CSRF guard" — so there is no supported, documented path for QA to drive
a mutation endpoint externally.

## Goals / Non-Goals

**Goals:**
- Add HTTP-level (real-service, not mocked) coverage proving TC-20 (idempotent install) and
  TC-21 (uninstall no-op) against `PATCH /api/v1/user-config/toolsets`.
- Correct the stale CSRF-guard line in `docs/auth/testing-current-auth-implementation.md` and
  add a documented procedure for exercising a CSRF-protected mutation endpoint from an
  external HTTP client (Postman/curl), so QA is not blocked by the 403.

**Non-Goals:**
- Changing `CsrfGuard`, adding a bypass, or exempting any mutation endpoint from CSRF/Origin
  checks — the 403 is correct, intended behavior for a request lacking a valid CSRF token and
  matching origin.
- Any change to the `is_installed`/`isInstalled` field naming — investigation found the field
  is camelCase (`isInstalled`) consistently across the DTO, service, and spec; the reporter's
  premise does not reproduce against current code.

## Decisions

- **New tests live in a real-service describe block, not a new file.** Add a second
  `describe('PATCH /api/v1/user-config/toolsets — real service', ...)` block inside the
  existing `user-config.controller.integration.spec.ts`, building the Nest app with the real
  `UserConfigService` wired to a stubbed storage/config backend (matching whatever pattern
  `user-config.service.spec.ts` already uses to fake the underlying config read/write), rather
  than adding a new spec file. This keeps both the mocked-service DTO/wiring tests and the
  real-service behavior tests colocated and discoverable together, since they cover the same
  controller/route. Alternative considered: promote the existing `updateInstalledEntry` unit
  tests in `user-config.service.spec.ts` to be "the" proof — rejected because the issue
  specifically asks for confidence at the HTTP layer (this is what an external QA test case
  exercises), and a passing unit test would not by itself demonstrate the full request path
  (DTO validation, guard order, HTTP status) behaves correctly end-to-end.
- **Spec change is additive only.** Add a new requirement to
  `openspec/specs/user-config-toolset-management/spec.md` following the exact pattern of
  `spa-auth-session`'s "Tests cover the auth integration surface" requirement, naming the two
  scenarios that must be proven through the real service. No existing requirement text
  changes.
- **CSRF testing guidance goes in `docs/auth/testing-current-auth-implementation.md`, not a
  new spec.** This is operational/testing guidance (how to obtain a token and call an
  endpoint), not a statement about system behavior, so it belongs in the existing auth-testing
  runbook alongside the other manual/negative-case sections, not in an OpenSpec capability
  spec.

## Risks / Trade-offs

- [Risk] Wiring the real `UserConfigService` into the controller integration spec requires
  faking whatever storage/config layer the service depends on (e.g. a DIAL Core-backed config
  read/write) — if that dependency is awkward to stub at the HTTP layer, the added tests could
  become brittle or slow. → Mitigation: reuse the exact fake/stub pattern already established
  in `user-config.service.spec.ts` for `readConfig`/`writeConfig`, rather than inventing a new
  one.
