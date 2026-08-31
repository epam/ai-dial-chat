# @epam/ai-dial-chat-shared

Shared domain models, utilities, and UI components used across all AI DIAL Chat libraries.

## Overview

`@epam/ai-dial-chat-shared` is the foundational layer of the AI DIAL Chat workspace. It solves the problem of sharing domain knowledge — data shapes, business logic, and common UI — across every feature library without duplicating code or forcing each lib to declare its own conflicting versions. The package covers three areas: (1) **domain models** — TypeScript interfaces and enums for conversations, messages, stages, annotations, deployments, themes, and user profiles that form the lingua franca between libs and apps; (2) **shared utilities** — string helpers, CSS variable builders, clipboard access, avatar colour generation, MIME type constants, and mobile-breakpoint hooks that every lib needs but should not re-implement; and (3) **shared UI components** — `MarkdownRenderer`, `MarkdownCodeBlock`, `InitialsAvatar`, `DeploymentIcon`, `EntityHeader`, `PanelEmptyState`, which appear in multiple panels and must have a single, consistent implementation. All other workspace libraries list this package as a peer dependency, so changes to the shared models propagate across the entire workspace in a single update.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-chat-shared": "*"
  }
}
```

## Peer Dependencies

- `react` ^19.2.6
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-react-file-manager` \*
- `ag-grid-community` ^35.3.0
- `@tabler/icons-react`
- `react-markdown`
- `remark-gfm`
- `react-syntax-highlighter`

## Domain Models

```tsx
import type {
  Conversation,
  Message,
  Stage,
  Annotation,
} from '@epam/ai-dial-chat-shared';
import type {
  DeploymentItem,
  DeploymentFeatures,
} from '@epam/ai-dial-chat-shared';
import type { Theme, UserProfile, DialModel } from '@epam/ai-dial-chat-shared';
import type { EntityHeaderItem } from '@epam/ai-dial-chat-shared';
import {
  CatalogEntityType,
  MessageRole,
  MessageRating,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
```

### ConversationTransfer

Types for the queued export/import job model. Consumed by `@epam/ai-dial-conversation-panel`'s `ImportExportQueue` component.

```tsx
import {
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
} from '@epam/ai-dial-chat-shared';
import type {
  ConversationTransferJob,
  ConversationTransferSubject,
} from '@epam/ai-dial-chat-shared';

const job: ConversationTransferJob = {
  id: 'job-1',
  subject: { kind: ConversationTransferSubjectKind.Single, title: 'My chat' },
  status: ConversationTransferJobStatus.InProgress,
};
```

`ConversationTransferJobStatus` values: `InProgress`, `Success`, `Failed`.
`ConversationTransferSubjectKind` values: `Single` (one named conversation), `All` (entire history).
`ConversationTransferSubject` is a discriminated union on `kind`; the `Single` variant carries `title` and optional `sourceBreadcrumb`.

### FilterTab

Canonical conversation ownership/grouping identifiers shared by the headless mapping hooks and the conversation panel. `@epam/ai-dial-conversation-panel` re-exports the same enum for compatibility.

```tsx
import { FilterTab } from '@epam/ai-dial-chat-shared';

FilterTab.All; // 'all'
FilterTab.Pinned; // 'pinned'
FilterTab.MyChats; // 'my-chats'
FilterTab.Shared; // 'shared'
FilterTab.Organization; // 'organization'
```

`CatalogEntityType` is the entity taxonomy (`MODEL`, `AGENT`, `TOOLSET`,
`SKILL`, `PROMPT`) shared by the catalog UI. `ENTITY_TYPE_COLOR` and
`ENTITY_TYPE_BG_COLOR` map each type to its text and surface color.

## Components

### MarkdownRenderer

Renders markdown content with GFM support (tables, task lists, strikethrough).

```tsx
import { MarkdownRenderer } from '@epam/ai-dial-chat-shared';

<MarkdownRenderer content={markdownText} />;
```

### MDMessageViewer

Renders a chat message body as markdown. `classNames` selects the type scale and
defaults to `DEFAULT_MARKDOWN_CLASS_NAMES`; pass `COMPACT_MARKDOWN_CLASS_NAMES`
to drop the body copy (`p`, `strong`) one step while leaving headings, code, and
tables untouched. The component is memoised, so pass a stable reference rather
than an inline object.

```tsx
import {
  COMPACT_MARKDOWN_CLASS_NAMES,
  MDMessageViewer,
} from '@epam/ai-dial-chat-shared';

<MDMessageViewer
  content={message.content}
  isStreaming={isStreaming}
  classNames={isMobile ? COMPACT_MARKDOWN_CLASS_NAMES : undefined}
/>;
```

