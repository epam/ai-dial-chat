## Why

While the deployments list is still being fetched, every conversation row in the panel shows a generic fallback icon because `ConversationPanelView` maps deployment icons to conversations using an empty `deployments` array. This gives a jarring visual flash: incorrect default icons appear, then flip to correct model icons once the fetch resolves. GitHub issue #7520.

## What Changes

- `ConversationHistoryItem` gains an optional `isIconLoading?: boolean` field. When `true`, the conversation row renders a skeleton placeholder in place of the deployment icon instead of the fallback icon.
- `ConversationRow` reads `item.isIconLoading` and conditionally renders an animated skeleton pill instead of `DeploymentIcon`.
- `ConversationPanelView` destructures `isLoading` from `useDeployments()` and propagates it as `isIconLoading` on every mapped `ConversationHistoryItem`.

## Capabilities

### New Capabilities

- `conversation-panel-icon-loading-state`: Loading-state contract for deployment icons in the conversation history panel — defines when a skeleton placeholder is shown and when the real icon (or its fallback) is shown.

### Modified Capabilities

- `conversation-history-panel`: `ConversationHistoryItem` gains `isIconLoading?: boolean`; `ConversationRow` must handle the skeleton branch.

## Impact

- `libs/conversation-panel/src/models/panel-props.ts` — add `isIconLoading` field to `ConversationHistoryItem`
- `libs/conversation-panel/src/components/ConversationGroup/ConversationRow.tsx` — add skeleton branch
- `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` — consume `isLoading` from `useDeployments()` and pass `isIconLoading`
- No API, no routing, no i18n changes
