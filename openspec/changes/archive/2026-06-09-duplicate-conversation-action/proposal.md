## Why

Shared and organization conversations are read-only, leaving users unable to iterate on them. A duplicate action lets users fork any conversation into their own bucket so they can edit it freely. Additionally, the current read-only banner (a passive notification) doesn't guide users toward this escape hatch — replacing it with an actionable center-of-screen button makes the path obvious.

## What Changes

- Add a **Duplicate** item to the conversation row dropdown (three-dot menu) for all conversations.
- Call the backend duplicate API when the action is triggered; on success, navigate to the new conversation.
- In the read-only conversation view, replace the `<DialNotification>` banner with a centered action button that shows a duplicate icon and the label "Duplicate the conversation to be able to edit it".
- Add i18n keys for both the row action label and the centered-button label.

## Capabilities

### New Capabilities

- `duplicate-conversation`: End-to-end duplicate capability — row dropdown action, backend API call, read-only overlay button with i18n.

### Modified Capabilities

<!-- No existing spec-level behavior changes -->

## Impact

- `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` — add Duplicate to `getActions`
- `apps/chat/src/server-api/conversations.api.ts` — add `duplicateConversation` API call
- `apps/chat/src/context/ConversationsContext.tsx` — expose `duplicateConversation` action
- `apps/chat/src/components/ConversationView/ConversationView.tsx` — replace `DialNotification` read-only banner with centered duplicate action button
- `apps/chat/src/i18n/locales/en.json` and `translation-keys.ts` — new duplicate i18n keys
- No breaking changes; no new dependencies.