### MarkdownCodeBlock

Syntax-highlighted code block with copy and download buttons. `language` and
`value` are required; pass `isStreaming` to hide the copy button while content is
still arriving. The copy button keeps `copyLabel` as its accessible name at all
times; `copiedLabel` is announced through the block's own
`role="status" aria-live="polite"` region once the copy succeeds.

```tsx
import { MarkdownCodeBlock } from '@epam/ai-dial-chat-shared';

<MarkdownCodeBlock
  language="typescript"
  value={snippet}
  isStreaming={isStreaming}
  copyLabel="Copy code"
  copiedLabel="Copied!"
/>;
```

### MarkdownTable

Standalone table renderer for structured markdown tables.

```tsx
import { MarkdownTable } from '@epam/ai-dial-chat-shared';
```

### DeploymentIcon

Renders the icon associated with a deployment entity.

```tsx
import { DeploymentIcon } from '@epam/ai-dial-chat-shared';

<DeploymentIcon deployment={deployment} size={24} />;
```

### InitialsAvatar

Generates an avatar from a user's display name with a consistent background color.

```tsx
import { InitialsAvatar } from '@epam/ai-dial-chat-shared';

<InitialsAvatar name="Jane Doe" size={32} />;
```

### PanelEmptyState

Generic empty-state placeholder used inside panels.

```tsx
import { PanelEmptyState } from '@epam/ai-dial-chat-shared';

<PanelEmptyState icon={<IconMessage />} label="No conversations" />;
```

### ItemHeader

Item title row with an optional postfix (version, count) and a trailing slot.
The title is highlighted when a search `query` is supplied and truncates with a
tooltip on overflow. Pass `shouldTruncateTitle={false}` for static section
headings that must always render in full.

```tsx
import { ItemHeader } from '@epam/ai-dial-chat-shared';

<ItemHeader
  title={item.name}
  postfix={item.version}
  query={searchQuery}
  titleClassName="dial-small-semi-text"
  postfixClassName="dial-tiny-text"
  colors={{ title: 'var(--text-primary)', count: 'var(--text-secondary)' }}
/>;
```

### EntityTypeLabel

Entity type rendered as plain uppercase text, colored per type.

```tsx
import { CatalogEntityType, EntityTypeLabel } from '@epam/ai-dial-chat-shared';

<EntityTypeLabel type={CatalogEntityType.Model} />;
```

### FeaturedChip

Featured badge whose text and background colors follow the entity type.

```tsx
import { CatalogEntityType, FeaturedChip } from '@epam/ai-dial-chat-shared';

<FeaturedChip type={CatalogEntityType.Agent} label="Featured" />;
```

### EntityHeader

Entity identity block: deployment icon, type label, name, version, and an
optional featured chip. `item` needs only the `EntityHeaderItem` fields, so any
richer catalog model can be passed directly. `statusBadge` renders an
arbitrary badge in the same corner, ahead of the featured chip.

```tsx
import { EntityHeader } from '@epam/ai-dial-chat-shared';

<EntityHeader
  item={item}
  iconSize={48}
  query={searchQuery}
  featuredLabel="Featured"
  footer={<span>{item.lastUsed}</span>}
/>;
```

### ResourceSummary

Bordered row pairing an entity's identity block with its current-version tag.
Used as the summary row of the Publish flow.

```tsx
import { ResourceSummary } from '@epam/ai-dial-chat-shared';

<ResourceSummary
  item={item}
  versionLabel="Version {version} · current"
  styles={{
    colors: { versionTagText: 'var(--text-accent)' },
    typography: { versionTagClassName: 'dial-tiny-text' },
  }}
/>;
```

Pass `hasVersionTag={false}` to drop the trailing tag and show the version
inline after the name instead, or pass `children` to render arbitrary content
in the row instead of the entity header. The legacy top-level `colors` prop is
still accepted; new consumers should use `styles.colors`.

## Hooks

### useIsMobile

Returns `true` when the viewport matches the mobile breakpoint.

```tsx
import { useIsMobile } from '@epam/ai-dial-chat-shared';

const isMobile = useIsMobile();
```

## Utilities

