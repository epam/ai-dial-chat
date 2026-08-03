## 1. HTTP-level idempotency test coverage

- [x] 1.1 In `apps/chat-api/src/user-config/tests/user-config.controller.integration.spec.ts`,
      add a `describe('PATCH /api/v1/user-config/toolsets — real service', ...)` block that
      builds the Nest app with a real `UserConfigService` instance (reusing the
      `makeDialClient()` / `makeSingleDownloadSpy()` / `makeUploadSpy()` / `getUploadedConfig()`
      helper pattern from `user-config.service.spec.ts`) instead of the mocked service used by
      the existing describe blocks in this file.
- [x] 1.2 Add a test: `PATCH /api/v1/user-config/toolsets` with the same `id` and
      `isInstalled: true` sent twice returns `204` both times, and the uploaded config's
      `toolsets.installed` contains the ID exactly once (TC-20).
- [x] 1.3 Add a test: `PATCH /api/v1/user-config/toolsets` with an `id` not present in
      `toolsets.installed` and `isInstalled: false` returns `204`, and the uploaded config's
      `toolsets.installed` is unchanged (TC-21).

## 2. CSRF external-testing documentation

- [x] 2.1 In `docs/auth/testing-current-auth-implementation.md`, remove/correct the stale
      "Not implemented yet: ... CSRF guard" line in the intro (the guard has shipped —
      `apps/chat-api/src/auth/csrf/csrf.guard.ts`).
- [x] 2.2 Add a new section (e.g. "Testing CSRF-protected mutation endpoints externally")
      documenting: obtaining the session cookie via the normal login flow, obtaining the
      current `X-CSRF-Token` from any prior authenticated response header (e.g.
      `GET /api/v1/auth/me`), and matching the `Origin`/`Referer` request header to
      `CORS_ORIGIN` — with a concrete example against `PATCH /api/v1/user-config/toolsets`
      (the endpoint from issue #7728) showing a 403 without the token/origin and 204/400 once
      supplied correctly.

## 3. Verification

- [x] 3.1 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`. (1577/1577 tests
      pass; lint clean apart from one pre-existing unrelated warning in `share.service.ts`.)
- [x] 3.2 Confirm the new tests fail if the real dedup/no-op logic in
      `updateInstalledEntry` is temporarily broken (sanity-check the tests actually exercise
      the real service, not the mock). Verified: temporarily replacing the dedup/no-op
      branches with unconditional `ids.push(id)` made both new tests fail (alongside four
      pre-existing unit tests), then reverted cleanly (`git diff` empty) and all tests pass
      again.
