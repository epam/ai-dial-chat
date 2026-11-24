/*
 * `@epam/ai-dial-attachment-canvas/mcp-app-renderer`: the MCP App renderer
 * alone, for a host that loads it on demand. The package root also exports it,
 * but a dynamic `import()` of the root splits nothing off when the host's
 * entry already imports the root statically (for `AttachmentCanvasProvider`),
 * and then the renderer's `@mcp-ui/client`, MCP SDK and `zod` stay in the
 * host's eager graph.
 */
export { McpAppCanvasRenderer } from './components/McpAppCanvasRenderer/McpAppCanvasRenderer';
export type { McpAppCanvasRendererProps } from './components/McpAppCanvasRenderer/McpAppCanvasRenderer';
