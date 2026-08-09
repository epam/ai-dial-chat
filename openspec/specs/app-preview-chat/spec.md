# app-preview-chat Specification

## Purpose
TBD - created by archiving change add-app-editor-preview. Update Purpose after archive.
## Requirements
### Requirement: EditorHeader preview button
`EditorHeader` SHALL accept an optional `onPreview?: () => void` prop and an optional `isPreviewing?: boolean` prop. When `onPreview` is provided, a button with a leading icon SHALL render in the right-hand action group, alongside Cancel and Save (not on the left with the title/steps nav). When `onPreview` is not provided, no preview button SHALL render. This requirement applies to `EditorHeader` generically; `ToolsetEditor` is unaffected because it does not render `EditorHeader`.

While `isPreviewing` is `true`, the Cancel and Save buttons SHALL NOT render at all (not merely disabled) — in preview mode they serve no purpose, since exiting preview is the only relevant action, and previously left the header showing two non-functional disabled buttons. Only the "Exit preview" button SHALL be shown in the right-hand action group.

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

#### Scenario: Cancel and Save are hidden while previewing
- **WHEN** `EditorHeader` is rendered with `isPreviewing` set to `true`
- **THEN** neither the Cancel button nor the Save button is present in the DOM
- **AND** only the "Exit preview" button is shown in the right-hand action group

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
- **AND** shows the existing `saveError` `Notification` with the error message
- **AND** the preview button still reads "Preview" (not "Exit preview")

#### Scenario: Normal Save button unaffected
- **WHEN** the user clicks the existing Save button (not Preview) and the iframe posts `AppsEditorEvent.SaveSuccess`
- **THEN** `AppsEditor` navigates to `returnUrl`, exactly as before this change

#### Scenario: Stray postMessage while hidden iframe is not previewing-active
- **WHEN** the Apps editor is in preview mode (`isPreviewing === true`) and the still-mounted, hidden `AppEditorIframe` posts any `AppsEditorEvent.SaveSuccess` or `AppsEditorEvent.SaveError` message
- **THEN** `AppsEditor` ignores it (no navigation, no error notification, no state change) because no save was requested while previewing

### Requirement: Saving overlay while a save (or preview-save) is in flight
`AppsEditor` SHALL render a blocking overlay over its main content area (General form / Settings step, whichever is visible) whenever `isSaving` is `true` — covering both the normal Save action and the Preview action's underlying save sequence, since both leave the UI otherwise unchanged until the embedded editor's `SaveSuccess`/`SaveError` postMessage arrives. `isSaving` SHALL clear as soon as that postMessage arrives; it SHALL NOT remain `true` waiting on the follow-up `refetchDeployments()` call (see "Preview chat renders Quick Apps conversation starters" below for why that call is not awaited). The content wrapper `AppsEditor` renders the General form / Settings step inside MUST carry an explicit fill class (`size-full`), since `SettingsStep`'s root uses `size-full` and needs an ancestor chain of defined heights — an unstyled wrapper collapses the iframe to its browser-default height instead of filling the available space.

The overlay backdrop SHALL use the semi-transparent `bg-blackout` background (not an opaque `bg-layer-*` color) so the iframe/form content stays dimly visible underneath, matching the processing-overlay pattern already used in `DialFileManagerShell`. The spinner and label SHALL be rendered inside a small opaque card (`bg-layer-sunken`, rounded, `shadow-lg`) centered within the backdrop, so the "Saving in progress…" text keeps sufficient contrast regardless of what layer/theme is showing through the translucent backdrop. The overlay SHALL show a `Spinner` and the i18n label `AppsEditorI18nKeys.SavingOverlayLabel` (`appsEditor.savingOverlay`, "Saving in progress…"), announced via `aria-label` + `aria-live="polite"` on the outer backdrop container. The content underneath SHALL be made `inert` while the overlay is shown, so it is excluded from the tab order and the accessibility tree instead of merely being visually covered.

#### Scenario: Overlay shown while the preview save is in flight
- **WHEN** the user clicks Preview and the settings iframe's `SaveSuccess`/`SaveError` postMessage has not yet arrived
- **THEN** a translucent `bg-blackout` backdrop covers the Settings step content, with an opaque `Spinner` + "Saving in progress…" card centered on top
- **AND** the underlying General form / Settings step content is `inert` (not focusable, not in the accessibility tree)
- **AND** the settings iframe continues to fill its full height underneath the backdrop (no layout collapse)

