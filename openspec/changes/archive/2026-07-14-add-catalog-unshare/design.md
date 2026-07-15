## Context

Recipients of a catalog share invitation have no way to remove a shared item from their own catalog today. `libs/catalog`'s `ShareButton` (`libs/catalog/src/components/Details/Header/ShareButton/ShareButton.tsx:16-18`) is owner-only (`shouldShowShare` gates on `item.isMyApp === true`), and `CatalogItem` (`libs/catalog/src/models/catalog-item.ts:6-50`) has no field expressing "this item is shared with me." The legacy `origin/development` Redux stack had both (`DialAIEntityModel.sharedWithMe`, `useAgentMenuItems.ts:188-197`, `UnshareDialog.tsx`, `share.epics.ts:1480-1552`), but it called its own Next.js API route (`apps/chat/src/pages/api/share/discard.ts`) which proxied straight to DIAL Core's raw `POST /v1/ops/resource/share/discard`. That whole path is gone; the current branch has a BFF (`apps/chat-api`), a generated OpenAPI client (`libs/chat-api-client`), and a React-Context frontend, none of which have been extended to cover discard.

The one existing, working precedent for `discardSharedResources` on the current branch is `apps/chat-api/src/files/files.service.ts:975-1009` (File Manager's `discard-shared` route), which:
- exposes `POST` with `@Throttle({ default: { limit: 10, ttl: 60000 } })`,
- accepts a `{ bucket, path }`-pair DTO (because file resources aren't identified by one flat id) and reconstructs a URL via `buildDialFileResourceUrl`,
- calls `dialClient.client.discardSharedResources({ headers, body: { resources: [{ url }] }, signal })`,
- uses the **SDK-shaped** error handler `handleDialSdkError(error, context, logger, response)`.

Catalog resources are simpler: `CatalogItem.id` (and its BFF-side source, `DeploymentItemDto.id` / `DialToolsetDto.id`) is already the full DIAL Core resource URL (`applications/{bucket}/{path}` or `toolsets/{bucket}/{path}`) — confirmed by `share.service.ts:108-111`'s `createShareLink`, which passes `itemId` straight through as `{ url: itemId }` with no encoding step. So the catalog discard endpoint needs no bucket/path reconstruction, just `{ itemId: string }` → `{ resources: [{ url: itemId }] }`.

The domain this endpoint belongs to already exists: `ShareController`/`ShareService` (`apps/chat-api/src/share/`). `ShareService.acceptInvitation` already establishes the cache-invalidation precedent this discard endpoint must follow — after a share-related mutation that changes what the recipient can see, it calls both `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` (`share.service.ts:241-244`). It also already injects both services, so no new DI wiring is needed.

`sharedWithMe` itself has a server-side gap: `deployments.service.ts:300-327` (`getWritableApplicationUrls`) and `toolsets.service.ts:233-257` (`getWritableToolsetUrls`) already call `getSharedResources({ resourceTypes: [...], with: 'me' })`, but both **filter the result down to `WRITE`-permission resources only**, because today they only need to answer "can I edit this." `sharedWithMe` needs the unfiltered set (READ or WRITE), so the design factors out a shared private helper that both the existing write-check and the new shared-with-me check call, to avoid firing `getSharedResources` twice per list request.

## Goals / Non-Goals

**Goals:**
- Let a recipient discard their own access to a shared catalog item (application or toolset) from the Catalog details header, using DIAL Core `discardSharedResources`.
- Compute an accurate `sharedWithMe` boolean end-to-end (DIAL Core → BFF DTO → mapper → `CatalogItem`) that is `true` for both READ-only and WRITE-shared items, and `false` for owned, public, and organization items.
- Keep `libs/catalog` host-agnostic: it knows only `CatalogItem.sharedWithMe`, translated prop strings, and typed callbacks.
- Keep the frontend catalog state (list + selection) consistent after a successful discard, reusing `DeploymentsContext`'s existing refetch/race-safety machinery rather than adding new state machinery.

**Non-Goals:**
- Owner-side `revokeSharedResources` ("remove access for everyone") — a distinct, future change.
- Conversations, File Manager resources, catalog cards/context menus, bulk/multi-select unshare, Guardrail/MCP catalog entities.
- Any change to share-link creation (`createShareLink`) or invitation acceptance (`acceptInvitation`) behavior.
- A new global React Context — the mutation is a single-item, single-request action fully expressible through `CatalogView`'s existing handler pattern (`handleDelete`, `CatalogView.tsx:480-505`) plus `DeploymentsContext`'s existing `refetchDeployments`/`refetchToolsets`/`setSelectedItemId`.
- A new feature flag — visibility is fully determined by `sharedWithMe`; no operator-facing toggle is needed because the underlying DIAL Core sharing capability is not itself flagged.

## Decisions

### D1. New capability boundary: `catalog-shared-with-me` vs. `catalog-unshare`

Split into two specs because they have independent failure modes and independently useful acceptance criteria: `sharedWithMe` enrichment is meaningful even before any Unshare UI exists (e.g. a future "Shared with me" filter could reuse it), and the discard flow depends on `sharedWithMe` but is a separate vertical (BFF mutation + cache invalidation + UI). Keeping them as two specs also matches the two independently-testable server-side helpers (`getSharedResources` unfiltered fetch vs. `discardSharedResources` call).

### D2. `sharedWithMe` computed from the unfiltered `getSharedResources({ with: 'me' })` result, not from `isMy`/`canEdit`

**Chosen:** Add a shared private helper (e.g. `getSharedResourceUrls(accessToken, resourceTypes)`) to `DeploymentsService`/`ToolsetsService` that calls `getSharedResources({ resourceTypes: [...], with: 'me' })` **once** per list request and returns the full `{ url, permissions }[]` array (unfiltered). The existing write-only check (`getWritableApplicationUrls`/`getWritableToolsetUrls`) and the new `sharedWithMe` check both derive from this single call: `canEdit = isMy || writable.has(url)`; `sharedWithMe = !isMy && sharedSet.has(url)`.

**Rejected alternatives:**
- Infer from `isMy === false`: wrong — public and organization-visible items are also not owned, and would incorrectly show Unshare.
- Infer from `canEdit`: wrong — READ-only shared items have `canEdit: false` today and would be invisible to an Unshare gate that used `canEdit` as a proxy.
- Two separate `getSharedResources` calls (one filtered, one not) per list request: correct but wasteful — doubles an already-per-request (uncached) upstream call for every deployments/toolsets list fetch. The shared-helper approach fetches once and derives both booleans in-process.

**Not cached** — like the existing `canEdit`/`isMy` enrichment, `sharedWithMe` is resolved fresh on every list request (the underlying deployments/toolsets list itself is cached for 30s per user, but permission/share enrichment is always live), so a discard's cache invalidation (D5) is guaranteed to be reflected on the very next fetch.

**Failure mode:** if `getSharedResources` throws, degrade to `sharedWithMe: false` for every item in that response (matching the existing `canEdit` degrade-to-`isMy` pattern) and log at `warn` — a transient failure hides the recipient-side Delete action rather than breaking the whole list.

### D3. Catalog library UI: rename/extend a single button, not a second component or an overlay-only approach

The proposal draft asked to compare three approaches:

- **(A) Chosen** — Extend the existing `ShareButton` component so it renders **either** Share or recipient-side Delete, never both, based on `item.sharedWithMe`. The callback remains technically named `onUnshare` because it invokes discard rather than owner-side deletion:
  ```ts
  interface ShareButtonProps {
    item: CatalogItem;
    onShare?: (item: CatalogItem) => void;
    shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
    onUnshare?: (item: CatalogItem) => void;
    shareLabel?: string;
    unshareLabel?: string;
  }
  const shouldShowShare = (item) => item.isMyApp === true && ...;
  const shouldShowUnshare = (item) => item.sharedWithMe === true && item.isMyApp !== true && ...;
  ```
  When `shouldShowUnshare` is true, render a plain `NeutralButton` labelled Delete with `IconTrash` and `onClick={() => onUnshare?.(item)}` — no dropdown/popover is needed because confirmation lives in `DetailsPanel` (D4), not in a `renderOverlay` like Share's permission picker.
  Rationale: `Header.tsx` already renders exactly one share-related action slot in this position; owned vs. shared-with-me are mutually exclusive states for a given item (an item is never simultaneously `isMyApp: true` and `sharedWithMe: true` — you can't share with yourself), so a single component with an internal branch is simpler than two components a parent must remember to render exclusively.
- **(B) Rejected** — Separate `UnshareButton` beside `ShareButton`. Two components means `Header.tsx` must itself enforce mutual exclusivity (`item.isMyApp ? <ShareButton/> : item.sharedWithMe ? <UnshareButton/> : null`), duplicating the gating logic that's more naturally owned by each button's own `shouldShow*` predicate. Also doubles the boilerplate (two prop-drilling chains through `Header`/`DetailsPanel`/`CatalogProps`) for two actions that are simple, mutually exclusive booleans on the same header slot.
- **(C) Rejected** — Confirmation UI entirely at the app edge via a render-callback overlay (like `shareOverlay`). Unshare's confirmation is a static-text yes/no dialog with no per-item customization beyond interpolating the item name — `DialConfirmationPopup` (already imported in `libs/catalog`'s own `DetailsPanel.tsx:364-375` for logout) covers this without any host-supplied render callback. Introducing an overlay-callback for a case this simple adds an extra host integration point for no benefit; reserve the overlay-callback pattern for genuinely host-specific UI like Share's permission-level picker.

The recipient-side Delete icon is Tabler's direction-neutral `IconTrash`; no `rtl:scale-x-[-1]` mirroring is needed.

### D4. Confirmation UX: reuse `DialConfirmationPopup` via `DetailsPanel`'s existing local-confirm-state pattern

`DetailsPanel.tsx` already has one confirmation flow (direct-logout, lines 131-167 + 364-375) built from `useState` booleans (`isDirectLogoutConfirmOpen`) plus three handlers (`handleRequestLogout`, `handleCancelDirectLogout`, `handleConfirmDirectLogout`). Unshare adds a parallel `isUnshareConfirmOpen` / `handleRequestUnshare` / `handleCancelUnshare` / `handleConfirmUnshare` set, wired the same way:

```tsx
<DialConfirmationPopup
  open={isUnshareConfirmOpen}
  header={texts?.unshareConfirmTitle ?? 'Delete item?'}
  description={texts?.unshareConfirmMessage ?? `Delete "${item.displayName}" from your catalog? You'll need a new invitation to access it again.`}
  confirmLabel={texts?.unshareConfirmLabel ?? 'Delete'}
  cancelLabel={texts?.cancelLabel ?? 'Cancel'}
  isLoading={isUnsharing}
  onConfirm={handleConfirmUnshare}
  onCancel={handleCancelUnshare}
  onClose={handleCancelUnshare}
/>
```

`isUnsharing` (local `useState`, mirroring `DeleteButton`'s `isDeleting`) drives `isLoading`/implicit double-submit prevention: `handleConfirmUnshare` no-ops if already `isUnsharing`, sets it `true`, awaits `onUnshare(item)` (the app-supplied callback), and on both success and failure sets it back to `false` and closes the popup (success removes the item from the list anyway; failure keeps the popup closed but the item stays, with the app-level error notification carrying the failure signal — see D6). The item-changes-reset `useEffect` (`DetailsPanel.tsx:139-149`) gets `isUnshareConfirmOpen: false` added to its reset list, same as the logout-confirm state.

Cancel calls `onCancel`/`onClose` only — no `onUnshare` invocation, satisfying "cancel makes no API request."

### D5. BFF endpoint: `POST /api/v1/share/discard`, `{ itemId: string }`, fetch-shaped error handling

```ts
// apps/chat-api/src/share/dto/discard-shared.dto.ts
export class DiscardSharedDto {
  @IsString() @IsNotEmpty() @MaxLength(2048)
  @Matches(CATALOG_RESOURCE_URL_PATTERN, { message: '...' })
  @ApiProperty({ example: 'applications/owner-bucket/my-app' })
  itemId!: string;
}
export class DiscardSharedResponseDto {
  @ApiProperty() success!: boolean;
}
```
```ts
// apps/chat-api/src/share/share.controller.ts (new handler)
@Post('discard')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Discard a catalog resource shared with the caller' })
@ApiResponse({ status: 200, type: DiscardSharedResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 403, description: 'Resource is not shared with the caller' })
@ApiResponse({ status: 404, description: 'Resource does not exist' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async discardSharedCatalogItem(
  @Body() body: DiscardSharedDto,
  @Req() req: Request,
): Promise<DiscardSharedResponseDto> {
  const { at, sub } = req.user as SessionUser;
  return this.shareService.discardShared(body.itemId, at, sub);
}
```
```ts
// apps/chat-api/src/share/share.service.ts (new method)
async discardShared(itemId: string, accessToken: string, userSub: string): Promise<DiscardSharedResponseDto> {
  this.logger.log('Discard shared resource started');
  try {
    const result = await this.dialClient.client.discardSharedResources({
      headers: getBearerAuthHeaders(accessToken),
      body: { resources: [{ url: itemId }] },
    });
    if (result.error != null) {
      this.logger.warn(`Discard shared resource failed: status=${result.response.status}`);
      mapDialHttpStatus(result.response.status, 'share.discardShared', this.logger);
    }
    await Promise.all([
      this.deploymentsService.invalidateListCache(userSub),
      this.toolsetsService.invalidateListCache(userSub),
    ]);
    this.logger.log('Discard shared resource completed: success=true');
    return { success: true };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    return handleDialFetchError(err, 'share.discardShared', this.logger, this.getTimeoutMs());
  }
}
```

**Decision: prefer the fetch-shaped `mapDialHttpStatus`/`handleDialFetchError` pair over `files.service.ts`'s SDK-shaped `handleDialSdkError`.** The closest *functional* precedent (File Manager's discard) uses the SDK-shaped handler, but `ShareService`'s own domain (`createShareLink`, `acceptInvitation`) is entirely built on the fetch-shaped pair already. Consistency within the file being modified outweighs consistency with a different domain's precedent; both funnel through the same underlying `mapDialHttpStatus` status→exception table (`dial-error.mapper.ts:21-47`), so behavior at the HTTP-response level is identical either way. This is called out explicitly per the research findings so a reviewer doesn't mistake it for an oversight.

**Rate limit: `10/60000`**, matching File Manager's `discard-shared` — a mutation with the same shape and risk profile (irreversible-without-a-new-invitation discard), stricter than `createShareLink`'s `20/60000`.

**Authorization**: any authenticated session user may call this for any `itemId` they claim is shared with them — DIAL Core's `discardSharedResources` itself is the authority on whether the resource is actually shared with the caller; if it isn't, DIAL Core returns an error status that `mapDialHttpStatus` turns into `403 Forbidden` (not silently a no-op 200). The BFF does not need to independently verify shared status before calling Core — that would require an extra `getSharedResources` round-trip for a check Core already performs atomically.

**Idempotency / no-op discard**: discarding an item that is not (or no longer) shared with the caller is expected to surface as the same `403` DIAL Core would return for any resource the caller doesn't hold a share grant on — no special-casing needed.

### D6. Cache invalidation and frontend refetch — no new caching layer

`ShareService.discardShared` invalidates both list caches server-side (D5) so a subsequent BFF list fetch is fresh. Client-side, `CatalogView.tsx`'s `handleUnshare` (mirroring `handleDelete`) awaits the discard call, then calls `refetchDeployments()`/`refetchToolsets()` depending on `item.type` (exactly as `handleDelete` already branches, `CatalogView.tsx:480-505`) — both are already race-safe against slower in-flight requests via `DeploymentsContext`'s existing request-id-ref guard (`deploymentsRequestIdRef`/`toolsetsRequestIdRef`, `DeploymentsContext.tsx:131-141`), so no new sequencing logic is needed. `showNotification` reports success/failure identically to `handleDelete`'s existing pattern. On success, if `item.id === selectedItemId` (from `useDeployments()`), the handler calls `setSelectedItemId(null)` **before** closing the details panel, reusing `DeploymentsContext`'s existing initial-selection-fallback chain (`DeploymentsContext.tsx`'s documented precedence: current selection if still present → user config preference → operator default → `items[0]` → `null`) the next time `items` changes — `setSelectedItemId(null)` is deliberately used (not left stale) so no persisted/in-memory reference to the just-discarded id survives; the next render's fallback chain naturally re-derives a valid selection (or `null` if the catalog is empty). The details panel closes via the existing `onCloseDetails`/`onClose` callback (`DetailsPanel.tsx:345`, already used by `DeleteButton`'s success path) — since the item that was open just vanished from the caller's catalog, keeping the panel open would show a stale/inaccessible item.

**Failure paths**: if the discard request itself fails, `handleUnshare` shows the error notification and re-throws so the confirmation popup keeps the details panel open. If the discard succeeds but the following refetch fails, the handler preserves the successful mutation outcome: it clears a matching selection, shows success, and resolves so the details panel closes. This avoids inviting a retry after the irreversible mutation already completed; `DeploymentsContext` retains its own fetch error state and a later refresh/reload reconciles the list.

### D7. i18n keys

New `catalog.details.unshare.*` namespace in `CatalogI18nKeys` (`apps/chat/src/constants/translation-keys.ts`), mirroring the existing `catalog.details.delete.*` pattern:
- `DetailsUnshareConfirmTitle = 'catalog.details.unshare.confirmTitle'` → "Delete item?"
- `DetailsUnshareConfirmMessage = 'catalog.details.unshare.confirmMessage'` → `"Delete \"{{name}}\" from your catalog? You'll need a new invitation to access it again."` (interpolated via i18next `{{name}}`, not string concatenation, so RTL bidi rendering of the quoted name is correct)
- `DetailsUnshareSuccessTitle` / `DetailsUnshareSuccess` / `DetailsUnshareError`, mirroring `DetailsDeleteSuccessTitle`/`DetailsDeleteSuccess`/`DetailsDeleteError`.

The user-facing action word is Delete and Cancel reuses `ButtonsI18nKeys.Cancel`. The `catalog.details.unshare.*` namespace remains unchanged because this is only a presentation change; the business operation remains recipient-side discard.

## Risks / Trade-offs

- **[Risk] Doubling `getSharedResources` calls if the shared-helper refactor (D2) is skipped** → Mitigation: implement the unfiltered-fetch-once helper in the same slice as `sharedWithMe`, and have the existing `canEdit`/`isMy` write-check consume it, rather than adding a second independent call site.
- **[Risk] A recipient discards an item that is also referenced by an in-flight conversation (currently selected deployment) mid-generation** → Mitigation: D6's `setSelectedItemId(null)` only affects future model-selection UI state, not an already-started generation; this matches existing behavior when a deployment is deleted or becomes unavailable for any other reason, so no new conversation-level handling is introduced by this change.
- **[Risk] Race between two browser tabs, one discarding while the other still shows Unshare available** → Mitigation: the second tab's discard attempt gets DIAL Core's own `403`-mapped error (D5's authorization note) since the resource is no longer shared; the BFF cache invalidation (D5) plus the 30s list cache TTL bound how long a stale tab can show the action.
- **[Risk] `sharedWithMe` degrade-to-`false` on a transient `getSharedResources` failure silently hides Unshare for a request or two** → Mitigation: matches the existing `canEdit` degrade-to-`isMy` precedent exactly (same failure surface, already accepted for that field); logged at `warn` so it's observable, and self-heals on the next successful list fetch (not cached).
- **[Trade-off] Reusing `ShareButton` instead of a separate `UnshareButton` (D3) couples two conceptually distinct actions in one component file** → Accepted: the header slot they occupy is itself a single mutually-exclusive slot; splitting would move the exclusivity logic up to `Header.tsx` without actually reducing total code, per D3's rejected-alternative analysis.

## Open Questions / Recorded Uncertainty

- **Exact DIAL Core `ResourceTypes` values for toolsets** — `deployments.service.ts:305` uses `resourceTypes: ['APPLICATION']`, `toolsets.service.ts` presumably uses the toolset equivalent (confirmed structurally identical in the research pass but the literal enum value, e.g. `'TOOL_SET'` vs. `'TOOLSET'`, must be verified against the installed `@epam/ai-dial-typescript-sdk` `ResourceTypes` union at implementation time — Slice 1 tasks include an explicit check rather than assuming the file-manager/share-invitation-permissions spec's casing is current).
- **Tabler icon name** — the UI uses the installed direction-neutral `IconTrash` export.
- **Resolved: catalog itemId validation** — `DiscardSharedCatalogItemDto.itemId` combines the existing `IsValidFilePath` validator with a catalog-specific `@Matches` allowlist for `applications/{bucket}/{path}` and `toolsets/{bucket}/{path}`. The endpoint rejects other resource types and incomplete paths before calling DIAL Core.
