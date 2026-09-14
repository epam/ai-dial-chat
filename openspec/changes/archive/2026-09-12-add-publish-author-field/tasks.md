## 1. Backend — catalog publish endpoint

- [x] 1.1 Add optional `author?: string` to `apps/chat-api/src/publish/dto/publish-catalog-entity.dto.ts` with `@ApiPropertyOptional`, `@IsOptional()`, `@IsString()`, `@MaxLength(200)`, and `@Matches(/^[^\p{Cc}]*$/u)` rejecting control characters
- [x] 1.2 Destructure `author` in `PublishController.publish` and pass `author?.trim() || getUserDisplayName(claims)` to `PublishService.publish`, leaving the service signature and its `displayAuthor: author` line untouched
- [x] 1.3 Update the `@ApiOperation` description and `PublishCatalogEntityDto` JSDoc to state that `author` sets the publication's display author and falls back to the session-derived name
- [x] 1.4 Extend `apps/chat-api/src/publish/tests/publish.service.spec.ts` (or a controller spec) to cover: custom author reaches Core as `displayAuthor`, whitespace-padded author is trimmed, omitted and blank author fall back to `getUserDisplayName`, over-long author is rejected with 400, control-character author is rejected with 400
- [x] 1.5 Verify with `npm run test:file -- apps/chat-api/src/publish/tests/publish.service.spec.ts` and `npm exec nx lint chat-api`

## 2. Backend — conversation publish endpoint

- [x] 2.1 Add the same optional, identically validated `author?: string` to `apps/chat-api/src/conversations/dto/publish-conversation.dto.ts`
- [x] 2.2 Destructure `author` in `ConversationPublishController.publish` and pass `author?.trim() || getUserDisplayName(claims)` to `ConversationPublishService.publish`
- [x] 2.3 Update the `@ApiOperation` description and DTO JSDoc to match task 1.3
- [x] 2.4 Extend the conversation publish controller/service spec with the custom-author, trimmed-author, omitted-author fallback, and invalid-author rejection cases
- [x] 2.5 Verify with `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-publish.service.spec.ts` and `npm exec nx lint chat-api`

## 3. Contract regeneration

- [x] 3.1 Run `npm run openapi` and confirm `PublishCatalogEntityDto.author` and `PublishConversationDto.author` appear as optional strings in the generated spec
- [x] 3.2 Run `npm run openapi:check` and rebuild `libs/chat-api-client` (`npm exec nx build chat-api-client`), confirming existing request literals without `author` still type-check

## 4. `libs/publish-panel` — hook state

- [x] 4.1 Add `defaultAuthor?: string` (default `''`) to `UsePublishFlowOptions` and `author: string` / `setAuthor: (author: string) => void` to `UsePublishFlowResult` in `libs/publish-panel/src/utils/use-publish-flow.ts`, with JSDoc explaining why the host supplies the prefill
- [x] 4.2 Implement the author state: seed from `defaultAuthor`, track an internal "edited" flag, re-sync from `defaultAuthor` only while untouched, and clear the flag in `reset()` while restoring the current `defaultAuthor`
- [x] 4.3 Widen `onPublish` to `(item, folderPath, rules, author) => Promise<void>` and have `handleSubmit` pass the trimmed `author` as its fourth argument
- [x] 4.4 Extend `libs/publish-panel/src/utils/use-publish-flow.spec.ts` with the six hook scenarios from `publish-panel-library`: seeded prefill, late prefill replaces untouched value, late prefill does not overwrite an edited value, submit forwards the trimmed author, reset restores the prefill, omitted `defaultAuthor` yields `''`
- [x] 4.5 Verify with `npm run test:file -- libs/publish-panel/src/utils/use-publish-flow.spec.ts`

## 5. `libs/publish-panel` — panel UI

