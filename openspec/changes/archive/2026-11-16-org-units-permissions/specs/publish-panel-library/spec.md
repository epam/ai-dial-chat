## ADDED Requirements

### Requirement: PublishFoldersTree supports a per-row disabled state with a reason
`PublishFoldersTree` SHALL accept an optional `getDisabledReason?: (destination: FolderDestination) => string | undefined` (in single-root mode `rootKey` is the empty string). A folder for which it returns a non-empty string SHALL render disabled with that string as its reason: `aria-disabled="true"`, not selectable by click, Enter or Space, still reachable by keyboard and arrow navigation, and still expandable so its children can be reached. The reason SHALL show as a kit tooltip on hover and focus and SHALL also be exposed through `aria-describedby` on the row, so it never depends on hover. The disabled look SHALL NOT rely on color or opacity alone. The tree takes no rights data and knows no unit: the host decides and passes the text. If the tree turns out not to support a per-row disabled state with a reason, the work stops and is reported before anything is built around it. When the callback is absent, or returns `undefined` for every folder, the tree behaves exactly as before. The whole-tree `disabled` prop keeps its meaning and wins over the per-row state. Search results and the existing keyboard navigation include disabled rows, and inline folder creation is not offered under a disabled folder. Layout uses logical properties and the tooltip places by `start`/`end`.

`SaveToFolderPanel`, `StandaloneSaveToFolderPanel`, `PublishPanel` and `StandalonePublishPanel` SHALL forward `getDisabledReason` to the tree, so a host sets one callback per panel (the catalog's details panel takes it as `getPublishDisabledReason`). `SaveToFolderPanel`'s main view SHALL also show the reason of the committed destination as error text inside its assertive `LiveRegion`, linked to the destination group by `aria-describedby`.

#### Scenario: Disabled row cannot be selected
- **WHEN** `getDisabledReason` returns a reason for `{ rootKey: 'organization', path: ['EPAM', 'Sales'] }` and the user clicks that row
- **THEN** `onDestinationChange` is not called

#### Scenario: Reason reaches assistive technology
- **WHEN** keyboard focus reaches a disabled row
- **THEN** the row has `aria-disabled="true"` and its accessible description is the reason text, and the tooltip shows it

#### Scenario: Children of a disabled folder stay reachable
- **WHEN** a disabled folder is expanded and `getDisabledReason` returns `undefined` for its child
- **THEN** the child is selectable

#### Scenario: No callback, no change
- **WHEN** the tree is rendered without `getDisabledReason`
- **THEN** it renders, selects and navigates exactly as before this change

#### Scenario: Whole-tree disabled wins
- **WHEN** the tree has `disabled` set and `getDisabledReason` returns `undefined` for a folder
- **THEN** that folder is still disabled
