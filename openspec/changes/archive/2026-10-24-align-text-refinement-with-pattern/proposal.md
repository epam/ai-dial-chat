## Why

The "AI text refinement" design pattern (Patterns 2.0) defines four field states —
Nothing to refine yet, Ready to refine, Refining…, Result returned — and the shared
`TextRefinementField` diverges from it in the Refining and Result states. Authors can
type into a field mid-request (which silently aborts it), the action never says
"Refining", and a returned result offers a bare "Undo" plus the same "Refine with AI"
instead of the pattern's "Restore original" and "Regenerate". Every refinable form
(skill, scheduled task, application, toolset, prompt) renders through the one shared
component, so aligning it now fixes all of them at once.

## What Changes

- **Refining is read-only.** While a request is pending, the refinable control is
  read-only and keeps showing the original text; the action label switches from
  "Refine with AI" to "Refining" beside the spinner and stays disabled until the
  response returns. This supersedes the 2026-09-24 decision recorded in
  `ai-text-refinement` that kept the field editable. The abort-on-edit guard stays
  as a safety net for edits that do not go through the text control (e.g. a
  Markdown toolbar).
- **Result offers Restore original and Regenerate.** After a changed result, the
  action row shows "Restore original" (restore icon; reverts to the pre-refine draft —
  the existing Undo behavior, renamed) and "Regenerate" (sparkles icon) in place of
  "Refine with AI". Editing the text manually returns the field to Ready (existing
  behavior).
- **Regenerate produces a fresh variant of the original draft.** Regenerate sends
  the pre-refine baseline to the host callback rather than re-refining the already
  refined text. Restore original still restores that same baseline.
- **Status text follows the pattern.** "Text refined" and "Original text restored."
  become screen-reader-only (the action row itself now shows the state). "No changes
  were needed." stays visible, because nothing else on screen shows that a request
  finished without a change. Inline errors stay visible.
- **Labels (non-breaking).** New optional `TextRefinementLabels` fields
  `refineRefiningLabel` (default "Refining") and `refineRegenerateLabel` (default
  "Regenerate"). `refineUndoLabel` keeps its name; its default becomes
  "Restore original". A host that passes its own `refineUndoLabel` keeps its string.
- **i18n.** Two new app keys, `textRefinement.refining` and
  `textRefinement.regenerate`; `textRefinement.undo` changes to "Restore original".
  `en.json` is the only locale file.

## Non-goals

- Refinement for **Name** fields. The pattern shows it, but no host supplies a Name
  callback, no API purpose exists for names, and every form would need new wiring —
  a separate change.
- Visual restyling of the kit `GhostButton` (accent color, sizes) beyond the label,
  icon, and disabled state.
- Any backend, API, or purpose-prompt change.

## Alternatives considered

- **Read-only via `inert` on the field wrapper** — rejected: removes the control from
  focus order and the accessibility tree, so a keyboard or screen-reader user loses
  the field (and its text) mid-request, which the pattern does not ask for.
- **Read-only via a new host prop on every form** — rejected: six call sites, and
  `MetadataForm`'s `renderDescription` and the lazy Markdown editor do not all expose
  `readOnly`; the shared component already owns `fieldId`, so it can set it once.
- **Regenerate re-refines the current text** (today's behavior) — rejected: the pattern
  asks for a fresh variant, and compounding rewrites drift from the author's draft.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `ai-text-refinement`: the pending-state requirement (field becomes read-only,
  action label switches to "Refining"), the replacement/Undo requirement (Restore
  original + Regenerate, Regenerate refines the baseline), the label table (two new
  labels, new Undo default), and the accessibility requirement (which statuses are
  visible, focus after Restore).

## Impact

- `libs/chat-shared`: `TextRefinementField`, `useTextRefinement`,
  `models/text-refinement.ts`, their tests, README. Follows the existing hook/field
  split (`libs/chat-shared/src/hooks/useTextRefinement.ts`,
  `libs/chat-shared/src/components/TextRefinementField/TextRefinementField.tsx`).
- Host libs — no API change; tests and READMEs that name "Undo" or the visible
  statuses: `libs/prompt-editor`, `libs/skill-editor`, `libs/scheduled-tasks`,
  `libs/toolset-editor`.
- `apps/chat`: `useTextRefinementLabels`, `TextRefinementI18nKeys`, `en.json`.
- Library isolation: unchanged. Libs still receive copy as label props with English
  defaults and the rewrite behavior as the host `onRefine` callback; no i18n,
  endpoint, or config knowledge enters a lib.
- Shared-lib scope: the change lives in `libs/chat-shared`, consumed by five forms;
  all of them change behavior together, which is the intent.

## Acceptance criteria

- In every refinable form, a pending field rejects typing, shows its text, and the
  action reads "Refining" with a spinner and is disabled.
- After a changed result, the row shows "Restore original" and "Regenerate" (no
  "Refine with AI"); Restore original restores the exact pre-refine draft and moves
  focus to "Refine with AI"; Regenerate calls `onRefine` with that draft.
- Manual edit after a result shows "Refine with AI" again with no Restore.
- "Text refined" / "Original text restored." are announced but not visible;
  "No changes were needed." and errors are visible.
- Lint, typecheck, and tests pass for `chat-shared`, `prompt-editor`,
  `skill-editor`, `scheduled-tasks`, `toolset-editor`, and `chat`;
  `npm run validate:docs` and `npm run validate:specs` pass.

## Rollback / compatibility

Non-breaking for hosts: no prop is removed or renamed, and new labels are optional.
Behavior changes for end users (read-only while pending, button set after a result).
Revert is a single revert of the change's commits; no data or API migration.
