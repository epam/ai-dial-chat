## 1. Environment Config

- [x] 1.1 Add `FEATURED_MODEL_IDS` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts` as `@IsOptional() @IsString({ each: true })` with a `@Transform` that splits on `,`, trims each token, and discards empty strings, producing `string[]`
- [x] 1.2 Add `FEATURED_MODEL_IDS` to `.env.example` with an inline comment explaining the format and that a restart is required to pick up changes

## 2. DeploymentItemDto — isFeatured field

- [x] 2.1 Add `isFeatured?: boolean` field to `DeploymentItemDto` in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` with `@ApiPropertyOptional({ description: '...' })`
- [x] 2.2 Ensure `isFeatured` is always a boolean in responses (never `undefined`) — `Set.has(id)` always returns `true` or `false`

## 3. DeploymentsService — featured stamping

- [x] 3.1 In `DeploymentsService` (`apps/chat-api/src/deployments/deployments.service.ts`), inject `ConfigService<EnvironmentVariables>` and build a `Set<string>` from `config.get('FEATURED_MODEL_IDS') ?? []` in the constructor
- [x] 3.2 Pass `featuredIds` into `mapToDeploymentItem` and set `isFeatured: featuredIds.has(raw.id)` for every `DeploymentItemDto` produced
- [x] 3.3 Sort order is unchanged — `isFeatured` stamping does not affect the existing ordering logic

## 4. Tests

- [x] 4.1 Add unit tests in `apps/chat-api/src/deployments/tests/` (or equivalent) covering:
  - items with matching IDs get `isFeatured: true`
  - items with non-matching IDs get `isFeatured: false`
  - all items get `isFeatured: false` when `FEATURED_MODEL_IDS` is absent/empty
  - case-sensitive matching (uppercase env value does not match lowercase ID)
- [x] 4.2 Run `npm exec nx test chat-api` and confirm all tests pass

## 5. Build & Lint

- [x] 5.1 Run `npm exec nx build chat-api` and `npm exec nx lint chat-api` to confirm no type errors or lint violations

## 6. Frontend — isFeatured flows through existing pipeline

- [x] 6.1 `CatalogView` continues to use `useDeployments()` — no changes to the fetching mechanism
- [x] 6.2 `mapDeploymentToCatalogItem` in `apps/chat/src/utils/map-deployment-to-catalog-item.ts` already maps `isFeatured: deployment.isFeatured ?? false`
- [x] 6.3 Run `npm exec nx lint chat` and `npm exec nx build chat` to confirm no type errors

## 7. Verification

- [ ] 7.1 Start the API locally, set `FEATURED_MODEL_IDS=<a-real-model-id>` in `.env`, and call `GET /api/v1/deployments` — confirm the matching item has `isFeatured: true` and others have `isFeatured: false`
- [ ] 7.2 Unset `FEATURED_MODEL_IDS` and repeat — confirm all items have `isFeatured: false`
