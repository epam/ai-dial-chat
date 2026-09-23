## 1. Session expiration slice

Strategy: one vertical slice covering issuance, authorization, rotation, and configuration before documentation and final verification. Follow existing auth/config conventions; all imports remain extensionless. No library changes.

- [x] 1.1 Implement the expiration utility, v2 session shape, and validated configuration in `apps/chat-api/src/auth/session/session-expiration.ts`, `session.types.ts`, and `apps/chat-api/src/config/environment.config.ts`.
- [x] 1.2 Wire callback issuance, required/optional authentication, cookie cleanup, and refresh rotation in `apps/chat-api/src/auth/auth.controller.ts`, `strategies/cookie-session.strategy.ts`, and `refresh/refresh.service.ts`.
- [x] 1.3 Add unit regressions and update auth payload fixtures for the version boundary. Verification: `npm run test:file -- apps/chat-api/src/auth/session/tests/session-expiration.spec.ts apps/chat-api/src/auth/refresh/refresh.service.spec.ts apps/chat-api/src/auth/strategies/tests/cookie-session.strategy.spec.ts apps/chat-api/src/config/tests/validation.spec.ts`.
- [x] 1.4 Add login/replay/legacy integration regressions in `apps/chat-api/src/auth/auth.controller.spec.ts`. Verification: `npm run test:file -- apps/chat-api/src/auth/auth.controller.spec.ts apps/chat-api/src/auth/session/tests/session.service.spec.ts apps/chat-api/src/auth/tests/auth-metrics.spec.ts`, then `npm run verify:changed` once for the slice.

## 2. Documentation and completion

- [x] 2.1 Update `apps/chat-api/README.md`, `.env.template`, `docs/auth/auth-bff-encrypted-cookie.md`, affected auth diagrams, and `docs/architecture.md` to document deadlines, provider metadata, default, migration, and SSO behavior. Verification: `npm run validate:docs`.
- [x] 2.2 Run the five-axis quality review and resolve findings. Run `npm run verify:full` once and `npm run build:quiet`; record any unrelated blockers and validate this OpenSpec change.


## 3. Initial verification results (before the rolling-policy revision)

- Focused tests ran through `npm exec -- nx run chat-api:test -- <paths>` (the Nx equivalent of the listed file checks): 120 unit tests and 92 integration/session/metrics tests passed.
- `npm run verify:changed`: typecheck passed; lint identified import ordering and an inferred-type annotation. Both were fixed and the subsequent full lint passed.
- `npm run verify:full`: all project typechecks, lint, and formatting passed. Backend, Chat, and library tests passed. The overall command failed solely on `attachment-canvas-consumer-fixture:build` resolving Tabler `.mjs` imports; its dependent test/verify tasks could not run. This fixture and its dependencies were not modified by this change. Full log: `tmp/agent-logs/2026-09-22T19-23-00-497Z-test-full.log` (local, ignored).
- `npm run build:quiet`: passed for the affected backend and dependencies.
- `npm run validate:docs`: passed.
- Three affected Mermaid diagrams were regenerated with the installed Mermaid CLI and Chromium.
- `openspec validate fix-session-expiration --strict` and `git diff --check`: passed.

The five-axis self-review found and corrected a regression risk: upstream refresh failures must not erase another pod's successfully rotated cookie before the frontend recovery probe. Only locally invalid or expired sessions clear cookies; a regression assertion preserves this behavior. Correctness, readability, app/library boundaries, security, and constant-time deadline checks were reviewed. No UI or responsive changes apply. Documentation covers the breaking v2 migration and the initial eight-hour default (superseded below). The unrelated fixture build failure prevents claiming a fully green workspace verification.


## 4. Rolling-policy revision

- [x] 4.1 Use a configurable 30-day rolling lifetime, validate before renewal, and proactively refresh before session expiry in `config/environment.config.ts`, `auth/refresh/refresh.service.ts`, and `auth/strategies/cookie-session.strategy.ts`. Explicitly preserve cookies and deadlines after absorbed races.
- [x] 4.2 Verify real cookie renewal/replay, scope-independent login, missing tokens, optional reads, provider deadlines, and coalesced races. Verification: the four unit files listed in 1.3 (125 tests) and the three integration/session/metrics files listed in 1.4 (93 tests), through Nx, passed.
- [x] 4.3 Update lifetime docs, diagrams, and OpenSpec artifacts; run `npm run validate:docs` and strict OpenSpec validation.
- [x] 4.4 Apply the five-axis self-review to the revision; run `npm run verify:changed`, `npm run verify:full`, and `npm run build:quiet`, recording any unrelated workspace failures.


### Final revision verification

- Focused auth/config coverage passed: 125 initial unit tests and 93 integration/session/metrics tests. The final strategy suite (29 tests, including access expiry during absorbed-race bucket resolution) also passed in the full run and isolated recheck.
- `npm run verify:changed`: passed (affected typecheck, lint, and tests).
- `npm run build:quiet`: passed after the RefreshService dependency change.
- `npm run verify:full`: full typecheck and lint passed. Formatting found only `apps/chat-api/README.md`; corrected it with Prettier and its check passed. Ran the remaining `npm run test:full:quiet` phase separately.
- Full tests: all auth tests passed; backend reported 3692 passing tests and one failure in the untouched SkillsController integration suite (`limit=1001` expected 400, received 404). A targeted recheck passed that case but failed a different SkillsController case (`metadata` grouping-folder path expected 400, received 404). Its test app injects a user directly and does not register the auth module/guards; the failure is outside this change. No Skills code or tests were modified.
- The full workspace run also reproduced the existing `attachment-canvas-consumer-fixture:build` failure resolving Tabler `.mjs` imports; dependent fixture verification/test tasks did not run. This prevents claiming fully green workspace verification.
- Final full test log: `tmp/agent-logs/2026-09-22T19-47-35-723Z-test-full.log` (local, ignored). Targeted recheck: `/tmp/dial-session-rolling-recheck.log`.
- `npm run validate:docs`, strict OpenSpec validation, and `git diff --check`: passed. Updated Mermaid sources and regenerated the login/refresh SVGs; cookie structure is unchanged by the rolling revision.

The five-axis self-review confirms the 30-day rolling policy, validation before renewal, separate provider deadlines, stable CSRF, scope independence, optional reads without renewal, and no app/library boundary changes. An explicit refresh-result flag prevents coalesced losing requests from overwriting the winning cookie. A final access-token check rejects an absorbed race if the token expires during bucket lookup, while preserving the winning cookie. No extra cookie writes occur on the usual fresh-session request path. Documentation distinguishes this BFF's refresh-driven renewal from NextAuth's session-handler renewal and describes the v2 migration.

Out-of-scope follow-ups: repair the fixture's Tabler import resolution and investigate the intermittent SkillsController HTTP-status failures.
