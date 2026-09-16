# catalog-use-in-chat Delta

## MODIFIED Requirements

### Requirement: Use in chat on a Skill attaches the skill to the composer

When the user clicks "Use in chat" in the catalog details panel header for a catalog item of type `CatalogEntityType.Skill` and the `features.skillUsageEnabled` feature flag is enabled for the session, the system SHALL NOT change the selected deployment. Instead it SHALL navigate to `ROUTES.Root` (`/`) passing the skill's resource URL (`skills/{bucket}/{path}`, identical to the item's `CatalogItem.id`) as one-shot router state (`{ skillId: string }`), which `ConversationRoute` consumes on mount to seed the conversation input's selected skill — single selection, replacing any prior selection (see the `skill-input-attachment` capability) — and clears with `navigate(…, { replace: true })` so a later back-navigation or reload does not re-apply a stale selection. The currently selected deployment is left exactly as the user last set it.

The skill details panel's header SHALL offer "Use in chat" as the primary action for a Skill while the flag is enabled; while it shows, the Download action SHALL render in the Manage menu instead of the primary slot. While the flag is disabled, the Skill header SHALL behave exactly as before this change — Download as the primary action, no "Use in chat".

The button's visibility SHALL NOT consult the selected deployment's skills support: it renders for every Skill while the flag is enabled, regardless of which model the chat will open with. When the chat opens with a deployment whose `features.skillsSupported` is not `true`, the attached skill renders in the `ChatSkill` error state with sending disabled (see the `skill-input-attachment` capability's error-state requirement) — the visible error state, not a hidden button, communicates the mismatch. This resolves the previously deferred model-support condition: hiding the button was rejected because the catalog does not reliably know the chat route's live deployment selection, and the error state covers both this arrival path and later model switches with one mechanism.

#### Scenario: Use in chat on a Skill adds it to the chat input

- **WHEN** `features.skillUsageEnabled` is enabled and the user clicks "Use in chat" on a Skill in the catalog details panel
- **THEN** the app navigates to `/` and the conversation input shows a chip for that skill in the accent-active control color
- **AND** the selected deployment is unchanged from before the click

#### Scenario: Use in chat on a Skill with an unsupported selected model

- **WHEN** `features.skillUsageEnabled` is enabled, the chat route's currently selected deployment has `features.skillsSupported` not `true`, and the user clicks "Use in chat" on a Skill
- **THEN** the app navigates to `/` and the conversation input shows the skill's `ChatSkill` chip in the error state with its unsupported-model tooltip
- **AND** sending is disabled until the user removes the skill or switches to a deployment that supports skills
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
