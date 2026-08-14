**Slicing strategy: contract-first, then vertical.** The generated `@epam/ai-dial-chat-api-client` sits between backend and frontend, so the OpenAPI contract (group 1) must land and regenerate (group 2) before any UI can call it. After that, each surface is a vertical slice verified on its own: catalog (groups 4–5), then conversations (group 6). Groups 1, 4, 5, and 6 are each independently shippable — the backend is inert until a caller exists, and either UI surface can ship without the other.

Verification runs per slice with single-project targets (`npm exec nx <target> <project>`), closing with one `npm exec nx affected --target=<t> --base=origin/development-1.0` sweep in group 8.

## 1. Backend endpoint (apps/chat-api)

Read `apps/chat-api/AGENTS.md` before starting — URI versioning, thin controllers, Logger + ConfigService, validated DTOs, typed HTTP exceptions.

- [x] 1.1 Create `apps/chat-api/src/share/dto/revoke-shared-access.dto.ts` with `RevokeSharedAccessDto { itemId: string }` and `RevokeSharedAccessResponseDto { success: boolean }`, reusing the `IsValidFilePath` + `@Matches` allowlist regex and `@MaxLength(2048)` from `dto/discard-shared-catalog-item.dto.ts`, with `@ApiProperty` on every field.
- [x] 1.2 Add `revokeShared(itemId, accessToken, userSub)` to `apps/chat-api/src/share/share.service.ts`: call `dialClient.client.revokeSharedResources({ headers: getBearerAuthHeaders(accessToken), body: { resources: [{ url: itemId }] } })`, map errors through `handleDialFetchError` / `mapDialHttpStatus` (400 → `NotFoundException`), then invalidate `deploymentsService.invalidateListCache(userSub)` and `toolsetsService.invalidateListCache(userSub)` and return `{ success: true }`. No pre-flight `getSharedResources` call. Log `Revoke shared access started` / `Revoke shared access completed: success=true` with no token, link, or resource path.
- [x] 1.3 Update the `discardShared` JSDoc in the same file — it currently calls `revokeSharedResources` "out-of-scope"; point it at the new method instead.
- [x] 1.4 Add the `revokeSharedAccess` handler to `apps/chat-api/src/share/share.controller.ts`: `@Post('revoke')`, `@HttpCode(200)`, `@Throttle({ default: { limit: 10, ttl: 60000 } })`, `@ApiOperation({ operationId: 'revokeSharedAccess', ... })`, `@ApiBody`, and an `@ApiResponse` for 200/400/401/403/404/429/502/503.
- [x] 1.5 Extend `apps/chat-api/src/share/tests/share.service.spec.ts`: successful revoke (exact Core request body, both caches invalidated, `{ success: true }`), `getSharedResources` never called, and each mapped status — 400→404, 401, 403, 404, 429, 5xx→502, network/timeout→503.
- [x] 1.6 Extend `apps/chat-api/src/share/tests/share.controller.spec.ts` (supertest): happy path, unauthenticated → 401, and DTO rejection → 400 for an empty, over-length, traversal-containing (`../`), and wrong-resource-type (`prompts/...`) `itemId`.
- [x] 1.7 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`.

## 2. OpenAPI contract and generated client

- [x] 2.1 Run `npm run openapi`, then `npm run openapi:check`; confirm `libs/chat-api-client/openapi.json` gained `revokeSharedAccess` with strongly-typed request and response schemas (not `object`).
- [x] 2.2 Verify: `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Do not hand-edit anything under `libs/chat-api-client/src/generated/`.

> **Deviation recorded during apply.** `npm run openapi` resolved `openapi-generator-cli` to **7.24.0** while the committed client was generated with **7.15.0**, rewriting all 26 generated files (+4006/−1760) with an unrelated API restructure (`xRaw` → `xRequestOpts` + `xRaw`) and dropping every operation's JSDoc. On the user's explicit instruction, `libs/chat-api-client/src/generated/` was reverted to `HEAD` and the revoke surface was **hand-added** instead: `RevokeSharedAccessRequest` + `revokeSharedAccessRaw`/`revokeSharedAccess` in `apis/ShareApi.ts`, and `RevokeSharedAccessDto`/`RevokeSharedAccessResponseDto` in `models/index.ts`, each copied from the sibling `discardSharedCatalogItem` shape. `openapi.json` is genuinely regenerated (prettier-formatted, +73 lines, endpoint only). This knowingly departs from AGENTS.md's "do not hand-edit generated client files" rule — see follow-up 9.4.

