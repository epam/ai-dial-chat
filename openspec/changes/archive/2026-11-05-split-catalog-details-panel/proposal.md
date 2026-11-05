## Why

Refactoring item F8. Two components in `libs/catalog` are the largest in the lib:

- `src/components/Details/DetailsPanel.tsx`: 1472 lines;
- `src/components/Details/Header/Header.tsx`: 1212 lines.

`DetailsPanel` mixes four concerns:

- the Content-tab file picker, with blob-URL lifetime and out-of-order guards;
- the publish sub-view, with its once-per-item history lookup;
- the confirmation state machine, with its copy for six kinds;
- the tab bodies.

`Header` mixes:

- a 150-line visibility rule set;
- the Manage-menu model;
- the recipient-count lookup;
- the credentials button with its API-key popover;
- the menu/promoted-action rendering.

Any change touches a file where most of the code is unrelated to it. Their specs (`DetailsPanel.spec.tsx`, 151 `it`; `Header.spec.tsx`, 143 `it`) characterize the behavior and are the safety net for this split. This follows the F3/F4 splits (`split-conversation-panel-view`, `split-conversation-view`).

## What Changes

Code moves verbatim into private modules. Neither the public API nor the behavior changes.

**`DetailsPanel`**

- `components/Details/hooks/useDetailsContentFile.ts`: picked-file state, blob-URL revocation, the request-generation guard, folder expansion, `handleSelectContentFile`, and the preview resolution.
- `components/Details/hooks/useDetailsPublish.ts`:
  - publish-open state;
  - the once-per-item history lookup, with its open and prefetch effects;
  - `usePublishFlow`, `derivePublishState`, `usePublishFolderView`;
  - the published-folder list and its label formatter;
  - open, close and submit.
- `components/Details/hooks/useDetailsConfirmation.tsx`:
  - the confirmation kind and its pending levels and folder;
  - request, cancel and confirm handlers, and the Escape capture effect;
  - the per-kind `ConfirmationContent`, and `isConfirmDisabled`.
- `components/Details/DetailsTabs.tsx`: the tab row, the loading region, and the seven tab bodies, with their label memos and empty states.
- `components/Details/DetailsPublishContent.tsx`: the `PublishPanel` body of the publish sub-view.
- Shared pieces:
  - `src/models/details-panel.ts`: the `PublishedFolder` and `ConfirmationContent` interfaces;
  - `src/utils/details-panel.ts`: the panel constants, default copy, `CONFIRMATIONS_REMOVING_ITEM_FROM_VIEW`, `resolveUnpublishFolder`, and `getDetailsPanelCssVars` (the color-to-CSS-var map).

**`Header`**

- `components/Details/Header/LimitStatusBadge.tsx`: the badge and its class map.
- `components/Details/Header/hooks/useRecipientsCount.ts`: the per-item recipient-count lookup.
- `src/utils/details-header-actions.ts`: `resolveHeaderActionVisibility`, a pure function holding today's `shouldShow*`, `is*InActionRow`, credentials, download and `mayGain*` rules. Their comments move with them.
- `components/Details/Header/hooks/useManageActions.tsx`: the `ManageAction` list, the menu items with icon vars, and the promoted action. `ManageAction` moves to `src/models/details-header.ts`.
- `components/Details/Header/HeaderCredentialsButton.tsx`: the credentials label, icons, click handling and the API-key `Dropdown`.
- `components/Details/Header/HeaderManageSlot.tsx`: the Manage `Dropdown`, the share-overlay anchor, and the promoted-action button.

`HeaderProps` moves to `src/models/details-header.ts` so the new modules can `Pick` from it. `Header.tsx` re-exports it, which keeps the `DetailsHeaderProps` export path in `src/index.ts` unchanged. `defaultManageCredentialsActionLabel` moves to `src/utils/details-header-actions.ts`.

### Non-goals

- Any behavior, prop, label, color var or class change.
- Editing `DetailsPanel.spec.tsx` or `Header.spec.tsx`.
- Splitting the two specs themselves.

### Acceptance criteria

- `DetailsPanel.tsx` and `Header.tsx` are each at most about 500 lines. No new module exceeds about 450 lines.
- `DetailsPanel.spec.tsx` and `Header.spec.tsx` pass unedited, with the same `it` counts. All 462 tests under `src/components/Details` pass.
- The lib's `src/index.ts` and its README API are unchanged.
- Lint, build and typecheck of `@epam/ai-dial-catalog` pass, and `validate:docs` and `validate:specs` pass.

## Capabilities

### New Capabilities

- `catalog-details-decomposition`: where the details panel's and details header's concerns live, and the invariants the split keeps.

### Modified Capabilities

None.

## Impact

- **Code:** `libs/catalog/src/components/Details/**`, plus new `src/models/details-*.ts` and `src/utils/details-*.ts`.
- **Unaffected:**
  - the public API and README;
  - `apps/chat`;
  - styles, i18n, RTL and a11y.
