# Spec: attachment-input-lib

## Purpose

Specifies the `@epam/ai-dial-attachment-input` library extracted from `libs/conversation-input`. The library owns all attachment UI components (`AttachmentCard`, `AttachmentTray`, `FileDndOverlay`), the drag-and-drop and clipboard hooks, attachment utilities, and the `attachment-mime` helpers previously in `apps/chat`. `libs/conversation-input` re-exports the moved symbols for backwards compatibility.

---

## Requirements

### Requirement: Library package exists at libs/attachment-input
The `@epam/ai-dial-attachment-input` package SHALL exist as a standalone library under `libs/attachment-input/` with its own `package.json` (name `@epam/ai-dial-attachment-input`), `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `vite.config.mts`, `postcss.config.js`, and `tailwind.config.js`. The library SHALL be of type `type:ui` in the Nx workspace and MUST NOT import from `apps/*`, `server-api`, generated API clients, app contexts, auth/session, or routing.

#### Scenario: Library can be built independently
- **WHEN** `npm exec nx build attachment-input` is executed
- **THEN** the build succeeds and outputs compiled JS + type declarations under `libs/attachment-input/dist/`

#### Scenario: Library passes lint and typecheck
- **WHEN** `npm exec nx lint attachment-input` and `npm exec nx typecheck attachment-input` are executed
- **THEN** both targets complete with zero errors

### Requirement: Path alias registered
The TypeScript path alias `@epam/ai-dial-attachment-input/*` → `libs/attachment-input/*` SHALL be registered in `tsconfig.base.json` and in the `resolve.alias` section of `apps/chat/vite.config.mts`.

#### Scenario: Importing via alias resolves in app
- **WHEN** `apps/chat` or `libs/conversation-input` imports from `@epam/ai-dial-attachment-input/src/index`
- **THEN** TypeScript resolves the import without error

### Requirement: AttachmentCard exported from new lib
The `AttachmentCard` component, its `AttachmentCardProps` interface, and supporting types (`AttachmentCardColors`, `AttachmentCardTypography`, `AttachmentCardStyles`) SHALL be exported from `libs/attachment-input/src/index.ts`. The component MUST accept all data and callbacks via props with no access to app context.

#### Scenario: AttachmentCard renders in isolation
- **WHEN** `AttachmentCard` is rendered with valid `AttachmentCardProps` (name, contentType, status, onRemove callback)
- **THEN** the card displays the file name, icon, and remove button without crashing

### Requirement: AttachmentTray exported from new lib
The `AttachmentTray` component and `AttachmentTrayProps` interface SHALL be exported from `libs/attachment-input/src/index.ts`.

#### Scenario: AttachmentTray renders multiple cards
- **WHEN** `AttachmentTray` is rendered with an array of attachment data props
- **THEN** it renders one `AttachmentCard` per item without crashing

### Requirement: AddAttachmentButton exported from new lib
The `AddAttachmentButton` component SHALL be exported from `libs/attachment-input/src/index.ts`. It MUST accept an `onClick` callback prop and MUST NOT open the file manager itself.

#### Scenario: AddAttachmentButton triggers callback on click
- **WHEN** user clicks the `AddAttachmentButton`
- **THEN** the `onClick` prop callback is invoked

### Requirement: FileDndOverlay exported from new lib
The `FileDndOverlay` component and `FileDndOverlayProps` interface SHALL be exported from `libs/attachment-input/src/index.ts`.

#### Scenario: FileDndOverlay renders when active
- **WHEN** `FileDndOverlay` is rendered with `isActive={true}`
- **THEN** it renders the drag-and-drop overlay UI

### Requirement: useClipboardPaste exported from new lib
The `useClipboardPaste` hook SHALL be exported from `libs/attachment-input/src/index.ts`. It MUST accept an `onPaste` callback prop and MUST NOT reference app context.

#### Scenario: useClipboardPaste attaches clipboard listener
- **WHEN** a component mounts with `useClipboardPaste` and a paste event fires on the document
- **THEN** the `onPaste` callback is invoked with the pasted file(s)

### Requirement: Attachment utility functions exported from new lib
The following utility functions SHALL be exported from `libs/attachment-input/src/index.ts`:
- `generateAttachmentId`
- `getAttachmentCardState`
- `getAttachmentIcon`
- `mimeTypesToExtensionLabels`
- `isMimeTypeAllowed`

#### Scenario: isMimeTypeAllowed returns correct result
- **WHEN** `isMimeTypeAllowed` is called with a MIME type and an allowlist array
- **THEN** it returns `true` if the MIME type matches an allowed entry, `false` otherwise

#### Scenario: mimeTypesToExtensionLabels converts MIME types
- **WHEN** `mimeTypesToExtensionLabels` is called with an array of MIME type strings
- **THEN** it returns an array of human-readable extension label strings

### Requirement: Upload constants exported from new lib
The upload constraint constants (e.g. `MAX_UPLOADS_PER_MINUTE`) from `libs/conversation-input/src/constants/upload.ts` SHALL be exported from `libs/attachment-input/src/index.ts`.

#### Scenario: Constants accessible via new alias
- **WHEN** a consumer imports upload constants from `@epam/ai-dial-attachment-input/src/index`
- **THEN** the constant values are accessible and correctly typed

### Requirement: libs/conversation-input re-exports moved symbols
All symbols that were previously exported from `libs/conversation-input/src/index.ts` and are now owned by `libs/attachment-input` SHALL continue to be re-exported from `libs/conversation-input/src/index.ts` via `export { ... } from '@epam/ai-dial-attachment-input/src/index'`. No existing consumer of `@epam/ai-dial-conversation-input` SHALL break.

#### Scenario: Existing conversation-input imports still resolve
- **WHEN** any file that previously imported attachment symbols from `@epam/ai-dial-conversation-input/src/index` is typechecked
- **THEN** TypeScript resolves the import without error

### Requirement: apps/chat attachment-mime imports updated
All `apps/chat` files that previously imported from `apps/chat/src/utils/attachment-mime` SHALL be updated to import from `@epam/ai-dial-attachment-input/src/utils/attachment-mime` (or from the lib's `index.ts`). The original `attachment-mime.ts` file SHALL be deleted from `apps/chat/src/utils/`.

#### Scenario: apps/chat typechecks after attachment-mime move
- **WHEN** `npm exec nx typecheck chat` is executed after the migration
- **THEN** typecheck completes with zero errors related to attachment-mime imports

### Requirement: All existing tests pass
All existing tests in `libs/conversation-input` and `apps/chat` that cover the moved code SHALL continue to pass without modification (other than updating import paths as needed).

#### Scenario: attachment-input tests pass
- **WHEN** `npm exec nx test attachment-input` is executed
- **THEN** all tests pass

#### Scenario: conversation-input tests still pass
- **WHEN** `npm exec nx test conversation-input` is executed after the migration
- **THEN** all tests that previously passed continue to pass
