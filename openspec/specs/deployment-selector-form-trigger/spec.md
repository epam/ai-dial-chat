# Spec: deployment-selector-form-trigger

## Purpose

A form-field trigger that reuses the deployment selector overlay, including its loading, empty, error, disabled, and unavailable-deployment states.

## Requirements

### Requirement: DeploymentSelectorFieldTrigger reuses the existing overlay content behind a form-field trigger

`apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger.tsx` SHALL render a full-width outlined form control, built on the `Input` component from `@epam/ai-dial-ui-kit` (`readOnly`, with a trailing `iconAfter` chevron) rather than a hand-styled element — the same recipe `Select` uses for its own field — so its chrome (border, radius, height, focus/hover, colors) is pixel-identical to `Input`/`Select` everywhere else in the app. It opens the existing `DeploymentSelectorOverlay`/`DeploymentSelectorPanel` content — search, "Currently selected" row, Favorites list with star toggles, and the "Browse" footer action — via the ui-kit `Dropdown` component, the same primitive `ModelSelectorControl` already uses for the chat input's `modelPickerOverlay` case. The component SHALL NOT introduce a second implementation of search, favorites, grouping, or Browse behavior; it SHALL consume the same mapping utilities `useDeploymentSelectorOverlay` uses (`mapDeploymentToCatalogItem`, `findDeploymentByIdOrReference`) so a deployment's display name, icon, and type render identically to the chat selector.

`DeploymentSelectorFieldTrigger` SHALL accept `selectedId: string | null`, `onSelect: (id: string) => void`, and SHALL NOT read or write `DeploymentsContext.selectedItemId`/`setSelectedItemId` — its selection is independent of the chat input's currently active deployment. It SHALL accept the deployment list and favorites via `useDeployments()`/`useFavoriteApplications()` internally (same context providers the chat input uses), not via props duplicating that data. This independence SHALL hold for every pick path, including a pick made through the "Browse" catalog: `CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL accept an optional `onSelect?: (id: string) => void` prop and, when supplied, route a selector-mode card pick through it instead of `DeploymentsContext.setSelectedItemId`; `CatalogModal` SHALL forward its own optional `onSelect` prop to `CatalogView`; and `useDeploymentSelectorFieldOverlay`'s `catalogModal` SHALL pass its `onSelect` argument through to `CatalogModal`, so a Browse pick from the Scheduled Task form updates the form's `values.modelId` and never the chat input's active deployment. The chat input's own `useDeploymentSelectorOverlay` continues to render `CatalogModal` without an `onSelect` prop, preserving its existing behavior of committing a Browse pick directly to `DeploymentsContext`.

The trigger SHALL render:
- The selected deployment's display name (resolved via `findDeploymentByIdOrReference`/`mapDeploymentToCatalogItem`) when `selectedId` is set, truncated consistently with other form field values.
- A placeholder string (supplied via a labels prop) when `selectedId` is `null`/unset.
- A trailing chevron icon that visually indicates expand/collapse state.

Opening the trigger SHALL render the panel with `matchReferenceWidth` left at the `Dropdown` default (`true`), so the overlay starts at the field's full width rather than the icon trigger's fixed `320px` override.

`matchReferenceWidth` sets only a `min-width`, so on its own it lets a long agent name stretch the overlay well past the field it belongs to. The panel SHALL therefore also be capped at `max-w-[max(var(--reference-width),360px)]` — `--reference-width` is the field width the kit publishes on the floating element — so the panel reads as this field's popup the way a `Select`'s list does. The `max()` floor keeps the panel's own `360px` minimum honoured on a field narrower than that, and the `!` prefix is required because the kit writes its available-width cap as an inline style.

#### Scenario: A long deployment name does not widen the panel past its field

- **GIVEN** the opened panel contains a deployment whose display name is far wider than the field
- **WHEN** the panel renders
- **THEN** the panel's width does not exceed the field's own width, except on a field narrower than `360px`, where the panel stops at `360px`

#### Scenario: Trigger shows placeholder when nothing is selected

- **WHEN** `DeploymentSelectorFieldTrigger` renders with `selectedId={null}`
- **THEN** the trigger displays the supplied placeholder text, not a deployment name

#### Scenario: Trigger shows the resolved deployment name when selected

- **WHEN** `DeploymentSelectorFieldTrigger` renders with `selectedId` equal to a loaded deployment's id
- **THEN** the trigger displays that deployment's display name, resolved the same way `useDeploymentSelectorOverlay` resolves the chat input's selected item

#### Scenario: Opening the trigger shows search, favorites, and Browse

- **WHEN** the user activates the trigger
- **THEN** the opened panel renders the search input, the Favorites list (or its empty hint), and the "Browse" footer action — the same content the chat input's icon trigger opens

#### Scenario: Selecting a deployment calls onSelect and closes the panel

- **WHEN** the user picks a deployment from the opened panel
- **THEN** `onSelect` is called with that deployment's id and the panel closes

#### Scenario: Selection does not affect the chat input's own selected deployment

