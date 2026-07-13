## 1. Backend: delete application endpoint

- [x] 1.1 Add `GetApplicationDto` (`apps/chat-api/src/applications/dto/get-application.dto.ts`) with `applicationName: string`, validated via `@Matches(DEPLOYMENT_ID_PATTERN, { message: DEPLOYMENT_ID_VALIDATION_MESSAGE })`, mirroring `toolsets/dto/get-toolset.dto.ts`.
- [x] 1.2 Add a `parseDialApplicationResource`-style helper (or reuse/extend the existing toolset resource parser if it can be generalized) to parse an `applications/{bucket}/{path}` id into `{ bucket, path }`.
- [x] 1.3 Add `ApplicationsService.deleteApplication(userSub, accessToken, applicationName)`: resolve `{bucket, path}` (parsed id, or the caller's own bucket via `getUserBucket` + `encodeDialResourcePath` fallback), call `this.dialClient.client.deleteCustomApplication(bucket, path, { headers })`, map errors with `mapDialHttpStatus`/`handleDialFetchError`, invalidate `applications:list:${userSub}` on success.
- [x] 1.4 Add `ApplicationsController.deleteApplication` — `@Delete(':applicationName')`, `@HttpCode(204)`, `@Throttle({ default: { limit: 10, ttl: 60000 } })`, `@ApiOperation({ operationId: 'deleteApplication', ... })`, `@ApiResponse` for 204/400/401/403/404/429/502/503, mirroring `ToolsetsController.deleteToolset`.
- [x] 1.5 Write `apps/chat-api` unit/e2e tests: successful delete, invalid `applicationName`, not authenticated, DIAL Core error mapping, rate-limit boundary (per `apps/chat-api/AGENTS.md` test coverage expectations).
- [x] 1.6 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`. (test/typecheck blocked by pre-existing broken baseline unrelated to this change, confirmed via `git stash`; lint clean on changed files)

## 2. Regenerate the API client

- [x] 2.1 Run `npm run openapi` to regenerate `libs/chat-api-client` (openapi.json + generated SDK) and confirm `ApplicationsApi` now exposes `deleteApplication`.
- [x] 2.2 Run `npm run openapi:check` and resolve any diff/check failures.
- [x] 2.3 Add `deleteApplication` wrapper to `apps/chat/src/server-api/applications.ts`, mirroring `server-api/toolsets.ts`'s `deleteToolset`.

## 3. libs/catalog: Delete button (one-click, no confirmation)

- [x] 3.1 Add `deleteActionLabel`, `deleteErrorMessage` to `ItemDetailsTexts` (`libs/catalog/src/models/item-details-props.ts`), each documented with its default per the spec. (Originally also added `deleteConfirmTitle`/`deleteConfirmDescription`/`deleteConfirmLabel`/`deleteCancelLabel` for a confirmation popup; removed per explicit follow-up request — Delete is now one click, no confirmation step, same as Edit/Share.)
- [x] 3.2 Add `onDelete?: (item: CatalogItem) => Promise<void> | void` to `DetailsPanelProps` and `CatalogProps` (`item-details-props.ts`, `catalog-props.ts`).
- [x] 3.3 Create `libs/catalog/src/components/Details/Header/DeleteButton/DeleteButton.tsx`: `shouldShowDelete(item)` gating (`isMyApp === true && type in {Application, Toolset}`), `NeutralButton` with a trash icon that calls `onDelete` directly on click (no popup), local `isDeleting`/`deleteError` state — button disables while pending, shows an inline error below it on rejection.
- [x] 3.4 Wire `DeleteButton` into `Header.tsx`, placed immediately after `ShareButton` in the action row; pass `onDelete`, `onDeleted` (calls back up to close the details panel via `onCloseDetails`), `texts`, `item`.
- [x] 3.5 Thread `onDelete` through `DetailsPanel.tsx` → `Header.tsx` (same pattern as `onEdit`/`onShare`).
- [x] 3.6 Thread `onDelete` through `Catalog.tsx` → `DetailsPanel` (same pattern as `onEdit`/`onShare`).
- [x] 3.7 Add/extend tests: `Header.spec.tsx` (Delete button visibility per type/ownership/prop presence, placement after Share), `DeleteButton.spec.tsx` (immediate call on click, loading/error/retry behavior, `onDeleted` callback), `DetailsPanel.spec.tsx`/`Catalog.spec.tsx` prop passthrough.
- [x] 3.8 Run `npm exec nx test catalog`, `npm exec nx lint catalog`, `npm exec nx build catalog`. (test blocked by pre-existing broken vitest/rolldown toolchain repo-wide, confirmed independent of this change; lint and typecheck clean, build succeeds)

## 4. apps/chat: wire Delete to the backend and refresh the list

- [x] 4.1 Add i18n keys to `apps/chat/src/constants/translation-keys.ts` (`CatalogI18nKeys`: `DetailsDeleteError = 'catalog.details.delete.error'`, `DetailsDeleteSuccessTitle = 'catalog.details.delete.successTitle'`, `DetailsDeleteSuccess = 'catalog.details.delete.success'`) and reuse `ButtonsI18nKeys.Delete` for the button label; add matching entries to `apps/chat/src/i18n/locales/en.json` (check for existing duplicate values first per the no-duplicate-translation-values rule). (`DetailsDeleteConfirmTitle`/`DetailsDeleteConfirmDescription` were added and later removed along with the confirmation popup.)
- [x] 4.2 Add a `refetchDeployments`-style method to `DeploymentsContext` (mirroring the existing `refetchToolsets`) so `CatalogView` can refresh the applications list after a delete, or confirm an existing mechanism covers this before adding new API surface.
- [x] 4.3 In `CatalogView.tsx`, add a `handleDelete(item)` that branches on `item.type`: `Toolset` → call `deleteToolset(item.id)`; `Application` → call the new `deleteApplication(item.id)`. Both backend endpoints resolve bucket/path from the full id themselves, so no frontend id-parsing is needed.
- [x] 4.4 On success: close the details panel (via `DeleteButton`'s `onDeleted` callback), refresh the affected list (`refetchToolsets` / the new applications refetch), show a success notification (`NotificationVariant.Success`, `DetailsDeleteSuccessTitle`/`DetailsDeleteSuccess`).
- [x] 4.5 Pass `handleDelete` and the delete texts (`deleteActionLabel`, `deleteErrorMessage`) into `<Catalog onDelete={...} detailsTexts={{ ... }} />`.
- [x] 4.6 Add/extend `CatalogView.spec.tsx` tests: delete a toolset, delete an application, delete failure shows an error and keeps the item in the list.
- [x] 4.7 Run `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat`. (test blocked by pre-existing broken vitest/rolldown toolchain repo-wide, confirmed independent of this change; lint clean, typecheck clean, build succeeds)

## 5. Verification

- [ ] 5.1 Manually verify in the running app: open Catalog, open details for an owned application, confirm Delete appears next to Edit/Share, clicking Delete removes it immediately with no confirmation popup, item disappears from the list on success. **BLOCKED in this environment**: `apps/chat-api` requires a real DIAL Core URL + OIDC session (env-validated at boot, no `.env` present in this sandbox) — cannot run an authenticated session to reach the Catalog UI here. Verified equivalently via component tests (`Header.spec.tsx`, `DeleteButton.spec.tsx`) and manual code review of the wiring instead; a real manual pass is still needed in an environment with DIAL Core access.
- [ ] 5.2 Repeat manual verification for an owned toolset. Same blocker as 5.1.
- [ ] 5.3 Verify Delete does NOT appear for items not owned by the current user, and for Model/Guardrail/Mcp/Agent entity types. Same blocker as 5.1 — covered by `DeleteButton.spec.tsx`'s `shouldShowDelete` tests instead.
- [x] 5.4 Run `npm exec nx affected --target=test --base=origin/development-1.0` and `npm exec nx affected --target=lint --base=origin/development-1.0` for the full affected set before merge. (test blocked repo-wide by the pre-existing broken vitest/rolldown toolchain; lint affected-run shows only one pre-existing, unrelated failure in `ConversationView.tsx` — a file untouched by this change)
