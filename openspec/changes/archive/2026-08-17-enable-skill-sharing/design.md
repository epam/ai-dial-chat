## Context

The skill catalog (`skill-catalog-listing`, `skill-catalog-item-mapping`) already computes everything a sharing feature needs per item: `isMy`, `canEdit` (from the DIAL Core `WRITE` permission bit — `apps/chat-api/src/skills/listing/skills-listing.service.ts:172-221`), and `sharedWithMe`, mapped to `CatalogItem.isMyApp` / `isEditable` / `sharedWithMe` in `apps/chat/src/utils/map-skill-to-catalog-item.ts:70-74`. The archived `add-skill-catalog-listing` design note (`openspec/changes/archive/2026-08-13-add-skill-catalog-listing/design.md:93`) explicitly deferred acting on this: *"a `WRITE` permission has nothing to enable yet... carried so a later change can turn actions on without re-plumbing the listing."* This is that later change.

The generic sharing subsystem (`ShareController`/`ShareService` in `apps/chat-api/src/share/`, `SharePopoverContainer`/`useShareLink`/`libs/catalog` Header actions on the frontend) already treats `itemId` as an opaque DIAL Core resource path for every entity type except prompts (which need server-side bucket qualification because a prompt's `CatalogItem.id` is bucket-relative). Skills, like applications/toolsets, already carry a fully-qualified `skills/{ownerBucket}/{skillPath}` URL as `CatalogItem.id` (`map-skill-to-catalog-item.ts:52-59`), so no bucket-qualification logic is needed.

Investigation found the four lifecycle operations already at different stages of skill-readiness on the backend:

| Operation | Endpoint | Backend status today |
|---|---|---|
| Create share link | `POST /api/v1/share` | Works — `CreateShareLinkDto.itemId` has no entity-type allowlist |
| Accept invitation / `sharedWithMe` | `GET /api/v1/share/invitations/:id` | Works — `ShareService.resolveSharedItemSummary` (`share.service.ts:351-357`) already branches on `skills/` and resolves via `SkillsLookupService` |
| Discard / unshare | `POST /api/v1/share/discard` | Works — `DiscardSharedCatalogItemDto`'s allowlist already includes `skills/{bucket}/{path}` plus a guard rejecting `.../files/...` sub-paths |
| Revoke access | `POST /api/v1/share/revoke` | **Blocked** — `RevokeSharedAccessDto`'s allowlist omits `skills` |
| Recipient count | `GET /api/v1/share/recipients` | **Blocked** — `GetShareRecipientsDto`'s allowlist omits `skills` (same regex, same comment referencing the revoke DTO) |

`ShareService`'s `RESOURCE_KIND_BY_PREFIX` (`share.service.ts:49-54`) already maps `'skills/' → 'SKILL'` and is used by both the discard pre-check and by `revokeShared`/`getRecipientsCount` — so once the two DTOs stop rejecting the `itemId` at the validation layer, the service logic underneath needs no change.

On the frontend, every gate lives in `CatalogView.tsx` as three `useCallback` predicates (`isShareVisible`, `isUnshareVisible`, `isRevokeShareVisible`) passed into the generic, entity-agnostic `libs/catalog` Header component. `SharePopoverContainer.EDITABLE_ACCESS_TYPES` (`SharePopoverContainer.tsx:21-25`) already lists `Skill` — it was written ahead of this change, anticipating it.

## Goals / Non-Goals

**Goals:**
- Skill catalog items reach full lifecycle parity with applications/toolsets for: create-share, accept/`sharedWithMe`, revoke, unshare/discard.
- Sharing eligibility (`isShareVisible`) is ownership-based (`item.isMyApp`), never granted merely by `canEdit`/`WRITE`, consistent with every other entity type today.
- Zero new frontend components, zero new generated-client methods, zero new DIAL Core calls — only widen two backend DTO allowlists and flip three frontend predicates plus one refetch branch.
- Recipient-count loading, RTL, mobile, and WCAG 2.1 AAA behavior of the shared `libs/catalog` Header/`SharePopoverContainer` controls are inherited unchanged (they are already correct for every other entity type; skills only need to reach the same code paths).

**Non-Goals:**
- No skill-specific sharing UI, REST client, or bucket-resolution logic in `libs/catalog` or `apps/chat/src/server-api` (§ Decision 1).
- No new `OverlayFeature.SkillsSharing`-style flag — reuse the existing `OverlayFeature.Skills` gate per the product requirement (§ Decision 2). If a future requirement needs to decouple "skills exist" from "skills are shareable," that flag can be introduced then without touching this change's wiring.
- No change to how `canEdit`/`isEditable` is computed or to the Edit action's visibility rule — it is already permission-based and already correct (§ Decision 3).
- No change to `SkillsLookupService`'s unused `_callerBucket` parameter or to `AcceptInvitationResponseDto.sharedSkill`'s shape — out of scope; noted as a pre-existing rough edge, not something this change needs to fix.
- No use of the DIAL Core `SHARE` permission bit — see Decision 4.

## Decisions

### Decision 1 — Reuse the generic catalog sharing flow (rejects a skill-specific flow)

**Chosen:** Flip the three `CatalogView.tsx` predicates and the two backend DTO regexes; add zero new components.

**Alternative rejected — Skill-specific sharing flow:** A parallel `SkillSharePopover`/skill-specific REST wrapper was considered and rejected outright. Nothing about a skill's resource shape differs from an application's or toolset's for sharing purposes — both are whole-resource DIAL Core paths of the form `{prefix}/{bucket}/{path}` requiring no client-side bucket qualification (unlike prompts). `SharePopoverContainer` and `useShareLink` are already fully generic over `CatalogItem`; adding skill-specific code here would violate the library-isolation and DRY posture the rest of the sharing subsystem follows, and there is no product requirement (whole-resource-only discard is already enforced server-side by `NOT_A_SKILL_FILE_PATTERN`) that a generic flow cannot satisfy.

**Alternative rejected — Enable only create-share, leave revoke/discard unsupported:** Rejected because the actual remaining backend gap (two one-line regex changes) is smaller than the effort of documenting and shipping a deliberately partial feature, and a partial feature would produce a confusing UX: an owner could create a share link but never see who holds it or take it back, and a recipient could accept a share but never remove it from their list (discard already works server-side, so *only* revoke/recipient-count would need this workaround — inconsistent and strictly worse than fixing the two DTOs).

### Decision 2 — Gate behind `OverlayFeature.Skills` only, not a new sharing-specific flag

Applications and Toolsets each have an additional `...Sharing` flag (`OverlayFeature.ApplicationsSharing`, `OverlayFeature.ToolsetsSharing`) layered on top of their base "entity exists" flag, letting sharing roll out independently of catalog visibility. The product requirement for this change is explicit: keep skill sharing behind the *existing* Skills feature gate. This is a deliberate deviation from the Applications/Toolsets precedent, not an oversight — Skills is a newer, still-narrower-rollout surface where decoupling "catalog visible" from "sharing enabled" is not (yet) a requirement. `isShareVisible`'s Skill branch checks `item.isMyApp` directly with no additional flag read, matching the Prompt branch's shape rather than the Toolset/Application branches'.

### Decision 3 — Share is ownership-gated; Edit stays permission-gated, orthogonal to Share

The product requirement is explicit that a skill shared to the current user with `WRITE` must not become re-shareable merely from holding that permission. This is not a new rule to invent — it is the rule every other entity type already follows: `libs/catalog`'s built-in `shouldShowShare = item.isMyApp === true` (`ShareButton.tsx:59`) already gates on ownership, and `CatalogView.isShareVisible`'s Prompt branch already checks `item.isMyApp`, not `isEditable`/`canEdit`. The Skill branch is written the same way. Separately, `isEditable` (`map-skill-to-catalog-item.ts:74`, `!isPublic && (skill.canEdit ?? isPersonal)`) already exists and is already read wherever the catalog decides whether to show the skill editor for a given item — that code path is untouched by this change. The outcome: a skill shared to you with `WRITE` shows Edit but not Share; a skill you own always shows both (subject to the Skills feature gate); a skill shared to you `READ`-only or a Public skill shows neither.

### Decision 4 — Do not act on the DIAL Core `SHARE` permission bit

DIAL Core's permission model includes `READ`/`WRITE`/`SHARE`, but nothing in the codebase reads `SHARE` today for any entity type — sharing eligibility is ownership-only everywhere, and Decision 3 keeps skills consistent with that. Introducing `SHARE`-bit-based re-sharing for skills alone, ahead of every other entity type adopting it, would create an inconsistent product surface and is out of scope; noted as a possible future cross-cutting change, not part of this one.

### Decision 5 — Widen the two backend DTO regexes in place rather than extracting a shared allowlist constant

`RevokeSharedAccessDto` and `GetShareRecipientsDto` each define their own `CATALOG_RESOURCE_PATH_PATTERN` (byte-identical to each other, and now also to `DiscardSharedCatalogItemDto`'s once `skills` is added to all three). Extracting a single shared constant was considered; rejected for this change because it would touch a third file with no behavior change and expand the diff without reducing risk — the three DTOs already tolerate this duplication today (`share-recipients.dto.ts`'s comment even points at the revoke DTO by name as its reference), and a future refactor can consolidate them independent of this feature. Each regex changes from `/^(?:applications|toolsets|conversations)\/.../ ` to `/^(?:applications|toolsets|conversations|skills)\/.../ `, copying the exact pattern already proven in `discard-shared-catalog-item.dto.ts`. Unlike discard, revoke and recipient-count act on a whole *owned* resource by construction (an owner revoking/counting recipients for their own skill) — DIAL Core's `getSharedResources`/`revokeSharedResources` calls are keyed by the resource URL as a unit, so no `NOT_A_SKILL_FILE_PATTERN`-style file-path guard is needed on these two DTOs; a malformed or file-level `itemId` on either endpoint would fail ownership resolution at DIAL Core and surface as 403/404, which is an acceptable and already-specified error path (`share-revoke-access` spec's existing 400→404 mapping).

