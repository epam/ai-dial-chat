## Why

Import notifications identify skipped attachments, but the queue drops their names. The parent app uses a generic workaround; older hosts show a raw placeholder.

## What Changes

Retain optional names on jobs, forward them through the warning label callback, and interpolate them in the app. Add regression coverage and update documentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-import`: queue warnings name every skipped attachment.

## Impact

Touches chat-shared, chat-hooks, conversation-panel, and the app adapter. Existing flow: `libs/chat-hooks/src/conversation/useConversationImport/useConversationImport.ts:498`; workaround: `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx:529`. Libraries retain structured data; i18n stays app-owned. No endpoints, dependencies, or new translation keys.

Alternative: generic text omits names. Optional metadata and a second optional callback argument preserve existing hosts. Revert to roll back.

## Acceptance Criteria

A missing `absent.pdf` is named in both notification and queue while the conversation imports. Multiple names remain scoped to their job. Legacy jobs and export labels still work.
