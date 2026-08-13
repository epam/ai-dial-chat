# chat-settings Specification

## Purpose

Deployment-gated chat settings such as response format, rendered in a desktop modal and a mobile bottom sheet.

## Requirements

### Requirement: ResponseFormat enum in libs/chat-shared

`libs/chat-shared/src/models/deployment-features.ts` SHALL export a `ResponseFormat` string enum:

```ts
export enum ResponseFormat {
  Markdown = 'markdown',
  PlainText = 'plain_text',
}
```

The enum SHALL be re-exported from the `libs/chat-shared` barrel (`src/index.ts`).

#### Scenario: Enum is importable from chat-shared

- **WHEN** application code imports `ResponseFormat` from `@epam/ai-dial-chat-shared`
- **THEN** `ResponseFormat.Markdown` equals `'markdown'` and `ResponseFormat.PlainText` equals `'plain_text'`

---

### Requirement: DeploymentFeatures interface in libs/chat-shared

`libs/chat-shared/src/models/deployment-features.ts` SHALL export the following interface:

```ts
export interface DeploymentFeatures {
  systemPrompt: boolean;
  temperature: boolean;
  responseFormat?: boolean;
}
```

The interface SHALL be re-exported from the `libs/chat-shared` barrel (`src/index.ts`).

#### Scenario: Interface is importable from chat-shared

- **WHEN** application code imports `DeploymentFeatures` from `@epam/ai-dial-chat-shared`
- **THEN** the type is available with `systemPrompt: boolean`, `temperature: boolean`, and optional `responseFormat?: boolean` properties

---

### Requirement: DeploymentItemDto features field

`DeploymentItemDto` (in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`) SHALL include an optional `features?: DeploymentFeaturesDto` field annotated with `@ApiPropertyOptional`. `DeploymentsService` SHALL read a `features` property from the raw DIAL Core deployment object and assign it to `DeploymentItemDto.features` when present; when absent, `features` SHALL be omitted (undefined).

`DeploymentFeaturesDto` SHALL mirror `DeploymentFeatures` from `@epam/ai-dial-chat-shared` with `@ApiProperty` decorators for `systemPrompt` and `temperature`.

#### Scenario: DIAL Core returns deployment with features

- **WHEN** the DIAL Core deployment payload includes `{ features: { systemPrompt: true, temperature: false } }`
- **THEN** `DeploymentItemDto.features` equals `{ systemPrompt: true, temperature: false }`

#### Scenario: DIAL Core returns deployment without features

- **WHEN** the DIAL Core deployment payload does not include a `features` field
- **THEN** `DeploymentItemDto.features` is undefined

---

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
  saveDisabledTooltip?: string;       // tooltip on disabled save button; no tooltip when omitted
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

The modal SHALL have a primary "Apply changes" action that calls `onSave` with `ChatSettingsValues` and closes. It SHALL close without saving when the user dismisses it (no `onSave` call). The button SHALL be disabled (and optionally show a tooltip) when `canSubmit` is `false` — see the *Response format required* requirement below.

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

#### Scenario: Mobile bottom sheet discards unsaved edits on reopen

- **WHEN** the user edits values in the bottom sheet, dismisses without saving, and then reopens it
- **THEN** all form fields show the last saved values, not the discarded edits

#### Scenario: Modal pre-fills current values

- **WHEN** the modal opens with existing conversation `prompt`, `temperature`, and `responseFormat`
- **THEN** each field pre-populates with the corresponding current value

---

### Requirement: Response format required when feature is enabled

When `features.responseFormat === true`, the "Apply changes" button SHALL be disabled until the user has selected a response format value.

The button SHALL show a tooltip (provided via `saveDisabledTooltip` prop, default `'Please select a response format'`) while it is disabled. When `saveDisabledTooltip` is not provided the tooltip SHALL be suppressed.

Calling `handleSubmit` programmatically while `canSubmit` is `false` SHALL be a no-op (i.e. `onSave` and `onClose` are not called).

`ChatSettingsConfig` SHALL include an optional `saveDisabledTooltip?: string` field that is forwarded to both `ChatSettingsModal` and `ChatSettingsBottomSheet` by `AddAttachmentButton`.

The app layer (`apps/chat`) SHALL supply this string from the `chatSettings.saveDisabledTooltip` i18n key (`"Please select a response format"`).

#### Scenario: Apply changes disabled when no response format selected

- **GIVEN** `features.responseFormat === true`
- **WHEN** the user deselects the active response format option so that no option is selected
- **THEN** the "Apply changes" button is disabled

#### Scenario: Tooltip shown on disabled Apply changes button

- **GIVEN** the "Apply changes" button is disabled because no response format is selected
- **AND** `saveDisabledTooltip` is provided
- **WHEN** the user hovers over the button
- **THEN** a tooltip appears with the `saveDisabledTooltip` text

#### Scenario: Apply changes enabled when a response format is selected

- **GIVEN** `features.responseFormat === true`
- **WHEN** the user has a response format selected (either the pre-filled value or a newly chosen one)
- **THEN** the "Apply changes" button is enabled

#### Scenario: Submit is a no-op when canSubmit is false

- **WHEN** `handleSubmit` is invoked while no response format is selected
- **THEN** `onSave` is NOT called and the modal/sheet does NOT close
