## Context

The Catalog Details panel lets an owner delete their own application or toolset
(`libs/catalog/src/components/Details/Header/DeleteButton/DeleteButton.tsx`). The frontend
click handler (`apps/chat/src/components/CatalogView/CatalogView.tsx` `handleDelete`) calls
the backend delete endpoint and then re-fetches the owning list so the Catalog grid drops the
deleted item:

- Toolset: `deleteToolset(item.id)` → `refetchToolsets()`
- Application: `deleteApplication(item.id)` → `refetchDeployments()`

`refetchDeployments` reads through `DeploymentsService.listDeployments`
(`apps/chat-api/src/deployments/deployments.service.ts`), cached under
`deployments:list:${userSub}` and `deployments:list:${userSub}:interface:<type>` (30s TTL).

`ApplicationsService.deleteApplication` (`apps/chat-api/src/applications/applications.service.ts:214`)
only invalidates `applications:list:${userSub}` — a cache bucket nothing in the Catalog delete
path reads. `DeploymentsService`'s cache is left untouched, so `refetchDeployments` replays the
stale, pre-delete list back into the UI. This matches all three reported symptoms:

1. **"UI freezes"**: the delete button disables and waits through two sequential awaited calls
   (`deleteApplication` + `refetchDeployments`) with no visible progress indicator, then
   resolves to a list that still contains the just-deleted item — reading as a stall followed
   by nothing happening.
2. **"Subsequent deletions silently fail... then error"**: the still-listed item is clicked
   again; the backend now correctly 404s against DIAL Core because it was already deleted, so
   the *second* click is the one that surfaces an error, even though the *first* delete
   actually succeeded.
3. **"Item persists after refresh"**: a hard refresh re-runs the same cached `listDeployments`
   read within the 30s TTL window, so the deleted item can still appear.

Toolsets do not have this bug: `ToolsetsService.deleteToolset` already calls a private
`invalidateCaches` helper that clears `toolsets:list:${userSub}` **and** delegates to
`DeploymentsService.invalidateDetailsCache` for the per-item details cache. `ToolsetsModule`
imports `DeploymentsModule` to get constructor access to `DeploymentsService`;
`ApplicationsModule` currently does not.

## Goals / Non-Goals

**Goals:**
- After a successful application delete, the Catalog's deployments-backed list cache is
  invalidated in the same request, so a subsequent list read (refetch or page reload) never
  returns the deleted item.
- Match the existing, already-correct toolset delete pattern rather than invent a new one.
- Give the Delete button a visible in-progress affordance so a slow-but-successful delete does
  not read as a freeze.

**Non-Goals:**
- Fixing `ApplicationsService.createApplication`'s cache invalidation (it has the same
  `applications:list` vs `deployments:list` asymmetry, but no symptom for create was reported
  in #7791; tracked separately if it becomes a real issue).
- Changing the DELETE endpoint's request/response contract, DTOs, or OpenAPI schema — this is
  a server-side cache-invalidation fix only, no generated-client regeneration needed.
- Adding a delete confirmation dialog — out of scope for this reliability fix.

## Decisions

**Reuse `DeploymentsService.invalidateListCache`, not a bespoke cache-key deletion in
`ApplicationsService`.** `ApplicationsService` could instead directly
`cacheManager.del('deployments:list:...')`, but that duplicates knowledge of
`DeploymentsService`'s private cache-key shape (base key + one key per
`DeploymentInterfaceType`) into a foreign module. `DeploymentsService` already exposes
`invalidateListCache(userSub)` for exactly this purpose (used internally and by
`ToolsetsService`). Injecting `DeploymentsService` into `ApplicationsService` — mirroring
`ToolsetsService`'s existing constructor injection — keeps cache-key ownership inside
`DeploymentsService` and keeps the two services' delete flows visibly symmetric.

**Wire the module dependency the same way `ToolsetsModule` does.** Add `DeploymentsModule` to
`ApplicationsModule`'s `imports`; `DeploymentsModule` already exports `DeploymentsService` as a
plain injectable (no `@Inject` token), so no further DI plumbing is required.

**Do not call `invalidateDetailsCache` from `deleteApplication`.** That method targets the
per-item deployment *details* cache keyed by deployment id, used for the details panel's own
re-fetch. Since the application is being deleted (not modified), there's no future details read
to keep fresh, and toolsets only call it in the login/logout paths where the entity still
exists post-action. Only `invalidateListCache` is warranted here.

**Frontend loading affordance is additive, not a fix for the actual bug.** The root cause is
entirely server-side cache invalidation; the frontend delete flow (`handleDelete`,
`DeleteButton`'s `isDeleting` state) already awaits correctly and surfaces success/error
notifications. Adding a spinner to `DeleteButton` while `isDeleting` is true only addresses the
perceived "freeze" during the (now correctly bounded) network round trip, per
`.claude/rules/a11y.md`'s guidance that in-progress states need visible, not just disabled,
feedback.

## Risks / Trade-offs

- **[Risk] Other Catalog-adjacent read paths cache application data under yet another key we
  haven't found** → Mitigation: grep for `applications:` and `deployments:list` cache-key
  literals across `apps/chat-api/src` as part of implementation to confirm
  `invalidateListCache` is the only remaining stale-read path; add a regression test that
  asserts `deployments:list:${userSub}` is cleared after `deleteApplication`.
- **[Risk] Circular module dependency between `ApplicationsModule` and `DeploymentsModule`** →
  Mitigation: `DeploymentsModule` only imports `UserConfigModule` (per research), so importing
  it from `ApplicationsModule` cannot form a cycle; `nx build chat-api` will fail fast if this
  assumption is wrong.
- **[Trade-off] This still leaves a (non-reported) asymmetry in `createApplication`'s cache
  invalidation** → Accepted as a non-goal; flagged in the proposal's Impact/Non-Goals so it
  isn't silently forgotten.

## Migration Plan

No data migration. Deploy as a normal backend + frontend change:
1. Land `ApplicationsModule` → `DeploymentsModule` wiring and the `invalidateListCache` call in
   `deleteApplication`.
2. Land the `DeleteButton` loading-indicator UI change.
3. No feature flag needed — this is a pure bug fix with no behavior change on any other path.
Rollback is a plain revert; no persisted state changes shape.

## Open Questions

- None — the fix mirrors an existing, already-shipped pattern (`ToolsetsService` ↔
  `DeploymentsService`), so no new architectural decisions are required.
