## MODIFIED Requirements

### Requirement: New Chat screen restores the user's default deployment on mount

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL re-resolve its default
deployment selection whenever it mounts, so that having previously viewed a different conversation
(which updates `selectedItemId` via `restoreSelectedItemId` without persisting) never determines the
next new chat's model.

On mount, the route's effect SHALL:

1. If router state carries an explicit `deploymentId` (`routeDeploymentId`, e.g. the overlay
   conversation-list bridge opening the composer with a preselected deployment), call
   `restoreSelectedItemId(routeDeploymentId)` as today — this explicit preselection takes priority.
2. Otherwise, if the optional overlay context has a pending `overlay.pendingModelId` awaiting
   resolution, do nothing and let the existing overlay-pending-model effect
   (`apps/chat/src/app/app.tsx`) apply its own selection once deployments finish loading.
3. Otherwise, call `useDeployments().restoreDefaultSelection()` so `selectedItemId` reflects the
   user's preference rather than whatever a previously viewed conversation left in memory.

`restoreDefaultSelection` resolves through `resolveInitialSelection`, whose precedence gains the
user's `Default agent for new chats` preference. The full ordering is owned by `default-agent-preference`; in
summary, `restoreDefaultSelection` SHALL resolve to:

1. the stored preference, when it names a deployment that exists in the catalog;
2. the operator default, when the preference is `DefaultAgentMode.DefaultAgent` and that deployment
   exists — **not** additionally gated on `defaultDeploymentPinned`;
3. the persisted `useUserConfig().selectedDeploymentId`, when the preference is
   `DefaultAgentMode.LastUsedAgent` and that deployment exists;
4. the operator default, when pinned (unchanged);
5. the persisted `useUserConfig().selectedDeploymentId` (unchanged — the fall-through for an unset
   preference, which is the default behaviour);
6. the first catalog item (unchanged).

`ConversationRoute` itself is **not** changed by this: it keeps calling `restoreDefaultSelection()`
and remains unaware of the preference. Putting the resolution in `DeploymentsContext` rather than in
the route is what makes the preference apply on first load (through the post-fetch resolution
effect) as well as on navigation.

This SHALL NOT change the existing requirement that
`handleCreateConversation`/`handleStarterSelect` are no-ops when `selectedItemId` is `null`, nor the
existing precedence for `CreateConversationDto.deploymentId`.

**i18n impact:** None.

**RTL / UI impact:** None (state resolution only; no new UI).

**Memoisation:** The mount effect's dependency array SHALL include `restoreSelectedItemId`,
`restoreDefaultSelection`, `routeDeploymentId`, and `overlay?.pendingModelId` — unchanged.
`restoreDefaultSelection`'s own `useCallback` dependency array SHALL remain `[]`; the preference
reaches it through a ref, so this effect does not re-fire when the preference changes.

#### Scenario: New chat after viewing a different conversation uses the user's own preference, not the viewed conversation's model

- **WHEN** the user has `useUserConfig().selectedDeploymentId === "opus"`, no stored `Default agent
  for new chats` preference, no pinned operator default, opens an existing conversation whose
  last-used model is `"whisper"` (which calls `restoreSelectedItemId("whisper")`), and then navigates
  to `ConversationRoute` (clicks "New chat") with no router-state `deploymentId` and no pending
  overlay model
- **THEN** `ConversationRoute`'s mount effect calls `restoreDefaultSelection()`, `selectedItemId`
  becomes `"opus"`, and a subsequently created conversation is sent with `deploymentId: "opus"`

#### Scenario: A Default agent for new chats preference naming a specific agent determines the new chat

- **WHEN** the `Default agent for new chats` preference is `"gpt-4o"` (a deployment in the catalog),
  `useUserConfig().selectedDeploymentId` is `"whisper"`, and the user navigates to
  `ConversationRoute` with no router-state `deploymentId` and no pending overlay model
- **THEN** `selectedItemId` becomes `"gpt-4o"` and a subsequently created conversation is sent with
  `deploymentId: "gpt-4o"`

#### Scenario: Default agent preference resolves to the operator default

- **WHEN** the `Default agent for new chats` preference is `DefaultAgentMode.DefaultAgent`,
  `appConfig.defaultDeploymentId` is `"gpt-4o"` which exists in the catalog,
  `defaultDeploymentPinned` is off, and the user navigates to `ConversationRoute` with no
  router-state `deploymentId`
- **THEN** `selectedItemId` becomes `"gpt-4o"`

#### Scenario: Explicit router-state deploymentId still takes priority

- **WHEN** `ConversationRoute` mounts with router state `{ deploymentId: "dep-x" }`
- **THEN** `restoreSelectedItemId("dep-x")` is called and `restoreDefaultSelection()` is NOT called,
  regardless of the `Default agent for new chats` preference

#### Scenario: Pending overlay model selection is not clobbered

- **WHEN** `ConversationRoute` mounts with no router-state `deploymentId` and
  `overlay.pendingModelId` is set (awaiting the overlay-pending-model effect in `app.tsx`)
- **THEN** `restoreDefaultSelection()` is NOT called from `ConversationRoute`'s mount effect,
  regardless of the `Default agent for new chats` preference

#### Scenario: Changing the preference does not re-fire the mount effect

- **GIVEN** `ConversationRoute` is mounted
- **WHEN** the user changes the `Default agent for new chats` preference in another surface
- **THEN** `restoreDefaultSelection`'s identity is unchanged and the mount effect does not re-run,
  leaving the current in-session selection intact
