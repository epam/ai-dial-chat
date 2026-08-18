## Why

Deleting a skill from Catalog → Skills fails with HTTP 404. `CatalogView.tsx`'s
`handleDelete` has no branch for `CatalogEntityType.Skill`, so skill items fall
through to the generic `else` branch and call `deleteApplication(item.id)` —
routing the request through chat-api's `DELETE /api/v1/applications/:id`,
which calls DIAL Core's custom-application delete endpoint. A skill isn't
stored as a custom application, so DIAL Core rejects it with 404. This blocks
all skill deletion in the Catalog.

A correct, already-implemented path exists and is unused here: chat-api's
dedicated skills module (`DELETE /api/v1/skills`) and the frontend's
`deleteSkill(bucket, path)` wrapper in `apps/chat/src/server-api/skills.api.ts`
proxy DIAL Core's `/v2/skills/{bucket}/{path}` correctly, and are already used
by the Skill Editor's own delete flow.

## What Changes

- Add a `CatalogEntityType.Skill` branch to `CatalogView.tsx`'s `handleDelete`
  that parses `item.id` (the `skills/{bucket}/{path}` resource URL) with the
  existing `parseSkillResourceUrl` util and calls `deleteSkill(bucket, path)`
  instead of `deleteApplication(item.id)`.
- After a successful skill delete, refresh the Skills list via the existing
  `refetchSkills()` (already used by this component's discard/unshare flow)
  instead of `refetchDeployments()`.
- No backend, `chat-api-client`, or DIAL Core changes are needed — the
  `/v2/skills/{bucket}/{path}` proxy path already exists and is exercised
  elsewhere in the app.

## Capabilities

### New Capabilities

- `catalog-delete-routing`: how `CatalogView`'s owner-side Delete action
  (`onDelete`) dispatches to the correct backend delete call per catalog
  item type — Prompt, Toolset, Skill, or generic application/deployment —
  and which refetch runs afterward. No such spec exists today (the sibling
  `catalog-unshare` capability documents this routing for the "Remove from
  My List" action, but the owner-side Delete routing was never specified,
  which is how the missing Skill branch went unnoticed).

### Modified Capabilities

(none)

## Impact

- Affected code: `apps/chat/src/components/CatalogView/CatalogView.tsx`
  (`handleDelete`) only.
- No API contract changes — the fix uses server-api/backend surface that
  already exists (`apps/chat/src/server-api/skills.api.ts:deleteSkill`,
  `apps/chat-api/src/skills/skills.controller.ts` `DELETE /api/v1/skills`).
- No new dependencies, no DB/schema/config changes.
- Risk is low and localized to one delete branch in one component; existing
  skill delete flow from the Skill Editor is unaffected (it already uses the
  correct endpoint).
