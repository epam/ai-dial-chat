## MODIFIED Requirements

### Requirement: Deployments domain structure

The backend SHALL implement the deployments feature in `apps/chat-api/src/deployments/` following the established domain pattern:

- `deployments.controller.ts` — thin controller with `@Get() listDeployments(@Query() query: DeploymentsQueryDto, @Req() req)`
- `deployments.service.ts` — `DeploymentsService` injects `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`) for the shared DIAL SDK client; calls SDK `getDeploymentsByInterfaceType`; maps and caches results
- `deployments.module.ts` — `DeploymentsModule` providing `DeploymentsService`; no external domain imports needed
- `dto/deployment-item.dto.ts` — `DeploymentItemDto` and `DeploymentsResponseDto` with `@ApiProperty` decorators
- `dto/deployments-query.dto.ts` — `DeploymentsQueryDto` with `interface_type` field: `@IsOptional`, `@IsArray`, `@IsIn([...], { each: true })`, `@Transform` for comma-separated coercion
- `tests/deployments.controller.spec.ts`
- `tests/deployments.service.spec.ts`
- `tests/deployments.controller.integration.spec.ts`

`DeploymentsModule` SHALL be imported into `AppModule`.

#### Scenario: DeploymentsModule resolves without errors

- **WHEN** NestJS boots with `DeploymentsModule` imported into `AppModule`
- **THEN** `DeploymentsService` resolves without circular dependency errors
