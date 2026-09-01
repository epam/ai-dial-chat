# Spec: catalog-model-selector

## Purpose

The model selector rendered inside the conversation input, the labels contract the host supplies it, and the send gating it implies.

## Requirements

### Requirement: InputProps carries a deployment list, a selection, and one labels object

`InputProps` in `libs/conversation-input/src/models/Input.ts` SHALL declare the following optional props, each with an inline JSDoc comment:

```ts
/** List of deployment items to populate the model selector menu. When `undefined`, the selector is not rendered. */
deployments?: DeploymentItem[];

/** ID of the currently selected deployment. When `null`/`undefined` and `deployments` is defined, the send button is disabled. */
selectedDeploymentId?: string | null;

/** Called when the user selects a different deployment from the dropdown. Receives the selected item's `id`. */
onDeploymentChange?: (id: string) => void;

/** Labels shown inside the model selector dropdown for the trigger and its various states. */
modelSelectorLabels?: ModelSelectorLabels;
```

`DeploymentItem` SHALL be the host-agnostic model from `@epam/ai-dial-chat-shared` (`libs/chat-shared/src/models/deployment.ts`) — `id`, optional `displayName`, `iconUrl`, `type`, `inputAttachmentTypes`, and `features`. The lib MUST NOT import a generated API-client DTO for this: the selector renders whatever the host resolved, and taking a wire type here would tie the input to one backend's response shape.

`iconUrl` SHALL already be a fully resolved URL usable directly in `<img src>`. Resolving DIAL file ids, theme-relative names, and the like is the host's job, done before the list is passed in.

The four label strings SHALL be grouped into one `ModelSelectorLabels` object rather than passed as separate props, so adding a label is not a new prop on `InputProps`. It SHALL carry `ariaLabel`, `loading`, `error`, `empty`, `searchPlaceholder`, `closeLabel`, and `unavailableTooltip`.

`ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts` SHALL forward these props to the inner `InputProps` with identical JSDoc. Every exported prop/type/interface addition in `libs/conversation-input` MUST have a JSDoc comment.

#### Scenario: Deployment props accepted without TypeScript error

- **WHEN** a consumer renders `<ConversationInput deployments={[...]} selectedDeploymentId="m1" onDeploymentChange={fn} />`
- **THEN** TypeScript compiles without error

#### Scenario: Selector props are optional — existing usages still compile

- **WHEN** an existing usage renders `<ConversationInput onSend={fn} />` without any selector props
- **THEN** TypeScript compiles without error and the component renders without throwing

#### Scenario: The lib takes no wire type for the list

- **WHEN** `libs/conversation-input`'s model files are inspected
- **THEN** the deployment list is typed by `DeploymentItem` from `@epam/ai-dial-chat-shared`, and no generated API-client DTO is imported

---

### Requirement: The selector is an icon-only trigger with a searchable menu

The `Input` component SHALL render the model selector — `ModelSelectorControl` — in the right-side action group of the bottom toolbar row, after any tools control and before the microphone/send/stop control.

The trigger SHALL:
- Render `selectedItem.iconUrl` as an `<img>` when present, and a fallback icon chosen from the item's `type` otherwise.
- Take its accessible name from `modelSelectorLabels.ariaLabel`, incorporating the selected item's `displayName` (falling back to its `id`) so a screen-reader user hears the current selection.
- Stay compact and icon-only with a caret; the selected item's name SHALL NOT be rendered as visible toolbar text, which would let a long model name push the textarea around.
- Call `onDeploymentChange(item.id)` when a menu item is chosen.
- Be disabled while `isStreaming` is `true`.

The menu SHALL include a search field, labelled by `modelSelectorLabels.searchPlaceholder`, filtering the list client-side. On mobile the same list SHALL be presented through `ModelSelectorBottomSheet` instead of a dropdown, closed by a control labelled `modelSelectorLabels.closeLabel`.

A `selectedDeploymentId` that matches no entry in `deployments` SHALL still render the trigger, marked with `modelSelectorLabels.unavailableTooltip` — a deployment removed from the catalog after a conversation was created must be visibly explained, not silently blanked.

The selector SHALL NOT be rendered at all when `deployments` is `undefined`, keeping existing usages unchanged.

#### Scenario: Selector renders with deployments

- **WHEN** `deployments` is a non-empty array and `selectedDeploymentId` matches an item
- **THEN** the selector is present in the right-side toolbar action group, and the selected item's `displayName` is available through the trigger's accessible name rather than as visible toolbar text

#### Scenario: Trigger icon uses iconUrl when available

- **WHEN** the selected item has a non-empty `iconUrl`
- **THEN** the trigger renders an `<img>` with that URL as its `src`

#### Scenario: Menu item click updates selection

- **WHEN** the user chooses the menu item for `id: "app-1"`
- **THEN** `onDeploymentChange` is called with `"app-1"`

#### Scenario: Search narrows the list

- **WHEN** the user types into the selector's search field
- **THEN** only matching deployments remain listed, filtered client-side

#### Scenario: A selection that no longer exists is explained

- **WHEN** `selectedDeploymentId` matches no entry in `deployments`
- **THEN** the trigger still renders and surfaces `unavailableTooltip`

