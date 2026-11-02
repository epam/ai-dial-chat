## MODIFIED Requirements

### Requirement: Open FileManager in modal

The system SHALL open a modal (title `"Attach files"`, i18n key `basic.attachFiles`) when the user selects "DIAL file system" from the attachment menu. The app's `DialFileManagerModal` (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) builds the translated labels and the picker state (`useFileAttachmentPicker` from `@epam/ai-dial-chat-hooks`) and renders `FileManagerAttachModal` from `@epam/ai-dial-chat-shared/file-manager`, which renders the ui-kit 2.0 `Popup` with `DialFileManagerShell` (and through it `DialFileManager` from `@epam/ai-dial-react-file-manager`) as its body.

- Modal state (`isOpen`) and pending DIAL attachments are owned by the app-level hook `useDialFileManagerState` (`apps/chat/src/hooks/files/useDialFileManagerState.ts`). Both call sites use it: `ConversationView` for an existing conversation and `NewConversationComposer` for a new chat. Neither call site SHALL keep its own `useState` for the modal's open state or pending DIAL attachments. Both lazy-load `DialFileManagerModal` via `React.lazy` + `Suspense`.
- `Popup` is used with `size={PopupSize.Lg}` and `className="flex !h-[min(800px,100dvh)] w-full flex-col !bg-layer-sunken"`, matching the legacy file-manager modal's 800px cap and overriding the ui-kit's desktop auto-height. No `closeOnOutsideClick` prop is passed.
- The Attach button is the popup's single `mainButtons` entry (`ButtonVariant.Primary`).
- Closing the modal does NOT modify `message` text or the local `attachments` list in `Input`.
- The popup body wrapper uses `flex h-full min-h-0 flex-col`; the shell's file-manager wrapper and `DialFileManager` use `grow`. Row count SHALL NOT resize the modal.
- For the Attach variant, `DialFileManager.gridClassName` SHALL be `"size-full gap-6 px-6 py-4"` (other variants use `"size-full"`) and `gridOptions.additionalGridOptions.domLayout` SHALL be `"normal"` so the AG Grid viewport consumes the available manager height instead of using row-driven auto-height.

#### Scenario: Opening the modal

- **GIVEN** the user is on the conversation page and the input is not disabled
- **WHEN** the user clicks "DIAL file system" in the attachment menu
- **THEN** a modal with title "Attach files" opens; `DialFileManager` is rendered inside it

#### Scenario: Closing the modal

- **GIVEN** the DIAL file system modal is open
- **WHEN** the user clicks the close button
- **THEN** the modal closes; the message draft and any existing attachments are unchanged

#### Scenario: Existing conversation uses the shared state hook

- **GIVEN** an existing conversation is open in `ConversationView`
- **WHEN** the user opens the DIAL file system modal, selects files and folders, and clicks Attach
- **THEN** `useDialFileManagerState.handleAttach` converts the result to attachments, stores them as pending, and closes the modal, exactly as it does for `NewConversationComposer`
