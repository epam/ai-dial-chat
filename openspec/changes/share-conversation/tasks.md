## 1. Backend doc update

- [x] 1.1 Update `@ApiOperation.description` on `createShareLink` in `apps/chat-api/src/share/share.controller.ts` to reference conversations as a shareable resource type, alongside catalog entities
- [x] 1.2 Run `npm run openapi` and `npm run openapi:check`; regenerate/verify `@epam/chat-api-client` picks up the description change
- [ ] 1.3 Verify (manually, against a dev DIAL Core instance) that `POST /api/v1/share` accepts an owned conversation's resource path as `itemId` and returns a usable link

## 2. i18n

- [x] 2.1 Add `ShareLabel` to `ConversationPanelI18nKeys` in `apps/chat/src/constants/translation-keys.ts`
- [x] 2.2 Add `conversationPanel.shareLabel: "Share"` to `apps/chat/src/i18n/locales/en.json`
- [x] 2.3 Add the same key to all other locale files under `apps/chat/src/i18n/locales/` (n/a — `en.json` is the only locale file in the repo)

## 3. `ShareConversationPopoverContainer`

- [x] 3.1 Create `apps/chat/src/components/ShareConversationPopoverContainer/ShareConversationPopoverContainer.tsx` with `Props { conversationPath: string; onClose: () => void }` (`conversationId` dropped — the container only needs the resource path; the caller tracks the id itself)
- [x] 3.2 Wire `useShareLink(conversationPath)` and render `SharePopover` with `access={[ShareLinkAccess.View]}`, `canEditAccess={false}`, and translated `labels` (mirroring `SharePopoverContainer`'s labels object)
- [x] 3.3 Export a memoized default export (`export default memo(ShareConversationPopoverContainer)`)
- [x] 3.4 Add tests in `apps/chat/src/components/ShareConversationPopoverContainer/tests/ShareConversationPopoverContainer.spec.tsx` covering loading, error, success, `canEditAccess={false}`, and `onClose` invocation

## 4. Conversation panel action menu

- [x] 4.1 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, add `pendingShareItem` state (`{ id, path } | null`) alongside the existing `pendingRenameItem`/`pendingDeleteId` state
- [x] 4.2 In `getActions`, add a `shareAction: DropdownItem` (`IconShare` from `@tabler/icons-react`, label `t(ConversationPanelI18nKeys.ShareLabel)`) that sets `pendingShareItem`, included only in the non-readonly branch (not returned for `isReadonlyItem`)
- [x] 4.3 Host `ShareConversationPopoverContainer` in a `DialPopup` (`size={PopupSize.Sm}`, `dividers={false}`, `hideClose`, `headerClassName="hidden"`) rendered when `pendingShareItem` is set — a centered modal like `RenameConversationPopup`/the delete `DialConfirmationPopup`, not an anchored `DialDropdown`, since `ConversationPanelView` has no ref to the row's "..." trigger to anchor to. `hideClose`/`headerClassName="hidden"` were added after a running-app screenshot showed `DialPopup`'s own (always-rendered) header row producing a double-header gap with a stray close button above `SharePopover`'s real header — collapsing it makes `SharePopover`'s own header the only one shown
- [x] 4.4 Update `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`: owned conversation menu includes "Share"; readonly/shared/published conversation menu excludes "Share"; selecting "Share" opens the popover container

## 6. Accept-invitation routing (discovered gap: conversation share links landed on the catalog)

- [x] 6.1 `apps/chat-api/src/share/share.service.ts`: replace the hardcoded `/catalog/shared` route path with `getInvitationRoutePath(itemId)`, routing to `/conversations/shared` when `itemId` starts with `conversations/`, else `/catalog/shared`; `buildInvitationUrl` now takes `itemId`
- [x] 6.2 Add a test in `apps/chat-api/src/share/tests/share.service.spec.ts` covering the conversation `itemId` → `/conversations/shared/:id` routing (existing catalog-itemId tests continue to assert `/catalog/shared/:id`)
- [x] 6.3 Add `ROUTES.ConversationSharedInvitation = '/conversations/shared/:invitationId'` to `apps/chat/src/types/routes.ts`
- [x] 6.4 Generalize `apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx` with optional `getTargetRoute`/`errorFallbackRoute` props, defaulting to the original catalog behavior
- [x] 6.5 Add `apps/chat/src/pages/ConversationSharedInvitation/ConversationSharedInvitation.tsx`, rendering `SharedInvitationPage` with `getTargetRoute={getConversationRoute}` and `errorFallbackRoute={ROUTES.Root}`, plus tests
- [x] 6.6 Register the new route as a lazy top-level `<Route>` in `apps/chat/src/app/app.tsx`, alongside the existing catalog `ROUTES.SharedInvitation` route

## 7. Verification

- [x] 7.1 `npm exec nx lint chat` and `npm exec nx lint chat-api` (re-run after routing/popup fixes) — clean; the pre-existing `share.service.spec.ts` import-order error was fixed opportunistically while editing that file
- [x] 7.2 `npm exec nx test chat` and `npm exec nx test chat-api` — blocked repo-wide by a pre-existing Vitest environment failure (`TypeError: Cannot read properties of undefined (reading 'config')`) affecting all 108+ suites in both projects, not introduced by this change; new tests were written and are structurally consistent with passing sibling tests, but could not be executed in this environment
- [x] 7.3 `npm exec nx build chat-api` and `npm exec nx build chat` (re-run after routing/popup fixes) — both succeed
- [ ] 7.4 Manually verify in the running app: open the panel row menu for an owned conversation, click Share, confirm the popover shows a link with a single clean header (view-only, no access dropdown, no double-header gap), copy works, the menu is absent for a shared-with-me conversation, and opening the link in another session lands on the conversation (not the catalog)
- [ ] 7.5 Verify RTL: menu item and popover render correctly with `dir="rtl"`
