## Why

### Problem

Skill and scheduled-task authors currently write Description and Instructions without rewriting assistance. Imprecise skill descriptions impair discovery; imprecise unattended task instructions repeatedly produce weak reports. The two requests describe one capability and must not grow separate backend endpoints or incompatible interaction models.

## What Changes

### Solution

- Introduce one additive `ai-text-refinement` capability covering both fields in both create/edit forms, one versioned `POST /api/v1/text-refinement` endpoint, and four server-owned purpose-specific prompts.
- Supply optional `onRefineDescription(value, signal)` and `onRefineInstructions(value, signal)` callbacks to both libraries. The application owns transport, authentication, configuration, and purpose selection.
- Use the same immediate replacement + Undo interaction everywhere. Maintain a pre-refinement baseline until manual editing; errors and cancellation never replace text. A reusable host-agnostic hook in `chat-shared` owns request/undo state; each form retains its existing value ownership.
- Show an end-aligned sparkle/text action per supported field, field-local pending/error feedback, English label defaults, theming hooks, and translated host labels. Support mobile, RTL, and WCAG 2.1 AAA.
- Generate the API client from Swagger; document configuration, callback contracts, and architecture with automated verification.

### Non-goals

Streaming, preview/diff/Accept/Discard UI, automatic saving or executing tasks, refining names or supporting files, sibling-field context, a user-selectable model, a generic user-supplied prompt endpoint, new quota infrastructure, and unrelated library cleanup.

## Capabilities

### New Capabilities

- `ai-text-refinement`: Shared opt-in text refinement for skill/task Description and Instructions, including API, library callbacks, safe replacement/undo lifecycle, host wiring, accessibility, and verification.

### Modified Capabilities

None. This is a single additive optional capability. Existing `skill-editor-library` and `scheduled-task-create-form` requirements continue to govern value ownership, saving, and hosts that omit the new callbacks; their requirements are not replaced or duplicated here.

## Impact

- Backend: new `apps/chat-api/src/text-refinement/` domain; existing `UTILITY_MODEL` configuration and runtime availability in app-config; generated `libs/chat-api-client` artifacts. Follow the SDK integration at `apps/chat-api/src/conversations/conversation-naming.service.ts:390` and the current `apps/chat-api/src/dial/dial-client.service.ts:33`. The input proposals' `app/app.service.ts` reference is stale and that file does not exist.
- Frontend: new thin `apps/chat/src/server-api/text-refinement.api.ts` adapter following `apps/chat/src/server-api/skills.api.ts:20`, plus skill and scheduled-task create/edit page wiring.
- Libraries: `skill-editor`, `scheduled-tasks`, and a deliberately small shared hook in `chat-shared`. No new package or global context. The boundary was checked: shared code accepts text/callbacks only; endpoint/model/auth/feature knowledge stays in apps.
- Existing state references: `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:106` owns values and `updateValues`; `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts:197` defines the controlled `onFieldChange` channel. Refine/Undo must preserve these contracts and dirty tracking.
- New i18n keys use `textRefinement.*`; libraries receive resolved strings and retain optional English defaults.
- Documentation updates during implementation cover the three library READMEs, backend README and `.env.template`, and the backend domain/API map in `docs/architecture.md`. Local `.env` contents are not copied into planning artifacts or changed.

### Alternatives considered

| Option | Correctness and delivery | Security/performance | Compatibility/rollback |
| --- | --- | --- | --- |
| Keep current forms | Lowest effort; does not solve either request | No extra model calls | No migration |
| Separate skill/task endpoints and lifecycles | Easy initial isolation; duplicated logic drifts | Duplicates validation and model policy | Two contracts to maintain/revert |
| Shared endpoint and shared replacement/Undo lifecycle (selected) | Four purpose prompts, one tested lifecycle; modest shared-library scope | Bounded non-streaming calls, caller credentials, server prompts | Optional props/configuration; omit callbacks to restore current UI |
| Shared endpoint with preview/Accept/Discard | Explicit review but substantially more editor/layout state | Similar model cost | More UI and accessibility surface to maintain |

### Acceptance criteria

- Both fields in skill and task create/edit forms use the same capability; missing callbacks hide the corresponding actions.
- Empty/whitespace-only input and pending/submitting forms cannot start refinement. Pending text remains readable, and requests cannot overwrite later drafts or another entity.
- Successful results use the existing value-change channels, support Undo, and preserve Markdown and existing save validation. Failures/abort keep text and any earlier Undo baseline.
- One typed, bounded, authenticated API handles all four purposes with validated server model configuration, typed failures, cancellation/timeout, and no prompt-body logging.
- Tests cover lifecycle races, callback opt-in, labels/styles, accessibility/RTL, host mapping, API validation/auth/errors, and all four purpose prompts; OpenAPI, client build/lint, and docs checks pass.

### Compatibility and rollback

All new callbacks, labels, and style overrides are optional; existing required scheduled-task labels remain unchanged. With `UTILITY_MODEL` absent or blank, the feature is unavailable and the host omits callbacks. No data migration is needed: results stay in the draft until ordinary Save. Roll back refinement by removing its host wiring; the shared utility model also serves conversation naming, so removing its configuration disables that consumer too; leave the additive endpoint and generated types unused if deploying frontend/backend separately.
