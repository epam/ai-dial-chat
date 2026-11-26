## Context

A cold-load CPU profile of `/` was taken against a production `apps/chat` build in `vite preview`, with the API proxied to a local chat-api. Throttling: 150 ms RTT, ~6.4 Mbit/s down, 4× CPU, cache disabled. Source maps attributed the time. The build included the head-script prefetch from #9982.

| Time (ms) | What happens |
| --- | --- |
| 220–1200 | `vendor` (212 KB gz) and `app-shell` (203 KB gz) download |
| 1070–1640 | they evaluate |
| ~1640 | the conversation route module (`apps/chat/src/pages/Conversation/Conversation`, preloaded at module scope as `conversationPageModule`) is requested with its static closure: 24 chunks, 289 KB gz. The last one arrives at ~2850 ms |
| ~2590, ~3170 | two more waves fetch the chunks of closed overlays |
| 3460–4920 | LCP (the greeting `H1`) over two runs |

Before LCP the main thread was busy for 2133 ms and idle for 1104 ms. The idle time is waiting on the network.

The two largest chunks in the route's closure are:

- **`McpAppCanvasRenderer-*.js`: 102 KB gz.** It holds `zod` (362 KB of source), `@mcp-ui/client` (335 KB), `@modelcontextprotocol/sdk` (134 KB) and `@modelcontextprotocol/ext-apps`. Its module evaluation took 229 ms; `zod` schema construction alone took 116 ms. The chunk is imported statically by the shared conversation chunk through this chain: `ConversationView` → `McpAppInlinePreview` (`libs/mcp-apps`) → `import { McpAppCanvasRenderer } from '@epam/ai-dial-attachment-canvas'`.
- **The markdown engine chunk: 100 KB gz** (unified, `hast-util-raw`/parse5, micromark). `AgentDescription` on the welcome screen uses it, so it is out of scope here (see Non-Goals).

`AttachmentCanvasBody` already loads `McpAppCanvasRenderer` lazily from its own relative path. The static import in `McpAppInlinePreview` is the only reason the stack sits in the route closure.

The waves at ~2.6 s and ~3.2 s come from lazy components that `apps/chat/src/app/app.tsx` and the selector overlay hooks render while closed:

- `ConversationSourcesPanel`
- `McpAppCanvasContainer`, which renders `AttachmentCanvasBody`
- `SigninInterruptDialog`, which returns `null` without events
- `OnboardingHints`
- `CatalogModal` and `PromptCatalogModal`, rendered with `isOpen={false}`

A mounted `React.lazy` component requests its chunk on first render even when it renders nothing. For the canvas this is deliberate today: the comment in `app.tsx` says the chunk "starts loading as soon as a canvas route mounts, so it is in place by the first click".

## Goals / Non-Goals

**Goals:**

- Remove the MCP Apps stack from the conversation route's static closure without changing MCP App behaviour.
- Keep closed overlays from requesting chunks before first paint, and keep their first open about as fast as today.
- Keep both changes additive for hosts of the published libs.

**Non-Goals:**

- The markdown engine in the route closure. It is legitimately used on the welcome screen by `AgentDescription` when the agent has a description. Moving it needs a decision about a plain-text fallback for that description, which is a separate change.
- CPU inside the initial chunks: react-dom rendering, kit `EllipsisTooltip` truncation measurement, i18next, tailwind-merge. That is a separate profile-driven change; the kit part belongs in the UI kit repository.
- Changing which overlays exist, their content, or their open/close triggers.

## Decisions

### D1. A subpath export for the renderer, not a dynamic import of the root

`McpAppInlinePreview` will load the renderer with `lazy(async () => { const module = await import('@epam/ai-dial-attachment-canvas/mcp-app-renderer'); return { default: module.McpAppCanvasRenderer }; })`, declared at module scope.

**Alternatives considered:**

