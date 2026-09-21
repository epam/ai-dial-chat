## MODIFIED Requirements

### Requirement: DialFileManagerPage component

`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` SHALL be a top-level `FC` that: resolves `bucket` via `useUser()` from `apps/chat/src/context/auth/UserContext.tsx` (`user?.bucket ?? ''`, matching the attach modal's existing pattern); reads `maxSelectableFileSize` from `useAppConfig().config.maxAttachmentFileSizeBytes`; calls `useDialFileManager({ bucket, variant: 'standalone', actionProfile: 'browse' })` (unchanged — size enforcement does not flow through this hook); wires notifications via `useNotification()`; and renders `DialFileManagerShell` fed by the hook's result, filling the full page with no additional chrome, forwarding `maxSelectableFileSize` (for existing-file selection, grid `isRowSelectable`, see `dial-file-manager-attach-validation`) and a translated `oversizedUploadMessage` (built from the i18n key `dialFileManager.uploadFileTooLarge`, e.g. "Max file size is {{maxSize}}.") to `DialFileManagerShell`, which forwards both, respectively, as `<DialFileManager>`'s `maxSelectableFileSize` and `maxFileSize`/`uploadValidationMessages.oversizedFiles` props — the same AppConfig-sourced value now gates both existing-file selection and the ui-kit's own pre-upload size check, matching the attach modal. It SHALL NOT render `DialPopup`, any attach footer, or a page title/header, and SHALL NOT pass `allowedTypes`, `maximumAttachmentsAmount`, `canAttachFolders`, or `onAttach`.

This closes a pre-existing gap: before this change, `DialFileManagerPage` passed no size context at all, so the standalone page's existing-file selection was completely unrestricted by size (unlike the attach modal, which already passed `maxSelectableFileSize`) and its own "New → Upload files" flow never engaged the ui-kit's built-in `maxFileSize` pre-upload check, which the app had also never wired up anywhere.

#### Scenario: Root listing loads without user interaction

- **WHEN** `DialFileManagerPage` mounts
- **THEN** the root folder listing for the user's bucket is fetched and rendered without requiring the user to navigate or click anything (relies on `useDialFileManager`'s existing standalone mount-load behavior)

#### Scenario: No attach affordances are rendered

- **WHEN** `DialFileManagerPage` is rendered
- **THEN** there is no "Attach" button, no attach footer, and no attach-selection-limit messaging anywhere on the page

#### Scenario: Tabs and CRUD match the attach modal

- **WHEN** a user switches between My files, Shared with me, and Organization tabs on the standalone page
- **THEN** the same columns, dates, and per-tab actions (upload, delete, rename, download) appear as they do in the attach modal for the same tab

#### Scenario: Standalone page enforces the same size limit as the attach modal

- **WHEN** `useAppConfig().config.maxAttachmentFileSizeBytes` resolves to `536870912`
- **THEN** `DialFileManagerPage` passes `maxSelectableFileSize: 536870912` into `DialFileManagerShell`
- **AND** an existing file in storage larger than that is not selectable in the standalone page's grid, matching the attach modal's `isRowSelectable` behavior
- **AND** a freshly-picked local file larger than that is rejected by the ui-kit's own `maxFileSize` check before `onUploadFiles`/any `POST /api/v1/files` request

#### Scenario: Size limit falls back to the default before AppConfig loads

- **WHEN** `DialFileManagerPage` mounts before `AppConfig`'s initial fetch has resolved
- **THEN** `maxSelectableFileSize` is `536870912` (the `AppConfig` default), not `undefined` — the page never briefly renders with no size restriction at all
