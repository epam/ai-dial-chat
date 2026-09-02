# isolated-model-view Specification

## Purpose

`TODO: remove in next release.` A temporary, URL-param-driven view that pins the chat to a single deployment for embedding scenarios: detecting the `isolated-model-id` query parameter, forcing a fixed UI-feature set, preselecting/not-founding the pinned deployment on the root route, renaming the first created conversation, and hiding the entire navigation component.

## Requirements

### Requirement: `isolated-model-id` query param drives a temporary isolated view

`TODO: remove in next release.` A new context, `IsolatedModelViewContext`
(`apps/chat/src/context/IsolatedModelViewContext.tsx`), SHALL be mounted in `apps/chat/src/main.tsx` inside both `BrowserRouter` and `DeploymentsProvider` (needs `useLocation()` and `useDeployments()`), and SHALL expose `useIsolatedModelView(): { isActive: boolean; isNotFound: boolean; resolvedDeploymentId: string | null }` via a `useIsolatedModelView` hook. The file SHALL carry a `// TODO: remove in next release` header comment.

On mount, the provider SHALL read the `isolated-model-id` query parameter from `useLocation().search`. When absent or empty, `isActive`, `isNotFound` SHALL both be `false` and `resolvedDeploymentId` SHALL be `null`; every other requirement below SHALL be a no-op. When present and non-empty, `isActive` SHALL be `true` and the provider SHALL resolve the value against `useDeployments().items` via the existing `findDeploymentByIdOrReference` helper, exposing the match's `id` as `resolvedDeploymentId`. `isNotFound` SHALL be `true` only once `useDeployments()` has finished its initial load and no matching item was found; while deployments are still loading, `isNotFound` SHALL remain `false`.

**State ownership:** `IsolatedModelViewContext` (new). Reads `useLocation()` and `useDeployments()` (existing state owners). Drives `UiFeaturesContext.applyIsolatedViewOverride` (see the `ui-feature-toggles` spec); introduces no other new persisted state.

#### Scenario: Parameter absent leaves normal behavior untouched
- **WHEN** the URL has no `isolated-model-id` parameter
- **THEN** `useIsolatedModelView()` returns `{ isActive: false, isNotFound: false, resolvedDeploymentId: null }` and the app renders exactly as it does today

#### Scenario: Parameter present but deployments still loading
- **WHEN** the URL is `?isolated-model-id=gpt-4` and `useDeployments()` has not yet completed its initial load
- **THEN** `useIsolatedModelView()` returns `{ isActive: true, isNotFound: false, resolvedDeploymentId: null }`

#### Scenario: Parameter present and deployment resolves
- **WHEN** the URL is `?isolated-model-id=gpt-4` and `useDeployments().items` contains a deployment whose id or reference is `gpt-4`
- **THEN** `useIsolatedModelView()` returns `{ isActive: true, isNotFound: false, resolvedDeploymentId: '<that item's id>' }`

#### Scenario: Parameter present but deployment does not resolve
- **WHEN** the URL is `?isolated-model-id=unknown-model` and no item in `useDeployments().items` matches after the initial deployments load completes
- **THEN** `useIsolatedModelView()` returns `{ isActive: true, isNotFound: true, resolvedDeploymentId: null }`

### Requirement: Isolated view forces a fixed UI-feature set as soon as the param is present

`TODO: remove in next release.` As soon as `isActive` is `true` (the query parameter is present, regardless of whether the deployment has resolved yet), `IsolatedModelViewContext` SHALL call `UiFeaturesContext`'s `applyIsolatedViewOverride` (see the `ui-feature-toggles` spec) exactly once with a fixed set: `disallow-change-agent`, `hide-change-agent`, `hide-empty-chat-change-agent`, `hide-new-conversation`, and `hide-navigation-menu` enabled; `conversations-section` and `prompts` are simply absent from the set and therefore disabled under the override's replace semantics. This override SHALL NOT wait for `resolvedDeploymentId` to become non-null — `useDeployments()` resolves asynchronously, and gating on resolution let the conversations panel (and other default-open UI driven by `conversations-section`) briefly render before the override landed. The override SHALL take precedence over any overlay override, server `enabledUiFeatures`, or compiled default for the lifetime of the tab (until a full page reload).

#### Scenario: Navigation and change-agent controls are hidden immediately, before deployments finish loading
- **WHEN** isolated view is active (`isActive: true`) and `useDeployments()` has not yet completed its initial load
- **THEN** `useUiFeature('hide-navigation-menu')`, `useUiFeature('hide-change-agent')`, `useUiFeature('disallow-change-agent')`, `useUiFeature('hide-empty-chat-change-agent')`, and `useUiFeature('hide-new-conversation')` all return `true` without waiting for `resolvedDeploymentId`

#### Scenario: Conversations section and prompts are disabled even if the server enables them
- **WHEN** isolated view is active and the server's `enabledUiFeatures` includes `conversations-section` and `prompts`
- **THEN** `useUiFeature('conversations-section')` and `useUiFeature('prompts')` both return `false`

