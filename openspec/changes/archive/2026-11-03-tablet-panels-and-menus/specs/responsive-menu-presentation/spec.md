## ADDED Requirements

### Requirement: Menu presentation has an independent 768px boundary

Switchable action and selection menus SHALL use their existing phone sheet below 768px and their existing desktop anchored dropdown/popover from 768px. This policy SHALL govern attachment, tools and add-on menus in `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx`, model selection in `libs/conversation-input/src/components/Input/ModelSelectorControl.tsx`, form deployment selection in `apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger.tsx`, catalog Create in `libs/catalog/src/components/Catalog/CreateButton.tsx` and browse view/sort/filter in `libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`.

Menu-local state SHALL remain in existing components/controllers. New shared media hooks SHALL own only viewport-query subscriptions. References to mobile/desktop menu presentation in existing capability specs SHALL mean this boundary for these surfaces, not the layout boundary. Existing anchored menus SHALL remain anchored.

#### Scenario: Phone menu
- **WHEN** any switchable menu opens at 767px
- **THEN** it uses its existing bottom-sheet behavior

#### Scenario: Tablet and desktop menu
- **WHEN** any switchable menu opens at 768, 1024, 1279 or 1280px
- **THEN** it uses its existing desktop controls anchored to the trigger, with viewport collision handling, keyboard navigation and dismissal

### Requirement: Catalog Create uses desktop button placement from 768px

Catalog in `libs/catalog/src/components/Catalog/Catalog.tsx` SHALL show its normal labeled Create button in the page header from 768px, and its floating icon-only button at the bottom inline-end below 768px. Only the floating presentation SHALL reserve bottom content padding and move Scroll to top above Create. Existing labels, actions, hideCreateButton and read-only behavior SHALL remain effective. Other Catalog layout policies SHALL remain unchanged.

#### Scenario: Create placement at the boundary
- **WHEN** Catalog is shown at 767px
- **THEN** Create remains a floating icon-only button opening a phone sheet
- **WHEN** Catalog is shown at 768, 1024, 1279 or 1280px
- **THEN** Create is the normal labeled header button opening an anchored menu in LTR and RTL

#### Scenario: Creation is unavailable
- **WHEN** Catalog is read-only or hideCreateButton is enabled at any supported width
- **THEN** neither the header nor floating Create button is rendered

#### Scenario: Create moves while its menu is open
- **WHEN** the viewport crosses 768px in either direction with Create's menu open
- **THEN** its open state and search query survive in exactly one presentation, and dismissal leaves no stale overlay or scroll lock

### Requirement: Menu policy does not change destination layouts

The 768px policy SHALL NOT change mobile navigation sheets, conversation panel, general dialogs, editor/form layout, catalog grids or modal catalog sizing. Menu actions leading to chat settings or another editor SHALL retain that destination's existing presentation policy. Existing labels and feature availability SHALL be preserved; no new translations, cache, endpoints or telemetry are required.

#### Scenario: Desktop menu inside a mobile-layout form
- **WHEN** a deployment menu is opened in a form at 1024px
- **THEN** the menu is anchored while its host form retains its current layout

#### Scenario: Navigation and settings remain scoped
- **WHEN** navigation opens or a menu launches chat settings at 768px
- **THEN** the destination retains its previous responsive behavior

### Requirement: Presentation transitions preserve accessible state

At a 768px crossing, an open menu whose trigger survives SHALL preserve its logical open state, query and committed selections while transferring focus to equivalent content in exactly one presentation. Browse controls whose triggers change SHALL close the old sheet, discard uncommitted filtering and restore focus to the corresponding new control. Menu ARIA roles, expanded state and focus logic SHALL match the actual presentation, including `DeploymentSelectorPanel` in `apps/chat/src/components/DeploymentSelector/DeploymentSelectorPanel.tsx`. RTL SHALL use logical anchoring and preserve existing keyboard semantics.

#### Scenario: Selector changes while open
- **WHEN** an open model or deployment selector crosses 768px in either direction
- **THEN** its state and query remain available in a single presentation with reachable focus and no stale backdrop or scroll lock

#### Scenario: Browse settings trigger is replaced
- **WHEN** an open browse-settings sheet with uncommitted filters crosses to 768px or wider
- **THEN** it closes without applying the draft and focus reaches the corresponding inline control

#### Scenario: Keyboard and RTL
- **WHEN** a tablet menu is opened with the keyboard in LTR or RTL
- **THEN** users can navigate, select and dismiss it, and dismissal restores trigger focus within the correct parent overlay

