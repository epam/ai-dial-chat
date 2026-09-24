## ADDED Requirements

### Requirement: Skill support is consumable through built library contracts

The reusable selector SHALL be exported by `@epam/ai-dial-skills`; form/summary/detail values, labels and errors by `@epam/ai-dial-scheduled-tasks`; pure validation by its `/validation` entry; DTO mapping and checked preparation by both the root `@epam/ai-dial-chat-hooks` and `/scheduled-tasks` entry. Existing optional-free instruction-only callers SHALL remain compatible. Public props and host wiring SHALL be documented in each affected README with correct exports and complete examples.

The existing packed `tools/scheduled-tasks-consumer-fixture` SHALL exercise skill selection/removal, shared validation, preparation, skill-only hydration, and read-only fallback using built artifacts without source aliases or app providers. Hand-authored libs SHALL NOT acquire API routes, client setup, app context imports, flags, auth, storage, i18n, navigation, or deployment objects. The existing `chat-hooks` configured-client exception SHALL remain narrow. Styles SHALL ship through existing public stylesheet contracts.

#### Scenario: External host composes the whole flow

- **WHEN** a consumer installs the built packages and passes a skill value, support boolean, labels, catalog renderer, and callbacks
- **THEN** its form and detail render and its checked preparation works without importing `apps/chat` or copying capability/content rules

#### Scenario: Existing host remains compatible

- **WHEN** a host omits all new optional props and submits an instruction-only task
- **THEN** existing code typechecks and the established form/validation behavior remains available

## MODIFIED Requirements

### Requirement: Shared schedule validation returns host-translatable field errors

`@epam/ai-dial-scheduled-tasks/validation` SHALL export a pure validator over existing form values and explicit clock/lead options. It SHALL validate all active schedule fields, description length and activity boundaries defined in design.md section 4. Errors SHALL identify a field and a typed code, with no translated strings, network calls or ambient clock reads. Inactive draft fields SHALL not invalidate another repeat mode.

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

Validation options SHALL additionally accept `isSkillsSupported?: boolean`. Skill-bearing values require explicit true; instruction-only callers remain compatible without that option. The pure shared `isSkillSelectionUnsupported` predicate SHALL determine capability errors from the reference, not metadata. `SkillUnsupported` SHALL identify `skillUrl`; `InstructionsOrSkillRequired` SHALL identify `prompt` when both content alternatives are absent. Stable codes SHALL be string-enum members translated by the host.

#### Scenario: Configuration validation matrix

- **WHEN** support is true/false/undefined, skill is present/absent, and prompt is nonblank/empty/whitespace
- **THEN** instruction-only is valid regardless of support, a present skill requires explicit true, a supported skill permits blank prompt, and neither content alternative is invalid

#### Scenario: Default options fail closed only for a skill

- **WHEN** an existing host omits the support option
- **THEN** instruction-only behavior is preserved and adding a skill returns `SkillUnsupported`

### Requirement: Checked preparation never silently changes schedule frequency

`@epam/ai-dial-chat-hooks/scheduled-tasks` SHALL export checked create/update body preparation using the shared validator before existing conversion. Failure SHALL return field error codes without a body. Success SHALL preserve the existing UTC, weekday, description and activity-window semantics. Existing unchecked mapper signatures SHALL remain compatible and document their validated-input precondition.

#### Scenario: Invalid weekly draft has no request body

- **WHEN** checked create or update preparation receives Weekly with no day
- **THEN** the result contains a day error and no daily cron body can be submitted through this path.

#### Scenario: Valid conversion preserves current semantics

- **WHEN** valid weekly, monthly, hourly or one-time values are prepared in supported timezones
- **THEN** the result has the selected frequency and matches the existing conversion, including non-whole-hour offsets and activity boundaries.

Checked create/update preparation SHALL pass capability options into shared validation and preserve a selected skill reference. Create SHALL omit an unset skill; update from a complete hydrated draft SHALL serialize an unset/cleared value as `null`. Reverse mapping SHALL accept empty-string prompt with a skill and SHALL not depend on catalog metadata. No invalid combination SHALL produce a request body.

#### Scenario: Skill-only checked preparation round-trips

- **WHEN** a supported skill-only draft is prepared, persisted, and mapped back
- **THEN** its reference and empty prompt survive with the established schedule semantics
