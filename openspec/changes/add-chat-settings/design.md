## Context

The chat input area is rendered by the `ConversationInput` lib component (`libs/conversation-input`). The `+` button dropdown is handled by `AddAttachmentButton` inside that lib. Currently `AddAttachmentButton` has a hard-coded single item (`attachLabel` / `onAttachClick`). The app layer (`apps/chat`) wraps `ConversationInput` and owns deployment/conversation state.

`DeploymentItemDto` is defined in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`. Shared model types live in `libs/chat-shared/src/models/`. The frontend's deployment context is in `apps/chat/src/`.

## Goals / Non-Goals

**Goals:**
- Add a "Chat settings" dropdown entry to the `+` menu; entry is only shown when the active deployment has at least one feature enabled.
- Open a modal that renders only the settings gated by `DeploymentFeatures` (`systemPrompt`, `temperature`).
- Extend `DeploymentItemDto` (backend DTO) with optional `features?: DeploymentFeatures`.
- Add `DeploymentFeatures` interface to `libs/chat-shared`.
- Persist system prompt and temperature overrides in conversation state.

**Non-Goals:**
- Adding the other dropdown items visible in the design (Dial file system, Prompt library, Add files from cloud, Tools) — those are separate features.
- Persisting settings to backend storage — in-memory/React state only for now.
- Validating or applying temperature/system-prompt at the AI DIAL Core call level — that wire-up is out of scope.

## Decisions

### D1: Extend `AddAttachmentButton` with `extraMenuItems` prop

**Decision:** Add an `extraMenuItems?: DropdownMenuItem[]` prop to `AddAttachmentButton` (and thread it through `Input` → `ConversationInput` → app). The app passes the "Chat settings" item conditionally.

**Why over a specific `onChatSettings` prop:** `extraMenuItems` is general-purpose and avoids adding one prop pair per feature to the lib interface. It also aligns with the design intent of supporting multiple app-level menu actions.

**Alternatives considered:** Hard-code "Chat settings" inside the lib with a boolean guard — rejected because the lib must not know about deployment features or app-specific navigation.

### D2: `ChatSettingsModal` lives in `apps/chat`, not a lib

**Decision:** The modal component is in `apps/chat/src/components/ChatSettingsModal/`. It reads `DeploymentFeatures` from the active deployment context and writes `systemPrompt` / `temperature` to conversation state.

**Why:** The modal needs deployment context, conversation context, and i18n — all app-owned concerns. Per the AGENTS.md library isolation rule, libs must not know about these.

### D3: `DeploymentFeatures` defined in `libs/chat-shared`

**Decision:** Add `DeploymentFeatures` to `libs/chat-shared/src/models/deployment.ts` (or a new `deployment-features.ts` file). Both the backend DTO (`apps/chat-api`) and the frontend model reference this type.

**Why:** `libs/chat-shared` is already the canonical home for types shared between frontend and backend. The `Conversation` model (also in `chat-shared`) can reference this indirectly through the conversation settings.

### D4: Backend maps `features` from DIAL Core deployment payload

**Decision:** `DeploymentsService` reads a `features` object from the raw DIAL Core deployment payload (if present) and sets it on `DeploymentItemDto`. When absent it is omitted (undefined). The frontend treats `undefined` as "no features enabled."

**Why:** This is the least-invasive change to the existing mapping logic. No breaking change to API consumers since the field is optional.

### D5: Modal reads/writes the existing `prompt` and `temperature` fields on `Conversation`

**Decision:** The modal uses the existing `prompt: string` and `temperature: number` top-level fields on `Conversation` in `libs/chat-shared/src/models/chat.ts`. No new model field or nested object is added.

**Why:** These fields already express the same semantics. Adding a parallel `settings` sub-object would duplicate meaning and require migration of existing code that already reads `prompt`/`temperature`.

## Risks / Trade-offs

- [Risk] `extraMenuItems` prop threading touches lib + model + app files → Mitigation: thin change; no logic in lib beyond rendering.
- ~~[Risk] DIAL Core does not currently expose a `features` field~~ — confirmed DIAL Core does expose `features` under that exact key name.
- [Risk] Reusing existing `prompt` / `temperature` fields on `Conversation` may cause unintended side effects if other code reads them → Mitigation: audit call sites before writing; spec to confirm intended field reuse.

## Migration Plan

1. Deploy backend change (new `features` field on `DeploymentItemDto`) — fully backward-compatible; field is optional.
2. Deploy frontend — "Chat settings" menu item will not appear until DIAL Core returns `features`.
3. No rollback concern: removing the entry from the dropdown restores previous behavior.

## Open Questions

- ~~Does DIAL Core currently expose a `features` field?~~ — **Resolved**: yes, the key is `features`.
- ~~Should `systemPrompt` and `temperature` reuse existing top-level fields or nest under a new `settings` object?~~ — **Resolved**: reuse the existing `prompt` and `temperature` fields on `Conversation`. No new nested object.
