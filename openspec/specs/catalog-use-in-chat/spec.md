# Spec: catalog-use-in-chat

## Purpose

The "Use in chat" action that selects a deployment and starts a new conversation, and the item kinds for which it is unavailable.

## Requirements

### Requirement: Use in chat selects a deployment and starts a new conversation

When the user clicks "Use in chat" in the catalog details panel header for a catalog item of type Model or Application, the system SHALL set that item's `id` as the selected deployment via `DeploymentsContext.setSelectedItemId` and navigate to `ROUTES.Root` (`/`). The navigation SHALL also carry the chosen id as router state (`{ deploymentId: string }`), so `ConversationRoute` treats the arrival as an explicit selection via `restoreSelectedItemId` instead of calling `restoreDefaultSelection`. Without it the new-chat route resets the selection to the operator default on mount (and the persisted preference has not yet propagated), discarding the pick.

The `deploymentId` state SHALL be one-shot: `ConversationRoute` consumes it on mount and clears it with `navigate(pathname, { replace: true, state: null })`, remembering for the lifetime of that mount that it was consumed so the clearing navigation does not re-trigger default restoration. `history.state` survives a page reload, so state left in place would make every refresh re-apply a stale pick instead of resolving the configured default.

The selection SHALL be persisted to user config as part of `setSelectedItemId`'s existing behavior (no additional persistence call is required by the handler).

#### Scenario: Reload after Use in chat resolves the configured default

- **WHEN** the user uses a Model in chat and then reloads `/`
- **THEN** the router state has already been consumed and cleared, so the selection resolves through the normal precedence chain — the pinned operator default when `defaultDeploymentPinned` is enabled

When the item's type is `CatalogEntityType.Prompt`, "Use in chat" SHALL NOT change the selected deployment. Instead it SHALL navigate to `ROUTES.Root` passing the prompt's resolved body as router state (`{ promptContent: string }`), which `ConversationRoute` consumes to seed the composer's existing `message` prop through its `inputMessage` state. The currently selected deployment is left exactly as the user last set it, so a prompt can be used with whatever model is already chosen.

The prompt body SHALL travel as router state, never as a query parameter — a prompt body may be up to 50 000 characters, which would exceed URL length limits and leak content into browser history.

The state SHALL be one-shot: `ConversationRoute` consumes it on mount and clears it with `navigate(…, { replace: true })`, so a later back-navigation to `/` does not silently re-inject stale text. This mirrors how `CatalogView` already clears the one-shot `itemId` search param.

When the prompt's body has not yet been resolved at click time, the handler SHALL resolve a public prompt through `getPublicPrompt` (with its bucket-relative sub-path), and a personal or shared prompt through `getPrompt(item.id)` — the full `prompts/{bucket}/{path}` id passed unmodified, whether the prompt is the caller's own or shared with them. On failure it SHALL surface an error notification and stay on the catalog rather than navigating with empty text.

#### Scenario: Use in chat on a Model navigates to the new-conversation screen with that model selected

- **WHEN** the user opens the catalog, selects the Models tab, opens a model's details panel, and clicks "Use in chat"
- **THEN** the app navigates to `/`
- **AND** the model picker on the new-conversation screen shows that model as the selected deployment
- **AND** the user can send a message using that deployment immediately

#### Scenario: Use in chat on an Application navigates to the new-conversation screen with that application selected

- **WHEN** the user opens the catalog, selects the Applications tab, opens an application's details panel, and clicks "Use in chat"
- **THEN** the app navigates to `/`
- **AND** the model picker on the new-conversation screen shows that application as the selected deployment

#### Scenario: Selecting a different deployment via Use in chat updates the selection

- **WHEN** the user has already selected deployment A via "Use in chat", returns to the catalog, and clicks "Use in chat" on deployment B
- **THEN** the selected deployment becomes B, replacing A

#### Scenario: Selection persists across page reload

- **WHEN** the user selects a deployment via "Use in chat" and then reloads the page
- **THEN** the same deployment remains selected, restored from user config

#### Scenario: Use in chat on a Prompt pre-fills the composer

- **WHEN** the user opens the catalog, selects the Prompts tab, opens a prompt's details panel, and clicks "Use in chat"
- **THEN** the app navigates to `/`
- **AND** the composer's textarea contains the prompt's full body, ready to edit or send
- **AND** the selected deployment is unchanged from before the click

#### Scenario: Use in chat on a Prompt does not touch deployment selection or user config

- **WHEN** the user clicks "Use in chat" on a prompt
- **THEN** `setSelectedItemId` is not called
- **AND** no user-config update request is dispatched

#### Scenario: Prompt body is not passed through the URL

- **WHEN** the user clicks "Use in chat" on a prompt with a 40 000-character body
- **THEN** the resulting URL is `/` with no query string carrying the body
- **AND** the composer still contains the full body

#### Scenario: Shared prompt body resolves from the owner bucket

- **WHEN** the user activates Use in chat for `prompts/owner-bucket/Work/summarize` before its body is resolved
- **THEN** `getPrompt('prompts/owner-bucket/Work/summarize')` is called before navigation

#### Scenario: Pre-filled text is not re-injected on back-navigation

- **WHEN** the user uses a prompt in chat, navigates away, and then navigates back to `/`
- **THEN** the composer is empty, because the router state was consumed and cleared on first mount

