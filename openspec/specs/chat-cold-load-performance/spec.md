# chat-cold-load-performance Specification

## Purpose

Defines the initial-load byte budgets, the required lazy/deferred boundaries for PDF.js, Monaco, KaTeX, and syntax highlighting, and the repeatable build-time measurement procedure used to verify cold-load bundle composition for `apps/chat` without regressing stable chat behavior.

## Requirements

### Requirement: Initial JS/CSS graph excludes in-scope non-critical heavy dependencies
The JavaScript and CSS files referenced directly by `apps/chat/dist/index.html` (the entry script, its `modulepreload` chunks, and its stylesheets) for the `/` route SHALL NOT include Monaco editor code, `pdfjs-dist` core/worker code, KaTeX, or `react-syntax-highlighter`. Each dependency SHALL load only when the corresponding feature is used. AG Grid, which `@epam/ai-dial-ui-kit` ships behind its `/grid` subpath, is governed by "Heavy feature engines remain outside chat startup" below.

#### Scenario: Cold load of `/` with a plain-text-only conversation
- **WHEN** a user with an authenticated session navigates to `/` with an empty HTTP cache and no conversation contains math or a fenced code block
- **THEN** the initial graph contains no Monaco, `pdfjs-dist`, KaTeX, or `react-syntax-highlighter` implementation code

#### Scenario: Opening a PDF attachment loads PDF.js on demand
- **WHEN** an authenticated user on `/` or `/conversations/:id` opens a PDF attachment
- **THEN** the application requests PDF.js and its worker on demand through the attachment-canvas PDF boundary and renders the existing PDF preview

#### Scenario: Rendering code or math loads its engine on demand
- **WHEN** a message or attachment first requires syntax highlighting or KaTeX rendering
- **THEN** the corresponding engine loads on demand while an immediate lightweight fallback preserves readable content during the transition

### Requirement: Initial preload byte budgets
Using the repeatable measurement script against a clean production build, the initial graph SHALL improve by at least 30% from the reproduced 1,724,639-byte gzip baseline and SHALL remain at or below 1,100,000 gzip bytes of JavaScript, 60,000 gzip bytes of CSS, and 1,160,000 gzip bytes in total. These budgets cover the app-side and in-repository lazy-loading scope, including the UI Kit `/grid` and `/editors` subpath boundaries (see "Public package boundaries support repeatable verification"); generated API-client decomposition is a separate follow-up.

#### Scenario: Post-change clean build meets the budgets
- **WHEN** `apps/chat` is built cleanly and `node scripts/measure-initial-bundle.mjs` measures every script, `modulepreload`, and stylesheet referenced by `dist/index.html`
- **THEN** the measured JS, CSS, total, and percentage-reduction values satisfy all stated budgets

### Requirement: Deferred features preserve existing behavior
Deferring a dependency SHALL NOT change the functional, streaming, accessibility, RTL, or API behavior of the feature that consumes it. The deliberate conversation-page module prefetch SHALL remain intact.

#### Scenario: Navigating directly to an existing conversation
- **WHEN** an authenticated user navigates directly to an existing conversation containing attachments, code blocks, and math content
- **THEN** the conversation renders with functional parity: attachments open, code highlights, math renders, and streaming transitions complete correctly

#### Scenario: Auditing an existing lazy boundary
- **WHEN** bundle inspection proves that a separately owned package barrel keeps a feature implementation in the eager graph
- **THEN** the change records that package boundary as a named follow-up and does not claim the boundary is effective or introduce an unsafe app-only workaround

### Requirement: No artificial metric gaming
No change made to satisfy the byte budgets SHALL render an artificially large placeholder, hide real content, or remove or degrade a user-visible feature solely to improve a measured metric.

#### Scenario: Reviewing a lazy-loading change
- **WHEN** a dependency is deferred from the initial graph
- **THEN** the feature remains fully available on demand and any fallback represents its real loading state rather than an artificial LCP target

