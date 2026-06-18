## MODIFIED Requirements

### Requirement: DeploymentItemDto gains isFeatured field

`DeploymentItemDto` in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` SHALL include an optional `isFeatured?: boolean` field decorated with `@ApiPropertyOptional`.

- `isFeatured: true` — item's `id` is present in the `FEATURED_MODEL_IDS` set
- `isFeatured: false` — item's `id` is absent from the set
- The field is always present in responses (always `true` or `false`, never `undefined`, because `Set.has()` always returns a boolean)

#### Scenario: isFeatured is true for a deployment whose id is in FEATURED_MODEL_IDS

- **WHEN** `FEATURED_MODEL_IDS=gpt-4o,dial-rag` and `GET /api/v1/deployments` returns an item with `id: 'gpt-4o'`
- **THEN** that item has `isFeatured: true`

#### Scenario: isFeatured is false for a deployment whose id is not in FEATURED_MODEL_IDS

- **WHEN** `FEATURED_MODEL_IDS=gpt-4o` and the response contains an item with `id: 'chat-hub-v2'`
- **THEN** that item has `isFeatured: false`

#### Scenario: isFeatured is false for all items when FEATURED_MODEL_IDS is absent

- **WHEN** `FEATURED_MODEL_IDS` is not set
- **THEN** every item in the deployments response has `isFeatured: false`

#### Scenario: isFeatured matching is case-sensitive

- **WHEN** `FEATURED_MODEL_IDS=GPT-4o` and the response contains an item with `id: 'gpt-4o'`
- **THEN** that item has `isFeatured: false` (no match due to case difference)

## ADDED Requirements

### Requirement: DeploymentsService stamps isFeatured

`DeploymentsService` SHALL read the featured model ID set (derived from `FEATURED_MODEL_IDS`) at construction time and stamp `isFeatured` on every `DeploymentItemDto` it maps.

The stamping:
- SHALL use exact string equality (`Set.has(item.id)`) — no case folding, no glob matching
- SHALL NOT modify sort order or filtering behaviour

### Requirement: Frontend CatalogView uses existing useDeployments hook

The `CatalogView` component SHALL continue to use `useDeployments()` from `DeploymentsContext`, which fetches from `GET /api/v1/deployments`. No separate catalog endpoint is required on the frontend for this feature.

`isFeatured` flows through the existing pipeline:
`DeploymentsService` → `DeploymentItemDto.isFeatured` → `useDeployments()` → `mapDeploymentToCatalogItem` → `CatalogItem.isFeatured`

#### Scenario: Featured items appear in the Catalog UI with isFeatured flag

- **WHEN** `FEATURED_MODEL_IDS=gpt-4o` is set
- **THEN** the `CatalogItem` for `gpt-4o` passed to the `<Catalog>` component has `isFeatured: true`
