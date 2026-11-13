Slicing strategy: **contract-first**. Slice 1 fixes the BFF contract and the generated client. Slice 2 lands the pure helpers, the hook and the shared app state. Each slice is independently verifiable. No UI slice: the unit icon was dropped, and consumers arrive with the permission work.

## 1. BFF endpoint `GET /api/v1/org-units` (contract)

- [x] 1.1 Read `apps/chat-api/AGENTS.md` and mirror `apps/chat-api/src/application-schemas/`. Create `apps/chat-api/src/org-units/dto/org-unit.dto.ts` with the `OrgUnitDto` and `OrgUnitsResponseDto` classes, using `@ApiProperty` on every field and the examples from the spec.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.service.spec.ts` (after 1.2)
- [x] 1.2 Create `apps/chat-api/src/org-units/org-units.service.ts`. `listOrgUnits(userSub, accessToken)` uses `withCachedDialRequest` (key `org-units:list:<sub>`, TTL 60 s) and calls `dialClient.client.getOrgUnit('public', { params: { query: { recursive: true } }, headers: getBearerAuthHeaders(at) })`. Core 404 → `{ enabled: false, units: [] }`; other errors go through `mapDialHttpStatus`. It flattens `items`, falls back from `displayName` to `name`, and drops malformed items with a `warn`.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.service.spec.ts`
- [x] 1.3 Create `apps/chat-api/src/org-units/org-units.controller.ts` (`@ApiTags('org-units')`, `@Controller({ path: 'org-units', version: '1' })`, handler `listOrgUnits`, `@ApiDialCoreErrors()`, `@ApiResponse` for 200/401/403/502/503) and `org-units.module.ts`, and register it in `apps/chat-api/src/app/app.module.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.controller.spec.ts`
- [x] 1.4 Unit tests in `apps/chat-api/src/org-units/tests/org-units.service.spec.ts`:
  - happy path flattening;
  - `displayName` fallback;
  - malformed item dropped;
  - Core 404 → disabled (and cached);
  - 401/403/500/timeout mapping;
  - cache hit;
  - per-user key;
  - errors not cached.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.service.spec.ts`
- [x] 1.5 Supertest integration test `apps/chat-api/src/org-units/tests/org-units.controller.integration.spec.ts`, modelled on `apps/chat-api/src/deployments/tests/user-limits.controller.integration.spec.ts`. Cases: 200 body shape, 200 `enabled:false` on Core 404, 401 without a session, 502 on Core 500, 503 on Core unavailable.
  - Verification: `npm run test:file -- apps/chat-api/src/org-units/tests/org-units.controller.integration.spec.ts`
- [x] 1.6 Run `npm run openapi` and `npm run openapi:check`. Confirm `listOrgUnits` and both DTOs appear in `libs/chat-api-client/openapi.json` with strong types, then build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Do not hand-edit generated files.
- [x] 1.7 Add an `orgUnitsApi = new OrgUnitsApi(config)` singleton to `apps/chat/src/server-api/api-client.ts`, and add `apps/chat/src/server-api/org-units.api.ts` exporting `listOrgUnits()`, which calls `orgUnitsApi.listOrgUnits()` (normal method, not `Raw`), with a test in `apps/chat/src/server-api/tests/`.
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/org-units.api.spec.ts`
- [x] 1.8 Slice check: `npm run verify:changed`.

## 2. Shared helpers, hook and app context

- [x] 2.1 In `libs/chat-shared`, add the `OrgUnit` type and the pure `normalizeOrgUnitFolder`, `toOrgUnitFolderSet` and `isOrgUnitFolder` (type in `libs/chat-shared/src/models/org-unit.ts`, helpers in `libs/chat-shared/src/utils/org-unit.ts`), export them from the package entry, and add JSDoc.
  - Verification: `npm run test:file -- libs/chat-shared/src/utils/tests/org-unit.spec.ts`
- [x] 2.2 Unit tests for 2.1:
  - encoded vs decoded match;
  - leading `public/` stripped;
  - trailing slash optional;
  - subfolder not a unit;
  - `Risk/` vs `Risk2/`;
  - malformed `%` escape kept raw.
  - Verification: `npm run test:file -- libs/chat-shared/src/utils/tests/org-unit.spec.ts`
- [x] 2.3 In `libs/chat-hooks`, add the string enum `OrgUnitsStatus` and `useOrgUnits({ listOrgUnits })` (`libs/chat-hooks/src/org-units/useOrgUnits/useOrgUnits.ts`): load-once `ensureUnits`, a cancelled flag, memoised `unitFolders`, and a `useCallback` `isOrgUnitFolder`. Export both from `libs/chat-hooks/src/index.ts` and the `./utils` entry point (`libs/chat-hooks/src/entry-points/utils.ts`).
  - Verification: `npm run test:file -- libs/chat-hooks/src/org-units/useOrgUnits/tests/useOrgUnits.spec.ts`
- [x] 2.4 Unit tests for 2.3:
  - single load across repeated `ensureUnits`;
  - `Idle → Loading → Ready`;
  - `enabled:false` → `Disabled`;
  - rejection → `Error` with no throw;
  - no state update after unmount;
  - `isOrgUnitFolder` is false before `Ready`.
  - Verification: `npm run test:file -- libs/chat-hooks/src/org-units/useOrgUnits/tests/useOrgUnits.spec.ts`
- [x] 2.5 Architecture guard for 2.1–2.4: confirm `libs/chat-shared` and `libs/chat-hooks` contain no `/api` path, no `@epam/ai-dial-chat-api-client` import in `chat-shared`, no client construction, no app context, no i18n, and no env or feature-flag access. Run `npm exec nx lint chat-shared` and `npm exec nx lint chat-hooks`, whose module-boundary rules enforce this.
- [x] 2.6 Create `apps/chat/src/context/OrgUnitsContext.tsx` (ThemeContext pattern): `OrgUnitsProvider` wraps `useOrgUnits({ listOrgUnits })`, the value is `useMemo`'d, and `useOrgUnitsContext()` throws outside the provider. Mount it in `apps/chat/src/AppRoot.tsx` with no fetch on mount.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/OrgUnitsContext.spec.tsx`
- [x] 2.7 Tests for 2.6: no request until `ensureUnits`, two consumers trigger one request, and the guard hook throws outside the provider.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/OrgUnitsContext.spec.tsx`
- [x] 2.8 Slice check: `npm run verify:changed`.

## 3. Docs and close-out

- [x] 3.1 Update the READMEs:
  - `libs/chat-shared/README.md`: the `OrgUnit` model and the org-unit helpers;
  - `libs/chat-hooks/README.md`: `useOrgUnits` and `OrgUnitsStatus`.
- [x] 3.2 Update `docs/architecture.md`: the `org-units/` backend domain, the `/api/v1/org-units` route row and `OrgUnitsContext` in the context list.
- [x] 3.3 Run `npm run validate:docs` and `npm run validate:specs`.
- [x] 3.4 Final: `npm run verify:full` once, and `npm run build:quiet`, because a new provider and lib entry exports affect bundling.

## 4. Follow-ups (out of scope, record only)

- [ ] 4.1 Open a follow-up issue for unit permissions via `GET /v1/user/role-assignments` once `@epam/ai-dial-typescript-sdk` exposes `getUserRoleAssignments`.
- [ ] 4.2 Open a follow-up issue on whether to show `displayName` as the row label in the file manager rows.
