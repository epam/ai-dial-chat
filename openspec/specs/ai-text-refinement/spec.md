# ai-text-refinement Specification

## Purpose

Provide shared AI-assisted refinement of skill and scheduled-task descriptions and instructions, of application, toolset, and prompt descriptions, and of prompt instructions, with field-local Undo, safe cancellation, and a single authenticated API using the shared utility model.

## Requirements

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

### Requirement: Every entity Description control is refinable

`ToolsetEditorProps` and `PromptEditorProps` SHALL each accept optional `onRefineDescription?: (value: string, signal: AbortSignal) => Promise<string>`, rendered through the shared `TextRefinementField` around `MetadataForm`'s Description via `renderDescription`; `ToolsetEditorLabels.refinement` and `PromptEditorLabels` (which extends `TextRefinementLabels`) carry the copy. The host application editor (custom, quick, and schema apps) SHALL wrap its own `MetadataForm` Description the same way. Hosts SHALL supply the callback only when refinement is available, using `application-description` for the application editor, `toolset-description` for the toolset editor, and `prompt-description` for the prompt editor. Save SHALL be disabled while a Description refinement is pending.

#### Scenario: Toolset Description is refined
- **WHEN** refinement is available and the author activates Refine with AI on a toolset Description
- **THEN** the host calls `refineText` with purpose `toolset-description` and the refined text replaces the Description, with Undo available

#### Scenario: Refinement unavailable
- **WHEN** the client config reports refinement unavailable
- **THEN** the application, toolset, and prompt Description fields render without the Refine with AI action

### Requirement: Prompt Instructions are refinable