- **`import('@epam/ai-dial-attachment-canvas')`.** It would split nothing. The entry already imports that barrel statically (`AttachmentCanvasProvider` in `AppRoot.tsx`), and the namespace access would keep every export alive. The MCP stack would land in the entry instead, which is the trap `.claude/rules/bundle-performance.md` describes.
- **A relative import into the other lib's `src/`.** It breaks the package boundary and the published build.
- **Passing a renderer component in as a prop from the app.** It works, but every host of `libs/mcp-apps` would have to wire the same lazy import. The lib already depends on `@epam/ai-dial-attachment-canvas` for exactly this component, so the lib keeps owning the choice.

**The subpath:**

- It follows the existing multi-entry pattern (`libs/celebrations`: `./new-year`, `./halloween`).
- The `exports` entry is `{ "@epam/source": "./src/mcp-app-renderer.ts", "types": "./dist/mcp-app-renderer.d.ts", "import": "./dist/mcp-app-renderer.js", "default": "./dist/mcp-app-renderer.js" }`. Exact file names are confirmed against the build output in tasks.
- `vite.config.mts` gains a second `lib.entry`.
- The renderer module is already a dynamic entry (`AttachmentCanvasBody` imports it lazily), so `associateDynamicChunkCss` already prepends its CSS import. Tasks verify that the new static entry keeps that import.
- `libs/mcp-apps/vite.config.mts` lists the externals as exact strings, so the subpath is added next to `@epam/ai-dial-attachment-canvas`.
- Found during implementation: the renderer becomes a chunk shared by both entries, and its CSS left `index.css`. `associateDynamicChunkCss` now prepends the CSS import to every non-entry chunk, not only dynamic ones, so either entry gets a styled renderer.
- Found during implementation: `apps/chat`, `libs/chat-hooks`, `libs/toolset-editor` and the `libs/mcp-apps` tests alias `@epam/ai-dial-attachment-canvas` to `src/index.ts` with a string key, and a string alias also matches subpaths. Each gets a `./mcp-app-renderer` alias placed before the root one.

### D2. Start the renderer import at preview mount, show the existing spinner

The preview renders `McpAppCanvasRenderer` only once `status === McpAppInlinePreviewStatus.Ready`. A plain `lazy` component would start its download only then, after the resource fetch, and add a round trip.

So the preview calls the same module-scope loader in a mount effect, so the chunk downloads during the resource fetch. The `Suspense` around the renderer uses the existing `Spinner` with `loadingAriaLabel` as its fallback, so the user sees one continuous loading state.

A rejected import is caught by an error boundary inside the preview and mapped to the existing error state. The reload action (`attemptId`) also resets that boundary, so the import is retried. The lazy reference is recreated after a failure, the same pattern `AttachmentCanvasBody` uses with `createMcpAppCanvasRenderer`.

### D3. Mount closed at the post-load idle point, or on first open; keep mounted

**Revised during implementation.** The first version mounted each overlay only on its first open. `SidebarPanel` (`libs/sidebar`), which the canvas and the sources panel render, animates opening as a width transition from 0. Mounted already open, it starts at full width, so the first open would snap instead of slide.

So an overlay now mounts **closed** at the post-load idle point (D4), which is also what loads its chunk. An overlay opened before that point mounts at once, already open; that is the only case without the opening transition.

`useDeferredOverlayMount(isOpen)` (`apps/chat/src/hooks/useDeferredOverlayMount.ts`) makes that decision: `useHasBeenTrue(isOpen) || useIsAfterLoadIdle()`. Every gate uses it:

| Overlay | Gated in | Why there |
| --- | --- | --- |
| `ConversationSourcesPanel`, `McpAppCanvasContainer` | `apps/chat/src/app/app.tsx`, next to the existing route conditions | `App` already reads `useSourcesSidebar` and `useAttachmentCanvas`, so it already re-renders on these toggles, and a separate gate component would save nothing |
| `SigninInterruptDialog` | `SigninInterruptGate` (`apps/chat/src/components/SigninInterruptGate/`) | `App` does not read the client channel; the gate keeps its updates out of `App` |
| `CatalogModal` | `useDeploymentSelectorOverlay`, `useDeploymentSelectorFieldOverlay` | — |
| `PromptCatalogModal` | `PromptCatalogGate` (`apps/chat/src/components/PromptSelector/PromptCatalogGate.tsx`) | the prompt selector renders the catalog from a callback, where hooks cannot run |

