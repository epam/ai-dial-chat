# Delta: scheduled-task-detail-page

## MODIFIED Requirements

### Requirement: Detail page header shows back navigation and title, plus Active/Delete/Edit actions once loaded

The detail page header SHALL render a back-navigation control and the task's `displayName` as its title on the start side. The title SHALL ellipsize instead of stretching the header: capped at 600px on every breakpoint (phones never reach the cap and truncate at the row edge; tablets and the desktop header stop the line at 600px), shrinking below the cap on narrower viewports, and rendering its text through the kit's `EllipsisTooltip` (`@epam/ai-dial-ui-kit`) so the full name appears in a tooltip only when actually clipped and remains the heading's accessible name while clipped. Exactly one copy of the title is visible at any width — inline in the header at the desktop breakpoint, in a standalone row below it on mobile/tablet. Activating the back control SHALL navigate to `ROUTES.ScheduledTasks`. Once the task has loaded successfully and `task.isDeleted` is not `true`, the header SHALL additionally render, on the inline-end side, in this order:

1. an **Active** switch (`Switch` from `@epam/ai-dial-ui-kit`) with a visible localized "Active" label, rendered only when `isActive !== undefined` on the loaded task, never an unchecked switch while the active state is unknown;
2. a destructive **Delete** action (`GhostButton` from `@epam/ai-dial-ui-kit` with `variant={ButtonVariant.Danger}`, a leading `IconTrashX` marked `aria-hidden`, and a visible localized "Delete" label). Activating Delete SHALL open the confirmation dialog described in the "Delete confirmation dialog gates the delete request" requirement — it SHALL NOT call any API directly;
3. a `NeutralButton` (`@epam/ai-dial-ui-kit`) with a pencil icon (`IconPencilMinus` from `@tabler/icons-react`) and a localized "Edit" label. Activating Edit SHALL navigate to `getScheduledTaskEditRoute(scheduleId)` for the task currently being viewed;
4. a localized **Start now** button with a decorative play icon, invoking the manual-run action described above.

When `task.isDeleted` is `true`, the header SHALL render none of the Active switch, Delete action, Edit button, or Start now button — only the back control, title, and the read-only deleted-state indicator described in the "Soft-deleted task renders as a read-only deleted state" requirement. The header SHALL render a localized Start now button after Edit as specified by the manual-run requirements, and SHALL NOT render Start now, the Edit button, Active switch, or Delete action while the task is loading or failed to load. While a delete request is in flight (`isDeleting` is `true`), the Active switch, Delete action, Edit button, and Start now button SHALL all render disabled rather than absent.

#### Scenario: Back control returns to the list

- **WHEN** the user activates the back control on the detail page
- **THEN** the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Header shows back, title, Active switch, Delete, and Edit in order once the task has loaded

- **WHEN** the detail page renders with a successfully loaded, non-deleted task whose `isActive` is defined
- **THEN** the header contains a back control and the task's `displayName` on the start side, and on the end side — in order — the Active switch, a destructive Delete action with a visible "Delete" label, and a `NeutralButton` with `IconPencilMinus` and a localized "Edit" label

#### Scenario: Long title ellipsizes with a tooltip instead of stretching the header

- **WHEN** the loaded task's `displayName` is longer than the title's 600px cap (or longer than the width remaining in a narrower header)
- **THEN** the title renders on one line with an ellipsis, the action buttons stay in place, and hovering the clipped title shows the full name in a tooltip — while a title that fits its line shows no tooltip

#### Scenario: Edit, Active, and Delete are absent while loading or on error

- **WHEN** the detail page is still fetching the task, or the task fetch has failed
- **THEN** the header does not render the Edit button, the Active switch, or the Delete action

#### Scenario: Activating Edit navigates to the edit route for the current task

- **WHEN** the user activates the Edit button while viewing `/scheduled-tasks/sched_123`
- **THEN** the app navigates to `getScheduledTaskEditRoute('sched_123')`, which resolves to `/scheduled-tasks/sched_123/edit`

#### Scenario: Edit button is keyboard accessible

