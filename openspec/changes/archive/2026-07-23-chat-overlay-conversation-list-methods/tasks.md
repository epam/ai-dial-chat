## 1. Protocol types (libs/chat-shared)

- [x] 1.1 Add `GetConversations`, `GetSelectedConversations`, `SelectConversation`, `CreateConversation`, `CreateLocalConversation`, `DeleteConversation`, `RenameConversation` members to `OverlayRequestType` in `libs/chat-shared/src/types/overlay/overlay-protocol.ts` — plain `enum` members, JSDoc each per `.claude/rules/libs.md`.
- [x] 1.2 Add `OverlayConversation` interface (`id`, `title`, `updatedAt`, `isPinned`, `isReadonly`, `sharedWithMe`, `publishedWithMe`) with no dependency on `@epam/chat-api-client` or any app-owned type.
- [x] 1.3 Add `OverlayConversationError` interface (`code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_ARGUMENT'`, `message: string`).
- [x] 1.4 Add request-payload interfaces: `SelectConversationPayload`, `DeleteConversationPayload`, `RenameConversationPayload`, `CreateConversationPayload` (`deploymentId?`, `firstMessage?`).
- [x] 1.5 Add response interfaces: `GetConversationsResponse`, `GetSelectedConversationsResponse`, `SelectConversationResponse`, `CreateConversationResponse` (`conversation: OverlayConversation | null`), `CreateLocalConversationResponse` (`conversation: null`), `DeleteConversationResponse`, `RenameConversationResponse` — each with an optional `error?: OverlayConversationError` per `specs/chat-overlay-protocol/spec.md`, except `GetConversationsResponse`/`GetSelectedConversationsResponse` which carry no `error` field.
- [x] 1.6 **Library-isolation guard:** confirm the file still imports nothing beyond other `libs/chat-shared/src/types/**` files.
- [x] 1.7 Export all new types from `libs/chat-shared/src/index.ts`.
- [x] 1.8 Verify: `npm exec nx build @epam/ai-dial-chat-shared && npm exec nx test @epam/ai-dial-chat-shared && npm exec nx lint @epam/ai-dial-chat-shared`.

## 2. ChatOverlay conversation-list methods (libs/chat-overlay)

- [x] 2.1 Implement `getConversations()` and `getSelectedConversations()` using the existing `send()` machinery (same readiness-gate/timeout path as `getMessages()`).
- [x] 2.2 Implement `selectConversation(id: string)`, `deleteConversation(id: string)`, `renameConversation(id: string, newName: string)`.
- [x] 2.3 Implement `createConversation(options?: { deploymentId?: string; firstMessage?: string })` and `createLocalConversation()`. Confirm neither accepts a `parentPath` or `local` parameter (compatibility break, `specs/chat-overlay-library/spec.md`).
- [x] 2.4 Update `libs/chat-overlay/src/index.ts` to re-export `OverlayConversation`, `OverlayConversationError`, and the new payload/response types alongside the existing re-exports.
- [x] 2.5 Unit tests (`libs/chat-overlay/src/lib/tests/ChatOverlay.spec.ts`): each new method dispatches the correct request type/payload, waits for readiness, times out like existing methods, and resolves/rejects using the mocked response — including a case asserting `createConversation()` (no args) and `createLocalConversation()` post structurally identical payloads (no `firstMessage`).
- [x] 2.6 Verify: `npm exec nx test @epam/ai-dial-chat-overlay && npm exec nx lint @epam/ai-dial-chat-overlay`.

## 3. ChatOverlayManager forwarding

- [x] 3.1 Add `overlayId`-keyed forwarding methods for all seven new methods to `ChatOverlayManager`, matching the existing forwarding pattern for v1 methods.
- [x] 3.2 Unit tests: unknown-`overlayId` throws for each new method; forwarding calls the underlying `ChatOverlay` instance's method with the same arguments.
- [x] 3.3 Verify: `npm exec nx test @epam/ai-dial-chat-overlay && npm exec nx build @epam/ai-dial-chat-overlay`.

## 4. Documentation

