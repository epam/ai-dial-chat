## Purpose

Provide shared AI-assisted refinement of skill and scheduled-task descriptions and instructions, with field-local Undo, safe cancellation, and a single authenticated API using the shared utility model.

## ADDED Requirements

### Requirement: One opt-in capability for both authoring forms

`SkillEditorProps` and `ScheduledTaskCreateFormProps` SHALL each accept optional `onRefineDescription?: (value: string, signal: AbortSignal) => Promise<string>` and `onRefineInstructions?: (value: string, signal: AbortSignal) => Promise<string>`. Both create and edit flows SHALL use this contract. Each action SHALL render only when its own callback is supplied and SHALL appear as an end-aligned sparkle icon plus visible Refine with AI text beside the field label. Libraries SHALL contain no endpoint/model/auth/configuration/i18n/navigation knowledge.

#### Scenario: Host opts into only one field
- **WHEN** the host supplies only `onRefineInstructions`
- **THEN** only Instructions shows Refine with AI and Description retains its existing behavior
- **AND** a host supplying neither callback has neither action

#### Scenario: Scheduled-task naming remains compatible
- **WHEN** task Instructions are refined or restored
- **THEN** the library calls `onFieldChange('prompt', text)` while the public callback remains `onRefineInstructions`
- **AND** Description uses `onFieldChange('description', text)` without introducing another data-field spelling

### Requirement: Shared lifecycle with existing form value ownership

A reusable `useTextRefinement` hook in `libs/chat-shared` SHALL own field-local pending/error/undo state, abort controllers, and request revisions. It SHALL accept only host-agnostic values, callbacks, and lifecycle controls. SkillEditor SHALL retain value ownership and use its existing update path, `onValuesChange`, and dirty tracking. The task form SHALL retain host-controlled values through `onFieldChange`. Each form SHALL coordinate at most one pending refinement; no global context SHALL be introduced. Host adapters SHALL use stable `useCallback` callbacks and memoized labels without treating callback identity alone as a reset.

#### Scenario: An unrelated edit is retained
- **WHEN** Description refinement resolves after the author edited another editable field
- **THEN** only Description changes and the most recent other-field values remain intact
- **AND** existing dirty-state and change callbacks reflect the resulting draft

#### Scenario: Separate form instances
- **WHEN** one form starts refinement
- **THEN** another mounted form's text, pending state, and Undo baseline remain independent

### Requirement: Safe pending and submission behavior

The action SHALL be disabled for empty/whitespace-only text, while either field in the same form is refining, and while the form is loading/submitting or otherwise unavailable for editing. During refinement, both fields and their toolbars SHALL remain editable. An edit to the active field SHALL immediately abort and invalidate its request, so a late result cannot overwrite the edit. Read-only behavior is deferred by the user decision of 2026-09-24. The active button SHALL display a spinner while retaining its accessible name. Save SHALL be disabled and its handler SHALL reject submission during refinement; Cancel and Back SHALL remain available.

#### Scenario: Empty input and duplicate activation
- **WHEN** a field contains only whitespace or a refine is pending
- **THEN** activating its disabled action does not call a callback
- **AND** rapid repeated activation starts at most one request for the form

#### Scenario: Pending controls
- **WHEN** Instructions refinement is in progress
- **THEN** both Refine actions and Save are disabled; typing or a toolbar edit in Instructions cancels its request without overwriting the edit; Description remains editable
- **AND** no save request can be dispatched through keyboard/form submission

### Requirement: Replacement and recoverable Undo

A changed successful result SHALL replace only its originating field through the established value-change channel and SHALL offer Undo. The baseline SHALL be the exact original text before the first successful refinement since the last manual edit/reset. Repeated refinements SHALL retain that baseline. Manual editing SHALL clear Undo only for the edited field. Undo SHALL restore the baseline exactly and clear that field's refinement feedback/baseline. Identical results SHALL not create a new write or Undo baseline and SHALL announce that no changes were needed. Refinement SHALL never automatically save, execute, or persist the draft.

#### Scenario: Success and Undo
- **WHEN** refinement changes text A to B and the author activates Undo
- **THEN** A is restored through the same field update channel, including its whitespace and Markdown
- **AND** the normal form save/dirty behavior remains in effect