#### Scenario: Overlay hidden as soon as SaveSuccess arrives, without waiting for the deployments refetch
- **WHEN** the settings iframe posts `AppsEditorEvent.SaveSuccess` for a preview request
- **THEN** `AppsEditor` switches to the preview chat pane and hides the overlay immediately
- **AND** this happens whether or not the background `refetchDeployments()` call has resolved yet

#### Scenario: Overlay also shown for the normal Save action
- **WHEN** the user clicks the normal Save button (General or Settings step) and the resulting save has not yet completed
- **THEN** the same overlay is shown, since `isSaving` is `true` for that action too

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
When a Settings-step save succeeds (for a preview request or a normal Save), `AppsEditor` SHALL trigger `refetchDeployments()` as a fire-and-forget background call and SHALL NOT await it — switching to preview mode (or navigating to `returnUrl` for a normal Save) happens immediately once `SaveSuccess` arrives, using whatever deployment list is already in context. `refetchDeployments()` owns bypassing the deployments cache; a failed refetch SHALL be swallowed (logged at most) and SHALL NOT surface an error or block/retry preview entry or navigation. Because `DeploymentsContext` is a shared, reactive data source, once the background refetch resolves, any component reading it (including `AppPreviewChat`, described below) re-renders with the updated list on its own — `AppsEditor` does not need to re-trigger or coordinate that update.

