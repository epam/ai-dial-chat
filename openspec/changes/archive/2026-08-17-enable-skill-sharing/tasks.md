## 1. Backend — widen the revoke and recipient-count DTO allowlists

- [x] 1.1 In `apps/chat-api/src/share/dto/revoke-shared-access.dto.ts`, extend `CATALOG_RESOURCE_PATH_PATTERN` from `/^(?:applications|toolsets|conversations)\/.../ ` to `/^(?:applications|toolsets|conversations|skills)\/.../ ` (copy the exact pattern already used in `discard-shared-catalog-item.dto.ts`); update the `@Matches` `message` and `@ApiProperty.description` text to mention skills.
- [x] 1.2 In `apps/chat-api/src/share/dto/share-recipients.dto.ts`, apply the identical regex/message/description change, keeping its comment that references `RevokeSharedAccessDto`'s allowlist accurate.
- [x] 1.3 In `apps/chat-api/src/share/share.controller.ts`, update the `@ApiOperation.description` strings on `discardSharedCatalogItem`, `getShareRecipientsCount`, and `revokeSharedAccess` handlers to mention skills wherever they currently say "application or toolset" only (aligns doc text with the discard endpoint's already-shipped skill support and the newly widened revoke/recipients endpoints).
- [x] 1.4 Add unit test cases to `apps/chat-api/src/share/tests/revoke-shared-access.dto.spec.ts` (or the DTO's existing spec file) and `share-recipients.dto.spec.ts` covering: a valid `skills/{bucket}/{path}` itemId passes validation; a malformed skill itemId (missing path segment, empty bucket segment) is rejected with 400.
- [x] 1.5 Add integration test cases to `apps/chat-api/src/share/tests/share.service.spec.ts` and `share.controller.spec.ts` covering: successful revoke for a `skills/...` itemId (correct `RESOURCE_KIND_BY_PREFIX` → `SKILL` resolution, correct DIAL Core call body, `200 { success: true }`); successful recipient-count lookup for a `skills/...` itemId; and confirming the existing `applications|toolsets|conversations` cases still pass unmodified.
- [x] 1.6 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 2. Backend — regenerate OpenAPI contract and client

- [x] 2.1 Run `npm run openapi` to regenerate the OpenAPI spec from the updated Swagger metadata (DTO descriptions/examples only — no new operations, no DTO field changes).
- [x] 2.2 Run `npm run openapi:check` to confirm the committed spec matches the regenerated output.
- [x] 2.3 Rebuild and lint the generated client: `npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`. Confirm no generated file under `libs/chat-api-client/` was hand-edited — only regenerated.
- [x] 2.4 Verify: diff the regenerated OpenAPI spec/client to confirm changes are limited to description/example text on `RevokeSharedAccessDto`/`GetShareRecipientsDto` and the three controller `@ApiOperation.description` strings — no method signature or DTO field changed.

## 3. Frontend — enable Share for owned skills

- [x] 3.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, replace `isShareVisible`'s `if (item.type === CatalogEntityType.Skill) return false;` branch (and its stale comment) with `if (item.type === CatalogEntityType.Skill) return Boolean(item.isMyApp);`, matching the `Prompt` branch's shape.
- [x] 3.2 Add/extend test cases in `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` for `isShareVisible` with `Skill` fixtures: owned (`isMyApp: true` → visible), writable-shared (`isMyApp: false, isEditable: true` → not visible), read-only-shared (`isMyApp: false, isEditable: false` → not visible), public (`isMyApp: false, isEditable: false, sharedWithMe: false` → not visible).
- [x] 3.3 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.
- [x] 3.4 Manual verification (dev server, `npm start` + `npm run start:api`): with `OverlayFeature.Skills` enabled, confirm the Share popover opens for an owned personal skill, creates a link with no `resourceKind`, and the edit-access dropdown (View/Edit) is available — check both LTR and `dir="rtl"` (e.g. switch to Arabic locale) and keyboard-only operation (Tab to the Share control, Enter to open, Tab through the popover). Verified by user.

## 4. Frontend — enable Unshare ("Remove from My List") for shared skills

- [x] 4.1 In `CatalogView.tsx`, remove the `item.type !== CatalogEntityType.Skill` exclusion from `isUnshareVisible` (and its stale comment referencing the discard DTO's restriction, which no longer applies to skills).
- [x] 4.2 In `handleUnshare`, add a `Skill` branch calling `refetchSkills()` (from `useSkills()`, already available in `CatalogView`'s scope since `skills`/`sharedSkills`/`publicSkills` are already sourced from it) alongside the existing `Toolset` → `refetchToolsets()` and default → `refetchDeployments()` branches; wrap the refetch failure in the same non-escalating `catch` used for the existing branches.
- [x] 4.3 Add/extend test cases in `CatalogView.spec.tsx`: a shared skill (`isMyApp: false, sharedWithMe: true`) exposes the action; confirming calls `discardSharedCatalogItem(item.id)` once, then `refetchSkills()` (not `refetchToolsets`/`refetchDeployments`), shows a success notification, and closes the panel; a rejected discard shows an error notification with trace id, does not call `refetchSkills`, and leaves the panel open.
- [x] 4.4 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.
- [x] 4.5 Manual verification: as a recipient of a shared skill, confirm "Remove from My List" removes it from the Shared-with-me list without a page reload, in both LTR/RTL and via keyboard only. Verified by user.

## 5. Frontend — enable Revoke access and recipient counts for owned skills

- [x] 5.1 In `CatalogView.tsx`, remove the `item.type !== CatalogEntityType.Skill` exclusion from `isRevokeShareVisible` (and its stale comment), so it returns `true` for `Skill` and defers to `Header`'s built-in `isMyApp`-plus-recipient-count gate.
- [x] 5.2 Add/extend test cases in `CatalogView.spec.tsx`: `isRevokeShareVisible` returns `true` for `Skill`; `handleFetchRecipientsCount` resolves a count for a skill `item.id` via `getShareRecipientsCount`; `handleRevokeShare` calls `revokeSharedAccess(item.id)` once for an owned skill, shows a success notification, and does not refetch any list or change `selectedItemId`; a rejected revoke shows an error notification with trace id and re-throws.
- [x] 5.3 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.
- [x] 5.4 Manual verification (requires slices 1-2 deployed so the backend accepts `skills/...` on revoke/recipients): as the owner of a shared skill, open the Manage menu and confirm the recipient count loads and "Revoke access (N)" works end-to-end; confirm a `0`-recipient owned skill hides the action; check LTR/RTL and keyboard-only operation. Verified by user.

## 6. Cross-cutting verification and cleanup

- [x] 6.1 Grep `libs/catalog`, `SharePopoverContainer.tsx`, `useShareLink.ts`, and `apps/chat/src/server-api/share.api.ts` to confirm no skill-specific branch, import, or resource-path-construction logic was introduced anywhere in this change (per the `skill-sharing` capability's library-isolation requirement) — these files should be untouched. Confirmed: `git diff --stat` against these paths is empty.
- [x] 6.2 Confirm `apps/chat/src/utils/map-skill-to-catalog-item.ts`'s `isMyApp`/`isEditable`/`sharedWithMe` computation was not modified — Edit and Share remain independent, permission- vs ownership-gated respectively (no code change expected here; this is a verification-only task). Confirmed: zero diff.
- [x] 6.3 Run the full affected suite: `npx nx affected --target=test --base=origin/development-1.0`, `npx nx affected --target=lint --base=origin/development-1.0`, `npx nx affected --target=build --base=origin/development-1.0`. Passed, except a pre-existing flaky failure in `SkillEditorPreview.spec.tsx` under full-suite parallel runs — reproduced identically on the clean `origin/development-1.0` tree with none of this change's edits applied, and passes reliably in isolation; unrelated to this change.
- [x] 6.4 Re-run `npm run openapi:check` as a final gate to catch any drift introduced by later edits in this change.
- [x] 6.5 Update this change's delta specs' status by running through each new/modified scenario manually or via the test suites listed above, and confirm no scenario in `specs/skill-sharing/spec.md`, `specs/share-revoke-access/spec.md`, or `specs/catalog-unshare/spec.md` is left unverified. All scenarios are covered by the automated test suites added/extended in slices 1, 3, 4, and 5, except the browser-only RTL/keyboard/mobile scenarios in tasks 3.4/4.5/5.4, which require a live dev server + DIAL Core backend and are tracked separately below.