**Alternatives considered:**

- **Mount only while open.** This would unmount on close, breaking close transitions and focus return. For `SigninInterruptDialog` it would also cut off the success announcement that follows the last resolved event.
- **Mount on first open only**, the first version. It loses the first-open transition, as described above.

**`useHasBeenTrue(value: boolean): boolean`:**

- It lives in `libs/chat-shared/src/hooks/useHasBeenTrue.ts`, exported from `@epam/ai-dial-chat-shared`.
- It is host-agnostic logic, which `.claude/rules/apps.md` says belongs in a lib.
- It is state updated during render, React's pattern for adjusting state when a value changes, so the render that sees `value` turn true already returns true.

### D4. The post-load idle point

`scheduleAfterLoadIdle(callback)` (`apps/chat/src/utils/load-idle.ts`) defines the point:

- It waits for the document `load` event, or starts at once if `document.readyState === 'complete'`.
- It then calls `requestIdleCallback(callback, { timeout: 2000 })`, falling back to a 2000 ms `setTimeout` where `requestIdleCallback` is unavailable (Safari).
- The fallback first used 200 ms. That was raised because in a single-page app `load` fires while the route is still rendering (about 2.3 s against an LCP of about 4.6 s in the lab profile), and 200 ms would land in the middle of it.
- Once reached, the point is remembered, so a later caller runs at once.

`useIsAfterLoadIdle()` (`apps/chat/src/hooks/useIsAfterLoadIdle.ts`) exposes it to components.

The first version also had `preloadAfterLoad`, a separate `import()` per overlay at that point. It became redundant once mounting the overlay is what loads its chunk, and it was removed.

A plain idle callback without waiting for `load` was rejected. The profile shows the main thread idle for ~1.1 s before LCP, waiting on the network, so idle alone would fire inside the critical window and change nothing.

**Revised: wait for the first screen too.** `load` alone proved too early. With a slower backend, LCP landed at ~5.8 s while `load` fired at ~2 s, so the "deferred" wave, ~730 KB of lazy JS including the catalog, the file manager and ag-grid, downloaded before LCP. A CPU profile showed the overlays rendering inside the 1.9 s task that paints the greeting. Hooks mounted inside the route after `load` saw `readyState === 'complete'` and scheduled at once.

So the point now also waits for `markFirstScreenRendered()`, which `ConversationView` calls on its first commit:

- The first commit of the conversation view is the first screen of every route that renders a conversation, `/` included.
- A route that never calls it stops waiting 3000 ms after `load`.
- Only then does the idle callback run.

This is still not a hard guarantee, since the 2000 ms idle bound can fire while a later render is running, but it no longer depends on `load` happening to coincide with the first paint.

### D6. Messages load outside the home route's graph

A source-mapped build showed that the markdown engine (unified, micromark, `hast-util-raw`; 100 KB gz) and the shared conversation chunk reached the home route only through `ConversationMessageItem`. Its message bubbles, stages and citations import the markdown renderer statically, and an empty conversation renders none of them.

The first guess, `AgentDescription`, was wrong: that component is already lazy behind `ShowAgentDescription`.

`ConversationView` now renders messages through `ConversationMessageItemLoader`, following the same pattern as `ConversationInputLoader`:

- `loadConversationMessageItem()` loads the chunk once.
- `app.tsx` starts it at module scope on every entry path except `/`, where messages can be LCP. On `/` it starts at the post-load idle point.
- When the module is already in memory, the message renders directly and skips React's ~300 ms Suspense fallback throttle.

### D7. The skill details panel

The `@epam/ai-dial-skills` skill selector always renders its host-supplied `detailsPanelComponent`, with `skillId={null}` while closed. The app passed the lazy `SkillDetailsPanelContainer` straight in, so the composer on `/` fetched that chunk at first render. Through it came the catalog, credentials rows, the file manager grid with ag-grid, the canvas body and markdown: the largest single pre-LCP download.

