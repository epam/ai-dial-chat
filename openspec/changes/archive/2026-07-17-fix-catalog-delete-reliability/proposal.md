## Why

Deleting an application from the Catalog Details panel (GitHub #7791) is unreliable: the
first delete appears to freeze briefly, subsequent delete attempts silently fail then error
on retry, and the deleted item can still show up after a page refresh. Root cause:
`ApplicationsService.deleteApplication` (`apps/chat-api/src/applications/applications.service.ts`)
only invalidates the `applications:list:${userSub}` cache bucket, but the Catalog's actual
list-read path (`DeploymentsService.listDeployments`, driving `refetchDeployments` in
`apps/chat/src/context/DeploymentsContext.tsx`) is cached under the unrelated
`deployments:list:${userSub}` / `deployments:list:${userSub}:interface:<type>` keys, which are
never cleared. The UI keeps serving the stale (pre-delete) deployments list for up to its 30s
TTL, so the just-deleted item reappears; clicking Delete on it again then hits a real 404 from
DIAL Core, surfacing as an error. Toolset deletion does not have this bug — `ToolsetsService`
already mirrors this exact invalidation pattern against `DeploymentsService` for logins/logouts.

## What Changes

- Fix `ApplicationsService.deleteApplication` to also invalidate the deployments list cache
  (`DeploymentsService.invalidateListCache`) on successful delete, mirroring the existing
  `ToolsetsService.deleteToolset` → `DeploymentsService` invalidation pattern, so the Catalog's
  deployments-backed list no longer serves a stale, already-deleted application.
- Wire `ApplicationsModule` to import `DeploymentsModule` (as `ToolsetsModule` already does) so
  `ApplicationsService` can inject `DeploymentsService`.
- Add a visible loading indicator to the Catalog Details `DeleteButton` while the delete
  request is in flight, so the brief wait before the success/error notification reads as
  "in progress" rather than a UI freeze.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `applications-write-api`: the "Delete application endpoint" requirement is amended so a
  successful delete also invalidates the deployments list cache, not only the applications
  list cache, ensuring the Catalog list is consistent immediately after deletion.

## Impact

- `apps/chat-api/src/applications/applications.service.ts` — `deleteApplication` gains a call
  into `DeploymentsService.invalidateListCache`.
- `apps/chat-api/src/applications/applications.module.ts` — import `DeploymentsModule`.
- `libs/catalog/src/components/Details/Header/DeleteButton/DeleteButton.tsx` — loading
  indicator while `isDeleting`.
- No API contract/DTO shape changes; no OpenAPI regeneration needed (endpoint request/response
  shapes are unchanged, only server-side cache-invalidation side effects).
