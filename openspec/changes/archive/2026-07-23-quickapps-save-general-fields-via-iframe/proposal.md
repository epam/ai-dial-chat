## Why

Save & Exit currently does two separate writes to the same application document: the
embedded QuickApps Settings iframe saves the whole app itself (including its own
in-memory, potentially stale copy of the General-step fields), and then, once that
`SaveSuccess` arrives, the host separately PATCHes the General-step fields
(name/description/iconUrl/topics/intro) via `update-application`. This depends on a
GET-then-merge on the backend to avoid the second write clobbering the first, is racy
by construction (two independent writes to one document, ordered only by client-side
sequencing), and does an extra network round trip on every Save & Exit of an existing
app. The two writes should collapse into the one write QuickApps already performs.

## What Changes

- The host stops calling `update-application` from `handleSaveSuccess` after the
  Settings-step iframe reports success. The GET-then-merge-after-save comment/logic in
  `apps/chat/src/pages/AppsEditor/AppsEditor.tsx` is removed.
- **BREAKING** (internal protocol only): `AppsEditorEvent.TriggerSave` gains a payload
  carrying the current General-step form values (name, description, iconUrl, version,
  topics, intro), defined in `apps/chat/src/types/apps-editor.ts`. The embedded QuickApps
  app is expected to merge these values into the app document it saves, instead of
  relying on its own in-memory copy from whenever it last loaded the app.
- `AppEditorIframe`'s `triggerSave()` handle accepts the General-step values and includes
  them in the `postMessage` payload sent to the iframe.
- `SettingsStep`'s `triggerSave()` handle forwards the same payload through to
  `AppEditorIframe`.
- `AppsEditor.tsx` sources the current General-step values to pass at trigger time.
  `GeneralForm` exposes a way to read its current in-memory values (in addition to
  `submit`/`persist`) so `AppsEditor` doesn't duplicate that state.
- Save & Exit for an existing app becomes a single write (Settings-step save with General
  values embedded) instead of a Settings-step save followed by a conditional
  update-application call.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `quick-app-authoring`: the "Editing General step fields persists the changes on Save &
  Exit" requirement changes from "host issues its own `update-application` PATCH after
  Settings-step `SaveSuccess`" to "host includes current General-step values in the
  `TriggerSave` payload sent to the embedded editor, which persists them as part of its
  own single save." The dirty-check (skip when General is unchanged from its seeded
  values) and the "does not alter settings-step configuration/version" guarantee are
  preserved.

## Impact

- `apps/chat/src/pages/AppsEditor/AppsEditor.tsx` — remove post-`SaveSuccess`
  `generalFormRef.current?.persist()` call and related dirty-check trigger point; read
  current General values and pass them into `triggerSave()`.
- `apps/chat/src/pages/AppsEditor/GeneralForm.tsx` — add a values accessor to
  `GeneralFormHandle` (or otherwise expose current values); dirty-check logic may move to
  the caller or stay internal depending on design.
- `apps/chat/src/pages/AppsEditor/SettingsStep.tsx` — `triggerSave()` signature gains a
  parameter.
- `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` — `triggerSave()` signature gains a
  parameter; `TriggerSave` postMessage payload gains fields.
- `apps/chat/src/types/apps-editor.ts` — define the `TriggerSave` payload shape.
- Any embedded QuickApps editor contract/documentation describing the `TRIGGER_SAVE`
  message shape (external to this repo) needs updating to consume the new payload fields
  — out of scope for this repo's change but called out as a coordination dependency.
- Existing tests in `apps/chat/src/pages/AppsEditor/tests/` covering `TriggerSave`,
  `handleSaveSuccess`, and General-step persistence need updating.
