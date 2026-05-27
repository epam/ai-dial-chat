## 1. Backend — Add catalogItemId to CreateConversationDto

- [x] 1.1 Add `catalogItemId: string` field to `apps/chat-api/src/conversations/dto/create-conversation.dto.ts` with `@IsString`, `@MinLength(1)`, `@MaxLength(256)`, `@Matches(/^[\w.\-:@/]+$/)`, and `@ApiProperty` decorators
- [x] 1.2 Update `ConversationService.createConversation` signature in `apps/chat-api/src/conversations/conversation.service.ts` to accept `catalogItemId: string` as a required param (after `bucket`)
- [x] 1.3 Replace the two hardcoded `'anthropic.claude-v3-sonnet'` strings in `ConversationService.createConversation` with `catalogItemId` for both `model.id` and `assistantModelId`
- [x] 1.4 Update the controller call in `apps/chat-api/src/conversations/conversation.controller.ts` to pass `dto.catalogItemId` to `conversationService.createConversation`
- [x] 1.5 Update `@ApiResponse({ status: 400 })` on the `createConversation` handler to document the missing/invalid `catalogItemId` case
- [x] 1.6 Verify: `npm exec nx test chat-api` passes
- [x] 1.7 Verify: `npm exec nx lint chat-api` passes

## 2. Backend — Update tests for catalogItemId

- [x] 2.1 Update `apps/chat-api/src/conversations/tests/conversation.service.spec.ts`: add test that `createConversation` returns `model.id === catalogItemId` and `assistantModelId === catalogItemId`; confirm no `'anthropic.claude-v3-sonnet'` literal in the test
- [x] 2.2 Update `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`: add 201 case with `catalogItemId`; add 400 cases for missing `catalogItemId`, empty string, >256-char value, and a value containing disallowed characters (e.g. `"bad id!"`)
- [x] 2.3 Verify: `npm exec nx test chat-api` passes with all new/updated test cases

## 3. Generated client — Regenerate after DTO change

- [x] 3.1 Run `npm run openapi` to regenerate `@epam/chat-api-client` from the updated OpenAPI spec
- [x] 3.2 Run `npm run openapi:check` and confirm it exits 0
- [x] 3.3 Run `npm exec nx build chat-api-client -- --skip-nx-cache` and confirm it exits 0
- [x] 3.4 Run `npm exec nx lint chat-api-client` and confirm it exits 0

## 4. Frontend server-api wrapper — Pass catalogItemId

- [x] 4.1 Update `apps/chat/src/server-api/conversations.api.ts`: add `catalogItemId: string` param to `createConversation`; forward it as `catalogItemId` in `createConversationDto`
- [x] 4.2 Add a unit test asserting that `createConversation('Hello', 'dep-1')` calls the generated `conversationsApi.createConversation` with `{ createConversationDto: { firstMessage: 'Hello', catalogItemId: 'dep-1' } }`
- [x] 4.3 Verify: `npm exec nx build chat -- --skip-nx-cache` compiles without TypeScript errors

## 5. Lib — Extend InputProps and ConversationInputProps

- [x] 5.1 Add `catalogItems`, `selectedCatalogItemId`, `onSelectedCatalogItemChange`, `modelSelectorAriaLabel`, `modelSelectorLoadingLabel`, `modelSelectorErrorLabel`, `modelSelectorEmptyLabel` to `InputProps` in `libs/conversation-input/src/models/Input.ts` with JSDoc on each prop; import `CatalogItemDto` from `@epam/chat-api-client`
- [x] 5.2 Forward all eight new props from `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts` with matching JSDoc
- [x] 5.3 Verify: `npm exec nx lint conversation-input` passes

## 6. Lib — Add DialDropdownIcon selector to Input component

- [x] 6.1 Import `DialDropdownIcon` from `@epam/ai-dial-ui-kit` and `IconRobot` from `@tabler/icons-react` in `libs/conversation-input/src/components/Input/Input.tsx`
- [x] 6.2 Destructure the eight new selector props from `InputProps` in the `Input` component; keep selector absent when `catalogItems` is `undefined`
- [ ] 6.3 Verify the Figma node `27:1476` and `27:4520` layouts before placing the trigger — document the icon size, gap, and placement in the PR description; source URLs:
  - https://www.figma.com/design/WJEnj2fH07plvGmpXsswle/DIAL-Chat--Chat?node-id=27-1476&t=uxgXjAa2KtXTxRPP-0
  - https://www.figma.com/design/WJEnj2fH07plvGmpXsswle/DIAL-Chat--Chat?node-id=27-4520&t=uxgXjAa2KtXTxRPP-0
