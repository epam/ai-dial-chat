## ADDED Requirements

### Requirement: Move a skill to another folder
`POST /api/v1/skills/move` (`moveSkill`) SHALL move a skill in the caller's own bucket into another folder of that bucket. The body is `MoveSkillDto { path, folderPath }`: `path` is the skill's path in the bucket, and `folderPath` is the plain-text destination folder (empty for the root), validated against path traversal. The bucket SHALL always be the session's own; the request carries none.

`SkillsMutationService.moveSkill` SHALL call DIAL Core's `moveResource` with `skills/{bucket}/{path}` as the source, `skills/{bucket}/{folderPath}/{name}` as the destination and `overwrite: false`, and SHALL resolve `{ id: "skills/{bucket}/{newPath}" }`. When the destination equals the source it SHALL resolve the same id without calling DIAL Core. A `400` from DIAL Core while a skill already exists at the destination SHALL be reported as `409 Conflict`; any other upstream status SHALL be mapped by the shared DIAL status mapper.

#### Scenario: Moving a skill into a folder
- **WHEN** a client posts `{ path: "docs-helper", folderPath: "Team A" }`
- **THEN** DIAL Core is asked to move `skills/{bucket}/docs-helper` to `skills/{bucket}/Team%20A/docs-helper` without overwriting, and the response is `{ id: "skills/{bucket}/Team A/docs-helper" }`

#### Scenario: The target already holds the skill
- **WHEN** the destination folder already has a skill with that name
- **THEN** the endpoint answers `409`

#### Scenario: Path traversal is rejected
- **WHEN** a client posts `folderPath: "../other"`
- **THEN** the endpoint answers `400` and nothing is moved