- [x] 5.1 Add required `author: string` and `onAuthorChange: (author: string) => void` to `PublishPanelProps`, and optional `authorLabel` / `authorPlaceholder` / `authorHint` to `PublishPanelLabels` with English defaults (`'Author'`, `'Author name'`, and a hint naming the catalog's author row)
- [x] 5.2 Render the field with ui-kit 2.0 `Input` (`labelProps`, `placeholder`, `caption` for the hint, `maxLength={200}`, `disabled={isSubmitting}`) inside the destination-folder block — after `PublishFoldersTree` and its callout, before the `PublishAccessRules` wrapper — using CSS logical properties only
- [x] 5.3 Add the same two required props to `StandalonePublishPanelProps` and forward them to `PublishPanel` unmodified
- [x] 5.4 Extend the `PublishPanel` and `StandalonePublishPanel` tests: field position relative to the tree and rules section, `onAuthorChange` fires on typing, field disabled while `isSubmitting`, empty author leaves Publish enabled, English default label when no override is passed, `StandalonePublishPanel` forwards both props
- [x] 5.5 Verify with `npm exec nx test publish-panel` and `npm exec nx lint publish-panel`

## 6. `libs/catalog` — prop threading

- [x] 6.1 Add `publishDefaultAuthor?: string` to `CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) and `ItemDetailsProps` (`libs/catalog/src/models/item-details-props.ts`), and widen both `onPublish` signatures with the fourth `author` argument
- [x] 6.2 Thread `publishDefaultAuthor` through `Catalog.tsx` into `DetailsPanel`, and from `DetailsPanel` into `usePublishFlow`'s `defaultAuthor`
- [x] 6.3 Pass `author={publishFlow.author}` / `onAuthorChange={publishFlow.setAuthor}` into `DetailsPanel`'s inline `PublishPanel` render
- [x] 6.4 Update `libs/catalog` tests that construct `onPublish` or render the publish sub-view to the new signature and props
- [x] 6.5 Verify with `npm exec nx test catalog` and `npm exec nx lint catalog`

## 7. `apps/chat` — i18n keys

- [x] 7.1 Add `AuthorLabel = 'publish.authorLabel'`, `AuthorPlaceholder = 'publish.authorPlaceholder'`, and `AuthorHint = 'publish.authorHint'` to `PublishI18nKeys` in `apps/chat/src/constants/translation-keys.ts`
- [x] 7.2 Add the three keys to `apps/chat/src/i18n/locales/en.json` under the existing `publish` namespace

## 8. `apps/chat` — catalog publish wiring

- [x] 8.1 In `CatalogView.tsx`, resolve `useUserProfile()`'s `displayName` and pass it as `publishDefaultAuthor`
- [x] 8.2 Add `authorLabel`, `authorPlaceholder`, and `authorHint` to the `publishLabels` object in `CatalogView.tsx`, translated from the new keys
- [x] 8.3 Update `useCatalogPublishing.handlePublish` to accept the fourth `author` argument and include `author` in the `publishCatalogEntity` body only when non-empty after trimming
- [x] 8.4 Extend `apps/chat/src/hooks/useCatalogPublishing` tests: edited author reaches the request body, untouched prefill is sent as-is, cleared author omits the key entirely, unpublish body is unchanged
- [x] 8.5 Verify with `npm run test:file -- apps/chat/src/hooks/useCatalogPublishing/tests/useCatalogPublishing.spec.ts`

## 9. `apps/chat` — conversation publish wiring

- [x] 9.1 Add a fourth positional `author: string` parameter to `publishConversation` in `apps/chat/src/server-api/conversation-publish.api.ts`, omitting the `author` key from the request body when it is empty after trimming
- [x] 9.2 In `PublishConversationPanelContainer.tsx`, call `useUserProfile()` and pass `displayName` as `usePublishFlow`'s `defaultAuthor`
- [x] 9.3 Forward the fourth `author` argument from the container's `onPublish` into `publishConversation`, and pass `author`/`onAuthorChange` plus the three new `panelLabels` entries into `StandalonePublishPanel`
- [x] 9.4 Extend the container's tests: prefilled author, edited author reaches `publishConversation`, cleared author omits the key, reset on close
- [x] 9.5 Verify with `npm run test:file -- apps/chat/src/components/PublishConversationPanelContainer/tests/PublishConversationPanelContainer.spec.tsx`

## 10. Documentation

- [x] 10.1 Update `libs/publish-panel/README.md`: the new `author`/`onAuthorChange` props on `PublishPanel` and `StandalonePublishPanel`, the new `authorLabel`/`authorPlaceholder`/`authorHint` labels, `usePublishFlow`'s `defaultAuthor` option and `author`/`setAuthor` results, and the widened `onPublish` signature in every example that passes it
- [x] 10.2 Update `libs/catalog/README.md` for `publishDefaultAuthor` and the widened `onPublish` signature in every affected example
- [x] 10.3 Check `apps/chat-api/README.md` and `docs/` for any description of the publish request bodies and update it if present; no new library, backend domain, context, or route is added, so `docs/architecture.md` needs no structural entry — confirm this rather than assume it
- [x] 10.4 Run `npm run validate:docs`

## 11. Final verification

- [x] 11.1 Run `npm run verify:changed`, then `npm run verify:full` once
- [ ] 11.2 Manually confirm the end-to-end behaviour: publish a toolset with a custom author, approve/inspect the resulting publication, and check the catalog details panel's **Hosted by** row shows the submitted value
- [x] 11.3 Run the five-axis review from `.claude/skills/code-review-and-quality/SKILL.md`, including the mobile-parity pass over the publish panel with the added field
