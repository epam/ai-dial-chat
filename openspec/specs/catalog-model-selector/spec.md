# Spec: catalog-model-selector

## Requirements

### Requirement: InputProps extended with model selector props

`InputProps` in `libs/conversation-input/src/models/Input.ts` SHALL be extended with the following optional props. Each prop MUST have an inline JSDoc comment:

```ts
/** Catalog items available for selection; each entry exposes at minimum `id`, `displayName`, `type`, and optional `iconUrl`. */
catalogItems?: CatalogItemDto[];

/** The `id` of the currently selected catalog item, or `null`/`undefined` when none is selected. */
selectedCatalogItemId?: string | null;

/** Called when the user picks a different catalog item from the dropdown. */
onSelectedCatalogItemChange?: (itemId: string) => void;

/** Accessible label for the model selector dropdown trigger button. */
modelSelectorAriaLabel?: string;

/** Accessible loading label announced while the trigger and menu show skeleton placeholders. */
modelSelectorLoadingLabel?: string;

/** Text shown in the trigger when the catalog failed to load. */
modelSelectorErrorLabel?: string;

/** Text shown as a disabled menu item when the catalog loaded successfully but contains no items. */
modelSelectorEmptyLabel?: string;
```

`CatalogItemDto` MUST be imported from `@epam/chat-api-client`. The lib MUST NOT import from `@epam/ai-dial-chat-shared` for this DTO.

`ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts` SHALL forward all eight new props to the inner `InputProps` with identical JSDoc.

Every exported prop/type/interface addition in `libs/conversation-input` MUST have a JSDoc comment. All existing JSDoc on `InputProps` and `ConversationInputProps` MUST remain unchanged.

#### Scenario: catalogItems prop accepted without TypeScript error

- **WHEN** a consumer renders `<ConversationInput catalogItems={[...]} selectedCatalogItemId="m1" onSelectedCatalogItemChange={fn} />`
- **THEN** TypeScript compiles without error

#### Scenario: selector props are optional — existing usages still compile

- **WHEN** an existing usage renders `<ConversationInput onSend={fn} />` without any selector props
- **THEN** TypeScript compiles without error and the component renders without throwing

---

### Requirement: DialDropdownIcon model selector rendered in Input

The `Input` component SHALL render a `DialDropdownIcon` trigger in the right-side action group of the bottom toolbar row. The toolbar order SHALL be:

`[AddMenu] [Textarea] [OptionalToolsDropdown] [ModelSelector] [Microphone/Send/Stop]`

The trigger SHALL:
- Use `selectedItem.iconUrl` rendered as an `<img>` when the selected item has an icon URL; otherwise render `<IconRobot size={18} />` from `@tabler/icons-react` as the fallback icon.
- Set `ariaLabel` to `modelSelectorAriaLabel` prop (default: `"Select model"`).
- Be compact and icon-only with a caret; the selected item name SHALL NOT be rendered as visible toolbar text.
- Include the selected item `displayName` (fallback to `id`) in the accessible label so screen-reader users know the current selection.
- Build a `menu` of items from `catalogItems`, each item showing `displayName` (fallback to `id`) as its label.
- Call `onSelectedCatalogItemChange(item.id)` when a menu item is clicked.
- Be disabled (non-interactive, reduced opacity) when `isStreaming === true`.

The selector SHALL NOT be rendered at all when `catalogItems` is `undefined` (no prop provided), keeping existing usages unchanged.

#### Scenario: Selector renders with catalog items

- **WHEN** `catalogItems` is a non-empty array and `selectedCatalogItemId` matches an item
- **THEN** `DialDropdownIcon` is present in the right-side toolbar action group after the Optional tools dropdown and before the microphone/send/stop control
- **AND** the selected item's `displayName` is available through the trigger accessible label, not as visible toolbar text

#### Scenario: Trigger icon uses iconUrl when available

