## Why

Every other DIAL Core resource this app manages (application, toolset, conversation, skill) is identified end-to-end by one full resource path that already embeds its bucket (`applications/{bucket}/{path}`). Prompts are the one exception: the BFF and frontend identify a prompt by a bucket-relative `path`/`id` plus a separate, optional `bucket` (defaulting to the caller's session bucket, overridden with the owner's bucket for a prompt shared with the caller). This was a deliberate choice when the Prompts domain was built (`openspec/changes/archive/2026-07-30-prompts-backend-api/design.md`, Decision 1), matching the legacy chat's convention — but it now means every cross-cutting feature that touches prompts (sharing, publishing, catalog id construction, favourites) needs a prompt-only bridge that no other resource type needs: `ShareResourceKind`/`resourceKind: 'prompt'` on the share DTOs, a required `bucket` field on discard, `toPromptResourceUrl`/`parsePromptResourceUrl` pairs on both sides of the stack, and two explicitly documented gaps — the catalog's "Remove from My List" and "Revoke access" actions are unsupported for prompts today specifically because their `itemId` shape doesn't match the allowlist every other resource type uses (`prompt-catalog-integration` spec, "Unshare"/"Revoke access" bullets).

This change removes the split by giving a prompt the same single full-resource-path identity as every other resource: `prompts/{bucket}/{path}`. It fixes the unshare/revoke gap at its root instead of patching around it, and it lets the sharing layer (create/discard/revoke/recipients) treat `prompts/` exactly like `skills/`, `applications/`, `toolsets/`, and `conversations/` — no per-resource-type special case.

## What Changes

