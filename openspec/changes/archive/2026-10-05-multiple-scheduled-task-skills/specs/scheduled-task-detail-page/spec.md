## MODIFIED Requirements

### Requirement: Skill display covers reusable summaries and the active Configuration view

`ScheduledTaskDetailsSummary` and `ScheduledTaskConfigurationSection` SHALL accept optional localized `skillLabel` and resolved `skillDisplayNames: string[]`; `ScheduledTaskDetailView` SHALL forward its optional skill value and label to Configuration. The host SHALL pass the skill's resolved display name or full raw reference, independent of catalog loading/failure. No skill SHALL produce no Skill field. Values SHALL be plain text, without a details link. Libraries SHALL perform no lookup or navigation.

The full detail page SHALL render Skill above Instructions in Configuration on desktop and in the mobile Configuration tab, preserving Model in Details. The conversation sources panel SHALL pass the same saved-task metadata to the reusable summary, ordered Model, Skill, Instructions. Skill-only tasks SHALL render without an empty Instructions block or an empty Configuration section. Lookup failure SHALL NOT replace task content with an error screen. The page root SHALL clip overflow: the active mobile tab owns the body scrollbar, while the desktop body is a non-wrapping clipped row whose Details, Configuration, and History columns scroll independently beneath the fixed header. The existing detail task state remains the source of truth; no new context is added.

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
