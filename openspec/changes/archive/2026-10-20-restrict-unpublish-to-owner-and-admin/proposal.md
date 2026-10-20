## Why

Any signed-in user can submit an unpublish request for any published catalog entity (issue [#9180](https://github.com/epam/ai-dial-chat/issues/9180)). Approval is admin-only in the Admin Panel, so nothing is actually removed without review, but request creation is open to users with no relation to the deployment: it spams the admin queue, invites accidental or malicious requests, and contradicts the ownership model that publish itself follows.

Two places make it open today:

- **UI gate.** `isUnpublishVisible` in `apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts:119` allows `isAdmin || hasPublishWriteAccess(folder)`, and `hasPublishWriteAccess` (`libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts:223`) is `true` for every folder without the restricted segment — i.e. for practically every public copy.
- **Backend.** `catalog-unpublish-api` explicitly says the service "SHALL NOT attempt a local ownership or write-access check" and leaves it to DIAL Core; `PublishService.unpublish` (`apps/chat-api/src/publish/publish.service.ts:297`) forwards every request. Core accepts a `DELETE` publication into the admin queue without checking that the caller published the copy.

## What Changes

- **Backend authorization (new).** `POST /api/v1/catalog/{entityType}/{entityId}/unpublish` rejects a caller who is neither an administrator nor the copy's publisher with `403 ForbiddenException` **before** any `createPublication` call.
  - *Administrator* = the same rule `GET /api/v1/auth/me` already reports as `isAdmin` (provider `adminRoles` matched against the session's roles claim). The private `computeIsAdmin` in `apps/chat-api/src/auth/auth.controller.ts:633` is extracted into a reusable provider so both use one rule.
  - *Publisher (owner)* = the entity lives in the caller's own bucket, **or** the caller's own publications (`publications/{bucket}/`) contain a live `APPROVED` `ADD` whose resource `targetUrl` is this public copy (not cancelled by a later approved `DELETE`). `displayAuthor` is free text and is never used for ownership.
- **Backend access lookup (new endpoint).** `GET /api/v1/catalog/{entityType}/{entityId}/unpublish-access` → `{ "canUnpublish": boolean }` (`operationId: getCatalogUnpublishAccess`), computed by the same check, cached 60 s per caller and entity. The UI uses it so the menu reflects what the backend will accept.
- **UI gate (changed).** For a non-admin, the public copy's details panel offers `Unpublish` only when `getCatalogUnpublishAccess` returns `canUnpublish: true`. Admins keep seeing it for every public copy without the lookup. `hasPublishWriteAccess` no longer participates in the Unpublish decision. No change to `libs/catalog`: the decision still reaches it through the existing `getPublishHistory` / `isUnpublishVisible` callbacks.
- **Unchanged.** Approval stays admin-only in the Admin Panel; the DELETE request body, response DTO, error mapping for Core failures, cache invalidation, confirmation sub-view and notifications are untouched. Conversation unpublish is already owner-scoped (session bucket only) and is out of scope.

**BREAKING (behavioral):** non-owner, non-admin callers of the unpublish endpoint now get 403 where they previously got 200 and a pending request. No request/response shape changes.

### Decisions on the issue's open questions

| Question | Decision (recorded assumption) |
|---|---|
| Is the admin role supported on the chat side? | Yes — `isAdmin` already exists (`ADMIN_ROLE_NAMES` / provider `adminRoles`). Admins see and may request Unpublish for any public copy. |
| How is ownership determined? | The **publisher**: whoever's bucket holds the live `ADD` publication that created the copy. Team/on-behalf ownership is not modelled — DIAL Core has no group owner for a publication. |
| Ownership change / owner removed with pending requests? | Out of scope. `chat-api` stores no ownership; pending requests stay in Core's queue for the admin to decide. |
| Can the owner cancel a pending request? | Out of scope; follow-up if wanted. |

### Non-goals

- Changing the admin approval flow or the Admin Panel.
- Group/team ownership, ownership transfer.
- Cancelling pending unpublish requests.
- Conversation unpublish (`conversation-unpublish-api`), already restricted to the caller's own bucket.

### Alternatives considered

1. **UI-only fix** (hide the action for non-owners) — rejected: the issue requires backend enforcement; a direct API call would still succeed.
2. **Ownership flag on every deployment in the list DTO** — rejected: proving publisher ownership needs one `getPublication` per approved publication in the caller's bucket; doing that for the whole catalog list is too costly. A lazy per-item lookup matches the existing lazy history lookup.
3. **Widen `isUnpublishVisible` to async in `libs/catalog`** — rejected: a public lib API change for something the existing async `getPublishHistory` channel already carries.
4. **Use `displayAuthor` / `author` name match** — rejected: `displayAuthor` is user-editable free text (see `catalog-publish-api`), not an identity.

Chosen: backend check + small read endpoint, with the app adapter feeding the result into the existing lib callbacks.

### Acceptance criteria

- An owner sees `Unpublish` on the public copy they published and can submit the request (200).
- A non-owner, non-admin does not see `Unpublish` on someone else's public copy.
- A direct `POST …/unpublish` by a non-owner, non-admin returns 403 and no Core `createPublication` call is made.
- An admin sees `Unpublish` on any public copy and the request is accepted; covered by backend and hook tests.
- Admin Panel approval is unaffected (no change to the DELETE publication shape).
- The same rule applies to every publishable entity type (application, model, toolset, prompt, skill).

### Rollback

Revert the change: the guard and the new endpoint are additive in `apps/chat-api/src/publish/`; the frontend falls back to the previous gate. Regenerate the OpenAPI client after revert.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `catalog-unpublish-api`: authorization changes from "session only, no local ownership check" to "administrator or publisher, enforced before Core is called"; adds the `unpublish-access` read endpoint.
- `catalog-unpublish-flow`: the app's `isUnpublishVisible` / public-copy history wiring is gated by admin status or the access lookup instead of folder write access.
- `catalog-publish-flow`: `getPublishHistory` for a public copy synthesises its single entry only when the caller may unpublish it (admin, or `canUnpublish: true`), and resolves `[]` otherwise.

## Impact

- **Backend** (`apps/chat-api`): `auth/` (extract admin-role check into an exported provider; `AuthController.getCurrentUser` uses it), `publish/publish.service.ts`, `publish/publish.controller.ts`, `publish/publication.util.ts` (copy-ownership helper), `publish/publish.module.ts`, new `publish/dto/unpublish-access.dto.ts`, co-located specs.
- **OpenAPI / client**: new operation `getCatalogUnpublishAccess`; new 403 response documented on `unpublishCatalogEntity`. Regenerate `libs/chat-api-client` via `npm run openapi`.
- **Frontend** (`apps/chat`): `hooks/useCatalogPublishing/useCatalogPublishing.ts` and its spec, `server-api/publish.api.ts`; `libs/chat-hooks/src/catalog/create-publish-api.ts` gains the thin wrapper (allowed by the `chat-hooks` generated-client exception — no client construction). `libs/catalog` unchanged.
- **i18n**: no new strings. A rejected request reuses `usePublishErrorNotification`'s existing 403 copy.
- **Docs**: `libs/chat-hooks/README.md` if `createPublishApiClient`'s documented surface lists operations; `docs/architecture.md` unchanged (no new domain/controller base path).
- **Performance**: one extra lazy request per public-copy details open for non-admins, cached 60 s server-side; one `getPublications` + N `getPublication` reads per uncached unpublish request (same cost profile as publish history today).