### Requirement: Repeatable measurement procedures
The change SHALL provide a repeatable build-time bundle measurement and SHALL document a future lab profile covering device/CPU throttle, network throttle, browser, server location, compression, cache state, authentication state, run count, LCP, and a defined `chat-ready` milestone. A deployed Lighthouse run, emitted `chat-ready` instrumentation, and production RUM are not required by this change and SHALL NOT be reported as completed unless they are actually executed.

#### Scenario: Measuring the production bundle
- **WHEN** clean production output exists
- **THEN** the committed measurement script reports raw and gzip bytes for each initial asset plus JS, CSS, and combined totals using the same method as the baseline

#### Scenario: Reusing the documented lab profile later
- **WHEN** a human or CI runner later executes the documented browser profile
- **THEN** the report records the exact environment and reports median and p95 LCP plus the defined `chat-ready` milestone across at least seven runs, explicitly labeled as a lab proxy rather than production RUM

### Requirement: Heavy feature engines remain outside chat startup
The production chat SHALL exclude AG Grid community/React, Monaco/UIW editor engines, PDF.js, KaTeX and react-syntax-highlighter JavaScript from the recursive static initial graph. It SHALL retain working, reachable lazy feature chunks.

#### Scenario: Build budgets and graph exclusions
- **WHEN** a fresh production build is checked against a compatible UI Kit artifact
- **THEN** initial JS gzip is at most 1,100,000 bytes, CSS gzip at most 60,000 bytes and their sum at most 1,160,000 bytes
- **AND** forbidden JavaScript module implementations are absent from every recursively reachable static entry/preload dependency
- **AND** AG Grid remains reachable across a dynamic import
- **AND** its initial graph contains production React runtimes

#### Scenario: Real feature activation after startup
- **WHEN** the production app runs with deterministic mock APIs at desktop and mobile widths
- **THEN** initial network requests, including immediate prefetches, contain no forbidden heavy implementation
- **AND** activating the file manager fetches Grid and renders a file row
- **AND** activating catalog list view renders a model row
- **AND** activating the prompt editor loads a working Markdown engine

### Requirement: Public package boundaries support repeatable verification
Catalog SHALL consume UI Kit `/grid`; editor loaders SHALL consume `/editors`. Affected library builds SHALL externalize those public subpaths. Shared file-manager UI SHALL have a dedicated optional entry with existing root compatibility, while host API ownership stays at the app edge.

#### Scenario: Verify unpublished UI Kit without dependency drift
- **WHEN** an unpublished UI Kit is built, packed and temporarily installed for verification
- **THEN** only the installed UI Kit artifact is replaced and backed up
- **AND** other installed dependencies and the chat manifests remain unchanged
- **AND** an uncached production graph check can be repeated against that artifact
- **AND** local installation, diagnostics and mock browser tools are excluded from the delivered application and repository tooling

### Requirement: Conversation route graph excludes the MCP Apps stack

The recursive static import graph of the conversation route chunk that `/` loads SHALL NOT contain `zod`, `@mcp-ui/client`, `@modelcontextprotocol/sdk` or `@modelcontextprotocol/ext-apps` implementation code. That graph is the lazy `ConversationPage` module that `apps/chat/src/app/app.tsx` preloads, plus every chunk it imports statically and that the entry does not already hold.

`McpAppInlinePreview` (`libs/mcp-apps/src/components/McpAppInlinePreview/McpAppInlinePreview.tsx`) SHALL obtain `McpAppCanvasRenderer` through a dynamic import of `@epam/ai-dial-attachment-canvas/mcp-app-renderer`, never through a static import of the package root:

