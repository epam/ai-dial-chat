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

### MarkdownCodeBlock

Syntax-highlighted code block with copy and download buttons. `language` and
`value` are required; pass `isStreaming` to hide the copy button while content is
still arriving.

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
richer catalog model can be passed directly.

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
  colors={{ versionTagText: 'var(--text-accent)' }}
/>;
```

Pass `hasVersionTag={false}` to drop the trailing tag and show the version
inline after the name instead, or pass `children` to render arbitrary content
in the row instead of the entity header.

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
  formatLastUsed,
  formatFileSize,
  formatPrice,
  formatUnitPrice,
  extractInitials,
  pickAvatarColor,
  isAudioTranscriptionSupported,
  downloadTextFile,
  triggerBlobDownload,
  getUtf8ByteLength,
  truncateToUtf8Bytes,
} from '@epam/ai-dial-chat-shared';

// Merge conditional class names — the only supported way to compose classes
const className = mergeClasses('base-class', isActive && 'active');

// Map a *Colors object to CSS custom property declarations; undefined values are dropped
const cssVars = buildCssVars({ '--cs-text': colors?.text });

// Format a USD amount, keeping decimals for sub-dollar values
formatPrice(0.3); // '$0.3'

// Re-quote a DIAL Core per-unit price for display
formatUnitPrice('0.000003', 'token'); // '$3/M tokens'

// Derive an avatar's initials and its deterministic color from a name
const initials = extractInitials(user.displayName);
const { background, foreground } = pickAvatarColor(user.displayName);
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

## Building

```sh
npm exec nx build chat-shared
```

## Testing

```sh
npm exec nx test chat-shared
```
