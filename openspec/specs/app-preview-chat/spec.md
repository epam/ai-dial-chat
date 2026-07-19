# app-preview-chat Specification

## Purpose
TBD - created by archiving change add-app-editor-preview. Update Purpose after archive.
## Requirements
### Requirement: EditorHeader preview button
`EditorHeader` SHALL accept an optional `onPreview?: () => void` prop and an optional `isPreviewing?: boolean` prop. When `onPreview` is provided, a button with a leading icon SHALL render in the right-hand action group, alongside Cancel and Save (not on the left with the title/steps nav). When `onPreview` is not provided, no preview button SHALL render. This requirement applies to `EditorHeader` generically; `ToolsetEditor` is unaffected because it does not render `EditorHeader`.

#### Scenario: Preview button hidden when no callback supplied
- **WHEN** `EditorHeader` is rendered without an `onPreview` prop
- **THEN** no preview/exit-preview button is present in the DOM

#### Scenario: Preview button shown when callback supplied
- **WHEN** `EditorHeader` is rendered with `onPreview` set and `isPreviewing` is `false` or omitted
- **THEN** a button labelled with the `AppsEditorI18nKeys.PreviewButton` translation and an `IconEye` leading icon renders in the right-hand action group, next to Cancel/Save
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
Clicking "Exit preview" SHALL switch the visible pane back to `AppEditorIframe` without re-saving and without remounting/reloading the iframe (its `src`, load state, and internal state are preserved from before Preview was entered). It SHALL NOT delete or otherwise affect the preview conversation, since it may be re-entered later in the same session.

#### Scenario: Exit preview
- **WHEN** the user clicks "Exit preview"
- **THEN** the settings iframe becomes visible again showing the same state it had when Preview was clicked
- **AND** no `TriggerSave`, `getConversation`, or navigation call occurs as a side effect
- **AND** the preview conversation (if one was created) is not deleted

### Requirement: Preview chat uses a fixed model that is disabled, not hidden
The preview pane SHALL render the existing `ConversationView` component configured with a `fixedModel` equal to the application's deployment id (the same `appId` used by `AppEditorIframe`), its display name, and its icon. The model selector SHALL remain visible, showing the fixed model's name/icon, but SHALL render in a disabled state that does not open a picker — it SHALL NOT be removed from the composer.

#### Scenario: Model chip is visible but disabled
- **WHEN** the preview chat pane is shown
- **THEN** the composer shows a model chip displaying the previewed application's name/icon
- **AND** clicking the chip does not open a model picker or change the selection
- **AND** every message sent from the preview pane targets the application being edited, regardless of any other deployment configured elsewhere in the app

### Requirement: Preview chat is a real, session-scoped conversation
The preview pane SHALL use the same conversation-creation, streaming, and interaction infrastructure as a normal chat (`apiCreateConversation`, `useConversationStream`, `useConversationHandlers`), so the full feature set of a normal chat (attachments, audio transcription, chat settings, edit/regenerate/rate) is available in preview with no reduced functionality. The conversation is created lazily on the first message sent in preview — before that, the preview pane SHALL show a composer-only welcome state equivalent to a normal new chat. Toggling between the iframe and the preview pane within the same Apps editor mount SHALL preserve the same conversation and its accumulated messages.

#### Scenario: Preview conversation is created on first send
- **WHEN** the user sends the first message in the preview pane
- **THEN** a real conversation is created via the same API a normal new chat uses, with its model set to the application being edited
- **AND** the message streams a response using the same streaming machinery as a normal chat

#### Scenario: History survives toggling within a session
- **WHEN** the user sends messages in preview, exits preview, and re-enters preview later in the same editor session
- **THEN** the previously sent and received messages are still shown, and new messages are appended to the same conversation

#### Scenario: Full feature parity with a normal chat
- **WHEN** the user attaches a file, uses audio transcription, or opens chat settings in the preview pane
- **THEN** the feature behaves exactly as it does in a normal chat, since the same underlying hooks and endpoints are used

### Requirement: Preview chat renders Quick Apps conversation starters
When a Settings-step save succeeds for a preview request, `AppsEditor` SHALL await `refetchDeployments()` before switching to preview mode. `refetchDeployments()` owns bypassing the deployments cache; if the refetch fails, preview entry SHALL NOT be blocked, but the preview pane may use the best-known deployment list already in context.

`AppPreviewChat` SHALL resolve the application deployment from `useDeployments().items` and render Quick Apps `conversationStarters` through the same `getQuickAppConversationStarters` utility used by the main new-conversation screen.

The preview composer SHALL:
- Render `conversationStarters.introText` above the starter buttons and the input when present.
- Render `StarterButtons` above the input when valid starters are present.
- Disable free-form input when `conversationStarters.chatMessageInputDisabled === true`.
- Treat `autoSubmit` as `true` unless the API value is explicitly `false`.

Selecting a starter with submit enabled SHALL create or append to the preview conversation through the same preview conversation creation/streaming path used for manually typed messages, targeting the fixed app deployment. Selecting a starter with submit disabled SHALL populate the preview input with the starter text and SHALL NOT create a conversation.

**i18n impact:** None; starter labels and intro text are user-configured application data, and the preview placeholder already has an i18n key.

**RTL / UI impact:** Starter layout is delegated to `StarterButtons`; intro text is plain centered text and inherits page direction.

**Memoisation:** Quick Apps starter settings SHALL be memoized from the resolved app deployment's `conversationStarters`; starter selection handlers SHALL be wrapped in `useCallback`.

**Accessibility:** Starter controls SHALL remain real buttons via `StarterButtons`; intro text is static descriptive copy and does not need a live region.

#### Scenario: Preview shows saved Quick Apps starters without page reload
- **WHEN** the user changes conversation starters in the Settings iframe, clicks Preview, and the iframe posts `AppsEditorEvent.SaveSuccess`
- **THEN** `AppsEditor` awaits `refetchDeployments()` before entering preview mode
- **AND** the preview chat shows the saved starter buttons and intro text without a full browser reload

#### Scenario: Preview non-submit starter populates input
- **WHEN** the user selects a preview starter whose normalized `submit` flag is false
- **THEN** the preview input is populated with the starter text and no preview conversation is created

#### Scenario: Preview submit starter creates conversation
- **WHEN** the user selects a preview starter whose normalized `submit` flag is true
- **THEN** the preview conversation is created or appended using the starter text and the fixed application deployment id

### Requirement: Preview conversation is deleted when the editor is left
The preview conversation, if one was created during the session, SHALL be deleted when the Apps editor Settings step (and therefore the component owning the preview conversation) unmounts — including when the user clicks Cancel, when a normal Save succeeds and navigates away, or when the user otherwise navigates away from `/apps-editor`. Deletion failures SHALL be logged and SHALL NOT block or surface an error during navigation.

#### Scenario: Cleanup on Cancel
- **WHEN** the user has sent at least one preview message (creating a conversation) and then clicks Cancel
- **THEN** the preview conversation is deleted as the editor navigates away

#### Scenario: Cleanup on normal Save-and-exit
- **WHEN** the user has sent at least one preview message and then performs a normal Save that succeeds and navigates to `returnUrl`
- **THEN** the preview conversation is deleted as part of leaving the editor

#### Scenario: No cleanup needed when preview was never used
- **WHEN** the user never clicks Preview, or clicks Preview but never sends a message
- **THEN** no conversation was created and no deletion call is made

#### Scenario: Deletion failure does not block navigation
- **WHEN** the delete-conversation call fails while the editor is being left
- **THEN** navigation proceeds normally and the failure is only logged, not surfaced to the user

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