#### Scenario: Repeated refinement preserves the author's baseline
- **WHEN** A becomes B and then C without manual editing
- **THEN** Undo restores A rather than B
- **AND** a failure on a subsequent attempt preserves C and the ability to restore A

#### Scenario: Manual edit invalidates only its own Undo
- **WHEN** the author manually edits a refined field
- **THEN** its Undo disappears without changing the edited text or another field's Undo

#### Scenario: Unchanged output
- **WHEN** the callback returns the exact current value
- **THEN** the form announces no change, creates no new value update, and preserves any pre-existing Undo baseline

### Requirement: Errors and cancellation never overwrite drafts

Rejected promises, timeout, blank output, or invalid upstream output SHALL preserve current text and an existing Undo baseline, surface inline generic errors, and permit an explicit retry. Even custom host callbacks returning whitespace-only text SHALL be treated as failures. Refinement errors SHALL coexist with existing field validation rather than overwrite it. Abort SHALL not display a failure. On unmount, navigation, Cancel/Back, entity reset, external value replacement, removal of the relevant callback, or externally initiated submission, the request SHALL be aborted and invalidated. Late responses SHALL be ignored even if the callback ignores the signal. Switching task identity SHALL remount/reset refinement state even when texts are equal; skill `initialValues` reseeding SHALL clear previous entity state. Undo is session-local; ordinary unsaved-navigation policy remains unchanged.

#### Scenario: Empty or failed response
- **WHEN** the callback rejects or returns only whitespace
- **THEN** the field remains unchanged, an inline error is announced, and the author can retry or use any existing Undo

#### Scenario: Abort on leaving the form
- **WHEN** the author navigates away or the form unmounts during a request
- **THEN** the supplied AbortSignal becomes aborted
- **AND** a later resolution/rejection causes no field update or UI notification

#### Scenario: Stale result after reset
- **WHEN** a host replaces the field value or switches to another entity before an old request resolves
- **THEN** that request cannot overwrite the new draft or install an Undo baseline for the old entity

### Requirement: Shared typed refinement API

The backend SHALL expose exactly one non-streaming refinement endpoint: `POST /api/v1/text-refinement`, operationId/SDK method `refineText`, tag `text-refinement`, `RefineTextRequestDto`, and `RefineTextResponseDto`. The JSON request SHALL contain only `purpose` and `text`. `purpose` SHALL be a string enum allowing the four values below. Successful responses SHALL be HTTP 200 with `{ "text": "..." }` and `Cache-Control: no-store`.

| Purpose | Maximum input/output characters |
| --- | ---: |
| `skill-description` | 4,000 |
| `skill-instructions` | 32,000 |
| `scheduled-task-description` | 500 |
| `scheduled-task-instructions` | 32,000 |

Lengths SHALL count Unicode code points consistently with DTO validators. Inputs SHALL be non-whitespace strings and SHALL be sent without destructive trimming. These limits SHALL NOT change ordinary form-save limits. The request SHALL reject unknown keys, unsupported purpose values, missing fields, non-string text, and text over the applicable limit. DTOs SHALL publish validation and limits through Swagger. No input/output SHALL be silently truncated.

Example request:

```json
{ "purpose": "scheduled-task-instructions", "text": "## Report\nSummarize yesterday's incidents.\n- Include severity.\n- Link the source." }
```

Example response:

```json
{ "text": "## Report\nSummarize the incidents reported yesterday.\n- State the severity of each incident.\n- Include a link to each incident's source." }
```

Error responses SHALL use the existing Nest exception envelope (`statusCode`, `message`, `error`) with these outcomes:

| Code | Condition |
| --- | --- |
| 400 | Request shape, purpose, blank input, or purpose-specific length validation fails |
| 401 | Missing/expired authentication under the deployment's existing auth policy |
| 403 | CSRF rejection, scheduled-task feature denial, or upstream model permission denial |
| 413 | Existing global HTTP body-size limit rejects the request before DTO validation |
| 429 | DIAL Core rate limit/quota rejection |
| 502 | Other upstream HTTP failures or malformed, empty, truncated, oversized output |
| 503 | Model not configured, network unavailability, or 30-second deadline exceeded |

#### Scenario: All four purposes share one operation
- **WHEN** either form refines either field with valid text
- **THEN** its host calls the same `refineText` operation with the appropriate discriminator and receives a typed text response

