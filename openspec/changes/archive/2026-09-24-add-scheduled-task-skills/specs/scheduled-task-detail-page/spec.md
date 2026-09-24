## ADDED Requirements

### Requirement: Skill display covers reusable summaries and the active Configuration view

`ScheduledTaskDetailsSummary` and `ScheduledTaskConfigurationSection` SHALL accept optional localized `skillLabel` and resolved `skillDisplayName`; `ScheduledTaskDetailView` SHALL forward its optional skill value and label to Configuration. The host SHALL pass the skill's resolved display name or full raw reference, independent of catalog loading/failure and of `skillUsageEnabled`. No skill SHALL produce no Skill field. Values SHALL be plain text, without a details link. Libraries SHALL perform no lookup or navigation.

The full detail page SHALL render Skill above Instructions in Configuration on desktop and in the mobile Configuration tab, preserving Model in Details. The conversation sources panel SHALL pass the same saved-task metadata to the reusable summary, ordered Model, Skill, Instructions. Skill-only tasks SHALL render without an empty Instructions block or an empty Configuration section. Lookup failure SHALL NOT replace task content with an error screen. The existing detail task state remains the source of truth; no new context is added.

#### Scenario: Present skill resolves to a readable name

- **WHEN** task detail or its conversation sources panel has a saved skill and readable metadata
- **THEN** Skill displays the name above Instructions in the relevant reusable surface

#### Scenario: Deleted unreadable or loading skill metadata

- **WHEN** the saved reference cannot be resolved because it is deleted, unreadable, loading, or lookup failed
- **THEN** the full reference is displayed as text, other task metadata remains visible, and no broken details link appears

#### Scenario: No skill preserves the established view

- **WHEN** a task has instructions and no skill
- **THEN** no Skill label or empty placeholder is rendered and existing Model/Instructions content is unchanged

#### Scenario: Skill-only task on mobile and RTL

- **WHEN** a skill-only task is viewed in a narrow RTL Configuration tab
- **THEN** the Skill field remains visible, wraps its name/reference, inherits direction, and no empty instructions field is shown

## MODIFIED Requirements

### Requirement: Details and Configuration sections render read-only task metadata

The detail page SHALL render a Details section showing the task's description, a "Model or Agent" value (resolved to a display name via the deployments context when possible, falling back to the raw model id), and a "Repeats" schedule label produced by the same formatter logic already used by the list page's `map-scheduled-task-dto.ts` (not duplicated inside `libs/scheduled-tasks`). The detail page SHALL render a Configuration section whose "Instructions" content is the task's `prompt` field, rendered through the same markdown stack chat assistant messages use (`MarkdownRenderer`/`MDMessageViewer` from `@epam/ai-dial-chat-shared`), as static content with no streaming/typewriter effect, and with the same default markdown class names so headings, lists, code blocks, and GFM match chat rendering.

#### Scenario: Details section shows description, model, and schedule

- **WHEN** the task detail loads with `description`, `model`, and a schedule
- **THEN** the Details section shows that description text, a model/agent display value, and a "Repeats" label produced by the shared schedule-label formatter

#### Scenario: Instructions render through the shared markdown stack

- **WHEN** the task's `prompt` contains markdown (headings, lists, a code block, and GFM syntax)
- **THEN** the Configuration section's Instructions render that markdown through `MarkdownRenderer`/`MDMessageViewer`, matching how the same markdown renders in a chat assistant message, with no streaming/typewriter animation applied

#### Scenario: Unresolvable model id falls back to raw id

- **WHEN** the task's `model` id has no matching entry in the deployments context
- **THEN** the Details section displays the raw model id string as the "Model or Agent" value, without throwing

The Configuration section SHALL render an optional Skill field above Instructions using a host-resolved display name or full raw reference. It SHALL hide Skill only when no reference is saved, and hide empty Instructions for a skill-only task. The existing Model location and schedule formatting remain unchanged.

#### Scenario: Read-only skill is independent of metadata availability

- **WHEN** a saved skill cannot be resolved
- **THEN** Configuration displays the raw reference and retains the rest of the task without a broken link or error screen
