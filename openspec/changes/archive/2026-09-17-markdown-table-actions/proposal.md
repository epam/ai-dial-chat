## Why

Assistant-generated Markdown tables are currently read-only in the shared renderer, even though the previous application implementation let users copy and export table data. Restoring those actions in the current architecture gives users a practical way to preserve structured model output without reintroducing the old app-coupled table implementation.

## What Changes

- Add an opt-in table action bar for assistant chat messages with copy-as-CSV, copy-as-TXT, copy-as-Markdown, and download-as-CSV actions, each with a UI-kit tooltip.
- Extract a reusable table header into `@epam/ai-dial-conversation-messages` so hosts can supply `{ label, icon, onClick }` action descriptors instead of building buttons.
- Hide table actions while a message is streaming, matching the existing code-block behavior.
- Preserve the current single semantic `<table>` and activate its already-present sticky header by adding bounded vertical scrolling.
- Pass all action labels and the table scroll-region label from the application, keeping `@epam/ai-dial-chat-shared` host-agnostic.
- Download CSV directly with a deterministic default filename; the old filename-editing modal remains out of scope.
- Add tests for serialization, streaming suppression, accessibility feedback, downloading, RTL, and vertical scrolling.

There are no breaking public API changes; the additions are optional props and labels.

## Capabilities

### New Capabilities

- `markdown-table-actions`: Defines when Markdown table actions are available, how table data is serialized and copied/downloaded, and the accessibility and scrolling behavior required for assistant-generated tables.

### Modified Capabilities

- None.

## Impact

- `libs/chat-shared/src/components/MarkdownRenderer/Table/**`
- `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`
- `libs/chat-shared/src/components/MarkdownRenderer/MDMessageViewer.tsx`
- `libs/conversation-messages/src/components/MessageBubble/**` and its labels model
- `libs/conversation-messages/README.md`
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`
- `apps/chat/src/i18n/locales/en.json`
- `libs/chat-shared/README.md`

No backend, dependency, or generated API changes are required.