## 3. Frontend API wrapper and i18n keys

- [x] 3.1 Add `revokeSharedAccess(itemId: string): Promise<RevokeSharedAccessResponseDto>` to `apps/chat/src/server-api/share.api.ts`, delegating to `shareApi.revokeSharedAccess({ revokeSharedAccessDto: { itemId } })` — same shape as the existing `discardSharedCatalogItem` wrapper. Confirm `shareApi` in `apps/chat/src/server-api/api-client.ts` already exposes it; no new singleton is needed.
- [x] 3.2 Add `RevokeAccess = 'buttons.revokeAccess'` to `ButtonsI18nKeys`, the eleven `catalog.details.revokeShare.*` members to `CatalogI18nKeys`, and the five `conversationPanel.revoke.*` members to `ConversationPanelI18nKeys` in `apps/chat/src/constants/translation-keys.ts`; add every matching key with its English value to `apps/chat/src/i18n/locales/en.json` (exact strings in the `share-revoke-access` and `conversation-revoke-share-flow` specs). Grep `en.json` for each English value first to avoid re-declaring an existing string.

## 4. libs/catalog — enum, props, and confirmation content

Read `.claude/rules/libs.md` first: `{ComponentName}Props` naming, JSDoc on every exported symbol and prop, no i18n, no hardcoded typography/color classes.

- [x] 4.1 Add `RevokeAccess = 'revokeAccess'` to `DetailsConfirmationKind` in `libs/catalog/src/types/details-confirmation.ts` with a JSDoc line ("Owner-side revocation of everyone else's shared access.").
- [x] 4.2 Add `onRevokeShare?: (item: CatalogItem) => void | Promise<void>` and the five `texts` entries (`revokeShareLabel`, `revokeShareConfirmTitle`, `revokeShareConfirmMessage: (name: string) => ReactNode`, `revokeShareConfirmConsequences`, `revokingShareStatusLabel`) to `ItemDetailsTexts` / `DetailsPanelProps` / `ItemDetailsProps` in `libs/catalog/src/models/item-details-props.ts` and to `CatalogProps` in `libs/catalog/src/models/catalog-props.ts`, each with JSDoc stating its English default.
- [x] 4.3 Add the "Revoke access" entry to `manageItems` in `libs/catalog/src/components/Details/Header/Header.tsx`: gated on `!!onRevokeShare && item.isMyApp === true`, placed after the Delete entry, `IconUserOff` at `DIAL_ICON_SIZE.SM` with `aria-hidden`, `danger: true`, wired to a `useCallback` `handleRevokeShare` that calls `onRevokeShare?.(item)`. Extend the `useMemo` dependency list.
- [x] 4.4 Add the `DetailsConfirmationKind.RevokeAccess` case to `confirmationContent` in `libs/catalog/src/components/Details/DetailsPanel.tsx` (title/message/consequences/confirm label/status label per spec, `DetailsConfirmationVariant.Danger`), a `DEFAULT_REVOKE_SHARE_CONSEQUENCES` constant next to the existing default lists, and a `handleRequestRevokeShare` callback; pass `onRevokeShare={onRevokeShare ? handleRequestRevokeShare : undefined}` down to `Header`.
- [x] 4.5 Rework `handleConfirm` in the same file so the close-the-panel decision is an explicit "does this kind remove the item from the caller's view?" branch: `Delete` and `Unshare` close, `Logout` and `RevokeAccess` return to the details content. Keep the single `isConfirming` flag and the existing rejection behaviour.
- [x] 4.6 Thread `onRevokeShare` through `libs/catalog/src/components/Catalog/Catalog.tsx` to `DetailsPanel`, and export any newly named types from `libs/catalog/src/index.ts`.
- [x] 4.7 Architecture guard: confirm `libs/catalog` contains no `/api` path, no `@epam/ai-dial-chat-api-client` or `server-api` import, no app context/auth/env/feature-flag/route/analytics access, and no notification logic for revoke — the only new surface is the callback prop, the `texts` entries, and the enum member.
- [x] 4.8 Update `libs/catalog/README.md` for the new public props so its examples still compile against the current API.
- [x] 4.9 Extend `libs/catalog/src/components/Details/Header/tests/Header.spec.tsx`: entry shown for `isMyApp: true`, absent for `sharedWithMe: true`, absent when `onRevokeShare` is missing, and clicking it calls the request callback rather than the host's action.
- [x] 4.10 Extend `libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx`: the revoke sub-view opens with its title/consequences and danger confirm button; confirming calls `onRevokeShare` exactly once and leaves the panel open on success (`onClose` not called); a rejection returns to the details content with the panel open; a double confirm click invokes the callback once; changing the item clears the confirmation.
- [x] 4.11 Verify: `npm exec nx test catalog` and `npm exec nx lint catalog`.

