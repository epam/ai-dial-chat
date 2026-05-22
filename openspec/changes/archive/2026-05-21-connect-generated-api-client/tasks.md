## 1. Prerequisites — Verify generated client is current

- [x] 1.1 Run `npm run openapi` to regenerate `libs/chat-api-client/src/generated/` from the backend spec
- [x] 1.2 Run `npm run openapi:check` and confirm it exits with zero — if not, fix OpenAPI annotations in `apps/chat-api` before proceeding (see design.md OQ-1 / backend annotation gap risk)
- [x] 1.3 Run `npm exec nx build chat-api-client -- --skip-nx-cache` to confirm the generated client compiles cleanly
- [x] 1.4 Run `npm exec nx lint chat-api-client` to confirm no lint errors in the generated client
- [x] 1.5 Confirm `@epam/chat-api-client` is listed as a dependency in `apps/chat/package.json`; if not, add it and verify `npm exec nx graph` shows the `chat` → `chat-api-client` edge (resolves design.md OQ-2)

## 2. Slice 1 — Client configuration factory

- [x] 2.1 Create `apps/chat/src/server-api/api-client.ts` — export `createApiConfiguration(): Configuration` using `basePath: ''`, `credentials: 'include'`, and an empty middleware array (stubs for CSRF, 401, telemetry added in Slice 2)
- [x] 2.2 Export module-level singletons from `api-client.ts`: `modelsApi` (`new ModelsApi(createApiConfiguration())`), `deploymentsApi`, `conversationsApi`
- [x] 2.3 Run `npm exec nx build chat -- --skip-nx-cache` — confirm build succeeds with no unused-import or type errors
- [x] 2.4 Run `npm exec nx lint chat` — confirm no new lint errors

## 3. Slice 2 — Middleware layer (CSRF, 401, telemetry) + unit tests

- [x] 3.1 In `api-client.ts`, implement `csrfMiddleware: Middleware` — `pre` hook reads `getCsrfToken()` from `base.ts` and injects `X-CSRF-Token` header for non-GET requests
- [x] 3.2 In `api-client.ts`, implement `unauthorizedMiddleware: Middleware` — `post` hook: if `response.status === 401`, calls all `onUnauthorized` listeners (imported from `base.ts`) with the request URL, then throws `new UnauthorizedError(url)`
- [x] 3.3 In `api-client.ts`, implement `telemetryMiddleware: Middleware` — `post` hook that logs method, URL, status, and elapsed duration (use `console.debug` or a no-op placeholder); compose all three middlewares into `createApiConfiguration()`
- [x] 3.4 Create `apps/chat/src/server-api/tests/api-client.spec.ts` — Vitest unit tests covering: (a) CSRF header injected for POST with token set, (b) no CSRF header for GET, (c) no CSRF header when token is null, (d) `UnauthorizedError` thrown and listener called on 401, (e) listener NOT called for non-401 response
- [x] 3.5 Run `npm exec nx test chat` — confirm all tests pass
- [x] 3.6 Run `npm exec nx lint chat` and `npm exec nx build chat`

## 4. Slice 3 — Pilot migration: `models.ts`

- [x] 4.1 Audit `apps/chat/src/server-api/models.ts` call-sites: `grep -r "from.*server-api/models"` in `apps/chat/src/` — no external consumers found
- [x] 4.2 Compare `DialModelDto` (from `@epam/chat-api-client`) with `DialModel` / `DialModelListResponse` from `@epam/ai-dial-chat-shared` — `ownedBy` vs `owned_by` differs; return type updated to use generated DTOs directly since there are no external consumers
- [x] 4.3 Rewrite `apps/chat/src/server-api/models.ts` to use `modelsApi.listModels()` for `getModels()` and `modelsApi.getModel({ modelName })` for `getModel()`; keep function signatures unchanged; add type cast or mapping only if shapes differ
- [x] 4.4 Run `npm exec nx test chat` — confirm no regressions; update any tests that mock `get` from `base.ts` for models to mock `modelsApi` instead
- [x] 4.5 Run `npm exec nx lint chat` and `npm exec nx build chat`

## 5. Slice 4 — Migrate `deployments.ts`

- [x] 5.1 Audit call-sites: `grep -r "from.*server-api/deployments"` in `apps/chat/src/` — no external consumers found
- [x] 5.2 Compare generated `DeploymentDto` / deployment list DTO shapes with the local `Deployment` / `DeploymentListResponse` interfaces — backend returns `DialDeploymentDto[]` (array, not `{ data: [] }`); local interfaces removed and replaced with generated types
- [x] 5.3 Rewrite `apps/chat/src/server-api/deployments.ts` to use `deploymentsApi`; keep `getDeployments` and `getDeployment` signatures unchanged; remove local interface definitions if covered by generated DTOs
- [x] 5.4 Run `npm exec nx test chat` — fix any test mocks that referenced `get` from `base.ts` for deployments
- [x] 5.5 Run `npm exec nx lint chat` and `npm exec nx build chat`

