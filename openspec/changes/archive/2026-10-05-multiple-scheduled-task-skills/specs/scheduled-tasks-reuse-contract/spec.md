## MODIFIED Requirements

### Requirement: Shared schedule validation returns host-translatable field errors

`@epam/ai-dial-scheduled-tasks/validation` SHALL export a pure validator over existing form values and explicit clock/lead options. It SHALL validate all active schedule fields, description length (500), display-name length (256) and control characters, instructions length (50000) and activity boundaries defined in design.md section 4. The same entry SHALL export `validateScheduledTaskTextField(field, value)` for a single `displayName`/`description`/`prompt` value (checked trimmed; an empty value passes) so a host can report `DisplayNameTooLong`, `DisplayNameControlCharacters`, `DescriptionTooLong` or `PromptTooLong` while the user types. Errors SHALL identify a field and a typed code, with no translated strings, network calls or ambient clock reads. Inactive draft fields SHALL not invalidate another repeat mode.

#### Scenario: Text fields over their limits return typed codes

- **WHEN** a draft has a 257-character display name, a 501-character description and 50001-character instructions
- **THEN** validation returns `DisplayNameTooLong`, `DescriptionTooLong` and `PromptTooLong` for those fields; a display name containing a tab returns `DisplayNameControlCharacters`

#### Scenario: Weekly and monthly require valid day selections

- **WHEN** a weekly/monthly draft has an empty or out-of-range day
- **THEN** validation returns a dayOfWeek/dayOfMonth error and cannot report the draft as valid.

#### Scenario: Numeric and time boundaries are enforced

- **WHEN** hourly minute is negative, 60, fractional or nonnumeric, or daily time is not valid HH:mm
- **THEN** validation returns an error for the active field; minute 0 and 59 and valid HH:mm remain accepted.

#### Scenario: One-time and activity dates are validated deterministically

- **WHEN** the caller supplies now and a one-time run less than the configured lead ahead, or malformed dates, or end not after start
- **THEN** validation returns the corresponding field error; changing the injected clock changes the lead check predictably.

#### Scenario: Inactive fields and optional description do not block valid schedules

- **WHEN** a valid daily draft retains an old hourly-minute value and has empty description
- **THEN** validation succeeds; a description above 500 characters instead returns its own error.

Validation options SHALL additionally accept `isSkillsSupported?: boolean`. Skill-bearing values require explicit true; instruction-only callers remain compatible without that option. The pure shared `isSkillSelectionUnsupported` predicate SHALL determine capability errors from the reference, not metadata. `SkillUnsupported` SHALL identify `skillUrls`; `InstructionsOrSkillRequired` SHALL identify `prompt` when both content alternatives are absent. Stable codes SHALL be string-enum members translated by the host.

#### Scenario: Configuration validation matrix

- **WHEN** support is true/false/undefined, skill is present/absent, and prompt is nonblank/empty/whitespace
- **THEN** instruction-only is valid regardless of support, a present skill requires explicit true, a supported skill permits blank prompt, and neither content alternative is invalid

#### Scenario: Default options fail closed only for a skill

- **WHEN** an existing host omits the support option
- **THEN** instruction-only behavior is preserved and adding a skill returns `SkillUnsupported`
