# Spec Delta

## MODIFIED Requirements

### Requirement: New Chat screen restores the user's default deployment on mount

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL re-resolve its default
deployment selection whenever it mounts, so that having previously viewed a different conversation
(which updates `selectedItemId` via `restoreSelectedItemId` without persisting) never determines the
next new chat's model.

On mount, the route's effect SHALL:

1. If router state carries an explicit `deploymentId` (`routeDeploymentId`, e.g. the overlay
   conversation-list bridge opening the composer with a preselected deployment), call
   `restoreSelectedItemId(routeDeploymentId)` — this explicit preselection takes priority. The
   state is one-shot: the effect then clears it with a `replace` navigation that keeps the URL's
   query string and hash and sets `state: null`, and remembers the consumption in a ref for the
   lifetime of the mount, so the re-run triggered by that clearing navigation does not fall through
   to `restoreDefaultSelection()`. A temporary isolated-view branch (marked
   `TODO: remove in next release`) likewise pins the isolated model via `restoreSelectedItemId` and
   never falls through to the default.
2. Otherwise, if a URL `deployment-id` is pending or has been applied (see the
   `url-entity-preselection` capability), do nothing: the URL preselection owns the selection, so
   the default is neither shown and then replaced nor allowed to undo the pick. When the URL
   `deployment-id` settles as unknown, this condition ends and the effect falls through to branch 4
   exactly once.
3. Otherwise, if the optional overlay context has a pending `overlay.pendingModelId` awaiting
   resolution, do nothing and let the overlay-pending-model hook
   (`apps/chat/src/hooks/overlay/useOverlayPendingModel.ts`, mounted in `apps/chat/src/app/app.tsx`)
   apply its own selection once deployments finish loading.
4. Otherwise, call `useDeployments().restoreDefaultSelection()` so `selectedItemId` reflects the
   user's preference rather than whatever a previously viewed conversation left in memory.

`restoreDefaultSelection` resolves through `resolveInitialSelection`, whose precedence gains the
user's `Default agent for new chats` preference. The full ordering is owned by `default-agent-preference`; in
summary, `restoreDefaultSelection` SHALL resolve to:

0. in overlay mode, the host's `modelId` (`OverlayContextType.modelId`), when a deployment with that
   id or reference exists in the catalog;
1. the stored preference, when it names a deployment that exists in the catalog;
2. the operator default, when the preference is `DefaultAgentMode.DefaultAgent` and that deployment
   exists — **not** additionally gated on `defaultDeploymentPinned`;
3. the persisted `useUserConfig().selectedDeploymentId`, when the preference is
   `DefaultAgentMode.LastUsedAgent` and that deployment exists;
4. the operator default, when pinned (unchanged);
5. the persisted `useUserConfig().selectedDeploymentId` (unchanged — the fall-through for an unset
   preference, which is the default behaviour);
6. the first non-hidden catalog item, else the first catalog item (unchanged).

`ConversationRoute` itself is **not** changed by this: it keeps calling `restoreDefaultSelection()`
and remains unaware of the preference and of the overlay host's `modelId`.

Step 0 is what keeps the host's agent once `pendingModelId` is cleared. Clearing it changes
`overlay?.pendingModelId`, which is in the mount effect's dependency array, so the effect re-runs
and reaches branch 4. Before step 0 existed, that call replaced the host's agent with the user's
persisted or first-catalog deployment, so a first-time overlay user never saw the host's agent. Putting the resolution in `DeploymentsContext` rather than in
the route is what makes the preference apply on first load (through the post-fetch resolution
effect) as well as on navigation.

This SHALL NOT change the existing requirement that
`handleCreateConversation`/`handleStarterSelect` are no-ops when `selectedItemId` is `null`, nor the
existing precedence for `CreateConversationDto.deploymentId`.

**i18n impact:** None.

**RTL / UI impact:** None (state resolution only; no new UI).

**Memoisation:** The mount effect's dependency array SHALL include `restoreSelectedItemId`,
`restoreDefaultSelection`, `routeDeploymentId`, `overlay?.pendingModelId`, and the URL
deployment-override flag, plus `navigate`, `pathname`, `isIsolatedView`, and `isolatedModelId` for
the one-shot state clearing and the isolated-view branch.
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

#### Scenario: Clearing router state keeps the query string and hash

- **WHEN** `ConversationRoute` mounts at `/?foo=bar#h` with router state `{ deploymentId: "dep-x" }`
- **THEN** after the state is cleared the URL is still `/?foo=bar#h`

#### Scenario: A known URL deployment-id is not undone by default restoration

- **WHEN** `ConversationRoute` mounts with `?deployment-id=<known id>` and the parameter is then removed from the URL
- **THEN** the selected deployment stays `<known id>` and `restoreDefaultSelection()` is NOT called

#### Scenario: An unknown URL deployment-id restores the default once

- **WHEN** `ConversationRoute` mounts with `?deployment-id=<unknown id>` and deployments have loaded
- **THEN** `restoreDefaultSelection()` is called exactly once

#### Scenario: The overlay host's model survives clearing the pending model id

- **WHEN** the overlay host sent `modelId: "sigma"`, `useUserConfig().selectedDeploymentId` is
  `null` (a first-time user) or `"opus"`, `useOverlayPendingModel` applies `"sigma"` and clears
  `overlay.pendingModelId`, and `ConversationRoute`'s mount effect re-runs and calls
  `restoreDefaultSelection()`
- **THEN** `selectedItemId` remains `"sigma"`

#### Scenario: The next overlay new chat after viewing another conversation uses the host's model

- **WHEN** the overlay host sent `modelId: "sigma"`, the user opens an existing conversation whose
  last-used model is `"whisper"`, and then clicks "New chat"
- **THEN** `restoreDefaultSelection()` sets `selectedItemId` to `"sigma"`

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
