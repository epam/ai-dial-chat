# share-revoke-access Specification

## Purpose

An owner takes back every recipient's access to a resource they own — a catalog entity (application or toolset) or a conversation — without deleting it. Covers the BFF revoke endpoint, the on-demand recipient-count lookup that gates the action, and the catalog details-panel surface that offers it.

## Requirements

### Requirement: BFF revoke-shared-access endpoint

The system SHALL expose `POST /api/v1/share/revoke` on the existing `ShareController` (`apps/chat-api/src/share/share.controller.ts`), allowing an authenticated session user who owns a catalog resource (application, toolset, or skill) or a conversation to revoke **all** outstanding shared access to it via DIAL Core `revokeSharedResources`.

The endpoint SHALL:

- Require a valid session; respond `401 Unauthorized` when no session is present.
- Accept `RevokeSharedAccessDto { itemId: string }` validated via the global NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted, transform). `itemId` SHALL be a non-empty string, max length 2048, validated with the existing `IsValidFilePath` validator and an `@Matches` allowlist restricted to `applications/{bucket}/{path}`, `toolsets/{bucket}/{path}`, `conversations/{bucket}/{path}`, **or `skills/{bucket}/{path}`** — the same pattern `DiscardSharedCatalogItemDto` uses (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts`). Other DIAL resource types and incomplete paths SHALL be rejected before any DIAL Core call.
- Use the session `accessToken` as the Bearer credential, via `getBearerAuthHeaders`.
- Call SDK `revokeSharedResources({ headers, body: { resources: [{ url: itemId }] } })`, passing `itemId` through unmodified with no bucket/path reconstruction.
- NOT perform any pre-flight `getSharedResources` check. Unlike `discardShared`, a resource with no current recipients is a legitimate no-op success for the owner, not a condition to surface as an error.
- Rely on DIAL Core to enforce ownership; a caller who does not own the resource SHALL surface as `403 Forbidden` via `mapDialHttpStatus`.
- On success, invalidate both `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` before responding, unconditionally regardless of `itemId` type, mirroring `ShareService.discardShared`. Conversations and skills have no equivalent server-side list cache, so for a conversation or skill `itemId` this is a harmless no-op.
- Respond `200 OK` with `RevokeSharedAccessResponseDto { success: true }`. DIAL Core returns an empty 200 body for this operation, so the response is synthesized by the BFF.
- Apply `@Throttle({ default: { limit: 10, ttl: 60000 } })`, matching the discard endpoint's posture.
- Map upstream failures via the fetch-shaped `mapDialHttpStatus` / `handleDialFetchError` pair: DIAL Core 400 → 404 (`'Resource does not exist'`, since the DTO already rejects malformed itemIds so a Core 400 can only mean an unresolvable resource — same reasoning as `discardShared`), 401 → 401, 403 → 403, 404 → 404, 429 → 429, 5xx → 502, network/timeout → 503.
- Not cache the mutation response.
- Log structured start/completion messages (e.g. `Revoke shared access started`, `Revoke shared access completed: success=true`) without the access token, invitation links, full resource path, or any other user data.

Resolve the DIAL Core `resourceTypes` filter for `revokeShared` via the existing `RESOURCE_KIND_BY_PREFIX` map (`share.service.ts`), which already includes a `['skills/', 'SKILL']` entry alongside `applications/` → `APPLICATION`, `toolsets/` → `TOOL_SET`, and `conversations/` → `CONVERSATION` — no change to this map is required by this capability, only to the DTO allowlist that gates whether a `skills/` `itemId` reaches it.

Controller handler name / OpenAPI operationId: **`revokeSharedAccess`** → generated client method `revokeSharedAccess()`.

**Example request:**
```http
POST /api/v1/share/revoke
Content-Type: application/json

{ "itemId": "skills/owner-bucket/team-a/docs-helper" }
```

**Example response (200):**
```json
{ "success": true }
```

**Generated-client impact**: no new operation — `revokeSharedAccess` already exists; only the accepted `itemId` shape widens. Request DTO `RevokeSharedAccessDto { itemId: string }`, response DTO `RevokeSharedAccessResponseDto { success: boolean }` are unchanged in shape. Regenerating via `npm run openapi` updates only the Swagger-derived `@ApiProperty.example`/description text if changed, not the DTO's field list.

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

#### Scenario: Skill itemId is now accepted by the revoke endpoint

- **WHEN** an authenticated owner calls `POST /api/v1/share/revoke` with `{ itemId: "skills/owner-bucket/team-a/docs-helper" }` for a skill they own
- **THEN** the endpoint accepts the request (no longer rejecting the `skills/` prefix as invalid), resolves the `SKILL` resource kind via `RESOURCE_KIND_BY_PREFIX`, calls DIAL Core `revokeSharedResources` with that itemId, and responds `200 { success: true }`

#### Scenario: Malformed skill itemId is still rejected

- **WHEN** the request body's `itemId` is `skills/owner-bucket` (missing the item path segment) or `skills//team-a/docs-helper` (empty bucket segment)
- **THEN** the endpoint responds `400 Bad Request` before any DIAL Core call is made, identically to a malformed `applications/...` or `toolsets/...` itemId

### Requirement: `GET /api/v1/share/recipients` reports how many users hold shared access

`ShareController` SHALL expose `GET /api/v1/share/recipients?itemId=...`, throttled at 60 requests per minute (it fires whenever an owner opens a menu offering revoke), answering `ShareRecipientsResponseDto { itemId, recipientsCount }`.

`GetShareRecipientsDto` SHALL validate `itemId` with the same allowlist as `RevokeSharedAccessDto` (`applications|toolsets|conversations|skills` prefix, `IsValidFilePath`, `@MaxLength(2048)`): a resource revoke cannot act on has no count worth answering.

`ShareService.getRecipientsCount` SHALL call `getSharedResources({ resourceTypes: [kind(itemId)], with: 'others', includeUserInfo: true })` and pick the one resource out of that set with `countRecipientsByUrl` + `resolveRecipientsCount(counts, itemId, decode(itemId))` — both encodings are tried because list ids and DIAL Core share urls differ in percent-encoding for some resource types. DIAL Core has no single-resource variant of this query. `kind(itemId)` SHALL resolve `skills/`-prefixed ids to `SKILL` via the existing `RESOURCE_KIND_BY_PREFIX` map, unchanged by this capability.

DIAL Core omits resources nobody currently holds from a **successful** response, so a resource missing from a successful result SHALL answer `0`. An upstream failure SHALL surface as `502`/`503` rather than as a count, leaving the caller to decide how to degrade — a fabricated `0` would silently remove the owner's only way to revoke.

`ShareMetadata` entries are only produced for users who **accepted** an invitation, so `recipientsCount` counts accepted grants. An issued-but-unopened share link contributes nothing and reads as `0`.

**No count is carried on list items.** `DeploymentItemDto`, `DialToolsetDto`, `ConversationListItemDto`, and `SkillMetadataItemDto` SHALL NOT expose a `recipientsCount` field, and `DeploymentsListingService`, `ToolsetsListingService`, `ConversationListingService`, and `SkillsListingService` SHALL each issue exactly one `getSharedResources` call (`with: 'me'`, for ownership flags) per listing request. A count taken at list-fetch time and cached for 30 seconds outlives the fact it describes — after a successful revoke the list still reported the pre-revoke recipients, so the Manage menu went on offering "Revoke access (3)" until a full page reload.

Shared helpers: `countRecipientsByUrl` and `resolveRecipientsCount` in `apps/chat-api/src/common/utils/resource-ownership.ts`.

#### Scenario: Count is read for the requested resource

- **WHEN** the shared-with-others set contains `{ url: 'applications/BUCKET/my-app', sharedWith: [a, b] }`
- **THEN** `GET /api/v1/share/recipients?itemId=applications/BUCKET/my-app` answers `{ itemId, recipientsCount: 2 }`

#### Scenario: Resource absent from a successful response counts as zero

- **WHEN** the upstream call succeeds and does not mention the requested resource
- **THEN** the endpoint answers `recipientsCount: 0`, so the UI hides the revoke action

#### Scenario: Upstream failure is surfaced, not smoothed over

- **WHEN** DIAL Core returns an error status or is unreachable
- **THEN** the endpoint responds `502`/`503`, and no count is invented

#### Scenario: Non-revocable resource is rejected

- **WHEN** `itemId` names a prompt, a file, or a traversal path
- **THEN** the endpoint responds `400` and DIAL Core is never called

#### Scenario: List endpoints no longer pay for the count

- **WHEN** a deployments list containing many items is requested
- **THEN** `getSharedResources` is called exactly once, with `with: 'me'`, and no item carries a `recipientsCount`

#### Scenario: Recipient count for a shared skill

- **WHEN** the shared-with-others set contains `{ url: 'skills/owner-bucket/team-a/docs-helper', sharedWith: [a] }`
- **THEN** `GET /api/v1/share/recipients?itemId=skills/owner-bucket/team-a/docs-helper` resolves `kind(itemId) = 'SKILL'` and answers `{ itemId, recipientsCount: 1 }`

### Requirement: Owner-side "Revoke access" action in the catalog details panel

`Header` (`libs/catalog/src/components/Details/Header/Header.tsx`) SHALL append a "Revoke access" entry to the details panel's "Manage" dropdown when, and only when, both of the following hold:

- an `onRevokeShare` callback was supplied by the host, and
- the item's `isMyApp` is `true`.

The entry SHALL render after the owner-side Delete entry, use the label `texts.revokeShareLabel` (English default `'Revoke access'`), and use `IconUserOff` from `@tabler/icons-react` at `DIAL_ICON_SIZE.SM` with `aria-hidden`, visually distinguishing it from Delete's `IconTrash` while sharing Delete's `danger: true` treatment. Because the entry is gated on ownership and "Remove from My List" is gated on `sharedWithMe`, the two never render together.

Clicking it SHALL only request confirmation — it SHALL NOT call the host's `onRevokeShare` directly.

Additionally, the entry SHALL be gated on a recipient count resolved **when the Manage menu opens**, via the host-supplied `onFetchRecipientsCount(item): Promise<number | undefined>`. `Header` SHALL call it from the dropdown's `onOpenChange`, and also from the trigger's `onMouseEnter`/`onFocus` so the lookup is usually settled before the click lands — at most once per displayed item, reset whenever `item.id` changes. It SHALL NOT be called for an item that could never offer the action (no `onRevokeShare`, `isMyApp !== true`, or `isRevokeShareVisible` returning `false`).

Resolution states map to the entry as follows:

- **in flight** — the entry is withheld, so a count never appears and then contradicts itself,
- **`0`** — the entry stays hidden; an action that could only be a no-op is noise,
- **positive number** — the entry is shown, labelled `texts.revokeShareLabelWithCount(count)` (English default `` (count) => `Revoke access (${count})` ``) so the owner sees the blast radius before confirming,
- **`undefined` or a rejection** — the entry is shown with the plain `texts.revokeShareLabel`, so a transient upstream failure never removes the owner's only way to revoke.

When the host supplies no `onFetchRecipientsCount`, the entry is offered for every owned item.

Resolving on menu open, rather than reading a value carried on the item, is what keeps the entry honest after a revoke: the confirmation sub-view unmounts `Header`, so the next menu open asks again instead of replaying a pre-revoke count.

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

#### Scenario: Count is requested on menu open, not on render

- **GIVEN** an owned catalog item and a host-supplied `onFetchRecipientsCount`
- **WHEN** the details panel renders
- **THEN** `onFetchRecipientsCount` has not been called; it is called once the Manage menu is opened (or its trigger hovered or focused), and not a second time for the same item

#### Scenario: Item nobody holds access to does not expose the action

- **GIVEN** an owned catalog item whose `onFetchRecipientsCount` resolves `0`
- **WHEN** the Manage menu is opened
- **THEN** no "Revoke access" entry is rendered

#### Scenario: Known recipient count is shown in the label

- **GIVEN** an owned catalog item whose `onFetchRecipientsCount` resolves `3`
- **WHEN** the Manage menu is opened
- **THEN** the entry's label reads "Revoke access (3)"

#### Scenario: Failed lookup keeps the action reachable

- **GIVEN** an owned catalog item whose `onFetchRecipientsCount` rejects or resolves `undefined`
- **WHEN** the Manage menu is opened
- **THEN** the entry is rendered with the plain "Revoke access" label

#### Scenario: Entry is withheld while the count is in flight

- **GIVEN** an owned catalog item whose `onFetchRecipientsCount` has not settled
- **WHEN** the Manage menu is opened
- **THEN** no "Revoke access" entry is rendered yet

#### Scenario: A revoked item stops offering the action without a reload

- **GIVEN** an owner who has just confirmed "Revoke access (3)" successfully
- **WHEN** the Manage menu is opened again
- **THEN** the count is fetched again, now answers `0`, and no "Revoke access" entry is rendered

### Requirement: `CatalogView` wires revoke to the BFF endpoint

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL implement `onRevokeShare` as `handleRevokeShare`, structurally parallel to the existing `handleUnshare`:

1. Call `revokeSharedAccess(item.id)` from `apps/chat/src/server-api/share.api.ts`.
2. On success, show a success notification (`title` = `CatalogI18nKeys.DetailsRevokeShareSuccessTitle`, `message` = `CatalogI18nKeys.DetailsRevokeShareSuccess` interpolating `{ name: item.name }`).
3. On rejection, resolve the request's `traceId` via `getApiErrorDetails(err)`, show an error notification (`title` = `CatalogI18nKeys.DetailsRevokeShareErrorTitle`, `message` = `CatalogI18nKeys.DetailsRevokeShareError` with `{ name: item.name }`, `requestId` = `traceId`), and re-throw so the panel returns to its details content.

Unlike `handleUnshare`, it SHALL NOT refetch deployments, toolsets, or skills, and SHALL NOT clear `selectedItemId`: revoking does not change what the owner can see, so neither list membership nor the current selection is affected — this holds for `Skill` items exactly as it already does for `Application`/`Toolset` items.

`CatalogView.isRevokeShareVisible` SHALL NOT unconditionally exclude `CatalogEntityType.Skill`. `Header`'s existing built-in `isMyApp === true` gate, combined with the recipient-count lookup, already makes Revoke access ownership-gated for every entity type; `isRevokeShareVisible` is only an additional caller-supplied override and SHALL return `true` for `Skill` so the built-in gate is the sole determinant, matching the current behavior for `Application`/`Toolset`.

`CatalogView` SHALL pass the corresponding `texts` entries through to the catalog, alongside the existing `unshare*` entries, unchanged by this capability.

`CatalogView` SHALL also implement `onFetchRecipientsCount` as `handleFetchRecipientsCount`: call `getShareRecipientsCount(item.id)` and return its `recipientsCount`. A rejection SHALL propagate untouched — the details panel degrades to an uncounted, still-reachable entry, and a failed count is not something to interrupt the user with a notification about. This is unchanged by this capability and already works for any `item.id`, `Skill` included.

#### Scenario: Successful revoke notifies and leaves the catalog untouched

- **WHEN** the user confirms revoking access to an owned toolset
- **THEN** `revokeSharedAccess` is called once with the item id, a success notification is shown, neither deployments nor toolsets are refetched, and `selectedItemId` is unchanged

#### Scenario: Failed revoke surfaces the trace id and re-throws

- **WHEN** `revokeSharedAccess` rejects
- **THEN** an error notification is shown carrying the request's trace id, and the rejection propagates to the details panel

#### Scenario: Owned skill exposes and exercises Revoke access

- **GIVEN** an owned skill catalog item (`isMyApp: true`) with 2 recipients
- **WHEN** the details panel's Manage menu is opened and the user confirms "Revoke access (2)"
- **THEN** `revokeSharedAccess` is called once with the skill's `item.id`, a success notification is shown, and neither `refetchSkills` nor any other list refetch is triggered

### Requirement: i18n keys for the catalog revoke flow

New keys SHALL be added to `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`. The generic action label lives in the shared `ButtonsI18nKeys` namespace so the conversation surface reuses the same key, per `.claude/rules/all-ts.md` §"Avoid duplicate translation values"; the rest are feature-scoped under `catalog.details.revokeShare.*`, matching the existing `catalog.details.unshare.*` nesting. These keys are entity-type-agnostic and already interpolate `{{name}}` from `item.name`, so no skill-specific key is added — a skill's revoke notification reuses every key below unchanged.

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

#### Scenario: Skill revoke notification reuses the same keys with no new key added

- **WHEN** an owner revokes access to a skill named `"docs-helper"`
- **THEN** the success notification renders `catalog.details.revokeShare.success` interpolated as `Shared access to "docs-helper" was revoked.`, using the identical key already used for applications and toolsets

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

`apps/chat-api/src/share/tests/share.service.spec.ts` and `share.controller.spec.ts` SHALL cover: a successful revoke (correct Core body, both caches invalidated, `{ success: true }`); no `getSharedResources` call being made; each mapped status (400→404, 401, 403, 404, 429, 5xx→502, network→503); DTO rejection of a malformed, empty, over-length, traversal-containing, and wrong-resource-type `itemId`; the unauthenticated case; and, newly, a successful revoke for a `skills/{bucket}/{path}` `itemId` alongside a malformed `skills/...` `itemId` rejection.

`libs/catalog/src/components/Details/Header/tests/Header.spec.tsx` and `libs/catalog/src/components/Details/tests/DetailsPanel.spec.tsx` SHALL cover: entry visibility for owned vs shared-with-me vs callback-absent items; clicking opens the confirmation without invoking the callback; confirming calls `onRevokeShare` exactly once with the panel staying open on success; a rejection returns to the details content with the panel still open; and a second rapid confirm click not double-invoking the callback. These cases are entity-type-agnostic and SHALL be exercised with a `Skill` fixture alongside the existing `Application`/`Toolset` fixtures.

`apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` SHALL cover the success path (one API call, success notification, no refetch, selection untouched) and the failure path (error notification with trace id, rejection re-thrown), for a `Skill` item in addition to the existing `Application`/`Toolset` cases, and SHALL cover `isRevokeShareVisible` returning `true` for `Skill`.

Tests SHALL query by role, label, and text — no implementation-specific selectors and no `data-testid`.

#### Scenario: Test suites cover the full success and failure matrix including skills

- **WHEN** the backend, lib, and `CatalogView` suites are run
- **THEN** every scenario listed above passes, including the newly added skill-specific cases
