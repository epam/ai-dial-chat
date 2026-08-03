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

### Requirement: AttachmentCard renders an inline audio player for audio attachments

When `attachment.type === AttachmentType.Audio`, `AttachmentCard` SHALL render a wide card (minimum `280px`, maximum `300px`) instead of the standard `100×100` square. The card root SHALL have `position: relative` (`relative` Tailwind class) so that absolutely-positioned action buttons resolve correctly. The card SHALL contain:
- The attachment filename truncated to one line at the top.
- A native `<audio controls>` element using `attachment.playUrl` as `src` and `preload="metadata"`. The element SHALL span the full card width. Clicks on the `<audio>` element SHALL call `stopPropagation` so they do NOT propagate to the card's own click handler.
- A `DownloadAction` button (absolutely positioned, `end-1 top-1`) when `onDownload` is provided. Clicking it SHALL call `onDownload(id)` and SHALL NOT bubble to the card's click handler.
- A `RemoveAction` button (absolutely positioned, `end-1 top-1`) when `onRemove` is provided. Clicking it SHALL call `onRemove(id)` and SHALL NOT bubble to the card's click handler.

When `onClick` is provided, the card root SHALL act as a keyboard-accessible button (`role="button"`, `tabIndex={0}`, `aria-label` from `labels.clickLabel`). Clicking the card body (outside the audio controls and action buttons) SHALL call `onClick(id)`. When either `onDownload` or `onRemove` is provided, the card SHALL apply `pe-8` end padding to prevent content from overlapping the action button area.

The audio card variant SHALL use the same border and background CSS custom properties as the standard card.

#### Scenario: Audio attachment renders audio player

- **WHEN** `AttachmentCard` is rendered with `attachment.type === AttachmentType.Audio` and a valid `playUrl`
- **THEN** an `<audio>` element with `controls` is present in the DOM
- **AND** the `<audio>` element's `src` equals `attachment.playUrl`

#### Scenario: Audio card shows download button when onDownload provided

- **WHEN** `AttachmentCard` is rendered with `type === AttachmentType.Audio` and an `onDownload` prop
- **THEN** a download icon button is rendered in the top-end corner of the card
- **AND** clicking it calls `onDownload(id)` without triggering audio playback or the card's click handler

#### Scenario: Audio card shows remove button when onRemove provided

- **WHEN** `AttachmentCard` is rendered with `type === AttachmentType.Audio` and an `onRemove` prop
- **THEN** a remove icon button is rendered in the top-end corner of the card
- **AND** clicking it calls `onRemove(id)` without triggering the card's click handler

#### Scenario: Audio card body is clickable when onClick provided

- **WHEN** `AttachmentCard` is rendered with `type === AttachmentType.Audio` and an `onClick` prop
- **THEN** the card root has `role="button"` and `tabIndex={0}`
- **AND** clicking the card body (outside the audio controls and action buttons) calls `onClick(id)`

#### Scenario: Audio player interaction does not trigger canvas open

- **WHEN** the user interacts with the `<audio>` controls on an audio card
- **THEN** the click event does NOT propagate to the card's click handler

#### Scenario: Audio card is wider than standard card

- **WHEN** `AttachmentCard` is rendered with `type === AttachmentType.Audio`
- **THEN** the card does NOT have the `h-[100px] w-[100px]` classes of a standard card

---

### Requirement: Attachment tile action buttons are hidden until the tile is hovered or focused

Every attachment tile variant (`FileAttachment`, `ImageAttachment`, `AudioAttachment`) SHALL apply the Tailwind named group `group/attachment-tile` to its root element. The shared `ActionButton` in `libs/attachment-input/src/components/AttachmentCard/Attachments/Actions.tsx` (used by `DownloadAction`, `RemoveAction`, `ReloadAction`, `OpenLinkAction`) SHALL render with `opacity-0` by default, becoming fully opaque via `group-hover/attachment-tile:opacity-100`, `group-focus-within/attachment-tile:opacity-100`, and `focus-visible:opacity-100` — the last so a keyboard user tabbing directly to the button also reveals it, per the keyboard-parity rule for hover-only affordances.

`ImageAttachment`'s `DownloadAction`/`RemoveAction` additionally receive `styles.imageActionButton`, which renders a persistent background/icon-color chip (backed by `--ai-tile-hover-icon-bg`/`--ai-tile-hover-icon-color`) so the button stays legible against arbitrary image content once revealed, without depending on the cursor being directly over the small button itself. `FileAttachment` and `AudioAttachment` do not apply this chip.

#### Scenario: Action buttons are invisible on an unhovered, unfocused tile

- **WHEN** an attachment tile is rendered with `onDownload`/`onRemove` and is neither hovered nor focused
- **THEN** the action button(s) have `opacity-0`

#### Scenario: Hovering or focusing the tile reveals its action buttons

- **WHEN** the user hovers the tile, or moves keyboard focus to any focusable descendant of the tile (including the action button itself)
- **THEN** the action button(s) become fully opaque

#### Scenario: Image tile action buttons render with a persistent background chip

- **WHEN** `ImageAttachment`'s `DownloadAction`/`RemoveAction` are revealed via hover or focus
- **THEN** they render with the `imageActionButton` background/color chip, independent of whether the cursor is directly over the button

