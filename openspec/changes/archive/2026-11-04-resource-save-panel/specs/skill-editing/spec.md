## MODIFIED Requirements

### Requirement: Edit save sends manifest/files via updateSkill with the loaded ETag; no ZIP
On save in edit mode, the page SHALL merge the edited `name`/`description` into the *original* frontmatter object loaded at task-load time (unknown fields untouched), serialize that merged object plus the current instructions into `SKILL.md` text (no ZIP rebuild), and SHALL call `updateSkill(bucket, path, skillManifest, filePaths, files, ifMatch: <the ETag loaded at page-load or after the last successful save>)` — `filePaths`/`files` covering every entry in the in-memory supporting-file map (edited entries with their new bytes, untouched entries passed through byte-for-byte). On a successful response, the page SHALL replace its stored ETag with the one DIAL Core returns, so a subsequent save within the same session guards against changes made since *that* save, not the original load.

For a skill in the user's own bucket, Save SHALL first open the Save panel (see the `resource-save-panel` capability), and `updateSkill` runs on the panel's Save; a different Personal folder then moves the skill through `POST /api/v1/skills/move`, and an Organization folder publishes it. A skill in another user's bucket SHALL call `updateSkill` directly, without the panel.

#### Scenario: Save sends the loaded ETag via updateSkill
- **WHEN** a user saves an edit immediately after a successful load
- **THEN** `updateSkill` is called with `ifMatch` equal to the ETag read from the load response's `ETag` header, and no ZIP is constructed

#### Scenario: ETag advances after a successful save
- **WHEN** a save succeeds and DIAL Core returns a new `ETag`
- **THEN** a second save in the same session sends that new ETag as `ifMatch`, not the original load-time one

#### Scenario: Untouched binary files remain byte-identical
- **WHEN** a user edits only the Description field and saves, without touching a supporting `assets/logo.png` file
- **THEN** the `files` part submitted for `assets/logo.png` is byte-identical to what was originally loaded

#### Scenario: An own skill moves on save
- **WHEN** the user saves their skill `docs-helper` and picks Personal `team-a` in the Save panel
- **THEN** `updateSkill` is called for `docs-helper`, then the skill is moved to `team-a/docs-helper`
