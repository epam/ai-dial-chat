## MODIFIED Requirements

### Requirement: Save-then-preview orchestration
Clicking the Preview button SHALL call the Setup handle's `startPreview(metadata.values)` (`QuickAppSetup`'s imperative handle). `startPreview` SHALL trigger the embedded editor's save (`AppEditorIframe.triggerSave()` posts `AppsEditorEvent.TriggerSave` to the iframe, carrying the `general` payload built from the current metadata, as Save does) and wait for the resulting `SaveSuccess`/`SaveError` postMessage. The host makes no follow-up `updateApplication` call: the embedded editor is the single writer. `ApplicationFormEditor` SHALL set `isPreviewing` to `true` only after `startPreview` resolves. A save that receives neither message within `SETUP_SAVE_TIMEOUT_MS` (20 s) SHALL be treated as failed with `appsEditor.error.saveTimeout`.

#### Scenario: Preview save succeeds
- **WHEN** the user clicks Preview, the iframe posts `AppsEditorEvent.SaveSuccess`
- **THEN** the editor does NOT navigate away (unlike a normal Save)
- **AND** the editor is hidden and the full-page preview (Back to setup header, banner, preview chat) is shown
- **AND** keyboard focus moves to the "Back to setup" button

#### Scenario: Preview save fails
- **WHEN** the user clicks Preview and the iframe posts `AppsEditorEvent.SaveError` (or the save times out)
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
`ApplicationFormEditor` SHALL set `isSaving` for both a normal Save and the preview toggle's `startPreview`, and SHALL render a blocking overlay whenever it is busy — `isSaving`, or while the edited application or its setup is still loading. While busy, the whole `EntityEditor` (header included) SHALL be made `inert`. For a preview save whose `SaveSuccess` reports `hasChanges: false`, `startPreview` SHALL resolve without awaiting `refetchDeployments()`, which remains fire-and-forget. For `hasChanges: true`, `startPreview` SHALL await `refetchDeployments()` before resolving, so the overlay stays up and the preview pane is never revealed with a deployment list that predates the save; a rejected refetch is logged and still lets preview start. For a normal Save, `ApplicationFormEditor` SHALL await `refetchDeployments()` before navigating, regardless of `hasChanges`.

The overlay SHALL be an `absolute inset-0` `bg-backdrop` layer marked `aria-hidden="true"`, with a `Spinner` and the label inside a centered opaque card (`bg-layer-sunken`, rounded, `shadow-lg`). The label is the definition's `savingOverlay` key while saving (`AppsEditorI18nKeys.SavingOverlayLabel`, `appsEditor.savingOverlay`, "Saving in progress…") and its `loadingOverlay` key while loading (`appsEditor.settingsStep.loadingLabel`). The label SHALL be announced through a separate, always-mounted `sr-only` `<span role="status" aria-live="polite">` that holds the text only while busy.

#### Scenario: Overlay shown while the preview save is in flight
- **WHEN** the user clicks Preview and `startPreview` has not yet resolved
- **THEN** a translucent `bg-backdrop` backdrop covers the editor, with an opaque `Spinner` + "Saving in progress…" card centered on top
- **AND** the `EntityEditor` underneath is `inert`
- **AND** the status region announces "Saving in progress…"

#### Scenario: Overlay hidden as soon as SaveSuccess arrives when nothing changed
- **WHEN** the iframe posts `AppsEditorEvent.SaveSuccess` for a preview request that reports `hasChanges: false`
- **THEN** the editor switches to the preview pane and hides the overlay
- **AND** this happens whether or not the background `refetchDeployments()` call has resolved yet

#### Scenario: Overlay stays up until the refetch settles when settings changed
- **WHEN** the iframe posts `AppsEditorEvent.SaveSuccess` for a preview request that reports `hasChanges: true`
- **THEN** `startPreview` awaits `refetchDeployments()` before the editor switches to the preview pane and hides the overlay
- **AND** a rejected refetch is logged and still lets the editor switch to the preview pane afterward

#### Scenario: Overlay also shown for the normal Save action
- **WHEN** the user clicks Save and the save has not yet completed
- **THEN** the same overlay is shown, since `isSaving` is `true` for that action too
- **AND** it stays up across the awaited deployments refetch, until the editor navigates away

### Requirement: Preview session resets when the saved configuration actually changed

The current preview session SHALL be discarded whenever a setup save reports that the persisted configuration actually changed.

A setup save (triggered either by Save or by Preview) completes with a `SaveSuccess` postMessage from the embedded Quick Apps editor. That message MAY carry a `hasChanges: boolean` field. See the `quick-app-authoring` spec's "SaveSuccess reports whether persisted data changed" requirement for what the embedded editor SHALL compute and send. `AppEditorIframe` SHALL normalize the field to a strict boolean (`event.data?.hasChanges === true`), so an absent or non-boolean field is treated as `false`.

Whenever a `SaveSuccess` arrives with `hasChanges === true`, the following SHALL happen:

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

