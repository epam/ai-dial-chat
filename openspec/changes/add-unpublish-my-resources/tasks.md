## 1. Shared publish-target contract

- [x] 1.1 Add `getPublishedTargetUrl(resourceTypePrefix, folderPath, resourceName)` to `apps/chat-api/src/publish/publish-target.util.ts`, returning `{resourceTypePrefix}/{getPublicTargetFolder(folderPath)}{resourceName}`, with a JSDoc stating that publish and unpublish MUST both use it
- [x] 1.2 Replace the inline `targetUrl` expression in `publish.service.ts` and `conversation-publish.service.ts` with the new helper — no behavior change
- [x] 1.3 Add unit tests in `apps/chat-api/src/publish/tests/` covering the public root, a folder name with spaces, a non-ASCII folder name, and a nested skill grouping folder
- [x] 1.4 `npm exec nx test chat-api` — all existing publish tests still pass unmodified

## 2. Catalog unpublish endpoint

- [x] 2.1 Add `dto/unpublish-catalog-entity.dto.ts` (`folderPath` required with `@ApiProperty` + `IsValidFilePath`; `version` **optional** with `@ApiPropertyOptional` + `@IsOptional`, mirroring `PublishCatalogEntityDto` field for field) and `dto/unpublish-result.dto.ts` (`entityId`, `entityType`, `folderPath`, `version`, `requestedAt`, `requestedBy`)
- [x] 2.2 Add `PublishService.unpublish(...)`: build `sourceUrl` via `toSourceUrl` (so a prompt id is bucket-qualified) and `targetFolder`/`targetUrl` with the existing helpers, recover an omitted `version` via `splitEntityNameAndVersion` and build the request `name` with the same `.trim()` publish uses, call `createPublication` with one `{ action: 'DELETE', sourceUrl, targetUrl }` resource and no `rules`, map `result.error` through `mapDialHttpStatus` + `extractDialErrorMessage`, log stack-only on throw
- [x] 2.3 Invalidate `publish-history:{entityType}:{entityId}` on success only
- [x] 2.4 Add `POST :entityType/:entityId/unpublish` to `publish.controller.ts` — `@HttpCode(200)`, `@Throttle({ default: { limit: 10, ttl: 60000 } })`, `operationId: unpublishCatalogEntity`, an `@ApiResponse` per status code, and a description naming the admin-approval step
- [x] 2.5 Filter `action: 'DELETE'` resources out of `PublishService.getPublishHistory`'s projection
- [x] 2.6 Tests in `apps/chat-api/src/publish/tests/`: success, `targetUrl` identical to publish's, empty `folderPath`, no `rules` forwarded, 403/404/502/503 mapping, path traversal rejected, cache invalidated on success and not on failure, history excludes a pending DELETE, an omitted `version` recovered from a versioned `entityId`, and a versionless prompt producing a `name` with no trailing space
- [x] 2.7 `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 3. Conversation unpublish endpoint

- [x] 3.1 Add `dto/unpublish-conversation.dto.ts` and the `UnpublishConversationResultDto` (`path`, `folderPath`, `requestedAt`, `requestedBy`)
- [x] 3.2 Add `ConversationPublishService.unpublish(...)`: re-fetch the title via `getConversation(bucket, encodedPath)` (abort through `handleDialSdkError` on failure), then `createPublication` with one DELETE resource; invalidate `conversation-publish-history:{sourceUrl}` on success
- [x] 3.3 Add `POST unpublish` to `conversation-publish.controller.ts` with `operationId: unpublishConversation`, the publish endpoint's throttle profile, and full Swagger metadata
- [x] 3.4 Filter `action: 'DELETE'` resources out of `ConversationPublishService.getPublishHistory`'s projection
- [x] 3.5 Tests: success, title-fetch failure aborts before `createPublication`, `targetUrl` matches publish's, validation rejects traversal, cache invalidation, history excludes a pending DELETE
- [x] 3.6 `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 4. API contract regeneration

