## Context

`AppsEditor.tsx` currently persists an existing Quick App's General-step fields
(name/description/iconUrl/topics/intro — never `version`, see below) in two independent
writes on Save & Exit:

1. The embedded QuickApps Settings-step iframe saves the whole application document
   itself, from its own in-memory copy of General fields (populated whenever it last
   loaded the app — which may predate edits the user just made in the host's General
   step).
2. Once the iframe reports `SaveSuccess`, the host calls `update-application` with the
   current General-step form values, relying on the backend's GET-then-merge PATCH
   semantics to land on top of write (1) rather than being clobbered by it.

This is two writes to one document ordered only by client-side sequencing (`await
generalFormRef.current?.persist()` after `SaveSuccess`), an extra request per Save & Exit,
and inherently racy if anything else touches the document between the two writes. The fix
is to give QuickApps the current General values *before* it does its one save, via the
`TriggerSave` message it already receives, so there is exactly one write.

`version` is deliberately excluded from today's `update-application` call (per the
existing `quick-app-authoring` requirement: "The update SHALL NOT alter that
application's ... `version`") and stays excluded from the new payload for the same
reason — Settings-step save must not silently change the app's version.

## Goals / Non-Goals

**Goals:**

- Collapse Save & Exit for an existing app into a single write performed by the embedded
  QuickApps editor.
- Remove the host's own `update-application` call and its GET-then-merge dependency for
  this flow.
- Preserve existing guarantees: General edits are only persisted on final Save & Exit
  (not on `Next`, not on Preview), and `version`/settings-step configuration are
  untouched by this path.

**Non-Goals:**

- Changing General-step field validation behavior (`Next`'s
  `validateDeploymentCreationFields` call is unchanged; this change does not add
  revalidation before Save & Exit for fields edited after `Next` was last clicked — that
  gap, if any, is pre-existing and out of scope).
- Changing the General-step persistence path for brand-new apps created in this session
  (`createApplication` on `Next` already writes the initial General values; this change
  does not alter when/whether *later* edits to General after creation get persisted for
  a session-created app — this is unchanged pre-existing behavior gated by
  `hasExistingAppOnMountRef`).
- Any change to the embedded QuickApps app's own code — this repo only changes the
  message contract it receives.

## Decisions

### 1. `TriggerSave` payload shape

Add to `apps/chat/src/types/apps-editor.ts`:

```ts
export interface TriggerSaveGeneralPayload {
  name: string;
  description?: string;
  iconUrl?: string;
  topics?: string[];
  intro?: string;
}

export interface TriggerSaveMessage {
  type: AppsEditorEvent.TriggerSave;
  general?: TriggerSaveGeneralPayload;
}
```