```tsx
import {
  mergeClasses,
  buildCssVars,
  copyToClipboard,
  copyMarkdownAsRichText,
  markdownToRichTextHtml,
  formatLastUsed,
  formatFileSize,
  formatCost,
  formatPrice,
  formatUnitPrice,
  extractInitials,
  pickAvatarColor,
  isAudioTranscriptionSupported,
  downloadTextFile,
  triggerBlobDownload,
  getUtf8ByteLength,
  truncateToUtf8Bytes,
  sanitizeConversationName,
  stripTrailingDots,
  PROHIBITED_CONVERSATION_NAME_CHARS_RE,
} from '@epam/ai-dial-chat-shared';

// Merge conditional class names — the only supported way to compose classes
const className = mergeClasses('base-class', isActive && 'active');

// Map a *Colors object to CSS custom property declarations; undefined values are dropped
const cssVars = buildCssVars({ '--cs-text': colors?.text });

// Copy markdown as both flavours: rich text for Word/Gmail/Slack, raw markdown for plain-text targets.
// Styling travels inline, so a pasted table keeps its border, header band, dividers, and zebra rows.
copyMarkdownAsRichText(message.content);

// The same HTML on its own, for a caller that writes the clipboard itself or renders an export
const html = markdownToRichTextHtml(message.content);

// Format a USD amount, keeping decimals for sub-dollar values
formatPrice(0.3); // '$0.3'

// Format accumulated USD usage to cents
formatCost(0.788438); // '$0.79'

// Re-quote a DIAL Core per-unit price for display
formatUnitPrice('0.000003', 'token'); // '$3/M tokens'

// Derive an avatar's initials and its deterministic color from a name
const initials = extractInitials(user.displayName);
const { background, foreground } = pickAvatarColor(user.displayName);

// Strip characters DIAL Core rejects in a conversation name (tab, ": ; / \ , = { } % &)
sanitizeConversationName('bad:name/here'); // 'badnamehere'

// Strip trailing dots from a conversation name
stripTrailingDots('My Chat...'); // 'My Chat'

// Regex of the prohibited characters (useful for testing a value before mutating it)
PROHIBITED_CONVERSATION_NAME_CHARS_RE.test('clean name'); // false
```

## Constants

```tsx
import {
  MIME_TYPE_EXT_MAP,
  MIME_TYPE_WILDCARD,
  MIME_TYPE_AUDIO_PREFIX,
  HIDDEN_FILE,
  BASE_MD_ICON_PROPS,
  BASE_LG_ICON_PROPS,
  ENTITY_TYPE_COLOR,
  ENTITY_TYPE_BG_COLOR,
} from '@epam/ai-dial-chat-shared';
```

| Constant                                     | Purpose                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `MIME_TYPE_EXT_MAP`                          | MIME type → file extension, for labels and download file names    |
| `MIME_TYPE_WILDCARD`                         | `*/*`, the "any type accepted" sentinel in attachment allowlists  |
| `MIME_TYPE_AUDIO_PREFIX`                     | `audio/`, used to detect transcription-capable attachment types   |
| `HIDDEN_FILE`                                | `.dial_folder`, the marker file DIAL Core writes into folders     |
| `BASE_MD_ICON_PROPS` / `BASE_LG_ICON_PROPS`  | Default `size`/`stroke` pairs for Tabler icons at each scale step |
| `ENTITY_TYPE_COLOR` / `ENTITY_TYPE_BG_COLOR` | `CatalogEntityType` → text and surface color tokens               |

## Stylesheet

The package ships Tailwind-generated CSS for its components (`DialFileManagerShell`, `OperationLoaderModal`, `UploadProgressModal`, etc.). Import it once in the host application's entry point:

```ts
import '@epam/ai-dial-chat-shared/styles.css';
```

## File Manager

Shared file-manager surface: the `DialFileManagerShell` component, its supporting modals, a headless scroll hook, and the contracts consumed by `@epam/ai-dial-chat-hooks`'s `useDialFileManager`. All i18n strings are resolved by the host and passed as props — the components never call `useTranslation`.

### DialFileManagerShell

Full-featured file-manager grid (backed by `@epam/ai-dial-react-file-manager`) that binds a `FileManagerController` to the complete set of file-management actions. The shell owns the grid rendering, search, upload progress modal, operation loader modal, and bulk-action toolbar. Tabs, active tab, selection, destination picker, and browser-download callback are explicit host props.

```tsx
import {
  DialFileManagerShell,
  type FileManagerController,
  type DialFileManagerShellLabels,
  DialFileManagerVariant,
  DialFileManagerActionProfile,
} from '@epam/ai-dial-chat-shared';

<DialFileManagerShell
  controller={controller} // FileManagerController
  variant={DialFileManagerVariant.Standalone}
  actionProfile={DialFileManagerActionProfile.Browse}
  activeTab={activeTab}
  tabs={tabs}
  onTabChange={setActiveTab}
  selectedPaths={selectedPaths}
  onSelectedPathsChange={setSelectedPaths}
  labels={labels} // DialFileManagerShellLabels
/>;
```

