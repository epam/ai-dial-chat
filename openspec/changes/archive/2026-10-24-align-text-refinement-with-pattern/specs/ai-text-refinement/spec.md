## MODIFIED Requirements

### Requirement: Safe pending and submission behavior

The action SHALL be disabled for empty/whitespace-only text, while either field in the same form is refining, and while the form is loading/submitting or otherwise unavailable for editing. While a field refines, `TextRefinementField` SHALL make that field's control (the element whose `id` equals `fieldId`) read-only, so its original text stays visible and cannot be typed over, and SHALL restore the control's previous read-only state when the request settles, is aborted, or the field unmounts. The other field in the same form SHALL remain editable. Any edit that still reaches the active field during refinement (for example a Markdown toolbar action) SHALL immediately abort and invalidate its request, so a late result cannot overwrite the edit. This supersedes the 2026-09-24 decision to keep the refining field editable. While pending, the active action SHALL show a spinner in place of its sparkle icon, its visible label and accessible name SHALL read `refineRefiningLabel` ("Refining"), and it SHALL stay disabled until the response returns. Save SHALL be disabled and its handler SHALL reject submission during refinement; Cancel and Back SHALL remain available.

#### Scenario: Empty input and duplicate activation
- **WHEN** a field contains only whitespace or a refine is pending
- **THEN** activating its disabled action does not call a callback
- **AND** rapid repeated activation starts at most one request for the form

#### Scenario: Pending controls
- **WHEN** Instructions refinement is in progress
- **THEN** the Instructions control is read-only and shows the text that was sent, its action reads "Refining" with a spinner and is disabled, and the Description Refine action and Save are disabled; Description remains editable
- **AND** a toolbar edit in Instructions cancels its request without being overwritten
- **AND** no save request can be dispatched through keyboard/form submission

#### Scenario: Read-only ends with the request
- **WHEN** the pending request succeeds, fails, or is aborted
- **THEN** the control is editable again exactly as before the request

### Requirement: Replacement and recoverable Undo

A changed successful result SHALL replace only its originating field through the established value-change channel. While a refinement baseline exists, the action row SHALL show the Undo action, labelled `refineUndoLabel` ("Restore original") with a restore icon, followed by a Regenerate action labelled `refineRegenerateLabel` ("Regenerate") with the sparkle icon, and SHALL NOT show the Refine with AI action. The baseline SHALL be the exact original text before the first successful refinement since the last manual edit/reset. Regenerate SHALL call the host callback with that baseline, not with the current refined text, so each result is a fresh variant of the author's draft; repeated Regenerate SHALL retain the baseline. Manual editing SHALL clear the baseline only for the edited field and return it to the Ready state (Refine with AI, no Restore original). Restore original SHALL restore the baseline exactly and clear that field's refinement feedback/baseline. A result identical to the current value SHALL not create a new write or Undo baseline and SHALL announce that no changes were needed. Refinement SHALL never automatically save, execute, or persist the draft. The baseline and the regenerate source are owned by `useTextRefinement` in `libs/chat-shared/src/hooks/useTextRefinement.ts`.

#### Scenario: Success and Restore original
- **WHEN** refinement changes text A to B and the author activates Restore original
- **THEN** A is restored through the same field update channel, including its whitespace and Markdown
- **AND** the row shows Refine with AI again, and the normal form save/dirty behavior remains in effect

#### Scenario: Result row
- **WHEN** a refinement has replaced the text
- **THEN** the row shows Restore original and Regenerate, and no Refine with AI action

#### Scenario: Regenerate refines the original draft
- **WHEN** A became B and the author activates Regenerate
- **THEN** the host callback receives A, and a changed result C replaces B
- **AND** Restore original still restores A, and a failure on that attempt preserves B and the ability to restore A

#### Scenario: Manual edit returns to Ready
- **WHEN** the author manually edits a refined field
- **THEN** Restore original and Regenerate disappear and Refine with AI returns, without changing the edited text or another field's baseline

#### Scenario: Unchanged output
- **WHEN** the callback returns the exact current value
- **THEN** the form announces no change, creates no new value update, and preserves any pre-existing baseline

### Requirement: Optional labels and themed feedback

Both form labels interfaces SHALL add the optional properties below with English defaults. Existing required task labels SHALL remain required and existing consumers SHALL not need to supply new ones. The app SHALL supply translations through its existing i18n layer (`useTextRefinementLabels` in `apps/chat/src/hooks/useTextRefinementLabels.ts`, keys in `TextRefinementI18nKeys`); libraries SHALL not import i18n.

