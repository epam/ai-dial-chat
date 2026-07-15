## Context

The Catalog details sidebar (`libs/catalog`'s `DetailsPanel`/`Header`) already renders a row of action buttons after the entity header: `Use in chat`, `Edit`, `Share`, recipient-side `Delete`, `Publish`, and the credentials action. `Share` is the closest existing pattern for what `Connect` needs: `libs/catalog` renders a neutral, host-agnostic trigger button (`ShareButton`) with a chevron, and the host app (`apps/chat`) supplies the actual popover content through an overlay-render prop (`shareOverlay`) wired through a `DialDropdown`. `libs/catalog` never learns what's inside the popover or how the URL it copies is built.

Two host-side facts are missing today:
1. `apps/chat` has no client-safe DIAL Core *external* URL. `AppConfigContext`/the client-config endpoint only expose ASR and default-deployment config; the only DIAL Core URL known to the backend (`DIAL_CORE_URL` in `environment.config.ts`) is the internal upstream URL and must not be assumed browser-safe.
2. The deployments list DTO (`DeploymentItemDto`) has no per-item MCP-support flag. `DeploymentFeaturesDetailsDto` (used by the *details* endpoint) already reads `features.mcp` from DIAL Core, but `CatalogView` needs this at list-render time to decide per-item visibility without firing a details fetch for every application card.

Both gaps are additive: new optional fields/config keys, no breaking change to existing contracts.

## Goals / Non-Goals

**Goals:**
- Add a `Connect` header action in the Catalog details sidebar that mirrors `Share`'s button/popover interaction and accessibility wiring exactly.
- Keep `libs/catalog` fully host-agnostic: it only knows a button must render, an overlay may be supplied, and a visibility predicate may gate it — never a URL, a DIAL Core config value, or an entity-specific MCP rule.
- Resolve the popover's copyable URL and its visibility rule entirely in `apps/chat` (and, for the underlying MCP-support fact, in `apps/chat-api`).
- Expose the public DIAL Core external URL as a new, explicitly client-safe config value, without changing the visibility of the existing internal `DIAL_CORE_URL`.

**Non-Goals:**
- No modal is introduced (the old marketplace card's modal-based Connect flow is not replicated) — this is a details-sidebar popover only.
- No new lib is added for the popover content; because the content is a simple title + description + one button, it is authored directly in `apps/chat`, unlike `Share` which delegates to a separate, richer `libs/share` package.
- No change to how `Share`/`Publish`/`Delete`/credentials actions are ordered or gated — `Connect` is additive, appended after all existing actions.
- No change to the MCP endpoint's actual server-side behavior — this change only surfaces the existing DIAL Core MCP endpoint URL for copying.

## Decisions

### 1. Reuse the `shareOverlay` prop shape for `connectOverlay`, not a shared "generic overlay" abstraction

`CatalogProps`/`DetailsPanelProps`/`HeaderProps` gain `connectOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode` and `isConnectVisible?: (item: CatalogItem) => boolean`, following the exact shape already used for `shareOverlay`/`isPublishVisible`. A new `ConnectButton` component (sibling to `ShareButton` under `Details/Header/`) owns the `DialDropdown` wiring, `isOpen` state, and `aria-haspopup`/`aria-expanded`. This is chosen over trying to generalize `Share` and `Connect` into one "action with overlay" abstraction now — `Share` also carries unshare/access-level logic that doesn't apply to `Connect`, and premature generalization would couple two independently-evolving actions. `ConnectButton` is intentionally simpler than `ShareButton`: no unshare branch, no non-overlay `onConnect` fallback prop, since the popover is always host-supplied — visibility is entirely driven by `isConnectVisible`.

### 2. Connect button label text: one details-text field, not per-type

The button trigger always reads "Connect" regardless of entity type (mirrors the reference behavior: the trigger label doesn't change, only the popover's internal title/description text does). `ItemDetailsTexts` gains one field, `connectLabel?: string` (default `'Connect'`), plus the popover-internal copy stays entirely inside the app-level popover content component (not part of the lib's text-override surface) since `libs/catalog` never renders that content.

### 3. Popover content lives in `apps/chat`, not a new lib

A new `ConnectPopoverContainer` (mirroring `SharePopoverContainer`'s role) renders the title, description, and `Copy URL` button directly with existing UI-kit primitives (`NeutralButton`/`PrimaryButton`, typography classes) and the app's own i18n. This avoids standing up a whole new `libs/connect` package for content that has no reuse surface today, while keeping `libs/catalog` itself free of DIAL-specific text or logic — the same trade-off the codebase already accepted by *not* pushing `Share`'s content into `libs/catalog` either.

The "copied" feedback reuses the existing copy-to-clipboard confirmation convention already used by the Catalog's API-tab copy button (transient state + `aria-live="polite"` region, stable `aria-label` on the button itself) rather than inventing a new pattern.

### 4. MCP endpoint URL helper: dedicated frontend utility mirroring the backend's segment-encode approach

`apps/chat-api/src/common/utils/encode-dial-path.ts` already implements the "split on `/`, decode each segment defensively, re-encode each segment independently, rejoin" behavior needed to encode an entity id without treating an already-encoded `%2F` inside a segment as a path separator. Because `apps/chat-api` and `apps/chat` are separate deployable apps (frontend code cannot import backend source), a new frontend-only utility (`apps/chat/src/utils/mcp-endpoint-url.ts` or equivalent) reimplements the same three-step behavior for the frontend, trims a trailing slash from the configured base URL, and exposes two thin builders (toolset vs. application) on top of one shared segment-encoder — avoiding duplicated encode logic between the two builders while keeping both call sites explicit about which DIAL Core path they target (`/v1/toolset/{id}/mcp` vs. `/v1/deployments/{id}/mcp`).

### 5. `supportsMcp` becomes a first-class list-DTO field, not a details-fetch-only fact

`DeploymentFeaturesDto` (the *list* DTO's features shape) gains an optional `mcp?: boolean`, populated inside `mapToDeploymentItem` from whichever of three signals DIAL Core's list response actually carries for a given application — real-world responses were observed using all three, never in combination: `raw.features.mcp === true` (matches `DeploymentFeaturesDetailsDto.mcp`'s `getBoolean(raw.features, 'mcp')` convention, but many list entries omit `features.mcp` even when the app is MCP-capable); a root-level `raw.mcp` descriptor object (`endpoint`/`transport`/`allowedTools`/..., mirroring the pre-migration frontend's `entity.mcp` check in `map-core-entity.ts`/`get-sorted-entities.ts`); and `raw.interfaces` containing `'mcp'` (the same per-item classification DIAL Core's own `interface_type=mcp` list filter relies on, and the one actually populated for plain "supports MCP, no custom transport config" applications). `CatalogItem` gains `supportsMcp?: boolean`, set from `deployment.features?.mcp` in `mapDeploymentToCatalogItem`. This lets `CatalogView`'s `isConnectVisible` predicate be synchronous and per-item without an extra network round trip — consistent with how every other Catalog visibility predicate (`isPublishVisible`, `isPrimaryActionVisible`) already works off fields already present on the list item.

Toolsets do not gain a `supportsMcp` field — every toolset in this codebase already implies an MCP transport, so `mapToolsetToCatalogItem` needs no new field; `isConnectVisible` treats `CatalogEntityType.Toolset` as unconditionally connect-capable (subject only to the external URL existing).

### 6. New client-safe config key: `dialCore.externalUrl`, not reuse of `DIAL_CORE_URL`

A new environment variable (e.g. `DIAL_CORE_EXTERNAL_URL`) and a new `CONFIG_DEFINITIONS` entry with `visibility: 'client'` are added, following the exact shape of the existing `deployments.defaultDeploymentId` entry (`type: 'config'`, `valueType: 'string'`, `defaultValue: null`, `envVar: <new var>`). `DIAL_CORE_URL` itself remains `visibility` un-set (i.e., not part of any client-facing definition) — this design does not change its exposure. Operators who run DIAL Core behind a different public hostname than the internal one now have an explicit, intentional place to declare that public hostname; when unset, `Connect` simply never shows (external URL absent) rather than falling back to guessing from the internal URL.

`AppConfigState.config` gains `dialCoreExternalUrl: string | null`, following the exact `asrModelId`/`defaultDeploymentId` null-default pattern already in `AppConfigContext.tsx`.

### 7. Icons: `IconPlugConnected` (or closest equivalent already in `@tabler/icons-react` used elsewhere in the codebase) before the label, `IconChevronDown` after — both non-directional, no RTL mirroring needed, matching `ShareButton`'s `IconShare`/`IconChevronDown` pairing exactly.

## Risks / Trade-offs

- **[Risk]** A new environment variable (`DIAL_CORE_EXTERNAL_URL`) is optional; operators who don't set it silently get no `Connect` action anywhere, which could look like a bug rather than "not configured." → **Mitigation:** document the variable in `environment.config.ts` with a clear description (mirrors how `DEFAULT_DEPLOYMENT`/`ASR_MODEL` already document their "absent → feature off" behavior); no separate migration needed since the feature is purely additive.
- **[Risk]** Duplicating the segment-encode logic between `apps/chat-api`'s `encode-dial-path.ts` and a new frontend utility risks the two drifting apart over time. → **Mitigation:** both are thin, well-tested (`safeDecodeURIComponent` + `encodeURIComponent` per segment) and unlikely to change; the design keeps the frontend copy small and fully covered by the URL-helper unit tests specified in the proposal, so any drift is caught by tests, not silently.
- **[Risk]** Adding `mcp` to the list DTO's `features` object slightly increases list-response payload size for every deployment. → **Mitigation:** the field is a single optional boolean; negligible compared to existing list payload fields (`topics`, `inputAttachmentTypes`, etc.).
- **[Trade-off]** The popover content component is hand-rolled in `apps/chat` rather than factored into a reusable lib. Acceptable because the content (title, one paragraph, one button) has no second consumer today; if a second consumer appears, it can be extracted then.

## Migration Plan

No data migration. Deployment sequence:
1. Backend: add `DIAL_CORE_EXTERNAL_URL` to `environment.config.ts` (optional, no default), add the `dialCore.externalUrl` config definition, add `mcp` to `DeploymentFeaturesDto`/`RawDeploymentFeaturesDto`/`mapToDeploymentItem`. Regenerate the OpenAPI client (`npm run openapi`, `npm run openapi:check`).
2. Frontend: extend `AppConfigContext`, add the MCP URL helper + tests, extend `CatalogItem`/mapping, add `libs/catalog`'s `ConnectButton` + prop plumbing, add `apps/chat`'s `ConnectPopoverContainer`, wire `CatalogView`.
3. Operators set `DIAL_CORE_EXTERNAL_URL` in their environment to enable `Connect`; absent the variable, behavior is unchanged (no `Connect` action shown anywhere), so this ships safely without requiring immediate operator action.

Rollback: revert the change set; no persisted data or schema to unwind.

## Open Questions

- None — all behavior needed to implement this change was resolved during investigation (button/icon choice, URL shape, encoding rules, visibility rules, config key naming).
