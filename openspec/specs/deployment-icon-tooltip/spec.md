# Spec: deployment-icon-tooltip

## Purpose

An optional tooltip on the deployment icon, forwarded through icon building into assistant message bubbles.

## Requirements

### Requirement: `DeploymentIcon` accepts an optional `tooltip` prop and displays it on hover

`DeploymentIcon` (in `libs/conversation-input`) SHALL accept an optional `tooltip?: string` prop. When `tooltip` is provided, the badge SHALL be wrapped in a `DialTooltip` that shows `tooltip` on hover and focus. When `tooltip` is absent or `undefined`, the component SHALL render exactly as before with no wrapper element.

#### Scenario: Tooltip shown when prop is provided

- **WHEN** `DeploymentIcon` renders with `tooltip="GPT-4o"`
- **THEN** hovering the icon badge shows a tooltip containing "GPT-4o"

#### Scenario: No tooltip wrapper when prop is absent

- **WHEN** `DeploymentIcon` renders without a `tooltip` prop
- **THEN** no tooltip is shown and the DOM structure is unchanged

---

### Requirement: `buildDeploymentIcon` forwards tooltip to both image and fallback icon

`buildDeploymentIcon` (in `libs/conversation-input/src/utils/deployment.tsx`) SHALL accept an optional `tooltip?: string` fourth parameter. When `tooltip` is provided:

- If a resolved icon URL is present, `tooltip` SHALL be forwarded to `DeploymentIcon`.
- If no icon URL is present, the fallback `FallbackEntityIcon` SHALL be wrapped in a `DialTooltip` showing `tooltip`.

When `tooltip` is absent, both paths SHALL render without any tooltip wrapper.

#### Scenario: Tooltip on image icon via buildDeploymentIcon

- **WHEN** `buildDeploymentIcon` is called with a resolved URL and `tooltip="Claude 3.5"`
- **THEN** hovering the rendered icon shows a tooltip containing "Claude 3.5"

#### Scenario: Tooltip on fallback icon via buildDeploymentIcon

- **WHEN** `buildDeploymentIcon` is called with no URL and `tooltip="Claude 3.5"`
- **THEN** hovering the fallback icon shows a tooltip containing "Claude 3.5"

#### Scenario: No tooltip when fourth argument omitted

- **WHEN** `buildDeploymentIcon` is called without a `tooltip` argument
- **THEN** no tooltip is shown on either the image or fallback icon

---

### Requirement: `AssistantMessageBubble` shows deployment name as icon tooltip

`AssistantMessageBubble` (in `libs/conversation-messages`) SHALL pass `deploymentDisplayName` as the `tooltip` prop of `DeploymentIcon` when the deployment icon is rendered.

#### Scenario: Deployment name tooltip in message bubble

- **WHEN** `AssistantMessageBubble` renders with `deploymentIconUrl` and `deploymentDisplayName="GPT-4o"`
- **THEN** hovering the deployment icon shows a tooltip containing "GPT-4o"

#### Scenario: Tooltip absent when deploymentDisplayName is not provided

- **WHEN** `AssistantMessageBubble` renders with `deploymentIconUrl` but no `deploymentDisplayName`
- **THEN** no tooltip is shown on the deployment icon