## 5. CatalogView wiring

- [x] 5.1 Add `handleRevokeShare` to `apps/chat/src/components/CatalogView/CatalogView.tsx` (`useCallback`, deps `[showNotification, t]`), modelled on `handleUnshare`: call `revokeSharedAccess(item.id)`, show the success notification, and on rejection resolve `getApiErrorDetails(err)` for the trace id, show the error notification, and re-throw. No refetch, no `selectedItemId` change.
- [x] 5.2 Pass `onRevokeShare={handleRevokeShare}` and the five `texts` entries (using the `CatalogI18nKeys` / `ButtonsI18nKeys.RevokeAccess` members from 3.2) to the catalog component, alongside the existing `unshare*` entries.
- [x] 5.3 Extend `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx`: success path (one API call, success notification, no `refetchToolsets`/`refetchDeployments`, selection untouched) and failure path (error notification carrying the trace id, rejection propagated). Query by role/label/text; no `data-testid`.
- [x] 5.4 Verify: `npm exec nx test chat` (scoped to the CatalogView suite) and `npm exec nx lint chat`.

## 6. Conversation panel surface

- [x] 6.1 Add `pendingRevokeId` / `isRevoking` / `revokeError` state and a `useMemo` `pendingRevokeTitle` to `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, parallel to the existing unshare triple.
- [x] 6.2 Append the "Revoke access" `DropdownItem` in `getActions` for non-readonly rows only (`!isReadonlyItem`), immediately before the Delete action, using `t(ButtonsI18nKeys.RevokeAccess)` and `IconUserOff` at `DIAL_ICON_SIZE.SM` with `className="text-secondary"`; its `onClick` only calls `setPendingRevokeId(contextId)`.
- [x] 6.3 Add `handleConfirmRevoke` and `handleCloseRevokeDialog`: call `revokeSharedAccess`, then `refreshConversations()` (a rejection there must not downgrade the success), show the success notification, and close; on API rejection set the inline `revokeError` and keep the popup open. No navigation in either path.
- [x] 6.4 Render the revoke `ConfirmationPopup` with the props listed in the `conversation-revoke-share-flow` spec (`ConfirmationPopupVariant.Danger`, `isLoading={isRevoking}`, inline `role="alert"` error), structurally parallel to the existing unshare popup.
- [x] 6.5 Extend `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx` with a `describe('ConversationPanelView — revoke access', ...)` block covering every scenario in that spec's test requirement — including that a successful revoke of the *active* conversation does not navigate.
- [x] 6.6 Verify: `npm exec nx test chat` (scoped to the ConversationPanelView suite) and `npm exec nx lint chat`.

## 7. RTL and accessibility pass

- [x] 7.1 Confirm every file touched in groups 4–6 introduces only logical Tailwind classes (`ms`/`me`, `ps`/`pe`, `start`/`end`) and no `ml-*`/`pr-*`/`left-*`/`text-right`; `IconUserOff` is direction-neutral and must not carry `rtl:scale-x-[-1]`.
- [x] 7.2 Confirm accessibility: menu-entry icons are `aria-hidden`, the catalog sub-view announces `revokingShareStatusLabel` through its existing `role="status" aria-live="polite"` region, the conversation popup's inline error uses `role="alert"`, and both flows are completable by keyboard alone.
- [x] 7.3 Render both surfaces with `dir="rtl"` in the existing test setup to confirm no layout regression.

## 8. Final verification

- [x] 8.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0`, then the same for `test` and `build`.
- [x] 8.2 Re-run `npm run openapi:check` to confirm the committed `openapi.json` still matches the annotations after all edits.

