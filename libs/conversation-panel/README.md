# @epam/ai-dial-conversation-panel

Panel component for browsing conversation history with virtual scrolling, grouped views, tab filtering, and search.

## Overview

`@epam/ai-dial-conversation-panel` renders the conversation history sidebar that lets users navigate between past chats. It addresses the performance and UX challenges that come with displaying large conversation histories: rows are rendered through `react-window` so the DOM stays small even with thousands of entries; conversations are grouped into a Pinned section plus per-source sections (`FilterTab`) with collapsible headers, so users can quickly locate work; and a tab bar with a search field narrows the list without a full page reload. Rows support drag-and-drop reordering between groups, per-row action menus, task badges, and unread indicators. Use this library whenever an application needs a left-rail or slide-in drawer that shows the user's chat history with standard navigation affordances. The library is intentionally data-agnostic — it accepts an already-ordered flat list of `ConversationItem` objects and emits callbacks for selection, actions, and moves, leaving sorting, storage, and routing entirely to the consuming app.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-conversation-panel": "*"
  }
}
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-sidebar`
- `@tabler/icons-react`

## Components

### ConversationPanel

Root component. Renders the full panel with header, search, tab filters, grouped list, and empty states.

```tsx
import { ConversationPanel } from '@epam/ai-dial-conversation-panel';
import type { ConversationPanelProps } from '@epam/ai-dial-conversation-panel';

<ConversationPanel
  conversations={historyItems}
  isOpen={isPanelOpen}
  onSelectConversation={handleSelectConversation}
  activeConversationId={activeConversationId}
  onNewChat={handleNewChat}
  getActions={buildRowActions}
  onMoveConversation={handleMove}
  labels={{
    title: 'Chats',
    emptyLabel: 'No conversations yet',
    noResultsLabel: 'No results found',
    newChatLabel: 'New chat',
    searchPlaceholder: 'Search…',
    searchClearLabel: 'Clear search',
    filterLabels: {
      all: 'All',
      myChats: 'My chats',
      shared: 'Shared',
      organization: 'Organization',
      groupAriaLabel: 'Filter chats',
    },
  }}
/>;
```

Pass `isFilterTabsHidden` to drop the All / My chats / Shared / Organization
row. The list then stays on whichever tab is active — `FilterTab.All` unless
`activeFilter` says otherwise — so every group remains visible; only the
control disappears. `labels.filterLabels` stays required either way.

The row renders each filter as a ui-kit `Tag` in its `TagAppearance.Selectable`
appearance, so the chips take their colors from the active theme's tag tokens.
It is a named `role="group"` of toggle chips — the selected one carries
`aria-pressed` — not a `tablist`, because the chips filter the list in place
rather than switching between panels. `labels.filterLabels.groupAriaLabel` names
the group and defaults to `"Filter chats"`;
`styles.typography.tabClassName` sets the label typography and defaults to
`'dial-tiny-semi-text'`.

## Enums

`FilterTab` is owned and exported by `@epam/ai-dial-chat-shared`, and this
package does not re-export it — import it from its own package alongside this
one. It identifies a filter tab, a collapsible group, and a conversation's
source/ownership.

```tsx
import { FilterTab } from '@epam/ai-dial-chat-shared';

FilterTab.All; // 'all'
FilterTab.Pinned; // 'pinned' — also identifies the Pinned collapsible group
FilterTab.MyChats; // 'my-chats' — also used as a conversation's source/ownership
FilterTab.Shared; // 'shared'
FilterTab.Organization; // 'organization'
```

## Types

```tsx
import type {
  ConversationPanelProps,
  ConversationPanelLabels,
  ConversationPanelStyles,
  ConversationPanelTypography,
  ConversationColors,
  NewChatButtonColors,
  ConversationItem,
  ConversationMove,
  FilterLabels,
} from '@epam/ai-dial-conversation-panel';
```

### ConversationItem

Data shape for each conversation entry in the list. Only `id` and `title` are
required.

```tsx
interface ConversationItem {
  id: string;
  title: string;
  isPinned?: boolean;
  source?: FilterTab;
  iconUrl?: string;
  iconTooltip?: string;
  isIconLoading?: boolean;
  href?: string;
  showTaskBadge?: boolean;
  taskBadgeLabel?: string;
  isUnread?: boolean;
}
```

The panel does not sort — it renders `conversations` in the order given, so
recency ordering is the host's job. Grouping is derived from `isPinned` and
`source`.

### ConversationMove

Payload for a completed drag-and-drop move: the dragged `draggedId`, the
`targetGroupKey` it landed in, and `afterId` — the item to insert after, or
`null` for the top of that group.

## CircularProgress

Determinate ring whose filled arc is `value` percent of its circumference, swept clockwise from twelve o'clock. Used by `ImportExportQueue` for per-row transfer progress, and exported for hosts that need the same indicator elsewhere. It is deliberately **not** mirrored under `dir="rtl"`: it is a symmetric indicator, and a counter-clockwise sweep reads as work being undone.

```tsx
import { CircularProgress } from '@epam/ai-dial-conversation-panel';

