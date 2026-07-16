## Why

In the conversation sources sidebar (the panel showing all Uploaded Files and Generated Files for a conversation), the "Download all" button in the top-right corner is hardcoded `disabled` with no `onClick` handler, so users can never download attachments from that panel even when files are present ([GitHub #7766](https://github.com/epam/ai-dial-chat/issues/7766)). Individual attachment cards inside the panel already support click-to-download; the bulk action is the only broken entry point.

## What Changes

- Add an `onDownloadAll?: () => void` callback prop to `ConversationSourcesPanelProps` (`libs/source-panel/src/models/conversation-sources-panel-props.ts`).
- In `libs/source-panel/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`, wire the top-right Download button to that callback instead of a hardcoded `disabled` literal: `disabled={!onDownloadAll}`, `onClick={onDownloadAll}`.
- In the app container (`apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`), implement and pass `onDownloadAll`, downloading every attachment currently listed in `uploaded` and `generated` by reusing the existing per-attachment download mechanism already used by `useAttachmentAction().handleAttachmentClick` (DIAL-hosted file URLs only; reference-only/non-downloadable attachments are skipped, matching single-click behavior).
- The button remains disabled only when there is nothing to download (no downloadable attachments among `uploaded`/`generated`), consistent with the existing panel-level empty state.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `conversation-sources-sidebar`: the Download-all button in the sources panel must be enabled and functional whenever downloadable attachments are present, instead of being unconditionally disabled.

## Impact

- `libs/source-panel/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`
- `libs/source-panel/src/models/conversation-sources-panel-props.ts`
- `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`
- `apps/chat/src/hooks/attachment/useAttachmentAction.ts` (reused, possibly extended to expose a reusable single-file download function)
- No API, schema, or i18n key changes required (`labels.downloadAllLabel` already exists and is already wired to `aria-label`).
