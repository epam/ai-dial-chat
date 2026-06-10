## Context

`UserMessageBubble` renders `<AttachmentTray attachments={attachments ?? []} />` with no click handler. `AttachmentTray` renders a row of `AttachmentCard` components. The `AttachmentCard` click prop (`onClick`) was added by `attachment-card-click-handler`; `AttachmentTray` does not yet forward it.

The app entry point is `ConversationMessageItem`, which passes `attachments` down through `MessageBubble` → `UserMessageBubble` → `AttachmentTray` → `AttachmentCard`. The `useAttachmentAction` hook (specified and implemented in `attachment-card-click-handler`) lives at the app level and is the single source of truth for what clicking an attachment does.

Library isolation rule: `libs/conversation-input` and `libs/conversation-messages` must not know about BFF URLs, the `useAttachmentAction` hook, or any app concern. All action resolution stays in `apps/chat`.

## Goals / Non-Goals

**Goals:**
- Thread `onAttachmentClick` from the app down to `AttachmentCard` via the existing component hierarchy — no new wrapper components, no bypassing the lib chain.
- Reuse `useAttachmentAction` from `attachment-card-click-handler`; no duplicate download logic.
- Consistent behavior between `ConversationSourcesPanel` and `UserMessageBubble` — both resolve actions through the same hook.

**Non-Goals:**
- Click behavior on `AssistantMessageBubble` attachments — not requested; deferred.
- Any change to the visual layout, card dimensions, or tray scroll behavior.
- Changes to `useAttachmentAction`, `resolveDialFileDownloadUrl`, or the BFF.

## Decisions

### Decision 1: Propagate `onAttachmentClick` as a prop — do not reach through layers

The attachment hierarchy (`MessageBubble` → `UserMessageBubble` → `AttachmentTray` → `AttachmentCard`) already exists. Adding one optional prop at each layer is the correct approach: it keeps each component independently testable and avoids prop drilling hacks like context or render props in a lib that must stay isolated.

**Alternative considered:** Use a React context inside `libs/conversation-messages`. Rejected — libs must not set up app-level contexts, and a context just for this callback adds unnecessary indirection for a two-level prop pass.

### Decision 2: `clickLabel` is a separate, optional prop on `AttachmentTray` and `UserMessageBubble`

Since libs cannot call `useTranslation`, the accessible label for the click action must be injected as a prop. Naming it `clickLabel` on `AttachmentTray` (mirrors `removeLabel`, `retryLabel`) and `attachmentClickLabel` on the message bubble props is consistent with the existing pattern.

Default value: `'Open attachment'` (the same default as `AttachmentCard.clickLabel`) so callers that do not supply a label still produce accessible markup.

### Decision 3: `onAttachmentClick` goes on `UserMessageBubbleProps` only, not `BaseMessageBubbleProps`

`AssistantMessageBubble` does not currently render an `AttachmentTray` and has different affordances (stages, starters, streaming). Placing the prop on `BaseMessageBubbleProps` would imply it is universally applicable, which it is not yet. `MessageBubbleProps` gets the prop forwarded to `UserMessageBubble` only.

**Alternative considered:** put it in `BaseMessageBubbleProps` for future-proofing. Rejected — premature; the assistant bubble does not use it and may need different semantics when it does.

### Decision 4: `ConversationMessageItem` is the only app-level consumer

`ConversationMessageItem` already owns all message rendering decisions. It is the correct place to call `useAttachmentAction()`. The fallback `MessageBubble` rendered while `EditMessageInput` is loading also passes the handler, so the card remains clickable during lazy load.

## Risks / Trade-offs

- **`attachment-card-click-handler` must land first (or simultaneously)**: this change depends on the `AttachmentCard.onClick` prop being available. If the two changes are implemented together, the order of completion within a single branch is: lib changes first (`AttachmentCard`, then `AttachmentTray`), then message bubble changes, then app wiring.
- **Prop threading adds surface area**: each new optional prop on `UserMessageBubble` and `MessageBubble` is a small API surface increase. Since all props are optional with safe defaults, no existing callers break.
