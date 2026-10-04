## Context

User message bubbles render `MessageActions` with `role={MessageRole.User}` (`libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx:174`). In that role the toolbar only knows Edit and Delete (`MessageActions.tsx:103`); Copy, its copied-state timer (`COPIED_RESET_MS = 2000`), and the polite status region exist only for the assistant branch (`MessageActions.tsx:65`, `:160`), rendered through `CopyIconButton` from `@epam/ai-dial-chat-shared`.

The app wires handlers in one adapter, `buildMessageActions` (`apps/chat/src/components/ConversationView/utils/build-message-actions.ts`), whose user branch returns `onEdit`/`onDelete` only. Labels are built once per view in `ConversationView.tsx:677-703` and passed down. `ConversationMessageItem.tsx:924` sets `isDisabled: isAssistantTyping` for every toolbar; for user messages that is already moot because `onEdit`/`onDelete` are `undefined` while typing. That adapter serves both the main conversation and `AppPreviewChat`.

## Goals / Non-Goals

**Goals:**
- One-click plain-text copy of `msg.content` on every user message, with tooltip, copied state, and screen-reader announcement.
- Keep the lib host-agnostic and the change additive (no breaking prop changes).

**Non-Goals:**
- Clipboard-failure UI, rich-text copy, attachment copy, or changes to assistant actions (see proposal).
- Translating the assistant toolbar's existing English-only `copiedStatus` announcement (pre-existing gap; worth a separate fix).

## Decisions

1. **Reuse `onCopy` for the User role instead of a new `onCopyMessage` prop.** The role already selects the label set and the button order, and `handleCopy` already owns the copied state + timer. A second prop would duplicate that and let a host pass both. The prop's JSDoc changes from "Agent role only" to "Both roles; label set depends on `role`".

2. **Role-specific labels as new optional fields, not overloading `copy`/`copyResponse`.** `ConversationView` builds one `tooltips`/`ariaLabels` object shared by user and assistant toolbars, so user copy needs its own fields: `tooltips.copyMessage`, `ariaLabels.copyMessage`, `ariaLabels.copiedMessageStatus` (English defaults "Copy message" / "Copy message" / "Message copied to clipboard"). `handleCopy` picks `copiedMessageStatus` vs `copiedStatus` by `role`; the copied tooltip reuses `tooltips.copied` ("Copied!").

3. **Plain text via `copyToClipboard(msg.content)`**, not `copyMarkdownAsRichText`. User bubbles render the content as plain text in a `<p>` with preserved whitespace, so the stored string is exactly what the user entered and what they see. `copyToClipboard` already calls `navigator.clipboard.writeText` synchronously inside the gesture with an `execCommand` fallback (`libs/chat-shared/src/utils/copy-to-clipboard.ts:192`). Using `msg.content` (not the DOM) also covers collapsed long messages and skill-chip segments, which are presentation only.

4. **Button order Copy → Edit → Delete.** Matches the familiar ChatGPT placement and keeps the destructive action last. The toolbar is a flex row, so the order mirrors under `dir="rtl"` with no extra classes; `IconCopy` is symmetric and not flipped.

5. **Copy stays enabled while streaming; scope `isDisabled` to non-user messages in the app.** `ConversationMessageItem` passes `isDisabled: isAssistantTyping && msg.role !== MessageRole.User`. Rejected alternative: exempting copy from `isDisabled` inside the lib — that would break the documented "disables every action button" contract. Since user Edit/Delete are already not rendered while typing, this only affects the new Copy button.

6. **Always supplied, no gate.** `buildMessageActions` sets `onCopy` for every user message regardless of `isEditUserMessageHidden`/`isDeleteUserMessageHidden`/read-only, because copying is non-mutating. Consequence: user messages in read-only conversations, which previously rendered no toolbar (`hasAnyAction` false → `null`), now render a one-button toolbar. This is intended by the issue.

**Lib isolation:** the lib receives a callback and translated strings only; clipboard access, i18n (`useTranslation`), and availability rules stay in `apps/chat` (`buildMessageActions`, `ConversationView`).

**Memoisation:** the new label strings go into the existing `useMemo` blocks for `tooltips`/`ariaLabels` in `ConversationView`. `buildMessageActions` already produces fresh closures per render (as it does for assistant copy); no new `useCallback`/`React.memo` is needed, and `ConversationView.message-memo.spec.tsx` must stay green.

**States:** no loading/empty states. Error state is out of scope (Decision 3's fallback covers non-secure contexts; total failure is silent, same as assistant copy today).

## Risks / Trade-offs

- [Read-only user bubbles gain a toolbar row, slightly changing layout] → It uses the same always-visible toolbar the editable case already shows; verify visually on mobile and desktop.
- [The "Copied!" state shows even if the clipboard write fails] → Same as assistant copy; tracked as a non-goal. `copyToClipboard` returns `Promise<boolean>` if a follow-up wants failure feedback.
- [Hosts that render `MessageActions` for users and already pass `onCopy` would now see a button] → No such caller exists in this repo (`onCopy` was ignored for the User role); README calls out the new behavior.

## Migration Plan

Additive. Ship lib + app in one commit; rollback is a revert. No data, API, or config migration.

## Open Questions

- None blocking. Assumption recorded: "chats with agents" in the issue means every conversation rendered through `ConversationMessageItem` (main chat and app-editor preview), not a specific agent type.