- **BREAKING**: `PromptResponseDto.id` becomes the full DIAL Core resource path `prompts/{bucket}/{path}` instead of a bucket-relative path with a separate `bucket` field. The separate `bucket` field is dropped; the bucket is recovered by parsing `id` where still needed (e.g. permission checks against the caller's own bucket).
- **BREAKING**: Prompt CRUD/query DTOs (`GetPromptQueryDto`, `RequiredPromptPathDto`, the move/update/delete query params, folder DTOs) replace the `path` (+ optional `bucket`) pair with a single full-id parameter, mirroring how `DiscardSharedCatalogItemDto`/`RevokeSharedAccessDto`/etc. already take one `itemId`.
- Organisation (public) prompts keep the `prompts/public/{path}` resource path they already have in DIAL Core — they now simply report it as their `id` instead of splitting it into `id: path, bucket: 'public'`.
- Remove the prompt-only sharing bridge now made unnecessary: `ShareResourceKind` enum, `resourceKind` field on `CreateShareLinkDto`/`DiscardSharedCatalogItemDto`/`RevokeSharedAccessDto`/`GetShareRecipientsDto`, the `bucket` field added to `DiscardSharedCatalogItemDto`, and the `IsCatalogResourcePath` bypass for prompts. `prompts/{bucket}/{path}` is added directly to the shared catalog-resource allowlist, the same way `skills/` was added previously.
- Remove the `toSourceUrl` prompt-bucket-qualification special case in `publish.service.ts` — a prompt's `entityId` is already a full resource path, like a skill's.
- Enable the previously-blocked catalog actions for prompts now that their `id` matches the shape every allowlist expects: "Remove from My List" (unshare) and "Revoke access", following the same pattern already shipped for skills.
- Frontend: catalog id mapping, the prompt editor's route query param, the share popover, and `libs/chat-hooks`' `buildPromptResourceUrl`/`parsePromptResourceUrl` dual-id logic are simplified to always carry/consume one full id — no more bare-path-for-personal vs qualified-path-for-shared split.
- **BREAKING** (data): `user-config.prompts.installed` (prompt favourites) currently stores bare bucket-relative paths; it migrates to storing full resource-path ids, with a `migrateConfig` step normalising previously-stored bare paths for existing users (same mechanism already used for the v1→v4 config migrations).

## Capabilities

### New Capabilities

(none — this change re-shapes existing capabilities' identifier contract, it does not introduce new behavior)

### Modified Capabilities

- `prompts-api`: `PromptResponseDto` and every prompt CRUD/list endpoint's request/response shape changes from `path` + optional `bucket` to a single full-id field.
- `prompts-folders`: folder ids and the move endpoint's owner-bucket parameter fold into the same single-id scheme.
- `prompts-share-api`: sharing a prompt no longer needs a `resourceKind`/bucket-qualification bridge — the client already has the full id.
- `prompt-share-link`: the `ShareResourceKind`/`resourceKind` mechanism this capability introduced is removed; a prompt `itemId` is a full path like any other resource, so `createShareLink` needs no prompt-specific qualification step.
- `prompts-frontend-api`: `prompts.api.ts` wrappers take one `id` instead of `(path, bucket?)` pairs.
- `prompt-editor`: the `?id=` route query param and its owner-bucket parsing collapse to "it's always a full id"; no more distinct personal-vs-shared id shapes.
- `prompt-favorites`: `prompts.installed` stores full ids; a migration step normalises previously-stored bare paths.
- `catalog-unshare`: `prompts/{bucket}/{path}` is accepted by the discard endpoint's allowlist directly (no bridge), and the recipient-side "Remove from My List" action becomes available for prompts.
- `share-revoke-access`: `prompts/{bucket}/{path}` is accepted by the revoke and recipients-count endpoints' allowlist directly (no bridge); the existing "non-revocable resource… names a prompt" rejection scenario is replaced with acceptance, mirroring the skill scenarios already in this spec.
- `catalog-publish-api`: drops the prompt-only bucket-qualification exception in `PublishService`/`toSourceUrl` — a prompt `entityId` is treated exactly like a skill's.
- `prompt-catalog-integration`: the "Unshare (Remove from My List) — unsupported" and "Revoke access — unsupported, and suppressed" bullets flip to supported, matching the skill wiring; the "Share" and "Publish" bullets drop their `resourceKind`/bucket-qualification mentions.
- `chat-hooks-sharing`: `useShareLink`'s `resourceKind` parameter is removed along with `ShareResourceKind`; every resource, prompts included, is identified the same way at this hook's boundary.

## Impact

- Backend: `apps/chat-api/src/prompts/**` (DTOs, controller, all five sub-services, `prompt-mapper.util.ts`), `apps/chat-api/src/share/**` (DTOs, `share.service.ts`, `share.controller.ts`, `catalog-resource-path.validator.ts`), `apps/chat-api/src/publish/publish.service.ts`, `apps/chat-api/src/user-config/**` (favourites migration), plus every corresponding test file under those domains.
- API contract: `libs/chat-api-client/openapi.json` and the generated client (`libs/chat-api-client/src/generated/**`) regenerate with the new prompt DTO shapes; this is a breaking change to the prompt endpoints' request/response contract, shipped in the same release as the frontend changes that consume it (single monorepo, no independent versioning).
- Frontend: `apps/chat/src/server-api/prompts.api.ts`, `apps/chat/src/server-api/share.api.ts`, `apps/chat/src/components/CatalogView/CatalogView.tsx`, `apps/chat/src/pages/PromptEditor/PromptEditor.tsx`, `apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx`, `apps/chat/src/context/FavoriteApplicationsContext.tsx`, `apps/chat/src/components/PromptSelector/usePromptSelectorOverlay.tsx`, `libs/chat-hooks/src/catalog/map-prompt-to-catalog-item.ts`, `libs/chat-hooks/src/prompt/prompt-resource.ts`, `libs/chat-hooks/src/useShareLink/useShareLink.ts`, plus their test files.
- Data migration: existing users' stored `prompts.installed` favourites (bare paths) need normalising to full ids on read, via a `migrateConfig` step, so no favourite silently disappears after deploy.
- Docs: `openspec/specs/{prompts-api,prompts-folders,prompts-share-api,prompt-share-link,prompts-frontend-api,prompt-editor,prompt-favorites,catalog-unshare,share-revoke-access,catalog-publish-api,catalog-prompt-entity-type,chat-hooks-sharing}/spec.md`, `docs/architecture.md` if it summarizes the prompt id shape, and the Postman collection.
