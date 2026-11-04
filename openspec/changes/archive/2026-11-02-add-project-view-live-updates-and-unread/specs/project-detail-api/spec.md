## ADDED Requirements

### Requirement: Deleting or renaming a project keeps the caller's project read state consistent

After a project write has committed, the BFF SHALL update the caller's `projectConversationIds` (see the `project-conversation-read-state` capability) as a best effort. A failure is logged at `warn` without ids and never fails the request, like the pin side effects next to it.

- **Delete:** after `ProjectsService.deleteProject` (`apps/chat-api/src/projects/projects.service.ts`) deletes the folder, `ConversationReadStateService.removeProject(projectId, at, bucket)` removes the project key.
- **Rename:** after `ProjectsUpdateService.updateProject` (`apps/chat-api/src/projects/update/projects-update.service.ts`) moves the project to a new id, `ConversationReadStateService.renameProject(oldId, newId, at, bucket)`:
  - moves the entry from `oldId` to `newId`;
  - rewrites each key's `oldId/` prefix to `newId/`;
  - keeps the versions, because DIAL Core's move copies the files byte for byte, so their content hashes are unchanged;
  - merges into an existing `newId` entry, the moved values winning.

  It runs next to `migratePinQuietly`, and only when the move succeeded.
- An edit without a rename does not touch the read state.

Only the caller's own file is changed. A share recipient's entry under the old id is left behind and is never listed again. Under the new id, the recipient's chats read as unread only when they changed after the baseline and the recipient has no version for the new locator. This one-time effect of a rename on other readers is accepted.

#### Scenario: Delete removes the project key

- **GIVEN** the owner's file has `projectConversationIds['projects/a1b2c3/q4']`
- **WHEN** the owner deletes `projects/a1b2c3/q4`
- **THEN** the key is gone, and `conversationIds` is unchanged

#### Scenario: Rename re-keys the entry

- **GIVEN** the owner's file maps `projects/a1b2c3/q4/conversations/c1` to `sha256:1` under `projects/a1b2c3/q4`
- **WHEN** the owner renames the project to `q4-final`
- **THEN** the file maps `projects/a1b2c3/q4-final/conversations/c1` to `sha256:1` under `projects/a1b2c3/q4-final`, and no `projects/a1b2c3/q4` key remains

#### Scenario: A read-state failure does not fail the delete

- **WHEN** writing `.viewed-conversations.json` fails after the project was deleted
- **THEN** `DELETE /api/v1/projects/:id` still answers `204`, and one `warn` is logged
