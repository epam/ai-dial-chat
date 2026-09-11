# Spec Delta: catalog-use-in-chat

## ADDED Requirements

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
