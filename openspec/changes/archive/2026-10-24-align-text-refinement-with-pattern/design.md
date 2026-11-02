## Context

Refinement is split in two pieces in `libs/chat-shared`:

- `useTextRefinement` (`libs/chat-shared/src/hooks/useTextRefinement.ts`) owns the
  lifecycle: `state`, the abort controller, a request `generation`, the Undo
  `baseline`, and the `expected` value it is waiting for the host to echo back. Any
  value change it did not cause resets it (that is how a manual edit clears Undo and
  aborts a pending request).
- `TextRefinementField` (`libs/chat-shared/src/components/TextRefinementField/TextRefinementField.tsx`)
  renders the label row, a Refine `GhostButton` (spinner while pending), an Undo
  `GhostButton` while `canUndo`, a polite live region with visible status text, and
  an inline `ErrorText`. It receives the control as `children` and knows its id as
  `fieldId`.

Six call sites wrap a control with it: Description textareas (scheduled task, and
`MetadataForm`'s `renderDescription` in prompt, toolset, and app editors) and
Instructions Markdown editors (prompt, skill, scheduled task). The Markdown editors
render a plain `<textarea>` carrying the same `id` (see the comment in
`ScheduledTaskCreateForm.tsx`). Hosts pass `disabled` to coordinate one pending
request per form; none of them make the control read-only.

## Goals / Non-Goals

**Goals:** match the pattern's Refining and Result states in the one shared
component and hook, with no host API change.

**Non-Goals:** Name-field refinement; kit button restyling; backend changes.

## Decisions

### D1. Read-only is applied by `TextRefinementField`, by `fieldId`

While `refinement.isPending`, a layout effect in `TextRefinementField` finds the
element with `id === fieldId` inside its own wrapper, records its current `readOnly`,
sets `readOnly = true`, and restores the recorded value in the effect cleanup (which
runs when pending ends and on unmount).

- *Why here:* the field already owns `fieldId` and wraps the control, so every host
  gets the behavior at once, including `renderDescription` and the lazy Markdown
  editor that may not expose a `readOnly` prop.
- *Why `readOnly`, not `disabled`/`inert`:* a read-only textarea keeps focus,
  selection, scrolling, and its accessible name, and keeps the text readable;
  `disabled` dims it and drops focus; `inert` removes it from the a11y tree.
- *Lookup scope:* the `input`/`textarea` inside the field wrapper whose `id` equals
  `fieldId` (matched on the property, so no selector escaping — jsdom lacks
  `CSS.escape`), not `document.getElementById`, so two forms with colliding ids cannot
  affect each other.
  If the element is not found (e.g. the editor is still in `Suspense`), nothing
  happens and the existing abort-on-edit guard is the fallback.
- *Rejected:* a `readOnly` prop threaded through each host (six sites, drift risk);
  React owning the attribute is not an issue because no host sets `readOnly` on these
  controls today — the effect restores the recorded value rather than forcing `false`.
- The hook's abort-on-edit rule stays unchanged as a safety net for edits that bypass
  the textarea (Markdown toolbar buttons).

### D2. One primary action button that changes label and icon

The row renders `[Restore original]? [Primary]`. The primary button is a single
`GhostButton` element in a fixed position, so React keeps the same DOM node and
focus survives state changes:

| State | Primary label | Icon | Disabled |
| --- | --- | --- | --- |
| Ready / Idle / Error without baseline | `refineWithAiLabel` | sparkles | `disabled \|\| !canRefine` |
| Pending | `refineRefiningLabel` | spinner | always |
| Result (baseline exists) | `refineRegenerateLabel` | sparkles | `disabled \|\| !canRefine` |

Restore original renders only while `canUndo && !isPending`, before the primary
button, with `IconRestore` (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`,
`size={DIAL_ICON_SIZE.SM}`). Hiding it during a Regenerate matches the pattern's
Refining state, which shows only the Refining action. Neither icon mirrors in RTL.

### D3. Regenerate sends the baseline

`refine()` gains a source distinct from the value snapshot:

- `snapshot = latest.value` — used for the staleness check (`latest.value === snapshot`)
  and for "unchanged" (`text === snapshot`).
- `source = baseline ?? snapshot` — what is passed to `onRefine`.

No new hook method: "Regenerate" is just `refine()` while a baseline exists. The
baseline exists only in the Result state, because any manual edit resets it, so a
first refine always sends the current text. `canRefine` is unchanged (the baseline is
non-blank by construction). An error during Regenerate keeps the refined text and the
baseline, so the row stays Restore original + Regenerate with the inline error.

### D4. Focus after Restore original

Restore original unmounts itself. Because the primary button is the same DOM node in
every state (D2), the click handler focuses it synchronously — the last button in the
controls wrapper — and it re-renders as Refine with AI with focus intact. This
replaces today's `querySelector('button').focus()`, which would now hit the Restore
button itself.

### D5. Status visibility

The live region stays mounted. Pending, Success, and Restored messages get `sr-only`;
Unchanged stays visible because nothing else shows that a request ended with no edit.
`colors.refineActionText` / `typography.refineFeedbackClassName` therefore still style
a visible message, so no styling prop becomes dead.

### D6. Labels and i18n

`TextRefinementLabels` gains `refineRefiningLabel` and `refineRegenerateLabel`
(optional, inline JSDoc with defaults). `refineUndoLabel` keeps its name, default
becomes "Restore original". App: `TextRefinementI18nKeys.Refining`/`Regenerate`,
`en.json` `textRefinement.refining`/`regenerate`, `textRefinement.undo` →
"Restore original", wired in `useTextRefinementLabels` (already `useMemo`'d on `t`).
Host libs pass `TextRefinementLabels` through unchanged (`PromptEditorLabels` extends
it; skill/task labels spread it), so they need no code change — verify, and add the
fields where a host lists label keys explicitly.

No memoisation changes: the hook's callbacks are already stable `useCallback`s.
Not gated behind `ENABLED_FEATURES`; availability stays `aiTextRefinementAvailable`.
No telemetry or caching changes.

## Risks / Trade-offs

- [The control is not a native input, so `readOnly` does nothing] → abort-on-edit
  still protects the request; only the "can't type" affordance is lost for that host.
- [A host later sets `readOnly` itself] → the effect restores the recorded value, so
  the host's value wins after the request; documented in the component JSDoc.
- [Accessible name changes to "Refining" while pending] → intentional per the pattern;
  the pending message is also announced through the live region, and focus stays on
  the same button.
- [Tests and READMEs in four host libs assert "Undo" or visible "Text refined"] →
  updated in the same change (tasks list each file).

## Migration Plan

No data or API migration. Ship in one PR; revert the PR to roll back.

## Open Questions

None blocking. Name-field refinement is tracked as a separate change.
