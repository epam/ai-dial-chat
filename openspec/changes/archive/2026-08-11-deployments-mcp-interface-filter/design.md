## Context

`GET /api/v1/deployments` (`DeploymentsListingService`) proxies DIAL Core's `GET /v1/deployments`, filtered by an optional `interface_type` value. Today the frontend (`DeploymentsContext`) only ever requests `chat`, so MCP-capable applications and toolsets never surface anywhere in the app (model pickers, catalog). Widening the request to `[chat, mcp]` was attempted directly and surfaced two latent defects before it could work correctly, both discovered via debug logging against a live DIAL Core instance (`core.aks.dev.dial.parts`):

1. **Query serialization bug.** The `@epam/ai-dial-typescript-sdk` client (openapi-fetch under the hood) defaults array query params to repeated keys (`interface_type=chat&interface_type=mcp`, `style: form, explode: true`). Empirical evidence (debug log: `638 -> 638` items whether the filter was `["chat"]` or `["chat","mcp"]` via repeated keys) showed DIAL Core only honors the *first* occurrence of a repeated key, silently ignoring the rest. DIAL Core's own OpenAPI description documents `interface_type` as accepting "multiple values as comma-separated list or array" — the comma-separated form is what actually works.
2. **Toolset payload gap.** Once the multi-value filter reached Core correctly, `/v1/deployments` started returning toolset entries (confirmed via a raw-payload debug log: 288 toolset items in one response). Comparing that raw payload against `ToolsetsListingService`'s dedicated `/v1/toolsets` response showed `/v1/deployments`'s toolset entries carry only identity/generic fields (`id`, `toolset`, `display_name`, `transport`, `allowed_tools`, `features`, …) and are **missing `auth_settings` and `endpoint`** — fields `mapToolsetToCatalogItem` needs to render a toolset's credential/auth status in the catalog. Letting these thin entries flow into `items` alongside the already-complete `/v1/toolsets`-sourced `toolsets` array would either duplicate every MCP toolset in the catalog (same `id`, two shapes) or — if de-duplicated naively — replace the rich entry with an incomplete one depending on array order.

