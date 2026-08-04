## ADDED Requirements

### Requirement: Models are loaded once during app startup

`ModelsContext` (owned by `ModelsProvider` in `apps/chat/src/context/ModelsContext.tsx`) SHALL call `GET /api/v1/models` exactly once when the provider mounts. The result is cached in context state for the lifetime of the session. No refetch occurs on navigation or re-render.

The endpoint is `/api/v1/models` — a versioned business endpoint proxied by `apps/chat-api`. It returns `{ data: DialModelDto[] }`. The existing 30-second server-side cache (`@epam/cache-manager`) applies; no additional frontend caching is required.

#### Scenario: Models load successfully on mount

- **WHEN** `ModelsProvider` mounts and the API returns a non-empty model list
- **THEN** `ModelsContext` sets `isLoading: false`, `error: null`, and `models` to the returned `DialModelDto[]` array

#### Scenario: Models endpoint returns an empty list

- **WHEN** `ModelsProvider` mounts and the API returns `{ data: [] }`
- **THEN** `ModelsContext` sets `isLoading: false`, `error: null`, `models: []`, and `selectedModelId: null`

#### Scenario: Models endpoint fails with a network or server error

- **WHEN** `ModelsProvider` mounts and the API call rejects or returns a non-2xx status
- **THEN** `ModelsContext` sets `isLoading: false`, `error` to the caught error, and `models: []`

#### Scenario: Provider unmounts before the fetch resolves

- **WHEN** `ModelsProvider` unmounts while the fetch is still in flight
- **THEN** no state update occurs after unmount (cancelled flag prevents `setState`)

---

### Requirement: Model context exposes loading, error, models, and selectedModel state

`ModelsContextType` SHALL expose the following shape:

```typescript
interface ModelsContextType {
  models: DialModelDto[];
  selectedModelId: string | null;
  setSelectedModelId: (id: string) => void;
  isLoading: boolean;
  error: Error | null;
}
```

The context value SHALL be wrapped in `useMemo` to prevent consumers re-rendering on every parent render. The `useModels()` hook SHALL throw `'useModels must be used within a ModelsProvider'` when called outside the provider.

**Memoisation requirement:** The context `value` object passed to `<ModelsContext.Provider value={...}>` MUST be wrapped in `useMemo` with `[models, selectedModelId, setSelectedModelId, isLoading, error]` as dependencies.

#### Scenario: Consumer used inside provider

- **WHEN** a component calls `useModels()` and is rendered inside `ModelsProvider`
- **THEN** the hook returns the current `ModelsContextType` value without throwing

#### Scenario: Consumer used outside provider

- **WHEN** a component calls `useModels()` and is rendered outside any `ModelsProvider`
- **THEN** the hook throws an error with the message `'useModels must be used within a ModelsProvider'`

---

### Requirement: A default model is selected when models are loaded

When the model list resolves to a non-empty array, `ModelsContext` SHALL automatically set `selectedModelId` to `models[0].id` (the first entry in the API response array). No user interaction is required to establish the default.

#### Scenario: Non-empty list returned

- **WHEN** the API returns `[{ id: 'gpt-4', ... }, { id: 'claude-3', ... }]`
- **THEN** `selectedModelId` is set to `'gpt-4'` automatically

#### Scenario: Empty list returned

- **WHEN** the API returns `{ data: [] }`
- **THEN** `selectedModelId` remains `null`

---

### Requirement: User can change the selected model from the initial chat input

`ConversationRoute` SHALL render a `ModelSelectorButton` component (via the `rightControls` slot of `ConversationInput`) that allows the user to change the active model before sending the first message. The selector reads from and writes to `ModelsContext`.

**i18n keys required:**

| Key | Description |
|---|---|
| `models.selector.label` | Accessible label for the model selector trigger button |
| `models.selector.openLabel` | Aria-label when dropdown is open |
| `models.selector.emptyLabel` | Aria-label when model list is empty |
| `models.selector.errorLabel` | Aria-label when loading failed |
| `models.selector.listLabel` | Aria-label for the dropdown listbox |
| `models.selector.optionLabel` | Aria-label template for each option (includes `{{modelId}}`) |

**Accessibility:**

- The trigger button SHALL carry `aria-haspopup="listbox"` and `aria-expanded={isOpen}`.
- The dropdown SHALL be a `<ul role="listbox" aria-label={t('models.selector.listLabel')}>`.
- Each option SHALL be `<li role="option" aria-selected={isSelected}>`.
- Keyboard: `↓`/`↑` navigate between options; `Enter`/`Space` selects the focused option; `Escape` closes without changing selection. Focus returns to the trigger button on close.
- The trigger button SHALL be a semantic `<button>` element (not a `<div>`).

