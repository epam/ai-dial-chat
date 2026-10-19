# Tasks

Slicing strategy: vertical, risk-first. The lib behaviour (drag, clamp, RTL, a11y) is the riskiest part, so it is proven in `builder-form` before the app wires and persists it. Read `libs/builder-form/README.md` and `.claude/rules/libs.md` first; keep relative imports extensionless.

## 1. Clamp utility and lib models

- [x] 1.1 Add `clampLeftColumnWidth` and the default constants (280/640/360, default 400, key step 16) in `libs/builder-form/src/utils/` with tests in `libs/builder-form/src/utils/tests/`.
- [x] 1.2 Extend `libs/builder-form/src/models/editor-layout-props.ts` with `resizableLeftColumn`, `labels.resizeHandleLabel`, `labels.resizeHandleTooltip` (JSDoc, English defaults), and forward the same props in `libs/builder-form/src/models/entity-editor-props.ts`.

**Verification:** `npm run test:file -- libs/builder-form/src/utils/tests/<clamp spec>`

## 2. ResizeHandle and EditorLayout integration

- [x] 2.1 Create the internal `libs/builder-form/src/components/EditorLayout/ResizeHandle.tsx` (separator semantics, pointer capture, rAF-coalesced moves, keyboard, double-click reset, 1 s hover delay and tooltip, logical properties, RTL delta and key mirroring).
- [x] 2.2 Update `EditorLayout.tsx` and `EditorLayout.module.scss` to use `--el-left-width` at `desktop` only, render the handle only with a center column, re-clamp with `ResizeObserver`, and keep the unchanged default path. Forward props from `EntityEditor.tsx`.
- [x] 2.3 Add tests in `libs/builder-form/src/components/EditorLayout/tests/` and `libs/builder-form/src/components/EntityEditor/tests/`: separator ARIA attributes, drag clamps at min/max, keyboard steps and Home/End, `dir="rtl"` mirroring, double-click reset, no handle without the prop or without `centerContent`.
- [x] 2.4 Architecture guard: confirm `libs/builder-form/src/**` contains no i18n, storage, routing or app imports (the host-isolation rule in `AGENTS.md`).

**Verification:** `npm run test:file -- libs/builder-form/src/components/EditorLayout/tests/EditorLayout.spec.tsx` and the `EntityEditor` spec; then `npm run verify:changed`.

## 3. App wiring and i18n

- [x] 3.1 Add `ResizeHandleTooltip` and `ResizeHandleAriaLabel` to `EditorI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and the strings to `apps/chat/src/i18n/locales/en.json` ("Drag to resize"; aria-label for the Metadata/Setup divider).
- [x] 3.2 In `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`, own the width with `useLocalStorage`, sanitise non-finite values, and pass `resizableLeftColumn` and the labels to `EntityEditor`.
- [x] 3.3 Add tests to `apps/chat/src/pages/ApplicationEditor/tests/ApplicationEditorPage.spec.tsx`: width restored from storage, corrupt value falls back to 400, resizing does not change the create/update payload.

**Verification:** `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/ApplicationEditorPage.spec.tsx`

## 4. RTL and accessibility check

- [x] 4.1 Confirm RTL: physical classes are absent from the handle and column, the drag delta and arrow keys are mirrored, and the divider sits on the correct edge in `ar` (covered by the 2.3 RTL tests; review `.claude/rules/rtl.md` and `.claude/rules/a11y.md`).

## 5. Docs and closure

- [x] 5.1 Update `libs/builder-form/README.md` (new props with a type-correct example, and the public class names table if a `dial-*` class is added to `BUILDER_FORM_CLASS`), then run `npm run validate:docs`. Update `docs/architecture.md` only if it describes the editor layout.
- [ ] 5.2 Run `npm run validate:specs`, then exactly one `npm run verify:full` to close the change (add `npm run build:quiet` since the lib stylesheet changes).
