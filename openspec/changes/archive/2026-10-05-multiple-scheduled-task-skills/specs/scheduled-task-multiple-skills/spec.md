## Purpose
Enable configuring several existing skill packages in a scheduled task without losing saved references.

## ADDED Requirements

### Requirement: Array configuration
Scheduled tasks SHALL use skillUrls arrays instead of skillUrl. POST /api/v1/scheduled-tasks accepts {displayName, model, prompt, trigger, skillUrls?: string[], description?} and returns 201 detail. PUT /api/v1/scheduled-tasks/:id accepts the update DTO and returns 200 detail. GET detail returns every saved reference when its payload exists. Existing operation names and generated normal methods SHALL remain unchanged. Arrays SHALL validate every path, reject null, and deduplicate in order. Omitted PUT arrays preserve saved skills; [] clears. Existing authentication, authorization, validation 400, missing resource 404, upstream 502/503, and cache invalidation SHALL remain.

#### Scenario: Several references round trip
- **WHEN** a supported model task is saved with skillUrls ["skills/public/report", "skills/public/summary"]
- **THEN** both encoded references appear in custom_content.skills and detail/edit exposes both in that order

#### Scenario: Clear or preserve
- **WHEN** a task update omits skillUrls or supplies []
- **THEN** omission preserves the array and [] removes every skill

#### Scenario: Existing tasks
- **WHEN** a saved task has one skills entry or a list item lacks its payload
- **THEN** full detail exposes a one-entry array and sparse lists leave the field absent

### Requirement: Controlled multiple selection
Page-local form values SHALL own selection. SkillSelectorField SHALL be array-only and render the UI kit's multiple `Select`, with host-supplied names, every host-supplied skill as an option, and the Select's built-in removable tags. It SHALL NOT expose a parallel single-value component or mode. Selecting an option toggles it. Detail SHALL show every name or URL fallback. Existing scheduledTasksEnabled gating remains. Host plural copy uses scheduledTasks.create.skillLabel, scheduledTasks.create.skillPlaceholder and scheduledTasks.detail.skillLabel. No new telemetry or cache is introduced.

#### Scenario: Unsupported model
- **WHEN** a model has false, missing or unresolved skills support
- **THEN** selected tags remain removable, adding is disabled and nonempty selections block saving

#### Scenario: Mobile, keyboard and RTL
- **WHEN** users select or remove skills on mobile or with keyboard in Arabic
- **THEN** the responsive UI-kit Select popover, keyboard behavior, shared search highlighting and logical wrapping layout remain usable