## Risks / Trade-offs

- **[Risk] Regex widening on `RevokeSharedAccessDto`/`GetShareRecipientsDto` is a shared, hand-authored validator, not a generated-client change** → not user-visible as a breaking contract change (widens acceptance, never narrows), but must ship with `npm run openapi`/`npm run openapi:check` and a client rebuild in the same slice so the generated Swagger description strings and `chat-api-client` docs stay truthful; covered in tasks.
- **[Risk] `handleUnshare`'s new `Skill` branch calls `refetchSkills()` from `useSkills()`, a context hook not previously called from `CatalogView` in this handler** → confirm `useSkills()` is already available in `CatalogView`'s render scope (it must be, since `skills`/`sharedSkills`/`publicSkills` are already spread into `catalogItems` from the same context) and that `refetchSkills` failure is handled with the same "success already happened, don't downgrade to an error" pattern used for the existing `refetchToolsets`/`refetchDeployments` branches.
- **[Risk] Flipping `isShareVisible`/`isUnshareVisible`/`isRevokeShareVisible` for `Skill` is a single boolean per predicate — easy to under-test** → the delta specs require explicit scenarios per ownership/permission combination (owned, writable-shared, read-only-shared, public) so a regression (e.g. accidentally gating Share on `isEditable` instead of `isMyApp`) fails a test rather than shipping.
- **[Risk] Stale Swagger doc strings in `share.controller.ts` already under-describe skills for discard today** → low severity (docs-only), but left uncorrected would compound with the new revoke/recipients wording; fixed in the same change since it touches the same file region.
- **[Trade-off] Not extracting a shared allowlist constant (Decision 5)** → accepted duplication across three DTO files in exchange for a smaller, lower-risk diff; revisit only if a fourth resource type needs the same allowlist.

## Migration Plan

- Purely additive on the backend (widens two validation regexes) and a UI-gating change on the frontend (flips predicates already wired to existing, unmodified components) — no data migration, no schema change, no new persisted state.
- Deploy order within the change is not load-bearing for correctness (the frontend predicates and backend DTOs are independent axes — a deploy with only the backend DTO fix live is a no-op for users since the UI still hides the actions; a deploy with only the frontend fix live would 400 on revoke/recipients until the backend catches up), but the tasks sequence backend-first to avoid ever shipping a frontend affordance that 400s.
- **Rollback:** revert the DTO regex widening and the `CatalogView.tsx` predicate changes independently and in either order — neither has a forward-only side effect (no cache schema, no persisted flag, no irreversible DIAL Core state introduced by this change itself).

## Open Questions

None outstanding — the product requirements resolved every material decision (ownership-vs-permission gating, feature-flag reuse, Edit/Share independence) during investigation; see Decisions 2-4.
