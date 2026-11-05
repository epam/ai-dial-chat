## ADDED Requirements

### Requirement: Details panel concerns live in dedicated modules

`DetailsPanel` in `libs/catalog/src/components/Details/` SHALL delegate:

- the Content-tab file picker to `hooks/useDetailsContentFile.ts`;
- the publish sub-view state and its publish-history lookup to `hooks/useDetailsPublish.ts`;
- the confirmation step to `hooks/useDetailsConfirmation.tsx`;
- the tab row and tab bodies to `DetailsTabs.tsx`;
- the publish sub-view body to `DetailsPublishContent.tsx`.

`Header` SHALL delegate:

- the limit badge to `Header/LimitStatusBadge.tsx`;
- the recipient-count lookup to `Header/hooks/useRecipientsCount.ts`;
- its action-visibility rules to `resolveHeaderActionVisibility` in `src/utils/details-header-actions.ts`;
- the Manage-menu model to `Header/hooks/useManageActions.tsx`;
- the credentials button to `Header/HeaderCredentialsButton.tsx`;
- the Manage menu and promoted action to `Header/HeaderManageSlot.tsx`.

None of these modules SHALL be exported from the lib's `src/index.ts`.

#### Scenario: Panel and header stay small

- **WHEN** the line counts of `DetailsPanel.tsx` and `Header/Header.tsx` are measured
- **THEN** each is at most about 500 lines, and no module listed above exceeds about 450 lines

### Requirement: The split preserves behavior and the public API

The decomposition SHALL NOT change the rendered output, the callbacks invoked, or the public exports of `@epam/ai-dial-catalog`. `DetailsPanel.spec.tsx` and `Header/tests/Header.spec.tsx` SHALL pass without edits.

Per-item resets SHALL keep their relative order. In `useDetailsPublish`, the publish-history prefetch effect runs after that hook's per-item reset. The panel's active-tab reset runs before its tab-reconciliation effect.

#### Scenario: Characterization specs pass unedited

- **WHEN** the specs under `libs/catalog/src/components/Details` run after the split
- **THEN** all of them pass, and `DetailsPanel.spec.tsx` and `Header.spec.tsx` are byte-identical to before