#### Scenario: Selector disabled during streaming

- **WHEN** `isStreaming` is `true`
- **THEN** the trigger is non-interactive and has a visual disabled state

#### Scenario: No deployments prop — selector not rendered

- **WHEN** `deployments` is `undefined`
- **THEN** no selector element is rendered

---

### Requirement: Send is blocked when no deployment is selected

The `Input` component SHALL prevent message submission when `deployments` is defined (the selector is active) and `selectedDeploymentId` is `null` or `undefined`:

- The send button SHALL be disabled.
- Pressing Enter in the textarea SHALL NOT call `onSend`.

The `isStreaming === true` stop-button path is unaffected — stopping always works regardless of selection state.

Loading, error, and empty states SHALL NOT widen the toolbar with visible text. While loading, the trigger and the opened menu SHALL show `ModelSelectorSkeleton` placeholders — a circular skeleton on the trigger, and a fixed number of disabled rows each pairing a circular icon skeleton with a text skeleton — and the mobile bottom sheet SHALL use the same presentation. Error and empty states SHALL be represented by a disabled menu item carrying the corresponding label.

#### Scenario: Send button disabled when no selection

- **WHEN** `deployments` is defined and `selectedDeploymentId` is `null`
- **THEN** the send button is disabled

#### Scenario: Enter key blocked when no selection

- **WHEN** `deployments` is defined, `selectedDeploymentId` is `null`, and the user presses Enter
- **THEN** `onSend` is NOT called

#### Scenario: Loading skeletons displayed

- **WHEN** the loading label is supplied, including on a reload where `deployments` still holds previously loaded items
- **THEN** the trigger renders a circular skeleton, the opened menu renders disabled skeleton rows, and the loading label remains exposed to assistive technology

#### Scenario: Error and empty states stay inside the menu

- **WHEN** the error or empty label is supplied
- **THEN** it appears as a disabled menu item or an accessible selector state, without changing the toolbar's layout width

---

### Requirement: The host resolves selector state into labels; the lib never translates

All user-visible selector strings SHALL be keyed under `deploymentSelector.*` in `apps/chat/src/i18n/locales/en.json` and referenced through `DeploymentSelectorI18nKeys`, except the search placeholder, which reuses the shared `BasicI18nKeys.SearchPlaceholder`. `libs/conversation-input` MUST NOT call `useTranslation` or `t()`.

`apps/chat/src/hooks/conversation/useModelSelectorLabels.ts` SHALL assemble the `ModelSelectorLabels` object from `{ isLoading, error, itemCount }`, memoised on those inputs and `t`. Its shape encodes the selector's state: `ariaLabel`, `searchPlaceholder`, `closeLabel`, and `unavailableTooltip` are always strings, while `loading`, `error`, and `empty` are `string | undefined` and are populated **only** when that state is the active one — `empty` requires not loading, no error, and a zero count.

That inversion is the contract: the lib does not take `isLoading`/`hasError` booleans and decide what to show. It shows whichever state label it was given, so the host owns the precedence between loading, error, and empty in one place.

Both surfaces that render a conversation input — `ConversationView` and `NewConversationComposer` — SHALL obtain their labels from this hook rather than assembling the object inline.

#### Scenario: Only the active state's label is defined

- **WHEN** the deployment list is loading
- **THEN** `loading` is a string and `error` and `empty` are `undefined`

#### Scenario: Empty requires a settled, successful, zero-length list

- **WHEN** the list is not loading, carries no error, and holds zero items
- **THEN** `empty` is a string; if any of those three conditions fails, `empty` is `undefined`

#### Scenario: The lib performs no translation

- **WHEN** `libs/conversation-input`'s selector sources are inspected
- **THEN** they contain no `useTranslation` call, and every user-visible string arrives through `modelSelectorLabels`

---

### Requirement: Only conversational favorites populate the selector

`DeploymentSelectorPanel.tsx` (`apps/chat/src/components/DeploymentSelector/`) SHALL build the selector's list from the user's favorited catalog items, filtered to conversational entity types only: `CatalogEntityType.Model` and `CatalogEntityType.Agent`. Non-conversational types (`Toolset`, `Skill`, and any other `CatalogEntityType`) SHALL be excluded — they are not things a user can talk to.

This filter SHALL be memoised on the favorites list, and the search query SHALL be applied on top of the already-filtered list rather than over the raw favorites.

#### Scenario: Favorited application appears in the selector

- **WHEN** the user has favorited an item mapped to `CatalogEntityType.Agent`
- **THEN** it appears as a selectable entry alongside favorited models

#### Scenario: Favorited model appears in the selector

- **WHEN** the user has favorited an item mapped to `CatalogEntityType.Model`
- **THEN** it appears as a selectable entry

#### Scenario: Favorited non-conversational entity is excluded

- **WHEN** the user has favorited an item mapped to `CatalogEntityType.Toolset` or `CatalogEntityType.Skill`
- **THEN** it does not appear in the selector

#### Scenario: Search applies to the conversational subset

- **WHEN** the user types a query that would also match a favorited toolset
- **THEN** the toolset is still absent, because filtering by type happens before the query is applied
