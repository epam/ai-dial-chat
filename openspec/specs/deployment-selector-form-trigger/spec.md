# Spec: deployment-selector-form-trigger

## Requirements

### Requirement: DeploymentSelectorFieldTrigger reuses the existing overlay content behind a form-field trigger

`apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger.tsx` SHALL render a full-width outlined form control (matching the visual chrome of `Input`/`Select`) that opens the existing `DeploymentSelectorOverlay`/`DeploymentSelectorPanel` content — search, "Currently selected" row, Favorites list with star toggles, and the "Browse" footer action — via the ui-kit `Dropdown` component, the same primitive `ModelSelectorControl` already uses for the chat input's `modelPickerOverlay` case. The component SHALL NOT introduce a second implementation of search, favorites, grouping, or Browse behavior; it SHALL consume the same mapping utilities `useDeploymentSelectorOverlay` uses (`mapDeploymentToCatalogItem`, `findDeploymentByIdOrReference`) so a deployment's display name, icon, and type render identically to the chat selector.

`DeploymentSelectorFieldTrigger` SHALL accept `selectedId: string | null`, `onSelect: (id: string) => void`, and SHALL NOT read or write `DeploymentsContext.selectedItemId`/`setSelectedItemId` — its selection is independent of the chat input's currently active deployment. It SHALL accept the deployment list and favorites via `useDeployments()`/`useFavoriteApplications()` internally (same context providers the chat input uses), not via props duplicating that data. This independence SHALL hold for every pick path, including a pick made through the "Browse" catalog: `CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL accept an optional `onSelect?: (id: string) => void` prop and, when supplied, route a selector-mode card pick through it instead of `DeploymentsContext.setSelectedItemId`; `CatalogModal` SHALL forward its own optional `onSelect` prop to `CatalogView`; and `useDeploymentSelectorFieldOverlay`'s `catalogModal` SHALL pass its `onSelect` argument through to `CatalogModal`, so a Browse pick from the Scheduled Task form updates the form's `values.modelId` and never the chat input's active deployment. The chat input's own `useDeploymentSelectorOverlay` continues to render `CatalogModal` without an `onSelect` prop, preserving its existing behavior of committing a Browse pick directly to `DeploymentsContext`.

The trigger SHALL render:
- The selected deployment's display name (resolved via `findDeploymentByIdOrReference`/`mapDeploymentToCatalogItem`) when `selectedId` is set, truncated consistently with other form field values.
- A placeholder string (supplied via a labels prop) when `selectedId` is `null`/unset.
- A trailing chevron icon that visually indicates expand/collapse state.

Opening the trigger SHALL render the panel with `matchReferenceWidth` left at the `Dropdown` default (`true`), so the overlay matches the field's full width rather than the icon trigger's fixed `320px` override.

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

The trigger button SHALL expose `aria-haspopup="listbox"`, `aria-expanded` reflecting open state, and `aria-labelledby` referencing the host-supplied label element's id. The interactive trigger area SHALL meet the 44×44px minimum target size. Keyboard users SHALL be able to open the panel (Enter/Space), navigate its search box and list (Tab/Arrow keys, inherited from the existing panel implementation), select an item (Enter), and close it (Escape) with focus restored to the trigger button. All layout SHALL use Tailwind logical properties; the chevron icon's directional treatment (if any) SHALL be verified against an RTL locale rather than assumed symmetric. The component SHALL work at both the `mobile` and `desktop` breakpoints defined in `tailwind.config.js`, reusing the existing panel's own mobile/desktop behavior — no new breakpoint-specific layout logic is introduced beyond selecting between the full-width field's own responsive sizing.

#### Scenario: Keyboard user can open, select, and close

- **WHEN** a keyboard-only user Tabs to the trigger, presses Enter to open it, uses Arrow keys and Enter to select a deployment
- **THEN** the panel opens, the selection is applied, the panel closes, and focus returns to the trigger button

#### Scenario: Escape closes the panel and restores focus

- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel closes and focus returns to the trigger button

#### Scenario: Trigger exposes expanded and labelled state

- **WHEN** the panel is open
- **THEN** the trigger button has `aria-expanded="true"` and `aria-labelledby` pointing at the host's label element

#### Scenario: Trigger meets the minimum interactive target size

- **WHEN** the trigger is rendered on either the `mobile` or `desktop` breakpoint
- **THEN** its interactive hit area is at least 44×44px

#### Scenario: Component renders correctly under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the trigger's label, selected value, and chevron lay out mirrored using logical properties, with no hard-coded left/right offset breaking the mirrored layout
