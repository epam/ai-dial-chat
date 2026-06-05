## 1. Backend — Pin Endpoint, isPinned in List, Delete Cleanup (apps/chat-api)

> ✅ Implemented. Pins stored at `conversation-pins.json` in the DIAL Core appdata bucket (falling back to the conversation bucket). List merges pins in parallel. Delete cleans up pins fire-and-forget.

- [x] 1.1 Add `apps/chat-api/src/conversations/dto/pin-conversation.dto.ts` with `PinConversationDto { path: string, isPinned: boolean }` — `path` is the full DIAL Core resource URL (`ConversationListItemDto.id`)
- [x] 1.2 Add `isPinned: boolean` field to `ConversationListItemDto` in `dto/conversation-list.dto.ts`
- [x] 1.3 Add private `getPinnedIds(token, prefsBucket): Promise<string[]>` to `ConversationService` — downloads `conversation-pins.json` via `client.downloadFile`, parses response, returns `pinnedIds` array; returns `[]` on non-ok response, parse error, or thrown exception
- [x] 1.4 Add private `savePinnedIds(pinnedIds: string[], token, prefsBucket): Promise<void>` — uploads via `client.uploadFile` using `body: { file: new Blob([JSON.stringify(...)]) }` so openapi-fetch constructs a valid `multipart/form-data` request with the correct boundary (required by DIAL Core Files API); checks `{ error }` in the SDK response and calls `handleDialError` if set
- [x] 1.5 Add `pinConversation(conversationId, isPinned, token, bucket, appdata): Promise<void>` — derives `prefsBucket = appdata || bucket`; reads current pins, adds/removes the id, writes back
- [x] 1.6 Update `listConversations(token, bucket, appdata, ...)` to derive `prefsBucket = appdata || bucket`, call `getPinnedIds` in parallel with the DIAL Core metadata call (`Promise.all`); set `isPinned: pinnedSet.has(id)` on each item
- [x] 1.7 Update `deleteConversation(conversationPath, token, bucket, appdata)` to fire-and-forget `pinConversation(id, false, ..., appdata)` after deletion to remove the id from pins; id reconstructed as `conversations/${bucket}/${conversationPath}`
- [x] 1.8 Add `@Patch('pin')` handler in `ConversationController` — destructures `{ at, bucket, appdata }` from `req.user` and passes all three to `conversationService.pinConversation`
- [x] 1.9 Add `appdata?: string` to `SessionPayload`; add `appdata: string` to `SessionUser`; `SessionGuard` captures `appdata` from `getUserBucket` (alongside `bucket`) and stores it in the session cookie (`appdata ?? ''` when DIAL Core does not return one); re-resolves for sessions that pre-date this change (`payload.appdata === undefined`)

## 2. Generated API Client — Regenerate (libs/chat-api-client)

- [x] 2.1 Spec generated via `npm run openapi:spec` — `PinConversationDto`, updated `ConversationListItemDto`, and `PATCH /api/v1/conversations/pin` present in `libs/chat-api-client/openapi.json`
- [x] 2.2 Run `npm run openapi:sdk` to regenerate TypeScript client (requires `cross-env` in shell PATH — run manually: `! npm run openapi:sdk`)
- [x] 2.3 Confirm `ConversationsApi` includes `patchConversationPin({ pinConversationDto })` method and `ConversationListItemDto` has `isPinned`

## 3. Library — Hover Actions via Dropdown (libs/conversation-panel)

> ✅ Implemented with significant design evolution from the original proposal.

