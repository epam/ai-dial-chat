# @epam/ai-dial-mcp-apps

Host-agnostic MCP Apps building blocks shared between a message's inline preview and a full-width attachment canvas.

## Overview

`@epam/ai-dial-mcp-apps` centralizes the logic that is identical whether an MCP App is rendered inline under a message or opened full-width in a canvas: matching a message's real tool call against a discovered MCP App tool, resolving the tool result it should be seeded with, and caching a fetched resource/tool-result pair so switching between the two surfaces for the same message doesn't repeat the fetch or re-invoke the tool. It also ships `useMcpAppInlinePreview` and `McpAppInlinePreview`, the compact inline surface itself.

Everything that requires host context — the current theme/locale, the configured API client, routing to the operator's sandbox-proxy — is intentionally left out of this library. Callers inject it through `McpAppHostAdapter`. Use this library whenever a host renders MCP Apps and needs the message-matching/caching logic, or the inline preview, without re-implementing it per surface.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-mcp-apps": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-mcp-apps/styles.css';
```

## Peer Dependencies

- `react`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Hooks

### `useMcpAppResponseCache`

In-memory, per-conversation cache of a fetched MCP App resource plus its resolved tool result, keyed by a caller-supplied key and the seed it was resolved from.

```tsx
import { useMcpAppResponseCache } from '@epam/ai-dial-mcp-apps';

const cache = useMcpAppResponseCache(conversationId);
```

### `useMcpAppInlinePreview`

Fetches an MCP App's `ui://` resource and resolves its seeded tool result for a compact inline preview. The optional sixth argument is forwarded to the mounted app's `ui/request-display-mode` handler — this hook has no opinion on surface switching, so the host decides what a mode request does.

```tsx
import { useMcpAppInlinePreview } from '@epam/ai-dial-mcp-apps';

const { status, content, reload } = useMcpAppInlinePreview(
  match,
  toolCall,
  cache,
  cacheKey,
  hostAdapter,
  onRequestDisplayMode,
);
```

## Components

### `McpAppInlinePreview`

Renders a compact, always-visible preview of a message's matched MCP App, with a header strip above the preview frame (styled like the code block header in `@epam/ai-dial-chat-shared`'s Markdown renderer — small ghost icon buttons in a bordered `min-h-10` header) carrying a reload button and an expand-to-canvas button. An app's `ui/request-display-mode` request for `'fullscreen'` expands into the canvas via `onExpand` — the same surface the expand button opens; any other requested mode keeps the preview, and the app is answered with `'inline'`.

```tsx
import { McpAppInlinePreview } from '@epam/ai-dial-mcp-apps';

<McpAppInlinePreview
  match={match}
  toolCall={toolCall}
  cache={cache}
  cacheKey={cacheKey}
  hostAdapter={hostAdapter}
  onExpand={handleExpand}
  expandAriaLabel="Open in full view"
  reloadAriaLabel="Reload"
  actionsGroupAriaLabel="MCP app actions"
  loadErrorLabel="Failed to load app"
/>;
```

#### Colors

The preview's surface and its two borders are themable through
`McpAppInlinePreviewColors`, applied as CSS custom properties on the preview's
root. Each falls back to this design system's token, and then to the light
literal, so passing nothing keeps the stock look:

```tsx
import type { McpAppInlinePreviewColors } from '@epam/ai-dial-mcp-apps';

const colors: McpAppInlinePreviewColors = {
  previewBackground: 'var(--my-surface)', // --bg-layer-raised
  previewBorder: 'var(--my-border)', // --stroke-tertiary
  previewHeaderBorder: 'var(--my-border-soft)', // --stroke-tertiary
};

<McpAppInlinePreview {...props} colors={colors} />;
```

## Utilities

- `findMcpAppForMessage(message, mcpAppTools)` — matches a message to the MCP App tool it called, or the deployment's first discovered tool.
- `resolveMcpAppToolCallSeed(message, toolName)` — extracts a message's real tool-call arguments/result as an `McpAppToolCallSeed`.
- `resolveMcpAppToolResult(match, seed, callTool)` — resolves the tool result an app should be seeded with, live-re-calling `callTool` when the match is unambiguous.
- `computeMcpAppSeedKey(toolCall)` — identifies which seed a cache entry was resolved from.
- `collectToolCallNames(messages)` — collects every real tool-call name seen across a conversation's messages.
- `mcpAppCanvasKey(messageIndex)` — stable per-message cache/canvas key.

## Types

- `McpAppToolRef`, `McpAppToolCallSeed`, `McpDeploymentKind`
- `McpAppHostAdapter`, `FetchMcpAppResourceHtml`, `CallMcpAppTool`
- `McpAppResponseCache`, `CachedMcpAppResponse`
- `McpAppInlinePreviewStatus`, `McpAppInlinePreviewState`, `McpAppInlinePreviewProps`

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key             | Class                          | Element                                                     |
| --------------- | ------------------------------ | ----------------------------------------------------------- |
| `preview`       | `dial-mcp-apps-preview`        | The preview's bordered outer card                           |
| `previewHeader` | `dial-mcp-apps-preview-header` | The header strip above the mounted app, holding its actions |

```tsx
import { MCP_APPS_CLASS } from '@epam/ai-dial-mcp-apps';

MCP_APPS_CLASS.previewHeader; // 'dial-mcp-apps-preview-header'
```

The header sits outside the mounted app's own content, so restyling it never
overlaps whatever the app draws.

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
