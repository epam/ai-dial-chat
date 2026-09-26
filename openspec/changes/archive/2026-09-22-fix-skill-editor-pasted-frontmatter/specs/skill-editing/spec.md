## ADDED Requirements

### Requirement: Edit mode applies the same front-matter rejection as create mode

Edit mode SHALL apply the "Instructions must not open with a YAML front-matter block"
requirement defined in the `skill-authoring` capability, using the same exported pure
detector and the same i18n key, because both modes share
`buildSkillManifestForSubmit` and both can therefore produce a `SKILL.md` with two
front-matter blocks.

When the check fails in edit mode, the page SHALL render the message under the
Instructions field, SHALL NOT call `updateSkill`, and SHALL NOT alter the loaded
frontmatter object — the frontmatter fields preserved from the loaded manifest (the
"Frontmatter and supporting files are unpacked and preserved for editing" requirement)
stay exactly as loaded, and the pasted block is never merged into them.

Loading an existing skill SHALL NOT trip the check: the load path splits the manifest
via `parseSkillManifest` before seeding `instructions`, so a well-formed stored skill
seeds a body with no leading fence. A skill whose *stored* body already contains a
second front-matter block — one created before this change — SHALL surface the error on
load-and-edit rather than being silently re-saved, so re-saving it requires the user to
remove the block.

#### Scenario: Pasting front matter while editing blocks the save

- **WHEN** a user opens an existing skill for editing and pastes a whole `SKILL.md` into Instructions
- **THEN** the front-matter error renders under Instructions and `updateSkill` is not called

#### Scenario: Loading a well-formed skill shows no error

- **WHEN** a user opens an existing skill whose stored `SKILL.md` has exactly one front-matter block
- **THEN** the Instructions field seeds with the body alone and no front-matter error is shown

#### Scenario: An already-corrupt skill surfaces the error on edit

- **WHEN** a user opens a skill created before this change whose stored body begins with a second front-matter block
- **THEN** the error renders under Instructions, and saving requires removing that block first

#### Scenario: Loaded frontmatter is untouched while the error stands

- **WHEN** the front-matter error is showing in edit mode
- **THEN** the loaded frontmatter object (including unknown fields such as `version`) is unchanged, and no `updateSkill` request is made
