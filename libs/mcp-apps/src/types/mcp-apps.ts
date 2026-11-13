/** Which of the host's two MCP proxy routes a deployment id resolves through — a plain toolset, or an application that is itself an MCP server. */
export enum McpDeploymentKind {
  Toolset = 'toolset',
  Application = 'application',
}

/**
 * How a tool was discovered — determines whether it's safe to live-re-call
 * (see `resolveMcpAppToolResult`) or treat as "always available" for a
 * message with no other evidence (see `findMcpAppForMessage`).
 *
 * - `Direct`: the active deployment itself IS this MCP server (whether
 *   it's a bare Toolset or an Application declaring `features.mcp`) — the
 *   host is talking to it directly, so which tool a mounted app's own
 *   invocation targets is unambiguous.
 * - `Indirect`: a different, tool-calling deployment's message happened to
 *   call a name prefixed with a toolset's display name; the toolset is a
 *   name-prefix *guess*, not a confirmed link the host was told about, so
 *   re-calling it live risks hitting the wrong tool or re-triggering a
 *   non-idempotent side effect.
 */
export enum McpAppToolDiscovery {
  Direct = 'direct',
  Indirect = 'indirect',
}