`general` is optional and omitted entirely for: the General step's own `Next` action
(doesn't touch Settings), Preview triggers, and any Save & Exit where the app didn't
already exist when the editor session started (`hasExistingAppOnMountRef.current ===
false`) — mirrors exactly the existing gating condition for when
`generalFormRef.current?.persist()` used to run. `version` is intentionally never
included, matching the current `update-application` call and the requirement that
Settings-step save must not alter version.

**Alternative considered:** always include `general` regardless of gating and let the
dirty-check happen upstream. Rejected — it would change *when* General values reach the
embedded editor for the brand-new-app-in-session case, which is explicitly out of scope
(Non-Goals), and would widen the blast radius of this change beyond fixing the
double-write.

### 2. No more dirty-check gating on whether to send

Today, `GeneralForm.handlePersist` compares current values against
`seededValuesRef.current` and skips the `update-application` call entirely when nothing
changed — because an unnecessary PATCH was extra cost worth avoiding. Under the new
model there is no second write to skip: the values are merged into the one write
QuickApps already performs, so sending unchanged values costs nothing extra. The
dirty-check is removed rather than ported to the new payload path.

**Alternative considered:** keep the dirty-check and only set `general` when values
differ from the seeded ones. Rejected as unnecessary complexity — no cost being avoided,
and it would require exposing seeded-value comparison across the ref boundary for no
behavioral benefit.

### 3. `GeneralFormHandle` gains a values accessor, loses `persist`

```ts
export interface GeneralFormHandle {
  submit: () => Promise<void>;
  /** Current in-memory General-step values, normalized the same way `persist` used to
   * trim them before sending to `update-application`. */
  getValues: () => TriggerSaveGeneralPayload;
}
```

`handlePersist` and the `updateApplication` import/call in `GeneralForm.tsx` are removed.
`getValues` is a synchronous read of component state — no network call, no async.

**Alternative considered:** lift General-step form values into `AppsEditor` state (via
`onChange` callback) instead of a ref-based pull. Rejected — `GeneralForm` already owns
this state privately and pulling it up would mean `AppsEditor` re-rendering on every
keystroke in the General step; a synchronous ref accessor read only at
trigger-save-time avoids that and keeps `GeneralForm`'s state private, consistent with
how `submit` already works.

### 4. Threading the payload through `triggerSave()`

`AppEditorIframe.triggerSave()`, `SettingsStepHandle.triggerSave()`, and
`AppsEditor.handleSave`/`handlePreview` all gain a `general?: TriggerSaveGeneralPayload`
parameter, passed through unchanged to the `postMessage` call:

```ts
iframeRef.current?.contentWindow?.postMessage(
  { type: AppsEditorEvent.TriggerSave, general } satisfies TriggerSaveMessage,
  new URL(schema.editorUrl).origin,
);
```

`handleSave` computes the payload right before calling `triggerSave`:

```ts
const general =
  pendingAction === 'save' && hasExistingAppOnMountRef.current
    ? generalFormRef.current?.getValues()
    : undefined;
settingsStepRef.current?.triggerSave(general);
```

`handlePreview` always passes `undefined` (Preview never persists General, same as
today).

### 5. `handleSaveSuccess` simplification

Remove the `completeSave` async wrapper's `generalFormRef.current?.persist()` branch and
its try/catch (the only reason `completeSave` needed to be async/catchable). What
remains — `refetchDeployments()`, clearing `isSaving`, navigating or entering preview —
has no reason to fail in a way that needs its own error branch beyond what already
exists, so `handleSaveSuccess` no longer needs its own dedicated error path for this
step; `refetchDeployments().catch(() => undefined)` already swallows that failure as
before.

## Risks / Trade-offs

- **[Cross-repo contract change]** The embedded QuickApps editor (external to this repo)
  must start reading `general` off the `TRIGGER_SAVE` message and merging it into its own
  save, or General edits will silently stop being persisted on Save & Exit. → Mitigation:
  this is called out as a coordination dependency in the proposal; land it in lockstep
  with (or gated until) the QuickApps-side change ships, and keep `general` optional so
  an old QuickApps build that ignores the field fails safe (General edits just don't
  persist, no crash) rather than failing hard.
- **[Silent behavior change if QuickApps ignores the field]** Because `general` is
  optional and additive to an existing message type, there's no way for the host to
  detect whether the embedded editor actually consumed it. → Mitigation: out of scope to
  add an acknowledgment protocol here; existing `SaveSuccess`/`SaveError` still confirms
  the overall save happened, which is the same confirmation granularity as today.
- **[Pre-existing validation gap carried forward]** A user can switch to the General tab,
  edit the name to something that fails `validateDeploymentCreationFields`, switch back
  to Settings without clicking `Next`, and hit Save & Exit — today that invalid value
  reaches `update-application` unvalidated; after this change it reaches the iframe
  payload unvalidated. Same risk, not introduced by this change. → Not mitigated here;
  flagged as an Open Question below.

## Migration Plan

No data migration. This is a client-side message-contract change:

1. Land the `TriggerSaveGeneralPayload`/`TriggerSaveMessage` type and the
   `AppsEditor`/`AppEditorIframe`/`SettingsStep`/`GeneralForm` changes together (single
   PR, per repo convention — this isn't a phased rollout of independently-shippable
   pieces).
2. Update/confirm the QuickApps editor's `TRIGGER_SAVE` handler consumes `general`
   (tracked as an external coordination dependency, not a task in this change).
3. Rollback is a plain revert — no persisted state format changes.

## Open Questions

- Should Save & Exit revalidate General-step fields (name pattern, intro length) before
  including them in the `TriggerSave` payload, closing the pre-existing validation gap
  noted above? Left as a follow-up; not addressed by this change.
