## MODIFIED Requirements

### Requirement: Skill create option in catalog
The system SHALL add a "Skill" option to the `CatalogView` create button, unconditionally (no `OverlayFeature` gate), alongside the existing Prompt/Toolset/Custom App/Quick App entries. The "Skill" option SHALL be a nested submenu with two children: "Write instructions", which navigates to `ROUTES.SkillEditor` with a `returnUrl` query param pointing back to `ROUTES.Catalog` (unchanged from the prior direct-action behavior), and "Upload", which opens a native file picker restricted to a single ZIP archive and imports it as a new Skill (see `skill-archive-import`).

The submenu SHALL be operable by keyboard (arrow-key navigation into and within the submenu, `Enter`/`Space` to activate a child, `Escape` to close) and SHALL NOT require hover to open or navigate on touch/mobile viewports. Both the "Skill" parent item and its "Write instructions"/"Upload" children SHALL meet the existing 44×44 px minimum touch-target size used elsewhere in the Catalog's interactive controls.

#### Scenario: Skill option is always present
- **WHEN** `CatalogView`'s Create dropdown is opened
- **THEN** the dropdown includes a "Skill" entry regardless of any `OverlayFeature` flag state

#### Scenario: Skill option opens a submenu with two actions
- **WHEN** a user opens or focuses the "Skill" entry in the Create dropdown
- **THEN** a submenu appears with exactly two entries, labeled "Write instructions" and "Upload"

#### Scenario: Clicking "Write instructions" navigates to the editor in create mode
- **WHEN** a user selects "Write instructions" from the Skill submenu
- **THEN** the app navigates to `/skill-editor?returnUrl=%2Fcatalog` (or the catalog's current equivalent return path) and the Skill Editor renders in create mode with `SKILL.md` selected by default

#### Scenario: Clicking "Upload" opens a file picker for a ZIP archive
- **WHEN** a user selects "Upload" from the Skill submenu
- **THEN** a native file picker opens restricted to a single ZIP archive, and selecting a file begins the archive import flow described in `skill-archive-import`

#### Scenario: Submenu is keyboard-navigable
- **WHEN** a keyboard user tabs to the "Skill" entry and presses the key that opens its submenu
- **THEN** focus moves into the submenu, arrow keys move between "Write instructions" and "Upload", and `Enter`/`Space` activates the focused child

#### Scenario: Submenu is usable on touch/mobile without hover
- **WHEN** a touch user taps the "Skill" entry on a mobile viewport
- **THEN** the submenu opens and both children are tappable, with no interaction that depends on a hover-only affordance
