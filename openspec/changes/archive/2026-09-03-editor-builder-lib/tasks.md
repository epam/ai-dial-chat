## 1. Scaffold libs/editor-builder

- [x] 1.1 Generate the Nx library: `npm exec nx g @nx/react:library editor-builder --directory=libs/editor-builder --unitTestRunner=vitest --bundler=vite --importPath=@epam/ai-dial-editor-builder --style=scss --no-interactive`
- [x] 1.2 Update `libs/editor-builder/package.json` — set `name`, `description`, `license: "Apache-2.0"`, `private: true`, `type: "module"`, `main`/`module`/`types`/`exports` (copy shape from `libs/skill-editor/package.json`), and peer dependencies: `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@tabler/icons-react`
- [x] 1.3 Update `libs/editor-builder/tsconfig.json` and `tsconfig.lib.json` to mirror `libs/skill-editor`'s TypeScript config (path aliases, strict mode, `moduleResolution: "bundler"`, `module: "esnext"`)
- [x] 1.4 Update `libs/editor-builder/tailwind.config.js` and `postcss.config.js` to mirror `libs/skill-editor`'s configuration
- [x] 1.5 Create `libs/editor-builder/src/index.ts` — empty barrel, will be filled in task 3

## 2. Implement EditorSection component

- [x] 2.1 Create `libs/editor-builder/src/models/editor-section-props.ts` — define `EditorSectionColors`, `EditorSectionStyles`, `EditorSectionProps` interfaces with JSDoc on every field
- [x] 2.2 Create `libs/editor-builder/src/components/EditorSection/EditorSection.module.scss` — define CSS custom properties for `--es-border-color`, `--es-title-color`
- [x] 2.3 Implement `libs/editor-builder/src/components/EditorSection/EditorSection.tsx` — bordered card wrapper rendering optional `title` heading and `children`; accept `styles?: EditorSectionStyles` processed via `buildCssVars`; use logical Tailwind utilities (`ps-*`, `pe-*`, `border-s-*`, etc.); no state, no interaction
- [x] 2.4 Export `EditorSection`, `EditorSectionProps`, `EditorSectionStyles` from `src/index.ts`

## 3. Implement EditorLayout component

- [x] 3.1 Create `libs/editor-builder/src/models/editor-layout-props.ts` — define `EditorLayoutLabels` (savingStatusLabel?), `EditorLayoutColors`, `EditorLayoutTypography`, `EditorLayoutStyles`, `EditorLayoutProps` interfaces with JSDoc on every field and defaults noted
- [x] 3.2 Create `libs/editor-builder/src/components/EditorLayout/EditorLayout.module.scss` — define CSS custom properties (`--el-header-border-color`, `--el-sidebar-border-color`) following the `buildCssVars` pattern from other libs
- [x] 3.3 Implement `libs/editor-builder/src/components/EditorLayout/EditorLayout.tsx`:
  - Header row: `GhostIconButton` with `IconArrowLeft` (`aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`, `rtl:scale-x-[-1]`) + `aria-label={backAriaLabel}` + calls `onBack`; title rendered as `<h1>`; `actions` slot inline-end; `role="status"` aria-live polite SR-only region for `isSaving`
  - Body: desktop two-column flex row — left `w-[360px] shrink-0 border-e`, right `flex-1`; mobile single stacked column; both panels `overflow-y-auto`; when `rightContent` absent, left fills full width
  - All directional spacing via logical Tailwind utilities; no `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` classes
  - Apply `buildCssVars` from `styles` prop to root element
- [x] 3.4 Export `EditorLayout`, `EditorLayoutProps`, `EditorLayoutLabels`, `EditorLayoutStyles` from `src/index.ts`
- [x] 3.5 Verify `libs/editor-builder` passes `npm exec nx lint editor-builder` and `npm exec nx build editor-builder`

## 4. Write libs/editor-builder README and update docs/architecture.md

- [x] 4.1 Write `libs/editor-builder/README.md` — H1 package name, Overview, Installation, Peer Dependencies, EditorLayout usage example, EditorSection usage example; all prop names and types match the implemented API exactly
- [x] 4.2 Update `docs/architecture.md` — add `libs/editor-builder` to the libraries table
- [x] 4.3 Run `npm run validate:docs` and fix any errors

## 5. Migrate libs/prompt-editor to EditorLayout