- [x] 4.1 `npm run openapi` and `npm run openapi:check`
- [x] 4.2 `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`
- [x] 4.3 Add `unpublishCatalogEntity` to `apps/chat/src/server-api/publish.api.ts` and `unpublishConversation` to `apps/chat/src/server-api/conversation-publish.api.ts`, matching the existing thin-wrapper style, with tests alongside the existing `*.api.spec.ts` files

## 5. Notification contract

- [x] 5.1 Add `UnpublishRequested = 'unpublishRequested'` to `EntityOperation` in `apps/chat/src/types/entity-notification.ts`
- [x] 5.2 Add one `unpublishRequestedTitle`/`unpublishRequested` sentence pair per unpublishable entity to `apps/chat/src/i18n/locales/en.json` and `EntityNotificationsI18nKeys`; add `ButtonsI18nKeys.Unpublish`
- [x] 5.3 Extend the `(entity, operation)` map in `apps/chat/src/utils/entity-notification.ts` — catalog entities and `Conversation` only, so a `File`/`Folder` unpublish call fails to typecheck
- [x] 5.4 Extend `apps/chat/src/hooks/tests/useOperationNotification.spec.ts` with the new pairs and a type-level check that the absent `File` pair does not compile
- [x] 5.5 `npm exec nx test chat`

## 6. Catalog lib: confirmation sub-view gains an input slot

- [x] 6.1 Add `Unpublish` to `DetailsConfirmationKind` in `libs/catalog/src/types/details-confirmation.ts`
- [x] 6.2 Give `ConfirmationView` an optional `children` slot rendered after the consequence bullets; keep it presentational
- [x] 6.3 Add a per-kind `isConfirmDisabled` derivation in `DetailsPanel`, kept separate from `isConfirming`, and thread it into `ConfirmationFooter`
- [x] 6.4 Reset the confirmation and any input state on cancel and on `item.id` change
- [x] 6.5 Update `libs/catalog/README.md` for the new kind and slot; also backfill the missing `DeleteApiKey` kind and its card/confirm variant split, which neither the README nor the capability spec documented
- [x] 6.6 Tests in `libs/catalog/src/components/Details/tests/`: confirm disabled until input given, back stays enabled, input discarded on cancel and on item change

## 7. Catalog lib: the Unpublish action

- [x] 7.1 Add `onUnpublish`, `isUnpublishVisible`, and the `unpublish*` texts to `libs/catalog/src/models/item-details-props.ts`, with JSDoc stating every default verbatim; export every new type from `index.ts`
- [x] 7.2 Add the `Unpublish` Manage-menu entry to `Header.tsx` after `Publish` — `IconWorldOff`, `aria-hidden`, non-danger, calling `onOpenUnpublish`
- [x] 7.3 Lift the publish-history fetch in `DetailsPanel` so it also runs on Manage-menu open/focus, once per item, guarded by a started-lookup ref, reset on `item.id` change, and shared with the publish sub-view
- [x] 7.4 Derive entry visibility from resolved-with-entries history AND `isUnpublishVisible` AND `onUnpublish`; hide on zero entries and on failure
- [x] 7.5 Add the `Unpublish` branch to `confirmationContent`: danger variant, the folder radio group in the slot when history holds more than one folder, static single-folder copy otherwise
- [x] 7.6 Wire confirm to `onUnpublish(item, folderPath)`; keep `Unpublish` out of `CONFIRMATIONS_REMOVING_ITEM_FROM_VIEW` and leave cached history untouched on success
- [x] 7.7 Verify every new label is forwarded to the element that renders it — no declared-but-unread text field
- [x] 7.8 Tests: entry gated on history in all four states, lookup issued once per item, single vs. multi folder body, `onUnpublish` receives the chosen path, panel stays open on success and on rejection
- [x] 7.9 `npm exec nx test catalog` and `npm exec nx lint catalog`

## 8. App wiring: catalog