#### Scenario: Input is rejected before model invocation
- **WHEN** a request is missing text, has an unknown purpose/key, or exceeds its purpose's limit
- **THEN** the endpoint returns 400 and does not invoke DIAL Core
- **AND** a task Description of 501 characters is rejected even though Instructions can be longer

#### Scenario: Generated client is authoritative
- **WHEN** the API is generated from backend Swagger
- **THEN** `TextRefinementApi.refineText` and both DTOs have concrete types
- **AND** `apps/chat/src/server-api/text-refinement.api.ts` calls the normal generated method with `{ signal }` request overrides, not `Raw`, raw fetch, or `base.ts` business wrappers

### Requirement: Server-owned purpose prompts and Markdown preservation

The service SHALL use the configured DIAL SDK via `DialClientService`, select a server-owned prompt by purpose, and send one non-streaming completion. It SHALL treat supplied text as content to rewrite, preserving its language, intent, factual constraints, identifiers, URLs, and placeholders. Skill Description SHALL emphasize triggering conditions; skill Instructions SHALL clarify procedure; task Description SHALL summarize the unattended task; task Instructions SHALL clarify steps and expected report without inventing schedule, tools, or data sources. Instructions SHALL retain Markdown structure and fenced code content rather than be converted to plain prose or wrapped in an extra outer code fence. No sibling field, supporting file, or conversation context SHALL be sent. The backend SHALL validate output bounds/completeness and return a typed failure instead of null or a fabricated fallback.

#### Scenario: Instructions contain Markdown and placeholders
- **WHEN** Instructions include headings, lists, links, fenced code, and template placeholders
- **THEN** the selected prompt explicitly requires preserving those structures and code/placeholder content
- **AND** a valid model response is returned/applied without a destructive plain-text conversion

#### Scenario: Description purposes have different objectives
- **WHEN** otherwise identical input is refined as skill Description and task Description
- **THEN** the service selects different server prompts for skill triggering versus task summary
- **AND** the client cannot override either prompt or select a model

#### Scenario: Invalid output
- **WHEN** DIAL Core returns no usable text, output over the purpose limit, or a truncated completion
- **THEN** the service returns 502 without exposing or persisting the output

### Requirement: Configuration, authorization, and bounded execution

Refinement SHALL reuse the existing optional `UTILITY_MODEL` and its current boot-time string validation. It SHALL NOT introduce a separate model variable or tighten the shared variable's validation. An absent or blank value disables refinement availability; surrounding whitespace SHALL be trimmed before availability evaluation and model invocation. Existing client configuration SHALL expose only optional `config.aiTextRefinementAvailable`, derived from model presence; missing means false for compatibility. Hosts SHALL omit callbacks when unavailable. The endpoint SHALL still enforce authorization and configuration server-side.

There SHALL be no new `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` key and no refinement-specific role. Existing skill authoring authentication SHALL apply to skill purposes; scheduled-task purposes SHALL additionally require the existing `features.scheduledTasksEnabled` decision, including its existing role configuration. Requests SHALL use the caller's DIAL credentials without a service-credential fallback. Existing cookie-session CSRF protection SHALL apply. Calls SHALL have a 30-second timeout; disconnect/abort SHALL cancel upstream work and release resources. No automatic retry or BFF quota store SHALL be added; upstream 429 SHALL be preserved.

#### Scenario: Capability unavailable
- **WHEN** the model variable is absent or a client sees an older config response without the availability field
- **THEN** the host supplies no refinement callbacks
- **AND** direct authenticated endpoint calls without model configuration receive 503

#### Scenario: Purpose does not bypass feature authorization
- **WHEN** a user lacking scheduled-task access calls either scheduled-task purpose directly
- **THEN** the endpoint returns 403 before model invocation even if the user can author skills

#### Scenario: Request lifetime is bounded
- **WHEN** the caller disconnects or the deadline expires
- **THEN** the SDK signal is aborted and timeout/listener resources are cleaned up
- **AND** timeout returns 503 if a response can still be sent; disconnected clients cause no draft mutation

### Requirement: Optional labels and themed feedback

Both form labels interfaces SHALL add the optional properties below with English defaults. Existing required task labels SHALL remain required and existing consumers SHALL not need to supply new ones. The app SHALL supply translations through its existing i18n layer; libraries SHALL not import i18n.

