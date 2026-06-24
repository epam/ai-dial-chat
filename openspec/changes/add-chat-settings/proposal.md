## Why

Users need a way to configure per-conversation parameters (system prompt, temperature) without leaving the chat view. These settings vary by deployment — some models expose temperature control while others do not — so the UI must reflect what the backend reports as available.

## What Changes

- A new **"Chat settings"** item is added to the chat input attachment/action dropdown (the `+` menu visible in the chat input area).
- Clicking "Chat settings" opens a modal dialog scoped to the current conversation.
- The modal renders only the settings enabled for the active deployment:
  - **System prompt** — a textarea for the conversation-level system prompt (shown when `features.systemPrompt === true`).
  - **Temperature** — a numeric/slider control for sampling temperature (shown when `features.temperature === true`).
- `DeploymentItemDto` gains a new optional `features` field of type `DeploymentFeatures`.
- The backend `GET /api/v1/deployments` mapping reads `features` from the DIAL Core deployment payload and includes it in the DTO.

## Capabilities

### New Capabilities

- `chat-settings-modal`: Modal that renders deployment-gated conversation settings (system prompt, temperature); opens from the chat input action dropdown.
- `deployment-features`: `features: DeploymentFeatures` field added to `DeploymentItemDto`; backend maps it from the DIAL Core payload; frontend consumes it to gate which settings are visible.

### Modified Capabilities

- `deployments-api`: `DeploymentItemDto` shape gains an optional `features?: DeploymentFeatures` property; mapping logic reads `features` from the DIAL Core deployment object.

## Impact

- **Backend** (`apps/chat-api`): `DeploymentItemDto` extended with `features?: DeploymentFeatures`; mapping in `DeploymentsService` updated; `DeploymentFeatures` interface exported from `libs/chat-shared`.
- **Frontend** (`apps/chat`): new `ChatSettingsModal` component; chat input action dropdown gets a new "Chat settings" entry; conversation state extended to hold `systemPrompt` and `temperature` overrides.
- **Shared types** (`libs/chat-shared`): new `DeploymentFeatures` interface.
- **Generated API client** (`libs/chat-api-client`): regeneration required after backend DTO change.
- No breaking changes to existing API consumers — `features` is optional and absent deployments default to no settings UI.
