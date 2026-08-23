## Context

`CatalogView.tsx`'s `handleDelete` (the implementation behind the details
panel's `onDelete` callback, see `catalog-details-confirmation-subview`)
branches on `item.type`:

```ts
if (item.type === CatalogEntityType.Prompt) { ... }
else if (item.type === CatalogEntityType.Toolset) { ... }
else { await deleteApplication(item.id); await refetchDeployments(); }
```

There is no `CatalogEntityType.Skill` branch, so skill items fall into the
`else` and call `deleteApplication(item.id)` — chat-api's
`DELETE /api/v1/applications/:id`, which proxies DIAL Core's custom-
application delete. DIAL Core 404s because a skill is not a custom
application.

A correct path already exists end-to-end and is exercised elsewhere (the
Skill Editor's own delete action):
- `apps/chat/src/server-api/skills.api.ts:deleteSkill(bucket, path, ifMatch?)`
  → `skillsApi.deleteSkill` (generated client)
  → chat-api `DELETE /api/v1/skills` (`apps/chat-api/src/skills/skills.controller.ts`)
  → `SkillsMutationService.deleteSkill` → DIAL SDK
    `dialClient.client.deleteSkillFolder(bucket, encodeDialResourcePath(path))`
  → DIAL Core `/v2/skills/{bucket}/{path}`.

`CatalogItem.id` for a skill is the full `skills/{bucket}/{path}` resource
URL (set in `map-skill-to-catalog-item.ts`), and `CatalogView.tsx` already
has a util for turning that back into `{ bucket, path }` —
`parseSkillResourceUrl` (`apps/chat/src/types/skill.ts`) — used at
`CatalogView.tsx:454` for the item-details fetch and imported again at
`CatalogView.tsx:90`. The sibling `catalog-unshare` capability's `onUnshare`
implementation already refetches skills via the existing `refetchSkills()`
from `useSkills()` for a `Skill` item, mirroring the pattern this fix needs
for `onDelete`.

## Goals / Non-Goals

**Goals:**
- Route `handleDelete` for `item.type === CatalogEntityType.Skill` to
  `deleteSkill(bucket, path)` instead of `deleteApplication(item.id)`.
- Refresh the right list after a successful skill delete (`refetchSkills()`,
  not `refetchDeployments()`), matching the existing `onUnshare` pattern.
- Keep existing behavior for Prompt, Toolset, and all non-Skill/Toolset/Prompt
  types (applications/deployments) unchanged.

**Non-Goals:**
- No changes to chat-api, `libs/chat-api-client`, or DIAL Core — the skills
  delete endpoint already exists, is tested, and is documented in Swagger.
- No changes to the confirmation UI, `DetailsPanel`, or `Header` — this is
  purely what `onDelete` does once confirmed.
- No change to `If-Match`/etag handling — Catalog delete (unlike the Skill
  Editor's update flow) does not currently pass an `ifMatch`, and this change
  does not introduce one; `deleteSkill`'s `ifMatch` parameter stays optional
  and unset here, matching how `deleteApplication` is called today (no
  precondition check).

## Decisions

- **Reuse `parseSkillResourceUrl` rather than introduce new parsing logic.**
  It's already imported into this file and used for the identical
  `item.id` → `{ bucket, path }` conversion at the item-details fetch site.
  Alternative considered: adding a bucket/path pair directly onto
  `CatalogItem` at mapping time — rejected because `CatalogItem` is a shared
  `libs/catalog` (via `@epam/ai-dial-catalog`) type used across entity types,
  and bucket/path splitting is Skill-specific parsing that belongs at the
  app edge, not in the shared item shape.
- **Mirror the `onUnshare` branch structure exactly** (`if
  (item.type === CatalogEntityType.Skill) { ...; await refetchSkills(); }`)
  rather than restructuring the whole `handleDelete` if/else chain. Keeps the
  diff minimal and consistent with the already-reviewed unshare pattern in
  the same file.
- **No `ifMatch` on this delete call.** The existing generic
  `deleteApplication(item.id)` call has no precondition/concurrency check
  today, so parity is maintained; adding one would be a behavior change
  outside this bug fix's scope.

## Risks / Trade-offs

- [Risk] `parseSkillResourceUrl` returns `null` for a malformed `item.id` (as
  the item-details fetch site already accounts for) → Mitigation: guard the
  same way the existing usage does — treat a `null` parse as the delete
  failing, going through the existing `catch` block's error notification
  path (this is already how `deleteApplication` failures surface).
- [Risk] Regressing the Prompt/Toolset/application delete branches while
  editing this function → Mitigation: the change is additive (one new
  `else if` branch inserted before the final `else`), and existing Vitest
  coverage for `CatalogView`'s delete flow (if present) plus manual
  verification of Prompt/Toolset/application delete in the running app
  during the slice.

## Migration Plan

Single frontend-only commit; no data migration, no backend deploy
coordination, no feature flag. Rollback is a plain revert.
