# Scheduled Task Resource Availability Specification

## Purpose

Explain unavailable saved skills and deployments in scheduled-task previews and editing without losing references or permitting known-invalid updates.

## Requirements

### Requirement: Availability resolution stays at the application edge

`useScheduledTaskSkillDetails` in `apps/chat/src/hooks/scheduled-tasks/useUnavailableScheduledTaskSkills.ts` SHALL own selection-scoped skill metadata state. Names present in the current personal, shared or public catalog SHALL resolve immediately. Missing references SHALL use the existing metadata adapter in `apps/chat/src/server-api/skills.api.ts`. HTTP 400, 403 and 404 SHALL mark a reference unavailable; network errors and other HTTP errors SHALL not imply deletion. Requests SHALL be aborted on selection/listing changes and unmount; stale responses SHALL not overwrite the current selection.

`useScheduledTaskModelPreview` in `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskModelPreview.tsx` SHALL use the existing deployments context. Only absence from a successfully loaded catalog SHALL mark a model or agent unavailable. Matching SHALL accept IDs, references and equivalent percent-encoded application IDs. These checks describe the current catalog snapshot; they SHALL NOT introduce polling, a new shared cache, or a new endpoint. Backend authorization and validation SHALL remain authoritative at submission time.

#### Scenario: Deleted or revoked skill

- **WHEN** metadata for a saved reference absent from the catalog returns 400, 403 or 404
- **THEN** that reference becomes unavailable without removing it from the task

#### Scenario: Temporary service failure

- **WHEN** skill metadata returns 503 or the deployments catalog fails
- **THEN** the resource is not labeled deleted or revoked and its unresolved reference remains available as a fallback after loading settles

#### Scenario: Retry a previously unavailable reference

- **WHEN** a reference whose metadata returned 400 is removed and later selected again, or the editor is reopened with that reference
- **THEN** missing metadata is requested again rather than retaining a session-wide unavailable result
- **AND** removing a deleted reference does not make it selectable from a catalog where it is absent

#### Scenario: Selection changes during a request

- **WHEN** an earlier metadata request settles after selection changed or its owner unmounted
- **THEN** its response does not affect the current names, availability or save guard

### Requirement: Preview waits for availability and explains unavailable resources

`useScheduledTaskSkillPreview` in `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskSkillPreview.tsx` SHALL hide the Skill field while any selected reference is resolving, preventing an initial flash of full paths. Model preview SHALL hide the model field during catalog loading. Unavailable names SHALL use the final nonempty path segment, safely percent-decoded, followed by localized ` (unavailable)`. Malformed escapes SHALL not throw. Unavailable values SHALL use Text&Icon/Error and a pointer cursor.

Skill tooltip copy SHALL be "The skill has been deleted or access revoked"; model tooltip copy SHALL be "The model or agent has been deleted or access revoked". The app SHALL provide these through the translation keys `skillSelector.unavailableSkillName`, `skillSelector.unavailableSkillTooltip`, `scheduledTasks.unavailableModelName` and `scheduledTasks.unavailableModelTooltip`. Preview text SHALL be keyboard-focusable for the tooltip and have no resource-details navigation.

The full task preview SHALL use the task model; the conversation sources panel SHALL continue using the run conversation's model, not a subsequently edited schedule model. Both surfaces SHALL use the same skill availability presentation.

#### Scenario: Pending metadata does not expose a path

- **WHEN** selected skill metadata is pending
- **THEN** other task content remains visible but the saved path is not briefly rendered as the skill name

#### Scenario: Unavailable preview name

- **WHEN** `skills/public/folder/Weekly%20report` is unavailable
- **THEN** preview displays `Weekly report (unavailable)` with error text, pointer cursor and the skill explanation on hover or focus

### Requirement: Editing keeps unavailable resources removable and replaceable

`ScheduledTaskEditPage` SHALL own availability alongside its existing controlled form values and pass resolved skill metadata to `ScheduledTaskSkillField`, avoiding a second metadata request for the field. Unavailable skills SHALL retain their original references and render compact removable UI-kit tags with error fill/border, short unavailable names and tooltips. Unavailable tags SHALL suppress the native HTML title tooltip so only the custom availability tooltip appears. Healthy tags SHALL retain ordinary styling and their native label tooltip. Removal SHALL preserve other references and instructions. A missing deployment SHALL render an invalid model field with its unavailable name and tooltip while still allowing the selector to open and replace it.

#### Scenario: Mixed available and unavailable tags

- **WHEN** only one of several selected skills is unavailable
- **THEN** only its tag receives the error treatment and removing it emits the remaining references in their original order

#### Scenario: Replace an unavailable model

- **WHEN** the saved model is absent from the successfully loaded catalog
- **THEN** the field is invalid but the user can open its desktop dropdown or mobile sheet and choose an available model

#### Scenario: Explain invalid skill selections

- **WHEN** an unavailable selected skill blocks saving
- **THEN** the skill field SHALL show the availability error as a caption alongside the error tags
- **AND** if the model also does not support skills, the field SHALL retain its unsupported-model tooltip

### Requirement: Availability is checked before updates

Save SHALL remain disabled while selected skill metadata or the model catalog is loading, while any selected resource is confirmed unavailable, or while ordinary form constraints fail. The edit page's preparation callback SHALL independently return no update body while availability is pending or a selected resource is unavailable, even if submission is invoked directly. Removing unavailable skills or replacing the model SHALL restore saving once the remaining form is valid. A transient lookup failure SHALL not be converted into a deletion error; server validation remains applicable.

#### Scenario: Direct submit cannot bypass availability

- **WHEN** submission is invoked while availability is pending or a resource is confirmed unavailable
- **THEN** no update API request is issued

#### Scenario: Selection corrected

- **WHEN** the user removes the unavailable skill or selects an available model
- **THEN** saving becomes available if no other availability or form constraint blocks it

### Requirement: Reusable components receive data and presentation only

`libs/skills` SHALL accept `unavailableValues`, localized tooltip/removal labels and tag color overrides without catalog or API knowledge. `libs/scheduled-tasks` SHALL accept optional `renderSkillName`, `renderModelName` and `isSubmitDisabled` contracts; model field errors SHALL also disable Save. Existing consumers omitting these optional props SHALL keep their plain-name presentation. No hand-authored library SHALL gain application contexts, API routes, client instances or translation calls.

The existing `scheduledTasksEnabled` route gate SHALL remain unchanged, with no new feature flag, role, telemetry or persistent cache. Responsive branches SHALL keep using the existing mobile boundary and shared selector controls. RTL SHALL inherit direction without physical positioning or new directional icons. The suffix SHALL explain unavailable state without relying on color alone; removal and replacement SHALL remain keyboard-operable. Selection keys SHALL prevent effect reruns caused only by newly allocated equivalent arrays; no additional memoization contract is imposed on consumers.

#### Scenario: Host composes availability

- **WHEN** an external host supplies names, availability, renderer callbacks and translated labels
- **THEN** library components render the unavailable states without importing the chat app or querying an external service

#### Scenario: Keyboard and RTL

- **WHEN** the editor is used with keyboard navigation or an RTL locale
- **THEN** unavailable tags remain removable, model replacement remains operable, and the layout inherits direction
