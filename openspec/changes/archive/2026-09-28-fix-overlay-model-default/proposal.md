## Why

On UAT every user who opened the overlay for the first time saw some other agent instead of the host's `modelId` (Ask Sigma). The overlay applied `modelId` and then immediately lost it. `app.tsx` called `restoreSelectedItemId(modelId)` and cleared `pendingModelId`. That change re-ran `ConversationRoute`'s mount effect (`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx:257`), which now saw no pending id and called `restoreDefaultSelection()`. The selection then fell back to the pinned operator default, the persisted `selectedDeploymentId`, or the first catalog item. Users "fixed" it by picking Ask Sigma in the full DIAL, which persisted `selectedDeploymentId` and made the fallback match by accident. The regression came in with #8182 (`e60f284f23`, 2026-08-05).

## Problem

- The host's `modelId` survives only until `pendingModelId` is cleared, which happens on the very next render.
- Even without that race, `modelId` never reaches `resolveInitialSelection`. Any later new chat (for example after viewing an existing conversation) resolves without it.
- `modelId` is matched with strict `item.id ===`. A host that passes a deployment `reference` is silently ignored.

## Solution

- `OverlayContext` also keeps the host's latest `modelId` in a field that is never cleared: `OverlayContextType.modelId`. `pendingModelId` keeps its one-shot "apply now" role.
- `DeploymentsContext` reads `useOptionalOverlay()?.modelId` and passes it to `resolveInitialSelection` as a new step, right after the in-memory pick. It is matched by id or `reference` through `findDeploymentByIdOrReference`. All three callers pass it: the post-fetch resolution, `restoreDefaultSelection`, and the late-config effect. `restoreDefaultSelection` therefore lands on the host's agent, whichever route runs it.
- The pending-model effect moves from `app.tsx` into `apps/chat/src/hooks/overlay/useOverlayPendingModel.ts`, which also matches by id or reference. It follows the `useConversationListBridge` pattern (`apps/chat/src/hooks/conversation/useConversationListBridge.ts`), a hook mounted in `app.tsx` below both providers.
- `docs/chat-overlay-migration-guide.md` documents the `modelId` semantics.

Alternatives considered:

- **Only guard `ConversationRoute` with a "consumed" ref** (the conservative baseline). This fixes the first render only. A remount on the next "New chat" still calls `restoreDefaultSelection()` and loses the host's agent. Rejected.
- **A host-selectable `modelIdMode` (`Enforce` / `Suggest`)**. This changes the public `@epam/ai-dial-chat-overlay` contract, and no host has asked for it. A careless `Suggest` would also re-create this bug, because almost every user has a persisted `selectedDeploymentId`. Deferred until a host needs it.
- **Letting the user's "Default agent for new chats" preference outrank the host.** Rejected: the host embeds the overlay for a specific agent, and the preference control is usually unreachable in overlay mode anyway (`HideSettingsPage`, and it is shown only where an agent is pinned).

## Non-goals

- No new `ChatOverlayOptions` / `SET_OVERLAY_OPTIONS` field, and no change to `libs/chat-overlay`.
- No change to non-overlay selection precedence.
- No change to how an existing conversation restores its own last-used model.

## Acceptance criteria

- A first-time overlay user (no persisted selection) whose host sends a valid `modelId` gets that agent in the composer, and it is still selected after `pendingModelId` is cleared.
- A user whose persisted selection, "Default agent for new chats" preference, or pinned operator default differs still gets the host's agent for a new overlay chat.
- After viewing another conversation, the next overlay "New chat" returns to the host's agent.
- An explicit in-session pick in the model selector is kept for the current chat.
- A `modelId` equal to a deployment's `reference` resolves to that deployment. An unknown `modelId` falls through to the normal chain.
- Outside overlay mode, selection is unchanged.

## What Changes

- `OverlayContextType` gains a `modelId: string | null` field. The provider sets it together with `pendingModelId` and never clears it.
- `resolveInitialSelection` gains an `overlayModelId` argument, checked as step 2.
- New hook `useOverlayPendingModel` replaces the inline `app.tsx` effect.
- Overlay migration guide: a paragraph on `modelId`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `default-agent-preference`: the precedence of `resolveInitialSelection` gains the overlay host's `modelId` step above the stored preference.
- `conversation-deployment-selection`: `ConversationRoute`'s summary of `restoreDefaultSelection` includes the overlay step, and the pending-model effect is `useOverlayPendingModel`. Adds a scenario: the host model survives clearing `pendingModelId`.
- `chat-overlay-app-mode`: `SET_OVERLAY_OPTIONS` `modelId` is the overlay's new-chat default for the session, matched by id or reference, and not merely a one-shot selection.
- `deployments-context`: the precedence lists in the initial-selection and `restoreDefaultSelection` requirements point to `default-agent-preference` as the owner of the chain and include the overlay step. Both lists were already stale: they predate the "Default agent for new chats" preference.

## Impact

- Code: `apps/chat/src/context/overlay/OverlayContext.tsx`, `apps/chat/src/context/DeploymentsContext.tsx`, `apps/chat/src/app/app.tsx`, and the new `apps/chat/src/hooks/overlay/useOverlayPendingModel.ts`. Test mocks of `OverlayContextType` gain `modelId: null`.
- Shared/global providers: `DeploymentsProvider` now reads `OverlayContext`. `OverlayModeGate` already mounts `OverlayProvider` above it, and outside overlay mode the value is `undefined`, so there is no scope creep beyond these two app contexts.
- Libs: none. `findDeploymentByIdOrReference` is an existing `@epam/ai-dial-chat-hooks` export.
- i18n: no new strings. RTL/UI: none.
- Compatibility / rollback: not breaking. The protocol and the library API are unchanged. For a host that sends `modelId`, the overlay now opens every new chat on that agent. Revert the commit to roll back.
