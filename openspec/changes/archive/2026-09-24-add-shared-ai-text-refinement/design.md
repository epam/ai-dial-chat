## Context

The two supplied requests are one cross-domain capability. There is no existing refinement endpoint or hook in the inspected code. The authoritative additive contract is `specs/ai-text-refinement/spec.md` in this change.

Observed integration points:

- `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:106` owns values, publishes through `onValuesChange`, and reseeds on `initialValues` identity changes. Refinement must not bypass dirty-state reporting or overwrite unrelated edits through a stale values closure.
- `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts` defines controlled values and `onFieldChange`. Instructions are `values.prompt`; no rename of persisted data is needed. Description already has a 500-character backend limit in `apps/chat-api/src/scheduled-tasks/dto/create-scheduled-task.dto.ts`.
- The current task Instructions control has a real `<label htmlFor>` and generated editor ID, rather than the span mentioned in the issue. Preserve that association when adding an adjacent action.
- `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`, `pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx`, and `pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx` are the host composition points.
- `apps/chat-api/src/dial/dial-client.service.ts` owns the configured SDK. `conversations/conversation-naming.service.ts` demonstrates `sendChatCompletionRequest` with a caller token, non-streaming response, and abort signal. Reuse that integration pattern, not its title sanitization or response-body logging.
- Existing feature evaluation is in `apps/chat-api/src/app-config/feature-flags/`; scheduled tasks use `features.scheduledTasksEnabled`. The repository's old `ENABLED_FEATURES` wording must not lead to a parallel flag mechanism.
- Existing main specs contain stale peripheral details (for example the historical skill-editor peer list). This change adds one capability without rewriting those unrelated contracts. Current library packaging rules govern implementation.

Backend conventions are governed by `apps/chat-api/AGENTS.md` sections 1–12. In particular, use domain `tests/` folders per the app's specific guidance where the older general OpenSpec task rule says adjacent backend specs. Library packaging/styling follow `.claude/rules/libs.md`, `.claude/rules/lib-styling.md`, and `openspec/lib-styling-guide.md`.

## Goals / Non-Goals

**Goals:** one endpoint, one reusable async/undo lifecycle, purpose-specific server prompts, optional library APIs, all four create/edit paths, and testable recovery/cancellation behavior.

**Non-Goals:** preview/diff, streaming, autosave, executing/refetching skills or tasks, file contents as context, cross-field context, model selection in the browser, new quota infrastructure, new providers or packages.

## Decisions

### 1. Use a neutral backend domain and a closed purpose enum

Add `apps/chat-api/src/text-refinement/` with controller, service, module, DTOs, prompt definitions, and tests. The single API is `POST /api/v1/text-refinement`, operationId/handler `refineText`, request `RefineTextRequestDto`, response `RefineTextResponseDto`, tag `text-refinement` (generated `TextRefinementApi`). Return HTTP 200 with `{ text }`.

Use a string enum with `skill-description`, `skill-instructions`, `scheduled-task-description`, and `scheduled-task-instructions`. The body contains only `{ purpose, text }`; unknown fields such as `model`, `systemPrompt`, or `context` are rejected by the strict validation pipeline. No entity identifier is required because unsaved drafts are supported and refinement performs no persistence.

Prefer this over locating the endpoint under `skills`: neither authoring domain should own the other's capability. A four-value discriminator is smaller than a generalized prompt-template platform and rules out invalid domain/field combinations.

### 2. Keep configuration and authorization at the app edge

Reuse the existing optional `UTILITY_MODEL` in `EnvironmentVariables` with its current string validation. Do not add a separate model variable or tighten the shared variable's validation. Unset/blank values disable refinement; trim surrounding whitespace before deriving availability and calling DIAL. This follows the user's configuration decision of 2026-09-24. No fallback to the user's selected task/chat model or to a service API key. A fixed 30-second deadline bounds each request.

Add optional `config.aiTextRefinementAvailable: boolean` to `ClientConfigDto`, populated by `AppConfigService` from validated configuration. Older responses without the field mean false. The model identifier is not exposed. Hosts read the existing AppConfig context and supply callbacks only when available. There is no new React provider or separate refinement feature/role flag.

