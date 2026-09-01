## 1. Backend validation

- [x] 1.1 In `apps/chat-api/src/config/environment.config.ts`, replace the `@IsUrl` + `@Matches` pair on `ALLOWED_IFRAME_ORIGINS` with a single `@Matches(IFRAME_ORIGIN_PATTERN, { each: true, message: ... })` using the regex from design.md, exported as a named constant so `validation.spec.ts` can reference it if useful.
- [x] 1.2 Update `apps/chat-api/src/config/validation.spec.ts`: add cases for an accepted wildcard entry (`https://*.example.com`), a mixed exact+wildcard list, a rejected bare wildcard (`https://*`), a rejected non-leftmost wildcard (`https://foo.*.example.com`), and a rejected wildcard-with-path (`https://*.example.com/embed`). Keep existing exact-origin cases passing unchanged.
- [x] 1.3 Run `npm exec nx test chat-api -- --testFile=src/config/validation.spec.ts` (or the equivalent `test:file` script) and confirm green.

## 2. Frontend origin matching

- [x] 2.1 Create `apps/chat/src/utils/overlay-origin.ts` exporting `matchesAllowedOrigin(origin: string, allowedOrigins: string[]): boolean` per design.md's algorithm (exact match for non-wildcard entries; scheme + host/port suffix match for `*.`-prefixed entries).
- [x] 2.2 Add `apps/chat/src/utils/tests/overlay-origin.spec.ts` (or co-located per existing utils test convention) covering: exact match still works, wildcard matches direct subdomain, wildcard matches nested subdomain, wildcard does not match the bare apex domain, wildcard does not match a different scheme, non-matching entry returns false, empty allowlist returns false.
- [x] 2.3 In `apps/chat/src/context/overlay/OverlayContext.tsx`, replace both `overlayAllowedOrigins.includes(origin)` call sites (`isTrustedHostOrigin` around line 429-431, and the check inside `handleSetOverlayOptions` around line 824) with `matchesAllowedOrigin(origin, overlayAllowedOrigins)`.
- [x] 2.4 Update/extend `apps/chat/src/context/overlay/tests/OverlayContext.spec.tsx` with a scenario where `overlayAllowedOrigins` contains a wildcard entry and a `SET_OVERLAY_OPTIONS` (or equivalent) message from a matching subdomain origin is accepted, and one from a non-matching origin is rejected.
- [x] 2.5 Run `npm run test:file -- apps/chat/src/context/overlay/tests/OverlayContext.spec.tsx apps/chat/src/utils/tests/overlay-origin.spec.ts` and confirm green.

## 3. Documentation

- [x] 3.1 Update `apps/chat-api/README.md`'s `ALLOWED_IFRAME_ORIGINS` row to describe the accepted wildcard form and give a wildcard example alongside the exact-origin example.
- [x] 3.2 Update `apps/chat-api/.env.template`'s `ALLOWED_IFRAME_ORIGINS` comment with the same wildcard note.
- [x] 3.3 Update `docs/architecture.md`'s overlay-mode paragraph (currently says "exact-origin... allowlist") to state that a single leading-wildcard-label pattern is also accepted.
- [x] 3.4 Update `docs/chat-overlay-migration-guide.md`'s `ALLOWED_IFRAME_ORIGINS` description to mention the wildcard form.
- [x] 3.5 Run `npm run validate:docs` and confirm it passes.

## 4. Full verification

- [x] 4.1 Run `npm run verify:changed` (or `npm run verify:full` if this is the last slice before merge) and confirm all checks pass. Note: `typecheck:affected`/`lint:affected` fail on pre-existing, unrelated issues (`offlineUsageConsent`/`ToolsetLoginParams` type mismatches in `apps/chat`, implicit-`any` params in `user-config.service.spec.ts` in `apps/chat-api`) confirmed present on `development` before this change (via `git stash` + rerun); `test:changed` passes fully, and targeted `eslint` on every file this change touches reports zero issues.
