# Spec Delta

## ADDED Requirements

### Requirement: Duplicating a scheduled-task run produces an ordinary conversation

`POST /api/v1/conversations/duplicate` SHALL NOT place the copy under the reserved DIAL Scheduler namespace. When the source path's folder segments begin with a `.scheduler` segment that is followed by at least one more segment (the schedule id), the endpoint SHALL drop those two leading segments from the destination folder path. The remaining folder segments, if any, SHALL be preserved unchanged (for example `applications/{bucket}/{application}` for a run of a custom application). The condition SHALL depend only on those path segments, not on whether the source filename parses as a scheduled run.

The destination-path existence check, the destination path, the saved conversation `id` and the saved conversation `folderId` SHALL all be derived from the destination folder path after the drop, so the saved body is consistent with where it is stored. The response `newPath` is that destination path, as before.

The rule applies identically to a run in the caller's own bucket and to a run shared from another bucket. The source conversation SHALL NOT be modified, moved or deleted. The existing collision rule is unchanged: when a resource already exists at the destination path, a fresh `__{uuid}` segment is appended to the filename, and because the destination is no longer under `.scheduler` such a suffix cannot make the copy look like a scheduled run.

The copy therefore is not reported as a scheduled-task conversation by `GET /api/v1/conversations/list` (`isScheduledTask: false`, no `scheduleId`, no `runId`), is not grouped with the task's runs, and the conversation panel shows no task icon or task banner for it. No request or response shape changes, so the OpenAPI document and the generated client are unaffected.

Copies created before this requirement keep their existing paths; they cannot be told apart from real runs and are not migrated.

#### Scenario: Copy of an own run lands at the bucket root

- **GIVEN** the caller owns the run `conversations/u/.scheduler/sched_abc/gpt-4o__Morning%20briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5` and no resource exists at `gpt-4o__Morning briefing`
- **WHEN** the caller duplicates it
- **THEN** the copy is stored at `conversations/u/gpt-4o__Morning%20briefing`
- **AND** its saved `id` is `u/gpt-4o__Morning briefing` and its `folderId` is `u`
- **AND** the source run is unchanged

#### Scenario: Copy of a run shared from another bucket lands in the caller's bucket

- **GIVEN** a run `conversations/owner/.scheduler/sched_abc/gpt-4o__Morning%20briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5` shared with the caller
- **WHEN** the caller duplicates it
- **THEN** the copy is stored in the caller's own bucket without any `.scheduler` segment

#### Scenario: Repeated copies never look like scheduled runs

- **GIVEN** a run has already been duplicated once so that `gpt-4o__Morning briefing` exists at the caller's bucket root
- **WHEN** the caller duplicates the same run a second time
- **THEN** the copy is stored as `gpt-4o__Morning briefing__<fresh-uuid>` at the bucket root
- **AND** the conversation list reports it with `isScheduledTask: false`

#### Scenario: Application runs keep their application folder

- **GIVEN** the run `conversations/u/.scheduler/sched_abc/applications/u/Daily%20plan__0.0.1__Todoist__bc56151e-296d-469f-80f6-61fbb3e5a98a`
- **WHEN** the caller duplicates it
- **THEN** the copy is stored under `applications/u/` in the caller's bucket, with no `.scheduler` segment
- **AND** its `folderId` is `u/applications/u`

#### Scenario: Ordinary folders are untouched

- **GIVEN** a source conversation at `folder/sub/gpt-4o__Hello`
- **WHEN** the caller duplicates it
- **THEN** the copy is stored under `folder/sub/`, as before

#### Scenario: A bare `.scheduler` folder without a schedule id segment is left alone

- **GIVEN** a source whose only folder segment is `.scheduler`
- **WHEN** the caller duplicates it
- **THEN** the folder segments are preserved as for any other folder
