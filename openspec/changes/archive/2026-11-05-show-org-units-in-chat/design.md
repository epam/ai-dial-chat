## Context

DIAL Core exposes org units under `/v1/org-units/{path}` (preview API). `GET /v1/org-units/public?recursive=true` (SDK `getOrgUnit`) works for any user. Core filters the tree by visibility (`OrgUnitService.read`: an admin sees everything, everyone else only visible units) and answers 404 while org units are off. Each unit's `folder` is a url-encoded `public/...` path with a trailing slash.

Nothing in the chat reads org units yet. The admin panel's pattern is an `OrgUnitsContext` with a load-once `ensureUnits()` and helpers that compare normalised folders (`toUnitMap`, `isUnitFolder`). We mirror it. No screen consumes the answer in this change; the permission and publishing work reads it later.

## Goals / Non-Goals

**Goals:**
- One BFF read of the caller-visible units, cached per user.
- One lazily-started frontend load, shared by every consumer.
- A pure, tested answer to "is this public-bucket folder an org unit".

**Non-Goals:**
- A distinct unit icon in the file manager or the publish trees (decided against).
- Permissions (`/v1/user/role-assignments`) and action gating.
- Finding the unit that owns a nested folder.
- Showing `displayName` as the row name.
- Managing units.

## Decisions

1. **Source: `getOrgUnit('public', recursive)`, not `getUserRoleAssignments`.** We only need the list for now, and the SDK installed (`0.2.0-dev.23`) has `getOrgUnit` but not `getUserRoleAssignments`. The response DTO keeps `id` / `folder`, so roles can be joined later without changing the contract.
2. **Core 404 becomes `200 { enabled: false }`.** "Off" is a normal deployment state. Turning it into an error would make every consumer special-case a status code. The BFF answers 200 so the generated client's normal method resolves. Other errors keep `mapDialHttpStatus` (see `apps/chat-api/AGENTS.md`, error handling).
3. **Server cache: `org-units:list:<sub>`, 60 s,** following `application-schemas`. The list is user-specific (visibility), so the key includes `sub`. TTL-only invalidation is enough because the chat never mutates units.
4. **Flatten in the BFF.** Core returns `items` already ordered parents-first. The frontend needs membership checks, not hierarchy, so a flat `units[]` keeps the DTO simple.
5. **Keep `folder` raw and normalise in `chat-shared`.** One pure `normalizeOrgUnitFolder` does decode → strip `public/` → trailing slash. The admin panel's matching bug class (`Risk/` vs `Risk2/`, encoded spaces) is then covered by unit tests in one place, and any host gets the same rule.
6. **Shared state in an app context with lazy load.** `useOrgUnits` (chat-hooks) owns load-once and status. `OrgUnitsProvider` (`apps/chat/src/context/OrgUnitsContext.tsx`, ThemeContext pattern: `useMemo` value, throwing guard hook) makes it one load for every consumer. Consumers call `ensureUnits()` in an effect. The alternative was each consumer calling the hook on its own, which means duplicate requests and state. Rejected.
7. **Library isolation.** None of the libs imports the generated client or knows `/api/v1/org-units`. The app adapter is `apps/chat/src/server-api/org-units.api.ts` (`listOrgUnits` → `orgUnitsApi.listOrgUnits()`), passed into `useOrgUnits({ listOrgUnits })` in the same way `usePublishFolders({ listPublicFiles })` gets its function.
8. **Feature flag.** `features.orgUnitsEnabled` (env `ORG_UNITS_ENABLED`, default off) is wired like `usageLimitsControl`. While it is off, the controller answers 403 without calling Core and the provider's `ensureUnits()` does nothing.
9. **`isOrgUnitFolder` matches a unit's own folder only.** A folder inside a unit is not a unit. The owner of a nested folder (the longest `folder` prefix) is a separate lookup that the permission work adds.

**Authorization:** `GET /api/v1/org-units` is behind the global session guard (any authenticated user) and the feature flag. Core does the per-unit visibility filtering. The BFF adds no role check.

**States:**
- Loading: `isOrgUnitFolder` returns `false` until `Ready`.
- Empty or disabled: no unit is reported.
- Error: no unit is reported and the BFF logs a `warn`. No toast, because the user has nothing to act on.

## Risks / Trade-offs

- **[Risk] Core changes the preview API (`x-preview`).** → Mitigation: one service maps Core to our DTO, and malformed items are dropped and logged rather than failing the list.
- **[Trade-off] Up to 60 s staleness after an admin creates or deletes a unit.** This is acceptable while nothing grants access from this list.
- **[Trade-off] A large org (hundreds of units) means one larger response.** That is still a single cached read, and the membership check is a `Set` lookup.

## Migration Plan

The change is additive, with no data migration. The flag is off by default, so deploy order doesn't matter: an old frontend ignores the endpoint, and a new frontend against a Core without org units gets `enabled: false`. To roll back, leave the flag off or revert the provider mount.

## Open Questions

- Should a later change show `displayName` as the row label, which needs rename/search handling? That is not needed for #9757.
- Should a later change move to `GET /v1/user/role-assignments` once the SDK exposes it, so that permissions and the list come from one read?
