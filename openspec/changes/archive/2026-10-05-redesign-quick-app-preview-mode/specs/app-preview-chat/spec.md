## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Exit preview returns to the settings iframe without reload
Clicking "Back to setup" on the preview page SHALL set `isPreviewing` to `false` and show the editor again (header, Metadata, Setup with `AppEditorIframe`) without re-saving and without remounting or reloading the iframe. `EntityEditor` and `QuickAppSetup` stay mounted throughout preview (hidden and `inert`), so the iframe's `src`, load state and internal state are preserved. Leaving preview SHALL NOT delete or otherwise affect the preview conversation: `QuickAppPreview` stays mounted (hidden), so it can be re-entered later in the same session. After leaving, keyboard focus SHALL return to the header's Preview button.

#### Scenario: Back to setup
- **WHEN** the user clicks "Back to setup"
- **THEN** the editor becomes visible again, with the settings iframe in the same state it had when Preview was clicked
- **AND** no `TriggerSave`, `getConversation`, or navigation call occurs as a side effect
- **AND** the preview conversation (if one was created) is not deleted
- **AND** focus is on the Preview button

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