- The import SHALL start when the preview mounts, so it overlaps the resource fetch the preview already performs.
- The preview's own state remains the source of truth for what it shows (`useMcpAppInlinePreview`, status `McpAppInlinePreviewStatus`).
- While the renderer chunk is pending, a preview whose status is `Ready` SHALL show the same `Spinner`, with the same `loadingAriaLabel`, that it shows for `Loading`. No new user-visible string is added.
- The remount-on-reload behaviour (`key={attemptId}`) is unchanged.
- The lazy component reference is memoised on `attemptId`, as `AttachmentCanvasBody` does for its own renderers, so it is created once per load attempt and a reload retries a failed import.
- A rejected import is caught by `RendererLoadBoundary` (`libs/mcp-apps/src/components/RendererLoadBoundary/RendererLoadBoundary.tsx`) and shown as the preview's existing error state.

Accessibility, RTL and feature gating are unchanged: the fallback is the existing spinner, the layout is direction-agnostic, and nothing new is gated by `ENABLED_FEATURES`.

#### Scenario: Cold load of `/` with no MCP App message

- **WHEN** an authenticated user loads `/` with an empty cache in a production build
- **THEN** no request made before the greeting paints fetches a chunk that contains `zod`, `@mcp-ui/client`, `@modelcontextprotocol/sdk` or `@modelcontextprotocol/ext-apps` code
- **AND** a graph check of the built conversation route chunk finds none of those packages in its static closure

#### Scenario: A conversation with an MCP App message

- **WHEN** a user opens a conversation whose message carries an MCP App inline preview
- **THEN** the renderer chunk is requested when the preview mounts
- **AND** the preview shows its loading spinner until both the resource and the renderer are available
- **AND** the app then renders and behaves as before, including `tools/call`, `ui/open-link`, display-mode requests and the reload button

#### Scenario: The renderer chunk fails to load

- **WHEN** the dynamic import of `@epam/ai-dial-attachment-canvas/mcp-app-renderer` rejects
- **THEN** the preview shows its existing error state with `loadErrorLabel`, and its reload action retries the import

### Requirement: Closed lazy overlays mount after the page has loaded

`apps/chat` SHALL NOT render a lazily loaded overlay while it is closed until the post-load idle point (`scheduleAfterLoadIdle` in `apps/chat/src/utils/load-idle.ts`). That point is the first idle period, bounded by a 2000 ms timeout (or a 2000 ms timer where `requestIdleCallback` is unavailable), after both of these:

- the document `load` event;
- the route's first screen, which `ConversationView` reports through `markFirstScreenRendered` on its first commit. A route that never reports one stops waiting 3000 ms after `load`.

`load` alone is not enough: in a single-page app it fires while the route is still rendering, so work scheduled from it ran inside the render that paints the LCP element.

- An overlay that opens before that point mounts when it opens.
- Once mounted, an overlay stays mounted, so close transitions, focus return and live-region announcements behave as before.
- Mounting the overlay closed at that point is what loads its chunk. The first open after it therefore finds the chunk in place and animates open from the closed state, as it does today.

| Overlay | State that owns "open" | Where it is gated |
| --- | --- | --- |
| `ConversationSourcesPanel` | `isOpen` from `useSourcesSidebar` (`apps/chat/src/context/SourcesSidebarContext.tsx`) | `apps/chat/src/app/app.tsx` |
| `McpAppCanvasContainer` | `isOpen` from `useAttachmentCanvas` (`libs/attachment-canvas/src/context/AttachmentCanvasContext.tsx`); its route conditions still apply | `apps/chat/src/app/app.tsx` |
| `SigninInterruptDialog` | a non-empty `pendingEvents` from `useClientChannel` (`apps/chat/src/context/ClientChannelContext.tsx`) | `apps/chat/src/components/SigninInterruptGate/SigninInterruptGate.tsx` |
| `CatalogModal` | `isCatalogOpen` in `useDeploymentSelectorOverlay` and `useDeploymentSelectorFieldOverlay` | the same hooks |
| `PromptCatalogModal` | the `isOpen` argument of the prompt catalog render callback in `usePromptSelectorOverlay` | `apps/chat/src/components/PromptSelector/PromptCatalogGate.tsx` |
| `SkillDetailsPanelContainer` | a non-null `skillId` passed by the `@epam/ai-dial-skills` skill selector | `apps/chat/src/components/SkillSelector/SkillDetailsPanelGate.tsx` |