---

### Requirement: AttachmentCard, AttachmentGroup, and MessageBubble support a selected-tile visual state

`AttachmentCardProps`, `FileAttachmentProps`, and the inline `ImageAttachmentProps`/`AudioAttachmentProps` interfaces in `libs/attachment-input` SHALL each accept an optional `isSelected?: boolean`. When `true`, the tile SHALL apply the standalone `.selected` CSS module class (`libs/attachment-input/src/components/AttachmentCard/Attachments/Attachment.module.scss`), which sets `background`/`border-color` via `--ai-tile-bg-selected`/`--ai-tile-border-selected` (each falling back through a themed token to a hex default). `.selected` is independent of `.tile` so it applies uniformly to `FileAttachment`/`ImageAttachment` (which also carry `.tile`) and to `AudioAttachment` (which does not).

`AttachmentGroupProps` SHALL accept an optional `selectedAttachmentId?: string`. `AttachmentGroup` SHALL compute `isSelected={attachment.id === selectedAttachmentId}` for each rendered `AttachmentCard`. This comparison is `DisplayAttachment.id`-based, so it is only correct when the caller guarantees `selectedAttachmentId` is scoped to the same attachment list `AttachmentGroup` is rendering (see the message-scoped key below) — `DisplayAttachment.id` is derived from content (`dto.url ?? dto.data ?? dto.title`, see `messageAttachmentToDisplayAttachment`), not a globally unique generated ID, so the same value can legitimately recur across different messages (e.g. the same file attached twice in a conversation).

`BaseMessageBubbleProps` (`libs/conversation-messages/src/models/message-bubble.ts`) SHALL accept the same optional `selectedAttachmentId?: string`, forwarded by `UserMessageBubble` and `AssistantMessageBubble` to their `AttachmentGroup`. This prop is always a raw `DisplayAttachment.id` scoped to the single message's own attachment list — never the app-level composite key described below — so lib code never needs to know about message indices.

At the app layer, `AttachmentCanvasContextValue` (`libs/attachment-canvas`) SHALL track `attachmentId: string | undefined` — an opaque caller-supplied key identifying whatever is currently displayed in the canvas — set by `openCanvas`/`openCanvasLoading`'s optional third/second `attachmentId` parameter and cleared by `closeCanvas`. The lib itself SHALL NOT assume any structure for this key; it is purely stored and returned.

`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`'s `openAttachmentCanvas(attachment, canvasAttachmentId?)` SHALL accept an optional second parameter used as the tracked key instead of `attachment.id`, defaulting to `attachment.id` when omitted (non-message callers — the edit-message tray, `ConversationSourcesPanel` — rely on this default). `ConversationView.tsx`'s `handleMessageAttachmentClick(attachment, messageIndex)` SHALL call `openAttachmentCanvas` with the composite key `` `${messageIndex}:${attachment.id}` ``, so that two different messages containing content-identical attachments (same derived `id`) never collide.

`ConversationView.tsx` SHALL read this composite key back from `useAttachmentCanvas().attachmentId` and pass it to each `ConversationMessageItem` as `selectedAttachmentKey`. `ConversationMessageItem` SHALL derive a message-scoped `selectedAttachmentId` by checking whether `selectedAttachmentKey` starts with `` `${index}:` `` (its own message index) and, if so, stripping that prefix; otherwise it passes `undefined`. Only the matching message's `MessageBubble` receives a defined `selectedAttachmentId` — every other message's `ConversationMessageItem` computes `undefined` for the same global key, so no other message's tile can render as selected even if one of its attachments shares the same content-derived `id`.

#### Scenario: Attachment tile shows selected styling when its ID matches within its own message

- **WHEN** `AttachmentGroup` is rendered with `selectedAttachmentId` equal to one of its attachments' `id`
- **THEN** that attachment's tile carries the `.selected` class and no other tile in the same group does

#### Scenario: Opening an attachment in the canvas marks its tile selected

- **WHEN** the user clicks a message attachment and the canvas panel opens with that attachment's content
- **THEN** the same attachment's tile in the same message renders with the selected visual state

#### Scenario: Duplicate content-derived IDs across different messages do not cross-select

- **WHEN** two different messages each contain a `DisplayAttachment` with the same derived `id` (e.g. the identical file attached in both), and the user opens the canvas from the first message's tile
- **THEN** only the first message's tile renders as selected; the second message's tile with the matching `id` does NOT render as selected

#### Scenario: Closing the canvas clears the selected state

- **WHEN** the canvas panel is closed (`closeCanvas`)
- **THEN** `attachmentId` becomes `undefined`, `selectedAttachmentKey` becomes `undefined` for every message, and no attachment tile renders as selected

---

### Requirement: All existing tests pass
All existing tests in `libs/conversation-input` and `apps/chat` that cover the moved code SHALL continue to pass without modification (other than updating import paths as needed).

#### Scenario: attachment-input tests pass
- **WHEN** `npm exec nx test attachment-input` is executed
- **THEN** all tests pass

#### Scenario: conversation-input tests still pass
- **WHEN** `npm exec nx test conversation-input` is executed after the migration
- **THEN** all tests that previously passed continue to pass
