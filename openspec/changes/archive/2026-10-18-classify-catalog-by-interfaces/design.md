## Context

The catalog decides an item's tab from one field, `CatalogItem.type`.
`mapDeploymentToCatalogItem` (`libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`)
fills it from the deployment `type` through `TYPE_MAP`, so every application is
an `Agent`. `type` is not only the tab, though: the same value drives the whole
entity behavior downstream —

- `libs/chat-hooks` `useCatalogItemDetails` → `resolveMcpResourceKind` picks the
  application vs toolset MCP URL;
- `useCatalogEditNavigation` routes edit/delete to the application or toolset
  editor and API;
- `useCatalogSharing` picks the `ApplicationsSharing` / `ToolsetsSharing` flag
  and the refetch;
- `toPublishEntityType` picks the publish entity type;
- `resolveFavoriteEntityType` (`apps/chat/src/utils/favorites.ts`) picks
  `deployments.installed` vs `toolsets.installed`;
- `FeaturedChip` / `getEntityTypeBadgeColor` color the badge.

DIAL Core reports what a deployment exposes in `interfaces` (`chat`, `mcp`,
`custom_ui`, `embedding`). `DeploymentsContext` already loads
`getDeployments([Chat, Mcp, CustomUi])`, and the backend mapper
(`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`, `mapToDeploymentItem`)
passes `interfaces` through as an array, so the frontend already has the data.
Toolsets proper still come from `listToolsets()`; the listing service drops
`toolset`-typed rows, so there is no overlap between the two sources.

Everything in the catalog keys by `item.id` — `Catalog`'s `selectedItem` sync,
`CardRowRenderer`/`ListView` row ids, the favorites strip keys, the favorites
`Set`, `?itemId=` deep link, `onToggleFavorite`. There is no composite key.

The "Talk to" picker is `CatalogView` in selector mode. On branch
`fix/9408-hide-non-chat-deployments-in-picker` (PR #9453) it filters with
`filterCatalogItemsBySelector`, which drops `supportsChat === false`
(`supportsChat` is `interfaces == null || interfaces.includes('chat')`). That PR
deliberately leaves custom-UI-only applications out of the picker for now, to
match the catalog's "Use in chat" button; this change keeps that decision.

## Goals / Non-Goals

**Goals:**
- Place each application under Agents, Toolsets, or both, from `interfaces`.
- Keep one item per deployment and its full application behavior in any tab.
- One rule for the catalog tabs, the "Talk to" picker, and the selector's
  favorites dropdown.
- Zero behavior change for hosts and deployments that carry no `interfaces`.

**Non-Goals:**
- Tools list, credentials, or toolset editor for MCP applications.
- Changing `supportsChat` / "Use in chat" semantics.
- Per-tab deep links or a per-tab favorites strip.
- Any backend, OpenAPI, or generated-client change.

## Decisions

### D1. Tab membership is a separate optional field, `catalogTabs`

`CatalogItem` gains `catalogTabs?: readonly CatalogEntityType[]`; `type` stays
the entity kind. `getCatalogItemTabs(item)` in `libs/catalog` returns
`catalogTabs` when non-empty, else `[type]`.

- *Over retyping (`type: Toolset`)*: retyping hands an `applications/...` id to
  every toolset branch listed in Context — toolset editor, `deleteToolset`,
  toolset sharing flag, `toolset` publish type, `toolsets.installed`, and
  `/v1/toolset/.../mcp`. It also cannot express "both tabs".
- *Over two items per deployment*: duplicate ids break `Catalog`'s
  `selectedItem` sync (opening the Toolsets copy flips to the Agents copy), the
  favorites strip's React keys, favorite toggling (first match wins), and the
  deep link — plus the toolset branches as above.
- *Optional with fallback*: every existing producer (toolsets, prompts, skills,
  other hosts of `@epam/ai-dial-catalog`) keeps working without touching it.

`CatalogEntityType` already has `Toolset`; no new enum member is needed.

### D2. Membership is computed in the chat-hooks deployment mapper

`mapDeploymentToCatalogItem` derives `catalogTabs` from `interfaces` per the
table in `specs/catalog-interface-classification`. It reads `interfaces`, not
`features.mcp`, because `features.mcp` is also set from a raw `mcp` block and
would put applications under Toolsets that Core itself does not list as `mcp`.

Isolation: the mapper already turns `DeploymentItemDto` into `CatalogItem`
(chat-hooks second exception); the new rule depends only on the generated
response shape and is identical for every DIAL-Core host. The one host
decision — whether the Toolsets tab exists — arrives as the
`isToolsetTabEnabled` option (default `true`), set by the app from
`isToolsetsEnabled` (`OverlayFeature.Toolsets`). `libs/catalog` never sees
`interfaces`.

Applications whose `interfaces` contain none of `chat`/`custom_ui`/`mcp`, and all
models, get no `catalogTabs` (type fallback) — this keeps the diff of produced
items minimal and every existing snapshot/test stable.

### D3. Every tab decision goes through `getCatalogItemTabs`

| Call site | Change |
| --- | --- |
| `Catalog.tsx` `tabFiltered` | `getCatalogItemTabs(item).includes(activeTab)` |
| `Catalog.tsx` tab `count` | same predicate per tab |
| `buildCatalogTabs` (`libs/catalog/src/utils/catalog-tabs.ts`) | present tabs = union of memberships |
| `deriveAvailableTabIds` (`libs/chat-hooks/src/catalog/catalog-derivations.ts`) | same union |
| `filterCatalogItemsBySelector` | keep when membership ∩ `visibleTypes` ≠ ∅ **and** `supportsChat !== false` (the existing check stays) |
| `DeploymentSelectorPanel.tsx` favorites filter | membership includes Model or Agent |

`chat-hooks` already depends on `@epam/ai-dial-catalog` for `CatalogItem`, so
importing `getCatalogItemTabs` adds no package edge.

In the picker the membership check is technically redundant with
`supportsChat` for applications (an MCP-only application also has
`supportsChat: false`), but it makes the picker follow the same tab rule as the
catalog, and it is what lets the custom-UI decision change later in one place
(drop the `supportsChat` check) without MCP-only applications coming back.

### D4. Build on PR #9453

This change sits on top of #9453 (`filterCatalogItemsBySelector` with
`supportsChat`). If #9453 has not merged when implementation starts, branch
from it or rebase after it merges; nothing in this change reverts it.

