---
paths:
  - 'apps/**/*.tsx'
  - 'apps/**/*.ts'
  - 'libs/**/*.tsx'
  - 'libs/**/*.ts'
  - 'libs/*/package.json'
globs: 'apps/**/*.ts,apps/**/*.tsx,libs/**/*.ts,libs/**/*.tsx,libs/*/package.json'
applyTo: 'apps/**/*.ts,apps/**/*.tsx,libs/**/*.ts,libs/**/*.tsx,libs/*/package.json'
alwaysApply: false
---

# Bundle and render performance

Every page waits on the `apps/chat` entry chunk before it paints, and nothing
in lint or tests notices when a change grows it. Each rule below is a defect
that reached the main line and cost first paint on every page.

## Lazy-load what is not on screen at first paint

A component that starts closed, hidden or delayed — a side panel, a canvas, a
modal, the onboarding tour — is `React.lazy` behind `<Suspense fallback={null}>`
when `app.tsx`, `AppRoot.tsx` or a context provider renders it. A static
import puts it, and everything it renders, in the entry chunk. The
`ConversationSourcesPanel` import alone pulled react-markdown and parse5
(~400 KB) into every page.

A lazy component that **is** on screen at first paint on some route — the
composer on the home page — must start loading before the route renders, or
the route suspends on a second round trip after its own chunk. Start the
`import()` at module scope next to the page preload in `app.tsx`
(`conversationPageModule`, `loadConversationInput`).

Preloading is not enough on its own: `React.lazy` still suspends on its first
render, and a Suspense boundary that showed its fallback reveals the content
only after React's ~300 ms fallback throttle. The composer's boundary held the
home greeting — the LCP element — for that long. Render the loaded component
directly when its module is already in memory, and keep `lazy` only as the
fallback path (`ConversationInputLoader`, `conversation-input-loader.ts`);
pick the path once per instance so the component never remounts. Conversation
messages follow the same pattern (`ConversationMessageItemLoader`,
`conversation-message-loader.ts`). Their chunk holds the markdown engine, which
the home page never renders, so `app.tsx` fetches it at once on any entry
route except `/`, and only after the page has loaded on `/`.

`lazy` alone does not keep a closed overlay off the first paint: a mounted
`lazy` component requests its chunk on its first render even when it renders
nothing. The sources panel, the canvas, the sign-in dialog, the onboarding tour,
both catalog modals and the skill details panel were all mounted closed at page
load, and their chunks downloaded in waves alongside the home route's own. Gate
a closed overlay with `useDeferredOverlayMount(isOpen)`
(`apps/chat/src/hooks/useDeferredOverlayMount.ts`). It mounts the overlay,
still closed, at the post-load idle point, or earlier if the overlay opens
first, and keeps it mounted after that. Mounting closed keeps the first open's
transition, which a mount-on-open would lose. A component a lib renders while
closed (a host-supplied `detailsPanelComponent`, say) needs the same gate on
the app side.

The post-load idle point (`scheduleAfterLoadIdle`, `utils/load-idle.ts`) waits
for both `load` and the first screen, which `ConversationView` reports through
`markFirstScreenRendered`. `load` alone is not enough: a single-page app fires
it while the route is still rendering, and deferred work scheduled from it ran
inside the render that paints the LCP element.

## Never `import()` another lib's root barrel either

The same applies across libs. `McpAppInlinePreview` needs the MCP App renderer
only for a message with an MCP App, but it imported it from the
`@epam/ai-dial-attachment-canvas` root, so `zod`, `@mcp-ui/client` and the MCP
SDK (102 KB gzip, ~230 ms of evaluation) sat in the home route's static graph.
The entry imports that root statically, so an `import()` of it would split
nothing off. The lib exports the component from a subpath
(`./mcp-app-renderer`), and the consumer lazy-loads that subpath. A Vite config
that aliases the package root to its source needs the subpath alias **before**
the root one, because a string alias also matches every subpath of its key.
Check a route's static closure with `node scripts/check-route-graph.mjs` against
a `vite build --sourcemap` output.

