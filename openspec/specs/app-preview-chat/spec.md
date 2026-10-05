# app-preview-chat Specification

## Purpose

The Quick App editor's preview: a header Preview button in `ApplicationFormEditor` that saves the embedded schema editor first, then hides the whole editor (kept mounted) and shows a full-page `QuickAppPreview` — a Back to setup header, a Preview mode banner and a real, session-scoped chat against the application being edited, opened by a static greeting.

## Requirements
### Requirement: EditorHeader preview button
`ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) SHALL render the Preview button as a 2.0 `GhostButton` passed to `EntityEditor` (`@epam/ai-dial-builder-form`) through its `extraActions` prop, which `EntityEditor` places before its standard Cancel (`NeutralButton`) and submit (`PrimaryButton`) actions in the header action group. The button SHALL render only when the editor is in edit mode (a non-empty app id query param), the editor definition supplies a `Preview` component, its `messageKeys` supply a `preview` key, and its optional `isPreviewAvailable(ctx)` does not return `false`. Today only `quickAppDefinition` supplies a preview (`BasicI18nKeys.Preview`). Because every schema with an `editorUrl` opens through `quickAppDefinition`, its `isPreviewAvailable` SHALL return `true` only for the Quick Apps schema (`isQuickAppSchema` from `@epam/ai-dial-chat-hooks`, matched against the `schema` query param and the loaded schema list). An external application edited through its own embedded editor SHALL get no Preview button and no mounted preview page. When those conditions are not met, no Preview button SHALL render.

The button SHALL only enter preview. It is not a toggle: it SHALL always show the `basic.preview` label with a leading `IconEye` (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`), and it SHALL NOT expose `aria-pressed`. Because the whole `EntityEditor` is hidden while previewing (see "Preview is a full-page mode"), the button is never visible in preview mode. Leaving preview is done only through the preview page's "Back to setup" button. `ApplicationEditorMessageKeys.exitPreview` is removed.

On mobile, `EditorLayout` moves every action (the Preview button, Cancel and the submit button) out of the header into a bottom action bar pinned below the scrollable body; there is no kebab menu.

#### Scenario: Preview button hidden when the definition has no preview or the app is not yet created
- **WHEN** `ApplicationFormEditor` renders in create mode, or for a definition without a `Preview` component or a `preview` message key
- **THEN** no Preview button is present in the DOM

#### Scenario: Preview button hidden for an external application with an embedded editor
- **WHEN** `ApplicationFormEditor` renders in edit mode for a schema that has an `editorUrl` but is not the Quick Apps schema
- **THEN** the embedded editor, Cancel and Save render as usual
- **AND** no Preview button is present in the DOM and no preview page is mounted

#### Scenario: Preview button shown in edit mode
- **WHEN** `ApplicationFormEditor` renders the Quick App definition in edit mode and `isPreviewing` is `false`
- **THEN** a `GhostButton` labelled with the `basic.preview` translation and a leading `IconEye` renders before Cancel/Save, with no `aria-pressed` attribute
- **AND** clicking it starts the save-then-preview flow

#### Scenario: Header is hidden while previewing
- **WHEN** preview mode is active
- **THEN** neither the Preview button nor Cancel nor Save is visible or focusable
- **AND** the only exit control on the page is "Back to setup"

### Requirement: Preview is a full-page mode

