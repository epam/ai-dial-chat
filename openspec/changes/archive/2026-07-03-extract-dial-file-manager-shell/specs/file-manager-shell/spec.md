## ADDED Requirements

### Requirement: DialFileManagerShell component contract

`apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx` SHALL be a `memo`-wrapped functional component that accepts the full `UseDialFileManagerResult` (the return value of `apps/chat/src/hooks/files/useDialFileManager.ts`) plus a `labels` prop bag of pre-translated strings and any grid/tree/toolbar option overrides needed by a specific host. It SHALL NOT call `useTranslation` internally — every user-visible string it renders SHALL come from the `labels` prop, resolved by the host (`DialFileManagerModal` today; `DialFileManagerPage` in a later change).

The shell owns rendering: the `DialFileManager` (ui-kit) prop assembly (grid/tree/toolbar/bulk option bags, search props, tab-specific and search empty states, `autoSelectUploadedItems`, forbidden-symbols wiring), the `UploadProgressModal`, the download-loading overlay, and the `role="alert"` error/retry panel with a retry button wired to `hookResult.retry`.

The shell SHALL NOT render `DialPopup`, any attach footer, or accept attach-only props (`allowedTypes`, `maximumAttachmentsAmount`, `canAttachFolders`, `onAttach`) — those remain host-owned.

#### Scenario: Shell renders file manager grid from hook result

- **WHEN** a host renders `<DialFileManagerShell hookResult={...} labels={...} />` with a non-empty `items` array in `hookResult`
- **THEN** the shell renders `DialFileManager` (ui-kit) with `items`, `path`, and the assembled grid/tree/toolbar option bags derived from `hookResult`

#### Scenario: Shell shows error/retry panel on load failure

- **WHEN** `hookResult.error` is set
- **THEN** the shell renders a `role="alert"` panel containing `labels.errorMessage` and a button labeled `labels.retryLabel` that calls `hookResult.retry` on click

#### Scenario: Shell shows upload progress modal during an active upload batch

- **WHEN** `hookResult.uploadBatchState` is non-null
- **THEN** the shell renders `UploadProgressModal` with the batch state and a cancel handler wired to `hookResult.cancelUpload`

#### Scenario: Shell never calls useTranslation

- **WHEN** the shell module is statically analyzed
- **THEN** it contains no import of `useTranslation` from `react-i18next`

### Requirement: useDialFileManager variant and actionProfile options

`UseDialFileManagerOptions` (in `apps/chat/src/hooks/files/useDialFileManager.ts`) SHALL accept an optional `variant: 'attach' | 'standalone' | 'folder-picker'` (default `'attach'`) and an optional `actionProfile: 'attach' | 'browse' | 'full'` (default derived from `variant`: `'attach'` → `'attach'`, `'standalone'` → `'browse'`, `'folder-picker'` → `'full'`). Existing callers that omit both options SHALL observe no behavior change — `variant: 'attach'` and `actionProfile: 'attach'` SHALL produce the exact same `actionLabels` per tab as the current (pre-change) unconditional tab-based logic.

`actionProfile: 'attach'` and `actionProfile: 'browse'` SHALL produce identical `actionLabels` output for every tab in this change (no behavioral divergence is introduced yet — the enum exists to allow a later change to diverge them without another hook signature change). `actionProfile: 'full'` is a reserved value with no implemented behavior in this change; no caller in this change sets `variant: 'folder-picker'` so this branch is unreachable in production code paths.

#### Scenario: Default variant preserves existing attach behavior

- **WHEN** `useDialFileManager({ bucket })` is called without `variant` or `actionProfile`
- **THEN** the hook behaves identically to the pre-change implementation (same `actionLabels`, same load-effect behavior)

#### Scenario: Standalone and attach action profiles match in this change

- **WHEN** `useDialFileManager` is called once with `actionProfile: 'attach'` and once with `actionProfile: 'browse'` for the same `activeTab`
- **THEN** both calls return the same `actionLabels` array

### Requirement: Standalone variant triggers listing load on mount

When `variant === 'standalone'`, `useDialFileManager` SHALL fetch the initial folder listing on mount without requiring any user navigation, using the same load effect that already runs on mount for other variants (`folderPath` starts at `''`, so the existing effect at `useDialFileManager.ts:634-672` fires immediately).

#### Scenario: Standalone hook fetches root listing on mount

- **WHEN** a component calls `useDialFileManager({ bucket, variant: 'standalone' })` and mounts
- **THEN** `listFiles` (or the tab-appropriate list function) is called with the root path before any user interaction

## Non-functional notes

- **State ownership**: `DialFileManagerShell` is stateless with respect to file-manager data — all state (`items`, `path`, `uploadBatchState`, etc.) is owned by `useDialFileManager` and passed in via `hookResult`. The shell only holds presentation-local state it does not persist (none introduced by this change).
- **i18n**: no new user-visible strings are introduced. `DialFileManagerModal` continues to resolve all `dialFileManager.*` keys via `useTranslation` and passes them into the shell's `labels` prop unchanged.
- **RTL / direction**: no new UI is introduced — the shell renders the same `DialFileManager` (ui-kit) JSX tree the modal renders today, with the same logical-property classes. No new physical-direction classes are added.
- **Feature flags**: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — this is an internal refactor of an already-shipped, ungated modal.
- **Memoization**: `DialFileManagerShell` SHALL be wrapped in `memo`, matching `DialFileManagerModal`'s existing `export default memo(DialFileManagerModal)` pattern. Option-bag `useMemo`s currently in the modal (`DialFileManagerModal.tsx:512-662`) move into the shell unchanged.
- **Accessibility**: preserves existing `role="alert"` on the error/retry panel; no new ARIA requirements since no new interactive surface is introduced.
- **Observability**: no new metrics/telemetry — this change has no backend or analytics surface.
