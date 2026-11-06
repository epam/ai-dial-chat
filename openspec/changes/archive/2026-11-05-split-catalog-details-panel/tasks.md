Branch: `chore/enable-chat-app-typecheck`. Per-slice check: `npx vitest run src/components/Details` in `libs/catalog`, with both specs unedited, and ESLint on the touched files.

## 1. Baseline

- [x] 1.1 Record the baseline: `DetailsPanel.tsx` 1472 lines, `Header.tsx` 1212, `DetailsPanel.spec.tsx` 151 `it`, `Header.spec.tsx` 143 `it`, and 462 tests in 13 files under `src/components/Details`.

## 2. DetailsPanel

- [x] 2.1 Move the constants and helpers to `src/utils/details-panel.ts`, and the interfaces to `src/models/details-panel.ts`.
- [x] 2.2 Extract `hooks/useDetailsContentFile.ts`.
- [x] 2.3 Extract `hooks/useDetailsPublish.ts`, keeping the effect order (design D2).
- [x] 2.4 Extract `hooks/useDetailsConfirmation.tsx`.
- [x] 2.5 Extract `DetailsTabs.tsx`. To reach the size target, the `PublishPanel` body also moved to `DetailsPublishContent.tsx`, and the color-to-CSS-var map moved to `getDetailsPanelCssVars` in `src/utils/details-panel.ts`. The `Details` specs: 462 of 462 pass.

## 3. Header

- [x] 3.1 Extract `LimitStatusBadge.tsx` and `hooks/useRecipientsCount.ts`.
- [x] 3.2 Extract `resolveHeaderActionVisibility` to `src/utils/details-header-actions.ts`.
- [x] 3.3 Extract `hooks/useManageActions.tsx`, with `ManageAction` going to `src/models/details-header.ts`.
- [x] 3.4 Extract `HeaderCredentialsButton.tsx` (design D4) and `HeaderManageSlot.tsx`. `HeaderProps` moved to `src/models/details-header.ts`, and `Header.tsx` re-exports it, so the `DetailsHeaderProps` export is unchanged.

## 4. Close

- [x] 4.1 Record the line counts. Confirm both specs are unedited and the test totals match the baseline.

  Line counts:
  - `DetailsPanel.tsx`: 506 (was 1472);
  - `Header.tsx`: 444 (was 1212);
  - `useDetailsConfirmation` 384, `useDetailsPublish` 259, `useDetailsContentFile` 215;
  - `DetailsTabs` 238, `DetailsPublishContent` 80;
  - `useManageActions` 256, `HeaderCredentialsButton` 192, `HeaderManageSlot` 158, `useRecipientsCount` 74, `LimitStatusBadge` 36;
  - `utils/details-header-actions.ts` 278, `utils/details-panel.ts` 142;
  - `models/details-header.ts` 178, `models/details-panel.ts` 32.

  Both specs are byte-identical, checked by SHA-1. The `Details` folder runs 462 of 462 tests.
- [x] 4.2 Run lint, build and typecheck for `@epam/ai-dial-catalog`, plus `validate:docs`, `validate:specs` and `openspec validate split-catalog-details-panel`.

  Results:
  - `nx run-many -t lint build typecheck test -p @epam/ai-dial-catalog`: lint (0 errors), build and typecheck pass.
  - Tests: in that parallel run, one `DetailsPanel.spec` case (`prefers onLoadContentFilePreview over onLoadContentFile`) timed out at 5 s under load. Re-run alone (twice) and through `nx run @epam/ai-dial-catalog:test`, all 1006 tests in 57 files pass.
  - The one lint warning is in the untouched `Filter.tsx`.
