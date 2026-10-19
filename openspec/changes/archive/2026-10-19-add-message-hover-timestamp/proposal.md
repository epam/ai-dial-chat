## Why

In a long conversation, users cannot tell when an individual message was sent. Every message already carries a server-set `timestamp`, but the UI never shows it. A quiet send time, revealed on hover, answers "when did I ask this?" without cluttering the message list. This is a follow-up to `add-conversation-start-timestamp` (issue #8984), which labels only the conversation start.

## What Changes

> **Revised after review:** the first design put an absolute time above the bubble. Product preferred the pattern below: a relative time in the action row, with the full date in a tooltip.

- On the conversation page, each message (user and assistant) shows its relative send time on the outer edge of its action row: before the buttons for a user message, after them for an assistant response:
  - examples: `now`, `5 minutes ago`, `3 hours ago`, `yesterday`, `2 weeks ago`;
  - the text comes from `Intl.RelativeTimeFormat` and refreshes every minute.
- A UI kit `Tooltip` on the time shows the full date and time (`Oct 19, 2026, 5:25 PM`).
- Visibility:
  - hidden (opacity 0) until the pointer hovers over the message or keyboard focus enters it;
  - always visible on devices without hover;
  - the `<time>` is focusable, so the tooltip can be reached by keyboard.
- **Lib addition (non-breaking):** `MessageActionsProps.leadingContent` and `trailingContent` in `@epam/ai-dial-conversation-messages`, a host slot rendered before the buttons. The lib stays isolated: it receives a ready element and does no formatting or i18n.
- `ConversationView` gains the opt-in prop `hasMessageTimestamps` and forwards it to `ConversationMessageItem` as `hasTimestamp`. `Conversation.tsx` passes it; `AppPreviewChat` does not.
- A missing or unparsable `timestamp` renders nothing.

Not breaking. No new i18n keys, no backend change.

## Problem / Solution / Non-goals

- **Problem:** message send times are invisible.
- **Solution:** an app-level `MessageTimestamp` component (relative text plus an absolute-date tooltip), passed through a new `leadingContent` slot of the lib's `MessageActions`.
- **Non-goals:**
  - an "edited" marker;
  - generation-finished time for assistant messages (the stored `timestamp` is the generation start);
  - day separators;
  - time formatting inside `@epam/ai-dial-conversation-messages`;
  - a user setting to toggle the labels.

## Alternatives considered

- **Absolute time above the bubble, app-only (first iteration):** implemented, then replaced. Product preferred the familiar "3 hours ago" in the action row, with the exact date on demand.
- **A formatted time prop in the lib (for example `timestamp` plus `formatTime`):** rejected. A generic `leadingContent` slot keeps all formatting, tooltip and visibility decisions in the host.
- **Always visible:** rejected per product direction (hover only).
- **Hidden on touch devices:** rejected, because the information would be unreachable on mobile. Recorded as an open question.

## Acceptance criteria

1. Hovering a message, or focusing its time or actions, shows its relative send time; moving away hides it again.
2. Hovering or focusing the time shows the full date and time in a tooltip.
3. On a touch-only device, every message shows its time.
4. The relative text is localized by `Intl` and refreshes every minute.
5. The App Editor preview chat shows no message times.
6. A message without a valid `timestamp` shows no time.

## Capabilities

### New Capabilities
- `message-hover-timestamp`: per-message relative send time, covering:
  - placement in the action row;
  - the tooltip;
  - visibility on hover, focus and touch;
  - the opt-in on `ConversationView`;
  - the `MessageActions` `leadingContent` slot.

### Modified Capabilities
<!-- none -->

## Impact

- **Lib (non-breaking):** `libs/conversation-messages`, covering:
  - `leadingContent` on `MessageActionsProps`;
  - `MessageActions` rendering it, with `items-center` on the toolbar;
  - the README section and tests.

  Host knowledge stays in the app: the lib receives a ready `ReactNode`.
- **Frontend:**
  - new: `libs/conversation-messages/src/components/MessageTimestamp/`, `libs/conversation-messages/src/hooks/useNow/useNow.ts`;
  - `formatRelativeTime` and `formatAbsoluteDateTime` added to `libs/conversation-messages/src/utils/date-time.ts`;
  - `ConversationMessageItem.tsx` (`hasTimestamp` prop);
  - `ConversationView.tsx` (`hasMessageTimestamps` prop, `group/message` wrapper);
  - `Conversation.tsx`;
  - superseded: all formatting, `useNow` and both labels moved into `libs/conversation-messages` (see the design's revision section).
- **Dependency:** builds on the uncommitted `add-conversation-start-timestamp` implementation. Land that change first.
- **Memoisation:** the per-minute tick lives in `MessageTimestamp` only; `ConversationMessageItem` gets a stable boolean prop.
- **i18n:** no new strings.
- **RTL:** the toolbar row already follows the writing direction.
- **Feature flag:** none.
- **Rollback:** revert the commit.
