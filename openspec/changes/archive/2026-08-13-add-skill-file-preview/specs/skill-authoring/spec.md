## ADDED Requirements

### Requirement: Selecting a locally-uploaded supporting file in create mode opens its preview

In create mode, selecting a supporting-file node added via "Upload from device" SHALL open a preview of that file's in-memory bytes through the `skill-file-preview` capability, entirely from local browser state — no upload to the BFF occurs merely to preview a file. Selecting `SKILL.md` SHALL continue to show the create form exactly as today.

#### Scenario: Selecting a freshly uploaded file previews it without any network request
- **WHEN** a user uploads `agents/analyzer.md` from their device and then selects it in the tree
- **THEN** its content previews from the local `File` object with no request to `createSkill` or any other endpoint

#### Scenario: Preview does not interfere with the create submission flow
- **WHEN** a user previews a supporting file and then submits the create form
- **THEN** `createSkill` is called with the same `filePaths`/`files` it would have been called with had no preview ever been opened
