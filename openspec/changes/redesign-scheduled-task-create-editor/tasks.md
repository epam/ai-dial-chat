## 1. Discovery

- [x] 1.1 Call ui-kit MCP `getEntityDetails("component", "DialMarkdownEditor")` and confirm its prop API (value/onChange binding, height/sizing props, label/aria support); check `CHANGELOG.md`/migration guides under `node_modules/@epam/ai-dial-ui-kit/dist/` if the installed version differs from assumptions.
- [x] 1.2 Check whether `apps/chat/src/main.tsx` (or another entry file) already imports `@uiw/react-markdown-preview/markdown.css` / `@uiw/react-md-editor/markdown-editor.css` to avoid a duplicate import.

## 2. Lib: model and props

- [x] 2.1 In `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`, add `detailsSectionTitle`, `detailsSectionSubtitle`, `configurationSectionTitle`, `configurationSectionSubtitle`, `instructionsLabel` to `ScheduledTaskCreateFormLabels`; remove `promptLabel`.
- [x] 2.2 Add `onBack: () => void` to `ScheduledTaskCreateFormProps`.
- [x] 2.3 Update JSDoc on all new/changed fields per `libs.md` conventions.

## 3. Lib: layout and markdown editor

- [x] 3.1 Restructure `ScheduledTaskCreateForm.tsx`: header row with back control (chevron, `rtl:scale-x-[-1]`, calls `onBack`) + title on the start side, Cancel + Save on the end side.
- [x] 3.2 Build the two-column body with a CSS Grid using `mobile`/`desktop` breakpoints only (no `sm:`/`md:`/`lg:`/`xl:`); Details column narrower, Configuration column wider on desktop; full-width stacked on mobile, Details first.
- [x] 3.3 Move Display name, Description, the schedule fieldset (unchanged internals), and Model dropdown into the Details column under `labels.detailsSectionTitle` / `detailsSectionSubtitle`.
- [x] 3.4 Replace the prompt `Textarea` with `DialMarkdownEditor` bound to `values.prompt` via `onFieldChange('prompt', value)`, labeled via `labels.instructionsLabel`, placed in the Configuration column under `labels.configurationSectionTitle` / `configurationSectionSubtitle`.
- [x] 3.5 Keep the Save-button required-field guard logic (`displayName`, `modelId`, `prompt`, `isSubmitting`) unchanged; relabel the primary action's text prop usage from Create to Save at the call site in the app (label content, not prop name).
- [x] 3.6 Ensure focus-visible styling on back control, Cancel, and Save matches hover per `.claude/rules/a11y.md`.

## 4. Lib: tests

- [x] 4.1 Update `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx`: two-column regions render under the right headings, back control calls `onBack` without calling `onSubmit`, Save disabled rules unchanged, markdown editor receives and updates `values.prompt`.
- [x] 4.2 Run `npm exec nx test @epam/ai-dial-scheduled-tasks` and `npm exec nx lint @epam/ai-dial-scheduled-tasks`.

## 5. App: i18n

- [x] 5.1 In `apps/chat/src/i18n/locales/en.json`, add `scheduledTasks.create.detailsSectionTitle`, `detailsSectionSubtitle`, `configurationSectionTitle`, `configurationSectionSubtitle`, `instructionsLabel`; remove `scheduledTasks.create.promptLabel`.
- [x] 5.2 Add matching enum members to `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts` (or equivalent); remove the old prompt-label key.
- [x] 5.3 Confirm `ButtonsI18nKeys.Save` exists (add if missing) and is reused for the Save action instead of a feature-scoped label.

## 6. App: page wiring

- [x] 6.1 In `ScheduledTaskCreatePage`, add an `onBack` handler that navigates to `returnUrl` identically to the existing Cancel handler; pass it to `ScheduledTaskCreateForm`.
- [x] 6.2 Update the labels object passed to `ScheduledTaskCreateForm` with the new section/instructions keys and `ButtonsI18nKeys.Save`.
- [x] 6.3 Add the `DialMarkdownEditor` CSS imports to the app entry file, only if not already present (per task 1.2).

## 7. App: tests

- [x] 7.1 Update `ScheduledTaskCreatePage.spec.tsx` for `onBack` wiring and any label changes, if needed.
- [x] 7.2 Run `npm exec nx test chat` and `npm exec nx lint chat`.

## 8. Manual verification

- [ ] 8.1 Run the app (`npm start` + `npm run start:api`) and open `/scheduled-tasks/new`: verify desktop two-column layout and mobile stacked layout.
- [ ] 8.2 Verify RTL: back chevron mirrors, layout mirrors with no broken offsets.
- [ ] 8.3 Verify the markdown editor toolbar works and typing updates `prompt`.
- [ ] 8.4 Verify Save still POSTs `{ displayName, description?, trigger, model, prompt, stream? }` unchanged, and Cancel/back both navigate to `returnUrl` without a network call.
- [ ] 8.5 Verify the Schedule section behaves identically to before (once/recurring, frequency, time, day fields, validation).
