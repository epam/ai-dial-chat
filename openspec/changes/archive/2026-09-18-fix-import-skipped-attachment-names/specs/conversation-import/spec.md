## ADDED Requirements

### Requirement: Skipped attachment names in import queue warnings

The import hook SHALL retain unique skipped attachment names on each warning job. The queue SHALL pass those names to the host warning callback and use its result as both tooltip and accessible name. The app SHALL interpolate `conversationImport.warningAttachmentSkipped` with that job's names, using the existing notification formatting: up to five quoted names followed by a localized count of remaining names. Jobs without names SHALL use `conversationImport.jobWarningAttachmentSkipped` without raw placeholders. Retrying a job SHALL clear previous warning metadata. Existing code-only callbacks SHALL remain supported. Translation stays app-owned; no new flag, endpoint, telemetry, or directional layout behavior is required.

#### Scenario: Referenced attachment is missing

- **WHEN** a `.dial` archive references `absent.pdf` without its resource entry
- **THEN** the conversation still imports and both notification and queue warning name `absent.pdf`, without a raw `{{names}}` placeholder

#### Scenario: Multiple attachments and jobs

- **WHEN** several attachments are skipped or several jobs have warnings
- **THEN** each row uses the unique skipped names from that job and no names from another job, with the same overflow summary as its notification

#### Scenario: Legacy job has no names

- **WHEN** a warning job has no attachment names
- **THEN** the app shows its generic warning without raw placeholders

#### Scenario: Retry clears previous warning

- **WHEN** a job is retried
- **THEN** its new attempt begins without previous warning code or names
