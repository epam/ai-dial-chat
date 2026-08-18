## Why

Sharing was deliberately deferred when the skill catalog listing shipped: `SkillMetadataItemDto.permissions`/`canEdit`/`isMy`/`sharedWithMe` were already computed from DIAL Core (`apps/chat-api/src/skills/listing/skills-listing.service.ts:172-221`), but every mutating catalog action was left hidden, with the archived design note stating plainly that "a `WRITE` permission has nothing to enable yet" (`openspec/changes/archive/2026-08-13-add-skill-catalog-listing/design.md:93`). Backend and DIAL Core support for treating skills as a shareable `SKILL` resource type has since been built out piecemeal for the other lifecycle endpoints (create-share has no allowlist at all; discard already accepts `skills/{bucket}/{path}`; the accept-invitation summary already resolves a `sharedSkill`), but the two remaining endpoints (revoke, recipient count) and every frontend `CatalogView` gate still hard-exclude `CatalogEntityType.Skill`. Users can create and organize Skills but cannot share them with teammates, and a handful of small, precisely located gaps are the only thing standing between the current state and full parity with applications/toolsets/prompts.

## What Changes

- Enable the existing Share action (`SharePopoverContainer`, `useShareLink`) for an owned personal Skill in the catalog details panel, gated by the existing `OverlayFeature.Skills` flag only (no new sharing-specific feature flag, unlike Applications/Toolsets).
- Fix `CatalogView.isShareVisible` (`apps/chat/src/components/CatalogView/CatalogView.tsx:876`) to allow Skill through when `item.isMyApp` is true, mirroring the prompt rule — sharing eligibility is ownership-based (`isMyApp`), never granted merely by holding `WRITE`/`canEdit` on a shared item.
- Fix `CatalogView.isUnshareVisible` and `isRevokeShareVisible` (lines 838-855) to stop unconditionally excluding Skill; add a `refetchSkills()` branch to `handleUnshare` (lines 1068-1114) so a discarded skill disappears from `sharedWithMe` without a full reload.
- **BREAKING** (backend contract widening, not a removal): extend `RevokeSharedAccessDto` and `GetShareRecipientsDto`'s `itemId` allowlist regex (`apps/chat-api/src/share/dto/revoke-shared-access.dto.ts`, `share-recipients.dto.ts`) to accept `skills/{bucket}/{path}`, matching the pattern `DiscardSharedCatalogItemDto` already uses. This is additive (widens what is accepted) and carries no migration for existing callers.
- Update the stale `@ApiOperation` Swagger descriptions on `discardSharedCatalogItem`/`getShareRecipientsCount`/`revokeSharedAccess` in `apps/chat-api/src/share/share.controller.ts` to mention skills where they currently say "application or toolset" only, and regenerate the OpenAPI spec/client.
- Preserve the existing, already-correct permission-based Edit behavior for writable shared skills (`isEditable` in `apps/chat/src/utils/map-skill-to-catalog-item.ts:74`) — Edit and Share stay on independent axes (`canEdit` vs `isMyApp`); no code change needed there, only spec documentation making the distinction explicit.
- No changes to `libs/catalog`: `SharePopoverContainer.EDITABLE_ACCESS_TYPES` already includes `Skill`, and the library's built-in `isMyApp`/`sharedWithMe` gating for Share/Unshare/Revoke already applies uniformly to every `CatalogEntityType` including Skill.

## Capabilities

### New Capabilities

- `skill-sharing`: Frontend `CatalogView` wiring that exposes Share (owner-only), Unshare/"Remove from My List" (recipient-only), and Revoke access (owner-only) for Skill catalog items, reusing the generic `SharePopoverContainer`/`useShareLink`/`libs/catalog` Header controls with no skill-specific UI code; documents that sharing eligibility is ownership-based (`isMyApp`) and independent of the permission-based Edit action (`isEditable`/`canEdit`).

### Modified Capabilities

- `share-revoke-access`: `RevokeSharedAccessDto` and the recipient-count lookup's `GetShareRecipientsDto` extend their `itemId` allowlist to accept `skills/{bucket}/{path}`, so an owner can revoke access to and see recipient counts for a shared skill; `CatalogView.isRevokeShareVisible` no longer excludes Skill.
- `catalog-unshare`: `CatalogView.isUnshareVisible` no longer excludes Skill, and `handleUnshare`'s post-discard refetch adds a `Skill` branch calling `refetchSkills()` (from `useSkills()`) alongside the existing `Toolset`/deployments branches.

## Impact

- **Frontend**: `apps/chat/src/components/CatalogView/CatalogView.tsx` (three visibility predicates + `handleUnshare`'s refetch branch); no changes to `libs/catalog`, `SharePopoverContainer.tsx`, `useShareLink.ts`, or `server-api/share.api.ts` — all already entity-agnostic and skill-ready.
- **Backend**: `apps/chat-api/src/share/dto/revoke-shared-access.dto.ts`, `apps/chat-api/src/share/dto/share-recipients.dto.ts` (regex widening only); `apps/chat-api/src/share/share.controller.ts` (Swagger description text only — no behavior change, `ShareService`/`RESOURCE_KIND_BY_PREFIX` already skill-aware).
- **Generated API contract**: no new endpoints or DTO shape changes, only a validation-pattern widening on two existing request DTOs — `npm run openapi` / `npm run openapi:check` and a `chat-api-client` rebuild are required to keep the generated client's Swagger-derived docs in sync, but no generated method signatures change.
- **OpenSpec docs**: new `specs/skill-sharing/spec.md`; delta specs for `share-revoke-access` and `catalog-unshare`.
- **No DIAL Core changes**: the SDK's `ResourceType` union already includes `SKILL` for every share operation (`getSharedResources`, `discardSharedResources`, `revokeSharedResources`, `shareResource`).
