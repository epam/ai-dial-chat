## ADDED Requirements

### Requirement: ChatSettingsConfig and ChatSettingsValues types

`libs/conversation-input/src/models/Input.ts` SHALL export:

**`ChatSettingsValues`** — the payload emitted when the user saves:
```ts
interface ChatSettingsValues {
  responseFormat?: ResponseFormat;
  systemPrompt?: string;
  temperature?: number;
}
```
Each field is present only when the corresponding feature is enabled.

**`ChatSettingsConfig`** — configuration prop passed from the app to `AddAttachmentButton`:
```ts
interface ChatSettingsConfig {
  features: DeploymentFeatures;
  responseFormat?: ResponseFormat;   // pre-selected value; defaults to ResponseFormat.Markdown
  systemPrompt: string;              // current conversation prompt
  temperature: number;               // current conversation temperature
  onSave: (values: ChatSettingsValues) => void;
  menuItemLabel?: string;
  title?: string;
  responseFormatLabel?: string;
  responseFormatHint?: string;
  responseFormatMarkdownLabel?: string;
  responseFormatPlainTextLabel?: string;
  systemPromptLabel?: string;
  systemPromptTooltip?: string;
  temperatureLabel?: string;
  temperatureLabels?: [string, string, string];
  temperatureHint?: string;
  saveLabel?: string;
  backLabel?: string;                // mobile back-arrow label; defaults to 'Back'
}
```

---

### Requirement: Chat settings entry in the + dropdown menu

The `AddAttachmentButton` component in `libs/conversation-input` SHALL accept:
- `chatSettings?: ChatSettingsConfig` — when provided, appends a "Chat settings" item (gear icon) to the dropdown after any `extraMenuItems`.
- `extraMenuItems?: ExtraMenuItem[]` — additional items injected by the host app (type `{ key, label, icon, onClick }`).

`Input` and `ConversationInput` SHALL thread both props through to `AddAttachmentButton`.

The app layer (`apps/chat`) SHALL pass `chatSettings` whenever a conversation is active.

#### Scenario: "Chat settings" is always present in the dropdown

- **WHEN** the user opens the `+` dropdown for any conversation
- **THEN** a "Chat settings" item is always present in the menu

#### Scenario: User clicks "Chat settings"

- **WHEN** the user clicks the "Chat settings" dropdown item
- **THEN** on desktop the `ChatSettingsModal` opens; on mobile the `ChatSettingsBottomSheet` opens stacked on top of the attachment sheet

---

### Requirement: ChatSettingsModal renders deployment-gated settings (desktop)

`ChatSettingsModal` in `libs/conversation-input` SHALL render a `DialPopup` modal. The modal SHALL render the following sections, each conditionally gated by `features`:

- A **response format** radio group (`Markdown` / `Plain text`) when `features.responseFormat === true`. Default value is `ResponseFormat.Markdown`.
- A **system prompt** textarea when `features.systemPrompt === true`.
- A **temperature** slider (range 0–1, step 0.1) when `features.temperature === true`. Default value is `0.5`. Three labels SHALL be shown below the track: `[start, middle, end]` via `temperatureLabels` prop; defaults `['Precise', 'Neutral', 'Creative']`.

Sections not enabled SHALL be hidden entirely (not disabled).

The modal SHALL have a primary "Apply changes" action that calls `onSave` with `ChatSettingsValues` and closes. It SHALL close without saving when the user dismisses it (no `onSave` call).

All user-visible strings SHALL be provided as optional props (with English defaults); the component MUST NOT call `useTranslation`.

### Requirement: ChatSettingsBottomSheet renders deployment-gated settings (mobile)

`ChatSettingsBottomSheet` in `libs/conversation-input` SHALL render a stacked bottom sheet with the same field set and gating rules as `ChatSettingsModal`. It SHALL accept an `onBack` callback for navigation back to the attachment sheet and include a back arrow in its header.

#### Scenario: Deployment enables response format only

- **WHEN** `features.responseFormat === true`, `features.systemPrompt === false`, `features.temperature === false`
- **THEN** the modal shows the response format radio group and hides all other fields

#### Scenario: Deployment enables only system prompt

- **WHEN** `features.systemPrompt === true`, `features.temperature === false`, `features.responseFormat` falsy
- **THEN** the modal shows the system prompt textarea and hides all other fields

#### Scenario: Deployment enables only temperature

- **WHEN** `features.temperature === true`, `features.systemPrompt === false`, `features.responseFormat` falsy
- **THEN** the modal shows the temperature slider and hides all other fields

#### Scenario: Deployment enables all settings

- **WHEN** `features.responseFormat === true`, `features.systemPrompt === true`, `features.temperature === true`
- **THEN** the modal shows all three fields

#### Scenario: User saves settings

- **WHEN** the user edits values and clicks "Apply changes"
- **THEN** the `onSave` callback is called with `{ responseFormat?, systemPrompt?, temperature? }` containing only the values for enabled fields, and the modal closes

#### Scenario: User cancels

- **WHEN** the user dismisses the modal without saving
- **THEN** the `onSave` callback is NOT called and the modal closes with no state change

#### Scenario: Modal pre-fills current values

- **WHEN** the modal opens with existing conversation `prompt`, `temperature`, and `responseFormat`
- **THEN** each field pre-populates with the corresponding current value