- **WHEN** the selected catalog item has a non-empty `iconUrl`
- **THEN** the trigger renders an `<img>` with `src={iconUrl}` and no tabler icon

#### Scenario: Trigger icon falls back to IconRobot

- **WHEN** the selected catalog item has no `iconUrl`
- **THEN** the trigger renders `<IconRobot>` from `@tabler/icons-react`

#### Scenario: Menu item click updates selection

- **WHEN** the user clicks a menu item for catalog item with `id: "app-1"`
- **THEN** `onSelectedCatalogItemChange` is called with `"app-1"`

#### Scenario: Selector disabled during streaming

- **WHEN** `isStreaming` is `true`
- **THEN** the `DialDropdownIcon` trigger is non-interactive and has a visual disabled state

#### Scenario: No catalogItems prop — selector not rendered

- **WHEN** `catalogItems` is `undefined`
- **THEN** no dropdown or trigger element related to model selection is rendered

---

### Requirement: Send blocked when no deployment selected

The `Input` component SHALL prevent message submission when `catalogItems` is defined (selector is active) and `selectedCatalogItemId` is `null` or `undefined`.

Specifically:
- The send button SHALL be disabled (non-interactive) in this state.
- Pressing Enter in the textarea SHALL NOT call `onSend` in this state.
- Loading, error, and empty states SHALL NOT expand the toolbar with long visible text.
- While loading, the trigger SHALL show a circular `DialSkeleton` from `@epam/ai-dial-ui-kit`. The opened selector SHALL show exactly seven disabled rows, each with a circular icon skeleton and a text skeleton for the item name. The mobile bottom sheet SHALL use the same seven-row loading presentation.
- Error and empty states SHALL be represented by a disabled dropdown menu item with the appropriate accessible label or tooltip.

The `isStreaming === true` stop-button path is unaffected — streaming stop always works regardless of selection state.

#### Scenario: Send button disabled when no selection

- **WHEN** `catalogItems` is `[]` and `selectedCatalogItemId` is `null`
- **THEN** the send button has `aria-disabled="true"` or `disabled` attribute

#### Scenario: Enter key blocked when no selection

- **WHEN** `catalogItems` is defined and `selectedCatalogItemId` is `null` and the user presses Enter
- **THEN** `onSend` is NOT called

#### Scenario: Loading skeletons displayed

- **WHEN** `modelSelectorLoadingLabel` is set, including a reload where `catalogItems` still contains previously loaded items
- **THEN** the selector trigger renders a circular `DialSkeleton`
- **AND** the opened selector renders seven disabled rows containing circular icon and text skeletons
- **AND** the loading label remains exposed to assistive technology

#### Scenario: Error label displayed

- **WHEN** `catalogItems` is `[]` and `modelSelectorErrorLabel` is set
- **THEN** the error label is exposed via the disabled selector trigger accessible label, tooltip, or a disabled dropdown menu item

#### Scenario: Empty catalog label shown

- **WHEN** `catalogItems` is `[]` and `modelSelectorEmptyLabel` is set
- **THEN** the empty label appears as a disabled menu item or accessible selector state without changing the toolbar layout width

---

### Requirement: i18n keys for catalog selector in apps/chat

All user-visible strings for the model selector in `apps/chat` SHALL be keyed in `apps/chat/src/i18n/locales/en.json`. Required keys:

- `catalog.selector.ariaLabel` — e.g. `"Select model or application"`
- `catalog.selector.loading` — e.g. `"Loading catalog…"`
- `catalog.selector.error` — e.g. `"Failed to load catalog"`
- `catalog.selector.empty` — e.g. `"No models or applications available"`

These keys SHALL be read via `useTranslation` in `apps/chat` components (e.g. `ConversationRoute`, `ConversationView`) and passed as props to `ConversationInput`. The lib MUST NOT call `useTranslation` or `t()`.

#### Scenario: App passes translated aria label to ConversationInput

