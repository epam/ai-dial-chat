# deployment-schema-icons Specification

## Purpose

Falling back to the application type schema's icon when an application deployment carries none of its own.

### Requirement: DeploymentItemDto exposes applicationTypeSchemaId

`DeploymentItemDto` (in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`) SHALL include an optional `applicationTypeSchemaId` string field annotated with `@ApiPropertyOptional`. `DeploymentsService.mapToDeploymentItem` SHALL read the upstream DIAL Core deployment field and map it to `applicationTypeSchemaId` when the field is present and non-empty.

Generated-client impact: after running `npm run openapi`, `DeploymentItemDto` in `libs/chat-api-client` SHALL include `applicationTypeSchemaId?: string`. Frontend callers use the normal (non-`Raw`) `listDeployments` method. No new operationId is introduced; the field is additive to the existing `GET /api/v1/deployments` response DTO.

#### Scenario: Upstream field present on application deployment

- **WHEN** DIAL Core returns a deployment object with the application type schema id field set
- **THEN** `DeploymentItemDto.applicationTypeSchemaId` MUST equal the value of that field

#### Scenario: Upstream field absent on model deployment

- **WHEN** DIAL Core returns a model deployment object with no application type schema id field
- **THEN** `DeploymentItemDto.applicationTypeSchemaId` MUST be `undefined`

---

### Requirement: ApplicationSchemaSummaryDto exposes iconUrl

`ApplicationSchemaSummaryDto` (in `apps/chat-api/src/applications/dto/application-schema.dto.ts`) SHALL include an optional `iconUrl` string field annotated with `@ApiPropertyOptional`. `ApplicationSchemasService.listApplicationSchemas` SHALL map the upstream DIAL Core schema icon field (expected key: `dial:applicationTypeIconUrl`) to `iconUrl` when present and non-empty.

Generated-client impact: after running `npm run openapi`, `ApplicationSchemaSummaryDto` in `libs/chat-api-client` SHALL include `iconUrl?: string`. Frontend callers use the normal `listApplicationSchemas` method via `getApplicationSchemas()` in `apps/chat/src/server-api/application-schemas.ts`.

#### Scenario: Schema with icon URL in upstream response

- **WHEN** the DIAL Core schema list returns a schema with `dial:applicationTypeIconUrl` set
- **THEN** `ApplicationSchemaSummaryDto.iconUrl` MUST equal that value

#### Scenario: Schema with no icon URL in upstream response

- **WHEN** the DIAL Core schema list returns a schema without `dial:applicationTypeIconUrl`
- **THEN** `ApplicationSchemaSummaryDto.iconUrl` MUST be `undefined`

---

### Requirement: DeploymentsProvider fetches schema summaries in parallel with deployments

`DeploymentsProvider` (in `apps/chat/src/context/DeploymentsContext.tsx`) SHALL call `getApplicationSchemas()` concurrently with `getDeployments()` using `Promise.allSettled` inside the same `useEffect`. When the component unmounts before both fetches complete, both results MUST be discarded via the existing `isCancelled` guard.

Cache key (BFF side): `application-schemas:list:{userSub}` with TTL 60 000 ms (already established in `ApplicationSchemasService`).

#### Scenario: Both fetches succeed

- **WHEN** both `getDeployments` and `getApplicationSchemas` resolve successfully
- **THEN** `items` MUST reflect the enriched deployment list and `isLoading` MUST be `false`

#### Scenario: Schema fetch fails, deployments succeed

- **WHEN** `getDeployments` resolves successfully and `getApplicationSchemas` rejects
- **THEN** `items` MUST contain the unenriched deployment list (without schema icon fallback), `error` MUST be `null`, and `isLoading` MUST be `false`

#### Scenario: Deployments fetch fails

- **WHEN** `getDeployments` rejects
- **THEN** `error` MUST be set, `items` MUST remain empty, and `isLoading` MUST be `false` (matching existing failure behavior)

#### Scenario: Unmount before fetches complete

- **WHEN** the component unmounts before both `Promise.allSettled` results are available
- **THEN** no state update MUST be called after unmount

---

### Requirement: Application deployments without own iconUrl use schema icon fallback

`DeploymentsProvider` SHALL derive `items` with `useMemo` after both deployments and schema summaries are available. For each item where `item.type === 'application'` and `item.iconUrl` is `undefined` or empty and `item.applicationTypeSchemaId` is defined, the provider MUST find the first schema where `schema.id === item.applicationTypeSchemaId` and set `item.iconUrl` to `schema.iconUrl`. The enriched list MUST be exposed as `items` on `DeploymentsContextType`.

#### Scenario: Application deployment without icon — matching schema with icon

- **WHEN** an application deployment has no `iconUrl`, has `applicationTypeSchemaId = "schema-abc"`, and a schema with `id = "schema-abc"` and `iconUrl = "files/bucket/icon.png"` is present in the schemas list
- **THEN** the corresponding item in `items` MUST have `iconUrl = "files/bucket/icon.png"`

#### Scenario: Application deployment without icon — no matching schema

- **WHEN** an application deployment has no `iconUrl` and `applicationTypeSchemaId = "schema-xyz"` but no schema with that id is in the schemas list
- **THEN** the corresponding item in `items` MUST have `iconUrl` equal to `undefined`

#### Scenario: Application deployment with own icon — matching schema also has icon

- **WHEN** an application deployment has `iconUrl = "own-icon.svg"` and `applicationTypeSchemaId` matches a schema that also has `iconUrl`
- **THEN** the corresponding item in `items` MUST have `iconUrl = "own-icon.svg"` (own icon wins)

#### Scenario: Model deployment is never enriched with schema icon

- **WHEN** a model deployment has no `iconUrl`
- **THEN** the corresponding item in `items` MUST have `iconUrl` equal to `undefined` regardless of whether any application schema exists

#### Scenario: Toolset deployment is never enriched with schema icon

- **WHEN** a toolset deployment has no `iconUrl`
- **THEN** the corresponding item in `items` MUST have `iconUrl` equal to `undefined` regardless of whether any application schema exists

---

### Requirement: selectedItemId behavior is unchanged

`DeploymentsProvider` SHALL continue to initialise `selectedItemId` to the first deployment's `id` on successful load, preserve an existing valid `selectedItemId` across re-renders, and reset to the first item or `null` when the previously selected id is absent from the new list. The schema fetch result MUST NOT affect `selectedItemId`.

#### Scenario: selectedItemId is preserved when still valid

- **WHEN** deployments reload and the previously selected id is still present in the list
- **THEN** `selectedItemId` MUST remain unchanged

#### Scenario: selectedItemId resets when previous selection is gone

- **WHEN** deployments reload and the previously selected id is not present in the new list
- **THEN** `selectedItemId` MUST be set to the first item's id, or `null` if the list is empty

---

### Requirement: Consumer components continue using resolveCatalogIconUrl

`ConversationRoute` (in `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`) and `ConversationView` (in `apps/chat/src/components/ConversationView/ConversationView.tsx`) SHALL continue to map `items` to `DeploymentItem[]` using `resolveCatalogIconUrl(item.iconUrl)` in a `useMemo`. No schema lookup logic SHALL be added to these components.

#### Scenario: Application deployment with schema-derived iconUrl reaches ConversationInput

- **WHEN** `DeploymentsContext.items` contains an application deployment whose `iconUrl` was set from a schema fallback (a raw DIAL file id or absolute URL)
- **THEN** `ConversationRoute` and `ConversationView` MUST pass `resolveCatalogIconUrl(iconUrl)` as the `iconUrl` to `ConversationInput`, resulting in a browser-usable URL
