## MODIFIED Requirements

### Requirement: Every folder tree applies the same unit rights
Every panel that lists public-bucket folders as a destination SHALL decide each folder with the same rule source, `useOrgUnitsContext()`, through `useOrgUnitFolderGuards`: the save panels of the Quick App, schema-form app, custom app, toolset, prompt and skill editors (`apps/chat/src/components/ResourceSavePanelContainer/ResourceSavePanelContainer.tsx`) and the publish panels of the catalog (`apps/chat/src/components/CatalogView/CatalogView.tsx`), conversations (`apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`) and projects (`apps/chat/src/components/PublishProjectPanelContainer/PublishProjectPanelContainer.tsx`). The rule applies only while `features.orgUnitsEnabled` is on and the rights status is `Ready`; otherwise no folder is disabled and nothing else changes. Core stays the authority: a client check never replaces Core's answer, and a Core 403 keeps its existing error handling.

For a folder inside a unit, the resource type decides the Core namespace (`applications` for a Quick App and any other application, `toolsets`, `prompts`, `skills`, `projects`, `conversations`), and the owning unit is the nearest unit above the folder (see `org-units-client-state`):
- a **save** destination is usable when the owner grants `write` on that namespace;
- a **publish** destination is usable when a publication request can be sent: the owner grants `read` on that namespace.

A DIAL admin may use every folder. In the Save panel only the Organization root is judged; a Personal folder is never disabled, whatever its name. A folder outside every unit is never disabled by this rule. With the rule `Ready`, a plain public folder that is neither inside a unit nor an ancestor of one is not listed at all (see `org-units-folder-visibility`). The Organization root and ancestor-only folders stay listed, and keep today's save-then-request and request flows.

The File storage page and file-manager modals are not covered by the disabling rule; they apply only the visibility rule of `org-units-folder-visibility`.

#### Scenario: Save panel disables a unit without write
- **WHEN** the flag is on, the rights are `Ready`, and the Change folder view of a Quick App save lists the unit `Sales` where the user holds only `read` on `applications`
- **THEN** the `Sales` row is disabled and cannot be selected

#### Scenario: Publish panel disables a unit without read
- **WHEN** the user opens the publish panel of a prompt and the unit `Marketing` grants no `read` on `prompts`
- **THEN** the `Marketing` row is disabled

#### Scenario: Plain public folder is hidden, not disabled
- **WHEN** the rights are `Ready`, `Shared/Reports` lies under no unit and is no unit's ancestor, and the user is not an admin
- **THEN** neither the save panel nor the publish panel lists `Shared` or `Shared/Reports`, and no row is disabled for it

#### Scenario: Ancestor-only folder stays usable
- **WHEN** the rights are `Ready`, `Acme/Risk/` is a unit and `Acme/` is not
- **THEN** the `Acme` row is listed and enabled in the save panel and in the publish panel

#### Scenario: Same rule in every panel
- **WHEN** one user holds `write` on `applications` and `read` on `prompts` in unit `Delivery`
- **THEN** the Quick App save panel enables `Delivery`, and the prompt save panel disables it

#### Scenario: Personal folder named like a unit
- **WHEN** the Save tree's Personal root holds a folder `Acme` while the unit `Acme/` grants the user no `write`
- **THEN** the Personal folder stays enabled; only Organization-root destinations are matched against units

#### Scenario: Flag off
- **WHEN** `features.orgUnitsEnabled` is off
- **THEN** no row in any panel is disabled or hidden and no rights request is made

#### Scenario: Rights not loaded
- **WHEN** the rights read failed or is still running
- **THEN** no row is disabled or hidden
