## ADDED Requirements

### Requirement: Independent server prompt overrides

The backend SHALL support optional string configuration for six built-in instructions through its existing ConfigService: `TEXT_REFINEMENT_SKILL_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_SKILL_INSTRUCTIONS_PROMPT`, `TEXT_REFINEMENT_SCHEDULED_TASK_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_SCHEDULED_TASK_INSTRUCTIONS_PROMPT`, `CONVERSATION_NAMING_SYSTEM_PROMPT`, and `TRANSCRIPTION_PROMPT`. Each override SHALL replace only its corresponding instruction.

#### Scenario: Refinement purposes remain independent
- **WHEN** an operator configures a refinement prompt override
- **THEN** requests for that purpose use the override and requests for other purposes retain their own defaults or overrides
- **AND** user input, model selection, request roles, authorization, and response validation are unchanged

#### Scenario: Both naming flows use one setting
- **WHEN** `CONVERSATION_NAMING_SYSTEM_PROMPT` is configured
- **THEN** automatic conversation naming and the Rename conversation action use that value as their system message
- **AND** retain their existing credentials, context messages, model selection, and title processing

#### Scenario: Audio transcription override
- **WHEN** `TRANSCRIPTION_PROMPT` is configured
- **THEN** transcription uses it as the user instruction alongside the unchanged audio attachment
- **AND** continues to use ASR_MODEL and caller credentials

### Requirement: Default fallback and exact prompt preservation

For each setting the backend SHALL retain its current built-in prompt when the setting is absent, empty, or whitespace-only. A nonblank value SHALL completely replace the default and preserve its text, whitespace, Unicode, and line breaks. Quoted multiline `.env` values SHALL work through the existing environment loader. Changes take effect after backend restart.

#### Scenario: Missing or blank override
- **WHEN** any override is absent, empty, or contains only spaces, tabs, and line breaks
- **THEN** the corresponding existing default is sent to the model

#### Scenario: Multiline override
- **WHEN** an operator supplies a nonblank quoted multiline value in `.env` and restarts the backend
- **THEN** the configured text including leading and trailing whitespace and line breaks is used without concatenation or interpolation

### Requirement: Configuration stays at the backend boundary

The change SHALL introduce no endpoint, client configuration field, prompt logging, or browser state. Existing feature gates and model availability rules SHALL remain effective. It SHALL introduce no cache, metrics, analytics, i18n strings, UI, RTL, accessibility, or memoization requirements.

#### Scenario: Prompt override does not enable a disabled feature
- **WHEN** a prompt override is configured but the corresponding model is unavailable or an existing feature gate denies access
- **THEN** the existing unavailable or forbidden behavior is preserved