- [x] 8.1 Restore the real publish-history fetch in `CatalogView.tsx`: replace `const getPublishHistory = useCallback(async () => [], [])` with the `getCatalogPublishHistory` + `mapPublishHistoryEntryDto` call, and delete the GH #7897 comment block above it
- [x] 8.2 Update `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx`, which currently asserts the always-empty-history behaviour, to assert the fetch and its mapping instead
- [x] 8.3 Confirm `PublishHistoryList`'s loading and error states render again for a catalog entity — they have been unreachable since the stub landed, so this is a restored surface, not a new one
- [ ] 8.4 Archive `openspec/changes/disable-catalog-publish-history-fetch/` as superseded by this change, so the two do not carry opposite requirements for `catalog-publish-flow`
- [x] 8.5 Pass `onUnpublish` from `CatalogView.tsx` to `DetailsPanel`, calling `unpublishCatalogEntity` with the item's entity type, id, joined folder path, and version (omitting `version` for an unversioned prompt or skill rather than sending an empty string)
- [x] 8.6 Raise `notifyOperationSuccess(resolveNotifiableEntity(item.type), EntityOperation.UnpublishRequested, { name, folder })` on success, using the folder's leaf segment
- [x] 8.7 Route failures through `usePublishErrorNotification`
- [x] 8.8 Pass every `unpublish*` text from `translation-keys.ts` — no English literal in the wiring
- [x] 8.9 Tests in `apps/chat/src/components/CatalogView/tests/`: request arguments, success notification, error path, and the `Unpublish` entry appearing only once history resolves with entries

## 9. App wiring: conversations

- [x] 9.1 Replace the hardcoded empty `history` in `PublishConversationPanelContainer` with real history received as a prop, and remove the GH #7897 comment
- [x] 9.2 Add a lazy per-conversation publish-history lookup in `ConversationPanelView`, triggered on row action-menu open/focus, held keyed by conversation, and shared with the publish panel
- [x] 9.3 Add the `Unpublish` row-menu entry after `Publish`, gated on `ConversationsPublishing`, own-writable-row, and resolved history with ≥ 1 folder
- [x] 9.4 Add the `ConfirmationPopup` with single-folder copy or a labelled single-select folder group, controls locked and announced via a polite live region while in flight
- [x] 9.5 Call `unpublishConversation` with the bucket-relative path from `getConversationPath(normalizeConversationId(contextId))`; on success raise the `UnpublishRequested` notification and do not call `refreshConversations()`; on failure use `usePublishErrorNotification`
- [x] 9.6 Confirm the now-live `allowReplace={false}` behaviour: an already-published folder shows `conversationPublish.alreadyPublishedWarning` and disables submit, and loading/failed history does not block submit
- [x] 9.7 Add `conversationUnpublish.*` keys to `en.json` and `translation-keys.ts`; reuse `ButtonsI18nKeys.Unpublish` for the verb
- [x] 9.8 Tests: menu gating in all history states, no history request on list render, single vs. multi folder popup, request arguments, no list refresh, error path, and the restored replace-warning behaviour
- [x] 9.9 `npm exec nx test chat` and `npm exec nx lint chat`

## 10. Cross-cutting verification

- [x] 10.1 RTL pass over both new surfaces — logical utilities only, `IconWorldOff` not mirrored; check the panel and popup under `dir="rtl"`
- [x] 10.2 a11y pass — decorative icons `aria-hidden`, radio groups named and arrow-key operable, in-flight state announced, focus returns to the triggering control on dismiss
- [ ] 10.3 Verify **both** publish-history endpoints (catalog and conversation) against a live DIAL Core (design.md open question, GH #7897) now that the list-scope defect is fixed; if either still fails, record the outcome in the change and confirm that surface's entry degrades to hidden rather than broken, and that the catalog publish panel's restored history error state is acceptable to show
- [ ] 10.4 Manual end-to-end: publish an entity and a conversation, confirm each appears in history, unpublish each, confirm the pending-request notification and that the folder still lists as published
- [x] 10.5 `npm exec nx affected --target=test --base=origin/development-1.0` and the same for `lint` and `build`
- [x] 10.6 Run the five-axis review (`.claude/skills/code-review-and-quality/SKILL.md`) before merge