<CircularProgress
  value={36}
  ariaLabel="Exporting my-chat.dial"
  ariaValueText="3 of 10 attachments"
/>;
```

### CircularProgressProps

| Prop            | Type     | Required | Description                                                        |
| --------------- | -------- | :------: | ------------------------------------------------------------------ |
| `value`         | `number` |    ✓     | Completion as a percentage, clamped to 0–100                       |
| `ariaLabel`     | `string` |    ✓     | Accessible name — a bare progressbar tells a screen reader nothing |
| `ariaValueText` | `string` |          | Spoken value replacing the bare percentage                         |
| `size`          | `number` |          | Outer diameter in pixels. Defaults to `16`                         |
| `strokeWidth`   | `number` |          | Ring thickness in pixels. Defaults to `2`                          |
| `className`     | `string` |          | Extra class name(s) merged onto the root `svg`                     |

Colors come from `--cp-circular-progress-track` and `--cp-circular-progress-indicator`, each falling back to an app theme token.

## ImportExportQueue

Floating queue panel that shows the status of in-flight or recently completed export/import jobs. Each row is identified by the **file** the job transfers — a file-type icon derived from the extension plus the file name, truncated with a tooltip — and ends in a fixed-footprint status slot: a determinate `CircularProgress` while in progress, a check on success, a filled alert icon whose accessible name and tooltip carry the failure reason, or a `Canceled` label with the file name dimmed.

Returns `null` when `jobs` is empty. Auto-closes 8 seconds after **every** job succeeds; a failed, in-progress, or canceled job suppresses the countdown. Prompts for confirmation before closing when any job is still in progress or has failed — a canceled job needs no confirmation, since the user already chose to stop that work.

The `title` is rendered verbatim; the host composes any count into it (`t(key, { count: jobs.length })`).

The panel is 370px wide but never wider than the viewport minus a 1rem gutter on each side, so it stays fully on screen at the 360px mobile floor. Position it with a matching 1rem inset (`bottom-4 end-4`) — a larger inset needs a tighter cap via `styles.rootClassName`.

```tsx
import {
  ConversationTransferErrorCode,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  ConversationTransferUnitKind,
} from '@epam/ai-dial-chat-shared';
import {
  ImportExportQueue,
  type ImportExportQueueColors,
  type ImportExportQueueLabels,
  type ImportExportQueueProps,
  type ImportExportQueueStyles,
  type ImportExportQueueTypography,
} from '@epam/ai-dial-conversation-panel';

const labels: ImportExportQueueLabels = {
  cancelJobAriaLabel: (fileName) => `Cancel ${fileName}`,
  canceledLabel: 'Canceled',
  jobErrorMessage: (code) =>
    code === ConversationTransferErrorCode.FileTooLarge
      ? 'Export failed. File is too large'
      : 'Export failed. Please try again',
  jobProgressAriaLabel: (fileName) => `Exporting ${fileName}`,
  jobProgressValueText: (units) =>
    `${units.completed} of ${units.total} attachments`,
  collapseQueueAriaLabel: 'Collapse queue',
  expandQueueAriaLabel: 'Expand queue',
  closeQueueAriaLabel: 'Close queue',
  closeQueueConfirmHeader: 'Cancel export?',
  closeQueueConfirmDescriptionInProgress: 'Export is still in progress.',
  closeQueueConfirmDescriptionFailed: 'Some exports failed.',
  closeQueueConfirmDescriptionMixed: 'Some exports are in progress or failed.',
  closeLabel: 'Close',
  cancelLabel: 'Cancel',
};

<ImportExportQueue
  title="Exporting 1 file"
  jobs={[
    {
      id: 'job-1',
      subject: {
        kind: ConversationTransferSubjectKind.Single,
        title: 'My chat',
      },
      status: ConversationTransferJobStatus.InProgress,
      fileName: '2026-09-01_ai_dial_chat_with_attachments.dial',
      progress: {
        percent: 36,
        units: {
          completed: 3,
          total: 10,
          kind: ConversationTransferUnitKind.Attachment,
        },
      },
    },
  ]}
  onClose={handleClose}
  onCancel={handleCancel}
  labels={labels}
  styles={{
    colors: { background: '#fff', text: '#161b2d' },
    typography: { titleClassName: 'dial-small-semi-text' },
  }}