- [x] 6.4 Render the `DialDropdownIcon` in the right-side action group after the Optional tools dropdown and before the microphone/send/stop control when `catalogItems` is defined; keep the `+` add menu as the leftmost control; use `selectedItem.iconUrl` as `<img>` or fall back to `<IconRobot size={18} />`; pass `ariaLabel` that includes `modelSelectorAriaLabel ?? 'Select model'` and the selected item display name
- [x] 6.5 Build the `menu` from `catalogItems`: each entry maps `{ id, displayName ?? id }` to a menu item that calls `onSelectedCatalogItemChange(item.id)` on click
- [x] 6.6 Disable the `DialDropdownIcon` trigger when `isStreaming === true`
- [x] 6.7 Keep the selector trigger compact and icon-only with a caret; expose selected/loading/error state through accessible labels, tooltips, or disabled menu items rather than visible long toolbar text; show `modelSelectorEmptyLabel` as a disabled menu item when applicable
- [x] 6.8 Guard send: disable send button and block Enter when `catalogItems` is defined and `selectedCatalogItemId` is `null` or `undefined`
- [x] 6.9 Forward all new props from `ConversationInput.tsx` down to `Input.tsx`
- [x] 6.10 Verify: `npm exec nx lint conversation-input` passes; `npm exec nx build conversation-input -- --skip-nx-cache` passes

## 7. Lib — Unit tests for selector

- [x] 7.1 Add test: selector renders when `catalogItems` is non-empty — verify `DialDropdownIcon` is in DOM
- [x] 7.2 Add test: trigger reflects selected item displayName via aria-label while remaining icon-only in the toolbar
- [x] 7.3 Add test: clicking a menu item fires `onSelectedCatalogItemChange` with correct id
- [x] 7.4 Add test: loading label shown when `catalogItems === []` and `modelSelectorLoadingLabel` is set
- [x] 7.5 Add test: error label shown when `catalogItems === []` and `modelSelectorErrorLabel` is set
- [x] 7.6 Add test: send button disabled when `catalogItems` is defined and `selectedCatalogItemId` is `null`
- [x] 7.7 Add test: Enter key does not fire `onSend` when no selection
- [x] 7.8 Add test: no selector element rendered when `catalogItems` is `undefined`
- [x] 7.9 Verify: `npm exec nx test conversation-input` passes with all new test cases

## 8. Frontend app — Wire useCatalog into ConversationRoute

- [x] 8.1 Add `useCatalog()` call in `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`; destructure `{ items, selectedItemId, setSelectedItemId, isLoading, error }`
- [x] 8.2 Add i18n keys to `apps/chat/src/i18n/locales/en.json`: `catalog.selector.ariaLabel`, `catalog.selector.loading`, `catalog.selector.error`, `catalog.selector.empty`
- [x] 8.3 Pass all four translated label props and selector state props into `<ConversationInput>` in `ConversationRoute`
- [x] 8.4 Update `handleSend` in `ConversationRoute`: add `if (!selectedItemId) return;` guard; pass `selectedItemId` as `catalogItemId` to `apiCreateConversation(message, selectedItemId, convertedAttachments)` where `convertedAttachments` is the result of converting `Attachment[]` to the API shape
- [x] 8.5 Verify: `npm exec nx lint chat` passes; `npm exec nx build chat -- --skip-nx-cache` compiles without TypeScript errors

## 9. Frontend app — Wire useCatalog into ConversationView

- [x] 9.1 Add `useCatalog()` call in `apps/chat/src/components/ConversationView/ConversationView.tsx`; pass selector props to `<ConversationInput>` for follow-up messages in an existing conversation
- [x] 9.2 Confirm that follow-up sends in an existing conversation use `conversation.model.id` (from existing conversation routing), not the catalog selection — or document explicitly which takes precedence; align with `ConversationView` existing send logic

## 10. Frontend app — Tests for app-level wiring

- [x] 10.1 Update or add tests for `ConversationRoute` confirming that `useCatalog()` selection is passed into `ConversationInput` and `apiCreateConversation` is called with `selectedItemId`
- [x] 10.2 Add test confirming `handleSend` is a no-op when `selectedItemId` is `null`
- [x] 10.3 Verify: `npm exec nx test chat` passes

## 11. CatalogContext — Handle removed selectedItemId

- [x] 11.1 Update `apps/chat/src/context/CatalogContext.tsx`: after a successful `getCatalogItems()` call, if `selectedItemId` is non-null and the new `items` array does not include it, reset `selectedItemId` to `items[0]?.id ?? null`
- [x] 11.2 Verify: `npm exec nx test chat` passes (existing CatalogContext tests still pass; add one for the fallback case)

## 12. Final verification

- [x] 12.1 Run `npm exec nx test chat`
- [x] 12.2 Run `npm exec nx lint chat`
- [x] 12.3 Run `npm exec nx test conversation-input`
- [x] 12.4 Run `npm exec nx lint conversation-input`
- [x] 12.5 Run `npm exec nx test chat-api`
- [x] 12.6 Run `npm exec nx lint chat-api`
- [x] 12.7 Run `npm run openapi` and `npm run openapi:check`
- [x] 12.8 Run `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client`
- [ ] 12.9 Manually open the Figma nodes `27:1476` and `27:4520` and verify the selector is in the right-side action group after Optional and before microphone/send/stop, with icon sizes and spacing matching the implementation; attach screenshots to the PR