- [x] 3.1 Replace individual action props with a single `getActions?: (item: ConversationHistoryItem) => DropdownItem[]` callback on `ConversationPanelProps` and `ConversationGroupProps` — app builds the items, lib is action-agnostic
- [x] 3.2 Extract `ConversationRow` to `libs/conversation-panel/src/components/ConversationGroup/ConversationRow.tsx` — owns `isMenuOpen` state so trigger stays visible while menu is open
- [x] 3.3 `ConversationRow` uses `DialGhostButton` (UI kit) for the selection row and `DialDropdown` wrapping `DialIconButton` (UI kit) for the `IconDotsVertical` trigger — no raw `<button>` elements
- [x] 3.4 Actions container: `opacity-0 group-hover:opacity-100`, stays `opacity-100` when `isMenuOpen` is true
- [x] 3.5 Trigger button styled via `.trigger` / `.triggerIcon` SCSS classes using `--cp-trigger-bg` → `--controls-bg-accent-secondary-alpha-active` (#37BABC5C) and `--cp-trigger-icon` → `--text-accent-secondary` (#37BABC) following the three-tier CSS var convention
- [x] 3.6 All icon sizes use `DIAL_ICON_SIZE.SM` (16px) from `@epam/ai-dial-ui-kit`
- [x] 3.7 `ConversationPanel.tsx` threads `getActions` and `actionsLabel` to both `ConversationGroup` instances
- [x] 3.8 Build passes (`npm exec nx build @epam/ai-dial-conversation-panel`)

## 4. App — Wiring, Confirmation & Context Mutations (apps/chat)

> ✅ Implemented.

- [x] 4.1 Add `pinConversation(conversationId, isPinned)` wrapper to `apps/chat/src/server-api/conversations.api.ts` calling `conversationsApi.patchConversationPin` (depends on 2.2)
- [x] 4.2 Add `pinConversation(id, isPinned): Promise<void>` mutation to `ConversationsContext` — optimistic local update, awaits API call, reverts update on failure with `console.error`
- [x] 4.3 Add `deleteConversation(id)` mutation to `ConversationsContext` — optimistic removal, derives API path via `getConversationPath(normalizeConversationId(id))`, re-throws on error
- [x] 4.4 Add `refreshConversations()` to `ConversationsContext` — re-fetches the full list; called in `ConversationPanelView` when `activeConversationId` changes to an id not in the list (handles newly created conversations appearing)
- [x] 4.5 Add i18n keys to `translation-keys.ts`: `ActionsLabel`, `PinLabel`, `UnpinLabel`, `DeleteLabel`, `DeleteConfirmTitle`, `DeleteConfirmDescription`
- [x] 4.6 Add English strings to `apps/chat/src/i18n/locales/en.json`
- [x] 4.7 `ConversationPanelView` builds `getActions` callback returning Pin/Unpin (`IconPin`/`IconPinnedFilled`) and Delete (`IconTrashX`) items; all icons `text-secondary`
- [x] 4.8 `ConversationPanelView` owns `pendingDeleteId` state and renders `DialConfirmationPopup` (danger variant); conversation title displayed in `text-primary font-medium`; navigation to `ROUTES.ROOT` fires before the API call when deleting the active conversation
- [x] 4.9 Build passes (`npm exec nx build @epam/chat`)

## 5. Tests

> ✅ 34 test files pass (all tests).

- [x] 5.1 `conversation.service.spec.ts` — `pinConversation`: uploads to appdata bucket, adds new id, adds to existing list, deduplicates, removes on unpin, no-op unpin for unknown id, falls back to user bucket when appdata is empty, propagates network error, propagates DIAL Core non-ok status (9 tests)
- [x] 5.2 `conversation.service.spec.ts` — `getPinnedIds`: returns `[]` on non-ok response, on thrown exception, on invalid JSON, on non-array `pinnedIds`; returns array on valid response (5 tests)
- [x] 5.3 `conversation.service.spec.ts` — `listConversations with pins`: sets `isPinned: true` on matching items, `isPinned: false` on non-matching, `isPinned: false` on all when pins empty (3 tests)
- [x] 5.4 `conversation.controller.integration.spec.ts` — `PATCH /conversations/pin`: 204 for valid pin, 204 for valid unpin, 400 for missing path, 400 for missing isPinned, 400 for non-boolean isPinned, 400 for empty body (6 tests)
- [x] 5.5 `session.guard.spec.ts` — lazy resolution: resolves appdata alongside bucket, resolves appdata for sessions that pre-date the field, stores `''` when DIAL Core omits appdata, stores provided appdata value, skips fetch when both bucket and appdata already resolved (5 tests)
