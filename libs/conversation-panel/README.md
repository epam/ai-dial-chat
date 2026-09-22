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

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-conversation-panel/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### ConversationPanel

Root component. Renders the full panel with header, search, tab filters, grouped list, and empty states.

`isOpen` animates the panel's layout width so it pushes the content beside it.
When the host positions the panel over the content instead — via `className`, as
the mobile layout does — pass `isOverlay` so the panel slides in and out at full
width rather than collapsing in place.

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

The row is the ui-kit's `FilterChips`, which draws each filter as a `Tag` in
its `TagAppearance.Selectable` appearance, so the chips take their colors from
the active theme's tag tokens. This component only maps the panel's vocabulary
onto it: `FilterTab` values, the host's `filterLabels`, and `hiddenSources` as
an exclusion list.
It is a named `role="group"` of toggle chips — the selected one carries
`aria-pressed` — not a `tablist`, because the chips filter the list in place
rather than switching between panels. `labels.filterLabels.groupAriaLabel` names
the group and defaults to `"Filter chats"`;
`styles.typography.tabClassName` sets the label typography and defaults to
`'dial-tiny-semi-text'`.

### Corner radii

The panel's controls take their corner radius from CSS custom properties, so a
host sets them once instead of passing a class per control. Each falls back to
the value the panel has always rendered:

| Property             | Applies to                     | Default   |
| -------------------- | ------------------------------ | --------- |
| `--cp-row-radius`    | Each conversation row's button | `0.75rem` |
| `--cp-search-radius` | The search field               | `9999px`  |

```css
/* a host that wants 8px rows under a 12px search field */
:root {
  --cp-row-radius: 8px;
  --cp-search-radius: 12px;
}
```

The New chat button is not on this list on purpose: it is a labelled button, so
it reads the ui-kit's own `--radius-control` and stays in step with every other
button in the host app.

`styles.searchWrapperClassName` remains for anything else the search wrapper
needs; a `rounded-*` utility passed there still wins over `--cp-search-radius`,
since a host's utilities are emitted after this package's stylesheet.

### Header

The panel renders a 64 px header inside `SidebarPanel`. `styles.headerClassName`
is merged after that height and `styles.headerActionsClassName` onto the cluster
holding `headerActions` and the panel toggle, so a `h-*` or `gap-*` passed here
replaces the default rather than competing with it at equal specificity — which
is what a rule on `.dial-sb-header` does:

```tsx
<ConversationPanel
  {...props}
  headerActions={<CollapseButton />}
  styles={{
    headerClassName: 'h-[56px] px-4',
    headerActionsClassName: 'gap-2',
  }}
/>
```

## Public class names

The panel's controls carry stable `dial-cp-*` classes in addition to their
internal classes. Target those instead of DOM-order selectors or hashed
CSS-module names. The names are exported so you never hardcode them:

```tsx
import { CONVERSATION_PANEL_CLASS } from '@epam/ai-dial-conversation-panel';

CONVERSATION_PANEL_CLASS.search; // 'dial-cp-search'
```

| Class                     | Element                                             |
| ------------------------- | --------------------------------------------------- |
| `dial-cp-new-chat-button` | The new-chat button                                 |
| `dial-cp-search`          | The `role="search"` wrapper around the search field |

The panel renders inside `SidebarPanel`, so `dial-sb-aside` and
`dial-sb-header` from `@epam/ai-dial-sidebar` are available on the surrounding
chrome.

These classes carry no declarations of their own, so they change nothing until
you style them.

### Replacing fragile selectors

| Instead of                                                             | Use                               |
| ---------------------------------------------------------------------- | --------------------------------- |
| `[role='complementary'] > div:nth-child(2) > div:first-child > button` | `.dial-cp-new-chat-button`        |
| `[role='search'] .dial-kit-input`                                      | `.dial-cp-search .dial-kit-input` |

`dial-kit-input` is itself a public class of `@epam/ai-dial-ui-kit`, so
descending to it from `dial-cp-search` is supported — what was fragile was the
`role='search'` half.

### Stability

A `dial-cp-*` class is public API: renaming it, removing it, or moving it to a
different element is a breaking change, announced in the release notes and
recorded here with its replacement. The element itself stays free — its Tailwind
utilities, its CSS-module class, and its position in the DOM may all change.

