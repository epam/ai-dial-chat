## Context

The overlay host passes `modelId` in `SET_OVERLAY_OPTIONS`. Before this change it flowed like this:

1. `OverlayContext` stored it as `pendingModelId` (`apps/chat/src/context/overlay/OverlayContext.tsx:865`).
2. An effect in `app.tsx` waited for deployments, called `restoreSelectedItemId(modelId)` when a deployment with exactly that `id` existed, and then called `clearPendingModelId()`.
3. `ConversationRoute`'s mount effect skips `restoreDefaultSelection()` only while `overlay?.pendingModelId` is set. That value is in its dependency array.

Clearing the pending id therefore re-ran step 3, which called `restoreDefaultSelection()`. `resolveInitialSelection` knew nothing about the overlay, so it picked the pinned operator default, the persisted `selectedDeploymentId`, or the first catalog item. On UAT only users whose persisted selection was already Ask Sigma saw it.

Two constraints shape the fix:

- `DeploymentsProvider` sits below `OverlayProvider`: `OverlayModeGate` wraps the authenticated tree in `apps/chat/src/main.tsx`. `useOptionalOverlay()` is therefore reachable from `DeploymentsProvider`, and it returns `undefined` outside overlay mode.
- `restoreDefaultSelection` has to keep a stable identity (`useCallback(..., [])`). Everything it reads comes through refs, per `default-agent-preference` "The preference reaches restoreDefaultSelection through a ref".

## Goals / Non-Goals

**Goals:**

- Make the host's `modelId` the default for every new overlay chat in the session, including for first-time users.
- Match `modelId` by id or by `reference`.
- Keep the protocol, `libs/chat-overlay`, and non-overlay selection unchanged.

**Non-Goals:**

- A host-selectable precedence mode (`Enforce` / `Suggest`).
- Persisting the host's model to `UserConfig`.

## Decisions

### D1. Keep a persistent `OverlayContextType.modelId` next to the one-shot `pendingModelId`

`pendingModelId` answers "apply this now". The new `modelId` answers "what does the host want new chats to use". The provider sets both on `SET_OVERLAY_OPTIONS`, and only `pendingModelId` is ever cleared.

Alternative considered: stop clearing `pendingModelId`. Rejected, because its non-null value is also the "still waiting" signal that `ConversationRoute` and the pending-model effect rely on. Overloading it would break that handshake.

### D2. Put the host's model into `resolveInitialSelection`, not into `ConversationRoute`

The overlay step goes right after the in-memory pick. The chain is owned by `default-agent-preference`, and all three callers pass the value:

- the post-fetch resolution;
- `restoreDefaultSelection`;
- the late-config effect.

Callers 1 and 2 read it through `overlayModelIdRef`. The dependency-driven effect lists `overlayModelId` in its dependency array.

Alternative considered: a "consumed" ref in `ConversationRoute`. It fixes only the first render, and the next "New chat" remounts the route and falls back again. Resolving inside `DeploymentsContext` is also how the "Default agent for new chats" preference is applied, so this follows the existing pattern.

Where it sits in the order: the host's model outranks the stored preference, the pin, and the persisted selection. The host embeds the overlay for one agent, and the preference control is rarely reachable there: `HideSettingsPage` is a common overlay feature, and the control is shown only where an agent is pinned. An in-memory pick still wins, so a user's explicit choice in the selector holds for the current chat.

### D3. Match by id or reference with `findDeploymentByIdOrReference`

`findDeploymentByIdOrReference` is already used by `DeploymentsContext` for `resolvedSelectedDeploymentId`. Both the resolution step and the pending-model hook return the matched deployment's `id`, so `selectedItemId` always holds a canonical id.

### D4. Extract the pending-model effect into `apps/chat/src/hooks/overlay/useOverlayPendingModel.ts`

The logic is unchanged apart from D3. It is now a one-purpose hook mounted in `app.tsx`, following `useConversationListBridge`. That lets the integration test mount the real hook between the real `DeploymentsProvider` and `ConversationRoute`, which is how the race is reproduced.

## Risks / Trade-offs

- **[Risk]** A host that wants users to keep their own agent loses that ability. → **Mitigation:** none is needed today. A `modelIdMode` can be added later without changing this default.
- **[Risk]** Adding a `DeploymentsProvider` → `OverlayContext` dependency couples two app contexts. → **Mitigation:** it is read-only through `useOptionalOverlay()`, `null` outside overlay mode, and there is no import cycle (`OverlayContext` does not import `DeploymentsContext`).
- **[Trade-off]** `OverlayContextType` gains a required field, so hand-written mocks of it need `modelId: null`. Three test mocks are updated.

## Migration Plan

No data or protocol migration is needed. Deploying the change fixes the behavior for existing hosts, and reverting the commit rolls it back.
