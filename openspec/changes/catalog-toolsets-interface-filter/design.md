## Context

The unified catalog endpoint (`GET /api/v1/catalog`) currently merges models and applications from separate DIAL Core upstreams. Toolsets are a distinct deployment category in DIAL Core — MCP-compatible servers managed via `GET /openai/toolsets` — and are currently reachable only through `GET /api/v1/toolsets` and `GET /api/v1/deployments`. The catalog page never surfaces them.

The deployments endpoint (`GET /api/v1/deployments`) accepts an `interface_type` query parameter, forwards it to DIAL Core, and also applies it in-process when serving from cache. The current spec does not define what each filter value means in terms of which deployment types are allowed or excluded. This gap means a client requesting `interface_type=chat` might receive toolsets in the response if DIAL Core includes them, or the exclusion rules might differ from what the frontend expects.

## Goals / Non-Goals

**Goals:**
- Surface toolsets in `GET /api/v1/catalog` alongside models and applications.
- Define explicit per-value semantic exclusion rules for the `interfaceTypes` filter on `GET /api/v1/deployments`, enforced in-process.
- Rename the query parameter from `interface_type` (snake_case singular) to `interfaceTypes` (camelCase plural) for consistency with camelCase query conventions and to signal multi-value intent.
- Keep in-process filtering as the single source of truth so cache hits and non-cache paths are semantically identical.

**Non-Goals:**
- UI or frontend component changes beyond updating the `server-api` wrapper.
- Changing the toolset data shape (`DialToolset` / `ToolsetOpenAi`).
- Restructuring the frontend `DeploymentsContext`.
- Altering the DIAL Core contract or `@epam/ai-dial-typescript-sdk` SDK methods.
- Adding new cache tiers or changing cache TTLs.

## Decisions

### 1. In-process filtering as the sole enforcement point

**Decision:** Semantic exclusion rules are applied entirely in-process inside `DeploymentsService.listDeployments`, not forwarded to DIAL Core.

**Why:** The unfiltered list is cached under `deployments:list:<userSub>`. If filtering were delegated to DIAL Core, a cache miss would return filtered results while a cache hit would return all items — creating inconsistent semantics between the two paths. In-process enforcement also lets us express type-level exclusion rules (e.g. `chat` never returns a `type === 'toolset'` item) independent of what DIAL Core places in the `interfaces` array.

**Alternative considered:** Forward `interfaceTypes` to DIAL Core and skip in-process filtering. Rejected: incompatible with the single shared cache, and relies on DIAL Core to enforce our presentation-layer semantics.

### 2. Exclusion rules keyed on deployment type discriminator

**Decision:** Exclusion predicates use `DeploymentItemDto.type` (`'model'` | `'application'` | `'toolset'`) as the primary guard, combined with `interfaces` array membership for fine-grained application sub-type matching.

Predicate table:

| `interfaceTypes` value | Included types | Condition on `interfaces` |
|---|---|---|
| `chat` | `model`, `application` | `interfaces` includes `'chat'` |
| `embedding` | `model` only | `interfaces` includes `'embedding'` |
| `mcp` | `toolset`, `application` | (toolset always passes) OR (`application` AND `interfaces` includes `'mcp'`) |
| `custom_ui` | `application` only | `interfaces` includes `'custom_ui'` |
| `all` | any | no `interfaces` check |

**Why:** Anchoring exclusions to `type` is safer than relying solely on `interfaces` content — it prevents future DIAL Core schema changes from accidentally leaking toolsets into a `chat` filter response.

### 3. Rename `interface_type` → `interfaceTypes`

**Decision:** The NestJS DTO field, HTTP query parameter name, and generated client property are all renamed to `interfaceTypes` (camelCase, plural).

**Why:** The existing codebase uses camelCase for multi-value query parameters (see `modelCapabilities.*` in `CatalogQueryDto`). The plural form makes explicit that the parameter accepts an array. The generated client already converts `interface_type` to `interfaceType` (singular); renaming to `interfaceTypes` (plural) aligns HTTP, DTO, and client naming.

**Alternative considered:** Keep `interface_type` and only change the plural via generated client aliases. Rejected: inconsistent naming between HTTP wire format and TypeScript DTO hurts readability.

### 4. Toolsets fetched in parallel in CatalogService

**Decision:** `CatalogService` calls `ToolsetsService.listToolsets(userSub, accessToken)` via `Promise.all` alongside the existing `ModelsService` and `ApplicationsService` calls. A failure in toolsets propagates identically to model or application failures (throws; no partial list returned).

**Why:** Parallel fetching keeps the existing latency profile. Fail-fast propagation is consistent with existing spec behavior — the catalog makes an all-or-nothing guarantee.

**Alternative considered:** Fetch toolsets sequentially; treat toolset failures as non-fatal (return partial list without toolsets). Rejected: partial list semantics are confusing and inconsistent with how models and applications already behave.

### 5. CatalogItemDto gains a `'toolset'` discriminator

**Decision:** `CatalogItemDto.type` is extended from `'model' | 'application'` to `'model' | 'application' | 'toolset'`. The Swagger enum is updated accordingly.

**Why:** Clients need to distinguish toolsets from models and applications for rendering (icon, routing, action availability). Adding the discriminator is backward-compatible for clients that already handle unknown `type` values gracefully.

## Risks / Trade-offs

- **`interfaceTypes` rename is a breaking HTTP-level change** → Existing callers using `?interface_type=…` receive 400 after migration. Mitigation: this is an in-development endpoint; coordinate with frontend callsites in the same PR. Document the rename in the OpenAPI changelog.
- **`interfaces` array may be absent on some DIAL Core items** → If `DeploymentItemDto.interfaces` is `undefined`, items will not pass any specific filter value other than `all`. This is the safe default — better to under-include than over-include. Mitigation: document in spec that `interfaces: undefined` items appear only in `all` results.
- **Toolset failure brings down catalog** → If DIAL Core's `/openai/toolsets` is degraded, the catalog becomes unavailable. Mitigation: consistent with current model/application failure behavior; callers already handle 502/503. A future change can add independent degraded-mode support.

## Open Questions

- Should `interfaceTypes=all` be treated identically to omitting the parameter, or should it be a distinct explicit signal (e.g. for analytics)? Current decision: identical behavior, no distinction needed.
- Should the `embedding` value be `'embedding'` (singular, as requested) or `'embeddings'` (plural, as in the current spec)? Current decision: align with the user's explicit requirement — use `'embedding'` (singular).