#### Scenario: Override still applies when the id never resolves
- **WHEN** isolated view is active and the id does not resolve to any deployment (`isNotFound: true`)
- **THEN** the forced feature set is still applied — the not-found screen also renders without navigation or the conversations panel

### Requirement: Isolated view hides the entire navigation component, not just the mobile sheet

`TODO: remove in next release.` The `ui-feature-toggles` `hide-navigation-menu` key only ever governs the mobile hamburger button and `NavigationSheet` — its own requirement states it "SHALL NOT affect the desktop navigation rail." Since isolated view's old behavior hid navigation unconditionally on every viewport, `apps/chat/src/app/app.tsx` SHALL NOT render `<Navigation />` at all (desktop rail and mobile sheet both) whenever `useIsolatedModelView().isActive` is `true`, regardless of whether the id has resolved yet. This is a direct conditional render at the `<Navigation />` call site, not a new `OverlayFeature` key, since adding a permanent wire-protocol value for a temporary shim is out of proportion to the need.

#### Scenario: Desktop rail is absent
- **WHEN** isolated view is active and the viewport is desktop-width
- **THEN** `Navigation` (including its logo, nav items, and user-menu footer) does not render at all

#### Scenario: Mobile sheet and its trigger are absent
- **WHEN** isolated view is active and the viewport is mobile-width
- **THEN** no hamburger button or `NavigationSheet` renders (subsumes what `hide-navigation-menu` alone would have covered)

#### Scenario: Navigation is hidden even before the deployment resolves
- **WHEN** isolated view is active (`isActive: true`) but the deployment has not resolved yet
- **THEN** `Navigation` still does not render — hiding it does not wait for resolution

### Requirement: Root route preselects the pinned deployment and shows a not-found state when unresolved

`TODO: remove in next release.` `ConversationRoute`'s existing deployment-selection effect (which currently reads a `deploymentId` from router state, or defers to `overlay?.pendingModelId`, before falling back to `restoreDefaultSelection()`) SHALL gain a third source: when `useIsolatedModelView()` returns `isActive: true` and a non-null `resolvedDeploymentId`, it SHALL call `restoreSelectedItemId(resolvedDeploymentId)` exactly once (guarded the same way the existing router-state branch is) and SHALL NOT call `restoreDefaultSelection()` while isolated view is active.

While `isActive` is `true` and `isNotFound` is `true`, `ConversationRoute` SHALL render the UI kit's `NoDataContent` component (title + description, `live` for `aria-live`, no action buttons) instead of `NewConversationComposer`. The normal `NewConversationComposer` empty-chat UI SHALL still render once the deployment resolves (isolated view does not suppress the composer itself — only the model-selector control, via the forced UI-feature set above).

#### Scenario: Pinned deployment is preselected without persisting it
- **WHEN** isolated view is active with `resolvedDeploymentId: 'gpt-4'` and the user's own persisted deployment preference is something else
- **THEN** the composer's selected deployment is `gpt-4`, and the user's persisted preference is left unchanged (no `setSelectedItemId` call)

#### Scenario: Unknown model id shows not-found instead of a composer
- **WHEN** isolated view is active and the id does not resolve to any deployment
- **THEN** the root route renders `NoDataContent` with a "model not found" message and no composer or conversation input is shown

#### Scenario: Composer renders normally once resolved
- **WHEN** isolated view is active with a resolved deployment
- **THEN** the root route renders `NewConversationComposer` with that deployment preselected, exactly as the non-isolated empty-chat state does otherwise

#### Scenario: Non-isolated root route is unaffected
- **WHEN** `isolated-model-id` is absent from the URL
- **THEN** the root route's deployment selection and rendering are exactly as before this change

### Requirement: First message creates the conversation, then it is renamed to `isolated_<modelId>`

`TODO: remove in next release.` `ConversationRoute`'s existing conversation-creation call sites (`handleCreateConversation` and `handleStarterSelect`, both of which call `apiCreateConversation` for the first message) SHALL, when isolated view is active, additionally call `renameConversation(getConversationPath(conversation.id), name)` — where `name` is `` `isolated_${sanitizedModelId}` `` and `sanitizedModelId` strips every character not matching `[A-Za-z0-9_-]` from `resolvedDeploymentId` — before navigating to the created conversation's route. This SHALL happen once, for the conversation created by the first message; it SHALL NOT apply to any later message in the same conversation.

#### Scenario: Conversation is renamed right after creation
- **WHEN** isolated view is active with `resolvedDeploymentId: 'gpt-4'` and the user sends the first message
- **THEN** `apiCreateConversation` is called as usual, followed by `renameConversation` with the target name `isolated_gpt-4`, before the app navigates to the conversation's route

#### Scenario: Special characters in the model id are stripped from the generated name
- **WHEN** `resolvedDeploymentId` is `"gpt 4!"`
- **THEN** the rename target name is `isolated_gpt4` (the space and `!` removed)

#### Scenario: Non-isolated conversation creation is unaffected
- **WHEN** isolated view is not active
- **THEN** `handleCreateConversation`/`handleStarterSelect` behave exactly as before this change — no rename call is made
