## 1. Shared machinery

- [x] 1.1 Add `NotifiableEntity` and `EntityOperation` string enums (`apps/chat/src/types/entity-notification.ts`) covering `Prompt | Agent | Toolset | Model | Skill | Conversation | File | Folder` and `Created | Edited | Renamed | Duplicated | Deleted | Downloaded | PublishRequested | Unpublished`
- [x] 1.2 Add `EntityNotificationsI18nKeys` to `apps/chat/src/constants/translation-keys.ts` and the `entityNotifications` block to `apps/chat/src/i18n/locales/en.json`, one complete sentence per `(entity, operation)` pair the spec matrix marks as existing — no `Unpublished` keys
- [x] 1.3 Implement the `(entity, operation) → { titleKey, messageKey }` map and `resolveNotifiableEntity(type: CatalogEntityType)` (exhaustive over the enum, no `default` branch) next to the hook
- [x] 1.4 Implement `useOperationNotification` (`apps/chat/src/hooks/useOperationNotification.ts`): `notifyOperationSuccess(entity, operation, params)` → `showSuccessNotification` with translated title/body, no `requestId`, wrapped in `useCallback`
- [x] 1.5 Spec `apps/chat/src/hooks/tests/useOperationNotification.spec.ts`: each mapped pair produces the expected title/body, `name`/`folder` interpolate, an unmapped pair does not typecheck (type-level assertion), and no `requestId` is set
- [x] 1.6 Verified: `tsc` (app + spec configs), the touched spec files, and `eslint` on the changed files

## 2. Catalog surfaces (`CatalogView`)

- [x] 2.1 Route `handleDelete`'s success through `notifyOperationSuccess(resolveNotifiableEntity(item.type), EntityOperation.Deleted, { name })`; delete `catalog.details.delete.success*` keys and their enum members
- [x] 2.2 Add the missing download confirmation in `handleDownload` (`NotifiableEntity.Prompt` + `Downloaded`) after `triggerBlobDownload` resolves
- [x] 2.3 Rewrite `handlePublishSuccess` to `EntityOperation.PublishRequested` with `{ name, folder }`; delete `catalog.publishSuccess*` keys and their enum members
- [x] 2.4 Reviewed the catalog unshare/revoke titles ("Removed from My List", "Access revoked"): left unchanged — the `<Entity> <operation> successfully` frame has no entity noun to bind for an access change, and the current copy is already consistent with the conversation flow
- [x] 2.7 Collapse `onToggleFavorite`'s added/removed branch onto `showSuccessNotification` so removing a favourite is a Success notification, not Info
- [x] 2.5 Update `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` for the new payloads, including one test per entity kind on the publish title
- [x] 2.6 Verified: `tsc` (app + spec configs), the touched spec files, and `eslint` on the changed files

## 3. Prompt editor

- [x] 3.1 Replace the single `promptEditor.saveSuccessTitle` notification in `PromptEditor` with `Created` / `Edited` through the hook, chosen by `isEditMode`
- [x] 3.2 Delete `promptEditor.saveSuccessTitle`, `promptEditor.createSuccess`, `promptEditor.updateSuccess` from `en.json` and `translation-keys.ts`
- [x] 3.3 Update `apps/chat/src/pages/PromptEditor/tests/PromptEditor.spec.tsx`
- [x] 3.4 Verified: `tsc` (app + spec configs), the touched spec files, and `eslint` on the changed files

## 4. Entity editors (agents, custom apps, toolsets)

- [x] 4.1 `ToolsetEditor`: notify `Toolset` + `Created`/`Edited` on a successful Save & Exit, immediately before `navigate(returnUrl)`; leave the Settings-step draft creation silent
- [x] 4.2 `CustomAppEditor`: notify `Agent` + `Created`/`Edited` on a successful create/save, immediately before `navigate(returnUrl)`
- [x] 4.3 `AppsEditor`: notify `Agent` + `Created`/`Edited` only for the Save & Exit `SaveSuccess` path, not for preview-triggered saves; ignore `hasChanges` for the notification decision
- [x] 4.4 Updated `ToolsetEditor.spec` (created + silent draft) and `AppsEditor.spec` (edited + preview-save-stays-silent). `CustomAppEditor` has no spec file in the repo — its notification is typechecked but untested
- [x] 4.5 Verified: `tsc` (app + spec configs), the touched spec files, and `eslint` on the changed files

## 5. Conversations

- [x] 5.1 `ConversationPanelView`: add the duplicate success notification (`Conversation` + `Duplicated`) and the rename success notification (`Conversation` + `Renamed`)
- [x] 5.2 Conversation delete now goes through the hook (`conversation.deleted*`, old `conversationPanel.delete.deleteSuccess*` deleted); unshare switched from `showInfoNotification` to Success. Delete-all, unshare, and revoke titles left as-is — they describe an access/batch outcome the `<Entity> <operation> successfully` frame cannot express
- [x] 5.3 Export/import titles left unchanged: one title key serves both the single and the all-conversations flow, so an entity-scoped title would misdescribe the batch case. Messages and keys untouched
- [x] 5.4 `PublishConversationPanelContainer` now uses the hook with `PublishRequested`. The body moved to `entityNotifications.conversation.publishRequested` (which carries the same pending-approval meaning, plus the conversation name and target folder) and `conversationPublish.successMessage` was deleted rather than kept — one publish sentence for both flows
- [x] 5.5 Update `ConversationPanelView`, `ConversationPanelMenu`, `useConversationExport`, `useConversationImport`, and `PublishConversationPanelContainer` specs
- [x] 5.6 Verified: `tsc` (app + spec configs), the touched spec files, and `eslint` on the changed files

## 6. File manager

- [x] 6.1 `useDialFileMutations`: notify on successful folder creation (`Folder` + `Created`)
- [x] 6.2 Notify on a fully successful rename (`File`/`Folder` + `Renamed`, resolved from `nodeType`); keep partial-failure toasts and raise no success notification for them
- [x] 6.3 Notify on completed download — single file with the effective saved filename, archive with the archive name (`Downloaded`)
- [x] 6.4 Upload/delete/copy/move titles left unchanged: they already read `Item(s) <operation> successfully` and cover mixed file+folder selections, which a per-entity title cannot
- [x] 6.5 Update `apps/chat/src/hooks/files/tests/*` and `DialFileManagerPage` / `DialFileManagerModal` specs
- [x] 6.6 Verified: `tsc` (app + spec configs), the touched spec files, and `eslint` on the changed files

## 7. Sweep and close

- [x] 7.1 Grep for remaining `showSuccessNotification` call sites that pass literal keys and confirm each is either routed through the hook or an intentional batch/flow exception recorded in the spec
- [x] 7.2 Confirm no orphaned i18n keys remain (every superseded key deleted, every `entityNotifications` key referenced) and no raw key literal is passed to `t()`
- [x] 7.3 Confirm nothing under `libs/` gained a notification string, an i18n import, or a notification decision
- [x] 7.4 Full verification: `tsc` app + spec configs clean, `eslint` on every changed file clean, full `vitest` run 2664 passed / 1 failed — the failure is the pre-existing `AnnouncementBanner — legacy layout` typography assertion from commit b0756dfd7, untouched by this change
- [ ] 7.5 Resolve the four `design.md` open questions with design/PO and fold any wording change into the key map before merge