#### Scenario: Failure to resolve the prompt body keeps the user on the catalog

- **WHEN** the prompt's body must be fetched at click time and that request rejects
- **THEN** an error notification with the request id is shown
- **AND** the app stays on the catalog rather than opening an empty composer

---

### Requirement: Use in chat is not available for Toolset items or non-chat deployments

The catalog details panel SHALL NOT render the "Use in chat" primary action button when either:
- the displayed item's `type` is `CatalogEntityType.Toolset`, or
- the displayed item's `type` is `Model` or `Agent` but its `supportsChat` field (a `CatalogItem` boolean derived from `DeploymentItemDto.interfaces`, `true` when `interfaces` is absent or includes `'chat'`) is `false`.

`CatalogEntityType.Prompt` items SHALL render the button: a prompt is always usable in chat, since it contributes text rather than a runtime. `supportsChat` is not consulted for prompts — the field describes a deployment's interfaces and is absent on prompt items.

`CatalogView`'s `isPrimaryActionVisible` predicate therefore returns `true` for `Model` and `Agent` items whose `supportsChat` is not `false`, `true` for every `Prompt` item, and `false` for `Toolset` items.

#### Scenario: Toolset details panel has no Use in chat button

- **WHEN** the user opens the catalog, selects the Toolsets tab, and opens a toolset's details panel
- **THEN** the "Use in chat" button is not rendered
- **AND** other actions available for the toolset (e.g. Share) remain rendered and functional

#### Scenario: Model and Application details panels still show Use in chat when chat-capable

- **WHEN** the user opens a details panel for an item of type Model or Application whose `interfaces` includes `'chat'`
- **THEN** the "Use in chat" button is rendered as before

#### Scenario: MCP-only application has no Use in chat button

- **WHEN** the user opens the catalog and opens the details panel for an Application whose `interfaces` is `['mcp']` (no `'chat'`)
- **THEN** the "Use in chat" button is not rendered
- **AND** other actions available for the application (e.g. Share, credentials) remain rendered and functional

#### Scenario: Application supporting both chat and mcp interfaces still shows Use in chat

- **WHEN** the user opens the details panel for an Application whose `interfaces` is `['chat', 'mcp']`
- **THEN** the "Use in chat" button is rendered

#### Scenario: Prompt details panel shows Use in chat

- **WHEN** the user opens the details panel for a `Prompt` item, whether personal, shared, or from the organisation
- **THEN** the "Use in chat" button is rendered

#### Scenario: Prompt items are unaffected by supportsChat

- **WHEN** a `Prompt` item is mapped with no `supportsChat` field
- **THEN** the "Use in chat" button is still rendered, because the predicate does not consult `supportsChat` for prompts

---

### Requirement: Use in chat on a Skill attaches the skill to the composer

When the user clicks "Use in chat" in the catalog details panel header for a catalog item of type `CatalogEntityType.Skill` and the `features.skillUsageEnabled` feature flag is enabled for the session, the system SHALL NOT change the selected deployment. Instead it SHALL navigate to `ROUTES.Root` (`/`) passing the skill's resource URL (`skills/{bucket}/{path}`, identical to the item's `CatalogItem.id`) as one-shot router state (`{ skillId: string }`), which `ConversationRoute` consumes on mount to seed the conversation input's selected skill — single selection, replacing any prior selection (see the `skill-input-attachment` capability) — and clears with `navigate(…, { replace: true })` so a later back-navigation or reload does not re-apply a stale selection. The currently selected deployment is left exactly as the user last set it.

The skill details panel's header SHALL offer "Use in chat" as the primary action for a Skill while the flag is enabled; while it shows, the Download action SHALL render in the Manage menu instead of the primary slot. While the flag is disabled, the Skill header SHALL behave exactly as before this change — Download as the primary action, no "Use in chat".

**Deferred condition (documented, not implemented):** the button should eventually render only when the default model — the deployment the chat will open with — supports skills. The backend exposes no way to know that yet (the skill-usage contract is undesigned), so the visibility rule is unconditional within the flag for now; when the capability signal exists, this requirement's visibility clause gains that condition.

#### Scenario: Use in chat on a Skill adds it to the chat input

- **WHEN** `features.skillUsageEnabled` is enabled and the user clicks "Use in chat" on a Skill in the catalog details panel
- **THEN** the app navigates to `/` and the conversation input shows a chip for that skill in the accent-active control color
- **AND** the selected deployment is unchanged from before the click

#### Scenario: Skill router state is one-shot

- **WHEN** the user uses a skill in chat and then navigates away and back to `/` (or reloads after the state was consumed)
- **THEN** the composer does not silently re-add the stale skill selection

#### Scenario: Flag disabled — Skill header unchanged

- **WHEN** `features.skillUsageEnabled` is disabled and the user opens a skill's details panel
- **THEN** the header shows Download as the primary action and no "Use in chat" button, exactly as before this change

#### Scenario: Flag enabled — Download moves to the Manage menu

- **WHEN** `features.skillUsageEnabled` is enabled and the user opens a skill's details panel
- **THEN** the header's primary action is "Use in chat" and Download is available in the Manage menu

#### Scenario: Deployment selection and user config are untouched

- **WHEN** the user clicks "Use in chat" on a skill
- **THEN** `setSelectedItemId` is not called and no user-config update request is dispatched
