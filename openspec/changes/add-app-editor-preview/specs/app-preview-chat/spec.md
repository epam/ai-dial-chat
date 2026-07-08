## ADDED Requirements

### Requirement: EditorHeader preview button
`EditorHeader` SHALL accept an optional `onPreview?: () => void` prop and an optional `isPreviewing?: boolean` prop. When `onPreview` is provided, a button with a leading icon SHALL render on the left side of the header, alongside the title and steps nav (not in the Cancel/Save button group on the right). When `onPreview` is not provided, no preview button SHALL render. This requirement applies to `EditorHeader` generically; `ToolsetEditor` is unaffected because it does not render `EditorHeader`.

#### Scenario: Preview button hidden when no callback supplied
- **WHEN** `EditorHeader` is rendered without an `onPreview` prop
- **THEN** no preview/exit-preview button is present in the DOM

#### Scenario: Preview button shown when callback supplied
- **WHEN** `EditorHeader` is rendered with `onPreview` set and `isPreviewing` is `false` or omitted
- **THEN** a button labelled with the `AppsEditorI18nKeys.PreviewButton` translation and an `IconEye` leading icon renders on the left side of the header
- **AND** clicking it invokes `onPreview`

#### Scenario: Button toggles to Exit preview
- **WHEN** `EditorHeader` is rendered with `onPreview` set and `isPreviewing` is `true`
- **THEN** the same button instead shows the `AppsEditorI18nKeys.ExitPreviewButton` translation and an `IconEyeOff` leading icon
- **AND** clicking it invokes `onPreview` (the same callback toggles the mode; `AppsEditor` owns the on/off state)

### Requirement: Preview availability scoped to the Apps editor Settings step
`AppsEditor` SHALL pass `onPreview` to `EditorHeader` only when the current step is `AppsEditorStep.Settings` and both `schema?.editorUrl` and a saved app id (`appIdForSettings`) are present. On the General step, or before an app id exists, `AppsEditor` SHALL omit `onPreview` so the button does not render.

#### Scenario: No preview on General step
- **WHEN** the Apps editor is on `AppsEditorStep.General`
- **THEN** `EditorHeader` receives no `onPreview` prop and shows no preview button

#### Scenario: Preview available on Settings step with a saved app
- **WHEN** the Apps editor is on `AppsEditorStep.Settings` with a non-empty `appIdForSettings` and a schema that has `editorUrl`
- **THEN** `EditorHeader` receives an `onPreview` handler and shows the preview button

### Requirement: Save-then-preview orchestration
Clicking the preview button SHALL trigger the same save flow as the existing Save button (`SettingsStep.triggerSave()` → `AppEditorIframe` posts `AppsEditorEvent.TriggerSave` to the iframe) while recording that the save was requested for preview, not for exit-and-navigate. `AppsEditor` SHALL wait for the resulting `SaveSuccess`/`SaveError` postMessage event before changing the visible pane.

#### Scenario: Preview save succeeds
- **WHEN** the user clicks Preview and the iframe posts `AppsEditorEvent.SaveSuccess`
- **THEN** `AppsEditor` does NOT navigate away (unlike a normal Save-button success)
- **AND** the Settings step content switches from the iframe to the preview chat pane
- **AND** the preview button now reads "Exit preview"

#### Scenario: Preview save fails
- **WHEN** the user clicks Preview and the iframe posts `AppsEditorEvent.SaveError`
- **THEN** `AppsEditor` stays on the iframe (does not enter preview)
- **AND** shows the existing `saveError` `DialNotification` with the error message
- **AND** the preview button still reads "Preview" (not "Exit preview")

#### Scenario: Normal Save button unaffected
- **WHEN** the user clicks the existing Save button (not Preview) and the iframe posts `AppsEditorEvent.SaveSuccess`
- **THEN** `AppsEditor` navigates to `returnUrl`, exactly as before this change

#### Scenario: Stray postMessage while hidden iframe is not previewing-active
- **WHEN** the Apps editor is in preview mode (`isPreviewing === true`) and the still-mounted, hidden `AppEditorIframe` posts any `AppsEditorEvent.SaveSuccess` or `AppsEditorEvent.SaveError` message
- **THEN** `AppsEditor` ignores it (no navigation, no error notification, no state change) because no save was requested while previewing

### Requirement: Exit preview returns to the settings iframe without reload
Clicking "Exit preview" SHALL switch the visible pane back to `AppEditorIframe` without re-saving and without remounting/reloading the iframe (its `src`, load state, and internal state are preserved from before Preview was entered).

#### Scenario: Exit preview
- **WHEN** the user clicks "Exit preview"
- **THEN** the settings iframe becomes visible again showing the same state it had when Preview was clicked
- **AND** no `TriggerSave`, `getConversation`, or navigation call occurs as a side effect

