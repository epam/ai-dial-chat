Slicing strategy: **risk-first, then vertical**. The one genuinely uncertain piece is the detector's boundary behaviour (what counts as a front-matter block vs. a Markdown horizontal rule), and everything else is wiring that depends on it. So slice 1 proves the detector in isolation with tests. Slice 2 makes the submit path unable to emit a two-block manifest — a complete, independently shippable fix even with no live feedback. Slices 3–4 add the live paste-time feedback through the library. Slice 5 covers docs and the closing verification.

## 1. Detector (risk-first)

- [x] 1.1 Add a pure exported `startsWithFrontmatterBlock(text: string): boolean` to `libs/chat-hooks/src/skill/skill.ts`, placed next to `parseSkillManifest` and reusing the same bare-`---` fence notion. Structural only — no `parseYaml` call (design D2). Returns `true` only when the first non-blank line is a bare `---` (trailing spaces/tabs allowed) **and** a later line is also a bare `---`. Normalize a leading BOM and CRLF the way `parseSkillManifestDocument` does. JSDoc must state why it is structural rather than YAML-based.
- [x] 1.2 Export it from `libs/chat-hooks/src/index.ts` and from `libs/chat-hooks/src/entry-points/skill-editor.ts` so both editor modes reach one implementation.
- [x] 1.3 Add unit tests to `libs/chat-hooks/src/skill/tests/skill.spec.ts` covering: a pasted `SKILL.md` (fence, `name`/`display_name`/`description`, closing fence, body) → `true`; leading blank lines before the fence → `true`; unparseable YAML inside the fences → `true`; a body starting with `# Heading` that contains a later `---` rule → `false`; an unclosed leading fence → `false`; a fence with trailing whitespace → `true`; an indented `  ---` first line → `false`; empty string → `false`; CRLF input → same result as LF.

**Verification:** `npm run test:file -- libs/chat-hooks/src/skill/tests/skill.spec.ts`

## 2. Submit-path guard (complete fix, no UI wiring yet)

- [x] 2.1 Add `instructionsFrontmatter: string` to `SkillEditorSubmitMessages` in `libs/chat-hooks/src/skill/useSkillEditorSubmit.ts`, documented in the same JSDoc style as the sibling message fields.
- [x] 2.2 In that hook's `handleSubmit`, after the existing required-field checks and before mode dispatch, set `errors.instructions = messages.instructionsFrontmatter` and return when `startsWithFrontmatterBlock(values.instructions)` — so the required-field message keeps precedence and the field renders at most one message (design D4). Applies to both create and edit mode, since the check sits above the `isEditMode` branch.
- [x] 2.3 Add `libs/chat-hooks/src/skill/tests/useSkillEditorSubmit.spec.ts` (new file; no dedicated spec exists today) covering: create mode with a pasted block → error set, `client.createSkill` never called; edit mode with a pasted block → error set, `client.updateSkill` never called, and the `frontmatterRef` object unchanged; a clean body → the built `skillManifest` contains exactly one `---` block at position 0; empty instructions → required-field message, not the front-matter message.
- [x] 2.4 Add the i18n key: `ErrorInstructionsFrontmatter = 'skillEditor.error.instructionsFrontmatter'` in the `skillEditor` enum block of `apps/chat/src/constants/translation-keys.ts` (next to the existing `skillEditor.error.*` entries), and the English string under `skillEditor.error` in `apps/chat/src/i18n/locales/en.json`. Copy must name where front matter belongs (the Name and Description fields above) and mention that uploading the `SKILL.md` through the upload dialog preserves fields like `display_name` — not a bare prohibition (design D1, D7).
- [x] 2.5 Resolve that key in `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` and pass it into the hook's `messages` object, alongside the existing message resolutions.

**Verification:** `npm run test:file -- libs/chat-hooks/src/skill/tests/useSkillEditorSubmit.spec.ts`, then `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`, then `npm run verify:changed` once for the slice.

## 3. Library: `onValuesChange`

- [x] 3.1 Add `onValuesChange?: (values: SkillEditorValues) => void` to `SkillEditorProps` in `libs/skill-editor/src/models/skill-editor-props.ts`, with JSDoc stating it fires on field edits only (not file-tree changes, not seeding) and that the library derives no meaning from the values.
- [x] 3.2 Invoke it from the three field `setValues` call sites in `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx` (Name ~`:465`, Description ~`:489`, Instructions ~`:525`), passing the complete next `SkillEditorValues`. Do **not** invoke it from the `initialValues` re-seed effect (~`:116`) — seeding is not a user edit (design D3). Do not add it to any dependency array that would re-run seeding.
- [x] 3.3 Architecture guard: confirm `libs/skill-editor/src/**` still imports no `yaml`, no `fflate`, no `react-i18next`/`i18next`, no `apps/chat/src/server-api`, no generated API client, no app context, no `react-router-dom`, and no env/feature-flag/analytics module; and that `libs/skill-editor/package.json` declares neither `yaml` nor `fflate` as a dependency or peer dependency. The new prop must carry only opaque strings outward.
- [x] 3.4 Add tests to `libs/skill-editor/src/components/SkillEditor/tests/SkillEditor.spec.tsx` using role/label/text queries: typing into Description calls `onValuesChange` with the full values object; re-seeding via a new `initialValues` identity does **not** call it; rendering without the prop behaves unchanged.