## Never `import()` a lib barrel that the entry imports statically

`lazy(() => import('@epam/ai-dial-conversation-input'))` split nothing off:
other entry modules import the same barrel for a constant or an enum, so the
dynamic import resolves to a module the entry already holds, and the namespace
access keeps every export alive. Dynamic-import a local module that re-exports
exactly the components the call site needs
(`apps/chat/src/utils/lazy-conversation-input.ts`).

## Keep heavy engines out of modules that export light helpers

A lib module that a page-wide component imports for one small function keeps
every top-level import of that module. `copyToClipboard` shared a file with
the unified/remark/DOMPurify pipeline, so `NotificationStack` kept ~300 KB
alive. Either:

- put the heavy part in its own module (`utils/markdown-rich-text.ts`), or
- load the engine inside the function that needs it — `await import('fflate')`
  in `buildDialArchive` — when that function is or can become async.

Never call into a heavy package at module scope (`strToU8('')` at the top of
`zip-export.ts`); that runs on import and pins the package.

## One module per translation-key namespace

The bundler drops unused modules, not unused members of a kept module. All 66
key enums in one `translation-keys.ts` put every page's keys (~154 KB) in the
entry chunk; one module per namespace under `apps/chat/src/constants/i18n-keys/`
cut that to the 44 the entry uses. Add a namespace as a new module there and
re-export it from the barrel — never append a second enum to an existing one.

## Memoize object and array props passed to a memoized component

An object literal in JSX is a new value on every render, so the child's `memo`
never holds. `Card` passed `classNames={{ p: …, ul: … }}` to `MarkdownRenderer`,
and every grid re-render re-parsed the markdown of every visible card (275 ms
for 30 cards in jsdom, 118 ms after `useMemo`). Hoist a static value to a module
constant and `useMemo` a derived one. This matters most for
`MarkdownRenderer`, whose re-render runs the whole remark/rehype pipeline.

## Every lib declares `sideEffects`

A lib's `package.json` carries `"sideEffects": ["**/*.css", "**/*.scss"]`
(or `false` with no stylesheets). Without it a host's bundler must treat every
module of the published package as side-effectful and keep it. A module that
genuinely runs code on import (a `DOMPurify.addHook`, a listener) is named in
the list instead.

## Synchronous head scripts

A classic script the `index.html` head must run before the bundle stays in
`apps/chat/public/` and is inlined by `inlinePublicScriptPlugin`
(`tools/vite/inline-public-script.mjs`), so first paint does not wait on a
request for it. chat-api allows each inline script of the built `index.html`
by its SHA-256 hash (`collectInlineScriptHashes`), never `'unsafe-inline'`.
Never add an inline script by hand or build it from runtime values: only the
build-time bytes are hashed, and anything else is blocked.

A GET the app awaits before its first screen starts from the head, not from
the bundle: add its exact URL to `public/boot-prefetch.js` and
`BOOT_PREFETCH_URLS` (`apps/chat/src/server-api/boot-prefetch.ts`). Otherwise
every cold load pays the bundle download and that round trip one after the
other. Only side-effect-free GETs belong there, because the head script sends
them before the app decides whether it needs them.

## Check the entry before and after

After touching `app.tsx`, `AppRoot.tsx`, a context provider or a lib barrel,
build `chat` and run `node scripts/measure-initial-bundle.mjs`, comparing its
totals with the previous build. Everything the entry imports statically lands
in the `vendor` and `app-shell` chunks (`codeSplitting.groups` in
`apps/chat/vite.config.mts`), so a heavy module shows up as growth of those two
files, not as a new `<link rel="modulepreload">`. A new preload or stylesheet in
`dist/index.html` means a group stopped matching — fix the group, do not accept
the extra request.