- **WHEN** `ConversationRoute` renders `<ConversationInput>`
- **THEN** the `modelSelectorAriaLabel` prop value equals `t('catalog.selector.ariaLabel')`

#### Scenario: i18n keys present in en.json

- **WHEN** `apps/chat/src/i18n/locales/en.json` is read
- **THEN** all four `catalog.selector.*` keys are present with non-empty English strings

---

### Requirement: ConversationInput lib unit tests for selector

Tests SHALL be added or updated in `libs/conversation-input/src/components/Input/tests/` to cover:

1. Selector is rendered when `catalogItems` is a non-empty array.
2. The trigger renders the selected item's `displayName`.
3. Clicking a menu item calls `onSelectedCatalogItemChange` with the correct id.
4. When `modelSelectorLoadingLabel` is set, the trigger renders one circular skeleton and the selector renders seven disabled rows with circular icon and text skeletons; the loading label remains available to assistive technology.
5. Error label is shown when `catalogItems` is `[]` and `modelSelectorErrorLabel` is set.
6. Send button is disabled when `catalogItems` is defined and `selectedCatalogItemId` is `null`.
7. Enter key does not fire `onSend` when no selection.
8. No selector element when `catalogItems` is `undefined`.

Tests MUST use role, label, and text queries instead of implementation-specific selectors.

#### Scenario: Unit test — selector renders with items

- **WHEN** `Input` is rendered with `catalogItems={[{ id: 'm1', displayName: 'GPT-4', type: 'model' }]}` and `selectedCatalogItemId="m1"`
- **THEN** an element with the accessible name containing `"GPT-4"` or the aria-label `modelSelectorAriaLabel` is present in the rendered output

#### Scenario: Unit test — item click fires callback

- **WHEN** the user clicks the menu item for `id: "app-1"` in the rendered `Input`
- **THEN** `onSelectedCatalogItemChange` spy has been called with `"app-1"`

---

### Requirement: Favorited Applications included in selector's talkable items

`ModelPickerPanel.tsx` (`apps/chat/src/components/ModelPicker/`) SHALL build the `catalogItems` passed into the model selector from the user's favorited catalog items, filtered to conversational entity types only. The talkable-type allowlist SHALL include `CatalogEntityType.Model`, `CatalogEntityType.Agent`, and `CatalogEntityType.Agent`. Non-conversational types (`Toolset`, `Skill`, `Guardrail`, `Mcp`, and any other non-conversational `CatalogEntityType`) SHALL continue to be excluded.

Note: `CatalogEntityType.Agent` is a frontend-only display category (used for catalog tabs/badges); DIAL Core has no "agent" concept, and `mapDeploymentToCatalogItem` never assigns it to real deployment data — only `Model` and `Application` are produced from Core deployments today. The allowlist keeps the `Agent` check for forward compatibility but this requirement's observable behavior change is that `Application` items now pass the filter.

This filter SHALL be memoized (`useMemo`) keyed on the favorites list, consistent with existing behavior.

#### Scenario: Favorited Application appears in the dropdown

- **WHEN** the user has favorited an Application in the Catalog (entity mapped to `CatalogEntityType.Agent`)
- **THEN** `ModelPickerPanel`'s `talkableItems` includes that Application
- **AND** the Application appears as a selectable item in the model selector dropdown alongside favorited Models and Agents

#### Scenario: Favorited Model still appears in the dropdown

- **WHEN** the user has favorited a Model (entity mapped to `CatalogEntityType.Model`)
- **THEN** `ModelPickerPanel`'s `talkableItems` includes that Model

#### Scenario: Favorited non-conversational entity excluded

- **WHEN** the user has favorited an entity mapped to `CatalogEntityType.Toolset`, `Skill`, `Guardrail`, or `Mcp`
- **THEN** `ModelPickerPanel`'s `talkableItems` does NOT include that entity
