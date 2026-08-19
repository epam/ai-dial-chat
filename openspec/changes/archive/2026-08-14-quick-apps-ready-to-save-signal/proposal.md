## Why

The Settings step's Save/Preview buttons currently gate on `AppsEditorEvent.ReadyToInteract`,
which the embedded Quick Apps iframe sends once its UI has rendered. That signal says nothing
about whether the iframe has finished loading and validating its own internal application
model. We've seen data-loss bugs where a save races the iframe's own internal state (it acts
on a stale/incomplete copy of the application). A UI-rendered signal is not a strong enough
contract to safely allow Save/Preview — we need an explicit signal from the Quick Apps editor
that its own data model is loaded and it is safe to trigger a save.

## What Changes

- Add a new cross-origin `postMessage` event, `AppsEditorEvent.ReadyToSave`, that the Quick
  Apps iframe sends once (and re-sends after any internal reload of its own data) when it is
  safe to send it `TRIGGER_SAVE`.
- **BREAKING** (external contract): Save/Preview gating in `apps/chat` switches from
  `ReadyToInteract` to `ReadyToSave`. `ReadyToInteract` is kept as-is for its existing purpose
  (hiding the loading spinner over the iframe); it no longer gates Save/Preview. Until the
  Quick Apps editor is updated to send `ReadyToSave`, Save/Preview will stay disabled
  indefinitely for that editor (bounded by the new readiness timeout below) — this is an
  intentional fail-safe, not a regression, given the data-loss risk of saving before the
  Quick Apps editor is ready.
- Add a bounded readiness timeout: if `ReadyToSave` never arrives within a fixed window after
  the iframe becomes visible, show an inline error/notice instead of leaving Save/Preview
  disabled forever with no explanation.
- Preserve existing reset semantics: readiness (for both concerns) re-gates to `false`
  whenever the iframe reloads for a different app or schema.
- Document the exact `postMessage` contract (event name, payload, origin/timing rules) the
  Quick Apps editor team must implement, as part of this change's design doc, so it can be
  handed off.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `quick-app-authoring`: the "Settings step readiness gates Save and Preview" requirement
  changes from gating on `ReadyToInteract` to gating on a new `ReadyToSave` signal, and adds a
  bounded timeout for readiness itself (distinct from the existing save-in-progress timeout).

## Impact

- `apps/chat/src/types/apps-editor.ts` — new `AppsEditorEvent.ReadyToSave` member.
- `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` — listen for `ReadyToSave`, expose it
  via `onReadyChange` (or a new distinct callback), add the readiness timeout.
- `apps/chat/src/pages/AppsEditor/SettingsStep.tsx` — thread the new readiness signal through
  unchanged in shape (same callback plumbing as today).
- `apps/chat/src/pages/AppsEditor/AppsEditor.tsx` — `isSaveDisabled`/`canPreview` gate on the
  new signal; add the readiness-timeout error surface.
- No backend (`apps/chat-api`) changes — this is a frontend-only, cross-origin `postMessage`
  contract change.
- External dependency: the separately-deployed Quick Apps editor application (`schema.editorUrl`)
  must be updated to send `ReadyToSave`; until then, Save/Preview will not enable for it. This
  requires a handoff (see `design.md`) to that team; it is out of this repo's control.