## 10. Recipient-count gating (added after review — Decision 3 revised)

- [x] 10.1 Add `countRecipientsByUrl` to `apps/chat-api/src/common/utils/resource-ownership.ts`, next to `splitResourcesByPermission`.
- [x] 10.2 `DeploymentsListingService`: add a parallel `getSharedResources({ with: 'others', includeUserInfo: true, resourceTypes: ['APPLICATION'] })` call and map `recipientsCount` onto each item; add the field to `DeploymentItemDto`.
- [x] 10.3 `ToolsetsListingService`: same for `TOOL_SET`, wired into **both** `enrichToolsetsOwnership` (list) and the `enrich` helper inside `getToolset` (single); add the field to `DialToolsetDto`.
- [x] 10.4 `ConversationListingService`: add the `with: 'others'` call as a sixth entry in the existing `Promise.all` and map `recipientsCount` in `mapItems`; add the field to `ConversationListItemDto` and widen `SharedResourcesResult` with `sharedWith`.
- [x] 10.5 Regenerate `openapi.json` (`nx run chat-api:openapi-spec` + prettier) and hand-add the three `recipientsCount` model fields to the generated client, consistent with the group-2 deviation.
- [x] 10.6 `libs/catalog`: add `CatalogItem.recipientsCount`, gate the Manage entry on `recipientsCount == null || > 0`, and add `texts.revokeShareLabelWithCount`.
- [x] 10.7 Frontend: map `recipientsCount` in `map-deployment-to-catalog-item.ts`, add `buttons.revokeAccessWithCount`, pass `revokeShareLabelWithCount` from `CatalogView`, and gate + label the conversation row action.
- [x] 10.8 Tests: gate/label cases in `Header.spec.tsx` and `ConversationPanelView.spec.tsx`; count-mapping, two-call and upstream-failure cases in `deployments-listing.service.spec.ts` and `toolsets-listing.service.spec.ts`. Update the two "exactly one getSharedResources call" assertions to "exactly two".
- [x] 10.10 **Fix: distinguish "absent from a successful response" (= 0) from "call failed" (= unknown).** The first implementation mapped both to `undefined`, so every never-shared resource read as "unknown" and the action stayed visible always — exactly the symptom reported. Introduced `resolveRecipientsCount` and made the fetchers return `null` on failure.
- [x] 10.9 Verify: full `chat-api` (2119), `catalog` (261) and `chat` suites, plus lint.

## 11. Resolve the recipient count on menu open, not with the list (QA finding)

QA (2026-08-12) found the Manage menu still offering "Revoke access (N)" after a successful revoke, until a full page reload. The count came from the list DTOs — a snapshot taken at list-fetch time and cached for 30s, so it outlived the fact it described. Moved to a per-resource lookup issued when the menu opens.

