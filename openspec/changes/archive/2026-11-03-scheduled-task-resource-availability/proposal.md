## Why

Saved scheduled tasks can reference skills or deployments that were deleted or whose access was revoked. Raw resource paths hide the problem, and the editor previously allowed known-invalid selections to reach submission.

## What Changes

- Resolve selected skill availability using the current catalog and existing metadata adapter; treat metadata 400/403/404 as unavailable.
- Wait for availability in previews, then show short names, localized unavailable suffixes, error styling and tooltips.
- Render removable error tags and invalid deployment fields in editing; guard both Save and request preparation.
- Keep network, catalog and translation decisions in the app and expose optional presentation props in the libraries.

## Capabilities

### New Capabilities
- `scheduled-task-resource-availability`: Shared behavior for availability checks, previews and editing.

### Modified Capabilities
- `scheduled-task-detail-page`: Replace raw-reference presentation for confirmed unavailable resources and hide pending values.
- `scheduled-task-multiple-skills`: Allow unavailable tag presentation and ordered removal.
- `scheduled-task-create-form`: Add host save gating and distinguish availability from model compatibility.
- `skill-input-attachment`: Extend the reusable controlled selector with optional unavailable-tag props.

## Impact

Touches the chat adapters and scheduled-tasks/skills presentation libraries. Existing metadata and deployment APIs, generated clients, scheduler payloads and feature flags remain unchanged. New optional props preserve existing consumers. New labels reuse app translation enums and library label props. No backend, persistence or architecture-layer changes.

## Non-goals

No server API changes, realtime revocation subscription, polling, or changes to Start now authorization. Catalog snapshots are not continuous access guarantees.

## Acceptance Criteria

- Pending metadata never flashes a saved path in preview.
- HTTP 400/403/404 produce unavailable skill state; 503 does not.
- Model catalog loading/errors do not falsely indicate deletion.
- Unavailable tags and models remain removable/replaceable and block direct submission.
- Relevant unit/integration tests and spec/documentation validation pass.

## Alternatives and Compatibility

Keeping raw paths fails to explain unavailable selections. Adding API knowledge to the libraries violates isolation. App-owned resolution with optional library props follows the existing `ScheduledTaskSkillField` and `DeploymentSelectorFieldTrigger` adapters. Rollback removes those optional props and app wiring without migrating stored tasks.