### D5. The DeploymentSelector overlays pass the same flag

`useDeploymentSelectorOverlay.tsx` and `useDeploymentSelectorFieldOverlay.tsx`
call the app wrapper `mapDeploymentToCatalogItem` for favorites/selected/pinned.
They pass `isToolsetTabEnabled` from the same feature source as
`useCatalogItems`, so the dropdown and the catalog agree on what is
conversational. The app wrapper forwards the option to the lib.

### D6. Same item, same panel, from either tab

Because there is one item, the details panel, header actions and favorite star
are identical from Agents and Toolsets. In the Toolsets tab an MCP application
shows its application actions (Connect tab with `/v1/deployments/{id}/mcp`,
application share/publish/edit/delete) and no Tools tab or credentials. This is
accepted for this change (see Open Questions).

## Risks / Trade-offs

- [The Toolbar total counts a dual application once while the two tab counts
  each include it] → intended; the total is "items", the tab counts are "items
  in this tab". Called out in the spec.
- [A favorited MCP-only application disappears from the "Talk to" dropdown] →
  intended (it cannot hold a conversation); it is still in the catalog favorites
  strip and the Toolsets tab.
- [`?itemId=` deep link to a dual application opens details while the active
  tab may be either one] → details do not depend on the active tab; verify in
  the `CatalogView` deep-link test and add a case.
- [Persisted active tab is Agents and the user's only items there were MCP-only
  applications] → `useCatalogActiveTabPreference` already reconciles against
  `deriveAvailableTabIds`; it falls back to the first available tab.
- [The Agent type badge (`FeaturedChip`) shows on a featured MCP application in
  the Toolsets tab] → cosmetic, matches the entity kind; revisit if design asks.
- [Older DIAL Core without `interfaces`] → membership omitted, type-based, as today.

## Migration Plan

Frontend-only and additive. No stored data changes: favorites keep using
deployment ids in `deployments.installed`. Rollback is a plain revert; items
fall back to `[type]` membership.

## Open Questions

- Should an MCP application in the Toolsets tab eventually look like a toolset
  (tools list from Core's `mcp.allowedTools`, toolset badge)? Out of scope here;
  needs a product decision and a backend mapping of `mcp.allowedTools`.
- Custom-UI-only applications are listed under Agents but stay out of the
  "Talk to" picker (PR #9453). Should they become selectable, since they open as
  Custom Viewers (`docs/custom-viewers.md`)? Not changed here.
