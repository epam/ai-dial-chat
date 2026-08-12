## ADDED Requirements

### Requirement: BFF revoke-shared-access endpoint

The system SHALL expose `POST /api/v1/share/revoke` on the existing `ShareController` (`apps/chat-api/src/share/share.controller.ts`), allowing an authenticated session user who owns a catalog resource (application or toolset) or a conversation to revoke **all** outstanding shared access to it via DIAL Core `revokeSharedResources`.

The endpoint SHALL:

- Require a valid session; respond `401 Unauthorized` when no session is present.
- Accept `RevokeSharedAccessDto { itemId: string }` validated via the global NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted, transform). `itemId` SHALL be a non-empty string, max length 2048, validated with the existing `IsValidFilePath` validator and an `@Matches` allowlist restricted to `applications/{bucket}/{path}`, `toolsets/{bucket}/{path}`, or `conversations/{bucket}/{path}` — the same pattern `DiscardSharedCatalogItemDto` uses (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts`). Other DIAL resource types and incomplete paths SHALL be rejected before any DIAL Core call.
- Use the session `accessToken` as the Bearer credential, via `getBearerAuthHeaders`.
- Call SDK `revokeSharedResources({ headers, body: { resources: [{ url: itemId }] } })`, passing `itemId` through unmodified with no bucket/path reconstruction.
- NOT perform any pre-flight `getSharedResources` check. Unlike `discardShared`, a resource with no current recipients is a legitimate no-op success for the owner, not a condition to surface as an error.
- Rely on DIAL Core to enforce ownership; a caller who does not own the resource SHALL surface as `403 Forbidden` via `mapDialHttpStatus`.
- On success, invalidate both `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` before responding, unconditionally regardless of `itemId` type, mirroring `ShareService.discardShared`. Conversations have no equivalent server-side list cache, so for a conversation `itemId` this is a harmless no-op.
- Respond `200 OK` with `RevokeSharedAccessResponseDto { success: true }`. DIAL Core returns an empty 200 body for this operation, so the response is synthesized by the BFF.
- Apply `@Throttle({ default: { limit: 10, ttl: 60000 } })`, matching the discard endpoint's posture.
- Map upstream failures via the fetch-shaped `mapDialHttpStatus` / `handleDialFetchError` pair: DIAL Core 400 → 404 (`'Resource does not exist'`, since the DTO already rejects malformed itemIds so a Core 400 can only mean an unresolvable resource — same reasoning as `discardShared`), 401 → 401, 403 → 403, 404 → 404, 429 → 429, 5xx → 502, network/timeout → 503.
- Not cache the mutation response.
- Log structured start/completion messages (e.g. `Revoke shared access started`, `Revoke shared access completed: success=true`) without the access token, invitation links, full resource path, or any other user data.

Controller handler name / OpenAPI operationId: **`revokeSharedAccess`** → generated client method `revokeSharedAccess()`.

**Example request:**
```http
POST /api/v1/share/revoke
Content-Type: application/json

{ "itemId": "applications/owner-bucket/my-app" }
```

**Example response (200):**
```json
{ "success": true }
```

**Generated-client impact**: new operation `revokeSharedAccess` on `libs/chat-api-client`'s `ShareApi`, request DTO `RevokeSharedAccessDto { itemId: string }`, response DTO `RevokeSharedAccessResponseDto { success: boolean }`. Frontend callers use the normal (non-`Raw`) generated method through a thin wrapper `revokeSharedAccess(itemId)` in `apps/chat/src/server-api/share.api.ts`.

Authorization: any authenticated session user may call the endpoint; DIAL Core authorizes the specific resource, rejecting non-owners with 403. The endpoint is NOT gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — `apps/chat-api` reads no feature-flag environment variables, and neither the share-create nor the discard endpoint is gated.

Observability: no new metrics. The endpoint is covered by the existing global `MetricsInterceptor` and the structured log lines above.

#### Scenario: Successful revoke

- **WHEN** an authenticated owner calls `POST /api/v1/share/revoke` with `{ itemId: "applications/owner-bucket/my-app" }`
- **THEN** the endpoint calls DIAL Core `revokeSharedResources` with `{ resources: [{ url: "applications/owner-bucket/my-app" }] }`, invalidates both the deployments and toolsets list caches for the caller, and responds `200 { success: true }`

#### Scenario: Revoking a resource nobody currently holds succeeds

- **WHEN** the owner revokes a resource that was never shared, or whose recipients have all already discarded it
- **THEN** no `getSharedResources` call is made, DIAL Core's success response is passed through, and the endpoint responds `200 { success: true }`

#### Scenario: Non-owner is rejected

- **WHEN** a caller who does not own the resource calls the endpoint for it
- **THEN** DIAL Core's forbidden response is mapped to `403 Forbidden` and neither cache is invalidated

#### Scenario: Invalid itemId shape rejected

- **WHEN** the request body's `itemId` does not match the allowlisted resource-URL pattern (e.g. contains `../`, is empty, or names another DIAL resource type)
- **THEN** the endpoint responds `400 Bad Request` before any DIAL Core call is made

#### Scenario: Unauthenticated request

- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds `401 Unauthorized`

#### Scenario: Resource does not exist

- **WHEN** DIAL Core returns `400` or `404` for the given `itemId`
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: Rate limit exceeded

- **WHEN** the calling session exceeds 10 requests per 60 seconds to this endpoint
- **THEN** the endpoint responds `429 Too Many Requests`

#### Scenario: DIAL Core upstream error

- **WHEN** DIAL Core returns a 5xx status
- **THEN** the endpoint responds `502 Bad Gateway`

#### Scenario: DIAL Core unreachable or timed out

- **WHEN** the call to DIAL Core times out or the connection fails
- **THEN** the endpoint responds `503 Service Unavailable`

### Requirement: List endpoints report how many users hold shared access

`DeploymentsListingService`, `ToolsetsListingService`, and `ConversationListingService` SHALL each issue a second `getSharedResources` call with `{ with: 'others', includeUserInfo: true }` alongside their existing `{ with: 'me' }` call, and map each returned resource's `sharedWith.length` onto a new optional `recipientsCount` field on `DeploymentItemDto`, `DialToolsetDto`, and `ConversationListItemDto`.

The two calls SHALL run in parallel (`Promise.all`) and SHALL be issued **once per list request**, never per item — one call returns the caller's whole shared-with-others set, which is then keyed by resource url. Both remain behind the existing 30-second per-user list caches.

The second call SHALL be best-effort, matching its `with: 'me'` sibling: a DIAL Core error or network failure SHALL be logged and leave `recipientsCount` absent rather than failing the list.

`recipientsCount` is three-valued to consumers — a positive number, `0`, or absent-meaning-unknown — and the two "no data" cases MUST NOT be conflated. DIAL Core omits resources nobody currently holds from a **successful** `with: 'others'` response, so a resource missing from a successful result SHALL yield `0`, not absent. Only a **failed** call SHALL yield absent. Conflating them makes every never-shared resource read as "unknown", which defeats the gating entirely. Enforced by the shared `resolveRecipientsCount(counts, ...urls)` helper, which takes `null` for the failure case and returns `0` for a successful miss.

`ShareMetadata` entries are only produced for users who **accepted** an invitation, so `recipientsCount` counts accepted grants. An issued-but-unopened share link contributes nothing and reads as `0`.

Shared helper: `countRecipientsByUrl` in `apps/chat-api/src/common/utils/resource-ownership.ts`, alongside the existing `splitResourcesByPermission`.

#### Scenario: Count is mapped onto an owned item

- **WHEN** the shared-with-others call returns `{ url: 'applications/BUCKET/my-app', sharedWith: [a, b] }`
- **THEN** that deployment's `recipientsCount` is `2`

#### Scenario: One call per list request, not per item

- **WHEN** a deployments list containing many items is requested
- **THEN** `getSharedResources` is called exactly twice — once with `with: 'me'`, once with `with: 'others'` and `includeUserInfo: true` — both scoped to `APPLICATION`

#### Scenario: Resource absent from a successful response counts as zero

- **WHEN** the `with: 'others'` call succeeds and does not mention an owned resource
- **THEN** that item's `recipientsCount` is `0`, so the UI hides its revoke action

#### Scenario: Upstream failure leaves the count unknown

- **WHEN** the `with: 'others'` call returns an error status
- **THEN** the list still resolves, every item's `recipientsCount` is absent (not `0`), and a warning is logged

### Requirement: Owner-side "Revoke access" action in the catalog details panel

`Header` (`libs/catalog/src/components/Details/Header/Header.tsx`) SHALL append a "Revoke access" entry to the details panel's "Manage" dropdown when, and only when, both of the following hold:

- an `onRevokeShare` callback was supplied by the host, and
- the item's `isMyApp` is `true`.

The entry SHALL render after the owner-side Delete entry, use the label `texts.revokeShareLabel` (English default `'Revoke access'`), and use `IconUserOff` from `@tabler/icons-react` at `DIAL_ICON_SIZE.SM` with `aria-hidden`, visually distinguishing it from Delete's `IconTrash` while sharing Delete's `danger: true` treatment. Because the entry is gated on ownership and "Remove from My List" is gated on `sharedWithMe`, the two never render together.

Clicking it SHALL only request confirmation — it SHALL NOT call the host's `onRevokeShare` directly.

Additionally, the entry SHALL be hidden when `item.recipientsCount === 0` — an action that could only be a no-op is noise. When `recipientsCount` is `undefined` (the host could not determine it, e.g. DIAL Core was unreachable) the entry SHALL remain visible, so a transient upstream failure never removes the owner's only way to revoke.

When `recipientsCount` is a positive number the label SHALL come from `texts.revokeShareLabelWithCount(count)` (English default `` (count) => `Revoke access (${count})` ``), so the owner sees the blast radius before opening the confirmation; when it is `undefined` the plain `texts.revokeShareLabel` is used.

#### Scenario: Owned item exposes the action

- **GIVEN** a catalog item with `isMyApp: true` and a host-supplied `onRevokeShare`
- **WHEN** the details panel's Manage menu is opened
- **THEN** the menu includes a "Revoke access" entry after the Delete entry, and no "Remove from My List" entry

#### Scenario: Shared-with-me item does not expose the action

- **GIVEN** a catalog item with `isMyApp: false` and `sharedWithMe: true`
- **WHEN** the details panel's Manage menu is opened
- **THEN** the menu includes "Remove from My List" and no "Revoke access" entry

#### Scenario: Host that supplies no callback gets no entry

- **GIVEN** a catalog item with `isMyApp: true` and no `onRevokeShare` prop
- **WHEN** the Manage menu is opened
- **THEN** no "Revoke access" entry is rendered

#### Scenario: Confirmation precedes the API call

- **WHEN** the user activates "Revoke access"
- **THEN** the confirmation sub-view opens and `onRevokeShare` has not been called

#### Scenario: Item nobody holds access to does not expose the action

- **GIVEN** a catalog item with `isMyApp: true` and `recipientsCount: 0`
- **WHEN** the Manage menu is opened
- **THEN** no "Revoke access" entry is rendered

#### Scenario: Known recipient count is shown in the label

- **GIVEN** a catalog item with `isMyApp: true` and `recipientsCount: 3`
- **WHEN** the Manage menu is opened
- **THEN** the entry's label reads "Revoke access (3)"

#### Scenario: Unknown recipient count keeps the action reachable

- **GIVEN** a catalog item with `isMyApp: true` and no `recipientsCount`
- **WHEN** the Manage menu is opened
- **THEN** the entry is rendered with the plain "Revoke access" label

### Requirement: `CatalogView` wires revoke to the BFF endpoint

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL implement `onRevokeShare` as `handleRevokeShare`, structurally parallel to the existing `handleUnshare` (`CatalogView.tsx:679`):

1. Call `revokeSharedAccess(item.id)` from `apps/chat/src/server-api/share.api.ts`.
2. On success, show a success notification (`title` = `CatalogI18nKeys.DetailsRevokeShareSuccessTitle`, `message` = `CatalogI18nKeys.DetailsRevokeShareSuccess` interpolating `{ name: item.name }`).
3. On rejection, resolve the request's `traceId` via `getApiErrorDetails(err)`, show an error notification (`title` = `CatalogI18nKeys.DetailsRevokeShareErrorTitle`, `message` = `CatalogI18nKeys.DetailsRevokeShareError` with `{ name: item.name }`, `requestId` = `traceId`), and re-throw so the panel returns to its details content.

Unlike `handleUnshare`, it SHALL NOT refetch deployments or toolsets and SHALL NOT clear `selectedItemId`: revoking does not change what the owner can see, so neither list membership nor the current selection is affected.

`CatalogView` SHALL pass the corresponding `texts` entries through to the catalog, alongside the existing `unshare*` entries.

#### Scenario: Successful revoke notifies and leaves the catalog untouched

- **WHEN** the user confirms revoking access to an owned toolset
- **THEN** `revokeSharedAccess` is called once with the item id, a success notification is shown, neither deployments nor toolsets are refetched, and `selectedItemId` is unchanged

#### Scenario: Failed revoke surfaces the trace id and re-throws

- **WHEN** `revokeSharedAccess` rejects
- **THEN** an error notification is shown carrying the request's trace id, and the rejection propagates to the details panel

### Requirement: i18n keys for the catalog revoke flow

New keys SHALL be added to `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`. The generic action label lives in the shared `ButtonsI18nKeys` namespace so the conversation surface reuses the same key, per `.claude/rules/all-ts.md` §"Avoid duplicate translation values"; the rest are feature-scoped under `catalog.details.revokeShare.*`, matching the existing `catalog.details.unshare.*` nesting.

| Enum member | Key | English value |
|---|---|---|
| `ButtonsI18nKeys.RevokeAccess` | `buttons.revokeAccess` | `Revoke access` |
| `CatalogI18nKeys.DetailsRevokeShareConfirmTitle` | `catalog.details.revokeShare.confirmTitle` | `Revoke access?` |
| `CatalogI18nKeys.DetailsRevokeShareConfirmMessage` | `catalog.details.revokeShare.confirmMessage` | `Revoke shared access to "{{name}}"? Anyone you shared it with will lose access.` |
| `CatalogI18nKeys.DetailsRevokeShareConsequenceOthersLoseAccess` | `catalog.details.revokeShare.consequenceOthersLoseAccess` | `Everyone you shared it with loses access` |
| `CatalogI18nKeys.DetailsRevokeShareConsequenceLinksStopWorking` | `catalog.details.revokeShare.consequenceLinksStopWorking` | `Existing share links stop working` |
| `CatalogI18nKeys.DetailsRevokeShareConsequenceKeepsYourCopy` | `catalog.details.revokeShare.consequenceKeepsYourCopy` | `You keep full access — nothing is deleted` |
| `CatalogI18nKeys.DetailsRevokeShareRevokingStatus` | `catalog.details.revokeShare.revokingStatus` | `Revoking access` |
| `CatalogI18nKeys.DetailsRevokeShareSuccessTitle` | `catalog.details.revokeShare.successTitle` | `Access revoked` |
| `CatalogI18nKeys.DetailsRevokeShareSuccess` | `catalog.details.revokeShare.success` | `Shared access to "{{name}}" was revoked.` |
| `CatalogI18nKeys.DetailsRevokeShareErrorTitle` | `catalog.details.revokeShare.errorTitle` | `Revoke failed` |
| `CatalogI18nKeys.DetailsRevokeShareError` | `catalog.details.revokeShare.error` | `Failed to revoke access to "{{name}}". Please try again.` |

`apps/chat/src/i18n/locales/` contains only `en.json` today, so no other locale files require updates.

#### Scenario: New keys resolve via i18n

- **WHEN** `en.json` is loaded
- **THEN** `buttons.revokeAccess` resolves to `"Revoke access"` and every `catalog.details.revokeShare.*` key resolves to its English value above

### Requirement: Library isolation for the revoke callback

`libs/catalog` SHALL receive revoke behaviour exclusively through host-supplied values: the `onRevokeShare?: (item: CatalogItem) => void | Promise<void>` callback on `CatalogProps` / `DetailsPanelProps` / `ItemDetailsProps`, and the `texts.revokeShareLabel`, `texts.revokeShareConfirmTitle`, `texts.revokeShareConfirmMessage`, `texts.revokeShareConfirmConsequences`, and `texts.revokingShareStatusLabel` entries on `ItemDetailsTexts`, each with an English default.

The lib SHALL NOT contain the endpoint path, import `@epam/ai-dial-chat-api-client` or `apps/chat/src/server-api`, read app contexts, emit notifications, or know that revocation is an HTTP operation at all. `texts.revokeShareConfirmMessage` SHALL follow the existing `unshareConfirmMessage` signature `(name: string) => ReactNode` so hosts can pass either JSX or a plain translated string.

Every newly declared prop and `texts` entry SHALL be read by the lib — the callback by `Header`/`DetailsPanel`, each text entry by `DetailsPanel`'s confirmation content resolution — and `libs/catalog/README.md` SHALL document the new public props.

#### Scenario: Lib holds no host integration details

- **WHEN** `libs/catalog` is searched for `/api/`, `chat-api-client`, `server-api`, or notification imports related to revoke
- **THEN** no match is found; the only revoke-related surface is the callback prop, the `texts` entries, and the `DetailsConfirmationKind.RevokeAccess` member

### Requirement: RTL, accessibility, and memoisation for the catalog revoke action

The Manage-menu entry and the confirmation sub-view SHALL introduce no physical-direction Tailwind classes; the existing `Dropdown placement="bottom-end"` and the sub-view's logical layout classes are reused unchanged. `IconUserOff` is direction-neutral and SHALL NOT be mirrored with `rtl:scale-x-[-1]`. The item name inside the confirmation message is substituted through the i18next `{{name}}` placeholder, not string concatenation, so mixed-direction names render under the browser's bidi algorithm.

The entry's icon SHALL carry `aria-hidden` (the entry's own label names it). The confirmation sub-view's in-flight status SHALL be announced through the existing `role="status" aria-live="polite"` region using `texts.revokingShareStatusLabel`, and the whole flow SHALL be operable by keyboard alone using the dialog semantics the sub-view already provides.

`handleRevokeShare` in `CatalogView` SHALL be wrapped in `useCallback` with `[showNotification, t]` as dependencies, matching `handleUnshare`. The `Header` `manageItems` array SHALL keep its existing `useMemo`, extended with the new visibility flag and handler in its dependency list, and the new `handleRevokeShare` callback inside `Header` SHALL be `useCallback`-wrapped like `handleUnshare`.

#### Scenario: RTL layout leaves the entry logically positioned

- **WHEN** `dir="rtl"` is set on the document and the Manage menu is opened for an owned item
- **THEN** "Revoke access" renders in the same logical position as the other entries and `IconUserOff` is not mirrored

#### Scenario: In-flight state is announced

- **WHEN** the revoke confirmation is submitted and the host callback is pending
- **THEN** the sub-view's live region announces the revoking status text and both the confirm and cancel controls are disabled

### Requirement: Tests — backend and catalog revoke flow

`apps/chat-api/src/share/tests/share.service.spec.ts` and `share.controller.spec.ts` SHALL cover: a successful revoke (correct Core body, both caches invalidated, `{ success: true }`); no `getSharedResources` call being made; each mapped status (400→404, 401, 403, 404, 429, 5xx→502, network→503); DTO rejection of a malformed, empty, over-length, traversal-containing, and wrong-resource-type `itemId`; and the unauthenticated case.

`libs/catalog/src/components/Details/Header/tests/Header.spec.tsx` and `libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx` SHALL cover: entry visibility for owned vs shared-with-me vs callback-absent items; clicking opens the confirmation without invoking the callback; confirming calls `onRevokeShare` exactly once with the panel staying open on success; a rejection returns to the details content with the panel still open; and a second rapid confirm click not double-invoking the callback.

`apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` SHALL cover the success path (one API call, success notification, no refetch, selection untouched) and the failure path (error notification with trace id, rejection re-thrown).

Tests SHALL query by role, label, and text — no implementation-specific selectors and no `data-testid`.

#### Scenario: Test suites cover the full success and failure matrix

- **WHEN** the backend, lib, and `CatalogView` suites are run
- **THEN** every scenario listed above passes
