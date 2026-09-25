Slicing strategy: **contract-first, then vertical.** Slice A adds the additive `createdAt` contract (safe to ship alone). Slice B delivers the user-visible collapsing end to end on the existing row visuals. Slice C is the breaking lib restyle, gated on the design check, with the host mapping updated in the same slice. Each slice is independently verifiable and revertible.

## 1. Preconditions

- [x] 1.1 Confirm against the Figma file: task icon glyph, unread title weight token, trailing-dot size/color, and dot-vs-actions-trigger behavior on hover; confirm the two product assumptions in `design.md` Open Questions (pinned runs exempt, active-run substitution). Record the answers in `design.md` (D4, D7) and adjust the `conversation-history-panel` / `scheduled-task-conversation-grouping` delta specs if an answer differs. Blocks group 4 only.

## 2. Slice A — `createdAt` on conversation list items (backend + client)

- [x] 2.1 Add optional `createdAt?: number` with `@ApiPropertyOptional` (example + description) and `@IsOptional @IsNumber` to `ConversationListItemDto` in `apps/chat-api/src/conversations/dto/conversation-list.dto.ts`.
- [x] 2.2 In `apps/chat-api/src/conversations/listing/conversation-listing.service.ts` `mapItems`, copy `item.createdAt` onto the list item only when it is a finite number (omit otherwise); leave the shared-resources mapping without `createdAt` and leave the `updatedAt` sort unchanged.
- [x] 2.3 Unit tests in `apps/chat-api/src/conversations/listing/tests/conversation-listing.service.spec.ts`: user-bucket item exposes `createdAt`; public-bucket item exposes it; missing value is omitted (property absent, not `0`); shared item has none; ordering still by `updatedAt`.
  - Verification: `npm run test:file -- apps/chat-api/src/conversations/listing/tests/conversation-listing.service.spec.ts`
- [x] 2.4 Regenerate the client: `npm run openapi`, then `npm run openapi:check`; build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Confirm `ConversationListItemDto.createdAt?: number` in `libs/chat-api-client/openapi.json` and the generated model. No change is needed in `apps/chat/src/server-api/conversations.api.ts` or `api-client.ts` (same operation).
- [x] 2.5 Slice verification: `npm run verify:changed`.

## 3. Slice B — collapse task runs to one panel row (host)