- **WHEN** the user selects a different deployment via `DeploymentSelectorFieldTrigger`
- **THEN** `DeploymentsContext.selectedItemId` (the chat input's active model) is unchanged

#### Scenario: A Browse-catalog pick also routes through onSelect, not DeploymentsContext

- **WHEN** the user activates "Browse" from the form trigger's opened panel and picks a card inside the catalog
- **THEN** `onSelect` is called with that deployment's id, `DeploymentsContext.setSelectedItemId` is NOT called, and the catalog modal closes

#### Scenario: The chat input's own Browse flow is unaffected

- **WHEN** the user activates "Browse" from the chat input's icon trigger and picks a card inside the catalog
- **THEN** `DeploymentsContext.setSelectedItemId` is called with that deployment's id, exactly as before this change

#### Scenario: Search matches are highlighted with the shared Highlight component

- **WHEN** the user types a query that matches part of a deployment or agent name in the opened panel
- **THEN** the matching substring renders via the `Highlight` component from `@epam/ai-dial-ui-kit`, consistent with the chat input's selector

#### Scenario: Favorites and Browse behavior are unchanged

- **WHEN** the user stars/unstars an item or activates "Browse" from the opened panel
- **THEN** the same `toggleFavorite`/catalog-navigation behavior fires as when the equivalent action is taken from the chat input's selector

### Requirement: The panel accepts host-supplied non-deployment rows through extraOptions

A host SHALL be able to pin rows that are not deployments above every catalog section — a mode or sentinel choice, such as the `Default agent` / `Last used agent` modes of the default-agent preference. `DeploymentSelectorPanel.tsx` SHALL export a `DeploymentSelectorExtraOption` interface of exactly `{ id: string; label: string }`: no `CatalogItem` shape, no icon field, no entity type. Constructing a fake `CatalogItem` to carry a mode — chat 1.0's `SPECIAL_DEFAULT_MODEL_DIC` hack, where a synthetic `DialAIEntityModel` was pushed through the model list — SHALL NOT be reintroduced.

The prop SHALL be threaded through the whole chain without any of the layers interpreting it: `DeploymentSelectorFieldTrigger` → `useDeploymentSelectorFieldOverlay` (third parameter) → `DeploymentSelectorOverlay` → `DeploymentSelectorPanel`. It SHALL default to a module-level empty array, so the default never changes identity between renders and the plain deployment picker is unaffected.

An extra option's `id` SHALL flow through `onSelect` and `selectedId` exactly as a deployment id does, so the host needs no separate prop pair or discriminator for them. `useDeploymentSelectorFieldOverlay`'s `resolvedLabel` SHALL resolve in this order: a matching `extraOptions` row's `label`, then the resolved deployment's name, then the raw `selectedId` — so a mode's own label, not its sentinel id, is what the field displays.

Each extra row SHALL render with the same row chrome as a deployment row — a `MenuItem` with `role="menuitemradio"`, `aria-checked` reflecting selection, and `MenuItemMark.Tint` when chosen, inside the same `role="menu"` scroll body — minus the deployment icon and the favourite star toggle, neither of which a mode has, so it reads as a mode rather than as an agent. The rows SHALL be grouped in their own `role="group"` list rendered before the Current Selected and Favorites sections. Picking one SHALL call `onSelect` with its `id` and close the panel, the same path a deployment pick takes.

The panel's search SHALL filter extra rows by case-insensitive substring on `label`, alongside the deployment rows, and a surviving row's matched text SHALL render through the shared `Highlight` component from `@epam/ai-dial-ui-kit` per `.claude/rules/search-results-highlight.md`; with an empty query the row's label renders through `EllipsisTooltip` instead. A selected extra row SHALL participate in the panel's scroll-the-selection-into-view behaviour on open, exactly as a selected deployment row does.

#### Scenario: Extra rows precede every catalog section

- **GIVEN** `extraOptions` holds two rows and the user has favorites
- **WHEN** the panel opens
- **THEN** the two rows render first, in the supplied order, above the Current Selected and Favorites sections, each without an icon and without a favourite toggle

#### Scenario: Picking an extra row reports its id and closes the panel

- **WHEN** the user picks an extra row whose `id` is `default-agent`
- **THEN** `onSelect` is called with `'default-agent'` and the panel closes

#### Scenario: The field displays an extra option's label, not its id

- **GIVEN** `selectedId` equals an `extraOptions` row's `id`
- **WHEN** the trigger renders
- **THEN** it displays that row's `label`, and no attempt is made to resolve the id against the deployment list

#### Scenario: Search filters extra rows alongside deployments

- **WHEN** the user types a query that matches one extra row's label and no other row
- **THEN** that row survives with its matched substring rendered through `Highlight`, and the non-matching extra row is filtered out

#### Scenario: Omitting extraOptions leaves the plain deployment picker unchanged

- **WHEN** a host renders the trigger without `extraOptions`
- **THEN** no extra group is rendered and the panel's sections, selection marking, and search behave exactly as they do for the chat input's own selector

### Requirement: DeploymentSelectorFieldTrigger surfaces loading, empty, error, disabled, and unavailable-deployment states

`DeploymentSelectorFieldTrigger` SHALL reflect `useDeployments()`'s `isLoading`/`error` state and an explicit `isDisabled` prop:

- **Loading:** the trigger SHALL render a busy affordance (a spinner replacing the trailing chevron) while deployments are loading. The loading placeholder text SHALL only replace the displayed label when nothing has resolved yet (`selectedId` is `null`, or set but not yet resolvable); once a `resolvedLabel` is available — including its raw-id fallback for an unresolved deployment — a subsequent background refetch (`isLoading` becoming `true` again) SHALL NOT blank out or replace that already-displayed label with loading text.
- **Empty:** when the deployment list has loaded with zero items, the trigger SHALL remain interactive; the opened panel SHALL show its existing empty-favorites hint, and "Browse" SHALL remain available.
- **Error:** when `useDeployments().error` is set, the trigger SHALL render an error affordance while remaining keyboard-reachable.
- **Disabled:** when `isDisabled` is `true` (e.g. while the host form is submitting), the trigger SHALL NOT open and SHALL render dimmed, matching the chat input's `ModelSelectorControl` `isDisabled` behavior.
- **Unavailable selected deployment:** when `selectedId` is set but does not resolve via `findDeploymentByIdOrReference` (e.g. a deleted/renamed deployment referenced by an existing Scheduled Task), the trigger SHALL display a fallback label (the raw stored id) instead of silently clearing `selectedId` or calling `onSelect` on the host's behalf.

#### Scenario: Loading state shows a busy affordance without clearing selection

- **WHEN** `useDeployments().isLoading` is `true` and nothing has resolved yet
- **THEN** the trigger renders a busy affordance and loading placeholder text, and `selectedId` is not altered

#### Scenario: A background refetch does not blank out an already-resolved label

- **WHEN** `useDeployments().isLoading` becomes `true` again (a background refetch) while `resolvedLabel` is already non-null for the current `selectedId`
- **THEN** the trigger continues displaying `resolvedLabel`, not the loading placeholder text

#### Scenario: Empty deployment list still allows Browse

- **WHEN** `useDeployments().items` is loaded and empty
- **THEN** the trigger remains interactive and the opened panel's footer "Browse" action is available

#### Scenario: Error state keeps the trigger reachable

- **WHEN** `useDeployments().error` is set
- **THEN** the trigger renders an error affordance and remains focusable/activatable via keyboard

#### Scenario: isDisabled prevents opening

- **WHEN** `isDisabled` is `true` and the user activates the trigger
- **THEN** the panel does not open

#### Scenario: Unresolvable selectedId falls back to a raw-id label without clearing selection

- **WHEN** `selectedId` is a non-empty string that `findDeploymentByIdOrReference` cannot resolve against the loaded deployment list
- **THEN** the trigger displays that raw id as a fallback label, `onSelect` is not called, and `selectedId` is not cleared

### Requirement: DeploymentSelectorFieldTrigger meets accessibility and RTL requirements independent of its host form

The trigger button SHALL expose `aria-haspopup="listbox"`, `aria-expanded` reflecting open state, and `aria-labelledby` referencing the host-supplied label element's id. The trigger is built on the `Input` component from `@epam/ai-dial-ui-kit` (`readOnly`, with a trailing `iconAfter` chevron/spinner) — the same recipe `Select` uses for its own field — so its interactive target height matches `Input`'s standard field height (40px) and is consistent with every other field in the host form (Display name, Description, Prompt), rather than a bespoke 44×44px minimum. Keyboard users SHALL be able to open the panel (Enter/Space), navigate its search box and list (Tab/Arrow keys, inherited from the existing panel implementation), select an item (Enter), and close it (Escape) with focus restored to the trigger button. All layout SHALL use Tailwind logical properties; the chevron icon's directional treatment (if any) SHALL be verified against an RTL locale rather than assumed symmetric. The component SHALL work at both the `mobile` and `desktop` breakpoints defined in `tailwind.config.js`, reusing the existing panel's own mobile/desktop behavior — no new breakpoint-specific layout logic is introduced beyond selecting between the full-width field's own responsive sizing.

#### Scenario: Keyboard user can open, select, and close

- **WHEN** a keyboard-only user Tabs to the trigger, presses Enter to open it, uses Arrow keys and Enter to select a deployment
- **THEN** the panel opens, the selection is applied, the panel closes, and focus returns to the trigger button

#### Scenario: Escape closes the panel and restores focus

- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel closes and focus returns to the trigger button

#### Scenario: Trigger exposes expanded and labelled state

- **WHEN** the panel is open
- **THEN** the trigger button has `aria-expanded="true"` and `aria-labelledby` pointing at the host's label element

#### Scenario: Trigger matches the standard field height used elsewhere in the form

- **WHEN** the trigger is rendered on either the `mobile` or `desktop` breakpoint
- **THEN** its field height matches `Input`'s standard size (40px), the same height as the form's other `Input`-based fields

#### Scenario: Component renders correctly under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the trigger's label, selected value, and chevron lay out mirrored using logical properties, with no hard-coded left/right offset breaking the mirrored layout

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