`AppPreviewChat` SHALL resolve the application deployment by matching `useDeployments().items[].id` against the raw `appId` prop (the same raw, human-readable id used by the settings iframe's postMessage protocol), since `items[].id` is always the raw id. It SHALL render Quick Apps `conversationStarters` through the same `getQuickAppConversationStarters` utility used by the main new-conversation screen.

`AppPreviewChat` SHALL use the raw `appId` as-is for every deployment-identifying value it produces or forwards — `fixedModel.id`, `apiCreateConversation`'s `deploymentId` argument, `startStream`'s `model` argument, `useAudioTranscription`'s `selectedDeploymentId`, and `useConversationHandlers`' `fixedModelId`. It SHALL NOT percent-encode `appId` (e.g. via `encodeDeploymentId`) for any of these, because each of them is consumed as a JSON body field (`createConversation`, `streamCompletion`, `transcribeAudio`), never as a raw URL path segment. Percent-encoding it would embed literal `%` characters into the value; since the backend builds the created conversation's stored resource path directly from this value and the frontend's own URL-building code later percent-encodes that whole stored path once when fetching/saving/watching the conversation, a pre-encoded input becomes double-encoded on the wire and DIAL Core rejects the request with 400.

#### Scenario: Preview resolves the deployment for an app id containing reserved characters

- **WHEN** `appId` is `"applications/bucket/My App"` (contains a space) and `useDeployments().items` contains an entry with `id: "applications/bucket/My App"`
- **THEN** `AppPreviewChat` resolves that entry as the application deployment and renders its `conversationStarters`

#### Scenario: Conversation creation from preview uses the raw app id

- **WHEN** the user selects a submit-enabled starter (or sends a manually typed first message) in the preview pane for `appId: "applications/bucket/My App"`
- **THEN** `apiCreateConversation` is called with `deploymentId: "applications/bucket/My App"` (raw, unencoded) — not `"applications/bucket/My%20App"`
- **AND** the subsequent `GET /api/v1/conversations?path=...` request for that conversation succeeds (no double-encoded segment, no 400 from DIAL Core)

The preview composer SHALL:
- Render `conversationStarters.introText` below the input and above the starter buttons when present.
- Render `StarterButtons` below the input when valid starters are present.
- Disable free-form input when `conversationStarters.chatMessageInputDisabled === true`.
- Treat `autoSubmit` as `true` unless the API value is explicitly `false`.

Selecting a starter with submit enabled SHALL create or append to the preview conversation through the same preview conversation creation/streaming path used for manually typed messages, targeting the fixed app deployment. Selecting a starter with submit disabled SHALL populate the preview input with the starter text and SHALL NOT create a conversation.

**i18n impact:** None; starter labels and intro text are user-configured application data, and the preview placeholder already has an i18n key.

**RTL / UI impact:** Starter layout is delegated to `StarterButtons`; intro text is plain centered text and inherits page direction.

**Memoisation:** Quick Apps starter settings SHALL be memoized from the resolved app deployment's `conversationStarters`; starter selection handlers SHALL be wrapped in `useCallback`.

**Accessibility:** Starter controls SHALL remain real buttons via `StarterButtons`; intro text is static descriptive copy and does not need a live region.

#### Scenario: Preview shows saved Quick Apps starters without page reload
- **WHEN** the user changes conversation starters in the Settings iframe, clicks Preview, and the iframe posts `AppsEditorEvent.SaveSuccess`
- **THEN** `AppsEditor` enters preview mode immediately, without waiting for `refetchDeployments()` to resolve
- **AND** once the background refetch resolves, the preview chat shows the saved starter buttons and intro text below the input without a full browser reload — until then it may still show the previous starters/intro

#### Scenario: Preview entry is not delayed by a slow or failed deployments refetch
- **WHEN** the user clicks Preview and the iframe posts `AppsEditorEvent.SaveSuccess`, and `refetchDeployments()` is slow to resolve or rejects
- **THEN** `AppsEditor` still switches to the preview chat pane immediately and hides the saving overlay
- **AND** no error is shown to the user for the failed/slow refetch

#### Scenario: Preview non-submit starter populates input
- **WHEN** the user selects a preview starter whose normalized `submit` flag is false
- **THEN** the preview input is populated with the starter text and no preview conversation is created

#### Scenario: Preview submit starter creates conversation
- **WHEN** the user selects a preview starter whose normalized `submit` flag is true
- **THEN** the preview conversation is created or appended using the starter text and the fixed application deployment id

### Requirement: Preview session resets when the saved configuration actually changed

A Settings-step save (triggered either by "Save & Exit" or by "Preview") completes with a
`SaveSuccess` postMessage from the embedded Quick Apps editor. That message MAY carry a
`hasChanges: boolean` field — see the `quick-app-authoring` spec's "SaveSuccess reports
whether persisted data changed" requirement for what the embedded editor SHALL compute and
send. `AppsEditor` SHALL treat `hasChanges` as `false` when the field is absent (an embedded
editor build that predates this contract), preserving prior behavior until the embedded
editor is updated.

Whenever a `SaveSuccess` arrives with `hasChanges === true`, `AppsEditor` SHALL discard the
current preview session before the next time the preview pane is shown: any preview
conversation already created SHALL be deleted (the same best-effort, non-blocking deletion
used when leaving the editor), and the in-memory preview state (conversation, messages, and
any populated-but-unsent composer input) SHALL be reset so the preview pane renders its
initial composer-only welcome state, reflecting the just-saved configuration, the next time
it becomes visible. This reset happens at save time regardless of whether the preview pane is
currently visible, since a Settings-step edit can only be made while the iframe (not the
preview pane) is showing.

When `hasChanges` is `false` (or absent), the existing preview conversation and its
accumulated messages SHALL be left exactly as they are — this is the same "history survives
toggling" behavior already required above, now scoped explicitly to saves that made no
persisted change.

#### Scenario: Preview starts fresh after a real configuration change
- **WHEN** the user has an existing preview conversation, exits preview, changes a Settings
  step or General step field, and the resulting save's `SaveSuccess` reports
  `hasChanges: true`
- **THEN** the previous preview conversation is deleted
- **AND** the next time the preview pane is shown it renders the composer-only welcome state
  (empty history, empty input) reflecting the latest configuration, not the prior
  conversation

#### Scenario: Preview retains history when nothing meaningful changed
- **WHEN** the user has an existing preview conversation, exits preview, and saves again
  (e.g. via Save & Exit staying on the page, or clicking Preview without editing anything)
  with `SaveSuccess` reporting `hasChanges: false`
- **THEN** the preview conversation and its messages are unchanged, matching the existing
  "History survives toggling" scenario

#### Scenario: Missing `hasChanges` field preserves prior behavior
- **WHEN** the embedded Quick Apps editor posts `SaveSuccess` without a `hasChanges` field
- **THEN** `AppsEditor` treats it as `false` and does not reset the preview session

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

New keys: `AppsEditorI18nKeys.PreviewButton` (`appsEditor.previewButton`), `AppsEditorI18nKeys.ExitPreviewButton` (`appsEditor.exitPreviewButton`), `AppsEditorI18nKeys.PreviewChatPlaceholder` (`appsEditor.previewChat.placeholder`), `AppsEditorI18nKeys.PreviewChatAriaLabel` (`appsEditor.previewChat.ariaLabel`), `AppsEditorI18nKeys.SavingOverlayLabel` (`appsEditor.savingOverlay`).

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