Your own overrides are responsible for direction: the class names are
direction-agnostic and identical under `dir="rtl"`, so use CSS logical
properties (`padding-inline-start`, `inset-inline-end`) rather than physical ones.

The full convention is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

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

## ImportExportQueue

Floating queue panel that shows the status of in-flight or recently completed export/import jobs. Each row is identified by the **file** the job transfers — a file-type icon derived from the extension plus the file name, truncated with a tooltip — and ends in a fixed-footprint status slot: the UI kit `Spinner` while in progress, a check on success, a filled alert icon whose accessible name and tooltip carry the failure reason, or a `Canceled` label with the file name dimmed.

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
  jobWarningMessage: () => 'Some attachments could not be exported.',
  queueProgressAriaLabel: 'Export progress',
  queueProgressValueText: (completed, total) =>
    `${completed} of ${total} files done`,
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

An `InProgress` row shows an indeterminate spinner, never its own percentage. The one place `progress.percent` is rendered is the **collapsed** queue: while collapsed with at least one job still in progress, a determinate progress bar sits under the header showing the mean percent across all jobs. Expanded, the per-row spinners already convey activity, so no bar is drawn.

A job with status `Warning` — one that delivered its file but skipped part of it, such as an attachment that could not be downloaded — renders an amber icon named by `jobWarningMessage(job.warningCode, job.warningNames)`. It is not counted in the failed-count badge and raises no close confirmation, but it does suppress the success-only auto-close, so a warning is never dismissed before it is read.

Import jobs provide unique skipped attachment names in `job.warningNames`. Use the optional second label argument to interpolate the host translation, and provide generic text when names are absent. The callback result is used for both the tooltip and accessible name. Existing callbacks that accept only the code continue to work.

### ImportExportQueueLabels

| Field                                    | Type                                                                               | Description                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `cancelJobAriaLabel`                     | `(fileName: string) => string`                                                     | Accessible name for cancelling an in-progress job                        |
| `canceledLabel`                          | `string`                                                                           | Trailing text shown on a canceled row                                    |
| `jobErrorMessage`                        | `(code: ConversationTransferErrorCode \| undefined) => string`                     | Tooltip and accessible name explaining why a job failed                  |
| `jobProgressAriaLabel`                   | `(fileName: string) => string`                                                     | Accessible name for a row's in-progress spinner                          |
| `jobWarningMessage`                      | `(code: ConversationTransferWarningCode \| undefined, names?: string[]) => string` | Tooltip and accessible name explaining what a warned job left out        |
| `queueProgressAriaLabel`                 | `string`                                                                           | Accessible name for the collapsed queue's aggregate progress bar         |
| `queueProgressValueText`                 | `(completed: number, total: number) => string`                                     | The aggregate bar's `aria-valuetext`, given settled and total job counts |
| `collapseQueueAriaLabel`                 | `string`                                                                           | Accessible name for the collapse toggle                                  |
| `expandQueueAriaLabel`                   | `string`                                                                           | Accessible name for the expand toggle                                    |
| `closeQueueAriaLabel`                    | `string`                                                                           | Accessible name for the close button                                     |
| `closeQueueConfirmHeader`                | `string`                                                                           | Heading of the close-confirmation dialog                                 |
| `closeQueueConfirmDescriptionInProgress` | `string`                                                                           | Dialog description when jobs are in progress                             |
| `closeQueueConfirmDescriptionFailed`     | `string`                                                                           | Dialog description when jobs have failed                                 |
| `closeQueueConfirmDescriptionMixed`      | `string`                                                                           | Dialog description when jobs are both in-progress and failed             |
| `closeLabel`                             | `string`                                                                           | Confirm button label in the dialog                                       |
| `cancelLabel`                            | `string`                                                                           | Cancel button label in the dialog                                        |

### ImportExportQueueStyles

`styles?: ImportExportQueueStyles` groups all customization hooks. `colors?: ImportExportQueueColors` overrides the panel background, primary/secondary text, status icons (success, error, and warning), header divider, and failed-count badge through CSS custom properties. The aggregate progress bar has no entry: it is the UI kit's `ProgressBar`, which themes its own track and fill. `typography?: ImportExportQueueTypography` provides classes for the title, job file name, canceled label, and failed-count badge. `rootClassName` and `bodyClassName` target the queue root and scrollable job list; `cssVars` is the last-resort CSS-variable escape hatch.

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