### Requirement: Preview chat uses a fixed model with no model picker
The preview pane SHALL render the existing `ConversationView` component configured so `conversation.model.id` equals the application's deployment id (the same `appId` used by `AppEditorIframe`), and SHALL NOT supply a `deployments` list or `modelPickerOverlay`, so no model-selection control is rendered or interactable.

#### Scenario: Model is fixed
- **WHEN** the preview chat pane is shown
- **THEN** the composer shows no model/deployment selector
- **AND** every message sent from the preview pane targets the application being edited, regardless of any other deployment configured elsewhere in the app

### Requirement: Preview chat history is ephemeral and session-scoped
Preview chat messages SHALL be held only in local React state owned by the Apps editor (Settings step subtree). They SHALL NOT be persisted to any backend conversation resource and SHALL NOT appear in the user's conversation sidebar/history at any point. Toggling between the iframe and the preview pane within the same Apps editor mount SHALL preserve the accumulated message history; navigating away from or reloading the Apps editor page SHALL discard it.

#### Scenario: History survives toggling within a session
- **WHEN** the user sends messages in preview, exits preview, and re-enters preview later in the same editor session
- **THEN** the previously sent and received messages are still shown, and new messages are appended to the same in-memory transcript

#### Scenario: History does not leak into conversation list
- **WHEN** the user sends any number of messages in the preview pane
- **THEN** no new entry appears in the conversation history sidebar/panel, and no conversation resource is created on the backend

#### Scenario: History resets on leaving the editor
- **WHEN** the user navigates away from `/apps-editor` (e.g. via Cancel or browser navigation) and later returns
- **THEN** the preview pane starts with an empty transcript

### Requirement: Preview send/stream/stop is decoupled from persisted-conversation hooks
The preview pane SHALL send messages and stream responses through a dedicated hook (`usePreviewCompletion`) that calls the stateless `preview-completion-api` capability, not `useConversationStream`/`useConversationHandlers` (which require a persisted `conversationId`).

#### Scenario: Sending a preview message
- **WHEN** the user submits text in the preview composer
- **THEN** a user message is appended locally and a request is sent to the stateless preview-completion endpoint carrying the full in-memory transcript plus the new message
- **AND** streamed response chunks are appended to a locally-held assistant message as they arrive

#### Scenario: Stopping a preview generation
- **WHEN** the user clicks Stop while a preview response is streaming
- **THEN** the in-flight request is aborted client-side (`AbortController`) and no further chunks are applied
- **AND** the partially-received assistant message remains visible, marked as stopped, consistent with how a normal conversation shows a stopped generation

### Requirement: Cancel/Save disabled while previewing
While the preview pane is shown, the `EditorHeader` Cancel and Save buttons SHALL be disabled, since the settings form they act on is not visible.

#### Scenario: Buttons disabled during preview
- **WHEN** the Apps editor is in preview mode
- **THEN** both the Cancel and Save buttons render in a disabled state

#### Scenario: Buttons re-enabled after exiting preview
- **WHEN** the user exits preview
- **THEN** Cancel and Save return to their normal enabled state

### Requirement: Accessibility and i18n for the preview surface
The preview button SHALL expose an accessible name via i18n (not a bare icon with no label) and the preview chat region SHALL use the same ARIA conventions as the main conversation view (`role="log"` + `aria-live="polite"` for the message list). All new user-visible strings SHALL be added to `translation-keys.ts` under `AppsEditorI18nKeys` and to every locale file in `apps/chat/src/i18n/locales/`, including `ar.json`.

New keys: `AppsEditorI18nKeys.PreviewButton` (`appsEditor.previewButton`), `AppsEditorI18nKeys.ExitPreviewButton` (`appsEditor.exitPreviewButton`), `AppsEditorI18nKeys.PreviewChatPlaceholder` (`appsEditor.previewChat.placeholder`), `AppsEditorI18nKeys.PreviewChatAriaLabel` (`appsEditor.previewChat.ariaLabel`).

#### Scenario: Preview button has an accessible name
- **WHEN** a screen reader focuses the preview/exit-preview button
- **THEN** it announces the localized "Preview" or "Exit preview" text, not just an icon

#### Scenario: RTL layout
- **WHEN** the active locale is `ar` (or another RTL locale) and `dir="rtl"` is set on `<html>`
- **THEN** the preview button, its icon, and the preview chat pane lay out mirrored via CSS logical properties; `IconEye`/`IconEyeOff` are symmetric icons and are NOT flipped with `rtl:scale-x-[-1]`

### Requirement: No feature flag gating
The preview capability SHALL be available to any user who can already reach the Apps editor Settings step for an application they can edit; it introduces no new `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` gate.

#### Scenario: Available to all Apps-editor users
- **WHEN** any user who can already open `/apps-editor` for an app reaches the Settings step with a saved app id
- **THEN** the preview button is shown, with no additional role or feature-flag check beyond existing Apps-editor access
