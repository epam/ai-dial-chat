## MODIFIED Requirements

### Requirement: Controlled multiple selection
Page-local form values SHALL own selection. SkillSelectorField SHALL be array-only and render the UI kit's multiple `Select`, with host-supplied names, every host-supplied skill as an option, and removable UI-kit tags, using a custom selected-tag renderer for host-confirmed unavailable references. It SHALL NOT expose a parallel single-value component or mode. Selecting an option toggles it. Detail SHALL wait for selected metadata and show every resolved name, unavailable name, or temporary-error URL fallback according to scheduled-task-resource-availability. Existing scheduledTasksEnabled gating remains. Host plural copy uses scheduledTasks.create.skillLabel ("Skills") and scheduledTasks.create.skillPlaceholder ("Choose skills"); the detail page reuses scheduledTasks.create.skillLabel for its skills label. No new telemetry or cache is introduced.

#### Scenario: Unsupported model
- **WHEN** a model has false, missing or unresolved skills support
- **THEN** selected tags remain removable, adding is disabled and nonempty selections block saving

#### Scenario: Mobile, keyboard and RTL
- **WHEN** users select or remove skills on mobile or with keyboard in Arabic
- **THEN** the responsive UI-kit Select popover, keyboard behavior, shared search highlighting and logical wrapping layout remain usable
