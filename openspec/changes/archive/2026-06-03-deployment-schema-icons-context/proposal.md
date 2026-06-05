## Why

Application deployments in DIAL can be typed by a schema (`applicationTypeSchemaId`) that carries display metadata, including an icon. The frontend previously resolved schema icons via a Redux store slice (`ModelIcon` component), but that slice no longer exists in the current React-Context architecture. As a result, application deployments that have no `iconUrl` of their own—but do have a schema with an icon—render with no icon in the model selector. Restoring this fallback requires two small backend DTO extensions and a coordinated change to `DeploymentsContext`.

## What Changes

- **Backend — `DeploymentItemDto`**: add optional `applicationTypeSchemaId` field; map it from the upstream DIAL Core field in `DeploymentsService`.
- **Backend — `ApplicationSchemaSummaryDto`**: add optional `iconUrl` field; map it from `dial:applicationTypeIconUrl` (or equivalent upstream field) in `ApplicationSchemasService`.
- **Generated client (`libs/chat-api-client`)**: regenerate via `npm run openapi` so the new fields appear in the TypeScript types consumed by the frontend.
- **Frontend — `DeploymentsContext`**: fetch application schema summaries in parallel with deployments; derive enriched deployment items using `useMemo` — for each application deployment whose `iconUrl` is absent but `applicationTypeSchemaId` matches a schema, use that schema's `iconUrl` as a fallback. Expose the enriched list as `items`.
- **No changes to consumer components**: `ConversationRoute` and `ConversationView` continue mapping `items` through `resolveCatalogIconUrl` exactly as today.

Historical note: the old `ModelIcon` component selected `applicationTypeSchemas` from a Redux store, found the matching schema by `schema.id === entity.applicationTypeSchemaId`, and used `schema.iconUrl`. This change restores that semantic, adapted to the current context-based architecture.

## Capabilities

### New Capabilities

- `deployment-schema-icons`: Application deployments inherit an icon from their linked application type schema when the deployment itself carries no `iconUrl`. Schema icon fallback is silent — failure to load schemas does not break deployment loading.

### Modified Capabilities

<!-- No existing spec-level requirements are changing — this is a net-new capability. -->

## Impact

- `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` — new optional field
- `apps/chat-api/src/deployments/deployments.service.ts` — upstream field mapping (exact upstream key to be confirmed before implementation)
- `apps/chat-api/src/applications/dto/application-schema.dto.ts` — new optional field
- `apps/chat-api/src/applications/application-schemas.service.ts` — upstream field mapping
- `libs/chat-api-client/` — regenerated; no hand-edits
- `apps/chat/src/context/DeploymentsContext.tsx` — parallel fetch + `useMemo` enrichment
- `apps/chat/src/context/tests/DeploymentsContext.spec.tsx` — new test scenarios
- No changes required in `ConversationRoute`, `ConversationView`, or any lib
- No new i18n strings expected unless schema-load errors are surfaced to users (out of scope for this change)
