## Context

`DeploymentsService` (`apps/chat-api/src/deployments/deployments.service.ts`) extends `AppService` and already talks to DIAL Core through `this.client`, the shared `@epam/ai-dial-typescript-sdk` instance built in `apps/chat-api/src/app/app.service.ts:25`. It has three existing operations: `listDeployments` (`getDeploymentsByInterfaceType`, 30s-cached), `getDeploymentConfiguration` (`configurationDeployment`, 60s-cached), `getDeploymentLimits` (`getDeploymentLimits`, uncached). None of these fetch the richer per-entity payload DIAL Core exposes on `getModel` / `getApplication` / `getToolset`.

On the frontend, `CatalogView.tsx:66-72` passes a stub `fetchAboutContent` to the `Catalog` lib component's `onFetchAboutContent` prop — the only existing hook for on-demand detail loading. `Catalog` only otherwise takes `details?: CatalogItemTabData` as a static field pre-attached to each `CatalogItem` (`libs/catalog/src/models/catalog-item.ts:42`), which is unsuitable here: fetching every deployment's full detail up front would bloat the already-cached list response and DIAL Core detail calls. The type/mapper scaffolding for structured details (`apps/chat/src/types/entity-details.ts`, `apps/chat/src/utils/map-entity-details-to-catalog.ts`) exists but has no producer.

## Goals / Non-Goals

**Goals:**
- Fetch full per-entity DIAL Core data by id, on demand, only when a user opens a catalog item's detail panel.
- Support all three deployment kinds — model, application, toolset — through one endpoint shape, dispatching on type server-side.
- Forward safe, display-worthy fields not currently in `DeploymentItemDto`/`RawDeploymentDto` (capabilities, tokenizer/limits/pricing, function metadata, toolset transport/tools/auth summary) without exposing internal or secret fields.
- Keep `libs/catalog` host-agnostic: it gains a generic `onFetchDetails` callback prop, not any DIAL-specific knowledge.
- Reuse the existing `mapEntityDetailsToCatalogDetails` mapper and `EntitySpecificDetails` types rather than inventing a second details shape.

**Non-Goals:**
- No change to `GET /api/v1/deployments`'s cached list payload or its `DeploymentItemDto` shape — the detail endpoint is additive and separate.
- No exposure of `function.env`, `function.source_folder`/`target_folder`, `auth_settings` secrets/client credentials, raw `reference`, or `editor_url` (editor access is governed by the apps-editor flow, not the catalog).
- No new caching layer beyond a short-TTL cache mirroring `getDeploymentConfiguration`'s pattern — this is a read-mostly, per-id lookup, not a list.
- *(Post-launch)* `onFetchAboutContent` was removed as dead code (see Decision 4) rather than left as-is — it never resolved real data, so keeping it added surface with no behavior.

## Decisions

### 1. One endpoint, server-side dispatch by type — not three separate routes
`GET /api/v1/deployments/{deployment}/details` accepts any deployment id. `DeploymentsService.getDeploymentDetails(id, headers)` first determines the type using the same discrimination already used in `listDeployments` (`raw.toolset !== undefined` → toolset; `raw.object === 'application'` → application; else model — `deployments.service.ts:37-51`), or, cheaper, resolves type from the cached `deployments:list:<userSub>` entry when present before deciding which SDK call (`getModel`/`getApplication`/`getToolset`) to make. One route keeps the frontend wrapper and `libs/catalog` callback signature simple (`(item: CatalogItem) => Promise<...>`, no per-type branching in the lib or in `CatalogView`).
- Alternative rejected: three routes (`/models/{id}/details`, `/applications/{id}/details`, `/toolsets/{id}/details`). Rejected because the frontend already treats catalog items polymorphically (`CatalogItem.type`), and a single route avoids leaking type-routing logic into `CatalogView`; the existing `deployment-configuration` and `deployment-limits` routes already use the generic `{deployment}` path segment as precedent.

