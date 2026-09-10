## Why

Published libraries retain feature implementations and styles that source-based consumers can tree-shake. Lightweight imports therefore increase startup JavaScript and delay first usable render.

## What Changes

- Preserve module boundaries in chat-shared and chat-hooks; externalize declared runtime dependencies and peers.
- Keep synchronous root exports compatible and provide scoped entries for consumers needing smaller resolution surfaces.
- Give catalog and publish-panel explicit CSS ownership without bundling peer styles or fonts.
- Verify real tarball consumers, source/packed startup parity, deferred behavior and coherent release installation in CI.

## Capabilities

### New Capabilities

- `published-library-cold-load-parity`: reproducible startup, isolation and release gates.

- `chat-shared-package-distribution`: granular output and feature-owned CSS.
- `catalog-package-externalization`: external peers and explicit stylesheet exports.

### Modified Capabilities

- `chat-hooks-package-distribution`: external runtime dependencies, scoped entries and preserved shared state.

## Impact

Changes affect library packaging, source-content helpers, consumer fixtures, publishing checks and documentation. Release the complete internal peer closure together. Public synchronous exports and feature behavior remain compatible; deployment and browser LCP depend on the consuming host.
