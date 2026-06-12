## 1. `DeploymentIcon` — add `tooltip` prop

- [x] 1.1 Add `tooltip?: string` to `DeploymentIconProps` with JSDoc in [libs/conversation-input/src/components/Input/Icon/DeploymentIcon.tsx](libs/conversation-input/src/components/Input/Icon/DeploymentIcon.tsx)
- [x] 1.2 Import `DialTooltip` from `@epam/ai-dial-ui-kit` in `DeploymentIcon.tsx`
- [x] 1.3 Wrap the badge `<div>` in `<DialTooltip tooltip={tooltip}>` when `tooltip` is defined; render the badge unwrapped when `tooltip` is absent

## 2. `ConversationHistoryItem` — add `iconTooltip` field

- [x] 2.1 Add `iconTooltip?: string` field with JSDoc to `ConversationHistoryItem` in [libs/conversation-panel/src/models/ConversationPanel.ts](libs/conversation-panel/src/models/ConversationPanel.ts)

## 3. `ConversationRow` — wire `iconTooltip` to `DeploymentIcon`

- [x] 3.1 Pass `tooltip={item.iconTooltip}` to `<DeploymentIcon>` in [libs/conversation-panel/src/components/ConversationGroup/ConversationRow.tsx](libs/conversation-panel/src/components/ConversationGroup/ConversationRow.tsx)

## 4. App wiring

- [x] 4.1 Locate where `ConversationHistoryItem` objects are constructed in `apps/chat` and populate `iconTooltip` with the deployment display name