- [x] 3.1 Create `apps/chat/src/utils/collapse-scheduled-task-conversations.ts` exporting `collapseScheduledTaskConversations(items, { activeConversationId, conversationIdsMatch })` per the `scheduled-task-conversation-grouping` spec: group key `bucket/scheduleId` (bucket parsed from the decoded id's segment after `conversations`), pinned runs exempt, active-run substitution, ordering `createdAt` → `updatedAt` → `id` desc, input order preserved, no mutation. JSDoc explains why the full list must stay in the context. Extensionless relative imports; follow the pure-helper style of `apps/chat/src/utils/map-scheduled-task-run-dto.ts`.
- [x] 3.2 Unit tests in `apps/chat/src/utils/tests/collapse-scheduled-task-conversations.spec.ts` covering every scenario in the grouping spec: several runs → newest by `createdAt`; `createdAt` beats `updatedAt`; fallback to `updatedAt` then `id`; two tasks stay separate; same `scheduleId` in different buckets stays separate; non-task items untouched and in order; pinned runs kept; active older run substitutes; removing the representative promotes the next; last run removed → no row; frozen input not mutated.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/collapse-scheduled-task-conversations.spec.ts`
- [x] 3.3 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, derive `panelItems` with `useMemo(() => collapseScheduledTaskConversations(items, { activeConversationId, conversationIdsMatch }), [items, activeConversationId])` and pass `panelItems` to `useConversationPanelItems` only; keep passing the full `items` to `useActiveConversationSync` and every other consumer. Add a short block comment stating that the panel list is a display derivation.
- [x] 3.4 Extend `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`: three runs of one task render one row (queried by its title/link role); an ordinary conversation still renders; deleting the visible run shows the next run's row; with the route on an older run, that run's row is the one rendered as current.
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`
- [x] 3.5 Regression check that consumers still see the full list: add a test to `apps/chat/src/utils/tests/map-scheduled-task-run-dto.spec.ts` (create if absent) or the existing `ActiveScheduledTaskContext` test asserting an older run (absent from the collapsed panel) still resolves `isUnread` and `TaskConversation` status from the context list.
  - Verification: `npm run test:file -- <the spec file touched>`
- [x] 3.6 Slice verification: `npm run verify:changed`.

## 4. Slice C — task row restyle (libs + host mapping, BREAKING)

Depends on 1.1.

- [x] 4.1 `libs/conversation-panel/src/models/panel-props.ts`: add `ConversationItem.leadingIcon?: ReactNode` (JSDoc: replaces the deployment avatar, decorative, host-owned meaning); update the `isUnread` JSDoc (trailing dot + heavier title); remove `showTaskBadge`, `taskBadgeLabel`, `ConversationColors.taskBadgeBorder|taskBadgeBackground|taskBadgeText`, `ConversationPanelStyles.taskBadgeClassName`. Remove `taskBadgeClassName` from `libs/conversation-panel/src/models/virtual-row.ts`, `RowRenderer.tsx`, and the `--cp-task-badge-*` vars in `ConversationPanel.tsx`.
- [x] 4.2 `libs/conversation-panel/src/components/ConversationRow/ConversationRow.tsx` + `ConversationPanel.module.scss`: render `leadingIcon` in the avatar's footprint when set; remove the 12×12 pre-avatar unread slot and the `.taskBadge` styles; render the unread dot at the trailing edge (before the actions trigger) with the `sr-only` label and `aria-hidden` dot, keep `--cp-unread-dot`; apply the heavier title class when `isUnread`; extend the `getButtonPaddingEnd` logic so title, dot, and trigger never overlap. Tokens per 1.1.
- [x] 4.3 RTL: use only logical utilities/properties for the dot and padding (`ms-*`/`me-*`, `pe-*`, `end-*`, `margin-inline-*`); do not mirror the task icon. Add RTL assertions to the row tests (dot is at the inline end under `dir="rtl"`).
- [x] 4.4 Update `libs/conversation-panel/src/components/ConversationRow/tests/ConversationRow.spec.tsx`: replace the TASK-badge tests; add leading-icon-replaces-avatar, no-icon-unchanged, unread trailing dot with "Unread" accessible text, heavier title when unread, read row has no dot and no reserved slot, dot click falls through to row selection, long title + dot + actions do not overlap (class/padding assertion), RTL. Query by role/label/text.
  - Verification: `npm run test:file -- libs/conversation-panel/src/components/ConversationRow/tests/ConversationRow.spec.tsx`
- [x] 4.5 Architecture guard for `libs/conversation-panel`: confirm no schedule/task/feature-flag/i18n/route/app-context knowledge was introduced (the lib only knows `leadingIcon: ReactNode` and `isUnread: boolean`).
- [x] 4.6 `libs/chat-hooks/src/conversation/useConversationPanelItems/useConversationPanelItems.ts`: replace `resolveTaskBadge` with `resolveTaskPresentation?: (item) => { leadingIcon?: ReactNode; isUnread: boolean } | undefined` and copy both fields onto the item; type-only `ReactNode` import. Architecture guard: no UI-kit/icon/i18n/app imports added.
- [x] 4.7 Update `libs/chat-hooks/src/conversation/useConversationPanelItems/tests/useConversationPanelItems.spec.ts`: presentation copied unchanged; omitted resolver → both fields undefined; three runs of one task → three items (no collapsing in the hook).
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationPanelItems/tests/useConversationPanelItems.spec.ts`
- [x] 4.8 Host mapping in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`: replace `resolveTaskBadge` with a memoised `resolveTaskPresentation` (`useCallback`) that returns `{ leadingIcon: the `ScheduledTasksIcon` in its tinted 24×24 box (per design D7), isUnread }` for `isScheduledTask` items; drop `taskBadgeLabel`. Update `ConversationPanelView.spec.tsx` so a task row shows no "TASK" text and exposes the "Unread" label when unread.
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`
- [x] 4.9 i18n cleanup: remove `conversationPanel.taskBadgeLabel` from `apps/chat/src/i18n/locales/en.json` (and any other locale files that carry it) and `ConversationPanelI18nKeys.TaskBadgeLabel` from `apps/chat/src/constants/translation-keys.ts`. No new keys.
- [x] 4.10 Docs in the same commit: `libs/conversation-panel/README.md` (remove badge props/colors/class, document `leadingIcon`, new `isUnread` rendering, migration note); `libs/chat-hooks/README.md` (`resolveTaskPresentation` example and props table at the current `resolveTaskBadge` section). Check `docs/architecture.md` for any description of the task badge or list contract and update it if present. Run `npm run validate:docs`.
- [x] 4.11 Slice verification: `npm run verify:changed`; `npm run build:quiet` (lib public API and styles changed).

## 5. Close-out

- [x] 5.1 Run `npm run verify:full` once.
- [x] 5.2 Follow-up (out of scope, record only): consider promoting `collapseScheduledTaskConversations` into `libs/chat-hooks` if a second DIAL-Core host needs the same panel rule; consider search matching over hidden runs if product asks.
