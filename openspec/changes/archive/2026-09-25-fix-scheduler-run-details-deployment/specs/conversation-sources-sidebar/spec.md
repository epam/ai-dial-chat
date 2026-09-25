## MODIFIED Requirements

### Requirement: Details section shows resolved model and rendered instructions

For a scheduled-task conversation, the panel SHALL render a Details section built from a shared, host-agnostic presentational component (`ScheduledTaskDetailsSummary`, `libs/scheduled-tasks`) showing:

- **Model**: the deployment that executed THIS run — the run conversation's own model id (`conversation.assistantModelId || conversation.model.id`, the same value the Conversation page passes as `initialModelId`), published through `SourcesSidebarContext` alongside the messages the page already publishes — resolved to its deployment display name via the deployments context (`findDeploymentByIdOrReference` + `resolveLocalizedText`), falling back to the raw model id when unresolved. The schedule's current `model` SHALL NOT be the source: it names the deployment of the latest saved settings, which a later edit may have changed after this run fired (issue #9045). While the run conversation is still loading (no model id published yet), the Model field SHALL be omitted rather than showing another value.
- **Instructions**: the task's prompt/instructions rendered through the same shared markdown renderer (`MDMessageViewer` from `@epam/ai-dial-chat-shared`) used by `ScheduledTaskDetailView` and chat assistant messages — raw markdown SHALL NOT be shown as plain text, and no separate markdown implementation SHALL be introduced.

The Details section SHALL NOT render edit controls. It is a concise summary; the "Task details" navigation (see `scheduled-task-conversation-context`) remains the path to the full task view.

#### Scenario: Model resolves to the deployment that executed the run

- **WHEN** the run conversation's `model.id` matches a known deployment
- **THEN** the Details section shows that deployment's display name, not the raw id

#### Scenario: Divergence from the schedule's current model

- **WHEN** the schedule's current `model` names a deployment different from the one in the run conversation's `model.id` (the schedule was edited after this run fired)
- **THEN** the Details section shows the run conversation's deployment, not the schedule's current model

#### Scenario: Unresolvable model falls back to the raw id

- **WHEN** the run conversation's `model.id` does not match any known deployment
- **THEN** the Details section shows the raw model id

#### Scenario: Model field is omitted while the conversation loads

- **WHEN** the run conversation is still loading and no model id has been published yet
- **THEN** the Details section omits the Model field rather than showing another value

#### Scenario: Instructions render as formatted markdown

- **WHEN** the task's instructions contain markdown syntax (e.g. lists, bold text)
- **THEN** the Details section renders that formatting via `MDMessageViewer`, not as an escaped/plain-text string

#### Scenario: No edit affordance is present

- **WHEN** the Details section is inspected
- **THEN** no edit button, input, or other mutation control is rendered
