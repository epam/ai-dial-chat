## 1. Backend: prompt identity shape (`prompts-api`, `prompts-folders`)

- [x] 1.1 In `apps/chat-api/src/prompts/utils/prompt-mapper.util.ts`, add/adjust the assemble/parse helpers so `mapPromptToResponse` emits a full `id: prompts/{bucket}/{path}` and no separate `bucket` field; add a parse helper that splits a full prompt id into `(bucket, subPath)` for the sub-services that still need them separately.
- [x] 1.2 Update `apps/chat-api/src/prompts/dto/prompt-response.dto.ts` to drop the `bucket` field and document `id` as the full resource path.
- [x] 1.3 Replace `path`/`bucket` with a single `id` field in `apps/chat-api/src/prompts/dto/get-prompt-query.dto.ts` (validated by a new domain-owned `PROMPT_ID_PATTERN`, not the share domain's allowlist — `RequiredPromptPathDto` is left as bucket-relative `path` since folder/public endpoints that reuse it have no bucket-qualification concept).
- [x] 1.4 Update `apps/chat-api/src/prompts/prompt.controller.ts` handlers for get/update/delete to accept the new `id` query param and pass the parsed `(bucket, subPath)` to `prompt.service.ts`.
- [x] 1.5 Update `apps/chat-api/src/prompts/prompt.service.ts` and `apps/chat-api/src/prompts/personal/prompts-personal.service.ts` to build responses with the full `id`; keep internal `(bucket, path)` signatures for `resource/prompts-resource.service.ts`.
- [x] 1.6 Update `apps/chat-api/src/prompts/public/prompts-public.service.ts` so organisation prompt responses carry `id: prompts/public/{path}`.
- [x] 1.7 Update `apps/chat-api/src/prompts/dto/prompt-list-response.dto.ts` / `PublicPromptListResponseDto` Swagger examples to the new `id` shape. (No literal id/bucket examples existed in these two files — they only reference `PromptResponseDto`/`PromptFolderResponseDto` — so no edit was needed.)
- [x] 1.8 Replace the `path`/optional-`bucket` pair with a single `id` param on the move endpoint (`apps/chat-api/src/prompts/dto/move-prompt.dto.ts` query handling in `prompt.controller.ts`, `apps/chat-api/src/prompts/folder/prompts-folder.service.ts`'s `movePrompt`).
- [x] 1.9 Update every test under `apps/chat-api/src/prompts/**/tests/*.spec.ts` for the new `id` shape (get/update/delete/move/list/public).

## 2. Backend: remove the prompt-only sharing bridge (`prompts-share-api`, `prompt-share-link`, `catalog-unshare`, `share-revoke-access`)

- [x] 2.1 Delete `ShareResourceKind` and the `resourceKind` field from `apps/chat-api/src/share/dto/create-share-link.dto.ts`, `discard-shared-catalog-item.dto.ts`, `revoke-shared-access.dto.ts`, `share-recipients.dto.ts`; delete `DiscardSharedCatalogItemDto.bucket`.
- [x] 2.2 Update `apps/chat-api/src/share/dto/catalog-resource-path.validator.ts` (`IsCatalogResourcePath`) to add `prompts` to its allowlisted prefixes unconditionally and remove the `resourceKind === Prompt` bypass branch.
- [x] 2.3 Update `apps/chat-api/src/share/share.service.ts`: remove `resolveResourceUrl`'s prompt-qualification branch (`createShareLink`, `discardShared`, `revokeShared`, `getRecipientsCount` all take a full `itemId` with no bucket param); confirm `RESOURCE_KIND_BY_PREFIX`'s `['prompts/', 'PROMPT']` entry is still correct.
- [x] 2.4 Update `apps/chat-api/src/share/share.controller.ts` to stop forwarding `resourceKind`/`bucket` to the service methods touched in 2.3.
- [x] 2.5 Update every test under `apps/chat-api/src/share/tests/*.spec.ts` (DTO specs, `share.service.spec.ts`, `share.controller.spec.ts`) to drop `resourceKind`/`bucket` arguments and assert full `prompts/{bucket}/{path}` itemIds are accepted end-to-end for create/discard/revoke/recipients.

## 3. Backend: publish domain (`catalog-publish-api`)

- [x] 3.1 In `apps/chat-api/src/publish/publish.service.ts`, remove `toSourceUrl`'s prompt bucket-qualification branch so a prompt `entityId` is used unmodified, like a skill's.
- [x] 3.2 Update `apps/chat-api/src/publish/tests/*.spec.ts` prompt scenarios to pass a full `entityId` and assert no qualification occurs.

## 4. Backend: favourites migration (`prompt-favorites`)

- [x] 4.1 Bump `CURRENT_CONFIG_VERSION` to `6` (not `5` — an unrelated prior change already claimed v5 for skill favourites; see `git blame`) in `apps/chat-api/src/user-config/**` and add a migration step that qualifies a bare-path `prompts.installed` entry to `prompts/{userBucket}/{entry}`, leaving an already-qualified (`prompts/`-prefixed) entry untouched.
- [x] 4.2 Update `apps/chat-api/src/user-config/dto/update-installed-prompt.dto.ts` to validate `id` against the prompt domain's full-id `PROMPT_ID_PATTERN` (task 1.x) instead of the module's bucket-relative `PROMPT_PATH_PATTERN`.
- [x] 4.3 Update `apps/chat-api/src/user-config/**/tests/*.spec.ts` for the version bump, the migration step, and the new `id` validation.

## 5. OpenAPI regeneration

- [x] 5.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and the generated client from the updated Swagger decorators.
- [x] 5.2 Run `npm run openapi:check` and confirm no drift.
- [x] 5.3 Skim the regenerated `libs/chat-api-client/src/generated/**` prompt models/APIs to confirm `PromptResponseDto` has one `id` field (no `bucket`) and `getPrompt`/`updatePrompt`/`deletePrompt`/`movePrompt` each take a single `id` (no `bucket`); do not hand-edit generated files.

## 6. Frontend: server-api wrappers and hooks (`prompts-frontend-api`, `chat-hooks-sharing`)

- [x] 6.1 Update `apps/chat/src/server-api/prompts.api.ts`: `getPrompt`, `updatePrompt`, `deletePrompt`, `movePrompt` each take a single `id` and no `bucket` argument.
- [x] 6.2 Update `apps/chat/src/server-api/share.api.ts` (and any generated-client call sites) to stop sending `resourceKind`/`bucket` for share create/discard/revoke/recipients. (Already clean — this file never carried `resourceKind`/`bucket`.)
- [x] 6.3 Remove the `resourceKind` parameter from `libs/chat-hooks/src/useShareLink/useShareLink.ts` and its `getShareLink` counterpart; update its tests.
- [x] 6.4 Delete `buildPromptResourceUrl` from `libs/chat-hooks/src/prompt/prompt-resource.ts` once no caller needs it. (`parsePromptResourceUrl` turned out to still be needed — see 7.4's note — and `PromptSource` still lives there too, so the file itself stays.)
- [x] 6.5 Simplify `libs/chat-hooks/src/catalog/map-prompt-to-catalog-item.ts` to always use `prompt.id` unconditionally (drop the shared-prompt qualification branch); update `libs/chat-hooks/src/catalog/tests/map-prompt-to-catalog-item.spec.ts`.
- [x] 6.6 Update `apps/chat/src/server-api/tests/prompts.api.spec.ts` for the new single-`id` wrapper signatures.

## 7. Frontend: catalog, editor, and sharing UI (`prompt-editor`, `prompt-catalog-integration`, `catalog-unshare`, `share-revoke-access`)

- [x] 7.1 Update `apps/chat/src/pages/PromptEditor/PromptEditor.tsx` to treat `?id=` as always-full-path; remove owner-bucket parsing/branching in load and save calls; update `PromptEditor.spec.tsx`.
- [x] 7.2 Update `apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx` to call `useShareLink` with `item.id` for every entity type, dropping the `CreateShareLinkDtoResourceKindEnum.Prompt` branch; update its tests.
- [x] 7.3 Update `apps/chat/src/components/CatalogView/CatalogView.tsx`: simplify `handleFetchDetails`'s prompt branch to call `getPrompt(item.id)` unconditionally (drop `parsePromptResourceUrl`); flip `isUnshareVisible` and `isRevokeShareVisible` to no longer force `false` for `CatalogEntityType.Prompt`; wire `onUnshare`'s prompt branch to `refetchPrompts()`.
- [x] 7.4 Update `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` for the simplified prompt id handling and the newly-enabled unshare/revoke scenarios. (Also had to keep a narrowed `parsePromptResourceUrl` in `prompt-resource.ts`, contrary to task 6.4's initial guess: the organisation prompt read still resolves through `getPublicPrompt`, which kept its bucket-relative `path` argument, so the full `prompts/public/{path}` id has to be parsed back down to that sub-path first.)
- [x] 7.5 Update `apps/chat/src/components/PromptSelector/usePromptSelectorOverlay.tsx` and its tests if they assumed a bare-path `prompt.id` for favourites/selection. (The hook already used `prompt.id` opaquely with no bare-path assumption and has no dedicated test file; updated the one incidental `pendingPrompt.id` fixture in `ConversationRoute.spec.tsx` to a full id for consistency.)

## 8. Frontend: favourites (`prompt-favorites`)

- [x] 8.1 Confirm `apps/chat/src/context/FavoriteApplicationsContext.tsx` reads/writes `prompts.installed` using the full `CatalogItem.id` with no transformation; update `FavoriteApplicationsContext.spec.tsx`. (The context already passed ids through untransformed; updated its bare-path prompt fixtures to full ids.)
- [x] 8.2 Update `apps/chat/src/utils/tests/favorites.spec.ts` (or equivalent) if any fixture assumed bare-path prompt ids. (No prompt-id fixtures there — it only checks the `CatalogEntityType` → `FavoriteEntityType` mapping — so no change needed.)

## 9. Docs

- [x] 9.1 Archive-review the delta specs under `openspec/changes/unify-prompt-resource-id/specs/**` against the final implementation (adjust wording only if implementation deviates from an assumption in an Open Question). (Reviewed all six spec deltas — `prompts-api`, `prompts-folders`, `catalog-unshare`, `prompt-share-link`, `prompts-share-api`, `share-revoke-access` — against the shipped code; every requirement and scenario matches the implementation as written, no wording adjustments needed.)
- [x] 9.2 Update `docs/architecture.md` if it names the old prompt `path`+`bucket` shape. (It never described that shape at the level of detail this change touches — no edit needed.)
- [x] 9.3 Update `postman/chat-api.postman_collection.json` prompt requests to the new `id` query param shape. (Updated update/delete/get/move prompt requests from `path`/`bucket` query params to a single `id`; renamed "Delete a personal prompt" to "Delete a personal or writable shared prompt"; updated the favorites PATCH example id to a full resource path; removed the stale `resourceKind: "prompt"` example from "Create a share link" and added "a prompt" to the discard/revoke/recipients descriptions to match the controller's Swagger text.)

## 10. Verification

- [x] 10.1 `npm exec nx test chat-api` — all backend prompts/share/publish/user-config tests pass. (167 test files, 2800 tests, all passing.)
- [x] 10.2 `npm exec nx test chat` — all frontend prompts/catalog/share/favourites tests pass. (`nx test chat` itself is blocked by a pre-existing, unrelated `@epam/ai-dial-catalog:typecheck` failure — those files are unmodified by this change and already committed on the branch — so ran `vitest run` directly in `apps/chat` and `libs/chat-hooks`: 143 chat test files/2022 tests and 96 chat-hooks test files/1169 tests, all passing.)
- [x] 10.3 `npm exec nx lint chat-api` and `npm exec nx lint chat` — no new lint errors. (`lint chat-api` ran clean after `eslint . --fix` cleared prettier-only formatting in files this change touched. `lint chat` is blocked by the same pre-existing `@epam/ai-dial-catalog:typecheck` failure as 10.2, so ran `eslint .` directly in `apps/chat`: fixed the prettier issue in `SharePopoverContainer.tsx` and a missing `refetchPrompts` dep in `CatalogView.tsx`'s `handleUnshare` `useCallback`; the two remaining errors, in `SkillEditor.tsx`/`ScheduledTaskDetailPage.spec.tsx`, are pre-existing and untouched by this change.)
- [x] 10.4 `npm exec nx build chat-api` and `npm exec nx build chat` — both build clean. (`build chat-api` succeeds. `build chat` — and a direct `vite build` bypassing the Nx dependency graph — both fail with the same pre-existing, unrelated break: `libs/catalog/src/components/ListView/ListView.tsx` imports a `Grid` component that commit `694b2df4f` ("chore(catalog): use 2.0 Grid in ListView", already on this branch before this change started) added but which `@epam/ai-dial-ui-kit` does not export. `libs/catalog` has no uncommitted changes from this session, so this is a pre-existing build break on the branch, not something this change introduced or can fix within its scope.)
- [x] 10.5 `npm run validate:docs` — passes after the README/spec/architecture updates. (Passed: 40 markdown files, no issues.)
- [x] 10.6 Manual smoke check: share, discard, revoke, and recipients-count for a personal prompt end-to-end against a local DIAL Core, confirming the previously-blocked "Remove from My List" and "Revoke access" catalog actions now work for a prompt. (Confirmed by manual testing against a local DIAL Core; the space-in-name percent-encoding regression found during this check was fixed in `share.service.ts`'s `toShareResourceUrl`.)
