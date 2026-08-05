## ADDED Requirements

### Requirement: New Chat screen restores the user's default deployment on mount

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL re-resolve its default deployment selection whenever it mounts, so that having previously viewed a different conversation (which updates `selectedItemId` via `restoreSelectedItemId` without persisting) never determines the next new chat's model.

On mount, the route's effect SHALL:

1. If router state carries an explicit `deploymentId` (`routeDeploymentId`, e.g. the overlay conversation-list bridge opening the composer with a preselected deployment), call `restoreSelectedItemId(routeDeploymentId)` as today — this explicit preselection takes priority.
2. Otherwise, if the optional overlay context has a pending `overlay.pendingModelId` awaiting resolution, do nothing and let the existing overlay-pending-model effect (`apps/chat/src/app/app.tsx`) apply its own selection once deployments finish loading.
3. Otherwise, call `useDeployments().restoreDefaultSelection()` so `selectedItemId` reflects the user's persisted preference (or operator default, or first item) rather than whatever a previously viewed conversation left in memory.

This SHALL NOT change the existing requirement that `handleCreateConversation`/`handleStarterSelect` are no-ops when `selectedItemId` is `null`, nor the existing precedence for `CreateConversationDto.deploymentId`.

**i18n impact:** None.

**RTL / UI impact:** None (state resolution only; no new UI).

**Memoisation:** The mount effect's dependency array SHALL include `restoreSelectedItemId`, `restoreDefaultSelection`, `routeDeploymentId`, and `overlay?.pendingModelId`.

#### Scenario: New chat after viewing a different conversation uses the user's own preference, not the viewed conversation's model

- **WHEN** the user has `useUserConfig().selectedDeploymentId === "opus"`, opens an existing conversation whose last-used model is `"whisper"` (which calls `restoreSelectedItemId("whisper")`), and then navigates to `ConversationRoute` (clicks "New chat") with no router-state `deploymentId` and no pending overlay model
- **THEN** `ConversationRoute`'s mount effect calls `restoreDefaultSelection()`, `selectedItemId` becomes `"opus"`, and a subsequently created conversation is sent with `deploymentId: "opus"`

#### Scenario: Explicit router-state deploymentId still takes priority

- **WHEN** `ConversationRoute` mounts with router state `{ deploymentId: "dep-x" }`
- **THEN** `restoreSelectedItemId("dep-x")` is called and `restoreDefaultSelection()` is NOT called

#### Scenario: Pending overlay model selection is not clobbered

- **WHEN** `ConversationRoute` mounts with no router-state `deploymentId` and `overlay.pendingModelId` is set (awaiting the overlay-pending-model effect in `app.tsx`)
- **THEN** `restoreDefaultSelection()` is NOT called from `ConversationRoute`'s mount effect