- **WHEN** a keyboard user tabs to the Edit button and presses Enter or Space
- **THEN** the same navigation occurs as with a pointer click, and the button exposes an accessible name of "Edit" (or the localized equivalent)

#### Scenario: Activating Delete opens the confirmation dialog without calling the API

- **WHEN** the user activates the Delete action
- **THEN** the confirmation dialog opens and no `deleteScheduledTask` call is made

#### Scenario: Header actions are disabled, not removed, while a delete is in flight

- **WHEN** `isDeleting` is `true`
- **THEN** the Active switch, Delete action, and Edit button all render in a disabled state and none of their activation handlers fire

#### Scenario: Deleted task header shows only back, title, and the deleted indicator

- **WHEN** the loaded task has `isDeleted: true`
- **THEN** the header shows the back control, the title, and the deleted-state indicator, and none of the Active switch, Delete action, or Edit button render

#### Scenario: Start now follows Edit

- **WHEN** the loaded task is not deleted and the host supplies the start action
- **THEN** the header displays Start now after Edit, with eligibility and pending behavior defined by the manual-run requirements

#### Scenario: Start now is absent during task load failure or deletion

- **WHEN** task details are loading, failed, or soft-deleted
- **THEN** Start now is absent along with the other unavailable task actions

### Requirement: Details and Configuration sections render read-only task metadata

The detail page SHALL render a Details section showing the task's description, a "Model or Agent" value (resolved to a display name via the deployments context when possible, falling back to the raw model id), and a "Repeats" schedule label produced by the same formatter logic already used by the list page's `map-scheduled-task-dto.ts` (not duplicated inside `libs/scheduled-tasks`). The description SHALL preserve the author's line breaks and wrap ordinary words whole, breaking a token only when it cannot fit a line by itself (`overflow-wrap: anywhere`, not `break-all`, which would chop ordinary words at the column edge); it renders at the field-value step (`dial-small-text`) with its own ink chained through the theme's `--text-primary` (dark-theme safe, `#1b212d` as the last-resort fallback) and overridable through the view's `styles.colors.descriptionText`. The detail page SHALL render a Configuration section whose "Instructions" content is the task's `prompt` field, rendered through the same markdown stack chat assistant messages use (`MarkdownRenderer`/`MDMessageViewer` from `@epam/ai-dial-chat-shared`), as static content with no streaming/typewriter effect, at the compact prose step — paragraphs and list items alike at `dial-small-paragraph-text` (14px/24px) — via a lib-scoped `MarkdownRendererClassNames` record spread from `COMPACT_MARKDOWN_CLASS_NAMES` (see `libs/scheduled-tasks/src/components/ScheduledTaskConfigurationSection/ScheduledTaskConfigurationSection.tsx`); the shared presets in `libs/chat-shared/src/components/MarkdownRenderer/markdown-class-names.ts` SHALL remain untouched so chat rendering is unaffected. A host-supplied `renderInstructions` owns its own classNames, and these are ignored.

#### Scenario: Details section shows description, model, and schedule

- **WHEN** the task detail loads with `description`, `model`, and a schedule
- **THEN** the Details section shows that description text, a model/agent display value, and a "Repeats" label produced by the shared schedule-label formatter

#### Scenario: Description wraps words whole and breaks only unbreakable tokens

- **WHEN** the task's `description` contains ordinary multi-word prose and a token longer than the column width (a long URL)
- **THEN** the prose wraps at word boundaries with no mid-word breaks, the long token breaks only where it cannot fit a line by itself, and the author's line breaks are preserved

#### Scenario: Instructions render through the shared markdown stack at the compact prose step

- **WHEN** the task's `prompt` contains markdown (headings, lists, a code block, and GFM syntax)
- **THEN** the Configuration section's Instructions render that markdown through `MarkdownRenderer`/`MDMessageViewer` with no streaming/typewriter animation, with paragraphs and list items at the 14px/24px prose step, and with the shared default presets unchanged so the same markdown renders identically in chat assistant messages

#### Scenario: Host-supplied renderInstructions owns the rendering

- **WHEN** the host passes `renderInstructions`
- **THEN** the instructions render through that callback and the lib's scoped classNames record is not applied
