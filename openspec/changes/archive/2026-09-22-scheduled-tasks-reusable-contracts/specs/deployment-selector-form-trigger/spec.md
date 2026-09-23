## ADDED Requirements

### Requirement: Deployment picker presentation is reusable outside app providers

catalog SHALL export a controlled DeploymentSelectorField and panel presentation using host-resolved display records, selected id, labels, loading/error/disabled state, extraOptions and callbacks. Host adapters SHALL retain deployment resolution, favorites persistence, CatalogModal and chat state ownership. Existing app component exports and the form's opaque modelSelector slot SHALL remain compatible.

#### Scenario: External field mounts without parent contexts

- **WHEN** a consumer supplies display records and callbacks without app providers
- **THEN** the selector renders, opens through the supplied overlay composition and selects through onSelect.

#### Scenario: Form selection does not change the current conversation

- **WHEN** a user selects a model/agent or invokes Browse from a scheduled-task field
- **THEN** only the host form selection/Browse callback changes; no library updates chat conversation state.

#### Scenario: Fallback and extra options are preserved

- **WHEN** the selected id is unavailable or host extraOptions are present
- **THEN** the raw-id fallback remains selectable state without automatic clearing, and extra option selection follows the host callback contract.

### Requirement: Picker width follows its reference and containing viewport

The picker SHALL expose supported fit-container sizing and overlay composition. Popup width SHALL follow the field within viewport constraints; panel children SHALL shrink without a fixed 360px minimum. Mobile sheet composition SHALL account for padding. No consumer SHALL override a private nested div to eliminate horizontal scrolling.

#### Scenario: Narrow form opens without horizontal scroll

- **WHEN** a picker opens in a 335px field or a 320/360px mobile viewport with sheet padding
- **THEN** the panel and its content remain within available inline width with no horizontal scroll.

#### Scenario: Long selected and result labels do not widen the panel

- **WHEN** items contain long unbroken labels in LTR or RTL
- **THEN** labels wrap/truncate accessibly and the field/panel retain their configured bounds.

### Requirement: Extracted picker retains accessible loading and interaction behavior

The exported field SHALL preserve the existing keyboard/ARIA/loading/empty/error/disabled/unavailable-selection behavior, search highlighting, focus restoration and RTL support. Localized names SHALL be supplied by the host. An empty favorites list SHALL not hide Browse.

#### Scenario: Keyboard selection restores focus

- **WHEN** a keyboard user opens, navigates and selects, or presses Escape
- **THEN** selection/close follows the host callbacks and focus returns to the trigger.

#### Scenario: Loading error and disabled states preserve selection

- **WHEN** a background load or error occurs, or isDisabled becomes true
- **THEN** a resolved label is not cleared, errors remain accessible, and disabled interaction cannot open a new panel.

#### Scenario: Empty favorites keep Browse available

- **WHEN** favorites are empty after loading
- **THEN** the localized empty hint and Browse action remain available.

