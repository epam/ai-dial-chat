# Spec: deployment-icon-tooltip

## Purpose

An optional tooltip on the deployment icon, forwarded through icon building into assistant message bubbles.

## Requirements

### Requirement: `DeploymentIcon` accepts an optional tooltip label and displays it on hover

`DeploymentIcon` (in `libs/chat-shared/src/components/DeploymentIcon/DeploymentIcon.tsx`, exported from `@epam/ai-dial-chat-shared`) SHALL accept an optional `labels?: DeploymentIconLabels` prop whose `tooltip?: string` field carries the tooltip text. When `labels.tooltip` is a non-empty string, the badge SHALL be wrapped in the ui-kit 2.0 `Tooltip` (`triggerClassName="flex shrink-0"`) that shows it on hover and focus. When `labels.tooltip` is absent, `undefined`, or empty, the component SHALL render the bare badge with no wrapper element.

#### Scenario: Tooltip shown when prop is provided

- **WHEN** `DeploymentIcon` renders with `labels={{ tooltip: "GPT-4o" }}`
- **THEN** hovering the icon badge shows a tooltip containing "GPT-4o"

#### Scenario: No tooltip wrapper when prop is absent

- **WHEN** `DeploymentIcon` renders without `labels.tooltip`
- **THEN** no tooltip is shown and the DOM structure is unchanged

---

### Requirement: `buildDeploymentIcon` forwards tooltip to both image and fallback icon

`buildDeploymentIcon(resolvedIconUrl, type, displayName, size = 18, tooltip?)` (in `libs/conversation-input/src/utils/deployment.tsx`) SHALL accept an optional `tooltip?: string` fifth parameter and SHALL always render a single `DeploymentIcon` with `src={resolvedIconUrl}`, `initialsName={displayName}`, and `labels={{ tooltip }}`. Because `DeploymentIcon` itself falls back to an `InitialsAvatar` when no URL is present (or the image fails to load), the same tooltip SHALL apply to both the image and the initials fallback.

When `tooltip` is absent, both paths SHALL render without any tooltip wrapper.

#### Scenario: Tooltip on image icon via buildDeploymentIcon

- **WHEN** `buildDeploymentIcon` is called with a resolved URL and `tooltip="Claude 3.5"`
- **THEN** hovering the rendered icon shows a tooltip containing "Claude 3.5"

#### Scenario: Tooltip on fallback icon via buildDeploymentIcon

- **WHEN** `buildDeploymentIcon` is called with no URL and `tooltip="Claude 3.5"`
- **THEN** hovering the initials fallback icon shows a tooltip containing "Claude 3.5"

#### Scenario: No tooltip when the tooltip argument is omitted

- **WHEN** `buildDeploymentIcon` is called without a `tooltip` argument
- **THEN** no tooltip is shown on either the image or fallback icon

---

### Requirement: `AssistantMessageBubble` shows deployment name as icon tooltip

`AssistantMessageBubble` (in `libs/conversation-messages/src/components/MessageBubble/AssistantMessageBubble.tsx`) SHALL render `DeploymentIcon` (size 28) whenever `deploymentIconUrl` or `deploymentDisplayName` is set, and SHALL pass `labels={{ tooltip: deploymentDisplayName ?? deploymentIconFallbackLabel }}`, where `deploymentIconFallbackLabel` is a labels prop defaulting to `'AI'`.

#### Scenario: Deployment name tooltip in message bubble

- **WHEN** `AssistantMessageBubble` renders with `deploymentIconUrl` and `deploymentDisplayName="GPT-4o"`
- **THEN** hovering the deployment icon shows a tooltip containing "GPT-4o"

#### Scenario: Fallback label used as tooltip when deploymentDisplayName is not provided

- **WHEN** `AssistantMessageBubble` renders with `deploymentIconUrl` but no `deploymentDisplayName`
- **THEN** hovering the deployment icon shows a tooltip containing `deploymentIconFallbackLabel` (default "AI")

---

### Requirement: Model selector trigger shows a tooltip when the selected deployment is unavailable

`useModelSelector` (in `libs/conversation-input/src/hooks/useModelSelector.tsx`) SHALL detect when `selectedDeploymentId` does not resolve to an entry in `deployments` (and the selector is not in its loading state, i.e. `modelSelectorLabels.loading` is undefined), and in that case SHALL pass `modelSelectorLabels?.unavailableTooltip ?? 'This deployment is no longer available'` as the `tooltip` argument (fifth parameter) to `buildDeploymentIcon` for the trigger icon. `ModelSelectorLabels` SHALL expose an optional `unavailableTooltip?: string` field for this purpose. When the selected deployment resolves normally, or while `deployments` is loading, no such tooltip SHALL be applied.

#### Scenario: Tooltip shown for an unavailable selected deployment

- **WHEN** `selectedDeploymentId` is set to an id that is not present in `deployments`, and loading has finished
- **THEN** hovering or focusing the trigger's initials fallback icon shows a tooltip reading `modelSelectorLabels.unavailableTooltip`, defaulting to "This deployment is no longer available" when the label is not supplied

#### Scenario: No unavailable tooltip while loading or when resolved

- **WHEN** the selector is loading, or `selectedDeploymentId` resolves to an item in `deployments`
- **THEN** no "unavailable" tooltip is applied to the trigger icon
