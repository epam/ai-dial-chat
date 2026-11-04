## MODIFIED Requirements

### Requirement: Details and Configuration sections render read-only task metadata

The detail page SHALL render a Details section showing the task's description, a "Model or Agent" value (resolved to a display name via the deployments context when possible, waiting during catalog loading, marking absence from a successfully loaded catalog unavailable, and falling back to the raw id only on catalog failure), and a "Repeats" schedule label produced by the same formatter logic already used by the list page's `map-scheduled-task-dto.ts` (not duplicated inside `libs/scheduled-tasks`). The description SHALL preserve the author's line breaks and wrap ordinary words whole, breaking a token only when it cannot fit a line by itself (`overflow-wrap: anywhere`, not `break-all`, which would chop ordinary words at the column edge); it renders at the field-value step (`dial-small-text`) with its own ink chained through the theme's `--text-primary` (dark-theme safe, `#161b2d` as the last-resort fallback) and overridable through the view's `styles.colors.descriptionText`. The detail page SHALL render a Configuration section whose "Instructions" content is the task's `prompt` field, rendered through the same markdown stack chat assistant messages use (`MarkdownRenderer`/`MDMessageViewer` from `@epam/ai-dial-chat-shared`), as static content with no streaming/typewriter effect, at the compact prose step — paragraphs and list items alike at `dial-small-paragraph-text` (14px/24px) — via a lib-scoped `MarkdownRendererClassNames` record spread from `COMPACT_MARKDOWN_CLASS_NAMES` (see `libs/scheduled-tasks/src/components/ScheduledTaskConfigurationSection/ScheduledTaskConfigurationSection.tsx`); the shared presets in `libs/chat-shared/src/components/MarkdownRenderer/markdown-class-names.ts` SHALL remain untouched so chat rendering is unaffected. A host-supplied `renderInstructions` owns its own classNames, and these are ignored.

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

#### Scenario: Unresolvable model id falls back to raw id

- **WHEN** the deployments catalog fails to load and the task's `model` cannot be resolved
- **THEN** the Details section displays the raw model id without falsely claiming deletion

#### Scenario: Model missing from a successfully loaded catalog

- **WHEN** catalog loading succeeds but the stored model has no ID or reference match
- **THEN** the Details section displays the decoded final segment with ` (unavailable)`, error text color, pointer cursor and an explanatory tooltip

The Configuration section SHALL render an optional Skill field above Instructions using host-resolved names and availability from the scheduled-task-resource-availability capability. It SHALL hide Skill while its selected references are resolving or when none are saved, and hide empty Instructions for a skill-only task. The existing Model location and schedule formatting remain unchanged.

#### Scenario: Read-only skill is independent of metadata availability

- **WHEN** a saved skill cannot be resolved
- **THEN** Configuration waits for metadata, distinguishes confirmed unavailability from a temporary lookup failure, and retains the rest of the task without a broken link or error screen

### Requirement: Details show independent metadata and load states

The app SHALL use trigger-only descriptions and host-resolved model display names with unavailable presentation after a successful catalog lookup and stored-id fallback only on catalog failure. It SHALL preserve explicit not-found/retry states already required by the detail specification. History initial and incremental errors SHALL be separate from task loading; later-page failure SHALL preserve runs.

#### Scenario: Model name is resolved for display

- **WHEN** a task model id resolves to a deployment with a display name
- **THEN** details show that name; catalog loading hides the field, a confirmed missing model uses unavailable presentation, and catalog failure preserves the raw-id fallback.

#### Scenario: Task not-found never becomes a blank page

- **WHEN** getScheduledTask returns 404
- **THEN** the existing NotFound content renders.

#### Scenario: History retry does not erase task details or prior runs

- **WHEN** task details and first history page succeeded but the next runs request fails
- **THEN** details and runs remain visible and the retry targets only the failed history page.

### Requirement: Skill display covers reusable summaries and the active Configuration view

`ScheduledTaskDetailsSummary` and `ScheduledTaskConfigurationSection` SHALL accept optional localized `skillLabel` and resolved `skillDisplayNames: string[]`; `ScheduledTaskDetailView` SHALL forward its optional skill value and label to Configuration. The host SHALL pass resolved names with optional `renderSkillName` and `renderModelName` callbacks for availability presentation; it SHALL pass an empty skill array while any selected reference is resolving. Confirmed unavailable references and temporary failures SHALL be distinguished as defined by scheduled-task-resource-availability. No skill SHALL produce no Skill field. Values SHALL have no details link; unavailable values SHALL include localized tooltips. Libraries SHALL perform no lookup or navigation.

The full detail page SHALL render Skill above Instructions in Configuration on desktop and in the mobile Configuration tab, preserving Model in Details. Below 1280px the Details/Configuration/History tab bar SHALL stay pinned to the top of the tab scroller (sticky, on the page background) while the active panel scrolls beneath it, and the title row, tab bar and tab panel SHALL use 16px inline gutters. The conversation sources panel SHALL pass the same saved-task metadata to the reusable summary, ordered Model, Skill, Instructions. Skill-only tasks SHALL render without an empty Instructions block or an empty Configuration section. Lookup failure SHALL NOT replace task content with an error screen. The page root SHALL clip overflow: the active mobile tab owns the body scrollbar, while the desktop body is a non-wrapping clipped row whose Details, Configuration, and History columns scroll independently beneath the fixed header. The existing detail task state remains the source of truth; no new context is added.

#### Scenario: Present skill resolves to a readable name

- **WHEN** task detail or its conversation sources panel has a saved skill and readable metadata
- **THEN** Skill displays the name above Instructions in the relevant reusable surface

#### Scenario: Deleted unreadable or loading skill metadata

- **WHEN** the saved reference cannot be resolved because it is deleted, unreadable, loading, or lookup failed
- **THEN** pending skill metadata hides the Skill field; HTTP 400/403/404 produces the unavailable presentation; other settled failures retain the full-reference fallback; other task metadata remains visible and no broken details link appears

#### Scenario: No skill preserves the established view

- **WHEN** a task has instructions and no skill
- **THEN** no Skill label or empty placeholder is rendered and existing Model/Instructions content is unchanged

#### Scenario: Skill-only task on mobile and RTL

- **WHEN** a skill-only task is viewed in a narrow RTL Configuration tab
- **THEN** the Skill field remains visible, wraps its name/reference, inherits direction, and no empty instructions field is shown
