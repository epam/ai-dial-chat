## Context

- `Conversation` (`libs/chat-shared/src/models/chat.ts`) has no `createdAt`. It has only `updatedAt` and `lastActivityDate`, and both change over time.
- Every `Message` has a required ISO `timestamp`. `ConversationLifecycleService` sets it when the conversation is first persisted, and `buildConversationHistory` (`apps/chat-api/src/conversations/utils/conversation-history-builder.ts`) sets it when a completion appends messages.
- The first send runs from `ConversationRoute.tsx`. It navigates to `getConversationRoute(id)` with `state: { conversation: savedConversation }`. `ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`) reads that state as `prefetchedConversation`, then clears it with `navigate(..., { replace: true, state: null })` so a reload does not replay auto-start.
- `ConversationView` already exposes a `topContent` slot, rendered before `messages.map`. `Conversation.tsx` fills it with `ScheduledTaskConversationBanner` for scheduled-task conversations. `AppPreviewChat` fills it with a greeting.
- Date helpers that already exist are not reusable here. `libs/publish-panel/src/utils/format-published-date.ts` and `libs/chat-shared/src/utils/format-last-used.ts` hard-code English. The `Intl.DateTimeFormat` usage in `apps/chat/src/utils/map-scheduled-task-dto.ts` is the closest pattern.
- `apps/chat/src/test-setup.ts` pins `Intl.DateTimeFormat` to `en` when no locale is passed.

## Goals / Non-Goals

**Goals:**
- Show a stable, localized start label above the first message for historical conversations.
- Hide the label for the conversation the user has just created in this page instance.
- Stop edit mode from overwriting the first message's timestamp, so the start time stays stable.

**Non-Goals:**
- Adding `createdAt` to the conversation model or API.
- Per-message timestamps or day separators.
- Ticking over at midnight while the page stays open.
- Showing the label in `AppPreviewChat` or in any lib.

## Decisions

1. **Use `messages[0].timestamp` as the source.**
   - It is already persisted and present for shared and published conversations, and it needs no API change.
   - Alternatives are covered in proposal.md: `createdAt` in the DTO, list metadata, or `updatedAt`.
   - One known gap: deleting message 0 moves the start time. This is accepted (see Risks).

2. **Track "created here" as state captured per `conversationId`.**
   - In `ConversationPage`, add `const [createdHereId, setCreatedHereId] = useState(() => prefetchedConversation ? conversationId : null)`.
   - When `conversationId` changes:
     - if the new navigation carries `prefetchedConversation`, set `createdHereId` to the new id;
     - otherwise, if the new id differs from `createdHereId`, reset `createdHereId` to `null`.
   - The label is hidden when `createdHereId === conversationId`.
   - Why not read `useLocation().state` directly: the page clears it immediately, so the label would pop in a few milliseconds after the first send.
   - Why not compare the timestamp with `Date.now()`: that is a heuristic and is not deterministic.
   - `ConversationPage` may stay mounted across `conversationId` changes (splat route), so the reset on id change is required. Without it, the label would stay hidden after "leave and return".

3. **Render through `topContent`, not a new `ConversationView` prop.**
   - `Conversation.tsx` composes `topContent` as the banner (if any) followed by `<ConversationStartTimestamp …/>`.
   - This keeps `ConversationView` (shared with `AppPreviewChat`) unchanged and automatically excludes the preview chat.
   - The `topContent` `useMemo` gains dependencies on the start ISO string, `createdHereId`, `conversationId`, and the language.

