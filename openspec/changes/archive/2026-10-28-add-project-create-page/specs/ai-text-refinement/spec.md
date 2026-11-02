## ADDED Requirements

### Requirement: Project Description and Instructions are refinable

`ProjectCreateFormProps` SHALL accept the optional `onRefineDescription` and `onRefineInstructions` callbacks, both `(value: string, signal: AbortSignal) => Promise<string>`. They are rendered through the shared `TextRefinementField` + `useTextRefinement`, with the same one-pending-refinement, Undo and disabled-submit rules as the Skill Editor. `ProjectCreatePage` SHALL supply them only when `config.aiTextRefinementAvailable` is true, using the purposes `project-description` and `project-instructions`.

#### Scenario: Project Instructions are refined

- **WHEN** refinement is available and the user refines project Instructions
- **THEN** the host calls `refineText` with purpose `project-instructions`, and the refined Markdown replaces Instructions with Undo available

#### Scenario: Project purposes respect the projects flag

- **WHEN** a user for whom `projectsEnabled` resolves `false` calls `refineText` with `project-description`
- **THEN** the endpoint returns `403` before any model invocation

## MODIFIED Requirements

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