/>;
```

The component has no retry control. `retryJob` stays on `useConversationExport` / `useConversationImport` in `@epam/ai-dial-chat-hooks` for hosts that want to re-expose it.

### ImportExportQueueLabels

| Field                                    | Type                                                           | Description                                                  |
| ---------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `cancelJobAriaLabel`                     | `(fileName: string) => string`                                 | Accessible name for cancelling an in-progress job            |
| `canceledLabel`                          | `string`                                                       | Trailing text shown on a canceled row                        |
| `jobErrorMessage`                        | `(code: ConversationTransferErrorCode \| undefined) => string` | Tooltip and accessible name explaining why a job failed      |
| `jobProgressAriaLabel`                   | `(fileName: string) => string`                                 | Accessible name for a row's progress ring                    |
| `jobProgressValueText`                   | `(units: ConversationTransferProgressUnits) => string`         | Spoken value for a row's progress ring                       |
| `collapseQueueAriaLabel`                 | `string`                                                       | Accessible name for the collapse toggle                      |
| `expandQueueAriaLabel`                   | `string`                                                       | Accessible name for the expand toggle                        |
| `closeQueueAriaLabel`                    | `string`                                                       | Accessible name for the close button                         |
| `closeQueueConfirmHeader`                | `string`                                                       | Heading of the close-confirmation dialog                     |
| `closeQueueConfirmDescriptionInProgress` | `string`                                                       | Dialog description when jobs are in progress                 |
| `closeQueueConfirmDescriptionFailed`     | `string`                                                       | Dialog description when jobs have failed                     |
| `closeQueueConfirmDescriptionMixed`      | `string`                                                       | Dialog description when jobs are both in-progress and failed |
| `closeLabel`                             | `string`                                                       | Confirm button label in the dialog                           |
| `cancelLabel`                            | `string`                                                       | Cancel button label in the dialog                            |

### ImportExportQueueStyles

`styles?: ImportExportQueueStyles` groups all customization hooks. `colors?: ImportExportQueueColors` overrides the panel background, primary/secondary text, status icons, progress-ring track and indicator, header divider, and failed-count badge through CSS custom properties. `typography?: ImportExportQueueTypography` provides classes for the title, job file name, canceled label, and failed-count badge. `rootClassName` and `bodyClassName` target the queue root and scrollable job list; `cssVars` is the last-resort CSS-variable escape hatch.

## Utilities

### getTransferFileIcon

Returns the Tabler icon component a transfer row shows for a file name: the
archive icon for `.dial`/`.zip`, the JSON icon for `.json`, and a generic file
icon for anything else. `ImportExportQueue` uses it per row; it is exported for
hosts that render the same file identity elsewhere.

```tsx
import { getTransferFileIcon } from '@epam/ai-dial-conversation-panel';

const FileIcon = getTransferFileIcon('2026-09-01_ai_dial_chat.dial');
```

## RenameConversationPopup

Modal dialog for renaming a conversation. Validates the name (non-empty, ≤ 255 UTF-8 bytes, sanitized of DIAL-prohibited characters), shows a byte-length error, supports AI-generated names via `onGenerateWithAi`, and guards against concurrent generation requests.

```tsx
import {
  RenameConversationPopup,
  type RenameConversationPopupLabels,
  type RenameConversationPopupProps,
  type RenameConversationPopupStyles,
} from '@epam/ai-dial-conversation-panel';

const labels: RenameConversationPopupLabels = {
  popupTitle: 'Rename conversation',
  inputPlaceholder: 'Enter conversation name',
  renameWithAiLabel: 'Rename with AI',
  renameWithAiError: 'Failed to generate name with AI',
  nameTooLongError: 'Name is too long',
  saveLabel: 'Save',
  cancelLabel: 'Cancel',
};

<RenameConversationPopup
  isOpen={isRenameOpen}
  currentTitle={conversation.title}
  isSaving={isRenaming}
  error={renameError}
  onSave={handleSave}
  onCancel={handleCancel}
  onGenerateWithAi={generateConversationTitle}
  labels={labels}
  styles={{ bodyClassName: 'my-popup-body' }}
/>;
```

### RenameConversationPopupLabels

| Field               | Type     | Description                                               |
| ------------------- | -------- | --------------------------------------------------------- |
| `popupTitle`        | `string` | Popup dialog heading                                      |
| `inputPlaceholder`  | `string` | Placeholder text for the name input                       |
| `renameWithAiLabel` | `string` | Accessible name and tooltip for the AI-generation button  |
| `renameWithAiError` | `string` | Error shown when AI name generation fails                 |
| `nameTooLongError`  | `string` | Error shown when the trimmed name exceeds 255 UTF-8 bytes |
| `saveLabel`         | `string` | Label for the save/confirm button                         |
| `cancelLabel`       | `string` | Label for the cancel button                               |

### RenameConversationPopupStyles

`styles?: RenameConversationPopupStyles` exposes `bodyClassName` for the popup content wrapper and `cssVars` for custom properties inherited by the input, spinner, and AI-generation control. The popup shell and action buttons continue to use the UI kit theme.
