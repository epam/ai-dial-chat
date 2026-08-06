/** Resource families that DIAL Core exposes an MCP endpoint for. */
export enum McpResourceKind {
  /** Toolsets, served under `/v1/toolset/{id}/mcp`. */
  Toolset = 'toolset',
  /** Application deployments, served under `/v1/deployments/{id}/mcp`. */
  Application = 'application',
}
