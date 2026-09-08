## Decisions

1. Import catalog Grid from the public UI Kit `/grid` entry. Import all three
   Markdown editor loaders from `/editors`. Do not alias private UI Kit files.
2. Keep all public UI Kit entry points external when building the affected
   libraries. Otherwise a published library can inline heavy dependencies again.
3. Preserve shared root exports, but expose file-manager components through a
   separate multi-entry build and explicit TypeScript/Vite alias. Keep shared
   `styles.css` at its existing path. The file-manager contract types stay on root.
4. Declare CSS/SCSS side effects for shared, catalog and publishing packages;
   chat-hooks has no module-level external effects and uses `sideEffects: false`.
   Do not globally override vendor side-effect metadata in the app bundler.
5. Lazy-load the conversation publishing container. Its folder tree consumes the
   external file-manager root, so keeping the container eager defeats isolation.
6. Remove app manual-chunk grouping. It no longer provides a necessary boundary
   and makes shared eager/lazy dependency placement less transparent.
7. Retain PDF, math, syntax-highlighting and conversation-page prefetch behavior
   from the archived change. Enforce their graph exclusions alongside AG Grid.

## UI Kit compatibility

The original local artifact defined lazy editor loaders inline in its root
aggregator. Retaining a root loader alongside a lazy Grid could pull AG Grid
into an eager shared chunk. UI Kit section 9 moved all three root loaders into
shared leaf modules, re-exported from both root and `/editors`. Chat retains
explicit feature subpaths so its dependency boundaries remain clear.

## Verification boundaries

Local verification uses a temporary Vite wrapper around the production config
to collect module metadata without changing chunk configuration. The checker
parses emitted static imports/exports from HTML entry/preload assets and checks
dynamic reachability, including backtick imports. This avoids mistaking removed
CSS-only JS placeholders in intermediate metadata for emitted dependencies.
Byte budgets concern gzip JS/CSS sizes, not runtime latency.
Verification builds set `NODE_ENV=production` explicitly and bypass Nx cache
because the local package version stays `0.0.0` across different artifacts.
Diagnostic tools, mock servers and their output live only in ignored `tmp/`;
production configuration and npm/Nx targets do not depend on them.

Browser smoke uses Chromium and mock API responses with production app assets.
It checks actual startup requests, then file-manager row rendering after route
activation. This establishes bundle execution and lazy loading, not real backend
integration, throttled LCP/chat-ready latency or production RUM.

## Local package reproducibility

Build and pack UI Kit, then temporarily replace only its installed directory,
preserving a backup and both chat manifests. Avoid `npm install --no-save`, which
can resolve unrelated dependency updates. The verification report records the
artifact integrity and toolchain. The registry lock remains portable; `npm ci`
restores the locked registry artifact.
