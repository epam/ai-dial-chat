## ADDED Requirements

### Requirement: Skill create option in catalog
The system SHALL add a "Skill" option to the `CatalogView` create button, unconditionally (no `OverlayFeature` gate), alongside the existing Prompt/Toolset/Custom App/Quick App entries. The option SHALL be a single direct action — not a submenu — that navigates to `ROUTES.SkillEditor` with a `returnUrl` query param pointing back to `ROUTES.Catalog`, mirroring the existing Prompt entry's `createOptions` shape in `CatalogView.tsx`.

#### Scenario: Skill option is always present
- **WHEN** `CatalogView`'s Create dropdown is opened
- **THEN** the dropdown includes a "Skill" entry regardless of any `OverlayFeature` flag state

#### Scenario: Clicking Skill navigates to the editor in create mode
- **WHEN** a user clicks the "Skill" entry
- **THEN** the app navigates to `/skill-editor?returnUrl=%2Fcatalog` (or the catalog's current equivalent return path) and the Skill Editor renders in create mode with `SKILL.md` selected by default

#### Scenario: No nested Upload sub-item is present
- **WHEN** the Create dropdown's "Skill" entry is inspected
- **THEN** it has no `children` submenu (no "Write instructions"/"Upload" split) — clicking it navigates directly to the editor
