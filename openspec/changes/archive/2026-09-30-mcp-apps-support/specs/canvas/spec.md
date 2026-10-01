## ADDED Requirements

### Requirement: `AttachmentContentType.McpApp` content type in the canvas routing table

The canvas's content-renderer table (see "Content renderers" in the base `canvas` spec) SHALL gain a row: `McpApp` — payload `{ html: string; sandboxUrl: string; toolName: string; onToolCall: (name, args) => Promise<CallToolResult> }` — rendered by `McpAppCanvasRenderer` (defined in the `mcp-app-canvas` capability) via `@mcp-ui/client`'s `AppRenderer`. `html` is fetched by `useOpenMcpAppCanvas` before the canvas opens (see `design.md` D3), and `sandboxUrl` points at the isolated-origin `mcp-app-sandbox-proxy` app — neither is fetched or resolved by the canvas itself. Unlike every other row in the table, this content type is never reached through `useOpenAttachmentCanvas`/`openFileCanvas`'s attachment routing — it is reached exclusively through `useOpenMcpAppCanvas` (see the `mcp-app-trigger` capability), triggered from the message actions bar's "Open canvas" button or automatically for the conversation's last `mcp_app`-carrying message, rather than an attachment click (see `design.md` D5, revised).

#### Scenario: McpApp is not reachable through the attachment routing table

- **WHEN** `openFileCanvas` runs its MIME/extension routing for any `DisplayAttachment`
- **THEN** it never produces an `McpAppCanvasContent` — that content type is only constructed by `useOpenMcpAppCanvas`

#### Scenario: Opening an MCP app closes other panels the same way every other trigger does

- **WHEN** `useOpenMcpAppCanvas` opens the canvas with an `McpAppCanvasContent`
- **THEN** the conversation sources panel and conversation history panel are closed first, per the existing mutual-exclusivity behavior shared by every canvas open trigger
