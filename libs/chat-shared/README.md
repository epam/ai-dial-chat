# @epam/ai-dial-chat-shared

Shared domain models, utilities, and UI components used across all AI DIAL Chat libraries.

## Overview

`@epam/ai-dial-chat-shared` is the foundational layer of the AI DIAL Chat workspace. It solves the problem of sharing domain knowledge — data shapes, business logic, and common UI — across every feature library without duplicating code or forcing each lib to declare its own conflicting versions. The package covers three areas: (1) **domain models** — TypeScript interfaces and enums for chats, messages, annotations, deployments, themes, and auth sessions that form the lingua franca between libs and apps; (2) **shared utilities** — string helpers, CSS variable builders, clipboard access, avatar colour generation, MIME type constants, and mobile-breakpoint hooks that every lib needs but should not re-implement; and (3) **shared UI components** — `MarkdownRenderer`, `CodeBlock`, `InitialsAvatar`, `DeploymentIcon`, `PanelEmptyState`, which appear in multiple panels and must have a single, consistent implementation. All other workspace libraries list this package as a peer dependency, so changes to the shared models propagate across the entire workspace in a single update.

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
import type { Chat, Message, Annotation } from '@epam/ai-dial-chat-shared';
import type { Deployment, DeploymentFeatures } from '@epam/ai-dial-chat-shared';
import type { Theme, AuthSession, DialModel } from '@epam/ai-dial-chat-shared';
```

## Components

### MarkdownRenderer

Renders markdown content with GFM support (tables, task lists, strikethrough).

```tsx
import { MarkdownRenderer } from '@epam/ai-dial-chat-shared';

<MarkdownRenderer content={markdownText} />;
```

### CodeBlock

Syntax-highlighted code block with a copy button.

```tsx
import { CodeBlock } from '@epam/ai-dial-chat-shared';

<CodeBlock language="typescript" code={snippet} />;
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

<PanelEmptyState
  title="No conversations"
  description="Start a new chat to get going."
/>;
```

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
  mergeClass,
  buildCssVars,
  copyToClipboard,
  formatLastUsed,
  getInitials,
  getAvatarColor,
  isAudioTranscriptionSupported,
} from '@epam/ai-dial-chat-shared';

// Merge conditional class names
const className = mergeClass('base-class', isActive && 'active');

// Generate CSS custom property declarations from a theme object
const vars = buildCssVars(theme);
```

## Constants

```tsx
import { MIME_TYPES, DIAL_CONSTANTS } from '@epam/ai-dial-chat-shared';
```

## Building

```sh
npm exec nx build chat-shared
```

## Testing

```sh
npm exec nx test chat-shared
```
