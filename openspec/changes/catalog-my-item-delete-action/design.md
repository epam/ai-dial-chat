## Context

The Catalog details header (`libs/catalog/src/components/Details/Header/Header.tsx`) already renders "Use in chat", "Edit" (`isEditable`-gated), and "Share" (`isMyApp`-gated, via `ShareButton`) in a single flex row. `apps/chat`'s `CatalogView.tsx` wires these to app-level handlers (`handleEdit`, `SharePopoverContainer`).

On the backend, `apps/chat-api/src/toolsets/` already has a fully working, spec'd `DELETE /api/v1/toolsets/:toolsetName` (`toolsets.controller.ts:206-239`, `toolsets.service.ts:452-488`) that resolves the caller's bucket/path (parsing a `toolsets/{bucket}/{path}` id, or falling back to the user's own bucket), calls DIAL Core's `deleteToolSet(bucket, path, ...)`, invalidates the list/single caches, and maps DIAL Core errors. It is unused by the frontend today. `apps/chat/src/server-api/toolsets.ts:216-217` already has a `deleteToolset` wrapper, also unused.

`apps/chat-api/src/applications/` has no delete endpoint at all — only `listApplications` and `createApplication`. The underlying DIAL SDK already exposes `deleteCustomApplication(bucket, application_path)` (same shape as `deleteToolSet`/`deleteFile`), so the backend gap is additive, not a new integration.

## Goals / Non-Goals

**Goals:**

- Let a user delete an application (QuickApp) or toolset they own, from the Catalog details panel, with a single click and no confirmation step.
- Reuse the existing `deleteToolset` backend endpoint/server-api as-is.
- Add the missing `DELETE /api/v1/applications/:applicationName` endpoint following the exact pattern already established for toolsets (controller/service/DTO shape, caching, error mapping).
- Keep the loading/error UX inside `libs/catalog` (host-agnostic), the same way `ShareButton`'s visibility rule already works — `apps/chat` only supplies the async `onDelete` callback and reacts to its outcome (close panel, refresh list, notify).

**Non-Goals:**

- Deleting Models, Guardrails, MCPs, or Agents — Delete is scoped to `Application` and `Toolset` types only, matching the user's explicit ask ("if application or toolset is my").
- Bulk delete, undo/trash, or soft-delete — this is a single-item, irreversible delete, consistent with `deleteToolSet`/`deleteCustomApplication` semantics.
- Changing how items are listed/paginated in the Catalog beyond removing the deleted item from the current in-memory list.

## Decisions

### 1. Gate Delete visibility on `isMyApp` + entity type, not a new `CatalogItem` field

`ShareButton` already has this exact shape (`shouldShowShare` checks `item.isMyApp === true && type !== Guardrail && type !== Mcp`). Delete follows the same style: a local `shouldShowDelete(item)` helper in the new `DeleteButton` component checks `item.isMyApp === true && (item.type === CatalogEntityType.Application || item.type === CatalogEntityType.Toolset)`. No new `CatalogItem` field (e.g. `isDeletable`) is introduced — `isEditable` already diverges from plain ownership for QuickApps (schema match required), so reusing it for Delete would incorrectly hide Delete for a QuickApp built from a non-"editable" schema. Ownership (`isMyApp`) is the correct and sufficient signal for deletability.

**Alternative considered**: add `isDeletable?: boolean` to `CatalogItem`, computed by `apps/chat`'s mappers like `isEditable`. Rejected because the delete rule is a static function of `isMyApp` + `type` with no per-item exception, unlike `isEditable`; adding a field for a computable constant is unneeded surface area.

### 2. Delete fires immediately on click, with loading/error state inside `libs/catalog`

New `components/Details/Header/DeleteButton/DeleteButton.tsx` owns: the trigger button, `isDeleting` state, and awaits the `onDelete(item): Promise<void> | void` prop passed down from `DetailsPanelProps`/`CatalogProps` (same shape as `onLogin`/`onLogout`). Clicking the button calls `onDelete` directly — there is no confirmation popup. While pending, the button is disabled. On success it calls `onDeleted?.()` (the parent then unmounts the whole details panel — see Decision 4); on rejection it re-enables the button and shows an inline error string below it, sourced from a `deleteErrorMessage` text override.

**Alternative considered**: a confirmation popup before calling `onDelete` (mirroring `CredentialsSection`'s logout confirmation and `DeleteAllConversationsAction`'s pattern). This was the original design, but the user explicitly requested removing the confirmation step — Delete is now a single click, same as Edit/Share. The inline error-on-retry behavior is kept so a failed delete is still recoverable without a popup.

### 3. `apps/chat` branches the actual delete call on `item.type`, mirroring `handleEdit`

`CatalogView.tsx` already has a single `onEdit` handler that branches on `CatalogEntityType` (`catalog-quickapp-edit-action` capability). `onDelete` follows the same shape: `CatalogEntityType.Toolset` → `deleteToolset(item.id)`; `CatalogEntityType.Application` → the new `deleteApplication(item.id)`. No id-parsing is needed on the frontend — both `deleteToolset`/`deleteApplication` backend endpoints already accept either a full `toolsets/{bucket}/{path}` (or `applications/{bucket}/{path}`) id or a bare name, resolving the bucket/path themselves (mirroring how `updateToolset`/`getToolset` are already called elsewhere in the app with the full id).

### 4. Post-delete: close panel, drop the item from the in-memory list, show a success notification

On `onDelete` resolving, `CatalogView` closes the details panel (same close path as after a successful `onEdit` navigation would, or as `DeleteAllConversationsAction` does) and removes the deleted item from whichever list currently holds it (`deployments`/`toolsets` from `useDeployments()` — whatever refresh mechanism that context already exposes for post-mutation updates; if no fine-grained "remove one item" setter exists, trigger the same reload used after other mutations rather than inventing new context API surface). A success notification uses the existing `useNotification()`/`NotificationVariant.Success` pattern already used elsewhere in `CatalogView.tsx`.

### 5. Backend: `deleteApplication` mirrors `deleteToolset` exactly

New `apps/chat-api/src/applications/dto/get-application.dto.ts` — a `GetApplicationDto` with `applicationName: string`, validated with the same `DEPLOYMENT_ID_PATTERN`/`DEPLOYMENT_ID_VALIDATION_MESSAGE` as `GetToolsetDto`. New `ApplicationsService.deleteApplication(userSub, accessToken, applicationName)` resolves `{bucket, path}` (parse an `applications/{bucket}/{path}` id via a new `parseDialApplicationResource` helper analogous to `parseDialToolsetResource`, or fall back to the user's own bucket + `encodeDialResourcePath`), calls `this.dialClient.client.deleteCustomApplication(bucket, path, { headers })`, maps errors with `mapDialHttpStatus`/`handleDialFetchError`, and invalidates the `applications:list:${userSub}` cache key (there is no per-item application cache today, unlike toolsets' `toolsets:single:*`). Controller adds `@Delete(':applicationName')` + `@HttpCode(204)`, `@Throttle({ default: { limit: 10, ttl: 60000 } })`, `operationId: 'deleteApplication'` — same shape as `ToolsetsController.deleteToolset`.

## Risks / Trade-offs

- **[Risk]** Deleting with no confirmation step is unusually easy to trigger by accident, and the DIAL Core SDK's `deleteCustomApplication` behavior/error shape for an application still referenced elsewhere (e.g. an active conversation's deployment) is unverified — deleting an in-use application could surprise a user mid-conversation. → **Mitigation**: this is an explicit, deliberate product decision (no popup, one click, same as Edit/Share); no additional in-use check or confirmation is added in this change.
- **[Risk]** No context API today may specifically support "remove one item from the loaded list" (only whole-list fetch surfaces are known so far). → **Mitigation**: design intentionally leaves this to task-time discovery of `DeploymentsContext`; falling back to a full refetch after delete is an acceptable, non-breaking default if a granular removal setter doesn't exist.
- **[Risk]** Regenerating `libs/chat-api-client` after adding the backend endpoint could produce incidental diffs in unrelated generated files. → **Mitigation**: run `npm run openapi:check` before considering the slice done, per repo convention, and keep the endpoint addition minimal/isolated.

## Migration Plan

Additive on both ends (new optional prop, new endpoint) — no existing behavior changes, no data migration, no rollback complexity beyond reverting the commit. Ship backend endpoint + client regeneration first (independently testable via `chat-api` supertest), then the frontend slices (lib UI, then `apps/chat` wiring), so each slice can be verified in isolation per the incremental-slices default.

## Open Questions

- Which exact `DeploymentsContext`/toolsets-loading setter (if any) supports removing a single item without a full refetch — resolve at task time by reading `apps/chat/src/context/DeploymentsContext.tsx`.
- Whether `deleteCustomApplication` needs an application-level single-item cache invalidation (toolsets have `toolsets:single:*`, applications currently have no per-item cache) — confirm by checking whether `getApplicationDetails`-style single-item caching exists anywhere in `applications.service.ts` before assuming none is needed.
