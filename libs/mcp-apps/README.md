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

Fetches an MCP App's `ui://` resource and resolves its seeded tool result for a compact inline preview.

```tsx
import { useMcpAppInlinePreview } from '@epam/ai-dial-mcp-apps';

const { status, content, reload } = useMcpAppInlinePreview(
  match,
  toolCall,
  cache,
  cacheKey,
  hostAdapter,
);
```

## Components

### `McpAppInlinePreview`

Renders a compact, always-visible preview of a message's matched MCP App, with a reload button and an expand-to-canvas button.

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
  loadErrorLabel="Failed to load app"
/>;
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
