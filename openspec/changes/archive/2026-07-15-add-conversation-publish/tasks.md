## 1. Backend: shared utility extraction

- [x] 1.1 Extract `getPublicTargetFolder`, `stripPublicTargetFolder`, `getResourceTypePrefix`, `getResourceName` from `apps/chat-api/src/publish/publish.service.ts` into `apps/chat-api/src/publish/publish-target.util.ts` (pure functions, no DI)
- [x] 1.2 Update `publish.service.ts` to import from the new util file; run `npm exec nx test chat-api` to confirm existing catalog publish tests are unaffected

## 2. Backend: conversation publish endpoint

- [x] 2.1 Add `PublishConversationDto` (`folderPath: string`, validated with `IsValidFilePath`) under `apps/chat-api/src/conversations/dto/`
- [x] 2.2 Add `PublishConversationResultDto` (`path`, `folderPath`, `publishedAt`, `publishedBy`) under `apps/chat-api/src/conversations/dto/`
- [x] 2.3 Implement `ConversationPublishService.publish`, building the Core `createPublication` request via the shared util from 1.1, re-fetching the conversation's current title for `name` via a direct own-bucket `DialClientService.getConversation` call (not `ConversationService`'s cross-bucket path resolution, which exists for reading *shared* conversations — see the service's doc comment)
- [x] 2.4 Wire `POST /api/v1/conversations/publish` on a new sibling `ConversationPublishController`, with `@Throttle({ default: { limit: 10, ttl: 60000 } })`, full `@ApiOperation`/`@ApiResponse` coverage (201/400/401/403/404/429/502/503), and `operationId: publishConversation`
- [x] 2.5 Unit tests: successful publish, not-found rejection, Core 403 mapping, unexpected-error mapping (`apps/chat-api/src/conversations/tests/conversation-publish.service.spec.ts`)

## 3. Backend: conversation publish-history endpoint

- [x] 3.1 Implement `getPublishHistory(path)` calling Core's `getPublications` with the caller's own-bucket publication-list scope, filtering by the normalized `resources[].sourceUrl`, stripping `public/` prefix via the shared util, sorted by `publishedAt` descending
- [x] 3.2 Add caching: key `conversation-publish-history:{sourceUrl}`, TTL 60s, invalidated synchronously after a successful publish for the same conversation
- [x] 3.3 Wire `GET /api/v1/conversations/publish-history`, default throttle, `operationId: getConversationPublishHistory`, `@ApiResponse` for 200/400/401/502/503
- [x] 3.4 Unit tests: history for previously-published conversation, empty history, cache hit (no Core call), upstream failure mapping

## 4. OpenAPI regeneration

- [x] 4.1 Run `npm run openapi` and `npm run openapi:check`; confirm `chat-api-client` builds and lints with the new `publishConversation`/`getConversationPublishHistory` operations
- [x] 4.2 Add `apps/chat/src/server-api/conversation-publish.api.ts` thin wrapper around the generated methods

## 5. Lib: generalize publish building blocks

- [x] 5.1 Add `PublishResourceSummary` to `libs/catalog/src/models/publish.ts` (`title`, optional `iconUrl`, optional `version`)
- [x] 5.2 Update `PublishPanelProps` to accept `item?: CatalogItem` / `resource?: PublishResourceSummary` (mutually exclusive), rendering `EntityHeader`+version pill only when `item` is present, otherwise a title-only summary row for `resource`
- [x] 5.3 Update `PublishFooterProps.version` to `version?: string`; submit label stays fixed "Publish" when `version` is `undefined`
- [x] 5.4 Rename `derivePublishState`'s `hasExistingVersionInFolder` input to `hasExistingPublicationInFolder` (mechanical rename, no behavior change); generalize `use-publish-flow.ts` to be generic over `TItem extends { version?: string }` and update all call sites
- [x] 5.5 Update `DetailsPanel`/catalog call sites and existing test files to the renamed/generalized props; `libs/catalog` — 255/255 tests pass, lint clean

## 6. Lib: standalone publish panel shell

- [x] 6.1 Create `StandalonePublishPanel` in `libs/catalog/src/components/PublishPanel/` with: backdrop, `role="dialog"`/`aria-modal`/`aria-label`, `desktop:w-[540px]` sizing, Escape-to-close, header with spacer + title + `DialCloseButton` (disabled while submitting), reusing `PublishPanel` body + `PublishFooter` footer from section 5; exported from `libs/catalog/src/index.ts` along with `usePublishFlow`/`PublishResourceSummary`
- [x] 6.2 Component tests: Close visible and no Back control rendered; Close disabled while submitting; Escape calls `onClose` (and does not when closed); Cancel calls the same `onClose` as Close; Publish calls `onSubmit`; dialog role/aria-label, focus entry/restoration, and inert closed state are covered (`StandalonePublishPanel.spec.tsx`, 10/10 passing)

## 7. App: shared folder hook rename

- [x] 7.1 Rename `apps/chat/src/hooks/catalog/useCatalogPublishFolders.ts` to `apps/chat/src/hooks/publish/usePublishFolders.ts` (no behavior change); update the `CatalogView` call site and its test file
- [x] 7.2 `npm exec nx build/lint chat` clean; `usePublishFolders.spec.ts` + `CatalogView.spec.tsx` — 38/38 tests passing

## 8. App: `PublishConversationPanelContainer`

