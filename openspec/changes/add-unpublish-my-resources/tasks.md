## 1. Shared publish-target contract

- [ ] 1.1 Add `getPublishedTargetUrl(resourceTypePrefix, folderPath, resourceName)` to `apps/chat-api/src/publish/publish-target.util.ts`, returning `{resourceTypePrefix}/{getPublicTargetFolder(folderPath)}{resourceName}`, with a JSDoc stating that publish and unpublish MUST both use it
- [ ] 1.2 Replace the inline `targetUrl` expression in `publish.service.ts` and `conversation-publish.service.ts` with the new helper — no behavior change
- [ ] 1.3 Add unit tests in `apps/chat-api/src/publish/tests/` covering the public root, a folder name with spaces, a non-ASCII folder name, and a nested skill grouping folder
- [ ] 1.4 `npm exec nx test chat-api` — all existing publish tests still pass unmodified

## 2. Catalog unpublish endpoint

- [ ] 2.1 Add `dto/unpublish-catalog-entity.dto.ts` (`folderPath` with `IsValidFilePath`, `version` required, `@ApiProperty` on both) and `dto/unpublish-result.dto.ts` (`entityId`, `entityType`, `folderPath`, `version`, `requestedAt`, `requestedBy`)
- [ ] 2.2 Add `PublishService.unpublish(...)`: build `sourceUrl`/`targetFolder`/`targetUrl` with the existing helpers, call `createPublication` with one `{ action: 'DELETE', sourceUrl, targetUrl }` resource and no `rules`, map `result.error` through `mapDialHttpStatus` + `extractDialErrorMessage`, log stack-only on throw
- [ ] 2.3 Invalidate `publish-history:{entityType}:{entityId}` on success only
- [ ] 2.4 Add `POST :entityType/:entityId/unpublish` to `publish.controller.ts` — `@HttpCode(200)`, `@Throttle({ default: { limit: 10, ttl: 60000 } })`, `operationId: unpublishCatalogEntity`, an `@ApiResponse` per status code, and a description naming the admin-approval step
- [ ] 2.5 Filter `action: 'DELETE'` resources out of `PublishService.getPublishHistory`'s projection
- [ ] 2.6 Tests in `apps/chat-api/src/publish/tests/`: success, `targetUrl` identical to publish's, empty `folderPath`, no `rules` forwarded, 403/404/502/503 mapping, path traversal rejected, cache invalidated on success and not on failure, history excludes a pending DELETE
- [ ] 2.7 `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 3. Conversation unpublish endpoint

- [ ] 3.1 Add `dto/unpublish-conversation.dto.ts` and the `UnpublishConversationResultDto` (`path`, `folderPath`, `requestedAt`, `requestedBy`)
- [ ] 3.2 Add `ConversationPublishService.unpublish(...)`: re-fetch the title via `getConversation(bucket, encodedPath)` (abort through `handleDialSdkError` on failure), then `createPublication` with one DELETE resource; invalidate `conversation-publish-history:{sourceUrl}` on success
- [ ] 3.3 Add `POST unpublish` to `conversation-publish.controller.ts` with `operationId: unpublishConversation`, the publish endpoint's throttle profile, and full Swagger metadata
- [ ] 3.4 Filter `action: 'DELETE'` resources out of `ConversationPublishService.getPublishHistory`'s projection
- [ ] 3.5 Tests: success, title-fetch failure aborts before `createPublication`, `targetUrl` matches publish's, validation rejects traversal, cache invalidation, history excludes a pending DELETE
- [ ] 3.6 `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 4. API contract regeneration

- [ ] 4.1 `npm run openapi` and `npm run openapi:check`
- [ ] 4.2 `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`
- [ ] 4.3 Add `unpublishCatalogEntity` to `apps/chat/src/server-api/publish.api.ts` and `unpublishConversation` to `apps/chat/src/server-api/conversation-publish.api.ts`, matching the existing thin-wrapper style, with tests alongside the existing `*.api.spec.ts` files

## 5. Notification contract

- [ ] 5.1 Add `UnpublishRequested = 'unpublishRequested'` to `EntityOperation` in `apps/chat/src/types/entity-notification.ts`
- [ ] 5.2 Add one `unpublishRequestedTitle`/`unpublishRequested` sentence pair per unpublishable entity to `apps/chat/src/i18n/locales/en.json` and `EntityNotificationsI18nKeys`; add `ButtonsI18nKeys.Unpublish`
- [ ] 5.3 Extend the `(entity, operation)` map in `apps/chat/src/utils/entity-notification.ts` — catalog entities and `Conversation` only, so a `File`/`Folder` unpublish call fails to typecheck
- [ ] 5.4 Extend `apps/chat/src/hooks/tests/useOperationNotification.spec.ts` with the new pairs and a type-level check that the absent `File` pair does not compile
- [ ] 5.5 `npm exec nx test chat`

## 6. Catalog lib: confirmation sub-view gains an input slot

- [ ] 6.1 Add `Unpublish` to `DetailsConfirmationKind` in `libs/catalog/src/types/details-confirmation.ts`
- [ ] 6.2 Give `ConfirmationView` an optional `children` slot rendered after the consequence bullets; keep it presentational
- [ ] 6.3 Add a per-kind `isConfirmDisabled` derivation in `DetailsPanel`, kept separate from `isConfirming`, and thread it into `ConfirmationFooter`
- [ ] 6.4 Reset the confirmation and any input state on cancel and on `item.id` change
- [ ] 6.5 Update `libs/catalog/README.md` for the new kind and slot
- [ ] 6.6 Tests in `libs/catalog/src/components/Details/tests/`: confirm disabled until input given, back stays enabled, input discarded on cancel and on item change

