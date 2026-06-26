## 1. Backend — Env Validation and Config Registry

- [x] 1.1 Add optional `DEFAULT_DEPLOYMENT?: string` with `@IsOptional() @IsString()` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`
- [x] 1.2 Add `deployments.defaultDeploymentId` config-registry entry (envVar: `DEFAULT_DEPLOYMENT`, visibility: `client`, type: `config`, valueType: `string`, default: `null`) in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`
- [x] 1.3 Add `defaultDeploymentId: string | null` to the nested `config` object in `ClientConfigResponseDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) with `@ApiPropertyOptional`, `@IsOptional()`, `@IsString()`, `nullable: true`
- [x] 1.4 Write / update unit tests for `AppConfigService` covering `DEFAULT_DEPLOYMENT` set and absent cases; verify with `npm exec nx test chat-api`

## 2. Backend — User Config Schema and Migration

- [x] 2.1 Add `selectedId: string | null` to `DeploymentsDto` in `apps/chat-api/src/user-config/dto/user-config.dto.ts` with `@IsOptional() @IsString()` and `@ApiPropertyOptional({ nullable: true })`
- [x] 2.2 Bump `CURRENT_CONFIG_VERSION` from `2` to `3` in `apps/chat-api/src/user-config/dto/user-config.dto.ts`
- [x] 2.3 Add the v2→v3 migration step in `UserConfigService.migrateConfig` (`apps/chat-api/src/user-config/user-config.service.ts`) that sets `deployments.selectedId = deployments.selectedId ?? null` and bumps `version` to `3`
- [x] 2.4 Write unit tests for `migrateConfig` covering v1, v2, and already-v3 inputs; verify with `npm exec nx test chat-api`

## 3. Backend — New PATCH Endpoint

- [x] 3.1 Create `UpdateSelectedDeploymentDto` in `apps/chat-api/src/user-config/dto/update-selected-deployment.dto.ts` with `id: string | null` (`@IsOptional() @IsString()`)
- [x] 3.2 Add `updateSelectedDeployment(id: string | null, at: string, bucket: string): Promise<void>` to `UserConfigService` — reads config, sets `deployments.selectedId = id`, writes back
- [x] 3.3 Add `PATCH /api/v1/user-config/deployments/selected` handler (`updateSelectedDeployment`) to `UserConfigController` with `@ApiBody({ type: UpdateSelectedDeploymentDto })`, `@HttpCode(204)`, and the existing `SessionGuard`
- [x] 3.4 Write e2e / integration tests for the new endpoint (204 on valid body, 204 on `{ id: null }`, 401 unauthenticated, isolation of `deployments.installed`); verify with `npm exec nx test chat-api`

## 4. OpenAPI Generation and Generated Client

- [x] 4.1 Run the repository OpenAPI generation script to regenerate `libs/chat-api-client` from the updated Swagger output (follow the existing generation instructions in the repo)
- [x] 4.2 Verify `UserConfigApi.updateSelectedDeployment` and the updated `getClientConfig` return type appear in the generated client
- [x] 4.3 Run `npm exec nx build chat-api-client` (or equivalent) and fix any type errors in the generated client

## 5. Frontend — Server-API Wrappers

- [x] 5.1 Add `updateSelectedDeployment(id: string | null): Promise<void>` to `apps/chat/src/server-api/user-config.api.ts` calling the generated `UserConfigApi.updateSelectedDeployment`
- [x] 5.2 Update `apps/chat/src/server-api/app-config.api.ts` to expose `defaultDeploymentId: string | null` from the `GET /api/v1/client-config` response

## 6. Frontend — AppConfigContext

- [x] 6.1 Add `defaultDeploymentId: string | null` to the context type and value in `apps/chat/src/context/AppConfigContext.tsx`, reading from the updated server-api wrapper

## 7. Frontend — UserConfigContext

- [x] 7.1 Add `selectedDeploymentId: string | null` to `UserConfigContextType` in `apps/chat/src/context/UserConfigContext.tsx`, populated from `getUserConfig()` response `deployments.selectedId`
- [x] 7.2 Add `setSelectedDeployment: (id: string | null) => Promise<void>` to `UserConfigContextType` wrapped in `useCallback`; it calls `updateSelectedDeployment(id)` from `user-config.api.ts` and updates local state on success

## 8. Frontend — DeploymentsContext Selection Logic

- [x] 8.1 Remove all `localStorage.getItem` / `localStorage.setItem` calls for `dial:selectedDeploymentId` from `apps/chat/src/context/DeploymentsContext.tsx`
- [x] 8.2 Import `useUserConfig` and `useAppConfig` inside `DeploymentsContext`; read `selectedDeploymentId` and `defaultDeploymentId`
- [x] 8.3 Implement the 5-step initial-selection precedence (in-memory valid → user-config → operator default → first item → null) in the deployments load `useEffect`
- [x] 8.4 Update `setSelectedItemId` to call `useUserConfig().setSelectedDeployment(id)` after updating local state (fire-and-forget; swallow errors silently, log at warn level)
- [x] 8.5 Ensure `restoreSelectedItemId` only updates local state and does NOT call `setSelectedDeployment`
- [x] 8.6 Wrap `setSelectedItemId` and `restoreSelectedItemId` in `useCallback`; wrap context value in `useMemo`

## 9. Frontend — Tests and Cleanup

- [x] 9.1 Write / update unit tests for `DeploymentsContext` covering all 5 precedence steps, the reload-with-stale-id scenario, `restoreSelectedItemId` not persisting, and `setSelectedItemId` calling `setSelectedDeployment`; verify with `npm exec nx test chat` (or the Nx test target for `apps/chat`)
- [x] 9.2 Write / update unit tests for `UserConfigContext` covering `selectedDeploymentId` population and `setSelectedDeployment` optimistic update
- [x] 9.3 Search for any remaining references to `dial:selectedDeploymentId` in the frontend and remove them
- [x] 9.4 Run `npm exec nx lint chat` and `npm exec nx typecheck chat` (or equivalent) and fix any errors