- [x] 5.1 Add `@epam/ai-dial-editor-builder` to `libs/prompt-editor/package.json` peer dependencies; remove `@epam/ai-dial-builder-form`
- [x] 5.2 Update `libs/prompt-editor/src/models/prompt-editor-props.ts` — rename `labels.backButtonLabel` to `labels.backButtonAriaLabel`; update JSDoc; update `PromptEditorLabels` export in `src/index.ts` if needed
- [x] 5.3 Update `libs/prompt-editor/src/components/PromptEditor/PromptEditor.tsx` — replace `BuilderFormContainer` with `EditorLayout`: pass `onBack`, `backAriaLabel={labels?.backButtonAriaLabel}`, `title` (resolved create/edit title), `leftContent` (the flat form fields), `actions` (Cancel + Save buttons), `isSaving`; remove `BuilderFormContainer` import
- [x] 5.4 Update `libs/prompt-editor/README.md` — update the usage example to reflect `backButtonAriaLabel` rename and `EditorLayout`-based shell; run `npm run validate:docs`
- [ ] 5.5 Verify `npm exec nx lint prompt-editor` and `npm exec nx build prompt-editor` pass

## 6. Migrate libs/skill-editor to EditorLayout

- [x] 6.1 Add `@epam/ai-dial-editor-builder` to `libs/skill-editor/package.json` peer dependencies
- [x] 6.2 Update `libs/skill-editor/src/models/skill-editor-props.ts` — remove `headerContent?: ReactNode`; add `onBack: () => void`, `backAriaLabel?: string`, `title: string` to `SkillEditorProps`; update JSDoc
- [x] 6.3 Update `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx` — replace the custom `hidden…desktop:flex` header `div` and the inner flex-row body `div` with `EditorLayout`; pass `leftContent={filesPaneContent}`, `rightContent={mainPaneContent}`, `actions`, `isSaving={isSubmitting}`, `onBack`, `backAriaLabel`, `title`; keep the mobile `Accordion` inside `leftContent`
- [x] 6.4 Update `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` — remove the `headerRow` JSX variable and the `headerContent={headerRow}` prop; add `onBack={handleCancel}`, `backAriaLabel={t(SkillEditorI18nKeys.BackAriaLabel)}`, `title` prop to `<SkillEditorForm>` call; add any needed i18n keys
- [x] 6.5 Update `libs/skill-editor/README.md` — document `onBack`/`backAriaLabel`/`title` as replacements for `headerContent`; run `npm run validate:docs`
- [ ] 6.6 Verify `npm exec nx lint skill-editor` and `npm exec nx build skill-editor` pass; verify `npm exec nx lint chat` and `npm exec nx typecheck chat` pass

## 7. Rewrite ToolsetEditor page with flat two-column layout

- [x] 7.1 Delete `apps/chat/src/pages/ToolsetEditor/ToolsetEditorHeader.tsx` and `apps/chat/src/pages/ToolsetEditor/ToolsetEditorView.tsx`
- [x] 7.2 Remove `ToolsetEditorSteps` enum and `ToolsetEditorQuery.Step` param from `apps/chat/src/constants/toolsets.ts`; remove all `step` / `handleNext` / `handleChangeStep` / `setEditorStep` / `persistFormIfChanged` / `draftToolsetId` state and logic from `ToolsetEditor.tsx`
- [x] 7.3 Rewrite `apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx` — use `EditorLayout` from `@epam/ai-dial-editor-builder`; `leftContent` = `<EditorSection title={t(ToolsetEditorI18nKeys.MetadataSectionTitle)}>` wrapping the Metadata fields (avatar URL, GeneralForm name/version/description/locales/tags); `rightContent` = `<EditorSection title={t(ToolsetEditorI18nKeys.SetupSectionTitle)}>` wrapping the Setup fields (SettingsForm endpoint/protocol/tools + AuthSection + Connect toolset section); `actions` = Cancel + Save buttons; header `onBack={handleCancel}`, `title` resolved from i18n
- [x] 7.4 Move GeneralForm fields into `leftContent` and SettingsForm + AuthSection into `rightContent`; ensure `Connect toolset` section only renders in edit mode and with `dialCoreExternalUrl`
- [x] 7.5 Remove all step-related translation keys from `ToolsetEditorI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`; add new keys: `MetadataSectionTitle`, `SetupSectionTitle`, `BackAriaLabel` and any header title keys
- [x] 7.6 Update `apps/chat/src/i18n/locales/en.json` — add new toolset editor keys, remove deleted step keys

## 8. Clean up and verify

- [x] 8.1 Delete `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx` if it was a copy left from the wizard (check — do not delete if it is the real Custom App editor)
- [ ] 8.2 Run `npm exec nx lint chat` — fix any unused-import or broken-reference lint errors
- [ ] 8.3 Run `npm exec nx typecheck chat` — fix any TypeScript errors
- [ ] 8.4 Run `npm exec nx test chat` — fix any failing tests in ToolsetEditor tests directory
- [ ] 8.5 Run `npm exec nx affected --target=lint --base=origin/development` and `npm exec nx affected --target=build --base=origin/development` to confirm no regressions in dependent projects
- [ ] 8.6 Run `npm run validate:docs` — fix any README or architecture doc issues