Separately, once `items` can legitimately contain non-toolset deployments that still don't support `chat` (e.g. an `mcp`-only or `custom_ui`-only application), any UI that assumes "not a toolset ⇒ can be used in chat" is now wrong. The catalog's "Use in chat" primary action currently gates only on `item.type` (`libs/catalog/.../Header.tsx` default, overridden by `CatalogView.tsx`'s `isPrimaryActionVisible`), not on `interfaces`.

## Goals / Non-Goals

**Goals:**

- Make DIAL Core actually receive and honor a multi-value `interface_type` filter.
- Let MCP-interface applications appear in `items` (model/deployment pickers, catalog) without duplicating or misrepresenting MCP toolsets.
- Ensure "Use in chat" (and, by extension, any future chat-only affordance) is gated on the deployment's actual interface support, not just its type.

**Non-Goals:**

- Do not change DIAL Core itself or attempt to make `/v1/deployments` return richer toolset data — that is Core's contract to evolve, not this repo's.
- Do not change the public shape of `DeploymentItemDto`/`DeploymentsResponseDto` (still `{ deployments: DeploymentItemDto[] }`, same fields) — only which items are included.
- Do not touch `/v1/toolsets` or `ToolsetsListingService` behavior; it remains the sole source of toolset data for the app.

## Decisions

### 1. Comma-joined query serialization, scoped to this one call

Pass a per-request `querySerializer: { array: { style: 'form', explode: false } }` to `this.dialClient.client.listDeployments(...)` in `DeploymentsListingService`, rather than changing the SDK's global client configuration (`createSDK`) or vendoring a patched `openapi-fetch`.

**Alternative considered:** configure a global `querySerializer` on the shared DIAL client. Rejected — other DIAL Core endpoints that also take array query params may rely on (or be unaffected by) the default repeated-key style, and no evidence was gathered that they share Core's "comma-separated" convention; scoping the override to the one call site that is proven to need it avoids an unreviewed behavior change to every other list endpoint.

### 2. Exclude toolsets server-side, not client-side

Filter out `DeploymentItemType.Toolset`-typed entries inside `DeploymentsListingService.listDeployments`, immediately after mapping raw Core items and before caching — not in the frontend (`deployments.api.ts` or `DeploymentsContext`).

**Alternatives considered:**
- *Filter in the frontend API wrapper.* Works, but every current and future consumer of `GET /api/v1/deployments` (including direct API/Swagger consumers, not just this one frontend) would still receive toolsets unless they also filter, so the endpoint's own documented contract would be misleading.
- *Filter in each UI list-rendering component.* Rejected outright — an audit found 5+ list-rendering call sites (`DeploymentSelector`, `ConversationView`, `ConversationRoute`, both `ScheduledTask*` pages) that consume `items` unfiltered; patching each is repetitive and any future consumer would inherit the same bug by omission.

Filtering at the service is the single point that makes the endpoint's contract ("deployments, not toolsets") true for every caller, present and future. This also lets the now-dead `TOOL_SET`-scoped ownership/sharing code path (in the same service) be deleted rather than left unreachable.

### 3. Add a derived `supportsChat` boolean to `CatalogItem`, following the existing `supportsMcp` pattern

`CatalogItem` already has `supportsMcp?: boolean`, derived in `mapDeploymentToCatalogItem` from `deployment.features?.mcp === true` and consumed directly by `CatalogView.tsx` (e.g. for the MCP endpoint URL) and `mcp-endpoint-url.ts`. Add `supportsChat?: boolean` the same way — derived from `DeploymentItemDto.interfaces` in the same mapper (`true` when `interfaces` is absent/undefined, matching pre-change behavior for items with no `interfaces` data, or when it includes `'chat'`) — and extend `CatalogView.tsx`'s `isPrimaryActionVisible` callback to also require `item.supportsChat !== false` alongside the existing type check.

**Alternative considered:** expose the raw `interfaces: string[]` array on `CatalogItem` instead of a derived boolean. Rejected — the codebase's established convention for this exact kind of per-capability gate is a derived boolean computed once in the mapper (`supportsMcp`), not a raw array re-interpreted at each call site; following it keeps `CatalogItem`'s public surface consistent and avoids two different idioms for equivalent MCP/chat capability checks.

## Risks / Trade-offs

- **[Risk]** Excluding toolsets from `/v1/deployments` is a behavior change for any *other* consumer of that endpoint that currently expects toolsets in the response (per the existing `deployments-api` spec, which explicitly documents "all deployments (models, applications, toolsets)"). → **Mitigation:** the delta spec updates this documented contract explicitly; grep for other server-side or external consumers before merging, and call this out in the PR description as an intentional breaking change to the endpoint's item set (not its schema).
- **[Risk]** The comma-joined `querySerializer` override is scoped to one call site; if another endpoint later needs the same multi-value DIAL Core parameter, the fix must be re-applied there rather than inherited. → **Mitigation:** the inline code comment on the override explains why it exists, so the next author copies the pattern deliberately instead of rediscovering the bug via the same debug-log process.
- **[Risk]** `isPrimaryActionVisible`'s new `interfaces` check assumes `DeploymentItemDto.interfaces` is always populated for chat-capable models/applications; if DIAL Core ever omits `interfaces` for a legitimately chat-capable deployment, "Use in chat" would incorrectly disappear. → **Mitigation:** existing `mapToDeploymentItem` already treats `interfaces` as optional and other code paths (server-side interface filtering) have the same dependency, so this is a pre-existing assumption, not a new one; no additional fallback added.

## Migration Plan

No data migration. Deploy as a normal backend+frontend release:

1. Backend change (query serialization + toolset exclusion + ownership simplification) is backward compatible for well-behaved clients — the only behavior change is toolsets disappearing from `/v1/deployments` responses, which is the intended fix.
2. Frontend changes (widened interface filter, `CatalogItem.interfaces`, `isPrimaryActionVisible` update) deploy together with the backend change; deploying the frontend change without the backend fix would still work correctly (backend already excludes toolsets and honors multi-value filters independently of which interfaces the frontend asks for).
3. Rollback: revert both changes together; no persisted state depends on the new behavior (30s server-side cache self-expires).

## Open Questions

- None outstanding — the payload-richness question (does `/v1/deployments` carry toolset auth fields) was resolved empirically via debug log before this design was written; see Context.

## Follow-up (tracked upstream)

The local post-fetch `interface_type` re-filter in `DeploymentsListingService.listDeployments` exists because DIAL Core does not reliably apply this filter server-side today (see decision 1 in Context — Core only honored the first value of a repeated-key query before the comma-joined `querySerializer` fix, and even after that fix Core's own filtering behavior should not be assumed fully correct). Core-side filtering is tracked at [epam/ai-dial-core#1822](https://github.com/epam/ai-dial-core/issues/1822); once resolved there, this repo's local re-filter step can likely be simplified or removed. A `TODO` comment referencing the issue is left at the re-filter call site.
