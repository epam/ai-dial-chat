# Spec: catalog-details-decomposition

## Purpose

Which module owns each concern of the catalog `DetailsPanel` and its header (content-file picker, publish sub-view, confirmation step, tabs), and that the split keeps the panel's behavior and the `@epam/ai-dial-catalog` public API unchanged.

## Requirements

### Requirement: Details panel concerns live in dedicated modules

`DetailsPanel` in `libs/catalog/src/components/Details/` SHALL delegate:

- the Content-tab file picker to `hooks/useDetailsContentFile.ts`;
- the publish sub-view state and its publish-history lookup to `hooks/useDetailsPublish.ts`;
- the confirmation step to `hooks/useDetailsConfirmation.tsx`;
- the tab row and tab bodies to `DetailsTabs.tsx`;
- the publish sub-view body to `DetailsPublishContent.tsx`.

`Header` SHALL delegate:

- the limit badge to `Header/LimitStatusBadge.tsx`;
- the recipient-count lookup to `Header/hooks/useRecipientsCount.ts`;
- its action-visibility rules to `resolveHeaderActionVisibility` in `src/utils/details-header-actions.ts`;
- the Manage-menu model to `Header/hooks/useManageActions.tsx`;
- the credentials button to `Header/HeaderCredentialsButton.tsx`;
- the Manage menu and promoted action to `Header/HeaderManageSlot.tsx`.

None of these modules SHALL be exported from the lib's `src/index.ts`.

#### Scenario: Panel and header stay small

- **WHEN** the line counts of `DetailsPanel.tsx` and `Header/Header.tsx` are measured
- **THEN** each is at most about 500 lines, and no module listed above exceeds about 450 lines

### Requirement: The split preserves behavior and the public API

The decomposition SHALL NOT change the rendered output, the callbacks invoked, or the public exports of `@epam/ai-dial-catalog`. `DetailsPanel.spec.tsx` and `Header/tests/Header.spec.tsx` SHALL pass without edits.

Per-item resets SHALL keep their relative order. In `useDetailsPublish`, the publish-history prefetch effect runs after that hook's per-item reset. The panel's active-tab reset runs before its tab-reconciliation effect.

#### Scenario: Characterization specs pass unedited

- **WHEN** the specs under `libs/catalog/src/components/Details` run after the split
- **THEN** all of them pass, and `DetailsPanel.spec.tsx` and `Header.spec.tsx` are byte-identical to before

### Requirement: Hosts can draw the details identity block and the About footer

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) and `DetailsPanelProps` (`libs/catalog/src/models/item-details-props.ts`) SHALL declare two optional render props, typed in `libs/catalog/src/models/details-slots.ts` and exported from the package: `renderDetailsIdentity?: (props: CatalogDetailsIdentityRenderProps) => ReactNode` and `renderAboutFooter?: (props: CatalogAboutFooterRenderProps) => ReactNode`. `Catalog` SHALL forward both to `DetailsPanel`, which forwards the first to `Header` and the second to `DetailsTabs`. With neither supplied the panel SHALL render exactly as before.

When `renderDetailsIdentity` is supplied, `Header` SHALL call it with `{ item, statusBadge, footer }` and render the result in place of the built-in `EntityHeader` (icon, type label, name, version, Featured chip, status badge, folder path), keeping the action row below it. `statusBadge` SHALL be the panel's limit-status badge node, absent when the item has no limit status; `footer` SHALL be the folder-path node, absent when the item has no folder. The Featured chip is not handed over; the host draws it from `item.isFeatured`.

When `renderAboutFooter` is supplied, the About tab SHALL render its result under the description in place of the topic tags (`AboutTab` takes it as `footer`; `null` shows nothing there, `undefined` keeps the topic tags). `DetailsTabs` SHALL call the slot only while About is the active tab. The About tab SHALL show the empty state when the item has no description and the slot returns `null`, `undefined` or `false`; any other result keeps the tab non-empty. Without the slot the tab keeps being empty when there is no description and no topics.

#### Scenario: Host identity replaces the built-in block

- **WHEN** `renderDetailsIdentity` is supplied and the details panel opens for an item
- **THEN** the host node renders in place of the built-in identity block and the action row (e.g. "Use in chat") still renders below it

#### Scenario: Identity slot receives the panel's own nodes

- **WHEN** the item reports a limit status and sits in a folder
- **THEN** `renderDetailsIdentity` receives the limit-status badge as `statusBadge` and the folder path as `footer`; for an item with neither, both are absent

#### Scenario: Host footer replaces the topic tags

- **WHEN** `renderAboutFooter` is supplied and the About tab shows an item with topics
- **THEN** the slot's node renders under the description and the topic tags do not

#### Scenario: A footer keeps a description-less About tab non-empty

- **WHEN** an item has no description and no topics and `renderAboutFooter` returns a node
- **THEN** the About tab renders that node instead of the empty state

#### Scenario: An empty footer leaves the About tab empty

- **WHEN** an item has no description and `renderAboutFooter` returns `null`
- **THEN** the About tab shows its empty state

#### Scenario: Footer slot is not called for another tab

- **WHEN** the Overview tab is the active tab
- **THEN** `renderAboutFooter` is not called