The endpoint uses existing authentication and cookie-session CSRF behavior; it is never public. SDK calls use the current request's DIAL credentials. For scheduled-task purposes, evaluate `FeatureKey.ScheduledTasksEnabled` with the request principal's roles using the existing feature service; a purpose-aware check is required because an OR decorator across domains would allow a bypass. Skill purposes follow existing authenticated skill-authoring access (no new skill role gate). Deployment permission failures remain 403. Existing upstream quota/rate-limit responses remain 429; no new BFF counter/store is introduced.

### 3. Bound and constrain the rewriting operation

Limits count Unicode code points consistently with `class-validator` length validation: skill Description 4,000; task Description 500; either Instructions 32,000. Apply these limits to input and output; reject rather than truncate. These are refinement budgets, not changes to ordinary save limits. Input must contain non-whitespace text, but pass the exact draft to the model to avoid stripping significant Markdown indentation.

The server selects one of four prompts. All prompts preserve language, facts, identifiers, placeholders, URLs, and intent, request only rewritten text, and treat the user text as material to rewrite rather than commands to execute. Skill Description emphasizes when the skill should trigger; skill Instructions clarify procedure and constraints; task Description summarizes the task; task Instructions clarify unattended execution and report structure without inventing schedule, tools, or data sources. Instructions prompts preserve headings, lists, links, and fenced code content and do not wrap the whole answer in a new code fence.

Use `DialClientService.client.sendChatCompletionRequest` with `stream: false`. Propagate request disconnect and timeout cancellation to the SDK. Reject blank, malformed, truncated, or oversized outputs with 502. Map connection/timeout/model-unconfigured cases to 503, permission denial to 403, and upstream quota to 429. Keep upstream response bodies out of logs and user-facing errors. No fallback result, automatic retry, cache, or persistent draft storage.

### 4. Share lifecycle logic while preserving each form's value ownership

Add a host-agnostic `useTextRefinement` hook under `libs/chat-shared/src/hooks/`, with a typed export and JSDoc. Both consumers already use `chat-shared`. The hook knows only a value, an async `(value, signal) => Promise<string>` callback, an `onChange` function, and lifecycle reset/disabled inputs; it contains no domain/purpose enum, API, i18n, config, logging, or routing knowledge. State enums are string enums.

Each field owns its pending/error/undo baseline and request generation via this hook. A form-local busy coordinator permits only one active request for that form; independent form instances remain independent. Each form supplies live value-change adapters. Do not introduce global state or move SDK-backed hooks into either UI library.

Both form interfaces add exactly these optional callbacks:

```ts
onRefineDescription?: (value: string, signal: AbortSignal) => Promise<string>;
onRefineInstructions?: (value: string, signal: AbortSignal) => Promise<string>;
```

Skill success/Undo calls its existing value-update path and publishes the whole latest values object. Scheduled-task success/Undo calls `onFieldChange('description', text)` or `onFieldChange('prompt', text)`. Public callback names consistently say Instructions, while the established task data key remains `prompt`.

Memoize host callback adapters with `useCallback` and resolved label objects with `useMemo`. Maintain live refs/revisions for race checks; callback identity changes alone must not cancel a valid request. No extra `React.memo` requirement.

### 5. Use immediate replacement with a durable Undo baseline

Default design decision: immediate replacement + Undo, as the simpler shared option in both input requests. The clarification question was offered; this is a proposed decision, not a claimed design approval.

| Event | Text and state behavior |
| --- | --- |
| Click Refine | Snapshot exact field value and revision; start request; leave that field editable; edits abort the request; disable both Refine actions and Save |
| Other-field edit | Allowed; does not invalidate this field or its baseline |
| Valid changed result | Replace through existing change channel; establish baseline if absent; offer Undo |
| Repeated Refine before manual edit | Retain the baseline from before the first successful refinement; Undo restores the author's original text |
| Identical result | Do not write/mark dirty or manufacture Undo; retain an existing baseline; announce no change |
| Error, empty result, timeout | Preserve current value and prior baseline; show local generic error; allow retry |
| Undo | Restore exact baseline through existing change channel; clear this field's feedback/baseline |
| Manual edit | Keep the edit; clear only that field's baseline/error |
| External change/reset, callback removed, submission starts, navigation, unmount | Abort and invalidate generation; discard stale results; never write an old baseline into a new draft |

If a callback ignores `AbortSignal`, request-generation, mounted, and value-revision checks still prevent applying its late resolution/rejection. Abort is silent, not an inline failure. Form Cancel/Back stays enabled and aborts before invoking the host callback. Prevent Save both visually and in the submit handler while refining. Per the user decision of 2026-09-24, read-only and toolbar blocking are deferred. Both fields remain editable; edits to the active field cancel and invalidate its request.

