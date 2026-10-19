## Context

- Every `Message` has a required ISO `timestamp`, set by the server:
  - for a user message, its send time; edits keep it, since `add-conversation-start-timestamp`;
  - for an assistant message, the generation start.
- `ConversationView` renders each message as `<div key ref={setMessageRef}>` around the memoised `ConversationMessageItem`. `ConversationView` is shared by `Conversation.tsx` and `AppPreviewChat.tsx`.
- `ConversationMessageItem` renders `MessageBubble` (`@epam/ai-dial-conversation-messages`) and passes it `actions`. The lib renders those actions as a `MessageActions` toolbar under the bubble. The app passes `hasAlwaysVisibleActions={!isStreaming}`, so the toolbar is always visible, and the lib's own `group-hover` reveal is effectively unused here.
- The first iteration of this change put an absolute time above the bubble. Review asked for the familiar pattern instead: `3 hours ago` in the action row, with the exact date in a tooltip.

## Goals / Non-Goals

**Goals:**
- Show a relative, self-refreshing send time in each message's action row on the conversation page, with an absolute-date tooltip.
- Reveal it on hover or focus, and always show it on touch devices.
- Keep the lib free of host knowledge: no formatting, i18n or visibility policy in `conversation-messages`.

**Non-Goals:**
- An "edited" indicator.
- The generation-end time.
- Showing the time in the preview chat.
- Day separators.

## Decisions

1. **Generic `leadingContent` and `trailingContent` slots on `MessageActions`.**
   - What it is: `MessageActionsProps.leadingContent?: ReactNode`, rendered first inside the toolbar row.
   - `trailingContent` mirrors it after the buttons. The user toolbar is end-aligned and the assistant toolbar start-aligned, so the time goes on the outer edge: leading for a user message, trailing for an assistant response.
   - The toolbar renders when only a slot is set, so a read-only message can still show its time.
   - The toolbar gains `items-center`, so text aligns with the icon buttons. The buttons share one height, so their layout is unaffected.
   - Rejected: a typed `timestamp` plus `formatTime` API in the lib. It would pull formatting and locale policy into the lib and still need a tooltip and visibility props.
   - The slot flows through the existing `MessageBubble` `actions` prop, so the bubble components need no change.

2. **The app renders `MessageTimestamp` in `ConversationMessageItem`.**
   - The new prop `hasTimestamp` (default `false`) adds `<MessageTimestamp timestamp={msg.timestamp} />` to the `actions` object: as `leadingContent` for a user message, and as `trailingContent` for an assistant response. The component uses symmetric `px-1` padding, so it spaces correctly on either side.
   - `ConversationView` forwards its `hasMessageTimestamps` prop as `hasTimestamp`. Only `Conversation.tsx` sets it.
   - The per-message wrapper keeps `group/message` for the reveal. The earlier `relative` positioning is no longer needed.

3. **Relative text plus a tooltip.**
   - `formatRelativeTime(date, now, locale)` lives in `libs/conversation-messages/src/utils/date-time.ts`:
     - it uses `Intl.RelativeTimeFormat(locale, { numeric: 'auto' })`;
     - it picks the largest whole unit (year 365d, month 30d, week, day, hour, minute), so the output reads `yesterday` or `last year` naturally;
     - anything under a minute, or slightly in the future from clock skew, returns `now`.
   - `formatAbsoluteDateTime(date, locale)`, also in `formatting.ts`, gives the tooltip text and is now shared with `formatConversationStart`.
   - No i18n keys are needed: `Intl` localizes both.
   - The `<time tabIndex={0}>` is wrapped in the kit 2.0 `Tooltip` with `asChild`, so `aria-describedby` lands on the `<time>` itself.

4. **Per-minute refresh scoped to the label.**
   - `useNow(intervalMs)` (`libs/conversation-messages/src/hooks/useNow/useNow.ts`) owns one `setInterval` per mounted label and clears it on unmount.
   - Only `MessageTimestamp` re-renders each minute. `ConversationMessageItem`'s memo sees a stable boolean prop.
   - Rejected: a shared ticker context. One interval per visible message is cheap at chat scale, and a context would add a provider for a single consumer.

5. **CSS-only reveal.** The visibility classes are:
   - `opacity-0` by default;
   - `group-hover/message:opacity-100` and `group-focus-within/message:opacity-100` to reveal on hover or focus;
   - `[@media(hover:none)]:opacity-100` so touch devices always show it;
   - `transition-opacity` for a fade.

   Opacity keeps the element in the accessibility tree and focusable, and focusing it reveals it through `focus-within`.

6. **The start label keeps its own hook.**
   - Superseded by the revision below: the former app hook `useTimestampLabel` was removed; `ConversationStartTimestamp` in the lib formats the start label itself.
   - The earlier `TimestampLabelMode.MessageTime` mode was removed, because message times no longer use the calendar-day format.

## Risks / Trade-offs

- **[Risk] A focusable `<time>` inside `role="toolbar"`.** The toolbar has no roving tab index, so it is one extra Tab stop per message. → Accepted: it is needed for keyboard access to the tooltip.
- **[Risk] On touch devices, the tooltip does not open,** because the kit renders nothing on touch-only devices. → The relative text is always visible there, and the absolute value stays in `dateTime`.
- **[Risk] Month and year buckets are approximate (30d / 365d).** → Acceptable for relative wording; the exact value is in the tooltip.
- **[Risk] `MessageBubble.spec.tsx` has an unrelated failure.** It expects `start-0`, but the class is now `inset-s-0`, after a recent lint-rule commit. → This change does not touch it; flag it separately.

## Migration Plan

The change is frontend-only, plus a non-breaking optional lib prop. Land it after `add-conversation-start-timestamp`. Roll back by reverting.

## Open Questions

- Product: should the time on touch devices be always visible (current behavior) or hidden?


## Revision — logic lives in `@epam/ai-dial-conversation-messages`

After review, everything that holds no host knowledge moved from `apps/chat` into `libs/conversation-messages`:

- the date and time formatting (`libs/conversation-messages/src/utils/date-time.ts`, using `Intl` with a caller-supplied `locale`);
- the `useNow` hook;
- the `MessageTimestamp` component (internal, rendered by the bubbles);
- the exported `ConversationStartTimestamp` component, with `labels.today` and `labels.yesterday` templates that default to English.

`MessageBubble` gains `timestamp`, `locale` and `styles.timestampClassName`. `UserMessageBubble` and `AssistantMessageBubble` carry the `group/message` hover group and place the time in their `MessageActions` `leadingContent` (user) or `trailingContent` (assistant), keeping any host slot content beside it. `ConversationMessageItem` passes `timestamp={hasTimestamp ? msg.timestamp : undefined}` and `locale`.

`apps/chat` keeps only host-owned knowledge:

- the active language (`useLanguage()`), passed as `locale`;
- the translated templates (`conversation.startedToday` / `conversation.startedYesterday` via `t()`), passed as `labels`;
- the "created in this page instance" rule, derived from router state in `Conversation.tsx`;
- the `hasMessageTimestamps` opt-in.

The app-side `useTimestampLabel` hook, `formatting.ts` utility, types, models and components were removed. The lib imports no i18n, routing or app context.
