## ADDED Requirements

### Requirement: Skill import has a public headless controller

`@epam/ai-dial-chat-hooks/skill-editor` SHALL export `useSkillArchiveImport` with named public options/result/status/error-kind types. The hook SHALL own dialog visibility, local rejection, in-flight state and import completion. It SHALL receive the configured import request and host completion/error callbacks; it SHALL NOT import app contexts, routing, i18n, notification transports, or initialize an API client. Error outcomes SHALL be semantic values rather than translation keys.

#### Scenario: Import without parent providers
- **WHEN** an independent host supplies an import callback and selects a valid ZIP or exactly named `SKILL.md`
- **THEN** the hook closes selection, enters uploading, submits that file once, invokes the successful completion adapter once, and reaches success without parent providers

#### Scenario: Local filename rejection
- **WHEN** a selected Markdown filename is not exactly `SKILL.md`, or the host dropzone rejects the selection
- **THEN** the hook exposes a selection rejection, leaves the open dialog available for another choice, and sends no request or global error notification

#### Scenario: Concurrent submissions and retry
- **WHEN** a second open/select action occurs while an import is pending
- **THEN** no second request starts
- **AND** after the prior operation settles a new selection, including the same file, can be submitted

#### Scenario: Empty selection and unmount
- **WHEN** selection is empty or an outstanding operation completes after unmount
- **THEN** empty selection initiates no request and late completion performs no hook state update or host completion notification

### Requirement: Import failures preserve host feedback behavior

The controller SHALL classify 400/413/422 as validation, 409 as collision, 429 as rate limited, 502/503 as unavailable, and all other failures as generic. The host SHALL translate outcomes and resolve/display trace IDs only for generic failures. Successful import SHALL invoke the existing host success notification and awaited list refresh; refresh failure SHALL NOT cause an automatic repeat of the import request.

#### Scenario: Mapped and generic failures
- **WHEN** the request fails with a mapped status or an unmapped/network failure
- **THEN** the hook exposes the corresponding error kind and invokes the error adapter once, with no success callback for a failed request
- **AND** the parent adapter preserves its existing translated messages and generic-only trace-ID behavior

#### Scenario: Refresh after creation
- **WHEN** creation succeeds but the host's awaited refresh rejects
- **THEN** the existing error feedback path handles that rejection without submitting the archive again

### Requirement: Upload dialog is reusable presentation

`@epam/ai-dial-skills` SHALL export `SkillArchiveUploadDialog` and all reachable prop/label types. It SHALL receive labels, accepted-file hint, open/error state and selection/rejection/close callbacks without importing the import controller or generated API types. Native file selection and drag/drop SHALL preserve current behavior, keyboard operation, focus restoration and inline errors. Host status feedback SHALL remain accessible through the existing live region. Layout SHALL support RTL and existing mobile/desktop presentation.

#### Scenario: Second host renders the dialog
- **WHEN** a host supplies its own translated labels and callbacks under `dir="rtl"`
- **THEN** the dialog displays those labels, supports keyboard close and file selection, exposes its error text accessibly, and uses logical layout

#### Scenario: Parent adapter remains responsible for integration
- **WHEN** the parent Catalog starts an import using the public hook and dialog
- **THEN** its existing request wrapper, skill-list refresh, feature policy and notification adapters remain in the app
- **AND** no new i18n key, HTTP endpoint, cache, telemetry transport or feature flag is required
