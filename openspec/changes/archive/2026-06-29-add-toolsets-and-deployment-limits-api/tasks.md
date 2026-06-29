## 1. OpenAPI DTOs

- [x] 1.1 Add `DialToolsetAuthSettingsDto`, `DialToolsetDto`, and `DialToolsetListResponseDto` to `apps/chat-api/src/openapi/openapi-response.dto.ts` with `@ApiProperty` on all fields (mirror upstream toolset shape from spec)
- [x] 1.2 Add `LimitStatsDto` and `DeploymentLimitsResponseDto` to `apps/chat-api/src/openapi/openapi-response.dto.ts` with nested stats fields per period

## 2. Backend — Toolsets DTOs

- [x] 2.1 Create `apps/chat-api/src/toolsets/dto/get-toolset.dto.ts` — `GetToolsetDto` with `toolsetName: string` validated by `@IsString`, `@Matches(/^[a-zA-Z0-9_\-.:@]+$/)`, and `@ApiProperty` (mirror `GetModelDto`)

## 3. Backend — Toolsets Service (slice 1)

- [x] 3.1 Create `apps/chat-api/src/toolsets/toolsets.service.ts` — `ToolsetsService extends AppService`, inject `CACHE_MANAGER`, `protected logger = new Logger(ToolsetsService.name)`
- [x] 3.2 Implement `listToolsets(userSub, accessToken)` — cache key `toolsets:list:<userSub>`, TTL 30 s, calls `this.client.getToolSets({ headers: getBearerAuthHeaders(accessToken) })`, maps via `mapDialHttpStatus` / `handleDialFetchError`, returns `{ data: DialToolsetDto[] }`
- [x] 3.3 Implement `getToolset(userSub, accessToken, toolsetName)` — cache key `toolsets:single:<userSub>:<toolsetName>`, TTL 60 s, calls `this.client.getToolset(toolsetName, { headers })`, strips `auth_settings.client_secret` if present before return
- [x] 3.4 Create `apps/chat-api/src/toolsets/tests/toolsets.service.spec.ts` — unit tests: list/single happy path (cache miss + hit), error mapping (401, 403, 404, 429, 5xx, network), cache key isolation, client_secret redaction

## 4. Backend — Toolsets Controller & Module (slice 1)

- [x] 4.1 Create `apps/chat-api/src/toolsets/toolsets.controller.ts` — `@ApiTags('toolsets')`, `@Controller({ path: 'toolsets', version: '1' })`, handlers `listToolsets` and `getToolset` with `@Throttle(60/min)`, `Cache-Control` headers, full `@ApiOperation` + `@ApiResponse` for all status codes
- [x] 4.2 Create `apps/chat-api/src/toolsets/toolsets.module.ts` and register `ToolsetsModule` in `apps/chat-api/src/app/app.module.ts`
- [x] 4.3 Create `apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts` — integration tests: `GET /api/v1/toolsets` 200, `GET /api/v1/toolsets/:name` 200, invalid name 400, 401/404/503 propagation
- [x] 4.4 **Verify slice 1:** `npm exec nx test chat-api`, `npm exec nx lint chat-api`

## 5. Backend — Deployment Limits (slice 2)

- [x] 5.1 Create `apps/chat-api/src/deployments/dto/get-deployment-limits.dto.ts` — `GetDeploymentLimitsDto` with `deploymentName` validated by same allowlist regex as models
- [x] 5.2 Add `getDeploymentLimits(deploymentName, accessToken)` to `DeploymentsService` — NO cache, calls `this.client.getDeploymentLimits(deploymentName, { headers })`, returns `DeploymentLimitsResponseDto`
- [x] 5.3 Add `GET :deploymentName/limits` handler `getDeploymentLimits` to `DeploymentsController` — `@Throttle(60/min)`, `@Header('Cache-Control', 'private, no-store')`, full Swagger annotations, operationId `getDeploymentLimits`
- [x] 5.4 Extend `deployments.service.spec.ts` and controller/integration tests — happy path, 404, no-cache behavior (two calls → two SDK invocations), invalid param 400
- [x] 5.5 **Verify slice 2:** `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`

## 6. OpenAPI Regeneration (slice 3)

- [x] 6.1 Run `npm run openapi && npm run openapi:check`
- [x] 6.2 Verify generated client: `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` — confirm methods `listToolsets`, `getToolset`, `getDeploymentLimits` with typed request/response DTOs

## 7. Frontend — Server-API Wrappers (slice 4)

- [x] 7.1 Register `toolsetsApi` in `apps/chat/src/server-api/api-client.ts` if not auto-wired
- [x] 7.2 Create `apps/chat/src/server-api/toolsets.ts` — export `listToolsets()` and `getToolset(toolsetName)` using generated client types
- [x] 7.3 Create `apps/chat/src/server-api/deployment-limits.ts` — export `getDeploymentLimits(deploymentName)` using `deploymentsApi.getDeploymentLimits`
- [x] 7.4 **Verify slice 4:** `npm exec nx lint chat`, `npm exec nx affected --target=typecheck --base=origin/development-1.0`

## 8. Final Verification

- [x] 8.1 Run full backend suite: `npm exec nx test chat-api`
- [x] 8.2 Confirm no changes to `GET /api/v1/deployments` unified listing behavior (regression check in existing deployments tests)
