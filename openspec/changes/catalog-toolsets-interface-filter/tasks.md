## 1. Backend — deployments query DTO rename

- [ ] 1.1 Rename `interface_type` to `interfaceTypes` in `apps/chat-api/src/deployments/dto/deployments-query.dto.ts`; update `@IsIn` enum to `['chat', 'embedding', 'mcp', 'custom_ui', 'all']`; update `@Transform` for comma-separated coercion; update `@ApiQuery` annotation
- [ ] 1.2 Update `DeploymentsService.listDeployments` signature and internal references from `interface_type` to `interfaceTypes`
- [ ] 1.3 Update the controller `listDeployments` call to pass `query.interfaceTypes`

## 2. Backend — in-process interfaceTypes filter semantics

- [ ] 2.1 Extract or create a pure `applyInterfaceTypeFilter(items: DeploymentItemDto[], interfaceTypes: string[]): DeploymentItemDto[]` function in `apps/chat-api/src/deployments/deployments.service.ts` (or a co-located `deployments-filter.ts`)
- [ ] 2.2 Implement the per-value predicate table: `chat` (model|application, interfaces includes 'chat', no toolsets), `embedding` (model only, interfaces includes 'embedding'), `mcp` (toolset always + application with interfaces 'mcp', no models), `custom_ui` (application only with interfaces 'custom_ui'), `all` (pass all)
- [ ] 2.3 Apply union semantics when multiple `interfaceTypes` values are provided (item passes if any predicate matches)
- [ ] 2.4 Ensure items with `interfaces: undefined` pass only `all` (or omitted parameter); verify the existing cache path uses the new filter

## 3. Backend — deployments service tests

- [ ] 3.1 Add unit tests for the `applyInterfaceTypeFilter` function covering each filter value and its exclusion rules (chat excludes toolsets, embedding excludes applications and toolsets, mcp excludes models, custom_ui excludes models and toolsets)
- [ ] 3.2 Add multi-value union test: item matching any value is included; item matching none is excluded
- [ ] 3.3 Add test: item with `interfaces: undefined` is excluded by specific filters, included by `all`
- [ ] 3.4 Update `deployments.service.spec.ts` to use `interfaceTypes` (plural) in all existing filter scenarios
- [ ] 3.5 Add integration test: `GET /api/v1/deployments?interfaceTypes=unknown` returns 400; `?interface_type=chat` returns 400 (old name rejected)

## 4. OpenAPI and generated client

- [ ] 4.1 Run `npm run openapi` to regenerate `@epam/chat-api-client`; verify `ListDeploymentsRequest.interfaceTypes?: string[]` (plural) in the generated client
- [ ] 4.2 Run `npm run openapi:check` to confirm the generated client is in sync
- [ ] 4.3 Verify `npm exec nx build chat-api` and `npm exec nx lint chat-api` pass with no type errors

## 5. Frontend — server-api wrapper update

- [ ] 5.1 Update `apps/chat/src/server-api/deployments.api.ts`: rename the parameter from `interfaceType` to `interfaceTypes` (plural) in `getDeployments` and the `listDeployments` call; ensure TypeScript compiles without errors
- [ ] 5.2 Update any callers of `getDeployments` in the frontend to pass `interfaceTypes` (plural) if applicable

## 6. Backend — catalog endpoint adds toolsets

- [ ] 6.1 Inject `ToolsetsService` into `CatalogService` (add `ToolsetsModule` to `CatalogModule` imports if not already present)
- [ ] 6.2 Update `CatalogService` to call `ToolsetsService.listToolsets(userSub, accessToken)` in `Promise.all` alongside `listModels` and `listApplications`
- [ ] 6.3 Map `DialToolsetDto[]` from toolsets response to `CatalogItemDto[]` with `type: 'toolset'`; extend `CatalogItemDto.type` enum to include `'toolset'`
- [ ] 6.4 Verify `CatalogFilterService.apply` passes toolset items through unchanged (no model capability predicates applied to toolsets)
- [ ] 6.5 Update `CatalogResponseDto` Swagger `@ApiProperty` for the `type` discriminator enum to include `'toolset'`

## 7. Backend — catalog service tests

- [ ] 7.1 Add unit test: catalog merges models, applications, and toolsets from three parallel calls
- [ ] 7.2 Add unit test: toolset failure causes full request to fail (consistent with model/application behavior)
- [ ] 7.3 Add unit test: capability filter does not exclude toolsets (toolsets always pass capability predicates)
- [ ] 7.4 Add unit test: cache hit includes toolsets from cached list

## 8. Verification

- [ ] 8.1 Run `npm exec nx test chat-api` — all tests pass
- [ ] 8.2 Run `npm exec nx lint chat-api` — no lint errors
- [ ] 8.3 Run `npm exec nx build chat-api` — build succeeds
- [ ] 8.4 Run `npm run openapi && npm run openapi:check` — generated client is in sync
- [ ] 8.5 Run `npm exec nx affected --target=typecheck --base=origin/development-1.0` — no TypeScript errors
