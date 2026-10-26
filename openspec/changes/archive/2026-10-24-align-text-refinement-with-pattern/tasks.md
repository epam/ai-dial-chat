Slicing strategy: vertical. Slice 1 builds the whole behavior in the shared hook and
field and proves it with their own tests; slice 2 wires the app copy; slice 3 brings
every host lib's tests and docs in line; slice 4 updates the canonical spec docs and
closes. No host lib needs a code change (labels pass through as `TextRefinementLabels`).

## 1. Shared hook and field (`libs/chat-shared`)

- [x] 1.1 Add `refineRefiningLabel` ("Refining") and `refineRegenerateLabel` ("Regenerate") to `TextRefinementLabels` in `libs/chat-shared/src/models/text-refinement.ts`, and change the `refineUndoLabel` doc default to "Restore original" (inline JSDoc, defaults quoted verbatim).
  - Verification: `npm exec nx run @epam/ai-dial-chat-shared:typecheck`
- [x] 1.2 In `libs/chat-shared/src/hooks/useTextRefinement.ts`, make `refine()` send `baseline ?? snapshot` to `onRefine` while keeping the staleness and unchanged checks on the snapshot (design D3).
  - Verification: `npm run test:file -- libs/chat-shared/src/hooks/tests/useTextRefinement.spec.ts`
- [x] 1.3 Add hook tests in `libs/chat-shared/src/hooks/tests/useTextRefinement.spec.ts`: Regenerate after A→B calls `onRefine` with A; a C result replaces B and Undo still restores A; a failing Regenerate keeps B and the baseline; a first refine after a manual edit sends the edited text.
  - Verification: `npm run test:file -- libs/chat-shared/src/hooks/tests/useTextRefinement.spec.ts`
- [x] 1.4 In `libs/chat-shared/src/components/TextRefinementField/TextRefinementField.tsx`: one primary `GhostButton` whose label/icon follow design D2 (Refine with AI / Refining + spinner / Regenerate); Restore original (`IconRestore`, `aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`, `DIAL_ICON_SIZE.SM`) rendered before it only while `canUndo && !isPending`; drop the separate trailing Undo button.
  - Verification: `npm run test:file -- libs/chat-shared/src/components/TextRefinementField/tests/TextRefinementField.spec.tsx`
- [x] 1.5 In the same component, make the control read-only while pending: a layout effect scoped to the wrapper finds `#${CSS.escape(fieldId)}`, records `readOnly`, sets it `true`, and restores the recorded value in cleanup (design D1).
  - Verification: same spec file as 1.4
- [x] 1.6 Move focus to the primary action after Restore original via a ref consumed in a layout effect, replacing the synchronous `querySelector('button').focus()` (design D4).
  - Verification: same spec file as 1.4
- [x] 1.7 Make Pending, Success, and Restored status text `sr-only`, keep Unchanged visible, keep the live region mounted (design D5).
  - Verification: same spec file as 1.4
- [x] 1.8 Update `libs/chat-shared/src/components/TextRefinementField/tests/TextRefinementField.spec.tsx` (role/name queries only): pending control is read-only and the action is a disabled "Refining" button; read-only is lifted on success, error, and abort; result row has "Restore original" and "Regenerate" and no "Refine with AI"; Restore original restores and focuses "Refine with AI"; "Text refined" is in the status region but `sr-only`; "No changes were needed." is visible; a control the host already made read-only stays read-only after the request.
  - Verification: `npm run test:file -- libs/chat-shared/src/components/TextRefinementField/tests/TextRefinementField.spec.tsx`
- [x] 1.9 RTL check: the new row uses only logical utilities (`ms-auto`, `gap-*`); `IconRestore` and `IconSparkles` are not mirrored (neither expresses reading direction).
  - Verification: code review of the changed JSX; covered by 1.8 rendering
- [x] 1.10 Architecture guard: confirm `libs/chat-shared` gains no i18n, endpoint, client, config, or navigation knowledge — copy arrives as label props, rewriting as the host `onRefine` callback.
  - Verification: `npm exec nx run @epam/ai-dial-chat-shared:lint`
- [x] 1.11 Slice check: `npm run verify:changed` — run 2026-10-24: affected typecheck passed for 29 projects (the script then failed only on an Nx cache file lock, os error 32, from other Nx processes on the machine); lint ran via ESLint on the 12 changed TS files; changed specs ran via Vitest per project

## 2. App copy (`apps/chat`)

- [x] 2.1 Add i18n keys to `apps/chat/src/i18n/locales/en.json`: `textRefinement.refining` = "Refining", `textRefinement.regenerate` = "Regenerate"; change `textRefinement.undo` to "Restore original".
  - Verification: `npm exec nx run chat:typecheck`
- [x] 2.2 Add `Refining` and `Regenerate` to `TextRefinementI18nKeys` in `apps/chat/src/constants/translation-keys.ts`, and map them to `refineRefiningLabel` / `refineRegenerateLabel` in `apps/chat/src/hooks/useTextRefinementLabels.ts`.
  - Verification: `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditorRefinement.spec.tsx`
- [x] 2.3 Slice check: `npm run verify:changed` — run 2026-10-24: affected typecheck passed for 29 projects (the script then failed only on an Nx cache file lock, os error 32, from other Nx processes on the machine); lint ran via ESLint on the 12 changed TS files; changed specs ran via Vitest per project

## 3. Host libs follow the new behavior (tests and READMEs only)

- [x] 3.1 Update assertions that name "Undo" or expect visible "Text refined"/"Original text restored." in `libs/skill-editor/src/components/SkillEditor/tests/SkillEditorRefinement.spec.tsx`.
  - Verification: `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditorRefinement.spec.tsx`
- [x] 3.2 Same for `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskRefinement.spec.tsx`; add one case that a pending Instructions or Description control is read-only.
  - Verification: `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskRefinement.spec.tsx`
- [x] 3.3 Same for `libs/prompt-editor/src/components/PromptEditor/tests/PromptEditor.spec.tsx`.
  - Verification: `npm run test:file -- libs/prompt-editor/src/components/PromptEditor/tests/PromptEditor.spec.tsx`
- [x] 3.4 Same for `libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx`.
  - Verification: `npm run test:file -- libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx`
- [x] 3.5 Update refinement prose and label tables in `libs/chat-shared/README.md`, `libs/prompt-editor/README.md`, `libs/skill-editor/README.md`, `libs/scheduled-tasks/README.md` (Restore original / Regenerate / Refining, read-only while pending, the two new labels).
  - Verification: `npm run validate:docs`
- [x] 3.6 Slice check: `npm run verify:changed` — run 2026-10-24: affected typecheck passed for 29 projects (the script then failed only on an Nx cache file lock, os error 32, from other Nx processes on the machine); lint ran via ESLint on the 12 changed TS files; changed specs ran via Vitest per project

## 4. Specs and close

- [x] 4.1 Check `openspec/specs/prompt-editor/spec.md`, `openspec/specs/skill-editor-library/spec.md`, and `openspec/specs/scheduled-task-create-form/spec.md` for text that says the refining field stays editable or names "Undo" as the button label; if any does, add a delta for it under this change.
  - Verification: `npm run validate:specs`
- [ ] 4.2 `npm run verify:full`

## 5. Follow-ups (out of scope)

- [ ] 5.1 Open a separate change for Name-field refinement (new API purpose(s), host callbacks in each form).