The app now passes `SkillDetailsPanelGate`, which mounts the container through `useDeferredOverlayMount(skillId != null)`. The lib is unchanged and still supplies the `Suspense` boundary.

### D5. Verification tooling

`scripts/check-route-graph.mjs` is a new local verification script, like `measure-initial-bundle.mjs`, not a CI gate.

- It reads a `vite build --sourcemap` output and walks the static `import` closure of a named chunk, skipping chunks the entry already holds.
- It lists the packages found through each chunk's source map `sources`, and fails when a forbidden package (`zod`, `@mcp-ui/client`, `@modelcontextprotocol/*`) is reachable from the conversation route chunk.
- The before/after LCP comparison reuses the lab procedure from the earlier analysis: the same throttling, alternating runs, LCP plus request start times. Results are reported as a lab proxy.

## Risks / Trade-offs

- **[Risk] A user opens the canvas or the sources panel before the post-load idle point, for example on a very fast first click.** The panel mounts already open, without its opening transition, and appears once its chunk arrives, with a `null` fallback. → The point is at most ~2 s after `load`, and a later open is the common case.
- **[Risk] The deferred wave can still overlap a later render on slow devices (see D4).** → It now waits for the conversation view's first commit, not just `load`.
- **[Risk] A new route that renders a first screen without `ConversationView` waits out the 3000 ms fallback.** → Its overlays then mount ~3 s after `load`, which is safe, only later than necessary. Such a route can call `markFirstScreenRendered` itself.
- **[Risk] On `/`, the first message sent before the idle point renders through `lazy`.** → It appears once its chunk arrives, which is the same chunk the route used to fetch up front.
- **[Risk] An MCP App preview now waits on the renderer chunk as well as the resource.** → The import starts at mount, in parallel with the resource fetch, and the chunk is cached after the first preview.
- **[Risk] A host of the published `libs/mcp-apps` build must resolve the new subpath.** → Both packages ship from this repo at the same version; the subpath is an additive export, and the consumer fixture build is part of verification.
- **[Risk] The latch keeps an overlay mounted after its first use, holding memory that an unmount-on-close design would release.** → This is unchanged from today, where these overlays are always mounted.
- **[Trade-off] Two small gate components (`SigninInterruptGate`, `PromptCatalogGate`) add indirection.** → Each exists for a concrete reason given in D3: keeping client-channel updates out of `App`, and getting a hook inside a render callback.

## Results (lab proxy)

Measured in `vite preview` against a local chat-api with 150 ms RTT, ~6.4 Mbit/s down, 4× CPU throttle, an empty cache and an authenticated session. There were 7 runs each, alternating before and after.

| | Before | After |
| --- | --- | --- |
| Home LCP median | 5020 ms | 4632 ms |
| Home LCP p95 | 5948 ms | 4860 ms |
| Conversation route closure | 24 chunks, 289.0 KB gz | 23 chunks, 186.8 KB gz |
| MCP Apps stack in that closure | yes | no |
| Overlay chunks before LCP | all eight, every run | `AttachmentCanvasBody` (shared) only |

The initial graph stays at 476 KB JS gz and 35 KB CSS gz. The extra 0.5 KB JS gz is the new hooks.

**Second round** (D4 revision, D6, D7). The local chat-api was restarted between rounds and answered more slowly, so absolute LCP is higher. Each row compares against the first-round build under the same conditions, with 7 alternating runs.

| | First round | Second round |
| --- | --- | --- |
| Home LCP median | 6588 ms | 5872 ms |
| Lazy JS requested before LCP (median) | 732 KB | 136 KB |
| Conversation route closure | 23 chunks, 186.8 KB gz | 13 chunks, 45.1 KB gz |
| Markdown engine in that closure | yes | no |

The 136 KB left before LCP are the route's own chunks and the active celebration scene.

## Migration Plan

The change is additive, and no host needs to change anything. To roll back, revert the commits; the root export of `McpAppCanvasRenderer` never goes away, so no consumer breaks either way.

## Open Questions

None blocking. Exact emitted file names for the subpath are taken from the first library build, and the `exports` map is checked by `npm run validate:docs`.
