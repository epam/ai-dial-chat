## ADDED Requirements

### Requirement: Edit mode applies the same batch validation limits as create mode

In edit mode, the `SkillEditor` page's `fileActions.validateBatch` implementation SHALL apply the identical per-candidate and batch-level checks specified by `skill-authoring`'s "Batch validation mirrors BFF package limits before commit" requirement (per-file size, path safety/traversal, within-batch and against-existing duplicates, reserved paths, projected total size, projected total file count), computed against the edit session's currently loaded supporting files (the in-memory `Map<relativePath, Uint8Array>` populated at load) rather than a freshly empty set.

#### Scenario: Duplicate against an already-loaded file is rejected
- **WHEN** a user stages a file whose path matches a supporting file already loaded from the edited skill's archive
- **THEN** that candidate is marked invalid with a duplicate error

#### Scenario: Projected total size accounts for already-loaded bytes
- **WHEN** the edited skill already has supporting files near the total package size limit and a user stages a further large file
- **THEN** the projected total size calculation includes the already-loaded bytes, and the batch is rejected if the limit would be exceeded

### Requirement: Importing SKILL.md in edit mode requires an exact name match and explicit confirmation

When the staged batch in edit mode contains a valid manifest candidate (per `skill-authoring`'s manifest-recognition rule), the page SHALL always ask for explicit confirmation before replacing the current manifest fields, regardless of whether the form is currently dirty — unlike create mode, where confirmation is only required when dirty. Because DIAL Core has no rename or move operation for a whole-skill resource, the page SHALL compare the imported manifest's `name` against the current, read-only Skill name (the one originally loaded, immutable per the existing "Resource path and Name are immutable in edit mode" requirement) and SHALL reject the import with a specific commit error if they differ, without changing any field or committing any other staged candidate in the same batch. When the names match, confirming the import SHALL update Description, Instructions, and the preserved frontmatter object (merging into the originally loaded frontmatter, keeping unknown fields untouched, consistent with the existing frontmatter-preservation requirement), while leaving Name and the skill's resource path exactly as loaded.

#### Scenario: Matching-name import asks for confirmation and updates fields
- **WHEN** a user imports a `SKILL.md` whose `name` equals the currently loaded, read-only Skill name
- **THEN** the page asks for explicit confirmation before applying it; on confirmation, Description and Instructions update from the import and Name remains unchanged

#### Scenario: Mismatched-name import is rejected without changing anything
- **WHEN** a user imports a `SKILL.md` whose `name` differs from the currently loaded Skill name
- **THEN** the commit fails with a specific error explaining that renaming isn't supported, and no field, frontmatter, or other staged candidate in the batch is committed

#### Scenario: Confirmation is required even when the form has no unsaved edits
- **WHEN** a user imports a matching-name `SKILL.md` while the edit form has no unsaved changes
- **THEN** the page still asks for explicit confirmation before replacing Description/Instructions/frontmatter

#### Scenario: Unknown frontmatter fields survive a confirmed import
- **WHEN** the originally loaded skill had a `version: "2.0.0"` field and the imported `SKILL.md` omits it
- **THEN** the merged frontmatter used for the next save still includes `version: "2.0.0"`, since the import merges into the original frontmatter rather than replacing it wholesale
