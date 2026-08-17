## Context

`apps/chat/src/pages/AppsEditor/` hosts the Quick App editor. Its Settings step embeds a
cross-origin iframe (`schema.editorUrl`) — a separately deployed application ("Quick Apps
editor") that we do not own the source of. Communication with it is exclusively
`window.postMessage`, defined by `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts`.

Today, `AppEditorIframe.tsx` tracks a single `isLoading` boolean, flipped to `false` either by
the iframe's native `load` DOM event or by an `AppsEditorEvent.ReadyToInteract` message, and
reports `!isLoading` upward via `onReadyChange`. `AppsEditor.tsx` uses that same boolean to
gate both `isSaveDisabled` and `canPreview` (see `quick-app-authoring` spec, "Settings step
readiness gates Save and Preview").

`ReadyToInteract` only tells us the iframe's UI has rendered — not that the embedded editor
has finished loading and validating its own internal application model. We've observed data
races where a save is triggered against an iframe that is still initializing its own state,
producing saves that clobber good data with a stale/incomplete in-memory copy. The fix
requires a stronger, explicit signal from the iframe itself: "my data model is loaded and
validated, it is safe to call `TriggerSave` on me now."

## Goals / Non-Goals

**Goals:**

- Introduce `AppsEditorEvent.ReadyToSave`, sent by the Quick Apps iframe when — and only
  when — it is safe to trigger a save/preview.
- Gate `isSaveDisabled`/`canPreview` on this new signal instead of `ReadyToInteract`.
- Keep `ReadyToInteract` for its current, narrower purpose (hiding the loading spinner over
  the iframe area) — it is a UI-rendered signal, not a data-readiness signal, and continues to
  serve that purpose independently.
- Add a bounded timeout so that if the iframe never sends `ReadyToSave` (bug on that side, or
  an editor version that hasn't been updated yet), the user sees an explanatory error instead
  of permanently disabled buttons.
- Produce a precise, standalone contract description for the Quick Apps editor team.

**Non-Goals:**

- No change to the `TriggerSave` / `SAVE_SUCCESS` / `SAVE_ERROR` save-in-progress protocol —
  that is unaffected; this change only governs when Save/Preview become clickable.
- No backend (`apps/chat-api`) changes — this is purely a frontend `postMessage` contract.
- No change to `UpdatedSuccess` (intermediate autosave signal) handling.
- Not attempting to detect or diagnose *why* the iframe hasn't sent `ReadyToSave` (e.g. no
  attempt to distinguish "old editor version" from "genuinely still loading") — the timeout
  message is generic.

## Decisions

### 1. Two separate booleans, not one repurposed boolean

`AppEditorIframe.tsx` will track `isUiLoading` (renamed from `isLoading`, driven by the native
`load` event / `ReadyToInteract`, controls the spinner overlay) and `isReadyToSave` (new,
driven solely by `ReadyToSave`). `onReadyChange` continues to report readiness for
Save/Preview gating, but now sourced from `isReadyToSave` instead of `!isUiLoading`.

**Alternative considered:** repurpose the single existing boolean to mean "ready to save" and
require the iframe to send `ReadyToInteract` only once its data model is ready (i.e. redefine
the existing event instead of adding a new one). Rejected: `ReadyToInteract` already governs
the spinner overlay, which should disappear as soon as the UI is visually rendered
(independent of internal data-load timing) — collapsing both meanings into one event would
either show a misleadingly-early spinner-off, or misleadingly delay the spinner past the
point the UI is actually visible. Two signals map cleanly to two distinct real conditions.

### 2. `ReadyToSave` is idempotent and re-sendable, not a one-shot flag

The event may be sent more than once (e.g. if the iframe internally reloads its own data after
the user changes something inside it). The host always takes the latest signal at face value:
receiving `ReadyToSave` sets readiness `true`; the existing `settingsReadyKeyRef` reset (in
`AppsEditor.tsx`, keyed by `schema.id` + `appId`) sets it back to `false` whenever the *host*
reloads the iframe for a different app/schema. The iframe is not expected to send anything to
explicitly un-signal readiness — if it starts a real internal reload it should simply avoid
sending `ReadyToSave` until it's ready again, and the host does not currently need a
"not ready anymore" push signal since Save/Preview clicks are user-initiated, one-shot actions
(not continuously re-validated while idle).

### 3. Readiness timeout is separate from the save-in-progress timeout

`SETTINGS_SAVE_TIMEOUT_MS` (existing, 20s) covers a save/preview already in flight, waiting
for `SaveSuccess`/`SaveError`. This is a distinct concern: waiting for the *initial*
`ReadyToSave` before the user has done anything. A new, separate timeout
(`SETTINGS_READY_TIMEOUT_MS`) starts when the iframe becomes visible (Settings step mounted)
and, if `ReadyToSave` hasn't arrived by the deadline, surfaces an inline notice (reusing the
existing `saveError`-style notification area) explaining that the Settings editor did not
report readiness, rather than leaving the Save/Preview buttons silently disabled forever.
Chosen duration: 15s, slightly under the existing 20s save timeout, on the reasoning that
initial load should be faster than an in-flight save round-trip; this is a starting point, not
a hard requirement — adjustable if real-world load times differ.

**Alternative considered:** reuse `SETTINGS_SAVE_TIMEOUT_MS` for both concerns. Rejected: the
existing timeout's recovery action (`handleSaveError`) assumes a save was in progress
(clears `isSaving`, sets `pendingSaveAction` to `null`); readiness timeout fires before any
save was ever triggered, so it needs its own state and message, not to be routed through the
save-failure path.

### 4. `ReadyToSave` payload and naming

`ReadyToSave` follows the same displayName-prefixed, camelCase convention as its sibling
`ReadyToInteract` (both are UI/readiness-family events, unlike the flat, SCREAMING_SNAKE_CASE
save-action family `TriggerSave`/`SaveSuccess`/`SaveError`): message type is
`${displayName}/readyToSave`, mirroring `${displayName}/readyToInteract`. No payload beyond
the `type` field is needed for the host to act on it.

## Risks / Trade-offs

- **[Risk]** Until the Quick Apps editor team ships `ReadyToSave`, Save/Preview will never
  enable for that editor (readiness timeout will fire, showing an error, every time).
  → **Mitigation:** this is called out explicitly as a breaking external-contract change in
  the proposal; rollout must be coordinated so the frontend deploy and the Quick Apps editor
  deploy land together (see Migration Plan). We accept this over the alternative (silently
  keeping the weaker `ReadyToInteract` gate and continuing to risk data-loss saves).
- **[Risk]** If the Quick Apps editor sends `ReadyToSave` too early (before its own model is
  actually loaded) due to a bug on their side, this change provides no additional protection
  — we can only gate on the signal we're given, not verify its truthfulness.
  → **Mitigation:** out of scope for this repo; flagged explicitly in the handoff instructions
  below as the core guarantee the other team must uphold.
- **[Risk]** Two readiness-adjacent timeouts (save-in-progress vs. initial-readiness) add
  cognitive overhead for future maintainers.
  → **Mitigation:** distinct constant names and inline comments explaining which concern each
  covers (mirroring the existing `SETTINGS_SAVE_TIMEOUT_MS` comment style).

## Migration Plan

1. Ship the frontend change (this repo) behind no feature flag — `ReadyToInteract` continues
   to work for the spinner; only the Save/Preview gate moves to `ReadyToSave`.
2. Because older/unmodified Quick Apps editor deployments will never send `ReadyToSave`, this
   frontend change should not roll out to production until the Quick Apps editor team confirms
   `ReadyToSave` is live in the same environment. Coordinate deployment order with that team
   using the handoff instructions below.
3. No data migration, no rollback complexity beyond a standard revert of this frontend change
   (which would simply restore the previous `ReadyToInteract`-based gating).

## Open Questions

- Exact readiness-timeout duration (15s proposed) — confirm against real observed load times
  for the Quick Apps editor once it's instrumented, and adjust if needed.
- Coordination mechanism/timeline with the Quick Apps editor team for simultaneous rollout is
  outside this repo's OpenSpec change and needs to be tracked separately (e.g. a cross-team
  ticket).
