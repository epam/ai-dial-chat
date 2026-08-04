## 1. Confirm Core contract before coding

- [x] 1.1 Verify against live/dev DIAL Core (or the SDK's OpenAPI source) the exact `appId`/`serviceId` split for `getExternalService(appId, id)` given a `params.url` like `applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2` (design.md Open Question 1)
- [x] 1.2 Confirm how `credentialsLevel` should be resolved for a Core-*pushed* `external-service/signin` event (design.md Open Question 2) — inspect `ExternalServiceData.auth_settings` fields (`app_level_auth_status`/`user_level_auth_status`/`global_auth_status`) against a real signed-out service
- [x] 1.3 Confirm whether `externalServiceSignIn` with `authenticationType: "OAUTH"` fully covers the Postman-documented `/v1/ops/external-service/obo-credentials` consent case, or whether that endpoint needs separate handling (design.md Open Question 3) — document the finding in design.md before shipping with the flag enabled

## 2. Backend: `external-services` BFF module

- [x] 2.1 Scaffold `apps/chat-api/src/external-services/`: `external-services.module.ts`, `external-services.controller.ts`, `external-services.service.ts`, `external-services.mapper.ts`, `dto/get-external-service-response.dto.ts`, `dto/external-service-signin-body.dto.ts`, `dto/external-service-logout-body.dto.ts`
- [x] 2.2 Implement `external-services.mapper.ts`: parse `appId`/`serviceId` path segments into the Core `url` value expected by `getExternalService`/`ResourceSignInRequest`/`ResourceSignOutRequest`, per the confirmed split from task 1.1
- [x] 2.3 Implement `GET /api/v1/external-services/:appId/:serviceId` calling SDK `getExternalService`, mapping to `{ displayName, description, authenticationType }`
- [x] 2.4 Implement `POST /api/v1/external-services/:appId/:serviceId/signin` calling SDK `externalServiceSignIn` with the mapped `ResourceSignInRequest`; treat a falsy Core response as `502`
- [x] 2.5 Implement `POST /api/v1/external-services/:appId/:serviceId/signout` calling SDK `externalServiceSignOut`, treating Core `404` as idempotent success
- [x] 2.6 Apply allowlist `@Matches` validation to `appId`/`serviceId` path segments before they are logged or forwarded
- [x] 2.7 Apply `@RequireFeature(FeatureKey.LiveChatInteraction)` to all three routes (reuse existing `FeatureGuard`, no new flag key)
- [x] 2.8 Add Swagger `@ApiOperation`/`@ApiResponse` for every status code (200/400/401/403/404/502) on all three endpoints
- [x] 2.9 Add per-route `@Throttle` limits matching `toolsets.controller.ts`'s read/write route limits
- [x] 2.10 Ensure logging includes only `appId`/`serviceId`/`authenticationType`/`credentialsLevel`, never `apiKey`/`code`
- [x] 2.11 Verify: `npm exec nx lint chat-api`, `npm exec nx build chat-api`

## 3. Backend: OpenAPI and generated client

- [x] 3.1 Add Swagger DTOs/response schemas with `operationIdFactory` names `getExternalService`, `signInExternalService`, `signOutExternalService`
- [ ] 3.2 Run `npm run openapi` and `npm run openapi:check`; regenerate/build `chat-api-client` — **blocked**: `npm run openapi` fails on a pre-existing, unrelated bug (`apps/chat-api/src/app-config/app-config.service.ts`'s `packageJson.version` import breaks under `swc-node`'s CJS/ESM interop), confirmed to fail identically on a clean `development-1.0` checkout with none of this change's files present. Frontend code in this change is written by hand against the manually-typed request/response shapes matching the DTOs in `external-services/dto/`; regenerate the real client and reconcile once the pre-existing bug is fixed (out of scope for this change).

## 4. Backend tests

- [x] 4.1 Unit/e2e: `getExternalService` success, `404`, `400` (invalid path segments), `403` (flag disabled) (`external-services.controller.spec.ts`, `external-services.service.spec.ts`)
- [x] 4.2 Unit/e2e: sign-in success, Core-falsy-response-as-502, missing/invalid body fields
- [x] 4.3 Unit/e2e: sign-out success and 404-as-idempotent-success
- [x] 4.4 Unit: mapper tests for the `appId`/`serviceId` ↔ Core `url` split, covering the documented example plus edge cases (missing segments, encoded characters)
- [x] 4.5 Unit: logging assertions — `apiKey`/`code` never appear in log output
- [x] 4.6 CSRF enforcement covered by the existing generic `csrf.guard.spec.ts` (route-agnostic; no `@Public()` override added)

## 5. Frontend: server-api adapter

- [x] 5.1 Add `apps/chat/src/server-api/external-services.ts`: generated-client-backed `getExternalService`/`signInExternalService`/`signOutExternalService` thin wrappers, mirroring `apps/chat/src/server-api/toolsets.ts`
- [x] 5.2 Verify: `npm exec nx lint chat` / typecheck

## 6. Frontend: `ClientChannelContext` — external-service event parsing

- [x] 6.1 Add `PendingExternalServiceSigninEvent` type and `method`-based discrimination to the SSE frame parser in `apps/chat/src/context/ClientChannelContext.tsx`
- [x] 6.2 Store parsed external-service events in the existing `Map<eventId, PendingEvent>` alongside toolset events, keyed by `id`, deduped by `id`
- [x] 6.3 Verify: `npm exec nx test chat -- ClientChannelContext` — existing toolset tests still pass; add new tests for external-service parsing and mixed-kind dedup

## 7. Frontend: generalize the login controller

- [x] 7.1 Extract a parameterized shared controller from `useToolsetLogin.ts` accepting `{ url, credentialsLevel, authenticationType, signIn, signOut }` so both toolset and external-service call sites share OAuth popup/`BroadcastChannel`/`forceStale` logic
- [x] 7.2 Re-wire `useToolsetLogin` (and `CatalogView.tsx`'s usage) onto the shared controller with zero behavior change — run the full existing toolset test suite to confirm
- [x] 7.3 Add `useExternalServiceLogin.ts` supplying `signInExternalService`/`signOutExternalService` and the credentials-level resolution from task 1.2
- [x] 7.4 Handle `authenticationType: "NONE"` by auto-reporting `success` without a login step
- [x] 7.5 Verify: `npm exec nx test chat -- useToolsetLogin` (unchanged) and new `useExternalServiceLogin.spec.ts`

## 8. Frontend: generalize the dialog

- [x] 8.1 Rename `apps/chat/src/components/ToolsetSigninDialog/` → `apps/chat/src/components/SigninInterruptDialog/`, updating imports in `apps/chat/src/app/app.tsx` and elsewhere
- [x] 8.2 Extend row rendering to branch on pending-event kind (`toolset` vs `external-service`), resolving external-service metadata via `getExternalService` with a fallback label while loading/on error
- [x] 8.3 Wire external-service `Log in`/`Decline` actions to `useExternalServiceLogin`, reporting `success`/`denied` via the existing `reportEvent` path
- [x] 8.4 Render the `NONE`-auth-type informational, non-actionable row state
- [x] 8.5 Confirm `Decline all` iterates both event kinds independently, matching the existing partial-failure behavior
- [x] 8.6 Add `externalServiceSignin.*` i18n keys to `apps/chat/src/i18n/locales/en.json` and `translation-keys.ts`, reusing `ButtonsI18nKeys.LogIn` where wording matches
- [x] 8.7 Verify layout uses only logical/direction-agnostic Tailwind utilities (reuse existing dialog markup, no new physical-direction classes)
- [x] 8.8 Memoize per-row resolved metadata/disabled state with `useMemo`/`useCallback`
- [x] 8.9 Verify: `npm exec nx test chat -- SigninInterruptDialog` — existing toolset-row tests pass unchanged under the new name; add new external-service-row tests

## 9. Frontend tests

- [x] 9.1 External-service metadata resolution: success, loading/error fallback (`SigninInterruptDialog.spec.tsx`)
- [x] 9.2 API key login success/failure paths for an external-service row
- [x] 9.3 OAuth success/cancel/popup-blocked paths reused at the shared-controller level (`useExternalServiceLogin.spec.ts` / shared controller spec)
- [x] 9.4 `NONE` auth type auto-resolves without user interaction
- [x] 9.5 Decline and decline-all covering a mix of toolset and external-service rows, including partial failure
- [x] 9.6 Duplicate external-service event id is deduplicated
- [x] 9.7 Feature flag disabled: no external-service metadata/signin/signout call is made and no row renders

## 10. Documentation

- [x] 10.1 Extend or add an auth diagram alongside `docs/auth/auth-diagrams/08-toolset-signin-interrupt.mmd` covering the external-service event path (or a shared diagram if the flows are similar enough)
- [x] 10.2 Update `docs/auth/auth-bff-encrypted-cookie.md` to distinguish application OIDC login, toolset credential login, and external-service credential login as three separate flows
- [x] 10.3 Update `docs/architecture.md`: add `external-services/` to the chat-api domain tree and the new endpoints to the API surface table

## 11. Final verification

- [x] 11.1 `npx nx affected -t lint --base=origin/development-1.0`
- [x] 11.2 `npx nx affected -t test --base=origin/development-1.0`
- [x] 11.3 `npx nx affected -t build --base=origin/development-1.0`
- [x] 11.4 Manual end-to-end smoke test with `liveChatInteraction` enabled in a dev environment: trigger a completion against an application with an external service requiring API-key credentials, confirm the dialog appears, log in, confirm the tool call resumes; repeat for an OAuth-configured external service if available
- [x] 11.5 Resolve or explicitly defer the Open Questions in design.md before/at merge (Core `appId`/`serviceId` split, `credentialsLevel` resolution, OBO/consent coverage, sibling auto-resolution scope, proactive-login-surface follow-up)