### 2. New `DeploymentDetailsDto`, not an extended `DeploymentItemDto`
A separate response DTO (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts`) carries the richer, type-specific fields. `DeploymentItemDto` stays as the list shape.
- Alternative rejected: adding all new fields as optional properties on `DeploymentItemDto` and reusing it for both list and detail. Rejected because it would force every list item's Swagger schema to advertise fields that are only ever populated on the detail call, misleading API consumers and inflating the (already 30s-cached, called-on-every-catalog-load) list response's documented shape.
- The DTO models three optional sub-objects gated by `type` (`modelDetails?`, `applicationDetails?`, `toolsetDetails?`), mirroring the `ModelEntityDetails`/`AgentEntityDetails`/`ToolsetEntityDetails` split already defined in `apps/chat/src/types/entity-details.ts` — the backend DTO and frontend domain type stay structurally aligned so the mapping step in `CatalogView` is a straight field-by-field transcription, not a reshaping.

### 3. Cache the detail response, short TTL, same key convention as `getDeploymentConfiguration`
Cache key `deployments:details:<deploymentId>`, TTL 60 000 ms (matches `getDeploymentConfiguration`'s existing 60s — `deployments.service.ts:265-313`). Invalidation is time-based only (no write path exists for deployments from this app, so there is no explicit invalidation event to hook).
- Alternative rejected: no caching. Rejected because opening/closing the same catalog item repeatedly (e.g. tab switches within the details panel) would otherwise hit DIAL Core on every open; a short TTL bounds staleness without needing an invalidation hook.

### 4. Extend `libs/catalog` with `onFetchDetails`, mirroring `onFetchAboutContent`
Add `onFetchDetails?: (item: CatalogItem) => Promise<CatalogItemTabData | undefined>` to `CatalogProps` (`libs/catalog/src/models/catalog-props.ts`). `Catalog.tsx` calls it when the details panel opens (initially the same effect shape that drove `aboutContent`/`isAboutLoading`), storing the result in new `details`/`isDetailsLoading` state, and merges it with any statically-provided `item.details` (fetched taking precedence, since it's always more current).

*(Post-launch revision)* `onFetchAboutContent`/`aboutContent`/`isAboutLoading` were removed entirely. `CatalogView.tsx`'s `fetchAboutContent` had always resolved `undefined` — it fetched nothing — so the async fetch-on-open plumbing for the Intro section added complexity without ever producing real data. Requirements changed to add a genuinely new, still-backend-pending field: `CatalogItem.intro?: string`, distinct from the existing `description`. The Intro section (`AboutTab`) now reads `item.intro ?? item.description` directly and synchronously — no fetch, no loading state, no `onFetchAboutContent` prop. `onFetchDetails`/`isDetailsLoading` (Overview/Pricing/API/Tools tabs) are unaffected; only the Intro-specific async plumbing was removed.
*(Second post-launch revision)* An earlier iteration of this change had also removed a separate `About` tab from the tab row, folding its content into the Intro section only, specifically because the tab and the Intro section rendered the exact same text twice with no visual distinction. Requirements changed again: the `About` tab is restored as an explicit, always-present first tab (`CatalogDetailsTab.About`).

*(Third post-launch revision)* The restored `About` tab initially reused the same `item.intro ?? item.description` fallback as the Intro section, which reintroduced the same-content-twice problem the second revision was meant to avoid — for a toolset with both fields populated, the tab and the Intro section showed identical `intro` text. Requirements changed again: the two surfaces now render deliberately different content through the same shared `AboutTab` component, which no longer derives its own fallback — it takes an explicit `content: string` prop and the caller decides what to pass. The Intro section (`Summary.tsx`) passes `item.intro ?? item.description` (intro-first, falls back to description). The `About` tab (`DetailsPanel.tsx`) passes `item.description` unconditionally, regardless of whether `item.intro` is set. This is the final, intended behavior: Intro is a short teaser that may be enriched by `intro`, About is always the full `description`.
- Alternative rejected: pass a pre-fetched `details` on every `CatalogItem` from `CatalogView`. Rejected per Non-Goals — would require fetching every item's detail eagerly on catalog load, defeating the point of a lazy per-id endpoint and adding N DIAL Core calls to every catalog page view.
- This keeps `libs/catalog` fully host-agnostic per the library isolation rule: the lib only knows "call this async function and render what it returns," never the DIAL endpoint path, DTO shape, or `@epam/chat-api-client`. All of that knowledge lives in `CatalogView.tsx`, which is the app-level adapter.

### 5. `CatalogView` owns the mapping: DTO → `EntitySpecificDetails` → `CatalogItemTabData`
`onFetchDetails` in `CatalogView.tsx` calls the new `apps/chat/src/server-api` wrapper, converts the raw `DeploymentDetailsDto` into the appropriate `EntitySpecificDetails` variant based on `item.type`, and passes it through the existing (currently unwired) `mapEntityDetailsToCatalogDetails`. No new mapping logic is invented for the tab-data shape — only a new DTO→domain-type step is added ahead of the existing domain-type→tab-data step.
- Alternative rejected: skip `EntitySpecificDetails` and map the DTO directly to `CatalogItemTabData` in one function. Rejected because `EntitySpecificDetails`/`mapEntityDetailsToCatalogDetails` are already reviewed, tested scaffolding built for exactly this purpose; bypassing them would leave dead code in the tree and duplicate the tab-shaping logic.

## Risks / Trade-offs

- [DIAL Core detail calls (`getModel`/`getApplication`/`getToolset`) may be slower than the cached list call, and every first-time panel open pays that latency] → Mitigate with the `isDetailsLoading` state added to `Catalog.tsx` (skeleton/spinner in the panel while pending) and the 60s cache to keep repeat opens fast.
- [Type misdetection for an id (e.g. stale client-side `item.type` vs. DIAL Core's current classification) could call the wrong SDK method and 404] → `getDeploymentDetails` re-derives type from the cached/live list entry server-side rather than trusting a client-supplied type param; a 404 from DIAL Core is mapped through the existing `mapDialHttpStatus`/`handleDialFetchError` pattern to `NotFoundException`.
- [Field over-exposure — DIAL Core's raw detail responses contain fields never meant for end users (secrets, internal paths)] → Explicit allowlist mapping in `DeploymentDetailsDto` (only listed fields are copied across; nothing is spread/passed through raw), reviewed against the Non-Goals list.
- [Adding `onFetchDetails` to `libs/catalog` grows its public prop surface] → Kept optional and additive; existing consumers (if any besides `CatalogView`) are unaffected since the prop defaults to unset (no fetch, panel shows only static `item.details`/`item.intro`/`item.description` as today).

## Migration Plan

1. Backend: add `DeploymentDetailsDto`, `DeploymentsService.getDeploymentDetails`, and the controller route; ship behind normal deploy (additive, no flag needed since nothing calls it yet).
2. Regenerate `libs/chat-api-client` (`npm run openapi`, `npm run openapi:check`, build/lint `chat-api-client`) so the SDK method exists before frontend wiring lands.
3. Frontend: add the `apps/chat/src/server-api` wrapper, extend `libs/catalog`'s `CatalogProps`/`Catalog.tsx`, wire `CatalogView.tsx`'s `onFetchDetails`.
4. Rollback: each step is independently revertible — deleting the new backend route/DTO, the new lib prop, or the `CatalogView` wiring leaves the rest of the system (including the existing list endpoint) unaffected, since nothing else depends on the new pieces.

## Open Questions

- ~~Should `onFetchAboutContent`'s free-text "About" content be superseded by a field inside the new detail payload, or kept as a separate, independent fetch?~~ **Resolved**: neither — `onFetchAboutContent` was dead code (always resolved `undefined`) and was removed. The Intro section now reads a new static `CatalogItem.intro?: string` field (to be populated by a future backend field, not part of `DeploymentDetailsDto`), falling back to `item.description`.
- Does the toolset `auth_settings` summary need any fields beyond `authentication_type` for the Overview tab's "Authentication" row (`ToolsetSpecification.authentication` in `entity-details.ts:143`), or is a boolean/enum sufficient? Default to enum-only (`AuthenticationType`) unless a concrete UI need for more surfaces during implementation.
