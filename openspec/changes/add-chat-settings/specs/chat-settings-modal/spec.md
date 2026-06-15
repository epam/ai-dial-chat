## ADDED Requirements

### Requirement: Chat settings entry in the + dropdown menu

The `AddAttachmentButton` component in `libs/conversation-input` SHALL accept an optional `extraMenuItems` prop of type `DropdownMenuItem[]`. When provided, each item in `extraMenuItems` SHALL be appended to the menu list after the built-in "Attach file" item and rendered in both the desktop `DialDropdown` and the mobile `BottomSheet`.

`Input` and `ConversationInput` in `libs/conversation-input` SHALL thread `extraMenuItems` through to `AddAttachmentButton`.

The app layer (`apps/chat`) SHALL always pass a "Chat settings" menu item, regardless of whether the active deployment exposes any `features`.

#### Scenario: "Chat settings" is always present in the dropdown

- **WHEN** the user opens the `+` dropdown for any conversation
- **THEN** a "Chat settings" item is always present in the menu

#### Scenario: User clicks "Chat settings"

- **WHEN** the user clicks the "Chat settings" dropdown item
- **THEN** the `ChatSettingsModal` opens

---

### Requirement: ChatSettingsModal renders deployment-gated settings

`apps/chat/src/components/ChatSettingsModal/ChatSettingsModal.tsx` SHALL render a popup modal with the title "Chat settings". The modal SHALL render:

- A **system prompt** textarea when `features.systemPrompt === true`.
- A **temperature** numeric input (range 0–1, step 0.1) when `features.temperature === true`.

Sections not enabled by the active deployment's `features` SHALL be hidden entirely (not disabled).

The modal SHALL have a primary "Save" action that writes the values to the current conversation's `prompt` (system prompt) and `temperature` fields via a callback prop, and then closes.

The modal SHALL have a "Cancel" / close action that discards any unsaved changes and closes without side effects.

All user-visible labels (title, field labels, buttons) SHALL be provided as props from the app (via i18n `t()` calls at the app level); the component itself must not call `useTranslation`.

#### Scenario: Deployment enables only system prompt

- **WHEN** `features.systemPrompt === true` and `features.temperature === false`
- **THEN** the modal shows the system prompt textarea and hides the temperature input

#### Scenario: Deployment enables only temperature

- **WHEN** `features.temperature === true` and `features.systemPrompt === false`
- **THEN** the modal shows the temperature input and hides the system prompt textarea

#### Scenario: Deployment enables both settings

- **WHEN** `features.systemPrompt === true` and `features.temperature === true`
- **THEN** the modal shows both the system prompt textarea and the temperature input

#### Scenario: User saves settings

- **WHEN** the user edits values and clicks "Save"
- **THEN** the `onSave` callback is called with `{ systemPrompt?, temperature? }` containing the updated values, and the modal closes

#### Scenario: User cancels

- **WHEN** the user clicks "Cancel" or the close button without saving
- **THEN** the `onSave` callback is NOT called and the modal closes with no state change

#### Scenario: Modal pre-fills current values

- **WHEN** the modal opens with existing conversation `prompt` and `temperature`
- **THEN** the system prompt textarea shows the current `prompt` value and the temperature input shows the current `temperature` value
