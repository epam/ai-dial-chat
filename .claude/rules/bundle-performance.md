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
(`conversationPageModule`, `lazy-conversation-input`); `import()` caches the
module, so the component's own `lazy` reuses it.

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
`apps/chat/public/` and is loaded through `hashedPublicScriptPlugin`
(`tools/vite/hashed-public-script.mjs`), which serves a content-hashed copy
that chat-api caches as `immutable`. Do not inline it: the app-shell CSP
`script-src` deliberately allows no inline scripts.

## Check the entry before and after

After touching `app.tsx`, `AppRoot.tsx`, a context provider or a lib barrel,
build `chat` and compare the `<link rel="modulepreload">` list and the size of
`assets/index-*.js` in `apps/chat/dist/index.html` with the previous build. A
new heavy chunk in that list is a new cost on every page.
