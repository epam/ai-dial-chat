## ADDED Requirements

### Requirement: Card description is populated from the BFF description field

`map-scheduled-task-dto.ts` SHALL map `ScheduledTaskDto.description` to `ScheduledTaskItem.descriptionPreview` in `mapScheduledTaskDtoToItem`, with no truncation or reformatting applied in the mapper (the 500-character BFF limit already bounds the value; `ScheduledTaskCard`'s existing line-clamp/ellipsis handling is the presentation-layer truncation boundary). When `ScheduledTaskDto.description` is `undefined`, `descriptionPreview` SHALL be `undefined`, matching the card's existing optional-description rendering and the client-side search behavior already speced against `descriptionPreview`.

#### Scenario: Description maps to descriptionPreview

- **WHEN** a `ScheduledTaskDto` with `description: "Summarizes unread inbox items every morning"` is mapped
- **THEN** the resulting `ScheduledTaskItem.descriptionPreview` equals that same string, unmodified

#### Scenario: Missing description maps to undefined

- **WHEN** a `ScheduledTaskDto` omits `description`
- **THEN** the resulting `ScheduledTaskItem.descriptionPreview` is `undefined`, and mapping does not throw

#### Scenario: Newly created task with a description is searchable by that description immediately after list refresh

- **WHEN** a task is created with a `description`, and the list is refetched afterward
- **THEN** searching by a substring of that description matches the task's card, consistent with the existing `descriptionPreview` search-matching behavior
