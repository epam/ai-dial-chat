# app-preview-chat Specification

## Purpose

The Quick App editor's in-place preview: a header toggle in `ApplicationFormEditor` that saves the embedded schema editor first, then swaps the Setup column's settings iframe for a real, session-scoped chat against the application being edited.
## Requirements
### Requirement: EditorHeader preview button
`ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) SHALL render the preview toggle as a 2.0 `GhostButton` passed to `EntityEditor` (`@epam/ai-dial-builder-form`) through its `extraActions` prop, which `EntityEditor` places before its standard Cancel (`NeutralButton`) and submit (`PrimaryButton`) actions in the header action group. The toggle SHALL render only when the editor is in edit mode (a non-empty app id query param) and the editor definition's `messageKeys` supply both `preview` and `exitPreview` keys; today only `quickAppDefinition` does (`BasicI18nKeys.Preview` / `AppsEditorI18nKeys.ExitPreviewButton`). When those conditions are not met, no preview button SHALL render. The toggle SHALL expose `aria-pressed={isPreviewing}`.

While `isPreviewing` is `true`, `ApplicationFormEditor` SHALL pass `hideStandardActions` to `EntityEditor`, so Cancel and the submit button are not rendered at all (not merely disabled); only the exit-preview toggle remains in the action group.

On mobile, `EditorLayout` moves every action (the preview toggle, Cancel and the submit button) out of the header into a bottom action bar pinned below the scrollable body; there is no kebab menu.

#### Scenario: Preview button hidden when the definition has no preview keys or the app is not yet created
- **WHEN** `ApplicationFormEditor` renders in create mode, or for a definition whose `messageKeys` lack `preview`/`exitPreview`
- **THEN** no preview/exit-preview button is present in the DOM

#### Scenario: Preview button shown in edit mode
- **WHEN** `ApplicationFormEditor` renders the Quick App definition in edit mode and `isPreviewing` is `false`
- **THEN** a `GhostButton` labelled with the `basic.preview` translation and a leading `IconEye` renders before Cancel/Save, with `aria-pressed="false"`
- **AND** clicking it starts the save-then-preview flow

#### Scenario: Button toggles to Exit preview
- **WHEN** preview mode is active
- **THEN** the same button shows `appsEditor.exitPreviewButton` with a leading `IconEyeOff` and `aria-pressed="true"`
- **AND** clicking it sets `isPreviewing` back to `false` (`ApplicationFormEditor` owns the on/off state)

#### Scenario: Cancel and Save are hidden while previewing
- **WHEN** preview mode is active
- **THEN** neither the Cancel button nor the Save button is present in the DOM
- **AND** only the "Exit preview" button is shown in the action group

### Requirement: Preview availability scoped to the Apps editor Settings step
The preview toggle SHALL be available only in edit mode of the Quick App editor (`/apps-editor` with an `appId` query param), where the Setup column renders `QuickAppSetup` with the schema's embedded editor. While not previewing, the toggle SHALL be rendered but disabled until the Setup reports readiness through `onReadyChange` — `QuickAppSetup` reports ready only when the app id is present, the schema (from the `schema` query param) has an `editorUrl`, and the embedded editor has signalled readiness. This is the same gate that disables Save (`isSubmitDisabled = isEditMode && !isSetupReady`). A visible-but-disabled control tells the user preview exists and is not yet available.

#### Scenario: No preview before the app exists
- **WHEN** the Quick App editor is in create mode (no `appId` yet)
- **THEN** no preview button is rendered

#### Scenario: Preview available once the embedded editor is ready
- **WHEN** the editor is in edit mode, the schema has `editorUrl`, and the embedded editor has reported readiness
- **THEN** the preview button is enabled

#### Scenario: Preview button is disabled before the embedded editor is ready
- **WHEN** the editor is in edit mode but the embedded editor has not yet reported readiness
- **THEN** the preview button is rendered in a disabled state rather than omitted

### Requirement: Save-then-preview orchestration
Clicking the preview button SHALL call the Setup handle's `startPreview(metadata.values)` (`QuickAppSetup`'s imperative handle). `startPreview` SHALL trigger the embedded editor's save (`AppEditorIframe.triggerSave()` posts `AppsEditorEvent.TriggerSave` to the iframe) and wait for the resulting `SaveSuccess`/`SaveError` postMessage, then run a follow-up `updateApplication` with the current metadata (`reassertSkillsSupport`, so the backend force-sets `features.skills_supported`) before the save counts as successful. `ApplicationFormEditor` SHALL set `isPreviewing` to `true` only after `startPreview` resolves. A save that receives neither message within `SETUP_SAVE_TIMEOUT_MS` (20 s) SHALL be treated as failed with `appsEditor.error.saveTimeout`.

#### Scenario: Preview save succeeds
- **WHEN** the user clicks Preview, the iframe posts `AppsEditorEvent.SaveSuccess`, and the follow-up `updateApplication` succeeds
- **THEN** the editor does NOT navigate away (unlike a normal Save)
- **AND** the Setup column switches from the iframe to the preview chat pane
- **AND** the preview button now reads "Exit preview"

#### Scenario: Preview save fails
- **WHEN** the user clicks Preview and the iframe posts `AppsEditorEvent.SaveError` (or the follow-up update fails, or the save times out)
- **THEN** the editor stays on the iframe (does not enter preview)
- **AND** `QuickAppSetup` shows the error inline as an `ErrorMessageNotification` above the iframe
- **AND** the preview button still reads "Preview"

#### Scenario: Normal Save button unaffected
- **WHEN** the user clicks Save (not Preview) and the save succeeds
- **THEN** `ApplicationFormEditor` awaits `refetchDeployments()`, shows the "edited" success notification and navigates to `ROUTES.Catalog`

#### Scenario: Stray postMessage while no save is pending
- **WHEN** the hidden, still-mounted `AppEditorIframe` posts `AppsEditorEvent.SaveSuccess` or `AppsEditorEvent.SaveError` while no save is pending
- **THEN** `QuickAppSetup` ignores it (no navigation, no error, no state change), because its handlers act only on a pending save

### Requirement: Saving overlay while a save (or preview-save) is in flight
`ApplicationFormEditor` SHALL set `isSaving` for both a normal Save and the preview toggle's `startPreview`, and SHALL render a blocking overlay whenever it is busy — `isSaving`, or while the edited application or its setup is still loading. While busy, the whole `EntityEditor` (header included) SHALL be made `inert`. For a preview save whose `SaveSuccess` reports `hasChanges: false`, `startPreview` SHALL resolve without awaiting the follow-up `refetchDeployments()`, which remains fire-and-forget. For `hasChanges: true`, `startPreview` SHALL await `refetchDeployments()` before resolving, so the overlay stays up and the preview pane is never revealed with a deployment list that predates the save; a rejected refetch is logged and still lets preview start. For a normal Save, `ApplicationFormEditor` SHALL await `refetchDeployments()` before navigating, regardless of `hasChanges`.

The overlay SHALL be an `absolute inset-0` `bg-backdrop` layer marked `aria-hidden="true"`, with a `Spinner` and the label inside a centered opaque card (`bg-layer-sunken`, rounded, `shadow-lg`). The label is the definition's `savingOverlay` key while saving (`AppsEditorI18nKeys.SavingOverlayLabel`, `appsEditor.savingOverlay`, "Saving in progress…") and its `loadingOverlay` key while loading (`appsEditor.settingsStep.loadingLabel`). The label SHALL be announced through a separate, always-mounted `sr-only` `<span role="status" aria-live="polite">` that holds the text only while busy.

#### Scenario: Overlay shown while the preview save is in flight
- **WHEN** the user clicks Preview and `startPreview` has not yet resolved
- **THEN** a translucent `bg-backdrop` backdrop covers the editor, with an opaque `Spinner` + "Saving in progress…" card centered on top
- **AND** the `EntityEditor` underneath is `inert`
- **AND** the status region announces "Saving in progress…"

#### Scenario: Overlay hidden as soon as SaveSuccess arrives when nothing changed
- **WHEN** the iframe posts `AppsEditorEvent.SaveSuccess` for a preview request that reports `hasChanges: false`
- **THEN** once the follow-up `updateApplication` settles the editor switches to the preview pane and hides the overlay
- **AND** this happens whether or not the background `refetchDeployments()` call has resolved yet

#### Scenario: Overlay stays up until the refetch settles when settings changed
- **WHEN** the iframe posts `AppsEditorEvent.SaveSuccess` for a preview request that reports `hasChanges: true`
- **THEN** `startPreview` awaits `refetchDeployments()` before the editor switches to the preview pane and hides the overlay
- **AND** a rejected refetch is logged and still lets the editor switch to the preview pane afterward

#### Scenario: Overlay also shown for the normal Save action
- **WHEN** the user clicks Save and the save has not yet completed
- **THEN** the same overlay is shown, since `isSaving` is `true` for that action too
- **AND** it stays up across the awaited deployments refetch, until the editor navigates away

### Requirement: Exit preview returns to the settings iframe without reload
Clicking "Exit preview" SHALL switch the visible pane back to `AppEditorIframe` without re-saving and without remounting/reloading the iframe. `QuickAppSetup` keeps both panes mounted in absolutely positioned containers and hides the inactive one with `hidden`, so the iframe's `src`, load state and internal state are preserved. Exiting SHALL NOT delete or otherwise affect the preview conversation, since it may be re-entered later in the same session.

#### Scenario: Exit preview
- **WHEN** the user clicks "Exit preview"
- **THEN** the settings iframe becomes visible again showing the same state it had when Preview was clicked
- **AND** no `TriggerSave`, `getConversation`, or navigation call occurs as a side effect
- **AND** the preview conversation (if one was created) is not deleted

### Requirement: Preview chat uses a fixed model that is disabled, not hidden
The preview pane (`AppPreviewChat`) SHALL target a fixed model equal to the application's deployment id (the same `appId` used by `AppEditorIframe`), its display name (`metadata.name`, falling back to the schema's `displayName`), and its icon (`metadata.iconUrl`, falling back to the schema's `iconUrl`). Before the conversation exists it renders `NewConversationComposer` with `deployments={[fixedModel]}` and `isModelSelectorDisabled`; afterwards it renders `ConversationView` with `fixedModel`. The model selector SHALL remain visible, showing the fixed model's name/icon, but SHALL be disabled and SHALL NOT open a picker.

#### Scenario: Model chip is visible but disabled
- **WHEN** the preview chat pane is shown
- **THEN** the composer shows a model chip displaying the previewed application's name/icon
- **AND** clicking the chip does not open a model picker or change the selection
- **AND** every message sent from the preview pane targets the application being edited, regardless of any other deployment configured elsewhere in the app

### Requirement: Preview chat is a real, session-scoped conversation
The preview pane SHALL use the same conversation-creation, streaming, and interaction infrastructure as a normal chat (`apiCreateConversation`, `useConversationStream`, `useConversationHandlers`), so the full feature set of a normal chat (attachments, audio transcription, chat settings, edit/regenerate/rate) is available in preview with no reduced functionality. The conversation is created lazily on the first message sent in preview — before that, the preview pane SHALL show a composer-only welcome state equivalent to a normal new chat. Toggling between the iframe and the preview pane within the same editor mount SHALL preserve the same conversation and its accumulated messages.

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
When a **preview** save succeeds reporting `hasChanges: false`, `QuickAppSetup.startPreview` SHALL trigger `refetchDeployments()` as a fire-and-forget background call and SHALL NOT await it — preview starts using whatever deployment list is already in context, since nothing about it can be stale. When a **preview** save succeeds reporting `hasChanges: true`, `startPreview` SHALL instead await `refetchDeployments()`, so the remounted preview pane's very first render already reads a deployment list that reflects the just-saved change. When a normal **Save** succeeds, `ApplicationFormEditor` SHALL await the same call before navigating to `ROUTES.Catalog`. `refetchDeployments()` owns bypassing the deployments cache; a refetch that rejects during preview entry SHALL be swallowed (logged at most) and SHALL NOT surface an error or block preview entry.

An intermediate `UpdatedSuccess` message from the embedded editor SHALL also refresh the deployment list via `refetchDeployments(false)` — with the cache-bypass disabled, since a definitive save always follows and corrects anything briefly stale. Because `DeploymentsContext` is a shared, reactive data source, once the background refetch resolves, any component reading it (including `AppPreviewChat`, described below) re-renders with the updated list on its own.

`AppPreviewChat` SHALL resolve the application deployment from `useDeployments().items` against the raw `appId` prop (the same raw, human-readable id used by the settings iframe's postMessage protocol) through the shared `findDeploymentByIdOrReference` helper, since `items[].id` is always the raw id. It SHALL render Quick Apps `conversationStarters` through the same `getQuickAppConversationStarters` utility used by the main new-conversation screen.

`AppPreviewChat` SHALL use the raw `appId` as-is for `fixedModel.id`, the deployment lookup, `startStream`'s `model` argument, `useAudioTranscription`'s `selectedDeploymentId`, the composer's `selectedDeploymentId`, and the `resolveModelId` callback it passes to `useConversationHandlers`.

The one exception is `apiCreateConversation`'s `deploymentId` argument: `AppPreviewChat` SHALL pass `normalizeDeploymentId(appId)` there, which decodes and then `encodeURIComponent`-encodes each `/`-separated segment, so a raw (`My App`) or an already-encoded (`My%20App`) segment both produce `My%20App`. `CreateConversationDto.deploymentId` is validated against `DEPLOYMENT_ID_PATTERN` (`apps/chat-api/src/common/validators/deployment-id.pattern.ts`), which rejects whitespace and accepts only valid `%XX` escapes, so a raw id with a space would fail creation with 400 (fix #8526).

#### Scenario: Preview resolves the deployment for an app id containing reserved characters

- **WHEN** `appId` is `"applications/bucket/My App"` (contains a space) and `useDeployments().items` contains an entry with `id: "applications/bucket/My App"`
- **THEN** `AppPreviewChat` resolves that entry as the application deployment and renders its `conversationStarters`

#### Scenario: Conversation creation from preview sends a percent-encoded deployment id

- **WHEN** the user selects a submit-enabled starter (or sends a manually typed first message) in the preview pane for `appId: "applications/bucket/My App"`
- **THEN** `apiCreateConversation` is called with `deploymentId: "applications/bucket/My%20App"`, which passes `DEPLOYMENT_ID_PATTERN`
- **AND** `startStream` receives the raw `"applications/bucket/My App"` as its model id

#### Scenario: An already-encoded app id is not double-encoded

- **WHEN** `appId` is `"applications/bucket/My%20App"`
- **THEN** `apiCreateConversation` is called with `deploymentId: "applications/bucket/My%20App"`, not `"applications/bucket/My%2520App"`

The preview composer SHALL:
- Render `conversationStarters.introText` below the input and above the starter buttons when present.
- Render `StarterButtons` below the input when valid starters are present.
- Disable free-form input when `conversationStarters.chatMessageInputDisabled === true`.
- Treat `autoSubmit` as `true` unless the API value is explicitly `false`.

Selecting a starter with submit enabled SHALL create or append to the preview conversation through the same preview conversation creation/streaming path used for manually typed messages, targeting the fixed app deployment. Selecting a starter with submit disabled SHALL populate the preview input with the starter text and SHALL NOT create a conversation.

**i18n impact:** None; starter labels and intro text are user-configured application data, and the preview placeholder already has an i18n key.

**RTL / UI impact:** Starter layout is delegated to `StarterButtons`; intro text is plain centered text and inherits page direction.

### Requirement: Preview shows a loading spinner until the fixed app resolves

`AppPreviewChat` never becomes the globally selected deployment in `DeploymentsContext`, so nothing there fetches per-entity details for it. `AppPreviewChat` SHALL therefore call `getDeploymentDetails(appId)` itself, directly, on mount and whenever `appId` changes — in parallel with (not sequenced after) `useDeployments().items` resolving the same app from the full deployments list. Its result SHALL be used only as an early source for `features.skillsSupported` (via `modelDetails.features` / `applicationDetails.features`), feeding the preview composer's `useSkillSelectorOverlay({ isSkillsSupported })`; a rejected or still-pending call SHALL NOT surface an error and SHALL leave that flag `false` until either it or the list resolves.

Before either the deployments list or this direct fetch has resolved the app, `AppPreviewChat` SHALL render a centered `Spinner` in place of the pre-conversation composer, so the composer never renders with an unresolved skills-support flag that would otherwise flip a moment later. The spinner SHALL clear as soon as *either* source resolves the app (the list's `findDeploymentByIdOrReference` match, or the direct fetch settling) — whichever comes first — even if the other is still in flight or ultimately fails.

#### Scenario: Spinner shown before either source has resolved the app
- **WHEN** `AppPreviewChat` mounts, `useDeployments().items` does not yet contain `appId`, and the direct `getDeploymentDetails(appId)` call has not yet settled
- **THEN** a centered `Spinner` (role `status`, inner `role="img"` labeled "Loading") renders instead of the composer
- **AND** no starter buttons, intro text, or skill-selector state are shown yet

#### Scenario: Spinner clears as soon as either source resolves
- **WHEN** the direct `getDeploymentDetails(appId)` call resolves (or, symmetrically, the deployments list resolves the app) while the other source is still pending
- **THEN** the spinner is replaced by the pre-conversation composer immediately, without waiting for the still-pending source
- **AND** the still-pending source, once it settles, only refines features/starters behind the scenes and does not reintroduce the spinner

#### Scenario: No spinner when the deployments list already resolves the app
- **WHEN** `useDeployments().items` already contains `appId` at mount (e.g. the list was already loaded before this `AppPreviewChat` instance mounted)
- **THEN** the composer renders immediately, regardless of whether the direct `getDeploymentDetails(appId)` call has settled

**Memoisation:** Quick Apps starter settings SHALL be memoized from the resolved app deployment's `conversationStarters`; starter selection handlers SHALL be wrapped in `useCallback`.

**Accessibility:** Starter controls SHALL remain real buttons via `StarterButtons`; intro text is static descriptive copy and does not need a live region.

#### Scenario: Preview shows saved Quick Apps starters without an intervening stale flash
- **WHEN** the user changes conversation starters in the settings iframe, clicks Preview, and the iframe posts `AppsEditorEvent.SaveSuccess` reporting `hasChanges: true`
- **THEN** `startPreview` awaits `refetchDeployments()` before preview mode is entered, so the preview pane (which remounts via `previewResetKey`) reads the full deployments list only after it already reflects the just-saved starters
- **AND** the preview chat shows the saved starter buttons and intro text below the input on its very first render, without a full browser reload and without first flashing the previous starters/intro

#### Scenario: Preview entry is not delayed when the save reported no real change
- **WHEN** the user clicks Preview without changing anything, the iframe posts `AppsEditorEvent.SaveSuccess` reporting `hasChanges: false`, and `refetchDeployments()` is slow to resolve or rejects
- **THEN** the editor still switches to the preview chat pane without waiting for the refetch and hides the saving overlay, since the already-cached deployments list is not stale
- **AND** no error is shown to the user for the failed/slow refetch

#### Scenario: Preview non-submit starter populates input
- **WHEN** the user selects a preview starter whose normalized `submit` flag is false
- **THEN** the preview input is populated with the starter text and no preview conversation is created

#### Scenario: Preview submit starter creates conversation
- **WHEN** the user selects a preview starter whose normalized `submit` flag is true
- **THEN** the preview conversation is created or appended using the starter text and the fixed application deployment id

### Requirement: Preview session resets when the saved configuration actually changed

`QuickAppSetup` SHALL discard the current preview session whenever a setup save reports that the persisted configuration actually changed.

A setup save (triggered either by Save or by Preview) completes with a `SaveSuccess` postMessage from the embedded Quick Apps editor. That message MAY carry a `hasChanges: boolean` field — see the `quick-app-authoring` spec's "SaveSuccess reports whether persisted data changed" requirement for what the embedded editor SHALL compute and send. `AppEditorIframe` SHALL normalize the field to a strict boolean (`event.data?.hasChanges === true`), so an absent or non-boolean field is treated as `false`.

Whenever a `SaveSuccess` arrives with `hasChanges === true` (and the follow-up `updateApplication` succeeds), `QuickAppSetup` SHALL discard the current preview session: any preview conversation already created SHALL be deleted (the same best-effort, non-blocking deletion used when leaving the editor), and the in-memory preview state (conversation, messages, and any populated-but-unsent composer input) SHALL be reset so the preview pane renders its initial composer-only welcome state, reflecting the just-saved configuration, the next time it becomes visible.

The reset SHALL be driven by remounting the preview pane — `QuickAppSetup` bumps a `previewResetKey` counter that it passes as `AppPreviewChat`'s `key` — so the pane's own unmount cleanup performs the deletion and every piece of its local state is discarded together, with no separate teardown path to keep in sync.

When `hasChanges` is `false` (or absent), the existing preview conversation and its accumulated messages SHALL be left exactly as they are.

#### Scenario: Preview starts fresh after a real configuration change
- **WHEN** the user has an existing preview conversation, exits preview, changes a setup field in the embedded editor, and the resulting save's `SaveSuccess` reports `hasChanges: true`
- **THEN** the previous preview conversation is deleted
- **AND** the next time the preview pane is shown it renders the composer-only welcome state (empty history, empty input) reflecting the latest configuration, not the prior conversation

#### Scenario: Preview retains history when nothing meaningful changed
- **WHEN** the user has an existing preview conversation, exits preview, and clicks Preview again without editing anything, with `SaveSuccess` reporting `hasChanges: false`
- **THEN** the preview conversation and its messages are unchanged, matching the "History survives toggling" scenario

#### Scenario: Missing `hasChanges` field preserves prior behavior
- **WHEN** the embedded Quick Apps editor posts `SaveSuccess` without a `hasChanges` field
- **THEN** it is treated as `false` and the preview session is not reset

### Requirement: Preview conversation is deleted when the editor is left
The preview conversation, if one was created during the session, SHALL be deleted when `AppPreviewChat` unmounts — including when the user clicks Cancel or Back, when a normal Save succeeds and navigates away, or when the user otherwise navigates away from `/apps-editor`. Deletion failures SHALL be swallowed and SHALL NOT block or surface an error during navigation.

#### Scenario: Cleanup on Cancel
- **WHEN** the user has sent at least one preview message (creating a conversation) and then clicks Cancel
- **THEN** the preview conversation is deleted as the editor navigates away

#### Scenario: Cleanup on normal Save-and-exit
- **WHEN** the user has sent at least one preview message and then performs a normal Save that succeeds and navigates to `ROUTES.Catalog`
- **THEN** the preview conversation is deleted as part of leaving the editor

#### Scenario: No cleanup needed when preview was never used
- **WHEN** the user never clicks Preview, or clicks Preview but never sends a message
- **THEN** no conversation was created and no deletion call is made

#### Scenario: Deletion failure does not block navigation
- **WHEN** the delete-conversation call fails while the editor is being left
- **THEN** navigation proceeds normally and the failure is not surfaced to the user

### Requirement: Cancel/Save return after exiting preview
While the preview pane is shown, `EntityEditor`'s Cancel and Save buttons are not rendered at all (`hideStandardActions`, see "EditorHeader preview button"). Exiting preview SHALL bring both back in their normal state, with Save still subject to the setup readiness gate.

#### Scenario: Buttons restored after exiting preview
- **WHEN** the user exits preview
- **THEN** the Cancel and Save buttons are rendered again, Save enabled only if the embedded editor is ready to save

### Requirement: Accessibility and i18n for the preview surface
The preview button SHALL expose an accessible name via i18n (not a bare icon with no label), with its icons marked `aria-hidden`, and the preview chat pane SHALL be a `role="region"` labelled `AppsEditorI18nKeys.PreviewChatAriaLabel`, using the same ARIA conventions as the main conversation view (`role="log"` + `aria-live="polite"` for the message list). All new user-visible strings SHALL be added to `translation-keys.ts` under `AppsEditorI18nKeys` and to every locale file in `apps/chat/src/i18n/locales/`, including `ar.json`.

Keys: `AppsEditorI18nKeys.ExitPreviewButton` (`appsEditor.exitPreviewButton`), `AppsEditorI18nKeys.PreviewChatPlaceholder` (`appsEditor.previewChat.placeholder`), `AppsEditorI18nKeys.PreviewChatAriaLabel` (`appsEditor.previewChat.ariaLabel`), `AppsEditorI18nKeys.SavingOverlayLabel` (`appsEditor.savingOverlay`). The "Preview" label itself reuses the shared `BasicI18nKeys.Preview` (`basic.preview`) rather than an editor-specific key.

#### Scenario: Preview button has an accessible name
- **WHEN** a screen reader focuses the preview/exit-preview button
- **THEN** it announces the localized "Preview" or "Exit preview" text and its pressed state, not just an icon

#### Scenario: RTL layout
- **WHEN** the active locale is `ar` (or another RTL locale) and `dir="rtl"` is set on `<html>`
- **THEN** the preview button, its icon, and the preview chat pane lay out mirrored via CSS logical properties; `IconEye`/`IconEyeOff` are symmetric icons and are NOT flipped with `rtl:scale-x-[-1]`

### Requirement: No feature flag gating
The preview capability SHALL be available to any user who can already open the Quick App editor in edit mode for an application they can edit; it introduces no feature flag (no `FeatureKey` entry) and no role check of its own.

#### Scenario: Available to all Apps-editor users
- **WHEN** any user who can already open `/apps-editor` for an existing app reaches it in edit mode
- **THEN** the preview button is shown, with no additional role or feature-flag check beyond existing Apps-editor access
