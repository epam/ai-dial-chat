## ADDED Requirements

### Requirement: Instructions must not open with a YAML front-matter block

The Skill Editor page SHALL reject an **Instructions** value whose first non-blank
line is a front-matter fence (a line consisting solely of `---`, optionally with
trailing spaces/tabs) that is followed on a later line by a matching closing fence.
Detection SHALL be structural only — it SHALL NOT require the fenced content to be
parseable YAML, because a pasted block that fails to parse produces the same corrupt
two-block manifest.

When the check fails, the page SHALL:

- render the translated message for i18n key `skillEditor.error.instructionsFrontmatter`
  under the Instructions field, via the library's existing `errors.instructions` prop;
- leave the **Name** and **Description** field values untouched — the form is
  authoritative and a pasted block SHALL NEVER be promoted into those fields, nor into
  the submission's frontmatter object;
- leave the **Instructions** text exactly as the user entered it — the page SHALL NOT
  strip, rewrite, or reformat it;
- block submission: `createSkill` SHALL NOT be called.

The check SHALL run both as the Instructions value changes (so a paste is flagged
immediately, without waiting for Create) and again inside the submit handler as a
defensive backstop, so a value set by any path that bypasses the change callback still
cannot produce a two-block manifest. Detection SHALL be a single pure helper exported
from `@epam/ai-dial-chat-hooks`, not duplicated per mode.

The recognised `SKILL.md` import paths are unaffected: dropping or uploading a
`SKILL.md` through the upload dialog continues to strip the block via
`parseSkillManifest` before seeding `instructions`, so the seeded value never trips
this check.

#### Scenario: Pasted SKILL.md front matter is flagged as the text lands

- **WHEN** a user pastes a whole `SKILL.md` — a `---` fence, `name`/`display_name`/`description` lines, a closing `---` fence, then the original body — into the Instructions field
- **THEN** the front-matter error message renders under Instructions before the user presses Create, and the Name and Description fields keep the values the user typed

#### Scenario: Submission is blocked while the error stands

- **WHEN** a user presses **Create** with an Instructions value that opens with a front-matter block
- **THEN** the front-matter error renders under Instructions and `createSkill` is not called

#### Scenario: Unparseable fenced block is still rejected

- **WHEN** the pasted block's fenced content is not valid YAML (for example `name: [unclosed`)
- **THEN** the value is still rejected, because detection is structural rather than YAML-based

#### Scenario: A `---` later in the body is not a front-matter block

- **WHEN** the Instructions value starts with `# Heading` and contains a `---` horizontal rule further down
- **THEN** no error is shown and submission proceeds normally

#### Scenario: An unclosed leading fence is not a front-matter block

- **WHEN** the Instructions value's first line is `---` and no later line is a bare `---`
- **THEN** no error is shown, because a single fence produces no second front-matter block in the built manifest

#### Scenario: Clearing the block clears the error

- **WHEN** a user removes the pasted front-matter block from Instructions
- **THEN** the error disappears and Create becomes submittable again

#### Scenario: Importing a SKILL.md through the upload dialog is unaffected

- **WHEN** a user drops a valid root `SKILL.md` onto the create form and its body is seeded into Instructions
- **THEN** no front-matter error is shown, because the import path stripped the block before seeding

#### Scenario: The stored manifest has exactly one front-matter block

- **WHEN** any skill is successfully created through the editor
- **THEN** the `skillManifest` sent to `createSkill` contains exactly one `---`-delimited front-matter block, at the very start of the file

## MODIFIED Requirements

### Requirement: Name, Description, and Instructions are all required
Although DIAL Core's own `SKILL.md` validation (`SkillHandler.validate`) only requires non-empty `name`/`description`, the product's own create/edit form SHALL additionally require a non-empty `instructions` value, matching the design's required-field marker on all three fields. The `SkillEditor` page SHALL require non-empty `name`, `description`, and `instructions` values before allowing submission in both create and edit mode.

A non-empty `instructions` value SHALL additionally satisfy the "Instructions must not open with a YAML front-matter block" requirement. When both the required-field check and the front-matter check would fail (an empty value cannot open with a fence, so this cannot occur in practice), the required-field message takes precedence; the Instructions field SHALL render at most one message at a time.

#### Scenario: Empty Instructions blocks submission
- **WHEN** a user submits the form with a valid Name and Description but an empty Instructions field
- **THEN** the page shows a required-field error under Instructions and does not call `createSkill`/`updateSkill`

#### Scenario: Name and Description remain required
- **WHEN** a user submits the form with an empty Name or Description
- **THEN** the page shows the corresponding required-field error and does not call `createSkill`/`updateSkill`

#### Scenario: Only one Instructions message renders at a time
- **WHEN** the Instructions field has a validation problem
- **THEN** exactly one message renders under it — never the required-field message and the front-matter message together
