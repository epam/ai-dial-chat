Slicing strategy: **vertical**.
- Slice 1 builds the pure formatter.
- Slice 2 renders the label end to end on the conversation page.
- Slice 3 adds the "created here" visibility rule.
- Slice 4 is the independent backend timestamp fix.

Each slice is verifiable on its own with `npm run test:file -- <path>`. No `libs/*` changes.

## 1. Formatter

- [x] 1.1 Create `libs/conversation-messages/src/utils/date-time.ts` (enum in `libs/conversation-messages/src/types/conversation-start-kind.ts`, result interface in `libs/conversation-messages/src/models/conversation-start.ts`, per the project rules on general utils files and types/models placement):
  - string enum `ConversationStartKind` (`Today`, `Yesterday`, `Absolute`);
  - `const formatConversationStart = (start: Date, now: Date, locale: string) => ({ kind, text })`;
  - local calendar-day comparison;
  - `Intl.DateTimeFormat(locale, …)` for the time and absolute formats, with no `timeZone` option.
- [x] 1.2 Add `libs/conversation-messages/src/utils/tests/date-time.spec.ts`. Cover:
  - today, yesterday, older, and the 23:59 → 00:01 midnight boundary;
  - a year boundary (Jan 1 vs Dec 31);
  - expected strings derived from `Intl.DateTimeFormat` in the test, never literal AM/PM spacing;
  - dates built with the local `new Date(y, m, d, h, min)`.

## 2. Label component and page wiring

- [x] 2.1 Add `ConversationI18nKeys.StartedToday` (`conversation.startedToday`) and `ConversationI18nKeys.StartedYesterday` (`conversation.startedYesterday`) to `apps/chat/src/constants/translation-keys.ts`. Add the values `Today {{time}}` and `Yesterday {{time}}` under `conversation` in `apps/chat/src/i18n/locales/en.json`.
- [x] 2.2 Create `libs/conversation-messages/src/components/ConversationStartTimestamp/ConversationStartTimestamp.tsx`:
  - props `{ timestamp: string }`;
  - returns `null` for an invalid date;
  - renders `<time dateTime={timestamp}>` with `self-center`, `dial-small-text text-secondary` (muted metadata, see `.claude/rules/a11y.md`), and logical or symmetric spacing only;
  - uses `useLanguage()` for the locale.
- [x] 2.3 Add `libs/conversation-messages/src/components/ConversationStartTimestamp/tests/ConversationStartTimestamp.spec.tsx`. Cover:
  - the `<time>` element with the correct `dateTime`;
  - the Today and Yesterday translations;
  - the absolute format;
  - a missing or invalid timestamp rendering nothing.

  Query by role or tag, not `data-testid`.
- [x] 2.4 In `apps/chat/src/pages/Conversation/Conversation.tsx`, extend the `topContent` `useMemo`. Render `ScheduledTaskConversationBanner` (when it applies) followed by `<ConversationStartTimestamp timestamp={conversation.messages[0].timestamp} />` when a first message exists. Add the matching memo dependencies.

## 3. Hide for the conversation just created

- [x] 3.1 In `Conversation.tsx`, add `createdHereId` state:
  - initialize it from `prefetchedConversation ? conversationId : null`;
  - when `conversationId` changes: set it to the new id if the new navigation carries `prefetchedConversation`, otherwise reset it to `null` if the id differs;
  - suppress the label while `createdHereId === conversationId`;
  - add a short block comment explaining why it is captured instead of reading `useLocation().state`, which the page clears.
- [x] 3.2 Extend `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`. Cover:
  - no label when mounted with router `state.conversation`;
  - the label still hidden after the state is cleared and the conversation updates;
  - the label shown when mounted without state;
  - the label shown after switching to another conversation id and back;
  - exactly one `<time>` rendered.
- [x] 3.3 Run `npm run test:file` for the three frontend spec files, then `npm run verify:changed`.

## 4. Backend: keep the timestamp on edit

- [x] 4.1 In `apps/chat-api/src/conversations/utils/conversation-history-builder.ts`, in `CompletionMode.Edit`, set the replacement user message's `timestamp` to the replaced message's `timestamp`, falling back to the new one if it is absent. Leave the other modes and the assistant placeholder unchanged.
- [x] 4.2 Extend `apps/chat-api/src/conversations/utils/conversation-history-builder.spec.ts`. Cover:
  - an edit at index 0 keeps the original timestamp and replaces the content;
  - an edit at a later index keeps that message's timestamp;
  - the assistant placeholder still gets a fresh timestamp.
- [x] 4.3 Run `npm exec nx test chat-api` (scoped to the spec file) and `npm exec nx lint chat-api`.

## 5. Docs and final verification

- [x] 5.1 Check with the `dial-docs` skill whether `docs/` describes the conversation view header area. Update that doc if it does, and do not add a doc if none exists.
- [x] 5.2 Run `npm run validate:specs` (the new spec cites `libs/conversation-messages/src/utils/date-time.ts` and the component path, which must exist after slice 2).
- [ ] 5.3 Manually check in the running app:
  - a new chat shows no label; leaving and returning shows one; a reload shows one;
  - a shared conversation shows a label;
  - `dir="rtl"` keeps it centered;
  - mobile width.
- [ ] 5.4 Run `npm run verify:full` once before opening the PR.

## 6. Follow-ups (out of scope, record only)

- [ ] 6.1 Raise with product: the label in duplicated or imported conversations shows the original content time, and deleting message 0 shifts the start time. Consider a persisted `createdAt` if either becomes a problem.