## 6. Slice 5 — Migrate `conversations.api.ts`

- [x] 6.1 Audit call-sites: `grep -r "from.*server-api/conversations"` in `apps/chat/src/` — used by `ConversationRoute.tsx` and `Conversation.tsx`
- [x] 6.2 Verify `ConversationsApi` in `@epam/chat-api-client` has methods matching all five exported functions — `getConversation`, `saveConversation`, `getConversationMetadata` return `void` (backend annotations missing); used `Raw` methods with cast for those three
- [x] 6.3 Rewrite `apps/chat/src/server-api/conversations.api.ts` to delegate to `conversationsApi`; keep all five exported function signatures unchanged; verify URL-encoding of `path` parameter matches current behavior
- [x] 6.4 Run `npm exec nx test chat` — fix any affected test mocks
- [x] 6.5 Run `npm exec nx lint chat` and `npm exec nx build chat`

## 7. Slice 6 — Narrow `base.ts`

- [x] 7.1 Identify and remove unused `ApiEndpoints` entries — removed `DEPLOYMENTS`, `MODELS`, `AUTH_ME`, `AUTH_PROVIDERS`; kept `CONVERSATIONS`, `THEMES`, `THEME_ICON`, `AUTH_LOGOUT`
- [x] 7.2 Add `notifyUnauthorized` export to `base.ts` used by `api-client.ts` middleware
- [x] 7.3 `get`/`post`/`put`/`del` remain in `base.ts` — still imported by `ThemeContext.tsx`
- [x] 7.4 Build passes — no broken references
- [x] 7.5 Tests and lint pass

## 9. Slice 7 — Migrate auth/session (`UserContext`, `useAuthRedirect`, `Login`)

- [x] 9.1 Add `type: [ProviderInfoDto]` to `listProviders` in `apps/chat-api/src/auth/auth.controller.ts`
- [x] 9.2 Add `type: UserProfileDto` to `getCurrentUser` in `apps/chat-api/src/auth/auth.controller.ts`
- [x] 9.3 Add `ProviderInfoDto` and `UserProfileDto` classes to `openapi-response.dto.ts`
- [x] 9.4 Fix postprocess script to replace `{ [key: string]: any }` → `{ [key: string]: unknown }` in generated models
- [x] 9.5 Run `npm run openapi` — confirm `AuthApi.getCurrentUser()` returns `UserProfileDto` and `listProviders()` returns `ProviderInfoDto[]`
- [x] 9.6 Export `authApi` singleton from `api-client.ts`
- [x] 9.7 Create `apps/chat/src/server-api/auth.api.ts` with `getMe()` (uses `getCurrentUserRaw()` to extract X-CSRF-Token) and `getProviders()`
- [x] 9.8 Migrate `UserContext.tsx` to use `getMe()` instead of `get<UserProfile>(ApiEndpoints.AUTH_ME, { responseHandler })`
- [x] 9.9 Migrate `useAuthRedirect.ts` to use `getProviders()` instead of `get<ProviderInfo[]>(ApiEndpoints.AUTH_PROVIDERS)`
- [x] 9.10 Migrate `Login.tsx` to use `getProviders()` instead of `get<ProviderInfo[]>(ApiEndpoints.AUTH_PROVIDERS)`
- [x] 9.11 Update `UserContext.spec.tsx`, `useAuthRedirect.spec.tsx`, `Login.spec.tsx` to spy on `auth.api` instead of `base.get`
- [x] 9.12 Run `npm exec nx test chat` — all 122 tests pass
- [x] 9.13 Run `npm exec nx lint chat` — no errors

## 8. Final verification

- [x] 8.1 Run `npm run openapi` followed by `npm run openapi:check` — must exit clean
- [x] 8.2 Run `npm exec nx build chat-api-client -- --skip-nx-cache`
- [x] 8.3 Run `npm exec nx lint chat-api-client`
- [x] 8.4 Run `npm exec nx test chat`
- [x] 8.5 Run `npm exec nx lint chat`
- [x] 8.6 Run `npm exec nx build chat`
- [x] 8.7 `apps/chat` → `libs/chat-api-client` edge confirmed via node_modules symlink + tsconfig.app.json reference
- [x] 8.8 `streamCompletion` in `chat-stream.api.ts` confirmed to reference `ApiEndpoints.CONVERSATIONS` and `getCsrfToken` from `base.ts` without errors
