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

`DeploymentItemDto` (in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`) SHALL include an optional `features?: DeploymentFeaturesDto` field annotated with `@ApiPropertyOptional`. `mapToDeploymentItem` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`) SHALL map the raw DIAL Core snake_case `features` object onto it: `systemPrompt` from `system_prompt` and `temperature` from `temperature` (each defaulting to `false`), plus `folderAttachments`, `mcp`, `responsesApi`, `chatCompletion`, `skillsSupported` and `tools` when the corresponding raw flag is set. `features` is populated when the raw deployment has a `features` object or is MCP-capable; otherwise it SHALL be omitted (undefined).

`DeploymentFeaturesDto` SHALL carry `@ApiProperty` decorators for `systemPrompt` and `temperature` and `@ApiPropertyOptional` for the other flags. It has no `responseFormat` field — response-format support is not read from DIAL Core (see the `+` menu requirement below).

#### Scenario: DIAL Core returns deployment with features

- **WHEN** the DIAL Core deployment payload includes `{ features: { system_prompt: true, temperature: false } }` and is not MCP-capable
- **THEN** `DeploymentItemDto.features` equals `{ systemPrompt: true, temperature: false }`

#### Scenario: DIAL Core returns deployment without features

- **WHEN** the DIAL Core deployment payload does not include a `features` field and is not MCP-capable
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

#### Scenario: Saved payload carries only enabled fields

- **WHEN** a deployment enables `responseFormat` but neither `systemPrompt` nor `temperature`, and the user saves
- **THEN** the emitted `ChatSettingsValues` contains `responseFormat` and omits `systemPrompt` and `temperature`

---

### Requirement: Chat settings entry in the + dropdown menu

The `AddAttachmentButton` component in `libs/conversation-input` SHALL accept:
- `chatSettings?: ChatSettingsConfig` — when provided, appends a settings item (`IconSettings` gear) as the last dropdown entry, after attach, `extraMenuItems`, Tools, `menuOverlays` and Record voice. Its label is `chatSettings.menuItemLabel ?? 'Chat settings'`.
- `extraMenuItems?: ExtraMenuItem[]` — additional items of type `{ key, label, icon, onClick }`. `Input` builds this list itself (the DIAL file-system entry, from `onDialFileSystemClick`); it is not a host-facing `Input`/`ConversationInput` prop.

`Input` SHALL thread `chatSettings` through to `AddAttachmentButton`; `ConversationInput` forwards it to `Input` via its spread props.

The app layer (`apps/chat`) SHALL build `chatSettings` with `useChatSettingsFormConfig` (`@epam/ai-dial-chat-hooks`) and pass it only when the `OverlayFeature.ChatSettings` (`chat-settings`) UI feature is enabled: `ConversationView` gates it on `chat-settings` alone, and `NewConversationComposer` additionally requires `OverlayFeature.EmptyChatSettings` (`empty-chat-settings`). `useChatSettingsFormConfig` always sets `features.responseFormat: true`, takes `systemPrompt` from the deployment features, disables `temperature` for quick apps, defaults the conversation temperature to `0.5`, and labels both the menu item and the modal title with the `settings` label (the app passes `t(BasicI18nKeys.Settings)`, "Settings").

#### Scenario: Settings item is present when the UI feature is enabled

- **WHEN** the `chat-settings` UI feature is enabled and the user opens the `+` dropdown in an open conversation
- **THEN** the settings item is present as the last menu entry

#### Scenario: User clicks "Chat settings"

- **WHEN** the user clicks the "Chat settings" dropdown item
- **THEN** on desktop the `ChatSettingsModal` opens; on mobile the `ChatSettingsBottomSheet` opens stacked on top of the attachment sheet

---

### Requirement: ChatSettingsModal renders deployment-gated settings (desktop)

`ChatSettingsModal` in `libs/conversation-input` SHALL render a ui-kit 2.0 `Popup` (`PopupSize.Sm`). The modal SHALL render the following sections, each conditionally gated by `features`:

- A **response format** radio group (`Markdown` / `Plain text`) when `features.responseFormat === true`. Default value is `ResponseFormat.Markdown`.
- A **system prompt** textarea when `features.systemPrompt === true`.
- A **temperature** slider (range 0–1, step 0.1) when `features.temperature === true`, pre-filled from the required `initialTemperature` (the lib has no default; `useChatSettingsFormConfig` supplies `0.5` when the conversation has none). Three labels SHALL be shown below the track: `[start, middle, end]` via `temperatureLabels` prop; defaults `['Precise', 'Neutral', 'Creative']`.

Sections not enabled SHALL be hidden entirely (not disabled).

The modal SHALL have a primary "Apply changes" action that calls `onSave` with `ChatSettingsValues` and closes. It SHALL close without saving when the user dismisses it (no `onSave` call). The button SHALL be disabled (and optionally show a tooltip) when `canSubmit` is `false` — see the *Response format required* requirement below.

All user-visible strings SHALL be provided as optional props (with English defaults); the component MUST NOT call `useTranslation`.

#### Scenario: Only enabled sections are rendered

- **WHEN** `features` enables `systemPrompt` alone
- **THEN** the modal renders the system prompt textarea
- **AND** no response format radio group and no temperature slider are present in the DOM

#### Scenario: Applying changes saves and closes

- **WHEN** the user edits a field and activates "Apply changes"
- **THEN** `onSave` is called with the current `ChatSettingsValues` and the modal closes

#### Scenario: Dismissing discards the edit

- **WHEN** the user dismisses the modal instead of applying
- **THEN** the modal closes and `onSave` is not called

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

The button SHALL show a tooltip with the `saveDisabledTooltip` prop text while it is disabled. The lib has no default for it: when `saveDisabledTooltip` is not provided the tooltip SHALL be suppressed (`useChatSettingsFormConfig` defaults it to `'Please select a response format'`).

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