**Visual design (Figma node 33:4536, node 27:4520):**

- Trigger: 40 × 40 px button in `right_controls` area; model icon (24 × 24) with stacked chevron (20 × 20) on a semi-transparent badge.
- Open state: background `rgba(125,164,255,0.36)` (`--controls/background/accent-primary-alpha-active`).
- Closed state: no background (transparent / neutral).
- Dropdown: 240 px wide, `bg-[var(--background/bg-layer-raised)]`, `rounded-[var(--radius-1,4px)]`, `shadow-[0px_0px_4px_0px_rgba(9,13,19,0.15)]`.
- Items: 40 px tall, `px-3`, `gap-3`; model icon (18 × 18 placeholder) + model id text (14 px, `--text&icon/primary`).
- First slice uses a generic `@tabler/icons-react` icon for all models.

#### Scenario: User opens the model selector

- **WHEN** user clicks the `ModelSelectorButton` trigger
- **THEN** a dropdown list of all available models appears with `aria-expanded="true"` on the trigger

#### Scenario: User selects a different model

- **WHEN** user clicks a model option in the open dropdown
- **THEN** `setSelectedModelId` is called with the chosen model's `id`, the dropdown closes, and the trigger reflects the new selection

#### Scenario: User closes without selecting

- **WHEN** user presses `Escape` while the dropdown is open
- **THEN** the dropdown closes, `selectedModelId` is unchanged, and focus returns to the trigger button

#### Scenario: Empty model list

- **WHEN** `models` is an empty array
- **THEN** the trigger button is rendered as `disabled` with `aria-label={t('models.selector.emptyLabel')}` and the dropdown cannot be opened

#### Scenario: Models still loading

- **WHEN** `isLoading` is `true`
- **THEN** the trigger button is rendered with `aria-busy="true"` and `disabled`

#### Scenario: Model loading failed

- **WHEN** `error` is non-null
- **THEN** the trigger button is rendered as `disabled` with `aria-label={t('models.selector.errorLabel')}`

---

### Requirement: Conversation creation uses the selected model

When the user submits the initial chat input in `ConversationRoute`, the selected `modelId` SHALL be forwarded to the `createConversation` API call as part of the request body. The backend `CreateConversationDto` SHALL accept an optional `modelId?: string` field.

**Backend contract change:**

- Endpoint: `POST /api/v1/conversations`
- Request body (updated):
  ```json
  {
    "firstMessage": "Hello",
    "modelId": "gpt-4"      // optional
  }
  ```
- `modelId` is optional — omitting it is valid and backward-compatible.
- `modelId` validation: `@IsOptional()`, `@IsString()`, `@MaxLength(500)`.
- No new error codes introduced; validation failures still return `400`.

**Generated client note:** After the DTO change, `npm exec nx build chat-api-client --skip-nx-cache` must be run to regenerate the typed client. The wrapper `createConversation` in `apps/chat/src/server-api/conversations.api.ts` must be updated to accept and forward `modelId?: string`.

#### Scenario: Conversation created with a selected model

- **WHEN** user types a message and submits with a model selected
- **THEN** `createConversation` is called with `{ firstMessage, modelId: selectedModelId }` and the backend receives a non-null `modelId`

#### Scenario: Conversation created with no model available

- **WHEN** `selectedModelId` is `null` (empty model list or loading error) and user submits
- **THEN** `createConversation` is called with `{ firstMessage }` only (no `modelId` key or `modelId: undefined`)

---

### Requirement: Loading and error states are accessible

While models are loading or when loading has failed, the `ModelSelectorButton` SHALL communicate state to assistive technologies without relying on colour alone.

#### Scenario: Loading state announced

- **WHEN** `isLoading` is `true`
- **THEN** the trigger button has `aria-busy="true"` and `disabled`; screen readers announce it as busy

#### Scenario: Error state announced

- **WHEN** `error` is non-null
- **THEN** the trigger button has an `aria-label` that includes the i18n key `models.selector.errorLabel`; the error is not conveyed only by colour or icon

---

### Requirement: `ConversationInput` accepts an optional `rightControls` render slot

`ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts` SHALL include `rightControls?: ReactNode`. The `ConversationInput` component SHALL render `rightControls` inside its `right_controls` container when the prop is provided. When `rightControls` is omitted, the component behaves identically to the current implementation — no visual or behavioural regression.

#### Scenario: `rightControls` provided

- **WHEN** `<ConversationInput rightControls={<ModelSelectorButton ... />} ... />` is rendered
- **THEN** the `ModelSelectorButton` appears inside the input bar's right control area

#### Scenario: `rightControls` omitted

- **WHEN** `<ConversationInput onSend={...} />` is rendered without `rightControls`
- **THEN** the input bar renders identically to the current implementation with no empty space or regression