For task entity switches the host must remount/key the form by draft identity; field-value equality alone cannot distinguish two tasks. Skill reseeding follows its existing `initialValues` identity contract. Existing unsaved-navigation policy remains unchanged; recovery is guaranteed within the current editing session, not as durable storage after leaving it.

### 6. Keep rendering, labels, and styles consistent

Each field uses a label row with the action as a sibling to its associated label, avoiding an interactive button nested inside `<label>`. Retain Textarea/editor accessible naming and validation descriptions. Use UI Kit 2.0 controls discovered through `searchEntity` / `getEntityDetails` during implementation. Implementation confirmed the current contracts through the local UI Kit MCP server. MarkdownEditor exposes naming and change callbacks but no read-only control.

Both labels interfaces gain optional `refineWithAiLabel`, `refineUndoLabel`, `refineErrorLabel`, `refinePendingAriaLabel`, `refineSuccessAriaLabel`, `refineUndoAriaLabel`, and `refineUnchangedAriaLabel`, with defaults listed in the spec. Keep scheduled-task existing labels required. Bind app strings through `useTranslation` with `textRefinement.*` keys; do not import i18n into libs.

Add optional `colors.refineActionText`, `colors.refineErrorText`, `typography.refineActionClassName`, and `typography.refineFeedbackClassName` to each form's current styles contract. Use `buildCssVars`, respective `--se-*` / `--stcf-*` variables, and three-level fallbacks. Proposed fallback chains: action `var(--stcf-refine-action-text, var(--text-primary, #f5f5f5))`; error `var(--stcf-refine-error-text, var(--text-error, #ffb4ab))`, with equivalent `--se-*` names. Verify at least 7:1 text contrast against the actual fallback background and adjust paired defaults if needed; arbitrary host overrides remain the host's responsibility. Use public class-name constants for new action/feedback elements per each library's pattern.

Mobile-first label rows wrap at narrow widths, keep 44x44 hit areas, and preserve visible button text. Only named `mobile`/`desktop` breakpoints; logical end alignment/padding in LTR and RTL. Sparkle/spinner are nondirectional; any directional Undo glyph is mirrored. Every outline Tabler icon uses `DIAL_KIT_ICON_STROKE` and `aria-hidden`. Pending fields use `aria-busy`; feedback uses a polite status region and errors `role="alert"`. Focus remains stable when the button shows a spinner and moves sensibly when Undo disappears.

## Risks / Trade-offs

- LLM output can change meaning despite instructions → draft-only replacement, persistent Undo baseline, no automatic Save; test prompt selection and deterministic fixtures without claiming perfect semantic verification.
- Large Instructions may exceed the refinement budget → inline validation failure preserves text; do not silently truncate or block ordinary manual authoring.
- New shared hook expands public API → narrow host-agnostic contract, tests, README, and dependency-boundary checks; no generic editor framework.
- Read-only and toolbar blocking are deferred per the user decision; typing and toolbar changes invalidate pending work. No editor props outside the current UI Kit contract are used.
- Service cancellation may race a network response → transport cancellation plus generation/revision checks; no background mutation or persistence.
- New neutral domain requires documentation → update architecture domain map/API table even though `ApiEndpoints` need not change.
- Quotas remain upstream-owned → expose 429 safely, no retries; a distributed BFF quota policy remains a separate future change.

## Migration Plan

1. Add backend/domain/config contracts and generated client, leaving the model unset. Add safe optional availability handling for mixed-version deployments.
2. Deliver skill Description end to end and shared lifecycle tests, then widen to skill Instructions and both task fields in incremental verified slices.
3. Complete translations, README/API/env/architecture docs, and automated checks; enable the configured deployment in an authorized deployment change.
4. To roll back refinement alone, omit its host callbacks. Unsetting the shared `UTILITY_MODEL` also disables conversation naming. No saved-object schema or migration changes are required. This proposal does not modify local `.env`.

## Open Questions

No blocking scope questions remain under the defaults above. Preview/diff, sibling-field context, and BFF-specific rate limits are explicitly deferred, not implementation-time alternatives. Exact design-frame measurements cannot be verified because no design link was supplied; follow the described label-row placement and existing controls. A later explicit UX decision can amend this change before implementation.