4. **Use a presentational component plus a pure formatter.**
   - `libs/conversation-messages/src/components/ConversationStartTimestamp/ConversationStartTimestamp.tsx` takes `{ timestamp: string }`. It:
     - calls `useTranslation()` and `useLanguage()`;
     - parses the date and returns `null` if it is invalid;
     - calls `formatConversationStart(date, new Date(), language)`;
     - renders `t(ConversationI18nKeys.StartedToday, { time: text })` or `t(ConversationI18nKeys.StartedYesterday, { time: text })` for the relative kinds, and `text` as-is for `Absolute`.

     The formatter stays free of i18n and is unit-testable without `t`. Alternative rejected: passing pre-translated templates into the formatter, which mixes i18n placeholders into a pure date utility.
   - `libs/conversation-messages/src/utils/date-time.ts`:
     - exports an enum `ConversationStartKind { Today = 'today', Yesterday = 'yesterday', Absolute = 'absolute' }`;
     - exports `formatConversationStart(start: Date, now: Date, locale: string): { kind: ConversationStartKind; text: string }`;
     - for `Today` and `Yesterday`, `text` is the localized time;
     - for `Absolute`, `text` is the full localized date and time.
   - Calendar-day comparison builds local `y/m/d` from `getFullYear`, `getMonth`, and `getDate` of `start`, `now`, and `now - 1 day` (using `setDate(-1)` semantics, so DST-safe).
   - Formats:
     - time: `{ hour: 'numeric', minute: '2-digit' }`;
     - absolute: `{ year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }`.
   - All helpers are `const` arrow functions.

5. **Markup and styling.**
   - Markup: `<time dateTime={timestamp} className="self-center text-xs text-secondary">…</time>`.
   - Use the project's existing secondary-text token class; check `tools/tailwind/theme.css` during implementation for the AAA-compliant one.
   - No `aria-live`: it sits inside the `role="log"` region and is present from the initial render of a loaded conversation.

6. **Backend edit mode.**
   - In `CompletionMode.Edit`, build the user message with `makeUserMessage(...)`, then override `timestamp: messages[messageIndex].timestamp ?? userMessage.timestamp`.
   - Applied to every edited index, not only 0. A message's timestamp is its original send time, and special-casing index 0 would be surprising. No message timestamps are displayed today, so nothing else is affected.
   - The frontend edit path in `libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts` already spreads `originalMessage`, which keeps its timestamp. No lib change is needed.

## Risks / Trade-offs

- **[Risk] Deleting the first message moves the start time to the next message.** → Accepted and documented. A future `createdAt` field would remove this. It is low frequency.
- **[Risk] A duplicated or imported conversation shows the original messages' time, not the copy time.** → Acceptable: the label describes when the content was started. Mention this in the PR for product confirmation.
- **[Risk] Recent ICU versions put U+202F (narrow no-break space) before AM/PM.** → Tests compare against `Intl.DateTimeFormat` output computed in the test, or normalize whitespace, never a literal `"11:51 AM"` with a plain space.
- **[Risk] Time zone in CI.** → Tests build dates with the local `new Date(y, m, d, h, min)` constructor rather than UTC ISO strings, so calendar-day logic is zone-independent.
- **[Trade-off] The label does not update at midnight while the page is open.** → It is recomputed on any re-render. This is acceptable for P3.

## Migration Plan

No data migration is needed. Deploy frontend and backend together or in either order:
- old backend plus new frontend: the label works, but an edit of message 0 still moves it;
- new backend plus old frontend: no visible change.

Rollback is a plain revert.

## Open Questions

- Product confirmation of the "hidden only in the creating page instance" rule. The issue leaves the exact condition to product; this design picks the deterministic option.
- Whether overlay or embedded hosts should also show the label. They currently get it automatically, because they render the same conversation page.


## Revision — logic lives in `@epam/ai-dial-conversation-messages`

After review, everything that holds no host knowledge moved from `apps/chat` into `libs/conversation-messages`:

- the date and time formatting (`libs/conversation-messages/src/utils/date-time.ts`, using `Intl` with a caller-supplied `locale`);
- the `useNow` hook;
- the `MessageTimestamp` component (internal, rendered by the bubbles);
- the exported `ConversationStartTimestamp` component, with `labels.today` and `labels.yesterday` templates that default to English.

`Conversation.tsx` renders `ConversationStartTimestamp` from the lib in `topContent`.

`apps/chat` keeps only host-owned knowledge:

- the active language (`useLanguage()`), passed as `locale`;
- the translated templates (`conversation.startedToday` / `conversation.startedYesterday` via `t()`), passed as `labels`;
- the "created in this page instance" rule, derived from router state in `Conversation.tsx`;
- the `hasMessageTimestamps` opt-in.

The app-side `useTimestampLabel` hook, `formatting.ts` utility, types, models and components were removed. The lib imports no i18n, routing or app context.