### FileManagerController

Structural interface consumed by `DialFileManagerShell`. Contains exactly the fields of `UseDialFileManagerResult` that the shell reads. A `UseDialFileManagerResult` value is structurally assignable to this interface without a cast. Tabs, active tab, selection, destination picker, and host callbacks are outside this contract.

```ts
import type { FileManagerController } from '@epam/ai-dial-chat-shared';
```

### DialFileManagerShellLabels

Pre-translated strings the shell renders as-is. The shell never calls `useTranslation` — every host passes these via its own i18n.

```ts
import type { DialFileManagerShellLabels } from '@epam/ai-dial-chat-shared';
```

### AttachResult

Result returned by the file-manager attach modal when the user confirms a selection.

```ts
import type { AttachResult } from '@epam/ai-dial-chat-shared';

// { files: DialFile[]; folderPaths: string[] }
```

### FileManagerAttachModal

Controlled attach modal that composes `DialFileManagerShell` with selection state, deduplication, and MIME/size/count validation. The host drives open/close, tab and selection state, resolves folder paths through `resolveFolderPath`, and receives the confirmed `AttachResult` via `onAttach`.

```tsx
import {
  FileManagerAttachModal,
  type FileManagerAttachModalProps,
  type FileManagerAttachModalLabels,
  type AttachResult,
} from '@epam/ai-dial-chat-shared';

<FileManagerAttachModal
  isOpen={isOpen}
  onClose={handleClose}
  onAttach={(result: AttachResult) => {
    /* result.files, result.folderPaths */
  }}
  controller={controller} // FileManagerController
  isAnyOperationInProgress={isUploading}
  activeTab={activeTab}
  tabs={tabs}
  onTabChange={setActiveTab}
  variant={DialFileManagerVariant.Attach}
  actionProfile={DialFileManagerActionProfile.Attach}
  selectedPaths={selectedPaths}
  onSelectedPathsChange={setSelectedPaths}
  resolveFolderPath={resolveFolderPath}
  labels={labels} // FileManagerAttachModalLabels
/>;
```

`FileManagerAttachModalLabels` extends `DialFileManagerShellLabels` with three additional fields:

```ts
import type { FileManagerAttachModalLabels } from '@epam/ai-dial-chat-shared';

// { title: string; attachLabel: string; headerDescription?: string | null }
// … plus every DialFileManagerShellLabels field
```

### DialFileManagerVariant / DialFileManagerActionProfile

Enums that identify the hosting context and the set of grid actions to expose.

```ts
import {
  DialFileManagerVariant,
  DialFileManagerActionProfile,
} from '@epam/ai-dial-chat-shared';

DialFileManagerVariant.Attach; // file-picker attach modal
DialFileManagerVariant.Standalone; // standalone management page

DialFileManagerActionProfile.Attach; // excludes Copy/Move/Duplicate
DialFileManagerActionProfile.Browse; // full action set
```

### Upload batch types

```ts
import {
  FileUploadStatus,
  type FileUploadEntry,
  type FileUploadBatchState,
  type FileUploadValidationResult,
} from '@epam/ai-dial-chat-shared';

// FileUploadStatus values: Queued | Uploading | Completed | Failed | Cancelled
```

### getParentFolderPath

Returns the parent folder of a path (virtual or API), always trailing-slashed.

```ts
import { getParentFolderPath } from '@epam/ai-dial-chat-shared';

getParentFolderPath('reports/file.txt'); // 'reports/'
getParentFolderPath('/My files/reports/'); // '/My files/'
getParentFolderPath('report.pdf'); // ''
```

### useGridEditingScroll

Hook that keeps a cell's inline editor visible when the cell becomes partially obscured during an inline rename. Intended for hosts that embed `DialFileManagerShell` and need editing-scroll behaviour. Also re-exported from `@epam/ai-dial-chat-hooks` for backward compatibility.

```ts
import { useGridEditingScroll } from '@epam/ai-dial-chat-shared';

const { handleGridApiChange, reset } = useGridEditingScroll();
// Pass handleGridApiChange to DialFileManager's onGridApiChange prop.
// Call reset() when the data source changes (e.g. on a tab switch).
```

### OperationLoaderModal / UploadProgressModal

Internal modals already rendered by `DialFileManagerShell`. Exported for hosts that need to compose them independently outside the shell.

```tsx
import {
  OperationLoaderModal,
  UploadProgressModal,
} from '@epam/ai-dial-chat-shared';
```

## Building

```sh
npm exec nx build chat-shared
```

## Testing

```sh
npm exec nx test chat-shared
```
