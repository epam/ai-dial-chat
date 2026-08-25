## MODIFIED Requirements

### Requirement: Single-rule editor validates EQUAL and CONTAIN rules

The single-rule editor (`PublishAccessRuleEditor`) SHALL offer a source control (populated from `ruleSourceOptions`), a function control (`EQUAL` / `CONTAIN` / `REGEX`), and, for `EQUAL`/`CONTAIN`, a free-entry tag input for `targets`. The Save/Add action SHALL remain enabled regardless of validation state — it is disabled only while the host disables the section (see the submission-disabling requirement below). Activating Save while a source is missing, a function is missing, or zero targets have been entered SHALL NOT call `onSave`; instead it SHALL mark the editor as having attempted a save and show a localized inline "required" error under each incomplete field (source/function picker, or the targets input), associated with that field via its `invalid`/error-message props. On a successful save, each target SHALL be trimmed, and an exact-duplicate (post-trim, case-sensitive) target SHALL be rejected rather than added as a second identical tag.

#### Scenario: Save stays enabled with no source selected
- **GIVEN** the editor is open with a function and at least one target entered but no source selected
- **WHEN** the user views the Save control
- **THEN** it is enabled

#### Scenario: An invalid Save click shows a required-field error instead of saving
- **GIVEN** the editor is open with a function and at least one target entered but no source selected
- **WHEN** the user clicks Save
- **THEN** `onSave` is not called and a "required field" inline error appears under the source control

#### Scenario: Save stays enabled with zero targets
- **GIVEN** a source and function are selected but no target has been entered
- **WHEN** the user views the Save control
- **THEN** it is enabled

#### Scenario: Clicking Save with zero targets shows a targets error instead of saving
- **GIVEN** a source and function are selected but no target has been entered
- **WHEN** the user clicks Save
- **THEN** `onSave` is not called and a "add at least one target" inline error appears under the targets input

#### Scenario: Targets are trimmed on save
- **GIVEN** the user enters a target value with leading/trailing whitespace
- **WHEN** the rule is saved
- **THEN** the stored `targets` entry has the whitespace trimmed

#### Scenario: Exact-duplicate target within one rule is rejected
- **GIVEN** the user has already added the target `engineering` to the current rule
- **WHEN** the user attempts to add `engineering` again (after trimming)
- **THEN** the duplicate is not added and the existing single tag remains

#### Scenario: Multiple distinct targets are allowed and combined with OR
- **GIVEN** the user adds `engineering` and `support` as targets under `CONTAIN`
- **WHEN** the rule is saved
- **THEN** the saved rule's `targets` is `['engineering', 'support']`, displayed with an "Or" separator between them

### Requirement: Single-rule editor validates REGEX rules

When `function` is `REGEX`, the editor SHALL offer exactly one text input (not a multi-tag input) for the pattern. A pattern longer than 200 characters SHALL be treated as invalid before attempting to construct a `RegExp`, matching the backend target-length limit and bounding synchronous parsing work on the browser's main thread. For patterns within the limit, validity SHALL be checked by attempting `new RegExp(trimmedPattern)` inside a try/catch; an empty (post-trim) pattern SHALL also be treated as invalid. An invalid pattern SHALL show a localized inline error, associated with the input via `aria-describedby`, once the field has non-empty content or the user has attempted a save; the error display SHALL NOT disable the Save action, but activating Save while the pattern is invalid SHALL NOT call `onSave`. On save, the pattern SHALL be stored as the single entry of `targets` (`targets.length === 1`), unmodified (not trimmed), because leading/trailing characters may be meaningful in a regex.

#### Scenario: Valid regex is accepted
- **GIVEN** `function` is `REGEX` and the user enters `^eng-.*$`
- **WHEN** the user saves the rule
- **THEN** the rule is added with `targets: ['^eng-.*$']` and no error is shown

#### Scenario: Invalid regex shows an inline error and a Save click does not save
- **GIVEN** `function` is `REGEX` and the user enters an unbalanced pattern such as `(unclosed`
- **WHEN** validity is checked
- **THEN** a localized inline error is shown, associated with the input via `aria-describedby`, and the Save control remains enabled
- **WHEN** the user then clicks Save
- **THEN** `onSave` is not called

#### Scenario: Empty regex is treated as invalid
- **GIVEN** `function` is `REGEX` and the pattern field is empty or whitespace-only
- **WHEN** the user clicks Save
- **THEN** the field is treated as invalid, an inline error is shown, and `onSave` is not called

#### Scenario: Oversized regex is rejected before parsing

- **GIVEN** `function` is `REGEX` and the pattern contains more than 200 characters
- **WHEN** validity is checked
- **THEN** the field is treated as invalid without constructing a `RegExp`, and a Save click does not call `onSave`

#### Scenario: Switching from REGEX to CONTAIN clears the single-pattern state
- **GIVEN** the user has entered a pattern under `REGEX`
- **WHEN** the user switches `function` to `CONTAIN`
- **THEN** the editor shows the multi-target tag input instead, starting empty, and does not carry the regex text over as a pre-filled tag
