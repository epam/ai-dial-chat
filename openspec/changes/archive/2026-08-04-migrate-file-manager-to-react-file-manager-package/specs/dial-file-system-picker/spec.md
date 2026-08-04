## MODIFIED Requirements

### Requirement: Open FileManager in modal

The system SHALL open a `DialPopup` modal (title `"Attach files"`, i18n key `basic.attachFiles`) when the user selects "DIAL file system" from the attachment menu. The modal SHALL render `DialFileManager` from `@epam/ai-dial-react-file-manager` as its body and use `!h-[min(800px,100dvh)]`, matching the legacy file-manager modal's 800px cap and overriding the ui-kit's desktop auto-height.

- Modal state (`isDialFileManagerOpen`) is owned by `ConversationView`.
- `DialFileManagerModal` is lazy-loaded via `React.lazy` + `Suspense` in `ConversationView`.
- `DialPopup` is used with `size={PopupSize.Lg}` and `closeOnOutsideClick={true}`.
- Closing the modal does NOT modify `message` text or the local `attachments` list in `Input`.
- The popup and file-manager surface use `bg-layer-2`.
- The footer action container uses `px-6 py-4`.
- The ui-kit popup body SHALL use `flex min-h-0 flex-col`; the file-manager wrapper and manager SHALL use `grow`, matching the legacy modal layout. Row count SHALL NOT resize the modal.
- `DialFileManager.gridClassName` SHALL be `"size-full"` and `gridOptions.additionalGridOptions.domLayout` SHALL be `"normal"` so the AG Grid viewport consumes the available manager height instead of using row-driven auto-height.

#### Scenario: Opening the modal

- **GIVEN** the user is on the conversation page and the input is not disabled
- **WHEN** the user clicks "DIAL file system" in the attachment menu
- **THEN** a modal with title "Attach files" opens; `DialFileManager` is rendered inside it

#### Scenario: Closing the modal

- **GIVEN** the DIAL file system modal is open
- **WHEN** the user clicks the close button (or clicks outside the modal)
- **THEN** the modal closes; the message draft and any existing attachments are unchanged