While `isPreviewing` is `true`, `ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) SHALL hide the whole `EntityEditor` (header, Metadata column, Setup column) and SHALL show the editor definition's `Preview` component in its place, filling the page area that `EntityEditor` occupied.

- `EntityEditor` SHALL stay mounted while hidden. Its wrapper gets the `hidden` class and `inert`, so the settings iframe is neither unmounted nor reloaded and no hidden control can receive focus.
- When the definition supplies a `Preview` component and the editor is in edit mode, `ApplicationFormEditor` SHALL mount it as soon as the editor is in edit mode, not on the first preview. It stays mounted while previewing and while not previewing, so a preview session survives leaving and re-entering preview.
- Today only `quickAppDefinition` supplies `Preview` (`QuickAppPreview`, `apps/chat/src/pages/ApplicationEditor/setup/QuickAppPreview.tsx`).

`QuickAppPreview` SHALL render, top to bottom:

1. **Header row.** A 2.0 `GhostButton` labelled `appsEditor.previewChat.backToSetup` ("Back to setup") with a leading `IconArrowNarrowLeft` (`stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`, mirrored in RTL with `rtl:scale-x-[-1]`). Clicking it calls the `onExit` prop. This is the only way to leave preview.
2. **Banner.** A full-width strip with:
   - the label `appsEditor.previewChat.bannerLabel` ("Preview mode"), rendered with the `dial-tiny-lead-semi-text` scale class (which uppercases it) in the accent colour;
   - the text `appsEditor.previewChat.bannerText`, rendered through `Trans` so the interpolated `{{name}}` (the app display name: `metadata.name`, falling back to the schema's `displayName`) is bold.

   The banner SHALL use theme tokens for its background and border (no hardcoded hex values) and SHALL be static text (no live region).
3. **Chat area.** `AppPreviewChat`, filling the remaining height. Its content keeps the centred, max-width column `ConversationView` already uses.

The page SHALL include a heading for the preview surface: a visually hidden `<h1>` with the `bannerLabel` text, so the page keeps an `h1` while the editor's own `h1` is hidden.

**State ownership:** `ApplicationFormEditor` owns `isPreviewing` and `previewResetKey` (local `useState`). No new context is introduced.

**Memoisation:** `onExit` SHALL be a stable `useCallback`, and `QuickAppPreview` SHALL be exported as `memo(QuickAppPreview)`.

**RTL:** the header, banner and chat use logical properties only. The back arrow is mirrored; the banner has no directional icons.

**Mobile:** the same layout at all breakpoints. The header row and banner wrap their text, and the chat area scrolls on its own. `EditorLayout`'s mobile bottom action bar is hidden together with `EntityEditor`.

#### Scenario: Entering preview hides the editor and shows the preview page
- **WHEN** the user clicks Preview in edit mode and `startPreview` resolves
- **THEN** the editor's title, Metadata form, Setup section, Preview, Cancel and Save buttons are not visible
- **AND** a "Back to setup" button, a "Preview mode" banner naming the app, and the preview chat are visible

#### Scenario: Hidden editor is not focusable
- **WHEN** preview mode is active
- **THEN** pressing Tab never moves focus into the Metadata form, the settings iframe, or the editor header

#### Scenario: Banner names the edited app
- **WHEN** preview mode is active for an app whose Metadata name is "Design Review Agent"
- **THEN** the banner reads "You are previewing Design Review Agent. Send a message to test how it responds. Usage is following your limits.", with "Design Review Agent" in bold

#### Scenario: Back arrow mirrors in RTL
- **WHEN** the active locale is RTL and preview mode is active
- **THEN** the back arrow icon points toward the inline-start edge (mirrored), and the header and banner content are laid out right to left

### Requirement: Preview greeting bubble

`AppPreviewChat` SHALL render a static greeting as an `AssistantMessageBubble` (`@epam/ai-dial-conversation-messages`) with:

- the text `appsEditor.previewChat.greeting` ("Test your QuickApp here. Send a message or upload a document to see how it responds.");
- `deploymentIconUrl` set to the app's icon URL;
- `deploymentDisplayName` set to the app display name, so the bubble's avatar falls back to the name's initials when there is no icon.

The greeting SHALL NOT be a conversation message. It SHALL NOT be added to `conversation.messages`, sent to the model, persisted, or counted in message indexes. It SHALL render no action buttons (copy, regenerate, rate).

- Before the conversation exists, the greeting SHALL render above the pre-conversation composer. The app's `conversationStarters.introText` and `StarterButtons` keep rendering below the input as today.
- After the conversation exists, the greeting SHALL be passed to `ConversationView` through its `topContent` prop, so it stays the first item of the message list.
- After a preview session reset (a `previewResetKey` remount), the greeting renders again in the fresh pane.

The greeting element SHALL be memoised (`useMemo`) on the greeting text, icon URL and display name.

#### Scenario: Greeting shown before the first message
- **WHEN** the preview pane is shown and no preview message has been sent
- **THEN** an assistant bubble with the greeting text and the app avatar is visible above the input
- **AND** the app's configured intro text and starter buttons are still visible below the input

#### Scenario: Greeting stays at the top after sending
- **WHEN** the user sends a message in preview
- **THEN** the greeting bubble is still the first item of the message list, followed by the user's message and the app's response

#### Scenario: Greeting is not sent to the model
- **WHEN** the user sends the first preview message
- **THEN** the request created through `apiCreateConversation` / `startStream` contains only the user's message, not the greeting text

#### Scenario: Avatar falls back to initials
- **WHEN** the app has no icon URL and its name is "Design Review Agent"
- **THEN** the greeting avatar shows the initials derived from "Design Review Agent"

### Requirement: Preview availability scoped to an edited quick app
The quick-app editor (`ApplicationFormEditor` with `quickAppDefinition`) SHALL render the header's Preview toggle only in edit mode, i.e. once the application exists (`appId` is set), and never while a new application is being created, so the button does not render there at all.

In edit mode the button SHALL render but SHALL be disabled until the Setup reports readiness through `onReadyChange` — `QuickAppSetup` reports it once the schema has an `editorUrl` and the embedded editor's readiness signal is present, the same readiness gate that governs Save (see `quick-app-authoring`). A visible-but-disabled control tells the user preview exists and is not yet available, where an absent one reads as unsupported.

#### Scenario: No preview while creating
- **WHEN** the quick-app editor renders without an `appId`
- **THEN** the header shows no preview button

#### Scenario: Preview available for an edited app
- **WHEN** the quick-app editor renders with an `appId`, a schema that has `editorUrl`, and the embedded editor has reported readiness
- **THEN** the header shows an enabled preview button

#### Scenario: Preview button is disabled before the embedded editor is ready
- **WHEN** the quick-app editor renders with an `appId` but the embedded editor has not yet reported readiness
- **THEN** the preview button is rendered in a disabled state rather than omitted

### Requirement: Save-then-preview orchestration
Clicking the Preview button SHALL call the Setup handle's `startPreview(metadata.values)` (`QuickAppSetup`'s imperative handle). `startPreview` SHALL trigger the embedded editor's save (`AppEditorIframe.triggerSave()` posts `AppsEditorEvent.TriggerSave` to the iframe) and wait for the resulting `SaveSuccess`/`SaveError` postMessage, then run a follow-up `updateApplication` with the current metadata (`reassertSkillsSupport`, so the backend force-sets `features.skills_supported`) before the save counts as successful. `ApplicationFormEditor` SHALL set `isPreviewing` to `true` only after `startPreview` resolves. A save that receives neither message within `SETUP_SAVE_TIMEOUT_MS` (20 s) SHALL be treated as failed with `appsEditor.error.saveTimeout`.

#### Scenario: Preview save succeeds
- **WHEN** the user clicks Preview, the iframe posts `AppsEditorEvent.SaveSuccess`, and the follow-up `updateApplication` succeeds
- **THEN** the editor does NOT navigate away (unlike a normal Save)
- **AND** the editor is hidden and the full-page preview (Back to setup header, banner, preview chat) is shown
- **AND** keyboard focus moves to the "Back to setup" button

#### Scenario: Preview save fails
- **WHEN** the user clicks Preview and the iframe posts `AppsEditorEvent.SaveError` (or the follow-up update fails, or the save times out)
- **THEN** the editor stays visible on the iframe (does not enter preview)
- **AND** `QuickAppSetup` shows the error inline as an `ErrorMessageNotification` above the iframe
- **AND** the Preview button is still shown and enabled once the overlay clears

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
Clicking "Back to setup" on the preview page SHALL set `isPreviewing` to `false` and show the editor again (header, Metadata, Setup with `AppEditorIframe`) without re-saving and without remounting or reloading the iframe. `EntityEditor` and `QuickAppSetup` stay mounted throughout preview (hidden and `inert`), so the iframe's `src`, load state and internal state are preserved. Leaving preview SHALL NOT delete or otherwise affect the preview conversation: `QuickAppPreview` stays mounted (hidden), so it can be re-entered later in the same session. After leaving, keyboard focus SHALL return to the header's Preview button.

#### Scenario: Back to setup
- **WHEN** the user clicks "Back to setup"
- **THEN** the editor becomes visible again, with the settings iframe in the same state it had when Preview was clicked
- **AND** no `TriggerSave`, `getConversation`, or navigation call occurs as a side effect
- **AND** the preview conversation (if one was created) is not deleted
- **AND** focus is on the Preview button

### Requirement: Preview chat uses a fixed model that is disabled, not hidden
The preview pane (`AppPreviewChat`) SHALL target a fixed model equal to the application's deployment id (the same `appId` used by `AppEditorIframe`), its display name (`metadata.name`, falling back to the schema's `displayName`), and its icon (`metadata.iconUrl`, falling back to the schema's `iconUrl`). Before the conversation exists it renders `NewConversationComposer` with `deployments={[fixedModel]}` and `isModelSelectorDisabled`; afterwards it renders `ConversationView` with `fixedModel`. The model selector SHALL remain visible, showing the fixed model's name/icon, but SHALL be disabled and SHALL NOT open a picker.

#### Scenario: Model chip is visible but disabled
- **WHEN** the preview chat pane is shown
- **THEN** the composer shows a model chip displaying the previewed application's name/icon
- **AND** clicking the chip does not open a model picker or change the selection
- **AND** every message sent from the preview pane targets the application being edited, regardless of any other deployment configured elsewhere in the app

### Requirement: Preview chat is a real, session-scoped conversation
The preview pane SHALL use the same conversation-creation, streaming, and interaction infrastructure as a normal chat (`apiCreateConversation`, `useConversationStream`, `useConversationHandlers`), so the full feature set of a normal chat (attachments, audio transcription, chat settings, edit/regenerate/rate) is available in preview with no reduced functionality. The conversation is created lazily on the first message sent in preview. Before that, the preview pane SHALL show the greeting bubble (see "Preview greeting bubble") above a composer equivalent to a normal new chat's, with the placeholder `appsEditor.previewChat.placeholder` ("Send a test message"). Leaving and re-entering preview within the same editor mount SHALL keep the same conversation and its accumulated messages.

#### Scenario: Preview conversation is created on first send
- **WHEN** the user sends the first message in the preview pane
- **THEN** a real conversation is created via the same API a normal new chat uses, with its model set to the application being edited
- **AND** the message streams a response using the same streaming machinery as a normal chat

#### Scenario: History survives leaving and re-entering preview
- **WHEN** the user sends messages in preview, clicks "Back to setup", and re-enters preview later in the same editor session without a configuration change
- **THEN** the previously sent and received messages are still shown, and new messages are appended to the same conversation

#### Scenario: Full feature parity with a normal chat
- **WHEN** the user attaches a file, uses audio transcription, or opens chat settings in the preview pane
- **THEN** the feature behaves exactly as it does in a normal chat, since the same underlying hooks and endpoints are used

#### Scenario: Test-message placeholder
- **WHEN** the preview pane's composer is empty
- **THEN** its placeholder reads "Send a test message"

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

Before either the deployments list or this direct fetch has resolved the app, `AppPreviewChat` SHALL render a centered `Spinner` in place of the pre-conversation composer, so the composer never renders with an unresolved skills-support flag that would otherwise flip a moment later. The spinner SHALL clear as soon as *either* source resolves the app (the list's `findDeploymentByIdOrReference` match, or the direct fetch resolving with details) — whichever comes first — even if the other is still in flight. The condition is `!appDeployment && !appDeploymentDetails && (isDeploymentsLoading || isAppDetailsLoading)`: a direct fetch that rejects or settles without a result does not clear the spinner on its own, so it stays up until the deployments list finishes loading (and clears once both sources have finished loading, even without a match).

#### Scenario: Rejected direct fetch keeps the spinner until the list finishes
- **WHEN** the direct `getDeploymentDetails(appId)` call rejects while the deployments list is still loading
- **THEN** the spinner stays up until `isDeploymentsLoading` becomes `false`

#### Scenario: Spinner shown before either source has resolved the app
- **WHEN** `AppPreviewChat` mounts, `useDeployments().items` does not yet contain `appId`, and the direct `getDeploymentDetails(appId)` call has not yet settled
- **THEN** a centered `Spinner` (role `status`, inner `role="img"` labeled "Loading") renders instead of the composer
- **AND** no starter buttons, intro text, or skill-selector state are shown yet

#### Scenario: Spinner clears as soon as either source resolves
- **WHEN** the direct `getDeploymentDetails(appId)` call resolves with details (or, symmetrically, the deployments list resolves the app) while the other source is still pending
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

The current preview session SHALL be discarded whenever a setup save reports that the persisted configuration actually changed.

A setup save (triggered either by Save or by Preview) completes with a `SaveSuccess` postMessage from the embedded Quick Apps editor. That message MAY carry a `hasChanges: boolean` field. See the `quick-app-authoring` spec's "SaveSuccess reports whether persisted data changed" requirement for what the embedded editor SHALL compute and send. `AppEditorIframe` SHALL normalize the field to a strict boolean (`event.data?.hasChanges === true`), so an absent or non-boolean field is treated as `false`.

Whenever a `SaveSuccess` arrives with `hasChanges === true` (and the follow-up `updateApplication` succeeds), the following SHALL happen:

- `QuickAppSetup` SHALL call its `onPreviewReset` prop (part of `ApplicationSetupProps`), at the same point in `save` / `startPreview` where it previously bumped its own counter. In `startPreview` this happens before `refetchDeployments()` is awaited.
- `ApplicationFormEditor` SHALL respond by bumping the `previewResetKey` it owns and passes as `key` to the definition's `Preview` component.
- Any preview conversation already created SHALL be deleted, using the same best-effort, non-blocking deletion used when leaving the editor.
- The in-memory preview state (conversation, messages, and any populated but unsent composer input) SHALL be reset, so the preview page next renders its initial greeting-and-composer state reflecting the just-saved configuration.

The reset SHALL be driven only by remounting the preview page. The pane's own unmount cleanup performs the deletion, and all of its local state is discarded together, with no separate teardown path to keep in sync.

When `hasChanges` is `false` (or absent), the existing preview conversation and its accumulated messages SHALL be left exactly as they are.

#### Scenario: Preview starts fresh after a real configuration change
- **WHEN** the user has an existing preview conversation, goes back to setup, changes a setup field in the embedded editor, and the resulting save's `SaveSuccess` reports `hasChanges: true`
- **THEN** the previous preview conversation is deleted
- **AND** the next time the preview page is shown it renders the greeting and an empty composer reflecting the latest configuration, not the prior conversation

#### Scenario: Preview retains history when nothing meaningful changed
- **WHEN** the user has an existing preview conversation, goes back to setup, and clicks Preview again without editing anything, with `SaveSuccess` reporting `hasChanges: false`
- **THEN** the preview conversation and its messages are unchanged, matching the "History survives leaving and re-entering preview" scenario

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
While the preview page is shown, the whole `EntityEditor` is hidden, so its Cancel and Save buttons are neither visible nor focusable. Clicking "Back to setup" SHALL bring both back in their normal state, with Save still subject to the setup readiness gate.

#### Scenario: Buttons restored after leaving preview
- **WHEN** the user clicks "Back to setup"
- **THEN** the Cancel and Save buttons are visible again, Save enabled only if the embedded editor is ready to save

### Requirement: Accessibility and i18n for the preview surface
All preview controls SHALL expose accessible names through i18n:

- The Preview button and the "Back to setup" button have visible localized labels, and their icons are marked `aria-hidden`.
- The preview chat pane SHALL be a `role="region"` labelled `AppsEditorI18nKeys.PreviewChatAriaLabel`, using the same ARIA conventions as the main conversation view (`role="log"` + `aria-live="polite"` for the message list).
- Entering preview SHALL move focus to "Back to setup", and leaving SHALL return focus to the Preview button.

All new user-visible strings SHALL be added to `translation-keys.ts` under `AppsEditorI18nKeys` and to `apps/chat/src/i18n/locales/en.json`.

Keys:

| Enum member | Key | English value |
| --- | --- | --- |
| `PreviewBackToSetup` | `appsEditor.previewChat.backToSetup` | "Back to setup" |
| `PreviewBannerLabel` | `appsEditor.previewChat.bannerLabel` | "Preview mode" |
| `PreviewBannerText` | `appsEditor.previewChat.bannerText` | "You are previewing <bold>{{name}}</bold>. Send a message to test how it responds. Usage is following your limits." |
| `PreviewGreeting` | `appsEditor.previewChat.greeting` | "Test your QuickApp here. Send a message or upload a document to see how it responds." |
| `PreviewGreetingAriaLabel` | `appsEditor.previewChat.greetingAriaLabel` | "Greeting from the application" (the greeting bubble's `role="group"` name) |
| `PreviewChatPlaceholder` | `appsEditor.previewChat.placeholder` | "Send a test message" (value changed) |
| `PreviewChatAriaLabel` | `appsEditor.previewChat.ariaLabel` | unchanged |
| `SavingOverlayLabel` | `appsEditor.savingOverlay` | unchanged |

`AppsEditorI18nKeys.ExitPreviewButton` (`appsEditor.exitPreviewButton`) SHALL be removed from the enum and from every locale file. The "Preview" label itself reuses the shared `BasicI18nKeys.Preview` (`basic.preview`) rather than an editor-specific key.

#### Scenario: Preview controls have accessible names
- **WHEN** a screen reader focuses the Preview button or the "Back to setup" button
- **THEN** it announces the localized "Preview" or "Back to setup" text, not just an icon, and the Preview button announces no pressed state

#### Scenario: Focus moves into and out of preview
- **WHEN** the user enters preview with the keyboard and then activates "Back to setup"
- **THEN** focus lands on "Back to setup" after entering, and on the Preview button after leaving

#### Scenario: RTL layout
- **WHEN** the active locale is `ar` (or another RTL locale) and `dir="rtl"` is set on `<html>`
- **THEN** the preview page lays out mirrored via CSS logical properties, the back arrow is flipped with `rtl:scale-x-[-1]`, and `IconEye` (symmetric) is NOT flipped

### Requirement: No feature flag gating
The preview capability SHALL be available to any user who can already open the Quick App editor in edit mode for an application they can edit; it introduces no feature flag (no `FeatureKey` entry) and no role check of its own.

#### Scenario: Available to all Apps-editor users
- **WHEN** any user who can already open `/apps-editor` for an existing app reaches it in edit mode
- **THEN** the preview button is shown, with no additional role or feature-flag check beyond existing Apps-editor access
