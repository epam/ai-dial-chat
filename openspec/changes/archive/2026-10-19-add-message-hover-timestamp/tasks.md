Slicing strategy: **vertical**. The first iteration (an absolute time above the bubble) was implemented and then revised after review. The tasks below describe the delivered design. Each slice can be verified with `npm run test:file -- <path>`.

Prerequisite: the `add-conversation-start-timestamp` implementation is present.

## 1. Formatting and refresh

- [x] 1.1 Add `formatRelativeTime` and `formatAbsoluteDateTime` to `libs/conversation-messages/src/utils/date-time.ts`. `formatConversationStart` reuses `formatAbsoluteDateTime`.
- [x] 1.2 Extend `libs/conversation-messages/src/utils/tests/date-time.spec.ts` to cover:
  - `now` (including clock skew);
  - minutes, hours, `yesterday`;
  - weeks, months, `last year`;
  - the absolute format.
- [x] 1.3 Create `libs/conversation-messages/src/hooks/useNow/useNow.ts` with tests in `libs/conversation-messages/src/hooks/useNow/tests/useNow.spec.ts`, covering:
  - the initial value;
  - one tick per interval;
  - cleanup on unmount.
- [x] 1.4 Revert `apps/chat/src/hooks/conversation/useTimestampLabel.ts` to start-label-only: drop the message-time mode enum from `libs/conversation-messages/src/types/conversation-start-kind.ts`, and update `ConversationStartTimestamp` and the hook spec.

## 2. Lib slot (`libs/conversation-messages`)

- [x] 2.1 Add `leadingContent?: ReactNode`, with JSDoc, to `MessageActionsProps` in `libs/conversation-messages/src/models/message-actions.ts`.
- [x] 2.2 In `libs/conversation-messages/src/components/MessageActions/MessageActions.tsx`:
  - render `leadingContent` first in the toolbar;
  - count it toward `hasAnyAction`;
  - add `items-center` to the row.
- [x] 2.3 Extend `libs/conversation-messages/src/components/MessageActions/tests/MessageActions.spec.tsx` to cover:
  - leading content before the buttons;
  - leading content alone.
- [x] 2.4 Document `leadingContent` in `libs/conversation-messages/README.md` (MessageActions section), then run `npm run validate:docs`.
- [x] 2.5 Add `trailingContent`, rendered after the buttons and counted toward `hasAnyAction`, with a test and the README.
- [x] 2.6 Architecture guard: the lib receives a ready `ReactNode` only, with no formatting, i18n, time, or host imports.

## 3. App wiring

- [x] 3.1 Rewrite `libs/conversation-messages/src/components/MessageTimestamp/MessageTimestamp.tsx`:
  - a focusable `<time>` with the relative text from `useNow(60_000)`;
  - wrapped in the kit `Tooltip` (`asChild`) showing the absolute date;
  - the reveal classes from the design;
  - renders `null` for an invalid timestamp.
- [x] 3.2 Rewrite `libs/conversation-messages/src/components/MessageTimestamp/tests/MessageTimestamp.spec.tsx` to cover:
  - `dateTime` and `tabIndex`;
  - `3 hours ago`;
  - the per-minute refresh;
  - an invalid or empty timestamp;
  - the reveal classes.
- [x] 3.3 In `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`, add a `hasTimestamp` prop that sets `actions.leadingContent` for user messages and `actions.trailingContent` for assistant responses. Add tests to `apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx`:
  - the time is inside the toolbar;
  - no time is rendered by default.
- [x] 3.4 In `apps/chat/src/components/ConversationView/ConversationView.tsx`:
  - forward `hasMessageTimestamps` as `hasTimestamp`;
  - the wrapper keeps `group/message`;
  - remove the above-bubble rendering.

  Update `apps/chat/src/components/ConversationView/tests/ConversationView.message-timestamps.spec.tsx` to assert the forwarding.
- [x] 3.5 `apps/chat/src/pages/Conversation/Conversation.tsx` passes `hasMessageTimestamps`. `apps/chat/src/pages/ApplicationEditor/setup/AppPreviewChat.tsx` stays untouched.
- [x] 3.6 Run Nx lint and typecheck for `chat` and `@epam/ai-dial-conversation-messages`, plus the touched spec files.

## 4. Verification

- [ ] 4.1 Check in the running app:
  - hovering a message shows the relative time in its action row, only for that message;
  - hovering or focusing the time shows the full date;
  - Tab reaches the time;
  - touch emulation shows all times;
  - RTL;
  - mobile width;
  - the App Editor preview shows no times.
- [x] 4.2 Run `npm run validate:specs` and `openspec validate add-message-hover-timestamp`.

## 5. Follow-ups (record only)

- [ ] 5.1 Ask product whether touch devices should always show the time (current) or hide it.
- [ ] 5.2 Fix the unrelated `libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx` failure (it expects `start-0`; the class is now `inset-s-0`) in its own change.

## 6. Move host-agnostic logic into the lib

- [x] 6.1 Move date formatting (`libs/conversation-messages/src/utils/date-time.ts`), `useNow` (`libs/conversation-messages/src/hooks/useNow/useNow.ts`), `MessageTimestamp` and `ConversationStartTimestamp` into `libs/conversation-messages`, along with their tests.
- [x] 6.2 Add `timestamp`, `locale` and `styles.timestampClassName` to the bubble props. The bubbles place the time on the outer edge of `MessageActions` and carry `group/message`. Add `libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.timestamp.spec.tsx`.
- [x] 6.3 Export `ConversationStartTimestamp` with its props and labels types, and document the new API in `libs/conversation-messages/README.md`.
- [x] 6.4 App: `ConversationMessageItem` passes `timestamp` and `locale`; `Conversation.tsx` renders the lib `ConversationStartTimestamp` with translated `labels`. Remove the app-side duplicates.
- [x] 6.5 Run Nx lint and typecheck (`chat`, `@epam/ai-dial-conversation-messages`), the lib and app specs, and `npm run validate:docs`.
