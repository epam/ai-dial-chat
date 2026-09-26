## Context

The backend owns four refinement system prompts, a conversation naming system prompt shared by automatic and manual naming, and a transcription user instruction. Existing typed ConfigService owns process configuration. Follow `apps/chat-api/AGENTS.md` for backend conventions.

## Goals / Non-Goals

Goals: independent optional overrides, unchanged defaults, exact preservation of nonblank multiline text, automated regression coverage.

Non-goals: new endpoints or providers, frontend or library changes, model selection changes, prompt templates, live reloading, user-message overrides.

## Decisions

- Register six optional string fields on EnvironmentVariables: `TEXT_REFINEMENT_SKILL_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_SKILL_INSTRUCTIONS_PROMPT`, `TEXT_REFINEMENT_SCHEDULED_TASK_DESCRIPTION_PROMPT`, `TEXT_REFINEMENT_SCHEDULED_TASK_INSTRUCTIONS_PROMPT`, `CONVERSATION_NAMING_SYSTEM_PROMPT`, and `TRANSCRIPTION_PROMPT`. Individual fields avoid a custom JSON registry/parser.
- Use a small backend `resolvePrompt` helper: only use trimming to detect blank values; return nonblank overrides unchanged. Keep defaults in domain-owned prompt files. Extract the existing transcription literal without changing it.
- Read naming configuration in the common completion method so both naming flows agree. Keep refinement purpose selection server-owned. Preserve transcription's user role and attachment.
- Let Nest's existing dotenv loading support quoted multiline values. Do not add custom escape decoding or placeholder expansion.
- Keep prompts in server configuration, without adding them to client config, responses, telemetry, or logging. Existing feature gates, credentials, timeout and response validation remain in effect. Utility operations still use UTILITY_MODEL; transcription still uses ASR_MODEL.

## Risks / Trade-offs

- A custom prompt can change model output quality or violate expected output formats → existing response validation remains, and operators can remove the override to restore defaults.
- Environment changes need a backend restart → document this alongside multiline syntax.

## Migration Plan

No migration needed. Deploy with variables unset for identical defaults. Configure only desired overrides and restart. Remove variables and restart to roll back customization.

## Open Questions

None. Configuration ownership is already established by the existing backend ConfigService.
