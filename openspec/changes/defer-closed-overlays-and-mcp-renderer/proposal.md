## Why

A cold-load CPU profile of `/` (built `apps/chat` in `vite preview`, 150 ms RTT, ~6.4 Mbit/s, 4× CPU throttle, empty cache; LCP 3460–4920 ms over two runs) shows two avoidable costs before the greeting paints:

- The conversation route's static import graph is 289 KB gzip across 24 chunks, and the route cannot render until all of it has arrived and run. 102 KB of it is the MCP Apps stack (`zod`, `@mcp-ui/client`, `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`). Evaluating that chunk took 229 ms of main-thread time; 116 ms of that was `zod` building its schemas at module scope. Only a message with an MCP App ever needs the stack, and the home page has no messages.
- Lazy components that start closed still mount, so their chunks download while the route is loading. They arrive in two extra waves (about 2.6 s and 3.2 s in the profile) and compete with the route for bandwidth and CPU. The components are `ConversationSourcesPanel`, `McpAppCanvasContainer` (with `AttachmentCanvasBody`), `SigninInterruptDialog`, `OnboardingHints`, and `CatalogModal`/`PromptCatalogModal`, which are mounted with `isOpen={false}`.

## What Changes

- `@epam/ai-dial-attachment-canvas` gains a subpath export, `@epam/ai-dial-attachment-canvas/mcp-app-renderer`, that exposes only `McpAppCanvasRenderer` and its props type.
  - The root export keeps `McpAppCanvasRenderer`, so the change is not breaking for existing hosts.
  - The subpath exists because the entry statically imports the root barrel (through `AttachmentCanvasProvider`). An `import()` of that barrel would split nothing off.
- `McpAppInlinePreview` (`libs/mcp-apps`) loads the renderer lazily from that subpath:
  - The import starts when the preview mounts, in parallel with the resource fetch it already performs.
  - While the renderer loads, the preview keeps showing its existing loading spinner.
  - The conversation route's static graph no longer contains the MCP Apps stack.
- `apps/chat` no longer mounts these closed lazy components at first render. Each one mounts, still closed, at the first idle period after the document `load` event. If it has something to show earlier, it mounts then. Either way it stays mounted afterwards:

  | Component | Mounts earlier when |
  | --- | --- |
  | `ConversationSourcesPanel` | the sources sidebar opens |
  | `McpAppCanvasContainer` | the attachment canvas opens |
  | `SigninInterruptDialog` | a sign-in event is pending |
  | `CatalogModal`, `PromptCatalogModal` | the modal opens |

- `OnboardingHints` already waits a start delay before it shows anything. It now also mounts only at that post-load point.
- Mounting closed after `load` keeps today's intent for the sources panel and the canvas. Today their chunks are fetched at mount on purpose ("in place by the first click"), and the first open still animates from the closed state. They just no longer download in the critical window.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-cold-load-performance` — adds two requirements:
  - The conversation route's static graph excludes the MCP Apps stack.
  - Closed lazy overlays mount, and so request their chunks, only at the post-load idle point or when they first open.
- `attachment-canvas-package-loading` — adds the `./mcp-app-renderer` subpath. It is required to resolve to a real build artifact that carries its own styles, and the root export stays.

## Impact

- **Code:**
  - `libs/attachment-canvas`: `package.json` exports, `vite.config.mts` entries, a new subpath entry module, README.
  - `libs/mcp-apps`: `McpAppInlinePreview.tsx`, `vite.config.mts` externals, README.
  - `apps/chat`:
    - `src/app/app.tsx`
    - `src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx`
    - `src/components/DeploymentSelector/useDeploymentSelectorFieldOverlay.tsx`
    - `src/components/PromptSelector/usePromptSelectorOverlay.tsx`
    - new: `src/utils/load-idle.ts`, `src/hooks/useIsAfterLoadIdle.ts`, `src/hooks/useDeferredOverlayMount.ts`, `src/components/SigninInterruptGate/`, `src/components/PromptSelector/PromptCatalogGate.tsx`
  - `libs/chat-shared`: `useHasBeenTrue`
  - Vite configs that alias `@epam/ai-dial-attachment-canvas` to source (`apps/chat`, `libs/chat-hooks`, `libs/toolset-editor`, `libs/mcp-apps`) gain the subpath alias.
- **Public API:** additive. The new subpath is added and nothing is removed. A host that imports `McpAppCanvasRenderer` from the root keeps working.
- **Behaviour:**
  - The panels, dialogs and modals behave the same once open.
  - Opening one before its idle preload finishes shows the existing `Suspense` fallback (`null`) for the time the chunk takes to load.
  - An MCP App inline preview shows its spinner until the renderer chunk has arrived.
- **Docs:** `libs/attachment-canvas/README.md`, `libs/mcp-apps/README.md`, `.claude/rules/bundle-performance.md` ("Lazy-load what is not on screen at first paint"), `docs/architecture.md` if the lazy-boundary summary names these components.