| Label property | English default | App key |
| --- | --- | --- |
| `refineWithAiLabel` | Refine with AI | `textRefinement.action` |
| `refineUndoLabel` | Undo | `textRefinement.undo` |
| `refineErrorLabel` | Could not refine this text. Please try again. | `textRefinement.error` |
| `refinePendingAriaLabel` | Refining text | `textRefinement.pending` |
| `refineSuccessAriaLabel` | Text refined. Undo is available. | `textRefinement.success` |
| `refineUndoAriaLabel` | Original text restored. | `textRefinement.restored` |
| `refineUnchangedAriaLabel` | No changes were needed. | `textRefinement.unchanged` |

Both libraries SHALL offer optional `colors.refineActionText`, `colors.refineErrorText`, `typography.refineActionClassName`, and `typography.refineFeedbackClassName`. Color overrides SHALL use `buildCssVars`, `--se-refine-*` / `--stcf-refine-*`, and `var(--lib-property, var(--theme-token, #hex))` fallback chains. Default typography SHALL be `dial-small-text`. Default/fallback text colors SHALL meet 7:1 contrast against the rendered fallback background. New public styling hooks SHALL follow each library's existing constant/export convention.

#### Scenario: Existing label object remains valid
- **WHEN** an existing host supplies its old labels and the new callbacks
- **THEN** refinement uses the English defaults and existing form labels remain intact
- **AND** supplied translated labels and style overrides take effect on both Refine and Undo feedback

### Requirement: Accessible mobile and RTL interaction

The action SHALL be a keyboard-operable button with a stable accessible name and a separate associated field label. The pending field region SHALL have `aria-busy`, pending/success/Undo/no-change feedback SHALL use a polite live status region, and inline errors SHALL use `role="alert"` and field association. Focus SHALL remain usable through pending and Undo transitions. Decorative sparkle/spinner/other icons SHALL be `aria-hidden`; Tabler outlines SHALL use `stroke={DIAL_KIT_ICON_STROKE}`.

Layout SHALL use logical properties and named `mobile`/`desktop` breakpoints, wrap label/action content without horizontal overflow at 360px, and provide at least 44x44 CSS-pixel hit areas. RTL SHALL inherit direction without library locale lookup; end alignment SHALL flip, sparkle SHALL not flip, and directional glyphs SHALL mirror. Hidden focusable UI SHALL be unmounted or inert. The interaction SHALL meet WCAG 2.1 AAA requirements.

#### Scenario: Assistive technology tracks refinement
- **WHEN** a keyboard user activates Refine and receives success or failure
- **THEN** the button retains its name while spinning, field busy state and completion/error are announced, and Undo is keyboard reachable after success

#### Scenario: Narrow Arabic layout
- **WHEN** the form is rendered at 360px with an RTL ancestor and translated labels
- **THEN** label/actions wrap without overflow, logical end alignment mirrors, and text/buttons remain readable and reachable without hover

### Requirement: Privacy, documentation, and verification

Refinement SHALL use existing request-duration/error observability at the app edge. Logs SHALL exclude input text, system prompts, output text, raw upstream bodies, and credentials; only bounded purpose/status/duration/length metadata is permitted. No new analytics transport SHALL be embedded in a library. Results SHALL not be cached (TTL zero; no cache key or invalidation mechanism) or persisted by the endpoint.

Implementation SHALL update affected library READMEs, backend README and `.env.template`, and `docs/architecture.md` domain/API map and affected diagrams. Generated client artifacts SHALL come from Swagger via `npm run openapi` and `npm run openapi:check`, with client build/lint and `npm run validate:docs`. Automated tests SHALL cover every lifecycle path above, all purposes, host mapping, auth/validation/upstream failures, and accessibility/RTL. Unit tests SHALL mock upstream models rather than make live paid requests.

#### Scenario: Operational evidence without draft leakage
- **WHEN** a request succeeds, fails, or is aborted
- **THEN** available request metrics describe its outcome without logs or analytics containing authored/refined text
- **AND** no cache or saved entity receives the draft

#### Scenario: Public contract is published consistently
- **WHEN** the feature is ready for implementation completion
- **THEN** generated APIs, documented props/labels/styles, env configuration, and architecture agree with the implemented behavior and their automated checks pass
