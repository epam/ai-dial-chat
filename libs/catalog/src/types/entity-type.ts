/** Entity type for a catalog item. Values are uppercase for direct color-map lookup. */
export enum CatalogEntityType {
  Model = 'MODEL',
  Agent = 'AGENT',
  Toolset = 'TOOLSET',
  Skill = 'SKILL',
  /** Reusable text prompt. Carries a body instead of a runtime. */
  Prompt = 'PROMPT',
}