`PromptEditorProps` SHALL additionally accept optional `onRefineInstructions?: (value: string, signal: AbortSignal) => Promise<string>`. When supplied, the Instructions `MarkdownEditor` SHALL be wrapped in the shared `TextRefinementField` (labelled by the Instructions label, `required`, with the editor's `id` as `fieldId`), which renders the Refine with AI action and Undo beside the Instructions label exactly as for Description; when omitted, the Instructions label and editor render unchanged and no action appears. The refinement copy SHALL come from the same `PromptEditorLabels` (`TextRefinementLabels`) fields as Description. The result SHALL be published through the existing content update path, so `onFieldChange('content', text)` fires and dirty tracking applies. The prompt form SHALL coordinate at most one pending refinement: while either Description or Instructions refines, both Refine actions are disabled, Save is disabled and its handler rejects submission, and Cancel/Back reset both fields' refinement state. The host SHALL supply the callback only when refinement is available, using purpose `prompt-instructions`.

#### Scenario: Prompt Instructions are refined
- **WHEN** refinement is available and the author activates Refine with AI beside the prompt Instructions label
- **THEN** the host calls `refineText` with purpose `prompt-instructions`, the refined Markdown replaces Instructions through `onFieldChange('content', text)`, and Undo restores the original text

#### Scenario: One refinement per prompt form
- **WHEN** a prompt Instructions refinement is pending
- **THEN** the Description Refine action and Save are disabled, and activating Save does not call `onSubmit`

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

The action SHALL be disabled for empty/whitespace-only text, while either field in the same form is refining, and while the form is loading/submitting or otherwise unavailable for editing. While a field refines, `TextRefinementField` SHALL make that field's control (the element whose `id` equals `fieldId`) read-only, so its original text stays visible and cannot be typed over, and SHALL restore the control's previous read-only state when the request settles, is aborted, or the field unmounts. The other field in the same form SHALL remain editable. Any edit that still reaches the active field during refinement (for example a Markdown toolbar action) SHALL immediately abort and invalidate its request, so a late result cannot overwrite the edit. This supersedes the 2026-09-24 decision to keep the refining field editable. While pending, the active action SHALL show a spinner in place of its sparkle icon, its visible label and accessible name SHALL read `refineRefiningLabel` ("Refining"), and it SHALL stay disabled until the response returns. Save SHALL be disabled and its handler SHALL reject submission during refinement; Cancel and Back SHALL remain available.

#### Scenario: Empty input and duplicate activation
- **WHEN** a field contains only whitespace or a refine is pending
- **THEN** activating its disabled action does not call a callback
- **AND** rapid repeated activation starts at most one request for the form

#### Scenario: Pending controls
- **WHEN** Instructions refinement is in progress
- **THEN** the Instructions control is read-only and shows the text that was sent, its action reads "Refining" with a spinner and is disabled, and the Description Refine action and Save are disabled; Description remains editable
- **AND** a toolbar edit in Instructions cancels its request without being overwritten
- **AND** no save request can be dispatched through keyboard/form submission

#### Scenario: Read-only ends with the request
- **WHEN** the pending request succeeds, fails, or is aborted
- **THEN** the control is editable again exactly as before the request

### Requirement: Replacement and recoverable Undo

A changed successful result SHALL replace only its originating field through the established value-change channel. While a refinement baseline exists, the action row SHALL show the Undo action, labelled `refineUndoLabel` ("Restore original") with a restore icon, followed by a Regenerate action labelled `refineRegenerateLabel` ("Regenerate") with the sparkle icon, and SHALL NOT show the Refine with AI action. The baseline SHALL be the exact original text before the first successful refinement since the last manual edit/reset. Regenerate SHALL call the host callback with that baseline, not with the current refined text, so each result is a fresh variant of the author's draft; repeated Regenerate SHALL retain the baseline. Manual editing SHALL clear the baseline only for the edited field and return it to the Ready state (Refine with AI, no Restore original). Restore original SHALL restore the baseline exactly and clear that field's refinement feedback/baseline. A result identical to the current value SHALL not create a new write or Undo baseline and SHALL announce that no changes were needed. Refinement SHALL never automatically save, execute, or persist the draft. The baseline and the regenerate source are owned by `useTextRefinement` in `libs/chat-shared/src/hooks/useTextRefinement.ts`.

#### Scenario: Success and Restore original
- **WHEN** refinement changes text A to B and the author activates Restore original
- **THEN** A is restored through the same field update channel, including its whitespace and Markdown
- **AND** the row shows Refine with AI again, and the normal form save/dirty behavior remains in effect

#### Scenario: Result row
- **WHEN** a refinement has replaced the text
- **THEN** the row shows Restore original and Regenerate, and no Refine with AI action

#### Scenario: Regenerate refines the original draft
- **WHEN** A became B and the author activates Regenerate
- **THEN** the host callback receives A, and a changed result C replaces B
- **AND** Restore original still restores A, and a failure on that attempt preserves B and the ability to restore A

#### Scenario: Manual edit returns to Ready
- **WHEN** the author manually edits a refined field
- **THEN** Restore original and Regenerate disappear and Refine with AI returns, without changing the edited text or another field's baseline

#### Scenario: Unchanged output
- **WHEN** the callback returns the exact current value
- **THEN** the form announces no change, creates no new value update, and preserves any pre-existing baseline

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

The backend SHALL expose exactly one non-streaming refinement endpoint: `POST /api/v1/text-refinement`, operationId/SDK method `refineText`, tag `text-refinement`, `RefineTextRequestDto`, and `RefineTextResponseDto`. The JSON request SHALL contain only `purpose` and `text`. `purpose` SHALL be a string enum allowing the ten values below. Successful responses SHALL be HTTP 200 with `{ "text": "..." }` and `Cache-Control: no-store`.

| Purpose | Maximum input/output characters |
| --- | ---: |
| `skill-description` | 4,000 |
| `skill-instructions` | 32,000 |
| `scheduled-task-description` | 500 |
| `scheduled-task-instructions` | 32,000 |
| `application-description` | 2,000 |
| `toolset-description` | 2,000 |
| `prompt-description` | 2,000 |
| `prompt-instructions` | 32,000 |
| `project-description` | 4,000 |
| `project-instructions` | 32,000 |

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
| 403 | CSRF rejection, scheduled-task or projects feature denial, or upstream model permission denial |
| 413 | Existing global HTTP body-size limit rejects the request before DTO validation |
| 429 | DIAL Core rate limit/quota rejection |
| 502 | Other upstream HTTP failures or malformed, empty, truncated, oversized output |
| 503 | Model not configured, network unavailability, or 30-second deadline exceeded |

#### Scenario: All purposes share one operation
- **WHEN** any refinable form refines any of its fields with valid text
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

The service SHALL use the configured DIAL SDK via `DialClientService`, select a server-owned prompt by purpose, and send one non-streaming completion. Each purpose's built-in prompt MAY be replaced by an operator through an optional server-only env var — `TEXT_REFINEMENT_SKILL_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_SKILL_INSTRUCTIONS_PROMPT`, `TEXT_REFINEMENT_SCHEDULED_TASK_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_SCHEDULED_TASK_INSTRUCTIONS_PROMPT`, `TEXT_REFINEMENT_APPLICATION_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_TOOLSET_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_PROMPT_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_PROMPT_INSTRUCTIONS_PROMPT`, `TEXT_REFINEMENT_PROJECT_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_PROJECT_INSTRUCTIONS_PROMPT` (declared in `environment.config.ts` and `.env.template`) — resolved by `resolvePrompt`: an unset, empty, or whitespace-only value keeps the built-in default, and a nonblank value replaces the whole prompt. Clients cannot override prompts. It SHALL treat supplied text as content to rewrite, never as a request to answer or perform: the user turn SHALL carry the draft fenced in `<draft>` tags beneath a fixed rewrite instruction (built by `wrapRefinementDraft` in `apps/chat-api/src/text-refinement/prompts/refinement-draft.prompt.ts`), for built-in and overridden prompts alike, and an answer that only echoes those tags around the result SHALL be unwrapped before validation. It SHALL preserve its language, intent, factual constraints, identifiers, URLs, and placeholders. Skill Description SHALL emphasize triggering conditions; skill Instructions SHALL clarify procedure; task Description SHALL summarize the unattended task; task Instructions SHALL clarify steps and expected report without inventing schedule, tools, or data sources; application Description SHALL explain what the application does and when to choose it; toolset Description SHALL explain which capabilities the toolset provides without inventing tools, endpoints, or auth requirements; prompt Description SHALL state what the prompt is for; prompt Instructions SHALL be rewritten as a clearer version of the same prompt-template text, keeping template variables such as `{{name}}` verbatim and never answering or executing the draft; project Description SHALL state what the project is about and what kind of material it bundles, without inventing files or data; project Instructions SHALL clarify how the assistant should work within the project, without inventing files, data sources, or tools. Instructions SHALL retain Markdown structure and fenced code content rather than be converted to plain prose or wrapped in an extra outer code fence. No sibling field, supporting file, or conversation context SHALL be sent — project context files are never sent. The backend SHALL validate output bounds/completeness and return a typed failure instead of null or a fabricated fallback.

#### Scenario: Instructions contain Markdown and placeholders
- **WHEN** Instructions include headings, lists, links, fenced code, and template placeholders
- **THEN** the selected prompt explicitly requires preserving those structures and code/placeholder content
- **AND** a valid model response is returned/applied without a destructive plain-text conversion

#### Scenario: Description purposes have different objectives
- **WHEN** otherwise identical input is refined as skill Description and task Description
- **THEN** the service selects different server prompts for skill triggering versus task summary
- **AND** the client cannot override either prompt or select a model

#### Scenario: Operator overrides a purpose prompt
- **WHEN** `TEXT_REFINEMENT_SKILL_DESCRIPTION_PROMPT` is set to a nonblank value
- **THEN** skill Description refinement uses that value as its prompt, and the other purposes keep their built-in prompts
- **AND** the draft is still sent inside the `<draft>` envelope

#### Scenario: Draft reads as a request to the model
- **WHEN** skill Instructions contain "Return me 5 phrases from lorem ipsum"
- **THEN** the model receives the draft fenced in `<draft>` tags with an explicit instruction not to answer or perform it
- **AND** the result is a rewritten instruction for the assistant that will use the skill, not five Lorem Ipsum phrases

#### Scenario: Project refinement sends no context files
- **WHEN** project Instructions are refined while the form holds context files
- **THEN** the completion request contains only the server prompt and the `<draft>`-wrapped Instructions text

#### Scenario: Invalid output
- **WHEN** DIAL Core returns no usable text, output over the purpose limit, or a truncated completion
- **THEN** the service returns 502 without exposing or persisting the output

### Requirement: Configuration, authorization, and bounded execution

Refinement SHALL reuse the existing optional `UTILITY_MODEL` and its current boot-time string validation. It SHALL NOT introduce a separate model variable or tighten the shared variable's validation; the only refinement-specific variables are the optional prompt overrides described above. An absent or blank value disables refinement availability; surrounding whitespace SHALL be trimmed before availability evaluation and model invocation. Existing client configuration SHALL expose only optional `config.aiTextRefinementAvailable`, derived from model presence; missing means false for compatibility. Hosts SHALL omit callbacks when unavailable. The endpoint SHALL still enforce authorization and configuration server-side.

There SHALL be no new `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` key and no refinement-specific role. Existing skill authoring authentication SHALL apply to skill purposes; scheduled-task purposes SHALL additionally require the existing `features.scheduledTasksEnabled` decision, and project purposes SHALL additionally require the existing `features.projectsEnabled` decision, each including its existing role configuration. Requests SHALL use the caller's DIAL credentials without a service-credential fallback. Existing cookie-session CSRF protection SHALL apply. Calls SHALL have a 30-second timeout; disconnect/abort SHALL cancel upstream work and release resources. No automatic retry or BFF quota store SHALL be added; upstream 429 SHALL be preserved.

#### Scenario: Capability unavailable
- **WHEN** the model variable is absent or a client sees an older config response without the availability field
- **THEN** the host supplies no refinement callbacks
- **AND** direct authenticated endpoint calls without model configuration receive 503

#### Scenario: Purpose does not bypass feature authorization
- **WHEN** a user lacking scheduled-task access calls either scheduled-task purpose directly
- **THEN** the endpoint returns 403 before model invocation even if the user can author skills

#### Scenario: Project purposes require projects access
- **WHEN** a user lacking projects access calls either project purpose directly
- **THEN** the endpoint returns 403 before model invocation even if the user can author skills

#### Scenario: Request lifetime is bounded
- **WHEN** the caller disconnects or the deadline expires
- **THEN** the SDK signal is aborted and timeout/listener resources are cleaned up
- **AND** timeout returns 503 if a response can still be sent; disconnected clients cause no draft mutation

### Requirement: Optional labels and themed feedback

Both form labels interfaces SHALL add the optional properties below with English defaults. Existing required task labels SHALL remain required and existing consumers SHALL not need to supply new ones. The app SHALL supply translations through its existing i18n layer (`useTextRefinementLabels` in `apps/chat/src/hooks/useTextRefinementLabels.ts`, keys in `TextRefinementI18nKeys`); libraries SHALL not import i18n.

| Label property | English default | App key |
| --- | --- | --- |
| `refineWithAiLabel` | Refine with AI | `textRefinement.action` |
| `refineRefiningLabel` | Refining | `textRefinement.refining` |
| `refineRegenerateLabel` | Regenerate | `textRefinement.regenerate` |
| `refineUndoLabel` | Restore original | `textRefinement.undo` |
| `refineErrorLabel` | Could not refine this text. Please try again. | `textRefinement.error` |
| `refinePendingAriaLabel` | Refining text | `textRefinement.pending` |
| `refineSuccessAriaLabel` | Text refined | `textRefinement.success` |
| `refineUndoAriaLabel` | Original text restored. | `textRefinement.restored` |
| `refineUnchangedAriaLabel` | No changes were needed. | `textRefinement.unchanged` |

Both libraries SHALL offer optional `colors.refineActionText` (the visible refinement status text color — the no-change status; unset, it keeps the kit `CaptionText` color `--text-secondary`), `colors.refineErrorText` (the refinement error color, default `--text-error`), and `typography.refineFeedbackClassName`. There is no `typography.refineActionClassName`: the Refine with AI, Restore original, and Regenerate buttons are kit `GhostButton`s and keep kit styling. Color overrides SHALL use `buildCssVars`, `--se-refine-*` / `--stcf-refine-*`, and `var(--lib-property, var(--theme-token, #hex))` fallback chains. `TextRefinementField` SHALL accept an optional `caption` (e.g. a character counter) rendered at the inline end of the same row as the status, with the status at the inline start, so neither shifts the layout when the other appears; the caption also renders when refinement is disabled. Without overrides the status SHALL render with the kit `CaptionText` styling (`dial-tiny-text`, `--text-secondary`) so it matches input captions everywhere. Default/fallback error colors SHALL meet 7:1 contrast against the rendered fallback background. New public styling hooks SHALL follow each library's existing constant/export convention.

#### Scenario: Existing label object remains valid
- **WHEN** an existing host supplies its old labels and the new callbacks
- **THEN** refinement uses the English defaults for the new labels and existing form labels remain intact
- **AND** supplied translated labels take effect on Refine with AI, Refining, Restore original, and Regenerate, and color/typography overrides take effect on the refinement feedback and error text

### Requirement: Accessible mobile and RTL interaction

Every refinement action SHALL be a keyboard-operable button with a separate associated field label; Refine with AI, Refining, and Regenerate SHALL be one button element whose label changes with the state, so focus stays on it across Ready → Refining → Result. The pending field region SHALL have `aria-busy`. Pending/success/restore/no-change feedback SHALL use one polite live status region that stays mounted; the pending, success, and restore messages SHALL be visually hidden (the action row already shows those states) and the no-change message SHALL stay visible. Inline errors SHALL use `role="alert"` and field association. After Restore original, focus SHALL move to the Refine with AI action, since the activated button unmounts. Decorative sparkle/restore/spinner icons SHALL be `aria-hidden`; Tabler outlines SHALL use `stroke={DIAL_KIT_ICON_STROKE}`.

Layout SHALL use logical properties and named `mobile`/`desktop` breakpoints, wrap label/action content without horizontal overflow at 360px, and provide at least 44x44 CSS-pixel hit areas. RTL SHALL inherit direction without library locale lookup; end alignment SHALL flip; the sparkle and restore icons SHALL not flip (neither expresses a reading direction). Hidden focusable UI SHALL be unmounted or inert. The interaction SHALL meet WCAG 2.1 AAA requirements.

#### Scenario: Assistive technology tracks refinement
- **WHEN** a keyboard user activates Refine with AI and receives success or failure
- **THEN** focus stays on the action while it reads "Refining", field busy state and completion/error are announced, and Restore original and Regenerate are keyboard reachable after success

#### Scenario: Focus after Restore original
- **WHEN** a keyboard user activates Restore original
- **THEN** the original text is restored, "Original text restored." is announced, and focus lands on Refine with AI

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

### Requirement: Project Description and Instructions are refinable

`ProjectCreateFormProps` SHALL accept the optional `onRefineDescription` and `onRefineInstructions` callbacks, both `(value: string, signal: AbortSignal) => Promise<string>`. They are rendered through the shared `TextRefinementField` + `useTextRefinement`, with the same one-pending-refinement, Undo and disabled-submit rules as the Skill Editor. `ProjectCreatePage` SHALL supply them only when `config.aiTextRefinementAvailable` is true, using the purposes `project-description` and `project-instructions`.

#### Scenario: Project Instructions are refined

- **WHEN** refinement is available and the user refines project Instructions
- **THEN** the host calls `refineText` with purpose `project-instructions`, and the refined Markdown replaces Instructions with Undo available

#### Scenario: Project purposes respect the projects flag

- **WHEN** a user for whom `projectsEnabled` resolves `false` calls `refineText` with `project-description`
- **THEN** the endpoint returns `403` before any model invocation