- [x] 11.1 Add `GET /api/v1/share/recipients` — `apps/chat-api/src/share/dto/share-recipients.dto.ts` (`GetShareRecipientsDto` query + `ShareRecipientsResponseDto`, same `itemId` allowlist as the revoke DTO), `ShareService.getRecipientsCount` (one `getSharedResources({ with: 'others', includeUserInfo: true })` scoped to the id's resource kind, then `countRecipientsByUrl` + `resolveRecipientsCount` over both the raw and decoded id), and a thin `@Get('recipients')` handler throttled at 60/min.
- [x] 11.2 Drop the eager count: remove `getRecipientCounts`/`getToolsetRecipientCounts` and the fourth `getSharedResources` call from `DeploymentsListingService`, `ToolsetsListingService` (list **and** single-`getToolset` paths) and `ConversationListingService`, and the `recipientsCount` field from `DeploymentItemDto`, `DialToolsetDto` and `ConversationListItemDto`. Narrow `SharedResourcesResult` back to the fields conversations still use.
- [x] 11.3 chat-api tests: `getRecipientsCount` cases in `share.service.spec.ts` (count, resource-kind scoping, successful miss → 0, percent-encoded conversation id, 401/502/503) and endpoint cases in `share.controller.spec.ts` (200, missing/invalid `itemId` → 400, conversation path, 401/502/503). The three listing specs assert "exactly one `getSharedResources` call" again.
- [x] 11.4 Regenerate `openapi.json`; hand-add `getShareRecipientsCount` + `ShareRecipientsResponseDto` to the generated client and remove the three `recipientsCount` model fields, consistent with the group-2 deviation (follow-up 9.4 still open).
- [x] 11.5 `libs/catalog`: remove `CatalogItem.recipientsCount`; add `onFetchRecipientsCount?: (item) => Promise<number | undefined>` to `CatalogProps`/`DetailsPanelProps`/`Header`; hold `RecipientsCountStatus` (`types/recipients-count.ts`) + count in `Header`, requested from the dropdown's `onOpenChange` and the trigger's `onMouseEnter`/`onFocus`, reset on `item.id`, skipped for items that could never offer the action. Loading hides the entry; `0` hides it; a rejection shows it uncounted.
- [x] 11.6 Frontend wiring: `getShareRecipientsCount` in `share.api.ts`; `handleFetchRecipientsCount` in `CatalogView`; `useShareRecipientsCount` hook + `RecipientsCountStatus` (`types/share-recipients.ts`) driving the conversation row action, requested from `handleActionMenuOpen` and invalidated after a successful revoke. Drop the `recipientsCount` mapping from `map-deployment-to-catalog-item.ts`.
- [x] 11.7 Frontend tests: lazy-request/gating/label cases in `Header.spec.tsx` (its ui-kit mock now forwards `onOpenChange`/`onMouseEnter`/`onFocus`), `ConversationPanelView.spec.tsx` (its panel mock now fires `onActionMenuOpen` from the row trigger), `CatalogView.spec.tsx`, and a new `useShareRecipientsCount.spec.ts`.
- [x] 11.8 Verify: `chat-api`, `catalog` and `chat` suites plus lint; `npm run openapi:check`.

## 9. Follow-ups (out of scope — do not implement here)

- [ ] 9.1 Show the current recipient **list** (not just the count) in the confirmation — `sharedWith[].user` is already fetched and discarded by `countRecipientsByUrl`, so this is now mostly a UI task.
- [ ] 9.6 **Decide what to do about issued-but-unaccepted invitation links.** `recipientsCount` counts accepted grants only, so a live link nobody has opened yet reads as `0` and hides the revoke action. Blocked on 9.2 — if revoke does invalidate pending links, the gate needs an escape hatch (e.g. never hide when the caller has an outstanding invitation).
- [ ] 9.2 Record a follow-up to determine whether DIAL Core invalidates outstanding not-yet-accepted invitation links on revoke, and to document the answer in the confirmation copy if it does not.
- [ ] 9.3 Record a follow-up for offering revoke from the Share popover (`apps/chat/src/components/SharePopoverContainer/`) in addition to the Manage menu.
- [ ] 9.5 **Fix the 3 pre-existing `CatalogView > unshare` test failures on this branch.** `handleUnshare`'s success notification uses `NotificationVariant.Info` (`CatalogView.tsx:716`) while its three tests assert `variant: 'success'`, and every other completed-mutation notification in that file (delete, publish, create) uses `NotificationVariant.Success`. Reproduced on a clean stashed tree — 3 failed / 57 passed before any of this change's edits. `handleRevokeShare` deliberately uses `Success`, matching the file's convention and its own spec. Not fixed here to avoid a drive-by edit in an untouched code path.
- [ ] 9.4 **Pin `openapi-generator-cli` to the version the committed client was generated with (7.15.0), or land the 7.24.0 upgrade as its own change.** Until then `npm run openapi` produces a 4000-line unrelated diff, and `libs/chat-api-client/src/generated/` contains the hand-added revoke surface recorded under group 2 — the two are consistent in shape but were not produced by the same run. The version lives in `openapitools.json` / the `openapi-sdk` target in `apps/chat-api/package.json`.