- [x] 4.1 Update `libs/chat-overlay/README.md` with the seven new methods, usage examples, and the explicit `createConversation` signature-change/compatibility-break note (`parentPath` dropped, `local` replaced by omitting `firstMessage`).

## 5. App-side: OverlayContext bridge-registration changes

- [x] 5.1 Change `registerActiveConversationBridge`'s signature to `(bridge: ActiveConversationBridge | null, conversationId: string | null)`; add a ref tracking the most recently registered `conversationId`.
- [x] 5.2 Update `useActiveConversationBridge` (`apps/chat/src/hooks/conversation/useActiveConversationBridge.ts`) to pass its `conversationId` through, and to call `registerActiveConversationBridge(null, null)` on unmount.
- [x] 5.3 Add `ConversationListBridge` interface (`getConversations`, `createConversation`, `deleteConversation`, `renameConversation`, `selectConversation`) and `registerConversationListBridge(bridge: ConversationListBridge | null)` to `OverlayContext`, following the same registration/unregistration pattern as the active-conversation bridge.
- [x] 5.4 Add a `CONVERSATION_LIST_REQUEST_TYPES` set (`GetConversations`, `GetSelectedConversations`, `SelectConversation`, `CreateConversation`, `CreateLocalConversation`, `DeleteConversation`, `RenameConversation`), routed through the trusted-origin check and reusing the existing queue-and-expire pending-request mechanism when no conversation-list bridge is registered yet.
- [x] 5.5 Confirm during apply: does `ConversationRoute`/`NewConversationComposer` already accept a pre-selected `deploymentId` via router state? If not, add the minimal plumbing (`design.md` Open Questions) so the composer-opening path can honor `payload.deploymentId`. **Confirmed not present; added:** `ConversationRoute` now reads `location.state?.deploymentId` and calls `restoreSelectedItemId` on mount.

## 6. App-side: conversation-list bridge hook

- [x] 6.1 Create `apps/chat/src/hooks/conversation/useConversationListBridge.ts` (or equivalent), mounted once inside `App` below `ConversationsProvider`/`DeploymentsProvider`, registering/unregistering via `registerConversationListBridge`.
- [x] 6.2 Implement `getConversations()`: map `ConversationsContext.conversations` (`ConversationListItemDto[]`) to `OverlayConversation[]` field-for-field, no forced refresh (`specs/chat-overlay-app-mode/spec.md`).
- [x] 6.3 Implement `deleteConversation(id)`/`renameConversation(id, newName)`: call `ConversationsContext.deleteConversation`/`renameConversation`; catch thrown errors and map via HTTP status (404 → `NOT_FOUND`, 403 → `FORBIDDEN`, else nearest code) using the same pattern as `apps/chat/src/server-api/api-error.ts`'s `isConversationNotFoundError`; reject blank/whitespace `newName` with `INVALID_ARGUMENT` before calling the context method.
- [x] 6.4 Implement `createConversation({ deploymentId, firstMessage })`: when `firstMessage` is non-blank, resolve `deploymentId` (given, else `DeploymentsContext.selectedItemId`), call the same create+save flow `ConversationRoute.handleCreateConversation` uses, navigate to the new route, call `ConversationsContext.refreshConversations()`, and return the created `OverlayConversation` projection. When `firstMessage` is blank/absent, navigate to `ROUTES.Root` with `deploymentId` as router state and return `null`.
- [x] 6.5 Implement `selectConversation(id)`: navigate to `getConversationRoute(id)`; the actual "wait for load" logic lives in `OverlayContext` (task 7.2), this bridge method only performs the create/delete/rename mutations plus the list snapshot read.
- [x] 6.6 Tests: bridge hook unit tests for each method's success and mapped-error paths, using mocked `ConversationsContext`/`DeploymentsContext`/`useNavigate`.
- [x] 6.7 Verify: `npm exec nx test @epam/chat && npm exec nx lint @epam/chat`.

## 7. App-side: OverlayContext request handling for the seven methods

