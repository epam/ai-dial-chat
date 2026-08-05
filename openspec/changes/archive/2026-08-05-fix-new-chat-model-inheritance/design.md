## Context

`DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) exposes one piece of state, `selectedItemId`, through two setters with different persistence contracts:

- `setSelectedItemId(id)` — user-initiated; persists to `useUserConfig().selectedDeploymentId` and updates local state.
- `restoreSelectedItemId(id)` — used by `Conversation.tsx`'s `loadConversation` (line ~305) to reflect a viewed conversation's last-used model; updates local state only, by design ("without overwriting the user's own model preference for new chats" per its own doc comment).

Both write the same `selectedItemId` state variable. `ConversationRoute.tsx` (the New Chat screen) reads `selectedItemId` directly for both display (`selectedDeploymentId={selectedItemId}`) and for the deployment id sent to `apiCreateConversation`. It has an existing mount effect (lines 74-78) that calls `restoreSelectedItemId(routeDeploymentId)` only when navigated to with explicit router state (overlay conversation-list bridge). When there is no such router state — the normal "click New chat" case — nothing re-derives `selectedItemId` from the user's actual persisted preference, so whatever a previously *viewed* conversation left behind (via `restoreSelectedItemId`) silently becomes the model for the next new chat.

`resolveInitialSelection` (same file, lines 113-132) already implements the correct precedence for "what should be selected in the absence of an explicit choice": in-memory value → persisted `userConfigSelectedId` → operator `defaultDeploymentId` → first item. Today it is only invoked (a) on the initial deployments fetch and (b) in a follow-up effect that handles user-config resolving after an already-empty initial load. Neither path re-runs when the user simply navigates back to the New Chat screen after having viewed another conversation.

## Goals / Non-Goals

**Goals:**
- When the user lands on the New Chat screen through normal navigation (no explicit preselected deployment), the default deployment shown/used SHALL be the user's persisted preference (`userConfigSelectedId`) — or the operator default, or the first item — never a value left over from having merely viewed a different conversation.
- Preserve the existing, intentional behavior that opening a conversation reflects that conversation's own last-used model while it is open (`restoreSelectedItemId`'s current contract is unchanged).
- Preserve the existing overlay/router-state preselection behavior (`routeDeploymentId`, `overlay.pendingModelId`) — those remain valid explicit overrides.

**Non-Goals:**
- No change to how a conversation's own model is displayed/persisted while that conversation is open.
- No change to the backend `CreateConversationDto`/`deploymentId` contract (`conversation-deployment-selection` spec's DTO requirements are untouched).
- No new persisted storage key or schema; this only changes when an *existing* precedence chain gets re-evaluated.

## Decisions

**Decision: Add a context method that re-resolves `selectedItemId` from the same precedence chain already used for initial load, and call it from `ConversationRoute`'s mount effect.**

`DeploymentsContext` gains `restoreDefaultSelection: () => void`, implemented as:

```ts
const restoreDefaultSelection = useCallback(() => {
  const resolved = resolveInitialSelection(
    items,
    null,
    userConfigSelectedId,
    appConfig.defaultDeploymentId,
  );
  if (resolved != null) setSelectedItemIdState(resolved);
}, [items, userConfigSelectedId, appConfig.defaultDeploymentId]);
```

Passing `null` as `inMemoryId` forces the function to ignore whatever `selectedItemId` currently holds (which may be a transient value left by `restoreSelectedItemId`) and fall through to the persisted/operator/first-item precedence — the exact same precedence already trusted for the very first load.

`ConversationRoute.tsx`'s existing mount effect is extended:

```ts
useEffect(() => {
  if (routeDeploymentId) {
    restoreSelectedItemId(routeDeploymentId);
    return;
  }
  if (!overlay?.pendingModelId) {
    restoreDefaultSelection();
  }
}, [restoreSelectedItemId, restoreDefaultSelection, routeDeploymentId, overlay?.pendingModelId]);
```

The `overlay?.pendingModelId` guard defers to `app.tsx`'s existing overlay-pending-model effect (lines 135-149), which resolves once deployments finish loading and then clears the pending flag — avoiding a visible flash to the wrong default immediately before that effect applies the overlay's intended selection.

**Alternatives considered:**

1. **Split `selectedItemId` into two separate state variables** (one for "currently viewed conversation's model", one for "next new chat's model"). Rejected: larger surface area, touches every consumer of `selectedItemId` (model selector dropdown, deployment configuration fetch effect, `NewConversationComposer`), and the existing precedence-resolution logic already encodes the correct behavior — it just isn't re-invoked at the right time. Re-invoking existing logic is a smaller, lower-risk change than restructuring the state shape.
2. **Have `Conversation.tsx` restore `selectedItemId` back to the persisted default on unmount** (when navigating away from a viewed conversation, instead of resolving on New Chat mount). Rejected: "navigating away from a conversation" doesn't always mean "going to New Chat" (could be navigating to another conversation, where the next `restoreSelectedItemId` call would just overwrite it again); resolving on `ConversationRoute` mount is the more precise trigger point that matches exactly the screen where the bug manifests.
3. **Read `userConfigSelectedId` directly in `ConversationRoute` instead of `selectedItemId`.** Rejected: `ConversationRoute` still needs a single mutable `selectedItemId` so the user can pick a different model on the New Chat screen itself via the existing model selector dropdown (`onDeploymentChange={setSelectedItemId}`); bypassing the shared context state for display would fork the source of truth further rather than fixing the leak.

## Risks / Trade-offs

- **[Risk]** Calling `restoreDefaultSelection` on every `ConversationRoute` mount could momentarily show a different deployment than `selectedItemId` held during the previous render, causing a visible flicker of the deployment icon/name in the composer. → **Mitigation**: `resolveInitialSelection` is a pure, synchronous computation over already-loaded `items`; the effect runs before paint on the same commit as the route mount, so the flicker window is a single React render at most, matching the existing behavior of the initial-load resolution effect.
- **[Risk]** `overlay?.pendingModelId` guard couples `ConversationRoute` to overlay-specific state it otherwise wouldn't need to reason about. → **Mitigation**: `ConversationRoute` already reads `useOptionalOverlay()` for `overlay?.notifyConversationLoaded()`; reusing the same optional overlay object for one more field is consistent with the existing pattern and returns `undefined` outside overlay mode (no-op).
- **[Trade-off]** This does not fix the more general "shared mutable state used for two different concerns" design smell in `DeploymentsContext`; it fixes the concrete, reported symptom. A larger state-shape refactor (Alternative 1) is left as a future cleanup if more clobbering bugs of this shape surface.

## Migration Plan

Frontend-only, no data migration. Ship as a normal PR; no feature flag needed since the new behavior only replaces an incorrect default with the already-existing correct precedence chain. Rollback is a plain revert.
