## Why

DIAL application deployments can carry a `"dial:chatMessageInputDisabled": true` flag in their JSON Schema configuration, signalling that users must not submit free-form text messages. Currently the frontend ignores this flag, allowing plain-text sends that fail DIAL Core validation with `"'button' is a required property"` errors.

## What Changes

- `libs/conversation-input` gains a generic `isInputDisabled` prop on both `Input` and `ConversationInput` that, when `true`, blocks typing, Enter-submit, send-button-submit, file attach, and file drop — while leaving starter/form/action buttons usable.
- `apps/chat` derives a `isChatMessageInputDisabled` boolean at the app edge from `selectedDeploymentConfiguration?.['dial:chatMessageInputDisabled']` (sourced via `useDeployments()`) and passes it as `isInputDisabled` into `ConversationInput` from both `ConversationRoute` and `ConversationView`.
- The `DeploymentConfigurationSchema` type in `libs/chat-shared` gains an explicit optional field `'dial:chatMessageInputDisabled'?: boolean` so callers get type-safe access without string casts.

## Capabilities

### New Capabilities

- `chat-input-disabled-state`: Specifies the `isInputDisabled` prop contract for the reusable `Input` / `ConversationInput` components, the exhaustive list of interactions it blocks and allows, and the app-edge mapping from `DeploymentConfigurationSchema['dial:chatMessageInputDisabled']` to that prop.

### Modified Capabilities

- `deployments-context`: Delta — `DeploymentConfigurationSchema` in `libs/chat-shared` adds explicit `'dial:chatMessageInputDisabled'?: boolean` field; no context shape change.

## Impact

- **`libs/chat-shared`**: `DeploymentConfigurationSchema` interface — add typed field.
- **`libs/conversation-input`**: `InputProps`, `ConversationInputProps` — new optional `isInputDisabled?: boolean`; `Input`, `ConversationInput` components implement the disabled behavior; existing `Input` tests extended; new tests for disabled interactions.
- **`apps/chat`**: `ConversationRoute.tsx`, `ConversationView.tsx` — read `selectedDeploymentConfiguration` from `useDeployments()`, derive and pass `isInputDisabled`; `ConversationRoute.spec.tsx` extended to cover the mapping.
- **No API changes**, no new dependencies, no backend changes.
