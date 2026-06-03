## Context

`DeploymentsContext` today fetches deployments once on mount and exposes `items: DeploymentItemDto[]` to consumers. Consumers (`ConversationRoute`, `ConversationView`) map `items` to `DeploymentItem[]` accepted by `ConversationInput`, converting `iconUrl` through `resolveCatalogIconUrl` in a `useMemo`.

The DIAL Core API includes, for application deployments, a field that identifies the application type schema the deployment was built from. The schema list endpoint returns per-schema metadata including an icon URL. The old Redux-based `ModelIcon` component matched `schema.id === entity.applicationTypeSchemaId` and used `schema.iconUrl` as a fallback when the deployment itself had no icon. That Redux slice no longer exists; the fallback is gone.

This design adds the fallback back by:
1. Extending the BFF DTOs to surface `applicationTypeSchemaId` on deployments and `iconUrl` on application schema summaries.
2. Fetching schema summaries in `DeploymentsProvider` alongside the existing deployments fetch.
3. Computing the enriched `items` list with `useMemo` inside the provider before exposing it.

No consumer changes are needed.

## Goals / Non-Goals

**Goals:**
- Application deployments that have no own `iconUrl` but have `applicationTypeSchemaId` receive the matched schema's `iconUrl` as their `iconUrl` before being exposed via context.
- Schema fetch failure is silent: deployments remain usable, schema icon fallback is simply absent.
- `selectedItemId` selection logic is unchanged.
- Consumer components (`ConversationRoute`, `ConversationView`) require no changes.
- Library isolation: no API knowledge crosses into `libs/*`.

**Non-Goals:**
- Surfacing schema-load errors to the user (no new i18n strings, no error state on the context).
- Per-deployment detail fetches or N+1 fetches for schema detail endpoints.
- Caching schema data client-side beyond the single fetch on mount.
- Icon URL resolution (converting raw values to browser-usable URLs) — that remains `resolveCatalogIconUrl`'s responsibility.

## Decisions

### D1 — Fetch schemas in parallel inside `DeploymentsProvider`

**Decision**: Call `getApplicationSchemas()` concurrently with `getDeployments()` using `Promise.allSettled` inside the existing `loadDeployments` `useEffect`.

**Rationale**: Both fetches are needed before meaningful enrichment can happen. `Promise.allSettled` lets deployments succeed even if schemas fail (compared to `Promise.all` which would reject if either fails). Separating them into two `useEffect` calls would require extra state coordination and could cause a double-render flash where items are first shown without icons and then updated.

**Alternative considered**: A separate `useEffect` for schemas. Rejected because it introduces a race window where `items` is populated without enrichment, causing a visible icon pop-in on every mount.

### D2 — Enrich items with `useMemo` after both datasets are available

**Decision**: Derive `enrichedItems` inside the provider using `useMemo([rawDeployments, schemas])`. The enrichment rule is:

```
item.type === 'application' &&
!item.iconUrl &&
item.applicationTypeSchemaId !== undefined &&
schema.id === item.applicationTypeSchemaId
  → item.iconUrl = schema.iconUrl
```

The enriched list is exposed as `items` (same field name) so all consumers are transparent to the change.

**Rationale**: `useMemo` avoids re-running the lookup on every render while keeping the derivation co-located with the data that drives it. Reusing the `items` field name means zero consumer changes.

**Alternative considered**: Adding a separate `enrichedItems` field to the context. Rejected because it would require updating every consumer and every mock in tests.

### D3 — Do not add schema loading state to context

**Decision**: The schema fetch result is private to the provider. `isLoading` and `error` on the context still reflect only the deployments fetch. Schema fetch failure is swallowed silently.

**Rationale**: No consumer currently needs to know whether schemas loaded. Adding `isSchemasLoading` / `schemasError` to the context type would be dead state that no consumer uses, violating the YAGNI principle. If a future feature needs to expose it, it can be added then.

### D4 — Backend field mapping

**Decision**: 
- `DeploymentItemDto.applicationTypeSchemaId` is mapped from the upstream DIAL Core deployment object field. The exact upstream key must be confirmed by inspecting the SDK response shape before implementation (likely `application_type_schema_id` or a nested field). The mapping lives in `mapToDeploymentItem` in `deployments.service.ts`.
- `ApplicationSchemaSummaryDto.iconUrl` is mapped from `item['dial:applicationTypeIconUrl']` in `listCustomApplicationSchemas`. If DIAL Core returns the icon only on the detail endpoint and not the list endpoint, that must be documented; N+1 fetching per schema is not justified and schema icons will remain absent until the list endpoint includes the field.

**Rationale**: The list endpoint is already called; adding one field to the mapping is free. Detail endpoint per schema would be O(N) network requests and is not acceptable for the model selector load path.

### D5 — Generated client is the only transport

**Decision**: Frontend uses `getApplicationSchemas()` from `apps/chat/src/server-api/application-schemas.ts`, which already wraps `applicationsApi.listApplicationSchemas()`. No new server-api wrappers are needed. The new DTO fields appear automatically after regenerating `libs/chat-api-client` via `npm run openapi`.

**Rationale**: Follows the project convention that all business endpoints go through the generated client. No `base.ts` exception is needed.

### D6 — Cancellation

**Decision**: The existing `signal.isCancelled` pattern (an object with a boolean property, mutated in the cleanup function) is reused for the combined fetch `useEffect`. Both the deployments and schema results are discarded when `isCancelled` is true.

**Rationale**: Consistent with `useFavicon.ts` and the existing `loadDeployments` pattern in the same file. `AbortController` is not used because the generated client does not thread `AbortSignal` through.

## Risks / Trade-offs

**Risk: Upstream field name is wrong** → `applicationTypeSchemaId` arrives as `undefined` for all deployments, fallback never fires but nothing breaks. Mitigation: confirm the upstream shape by logging or inspecting the raw SDK response object before implementing the mapping.

**Risk: Schema list endpoint does not include `iconUrl`** → icons remain absent. Mitigation: check DIAL Core schema list response shape before finalising the DTO mapping. If the field is absent from the list response, document the gap and link the upstream ticket.

**Risk: `Promise.allSettled` hides schema fetch errors silently** → schema icons quietly absent without any log entry. Mitigation: log a warning in the provider when the schema fetch settles as rejected (debug/warn level only, no user-visible error).

**Risk: Both fetches take time, `isLoading` covers only deployments** → consumers that show a spinner based on `isLoading` will stop spinning before schemas are resolved. Because schemas are used only for icon fallback (purely cosmetic) this is acceptable. Icons will be present when both fetches complete because `useMemo` re-runs after schemas arrive.

## Migration Plan

1. Backend slice (DTO extensions + service mapping + regenerated client) can be merged independently; new optional fields are backwards-compatible.
2. Frontend slice (`DeploymentsContext` parallel fetch + `useMemo` enrichment + updated tests) depends on the regenerated client being in place.
3. No rollback complexity — both changes are additive and optional fields default to `undefined`.

## Open Questions

1. **Exact upstream field name for `applicationTypeSchemaId`**: Check `RawDeployment` shape in SDK response before implementing `mapToDeploymentItem`. Candidate names: `application_type_schema_id`, `applicationTypeSchemaId`.
2. **`dial:applicationTypeIconUrl` on the list endpoint**: Verify the schema list response from `listCustomApplicationSchemas` includes this key. The `ApplicationSchemasService` already maps `dial:applicationTypeDisplayName` etc., so the pattern is established — confirm icon key exists and add it.
