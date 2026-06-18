/** Entity type for a catalog item. Values are uppercase for direct color-map lookup. */
export enum CatalogEntityType {
  Model = 'MODEL',
  Toolset = 'TOOLSET',
  Mcp = 'MCP',
  // TODO: not supported yet, will be used for applications in the future
  Guardrail = 'GUARDRAIL',
}