## 7. Catalog lib: the Unpublish action

- [ ] 7.1 Add `onUnpublish`, `isUnpublishVisible`, and the `unpublish*` texts to `libs/catalog/src/models/item-details-props.ts`, with JSDoc stating every default verbatim; export every new type from `index.ts`
- [ ] 7.2 Add the `Unpublish` Manage-menu entry to `Header.tsx` after `Publish` — `IconWorldOff`, `aria-hidden`, non-danger, calling `onOpenUnpublish`
- [ ] 7.3 Lift the publish-history fetch in `DetailsPanel` so it also runs on Manage-menu open/focus, once per item, guarded by a started-lookup ref, reset on `item.id` change, and shared with the publish sub-view
- [ ] 7.4 Derive entry visibility from resolved-with-entries history AND `isUnpublishVisible` AND `onUnpublish`; hide on zero entries and on failure
- [ ] 7.5 Add the `Unpublish` branch to `confirmationContent`: danger variant, the folder radio group in the slot when history holds more than one folder, static single-folder copy otherwise
- [ ] 7.6 Wire confirm to `onUnpublish(item, folderPath)`; keep `Unpublish` out of `CONFIRMATIONS_REMOVING_ITEM_FROM_VIEW` and leave cached history untouched on success
- [ ] 7.7 Verify every new label is forwarded to the element that renders it — no declared-but-unread text field
- [ ] 7.8 Tests: entry gated on history in all four states, lookup issued once per item, single vs. multi folder body, `onUnpublish` receives the chosen path, panel stays open on success and on rejection
- [ ] 7.9 `npm exec nx test catalog` and `npm exec nx lint catalog`

## 8. App wiring: catalog

- [ ] 8.1 Pass `onUnpublish` from `CatalogView.tsx` to `DetailsPanel`, calling `unpublishCatalogEntity` with the item's entity type, id, joined folder path, and version
- [ ] 8.2 Raise `notifyOperationSuccess(resolveNotifiableEntity(item.type), EntityOperation.UnpublishRequested, { name, folder })` on success, using the folder's leaf segment
- [ ] 8.3 Route failures through `usePublishErrorNotification`
- [ ] 8.4 Pass every `unpublish*` text from `translation-keys.ts` — no English literal in the wiring
- [ ] 8.5 Tests in `apps/chat/src/components/CatalogView/tests/`: request arguments, success notification, error path

## 9. App wiring: conversations

- [ ] 9.1 Replace the hardcoded empty `history` in `PublishConversationPanelContainer` with real history received as a prop, and remove the GH #7897 comment
- [ ] 9.2 Add a lazy per-conversation publish-history lookup in `ConversationPanelView`, triggered on row action-menu open/focus, held keyed by conversation, and shared with the publish panel
- [ ] 9.3 Add the `Unpublish` row-menu entry after `Publish`, gated on `ConversationsPublishing`, own-writable-row, and resolved history with ≥ 1 folder
- [ ] 9.4 Add the `ConfirmationPopup` with single-folder copy or a labelled single-select folder group, controls locked and announced via a polite live region while in flight
- [ ] 9.5 Call `unpublishConversation` with the bucket-relative path from `getConversationPath(normalizeConversationId(contextId))`; on success raise the `UnpublishRequested` notification and do not call `refreshConversations()`; on failure use `usePublishErrorNotification`
- [ ] 9.6 Confirm the now-live `allowReplace={false}` behaviour: an already-published folder shows `conversationPublish.alreadyPublishedWarning` and disables submit, and loading/failed history does not block submit
- [ ] 9.7 Add `conversationUnpublish.*` keys to `en.json` and `translation-keys.ts`; reuse `ButtonsI18nKeys.Unpublish` for the verb
- [ ] 9.8 Tests: menu gating in all history states, no history request on list render, single vs. multi folder popup, request arguments, no list refresh, error path, and the restored replace-warning behaviour
- [ ] 9.9 `npm exec nx test chat` and `npm exec nx lint chat`

## 10. Cross-cutting verification

- [ ] 10.1 RTL pass over both new surfaces — logical utilities only, `IconWorldOff` not mirrored; check the panel and popup under `dir="rtl"`
- [ ] 10.2 a11y pass — decorative icons `aria-hidden`, radio groups named and arrow-key operable, in-flight state announced, focus returns to the triggering control on dismiss
- [ ] 10.3 Verify the conversation publish-history endpoint against a live DIAL Core (design.md open question, GH #7897); if it still fails, record the outcome in the change and confirm the conversation entry degrades to hidden rather than broken
- [ ] 10.4 Manual end-to-end: publish an entity and a conversation, confirm each appears in history, unpublish each, confirm the pending-request notification and that the folder still lists as published
- [ ] 10.5 `npm exec nx affected --target=test --base=origin/development-1.0` and the same for `lint` and `build`
- [ ] 10.6 Run the five-axis review (`.claude/skills/code-review-and-quality/SKILL.md`) before merge
