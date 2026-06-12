## Why

Conversation rows display a deployment icon but provide no way for users to identify which agent or model the icon represents without reading the conversation title. Adding a tooltip on the icon gives users immediate, accessible context on hover or focus.

## What Changes

- `DeploymentIcon` gains an optional `tooltip` prop; when provided, the icon is wrapped in a `DialTooltip` that shows the text on hover/focus.
- `ConversationHistoryItem` gains an optional `iconTooltip?: string` field — the consuming app supplies the deployment display name.
- `ConversationRow` reads `item.iconTooltip` and forwards it to `DeploymentIcon`.

## Capabilities

### New Capabilities

- `deployment-icon-tooltip`: `DeploymentIcon` accepts an optional `tooltip` prop and renders a `DialTooltip` around the badge when the prop is present.

### Modified Capabilities

- `conversation-history-panel`: `ConversationHistoryItem` gains `iconTooltip?: string`; `ConversationRow` forwards it to `DeploymentIcon`.

## Impact

- `libs/conversation-input` — `DeploymentIcon` component and its props interface.
- `libs/conversation-panel` — `ConversationHistoryItem` model and `ConversationRow` component.
- `apps/chat` — must pass `iconTooltip` (deployment display name) when building `ConversationHistoryItem` objects.
