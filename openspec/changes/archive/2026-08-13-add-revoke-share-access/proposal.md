## Why

A user can hand out access to a catalog entity or conversation with a share link (`POST /api/v1/share`), and a recipient can drop their own access again ("Remove from My List", `POST /api/v1/share/discard`), but the **owner has no way to take access back**. Today the only way to cut off people who already accepted a link is to delete the resource outright, which also destroys it for the owner. `ShareService.discardShared` names the gap explicitly — "removing access for everyone else is the separate, out-of-scope `revokeSharedResources` operation" (`apps/chat-api/src/share/share.service.ts:407`).

## What Changes

- **New BFF endpoint** `POST /api/v1/share/revoke` on the existing `ShareController` (`apps/chat-api/src/share/share.controller.ts:117` is the closest model — the discard handler), proxying DIAL Core `revokeSharedResources`. It accepts the same three allowlisted `itemId` prefixes as discard (`applications/`, `toolsets/`, `conversations/`) and revokes access for **every** recipient of that resource at once.
- **Catalog details panel**: the "Manage" dropdown (`libs/catalog/src/components/Details/Header/Header.tsx:155`) gains a **"Revoke access"** entry for items the caller owns (`isMyApp === true`), sitting alongside the owner-side Delete entry. It only *requests* the action; `DetailsPanel` owns the confirmation.
- **New confirmation kind** `DetailsConfirmationKind.RevokeAccess` in the existing in-panel confirmation sub-view (`libs/catalog/src/types/details-confirmation.ts`), rendered with the `Danger` variant since other people irreversibly lose access. Unlike Delete and Unshare, a successful revoke leaves the item in the owner's catalog, so the panel returns to its details content instead of closing — the same post-success behaviour `Logout` already has.
- **Conversation panel**: the row action menu (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:338`) gains a **"Revoke access"** action for owned conversations, guarded by a `ConfirmationPopup` structurally parallel to the existing unshare popup in that file.
- **New i18n keys** for the action label, confirmation copy, consequence bullets, and success/error notifications.
- Not a breaking change: purely additive endpoint, menu entry, and enum member. No existing behaviour, DTO, or route changes.

### Alternatives considered

| Option | Verdict |
|---|---|
| **Revoke-all through DIAL Core `revokeSharedResources`** (chosen) | Matches exactly what Core can do, reuses the discard endpoint's shape, error mapping, and cache-invalidation pattern. |
| Per-recipient revoke ("remove Alice's access") | **Not implementable.** Core's `RevokeResourcesRequest` carries only `{ resources: [{ url }] }` — there is no user/subject field, so the platform cannot target a single recipient. |
| Show the recipient list before revoking, via `getSharedResources({ with: 'others', includeUserInfo: true })` | Rejected for this change: adds a second endpoint plus loading/empty/error states to the sub-view for information that does not change the available action (still all-or-nothing). Recorded as a follow-up. |
| Extend `POST /api/v1/share/discard` with a `mode: 'discard' \| 'revoke'` flag | Rejected: different authorization semantics (recipient vs owner) and a different upstream Core operation. A distinct `operationId` keeps the generated client's method names honest and lets each endpoint carry its own Swagger error table. |
| Gate the menu entry on a new `sharedByMe` flag so it only appears when someone actually has access | Rejected: deriving it needs an extra `getSharedResources({ with: 'others' })` Core call per resource type on **every** catalog/conversation list request — a hot path. Revoking a resource nobody holds is a harmless upstream no-op, so the entry is gated on ownership alone. Revisit if Core ever returns share counts in the list payloads. |

### Rollback / backward compatibility

Fully additive and independently revertible: dropping the commit removes one endpoint, one enum member, two menu entries, and the new i18n keys, with nothing left behind (no migration, no persisted state, no changed contract). The endpoint is not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, matching the existing share and discard endpoints — `apps/chat-api` reads no feature-flag env vars today. Regenerating `libs/chat-api-client` after a revert removes the generated `revokeSharedAccess` method.

### Scope notes

- Touches one hand-authored lib, `libs/catalog`. The lib stays host-agnostic: it gains an `onRevokeShare?: (item: CatalogItem) => void | Promise<void>` request callback, `texts.*` strings with English defaults, and one enum member. The endpoint path, the generated client call, notifications, and refetching all stay in `apps/chat/src/components/CatalogView/CatalogView.tsx` and `apps/chat/src/server-api/share.api.ts`.
- `libs/conversation-panel` needs **no** change — `getActions` is already a host-supplied callback, exactly as recorded in the `conversation-unshare-flow` spec.
- i18n impact: yes, new user-visible strings (see the Capabilities specs for the key table). The generic "Revoke access" label goes in the shared `ButtonsI18nKeys` namespace so both surfaces reuse one key, per `.claude/rules/all-ts.md` §"Avoid duplicate translation values".

## Capabilities

### New Capabilities

- `share-revoke-access`: owner-side revocation of all shared access to a resource — the `POST /api/v1/share/revoke` BFF endpoint, its DTOs and generated-client surface, and the "Revoke access" entry plus confirmation wiring in the catalog details panel (`libs/catalog` + `CatalogView`).
- `conversation-revoke-share-flow`: the "Revoke access" row action, confirmation popup, and success/failure handling for owned conversations in `ConversationPanelView`.

### Modified Capabilities

- `catalog-details-confirmation-subview`: `DetailsConfirmationKind` currently SHALL enumerate "exactly `Delete`, `Logout`, and `Unshare`" and the confirm-success rule currently splits kinds into "closes the panel" (Delete, Unshare) vs "keeps it open" (Logout). Both requirements change: a fourth kind `RevokeAccess` is added, with `Danger` variant, its own copy/consequence defaults, and panel-stays-open-on-success behaviour.

## Impact

**Backend** (`apps/chat-api/src/share/`)
- `share.controller.ts` — new `revokeSharedAccess` handler (`POST /api/v1/share/revoke`, `@Throttle` 10/60s, full Swagger error table).
- `share.service.ts` — new `revokeShared()` method calling `dialClient.client.revokeSharedResources`, reusing `handleDialFetchError`/`mapDialHttpStatus` and the existing post-mutation `invalidateListCache` pair.
- `dto/revoke-shared-access.dto.ts` — request + response DTOs, reusing the discard DTO's `IsValidFilePath` + `@Matches` allowlist.
- `tests/share.controller.spec.ts`, `tests/share.service.spec.ts` — extended.

**Generated client** (`libs/chat-api-client/`)
- `openapi.json` + `src/generated/**` regenerated via `npm run openapi`; adds `revokeSharedAccess` to `ShareApi`.

**Frontend** (`apps/chat/src/`)
- `server-api/share.api.ts` — thin `revokeSharedAccess(itemId)` wrapper over the generated method.
- `components/CatalogView/CatalogView.tsx` — `onRevokeShare` handler: call, refetch toolsets/deployments, success and error notifications, re-throw on failure.
- `components/ConversationPanel/ConversationPanelView.tsx` — row action, `pendingRevokeId`/`isRevoking`/`revokeError` state, confirmation popup.
- `constants/translation-keys.ts` + `i18n/locales/en.json` — new keys.

**Library** (`libs/catalog/src/`)
- `types/details-confirmation.ts` — `RevokeAccess` enum member.
- `models/item-details-props.ts`, `models/catalog-props.ts` — `onRevokeShare` callback and `texts.*` entries.
- `components/Details/Header/Header.tsx`, `components/Details/DetailsPanel.tsx`, `components/Catalog/Catalog.tsx` — menu entry, confirmation content, prop threading.
- `README.md` — updated for the new public props.

**Docs** — no `docs/` page describes share revocation today; none require updating. The `catalog-details-confirmation-subview` spec does (delta above).

**Not affected** — `libs/conversation-panel`, auth, publish, file-manager sharing (`apps/chat-api/src/files/` has its own separate discard-shared endpoint and is out of scope).