- [x] 7.1 Implement `GET_CONVERSATIONS` handling: call the conversation-list bridge's `getConversations()`, respond `{ conversations }`.
- [x] 7.2 Implement `GET_SELECTED_CONVERSATIONS` handling: use the tracked active-conversation `conversationId` to find a match in the list-bridge snapshot (falling back to a minimal projection built from the active bridge's own data), respond `{ conversations: [...] }` or `{ conversations: [] }` per `specs/chat-overlay-app-mode/spec.md`.
- [x] 7.3 Implement `SELECT_CONVERSATION` handling: call the list bridge's `selectConversation(id)` to navigate, then wait for the tracked `conversationId` to equal the target id (reusing the pending-request queue's `expiresAt` drop semantics) before responding `{ conversation }`.
- [x] 7.4 Implement `CREATE_CONVERSATION`/`CREATE_LOCAL_CONVERSATION` handling per `specs/chat-overlay-app-mode/spec.md`: `firstMessage` present → call the list bridge's persisted create path and respond once created; absent/blank → call the composer-navigation path and respond immediately with `{ conversation: null }`.
- [x] 7.5 Implement `DELETE_CONVERSATION`/`RENAME_CONVERSATION` handling: call the list bridge, respond with the bridge's mapped success/error result.
- [x] 7.6 Confirm `CONVERSATIONS_UPDATED` continues to fire solely through `ConversationsContext`'s existing list-changed effect (no second emission path added), and `SELECTED_CONVERSATION_LOADED` continues to fire solely through `ConversationPage`/`ConversationRoute`'s existing `notifyConversationLoaded()` calls.
- [x] 7.7 Tests: `OverlayContext` unit tests covering every scenario in `specs/chat-overlay-app-mode/spec.md`'s new/modified requirements — bridge registration/unregistration, queued-request expiry, `getSelectedConversations` empty/one-item/just-created cases, `selectConversation` accessible/inaccessible, `createConversation` persist vs. composer paths, delete/rename success and each mapped error code, blank-`newName` pre-validation.
- [x] 7.8 Verify: `npm exec nx test @epam/chat && npm exec nx lint @epam/chat`.

## 8. Sandbox: conversation-list case

- [x] 8.1 Create a new sandbox case (e.g. `apps/chat-overlay-sandbox/src/cases/ConversationListCase/ConversationListCase.tsx`) with Direct and Manager sections, importing from `@epam/ai-dial-chat-overlay` only.
- [x] 8.2 Implement the minimum UI from `specs/chat-overlay-sandbox/spec.md`: Get conversations, Get selected conversations, Create conversation (optional deployment-id + first-message inputs), Create local conversation, conversation-id input/selector populated from the last Get-conversations result, Select/Rename/Delete by id, Refresh list, and an `EventLog`-based response log.
- [x] 8.3 Add the new case to the case index in `apps/chat-overlay-sandbox/src/app/app.tsx`.
- [x] 8.4 Add Vitest component tests asserting each action calls the mocked `ChatOverlay`/`ChatOverlayManager` method with the expected arguments (including the create-with/without-firstMessage distinction).
- [x] 8.5 **Library-isolation guard:** confirm the new case imports `@epam/ai-dial-chat-overlay` by package name, not a relative path into `libs/chat-overlay/src`.
- [x] 8.6 Verify: `npm exec nx build chat-overlay-sandbox && npm exec nx test chat-overlay-sandbox && npm exec nx lint chat-overlay-sandbox`.

## 9. Final verification

- [x] 9.1 Run `npm exec nx affected --target=build --base=origin/development-1.0`. All 19 affected projects build cleanly.
- [x] 9.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0`. 0 errors (pre-existing unrelated warnings only).
- [x] 9.3 Run `npm exec nx affected --target=test --base=origin/development-1.0`. 145 test files / 1618 tests pass (2 pre-existing skips).
- [x] 9.4 Confirm no backend/OpenAPI drift: this change touches no `apps/chat-api` files, so `npm run openapi:check` should show no diff. Confirmed: `git status --porcelain apps/chat-api` is empty and `npm run openapi:check` produced no output/diff.
- [x] 9.5 Confirm no `libs/chat-overlay` or `libs/chat-shared` source file imports anything from `apps/*` (library-isolation final check across both touched libs). Confirmed via grep — no matches.
