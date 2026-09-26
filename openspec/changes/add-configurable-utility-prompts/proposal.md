## Why

### Problem

Operators currently need a code change to customize built-in refinement, conversation naming, and audio transcription instructions.

### Solution

Allow six independent server environment overrides while retaining all existing defaults. Follow the existing typed ConfigService usage in `apps/chat-api/src/text-refinement/text-refinement.service.ts:80` and shared naming request in `apps/chat-api/src/conversations/conversation-naming.service.ts:375`.

## What Changes

- Add four refinement prompt variables, one conversation naming variable shared by automatic and manual naming, and one transcription variable.
- Treat absent, empty, and whitespace-only values as requests for the existing default; preserve nonblank overrides verbatim.
- Document quoted multiline `.env` values and restart requirements.

### Non-goals

No UI, new endpoints, model changes, runtime editing, prompt interpolation, shared library changes, or global providers. Existing user-provided chat messages and stored prompts remain outside this configuration.

### Acceptance criteria

All six consumers use their independent override when configured, preserve their existing default otherwise, and retain existing request roles, user input, credentials, model selection, and response handling. Tests cover both naming paths and multiline `.env` loading.

## Capabilities

### New Capabilities

- `configurable-utility-prompts`: Server-owned default prompts can be overridden through environment configuration.

### Modified Capabilities

None.

## Impact

Backend EnvironmentVariables, three existing services, their tests, and backend environment documentation. Configuration belongs to the existing ConfigService; no frontend state, i18n, RTL, accessibility, API-client, or dependency changes.

Alternatives considered: a JSON registry or prompt-file loader adds parsing and deployment complexity; individual optional strings fit existing environment configuration.

Backward compatible without configuration. Remove an override and restart to restore its default; reverting the change also restores built-in behavior.
