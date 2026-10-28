# Spec Delta

## MODIFIED Requirements

### Requirement: Use in chat selects a deployment and starts a new conversation

When the user clicks "Use in chat" in the catalog details panel header for a catalog item of type Model or Application (`CatalogEntityType.Agent`), the handler (`handleUseInChat` in `apps/chat/src/hooks/useCatalogItemActions/useCatalogItemActions.tsx`, which `CatalogView` consumes) SHALL set that item's `id` as the selected deployment via `DeploymentsContext.setSelectedItemId` and navigate to `ROUTES.Root` (`/`). The navigation SHALL also carry the chosen id as router state (`{ deploymentId: string }`), so `ConversationRoute` treats the arrival as an explicit selection via `restoreSelectedItemId` instead of calling `restoreDefaultSelection`. Without it the new-chat route resets the selection to the operator default on mount (and the persisted preference has not yet propagated), discarding the pick.

The `deploymentId` state SHALL be one-shot: `ConversationRoute` consumes it on mount and clears it with a `replace` navigation that sets `state: null` and keeps the URL's query string and hash, remembering for the lifetime of that mount that it was consumed so the clearing navigation does not re-trigger default restoration. `history.state` survives a page reload, so state left in place would make every refresh re-apply a stale pick instead of resolving the configured default.

The selection SHALL be persisted to user config as part of `setSelectedItemId`'s existing behavior (no additional persistence call is required by the handler).

#### Scenario: Reload after Use in chat resolves the configured default

- **WHEN** the user uses a Model in chat and then reloads `/`
- **THEN** the router state has already been consumed and cleared, so the selection resolves through the normal precedence chain — the pinned operator default when `defaultDeploymentPinned` is enabled

When the item's type is `CatalogEntityType.Prompt`, "Use in chat" SHALL NOT change the selected deployment. The body is resolved by `resolveCatalogPrimaryAction` (`libs/chat-hooks/src/catalog/catalog-primary-action.ts`). For a body without `{{parameter}}` placeholders it SHALL navigate to `ROUTES.Root` passing the body as router state (`{ promptContent: string }`), which `ConversationRoute` consumes to seed the composer through `useComposerSeed`'s `seedMessage`. For a body with parameters it SHALL instead pass `{ pendingPrompt: { id, name, content, description } }`, which `ConversationRoute` consumes to open the "Prompt parameters" popup. The currently selected deployment is left exactly as the user last set it, so a prompt can be used with whatever model is already chosen.

The prompt body SHALL travel as router state, never as a query parameter — a prompt body may be up to 50 000 characters, which would exceed URL length limits and leak content into browser history.

The state SHALL be one-shot: `ConversationRoute` consumes it on mount and clears it with a `replace` navigation that keeps the URL's query string and hash, so a later back-navigation to `/` does not silently re-inject stale text. This mirrors how `CatalogView` already clears the one-shot `itemId` search param.

When the prompt's body has not yet been resolved at click time (`item.details.promptContent.content` is absent), the handler SHALL resolve a public prompt through `getPublicPrompt` (with its bucket-relative sub-path), and a personal or shared prompt through `getPrompt(item.id)` — the full `prompts/{bucket}/{path}` id passed unmodified, whether the prompt is the caller's own or shared with them. On failure it SHALL surface an error notification and stay on the catalog rather than navigating with empty text.

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

- **WHEN** the user opens the catalog, selects the Prompts tab, opens the details panel of a prompt without `{{parameter}}` placeholders, and clicks "Use in chat"
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

#### Scenario: Clearing the one-shot state keeps the query string and hash

- **WHEN** `ConversationRoute` consumes a one-shot router state while the URL carries other query parameters and a hash
- **THEN** the state is cleared and the query string and hash are unchanged