| Label property | English default | App key |
| --- | --- | --- |
| `refineWithAiLabel` | Refine with AI | `textRefinement.action` |
| `refineRefiningLabel` | Refining | `textRefinement.refining` |
| `refineRegenerateLabel` | Regenerate | `textRefinement.regenerate` |
| `refineUndoLabel` | Restore original | `textRefinement.undo` |
| `refineErrorLabel` | Could not refine this text. Please try again. | `textRefinement.error` |
| `refinePendingAriaLabel` | Refining text | `textRefinement.pending` |
| `refineSuccessAriaLabel` | Text refined | `textRefinement.success` |
| `refineUndoAriaLabel` | Original text restored. | `textRefinement.restored` |
| `refineUnchangedAriaLabel` | No changes were needed. | `textRefinement.unchanged` |

Both libraries SHALL offer optional `colors.refineActionText` (the visible refinement status text color — the no-change status; unset, it keeps the kit `CaptionText` color `--text-secondary`), `colors.refineErrorText` (the refinement error color, default `--text-error`), and `typography.refineFeedbackClassName`. There is no `typography.refineActionClassName`: the Refine with AI, Restore original, and Regenerate buttons are kit `GhostButton`s and keep kit styling. Color overrides SHALL use `buildCssVars`, `--se-refine-*` / `--stcf-refine-*`, and `var(--lib-property, var(--theme-token, #hex))` fallback chains. `TextRefinementField` SHALL accept an optional `caption` (e.g. a character counter) rendered at the inline end of the same row as the status, with the status at the inline start, so neither shifts the layout when the other appears; the caption also renders when refinement is disabled. Without overrides the status SHALL render with the kit `CaptionText` styling (`dial-tiny-text`, `--text-secondary`) so it matches input captions everywhere. Default/fallback error colors SHALL meet 7:1 contrast against the rendered fallback background. New public styling hooks SHALL follow each library's existing constant/export convention.

#### Scenario: Existing label object remains valid
- **WHEN** an existing host supplies its old labels and the new callbacks
- **THEN** refinement uses the English defaults for the new labels and existing form labels remain intact
- **AND** supplied translated labels take effect on Refine with AI, Refining, Restore original, and Regenerate, and color/typography overrides take effect on the refinement feedback and error text

### Requirement: Accessible mobile and RTL interaction

Every refinement action SHALL be a keyboard-operable button with a separate associated field label; Refine with AI, Refining, and Regenerate SHALL be one button element whose label changes with the state, so focus stays on it across Ready → Refining → Result. The pending field region SHALL have `aria-busy`. Pending/success/restore/no-change feedback SHALL use one polite live status region that stays mounted; the pending, success, and restore messages SHALL be visually hidden (the action row already shows those states) and the no-change message SHALL stay visible. Inline errors SHALL use `role="alert"` and field association. After Restore original, focus SHALL move to the Refine with AI action, since the activated button unmounts. Decorative sparkle/restore/spinner icons SHALL be `aria-hidden`; Tabler outlines SHALL use `stroke={DIAL_KIT_ICON_STROKE}`.

Layout SHALL use logical properties and named `mobile`/`desktop` breakpoints, wrap label/action content without horizontal overflow at 360px, and provide at least 44x44 CSS-pixel hit areas. RTL SHALL inherit direction without library locale lookup; end alignment SHALL flip; the sparkle and restore icons SHALL not flip (neither expresses a reading direction). Hidden focusable UI SHALL be unmounted or inert. The interaction SHALL meet WCAG 2.1 AAA requirements.

#### Scenario: Assistive technology tracks refinement
- **WHEN** a keyboard user activates Refine with AI and receives success or failure
- **THEN** focus stays on the action while it reads "Refining", field busy state and completion/error are announced, and Restore original and Regenerate are keyboard reachable after success

#### Scenario: Focus after Restore original
- **WHEN** a keyboard user activates Restore original
- **THEN** the original text is restored, "Original text restored." is announced, and focus lands on Refine with AI

#### Scenario: Narrow Arabic layout
- **WHEN** the form is rendered at 360px with an RTL ancestor and translated labels
- **THEN** label/actions wrap without overflow, logical end alignment mirrors, and text/buttons remain readable and reachable without hover