**Verification:** `npm run test:file -- libs/skill-editor/src/components/SkillEditor/tests/SkillEditor.spec.tsx`

## 4. Live feedback wiring

- [x] 4.1 Expose a live validation entry point from `useSkillEditorSubmit` — a stable `useCallback` (e.g. `handleValuesChange`) that sets `errors.instructions` to `messages.instructionsFrontmatter` when `startsWithFrontmatterBlock(values.instructions)` and clears **only that** message when it no longer matches, leaving any other `errors.instructions` value (the required-field message) and the other fields' errors untouched.
- [x] 4.2 Pass it as `onValuesChange` from `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` to `SkillEditor`, keeping the reference stable so the library's change handler does not re-subscribe (design D6).
- [x] 4.3 Accessibility: check whether the existing `ErrorText` slot under the Instructions editor (`libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:538-540`) is announced. If it is not, wrap that slot in an `aria-live="polite"` region inside the library — **not** `role="alert"`, which is reserved for the submit-error region and is too assertive for a message that can appear mid-typing. If it already is announced, record that in the task instead of adding markup.
  - **Finding:** already announced, so no markup was added. The kit's `CaptionText` (which `ErrorText` wraps) renders `role="alert"` unconditionally — see `node_modules/@epam/ai-dial-ui-kit/dist/components/New/CaptionText/CaptionText.js`. Note it is therefore *assertive*, not the `aria-live="polite"` design D6 would have preferred for a mid-typing message. Softening it is possible (the component spreads caller props onto the span, so `aria-live="polite"` would override the role's implicit assertive value), but it would leave the front-matter message announced differently from the required-field message in the same slot. Left as-is for consistency; recorded as follow-up 6.3.

- [x] 4.4 RTL check: the message renders in the existing error slot and adds no new layout, so no new directional classes should be needed. Verify with `dir="rtl"` on the container that the message aligns with the field and that no physical `ml-*`/`pl-*`/`left-*`/`text-left` class was introduced by any markup added in 4.3; use logical `ms-*`/`ps-*`/`start-*`/`text-start` if a class is needed. No icon is involved, so no mirroring applies.
- [x] 4.5 Add page-level tests to `apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`, queried by label/text: pasting a whole `SKILL.md` into Instructions shows the message before any submit and leaves the Name and Description field values as the user typed them; removing the block clears the message and lets a submit through; a `SKILL.md` imported through the upload dialog seeds Instructions without triggering the message.

- [x] 4.6 **Added during apply, not in the original plan.** Design D3 deferred the already-corrupt-skill case to "the submit guard plus the first keystroke", but the `skill-editing` delta spec's scenario requires the error to render *on opening* such a skill. Run the check once per loaded skill from `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` — in the host, after the load resolves, so the library still stays silent while seeding and its contract is unchanged. Covered by two edit-mode page tests (a well-formed stored skill shows no message; an already-corrupt one shows it and cannot be saved), the second verified by inversion (disabling the check fails it).

**Verification:** `npm run test:file -- apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`, then `npm run verify:changed` once for the slice.

## 5. Docs and close-out

- [x] 5.1 Document `onValuesChange` in `libs/skill-editor/README.md`'s prop coverage, matching the existing entries' shape and the real signature.
- [x] 5.2 Document the new exported `startsWithFrontmatterBlock` helper in `libs/chat-hooks/README.md`, with a minimal correct example importing it from `@epam/ai-dial-chat-hooks`.
- [x] 5.3 Run `npm run validate:docs`.
- [x] 5.4 Close the change with exactly one `npm run verify:full`.

## 6. Follow-ups (out of scope here — do not implement in this change)

- [x] 6.1 Record as a follow-up: a BFF-side guard in `SkillsPackageService.validateAndBuildFormData` rejecting a `skillManifest` whose body opens with a second fence, as defence in depth against non-editor callers (design Non-Goals, Open Questions).
- [x] 6.2 Record as a follow-up: nothing repairs skills already stored with two front-matter blocks; they surface the error only when opened for editing.
- [x] 6.3 Record as a follow-up: every inline field error in the Skill Editor is announced assertively, because the kit's `CaptionText`/`ErrorText` hardcodes `role="alert"`. A message that can appear while the user is still typing would be better as `aria-live="polite"`. Changing it for one field only would be inconsistent, so it belongs in a pass over the editor's (or the kit's) error presentation.