- [x] 8.1 Create `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` with `{ isOpen, conversationPath, conversationTitle, onClose }`, wiring `usePublishFolders`, `usePublishFlow`, the new `conversation-publish.api.ts` wrapper, and `StandalonePublishPanel`
- [x] 8.2 On successful submit: call `onClose`, `showNotification` (success), and `refreshConversations()` from `ConversationsContext` (via `usePublishFlow`'s `onPublishSuccess`)
- [x] 8.3 On failed submit: keep panel open, surface `derivePublishState`'s submit-error callout (via `usePublishFlow`'s `hasSubmitError`)
- [x] 8.4 Added `allowReplace?: boolean` to `PublishDerivationInput`/`PublishPanelProps`/`StandalonePublishPanelProps` (default `true`, preserving catalog's replace-allowed behavior); container passes `allowReplace={false}` so an existing publication in the selected folder disables submit instead of allowing replace — new `derivePublishState` tests cover both branches

## 9. App: `ConversationPanelView` wiring

- [x] 9.1 Add `pendingPublishConversation: { path: string; title: string } | null` state, retaining the exact selected row data needed by the panel
- [x] 9.2 Add "Publish" `DropdownItem` to `getActions` (`IconUpload`), gated by the existing `isReadonlyItem` check, positioned after Share and before Delete
- [x] 9.3 Conditionally render `PublishConversationPanelContainer` when `pendingPublishConversation` is set (mirroring the `ShareConversationPopoverContainer` conditional-mount pattern — not always-mounted like catalog `DetailsPanel`, since always mounting would eagerly fetch the Organization folder tree on every sidebar render), passing its captured `conversationPath`/`conversationTitle`, an action-trigger focus ref, and `onClose` that clears the pending state; added `IconUpload` to the test file's `@tabler/icons-react` mock — 36/36 `ConversationPanelView` tests passing

## 10. i18n

- [x] 10.1 Add `ConversationPublishI18nKeys` enum (`panelAriaLabel`, `alreadyPublishedWarning`, `successMessage`) to `apps/chat/src/constants/translation-keys.ts`; reuse `ButtonsI18nKeys.Publish` (new, added since no generic "Publish" button key existed) for the row-menu label/panel title/submit label. (An initial `ConversationPanelI18nKeys.PublishLabel` duplicate key was added then removed as dead code per the five-axis review in 12.3 — `ButtonsI18nKeys.Publish` is the one key actually used.)
- [x] 10.2 Add English defaults to `apps/chat/src/i18n/locales/en.json`
- [x] 10.3 No other locale JSON files exist in this repo yet (only `en.json`) — nothing further to add

## 11. Tests

- [x] 11.1 `ConversationPanelView` tests (new `describe('ConversationPanelView — publish')` block): Publish action shown for owned rows, hidden for shared-with-me and published-with-me rows, clicking opens the panel with the right conversation path/title, closing clears pending state — 5 new tests, 36/36 total passing
- [x] 11.2 `PublishConversationPanelContainer` tests: folder selection, submit success (closes + notification + refresh), submit failure (alert callout, panel stays open, no notification/refresh), publish-history mapping into `hasExistingPublicationInFolder`, no history fetch while closed — 6/6 passing. (Folder inline-create optimistic/rollback is exercised by `usePublishFlow`'s own existing unit tests, reused unchanged by this container — not duplicated here.)
- [x] 11.3 RTL: verified structurally — `StandalonePublishPanel` reuses `DetailsPanel`'s exact logical classes (`end-0`, `rtl:-translate-x-full`) with no new physical-direction classes; no dedicated RTL test added, consistent with `DetailsPanel.spec.tsx` itself having none
- [x] 11.4 a11y: `StandalonePublishPanel` explicitly focuses its dialog on open and restores the supplied conversation-row action trigger on close/unmount; component tests cover focus entry, restoration, dialog semantics, Close labeling, disabled-while-submitting, and inert closed state. `ConversationRow` tests cover exposing the concrete action trigger to the app, and the container retains alert-role coverage.
- [x] 11.5 Backend: `conversation-publish.service.spec.ts` covers request shapes, normalized paths containing spaces, not-found/403/unexpected-error mapping, and history mapping/caching (10 tests). `conversation-publish.controller.spec.ts` adds 6 integration tests covering versioned POST/GET routing, session delegation, validation, 201/200 responses, and upstream error status mapping.

## 12. Quality gate

- [x] 12.1 Ran lint/build for all touched projects (`@epam/chat`, `@epam/chat-api`, `@epam/ai-dial-catalog`, `@epam/ai-dial-conversation-panel`, `chat-api-client`) and focused tests for every changed publish/focus boundary: lint has no errors in touched files, all builds and focused tests succeed. The broader chat suite still has 3 pre-existing failures in `apps/chat/src/utils/tests/zip-export.spec.ts` (confirmed via `git diff`/`git status` as untouched by this change and failing for an unrelated fflate/zip reason).
- [x] 12.2 Manually verified against a live running app + DIAL Core backend. Found and fixed during this pass: (1) publish panel backdrop not covering/dimming the still-open conversation sidebar due to a `z-50` tie with `libs/sidebar`'s `SidebarPanel` — bumped to `z-[55]`/`z-[60]`; (2) `path` sent to `POST /api/v1/conversations/publish` was the full `conversations/{bucket}/{name}` id (not bucket-relative), producing a duplicated resource path and a 404 from Core — fixed by stripping the prefix at the `ConversationPanelView` call site before storing pending state; (3) discovered (separately, pre-existing) that catalog toolset publish-history 400s against Core because `getPublications`'s `url` field is a list scope, not a resource filter — fixed in both `PublishService` and `ConversationPublishService` via a new `getPublicationsListScope` helper; (4) swapped the row-menu icon from `IconUpload` to `IconWorldShare` per user feedback. Focus-return-on-close and keyboard/RTL basics confirmed visually in the same session.
- [x] 12.3 Re-ran the five-axis quality review after the path-normalization, controller-coverage, and focus-management fixes; no remaining findings in the conversation-publish diff.
