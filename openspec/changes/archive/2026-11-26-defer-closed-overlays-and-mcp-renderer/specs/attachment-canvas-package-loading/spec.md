## ADDED Requirements

### Requirement: MCP App renderer subpath export

`libs/attachment-canvas/package.json` SHALL export `./mcp-app-renderer`:

- Its `@epam/source` condition resolves to a source module under `libs/attachment-canvas/src/` that re-exports exactly `McpAppCanvasRenderer` and the `McpAppCanvasRendererProps` type, and nothing else.
- Its `types`, `import` and `default` conditions resolve to files the library build emits.

The entry's built JavaScript SHALL load the renderer's styles itself, the way dynamic chunks already do through the library's CSS-association build step. A host that imports only the subpath therefore gets a styled renderer.

The package root SHALL keep exporting `McpAppCanvasRenderer` and `McpAppCanvasRendererProps`, so existing hosts are unaffected.

Every library that imports the subpath SHALL list it as external in its own build, so it is never bundled into that library's output. Today that is `libs/mcp-apps` (`libs/mcp-apps/vite.config.mts`).

#### Scenario: Resolving the subpath after a build

- **WHEN** `@epam/ai-dial-attachment-canvas` is built and a consumer imports `@epam/ai-dial-attachment-canvas/mcp-app-renderer`
- **THEN** the import resolves to an emitted file that exports `McpAppCanvasRenderer`, and its type declarations resolve
- **AND** that file's static import graph pulls in the renderer's stylesheet

#### Scenario: Root import is unchanged

- **WHEN** a host imports `McpAppCanvasRenderer` from `@epam/ai-dial-attachment-canvas`
- **THEN** it receives the same component as before this change

#### Scenario: A consuming library keeps the subpath external

- **WHEN** `libs/mcp-apps` is built
- **THEN** its output imports `@epam/ai-dial-attachment-canvas/mcp-app-renderer` at runtime and contains no copy of the renderer, `@mcp-ui/client` or `zod`
