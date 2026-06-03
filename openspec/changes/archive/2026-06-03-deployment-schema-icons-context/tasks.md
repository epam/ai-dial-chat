## 1. Investigate Upstream Field Names

- [x] 1.1 Inspect the raw SDK response shape from `this.client.getDeploymentsByInterfaceType` in `apps/chat-api/src/deployments/deployments.service.ts` to confirm the exact upstream field name for the application type schema id (candidate: `application_type_schema_id`). Document the confirmed field name as a comment in `RawDeployment`.
- [x] 1.2 Inspect the raw SDK response shape from `this.client.listCustomApplicationSchemas` in `apps/chat-api/src/applications/application-schemas.service.ts` to confirm the upstream key for the schema icon (candidate: `dial:applicationTypeIconUrl`). Document the confirmed field name as a comment in the mapping block.

## 2. Extend Backend DTOs

- [x] 2.1 In `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`, add `@ApiPropertyOptional({ description: 'Application type schema id from DIAL Core' }) applicationTypeSchemaId?: string` to `DeploymentItemDto`.
- [x] 2.2 In `apps/chat-api/src/applications/dto/application-schema.dto.ts`, add `@ApiPropertyOptional({ description: 'Icon URL from DIAL Core application type schema' }) iconUrl?: string` to `ApplicationSchemaSummaryDto`.

## 3. Extend Backend Service Mappings

- [x] 3.1 In `apps/chat-api/src/deployments/deployments.service.ts`, add `application_type_schema_id?: string` (or the confirmed field name) to the `RawDeployment` type and map it to `applicationTypeSchemaId` inside `mapToDeploymentItem` (set only when type is `'application'` and the field is non-empty).
- [x] 3.2 In `apps/chat-api/src/applications/application-schemas.service.ts`, map `item['dial:applicationTypeIconUrl']` (or the confirmed key) to `iconUrl` inside the `schemas.map(...)` block of `listApplicationSchemas`.

## 4. Update Backend Tests

- [x] 4.1 In `apps/chat-api/src/deployments/tests/` (deployments service spec), add a test scenario: application deployment with upstream `application_type_schema_id` set → `DeploymentItemDto.applicationTypeSchemaId` equals that value.
- [x] 4.2 In `apps/chat-api/src/deployments/tests/` (deployments service spec), add a test scenario: model deployment → `applicationTypeSchemaId` is `undefined`.
- [x] 4.3 In `apps/chat-api/src/applications/tests/application-schemas.service.spec.ts`, add a test scenario: schema with upstream icon key set → `ApplicationSchemaSummaryDto.iconUrl` equals that value.
- [x] 4.4 In `apps/chat-api/src/applications/tests/application-schemas.service.spec.ts`, add a test scenario: schema without upstream icon key → `iconUrl` is `undefined`.

## 5. Regenerate OpenAPI Client

- [x] 5.1 Run `npm run openapi` to regenerate `libs/chat-api-client` from the updated Swagger output. Verify `DeploymentItemDto` in `libs/chat-api-client/src/generated/src/models/index.ts` includes `applicationTypeSchemaId?: string`.
- [x] 5.2 Verify `ApplicationSchemaSummaryDto` in the generated models includes `iconUrl?: string`.
- [x] 5.3 Run `npm run openapi:check` to confirm the generated client matches the spec (no drift).
- [x] 5.4 Build and lint `chat-api-client`: `npm exec nx build chat-api-client && npm exec nx lint chat-api-client`.

## 6. Update Frontend Context

- [x] 6.1 In `apps/chat/src/context/DeploymentsContext.tsx`, replace the single `getDeployments(...)` call with `Promise.allSettled([getDeployments([ListDeploymentsInterfaceTypeEnum.Chat]), getApplicationSchemas()])` inside `loadDeployments`. Store resolved schemas in a local variable; log a console warning when the schema fetch settles as rejected.
- [x] 6.2 Add a `useMemo` that derives the enriched items list from `rawDeployments` and `schemas`: for each item where `item.type === 'application'` and `!item.iconUrl` and `item.applicationTypeSchemaId`, find the matching schema and assign `schema.iconUrl` as a fallback. Expose the result as `items` on the context value (replacing the direct `rawDeployments` reference).
- [x] 6.3 Ensure the `isCancelled` guard covers both fetch results — neither `setItems` nor any downstream enrichment runs after unmount.
- [x] 6.4 Wrap the enrichment `useMemo` deps correctly so it only re-runs when `rawDeployments` or `schemas` change (not on every render).

## 7. Update Frontend Context Tests

- [x] 7.1 In `apps/chat/src/context/tests/DeploymentsContext.spec.tsx`, add a mock for `../../server-api/application-schemas` alongside the existing `deployments.api` mock.
- [x] 7.2 Add test: application deployment with no `iconUrl` and `applicationTypeSchemaId = 'schema-abc'` — schema list contains a matching schema with `iconUrl = 'files/bucket/icon.png'` → `items[n].iconUrl` equals `'files/bucket/icon.png'`.
- [x] 7.3 Add test: application deployment with no `iconUrl` and `applicationTypeSchemaId = 'schema-xyz'` — no matching schema → `items[n].iconUrl` is `undefined`.
- [x] 7.4 Add test: application deployment with own `iconUrl = 'own.svg'` and a matching schema with `iconUrl` → `items[n].iconUrl` remains `'own.svg'`.
- [x] 7.5 Add test: model deployment with no `iconUrl` — never enriched regardless of schemas → `items[n].iconUrl` is `undefined`.
- [x] 7.6 Add test: toolset deployment with no `iconUrl` — never enriched → `items[n].iconUrl` is `undefined`.
- [x] 7.7 Add test: `getApplicationSchemas` rejects — deployments load successfully, `error` is `null`, `items` is the unenriched deployment list.
- [x] 7.8 Update existing tests that mock `getDeployments` to also mock `getApplicationSchemas` (return `{ schemas: [] }` by default) so they continue to pass.

## 8. Verify Consumer Mocks (if needed)

- [x] 8.1 Check `apps/chat/src/pages/ConversationRoute/ConversationRoute.spec.tsx` (if it exists) — if it mocks `DeploymentsContext` items directly, add `applicationTypeSchemaId` to any application-typed mock items to keep the mock type-correct after DTO extension.
- [x] 8.2 Check `apps/chat/src/components/ConversationView/tests/` (if it exists) — same mock type-correctness check for application deployment mocks.

## 9. Final Verification

- [x] 9.1 `npm exec nx test chat-api` — all tests pass.
- [x] 9.2 `npm exec nx lint chat-api` — no lint errors.
- [x] 9.3 `npm exec nx test chat` — all tests pass.
- [x] 9.4 `npm exec nx lint chat` — no lint errors.
