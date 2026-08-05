## Why

GitHub issue #8150 (Case 3): selecting a model (e.g. "Opus") and starting a new chat works correctly, but if the user then opens an *existing* conversation that used a different model (e.g. "Whisper") and clicks "New chat" again, the new chat silently inherits "Whisper" instead of the user's own previously selected "Opus". This reproduces every time and makes the model selector feel broken — viewing any conversation permanently clobbers what "New chat" will use next, with no visible cause.

Root cause: `DeploymentsContext.selectedItemId` is a single piece of state serving two different purposes — "the model shown for the conversation currently being viewed" and "the model the New Chat composer will use next." `restoreSelectedItemId` (called by `Conversation.tsx` on every existing-conversation load, intentionally non-persisting per its own doc comment) mutates that same shared variable. Nothing re-derives `selectedItemId` from the user's actual persisted preference (`useUserConfig().selectedDeploymentId`) when the user subsequently lands back on the New Chat screen, so the transient "viewing" value leaks into the next conversation-creation call in `ConversationRoute.tsx`.

## What Changes

- `DeploymentsContext` gains a way to re-resolve `selectedItemId` back to the user's actual preference (persisted `selectedDeploymentId`, falling back to the app's `defaultDeploymentId`, falling back to the first available item) using the same precedence already implemented for initial load, without re-fetching deployments/schemas/toolsets.
- `ConversationRoute` (the New Chat screen) calls this re-resolution on mount, unless it was navigated to with an explicit preselected deployment (existing `routeDeploymentId` / overlay `pendingModelId` router-state cases), so that simply having viewed another conversation no longer determines the next new chat's model.
- No change to `restoreSelectedItemId`'s existing non-persisting contract — it still correctly reflects a viewed conversation's last-used model while that conversation is open.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `deployments-context`: add a requirement that `selectedItemId` can be re-resolved to the user's persisted preference on demand, independent of the transient value left behind by `restoreSelectedItemId`.
- `conversation-deployment-selection`: add a requirement that the New Chat screen re-resolves its default deployment on mount instead of trusting whatever `selectedItemId` currently holds, except when explicitly navigated with a preselected deployment.

## Impact

- `apps/chat/src/context/DeploymentsContext.tsx` — new re-resolution method exposed from the context.
- `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` — call the re-resolution method on mount when there is no explicit preselected deployment.
- No backend, API, or persisted-schema changes; no i18n or RTL impact (no new UI).
