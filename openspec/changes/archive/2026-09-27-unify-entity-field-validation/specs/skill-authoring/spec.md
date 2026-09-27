## MODIFIED Requirements

### Requirement: Name, Description, and Instructions are all required
Although DIAL Core's own `SKILL.md` validation (`SkillHandler.validate`) only requires non-empty `name`/`description`, the product's own create/edit form SHALL additionally require a non-empty `instructions` value, matching the design's required-field marker on all three fields. The `SkillEditor` page SHALL require non-empty `name`, `description`, and `instructions` values before allowing submission in both create and edit mode.

Each value SHALL also be within its limit once trimmed — `name` 256, `description` 2000, `instructions` 50000 (`SKILL_TEXT_FIELD_MAX_LENGTHS` / `getSkillFieldLengthViolations` in `@epam/ai-dial-chat-hooks`, from the shared `entity-field-limits`). `useSkillEditorSubmit` SHALL show the host-supplied `messages.tooLong(limit)` (the app passes `editor.fieldTooLong`) under an over-limit field as soon as the value changes, clear it once the value is back within the limit, and block submission while any field is over its limit, in both create and edit mode. A required-field message takes precedence over a length message on submit.

A non-empty `instructions` value SHALL additionally satisfy the "Instructions must not open with a YAML front-matter block" requirement. When both the required-field check and the front-matter check would fail (an empty value cannot open with a fence, so this cannot occur in practice), the required-field message takes precedence; the Instructions field SHALL render at most one message at a time.

#### Scenario: Empty Instructions blocks submission
- **WHEN** a user submits the form with a valid Name and Description but an empty Instructions field
- **THEN** the page shows a required-field error under Instructions and does not call `createSkill`/`updateSkill`

#### Scenario: Name and Description remain required
- **WHEN** a user submits the form with an empty Name or Description
- **THEN** the page shows the corresponding required-field error and does not call `createSkill`/`updateSkill`

#### Scenario: Over-long fields are flagged while typing and block submission
- **WHEN** a user types a 257-character Name (or a Description over 2000, or Instructions over 50000 characters)
- **THEN** "Use 256 characters or fewer." (with the matching limit) appears under that field immediately, and submitting does not call `createSkill`/`updateSkill`

#### Scenario: Only one Instructions message renders at a time
- **WHEN** the Instructions field has a validation problem
- **THEN** exactly one message renders under it — never the required-field message and the front-matter message together
