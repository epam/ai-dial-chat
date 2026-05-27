## Context

`GET /api/v1/catalog` currently fetches `GET /openai/models` and `GET /openai/applications` from DIAL Core in parallel, merges them into a `CatalogItemDto[]` array, and sorts by display name. Toolsets are absent. DIAL Core 0.1.0-dev.16 introduced `GET /v1/deployments` which returns all three types in one call and supports server-side `interface_type` filtering. The SDK has been upgraded to `0.1.0-dev.16`.

Frontend consumers of deployment data today are: `CatalogContext` (model selector in conversation input) and `ModelsContext` (model list in sidebar — not affected).

## Goals / Non-Goals

**Goals:**
- Expose `GET /api/v1/deployments` in chat-api, proxying DIAL Core `GET /v1/deployments`.
- Support optional `interface_type` query param (multi-value: `chat | embeddings | mcp | custom_ui | all`).
- Return a flat `{ deployments: DeploymentItemDto[] }` response, where each item carries a `type` discriminator (`model | application | toolset`).
- Replace `CatalogContext` with `DeploymentsContext` as the source of deployments for the conversation model selector.
- Fully remove the `catalog` domain: `CatalogModule`, `CatalogService`, `CatalogFilterService`, `CatalogController`, all catalog DTOs, `CatalogContext`, `useCatalog`, `server-api/catalog.ts`, `CatalogItemDto`.
- Update `model-selector-in-chat-input` openspec to reference the deployments API.
- Keep `ModelsContext` and `GET /api/v1/models` fully operational.

**Non-Goals:**
- Replacing or merging `ModelsContext` (sidebar model list stays on `/api/v1/models`).
- Pagination — DIAL Core returns all items; we pass through the full list.
- Any filtering beyond `interface_type` at this endpoint.

## Decisions

### 1. Endpoint path: `/api/v1/deployments`

**Decision:** The new chat-api endpoint is versioned at `/api/v1/deployments`, matching the DIAL Core path convention and replacing the catalog entirely.

**Rationale:** Naming it `deployments` directly aligns with the upstream DIAL Core `/v1/deployments` path and is more accurate than `catalog` (which implied a curated merge). There is no reason to keep both; the catalog's only consumer is the conversation model selector, which migrates to `DeploymentsContext`.

**Alternative considered:** Keep the catalog and add listings as an additive endpoint — rejected because it leaves dead code and two sources of truth for deployment data.

---

### 2. Full catalog removal

**Decision:** Delete `apps/chat-api/src/catalog/` entirely (module, service, filter service, controller, DTOs, tests). Remove `CatalogContext`, `useCatalog`, `server-api/catalog.ts`, and `CatalogItemDto` from `apps/chat/src/`.

**Rationale:** The catalog was the only integration point between the chat-api and DIAL Core deployment data for the conversation selector. With `DeploymentsContext` in place, there are no remaining consumers. Keeping dead code increases maintenance burden and confuses future readers.

**Migration:** `GET /api/v1/catalog` will return 404 after removal. No external clients depend on it — it was an internal BFF endpoint consumed only by the frontend.

---

### 3. Response shape: `{ deployments: DeploymentItemDto[] }` with `type` discriminator

**Decision:** Return `{ deployments: DeploymentItemDto[] }` where `DeploymentItemDto` has a required `type: 'model' | 'application' | 'toolset'` field alongside common fields (`id`, `displayName`, `iconUrl`, `description`, `interfaces`).

**Rationale:** DIAL Core returns a union of `ModelOpenAi | ApplicationOpenAi | ToolsetOpenAi`. We normalise this into a flat DTO with a discriminator field, mapping DIAL Core's `object` field (`"model"` → `'model'`, `"application"` → `'application'`) and inferring `'toolset'` for `ToolsetOpenAi` entries (identified by presence of `toolset` field). This makes frontend rendering straightforward.

**Fields mapped from DIAL Core:**

| `DeploymentItemDto` field | DIAL Core source |
|---|---|
| `id` | `id` (non-null; skip if absent) |
| `displayName` | `display_name` → fallback `id` |
| `type` | `object` (`"model"` → `'model'`, `"application"` → `'application'`) or `'toolset'` for `ToolsetOpenAi` |
| `iconUrl` | `icon_url` |
| `description` | `description` |
| `interfaces` | `interfaces` (string array) |

---

### 4. `interface_type` as a repeatable query param

**Decision:** Accept `interface_type` as an array query param (`?interface_type=chat&interface_type=mcp`), validated against `('chat' | 'embeddings' | 'mcp' | 'custom_ui' | 'all')` using `class-validator` `@IsIn` + `@IsArray`. Omitting the param returns all deployments (DIAL Core defaults to `all`).

**Rationale:** NestJS `@Query` with `@Transform` handles array coercion from both repeated and comma-separated formats. The unfiltered list is cached; filtering is applied in-process after cache retrieval.

---

### 5. Caching: per-user, 30 s, unfiltered

**Decision:** Cache the full DIAL Core response under key `deployments:list:<userSub>` for 30 000 ms. Apply `interface_type` filtering after cache retrieval, same as the catalog pattern.

**Rationale:** Filtering is cheap in-process. Caching filtered variants per param combination would multiply cache entries with little benefit given the 30 s TTL.

---

### 6. `DeploymentsContext` replaces `CatalogContext`

**Decision:** Create `DeploymentsContext.tsx` in `apps/chat/src/context/` with the same surface as `CatalogContext` but using `DeploymentItemDto` and `getDeployments()`. Remove `CatalogContext.tsx` and `CatalogProvider` from all route wrappers.

**Rationale:** One source of truth. The existing `model-selector-in-chat-input` spec wires the context into the selector — we update that spec delta accordingly.

---

### 7. Generated client via `npm run openapi`

**Decision:** Do not hand-write client code. Run `npm run openapi` after adding the Swagger-annotated controller to auto-generate `DeploymentsApi`. Remove `CatalogApi` from `api-client.ts`.

**Rationale:** Keeps the client in sync with the OpenAPI spec. Consistent with all other domains.

## Risks / Trade-offs

- **Catalog removal is irreversible without git revert**: No fallback endpoint after removal. Risk: low — the catalog was internal-only. Mitigation: the work is behind a feature branch.
- **Toolset items in selector**: `DeploymentItemDto` includes `type: 'toolset'` items. The `catalog-model-selector` UI spec groups items by type — grouping logic must handle `'toolset'` without breaking. Risk: low — grouping is additive.
- **DIAL Core `/v1/deployments` availability**: If DIAL Core is older than `0.1.0-dev.16`, the endpoint returns 404. Mitigation: 502/503 error mapping surfaces this clearly.
- **Cache key**: `deployments:list:<sub>` replaces `catalog:list:<sub>` — no collision risk, old cache entries expire naturally within 30 s.