Each gate SHALL decide through `useDeferredOverlayMount` (`apps/chat/src/hooks/useDeferredOverlayMount.ts`). It combines two hooks:

- `useHasBeenTrue` from `@epam/ai-dial-chat-shared`: the "has been open" latch, implemented as state updated during render.
- `useIsAfterLoadIdle` (`apps/chat/src/hooks/useIsAfterLoadIdle.ts`).

`OnboardingHints` SHALL mount only once `useIsAfterLoadIdle` is true, because it shows nothing before its start delay.

`App` already re-renders when the sources sidebar or the canvas toggles, because it reads both contexts. The sign-in gate is a separate component, so client-channel updates never re-render `App`.

No user-visible string, ARIA contract, RTL behaviour or feature gate changes.

#### Scenario: Cold load of `/`

- **WHEN** an authenticated user loads `/` with an empty cache in a production build and opens nothing
- **THEN** no request for the `ConversationSourcesPanel`, `McpAppCanvasContainer`, `SigninInterruptDialog`, `OnboardingHints`, `CatalogModal`, `PromptCatalogModal` or `SkillDetailsPanelContainer` chunk starts before the post-load idle point
- **AND** after that point those overlays mount closed and their chunks are requested

#### Scenario: Opening an overlay before the page has loaded

- **WHEN** the user opens the sources sidebar or an attachment before the post-load idle point
- **THEN** the overlay mounts at once and renders its content
- **AND** its `Suspense` fallback shows until its chunk arrives

#### Scenario: Opening an overlay after the page has loaded

- **WHEN** the user opens the sources sidebar, an attachment in the canvas, the model catalog or the prompt catalog after the post-load idle point
- **THEN** the overlay is already mounted closed
- **AND** it opens with the same content, transition, focus handling and labels as before

#### Scenario: Closing and reopening an overlay

- **WHEN** an overlay that has been open is closed and opened again
- **THEN** it stays mounted while closed and plays its close transition
- **AND** it reopens without fetching its chunk again

#### Scenario: A sign-in interrupt arrives before the page has loaded

- **WHEN** the client channel delivers the first pending sign-in event before the post-load idle point
- **THEN** `SigninInterruptGate` mounts `SigninInterruptDialog`, which shows the event
- **AND** after the last event resolves it stays mounted, so its success announcement is still delivered through its live region

### Requirement: Conversation messages load outside the home route's graph

`ConversationView` (`apps/chat/src/components/ConversationView/ConversationView.tsx`) SHALL render each message through `ConversationMessageItemLoader` (`apps/chat/src/components/ConversationMessageItemLoader/ConversationMessageItemLoader.tsx`), never through a static import of `ConversationMessageItem`. The message bubbles, stages and citations, and the markdown engine they import (unified, micromark, `hast-util-raw`), are then outside the static graph of the conversation route that `/` loads.

- `loadConversationMessageItem` (`apps/chat/src/utils/conversation-message-loader.ts`) loads the module once, and retries after a failed chunk request.
- `apps/chat/src/app/app.tsx` SHALL start that load at module scope on every entry path except `/`, where messages can be the LCP element. On `/` it starts at the post-load idle point.
- When the module has already loaded, the loader SHALL render the message in the same commit, without suspending, so a conversation page does not wait out React's Suspense fallback throttle. Otherwise it renders through `React.lazy` behind a `null` fallback.
- The rendering path is chosen once per instance, so a message never remounts.

#### Scenario: Cold load of `/`

- **WHEN** an authenticated user loads `/` with an empty cache in a production build
- **THEN** the static closure of the conversation route chunk contains no unified, micromark, `hast-util-raw` or `react-markdown` code

#### Scenario: Opening an existing conversation directly

- **WHEN** a user loads a conversation URL with messages
- **THEN** the message chunk is requested alongside the page module
- **AND** each message renders without a Suspense fallback once that chunk has arrived
