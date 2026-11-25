export interface RawDeploymentFeaturesDto {
  system_prompt?: boolean;
  temperature?: boolean;
  folder_attachments?: boolean;
  mcp?: boolean;
  responses_api?: boolean;
  chat_completion?: boolean;
  skills_supported?: boolean;
  tools?: boolean;
  /** Core defaults it to true, so it means something only for a model with tools. */
  parallel_tool_calls?: boolean;
  cache?: boolean;
  auto_caching?: boolean;
  reasoning_efforts?: string[];
}

/** The configured model type DIAL Core reports under a model's `capabilities`. */
export interface RawDeploymentModelKindsDto {
  chat_completion?: boolean;
  completion?: boolean;
  embeddings?: boolean;
}

export interface RawDeploymentDto {
  id?: string;
  display_name?: string;
  object?: string;
  toolset?: string;
  icon_url?: string;
  updated_at?: number;
  created_at?: number;
  reference?: string;
  description?: string;
  display_version?: string;
  interfaces?: string | string[];
  application_type_schema_id?: string;
  /** Custom Viewer page that replaces the conversation UI for this application. */
  viewer_url?: string;
  input_attachment_types?: string[];
  max_input_attachments?: number;
  description_keywords?: string[];
  owner?: string;
  /**
   * Provider DIAL Core reports at the top level of a model (e.g. `aws`). It is
   * optional and unrelated to `interface_configs`, which never carries it.
   */
  provider?: string;
  /** A model's configured type (chat, completion, embeddings); other keys are ignored. */
  capabilities?: RawDeploymentModelKindsDto;
  application_properties?: Record<string, unknown>;
  features?: RawDeploymentFeaturesDto;
  /**
   * Root-level MCP descriptor DIAL Core attaches to MCP-capable applications
   * (endpoint/transport/allowedTools/...). Its presence, not its shape, is
   * what matters here — only used as a fallback truthy check when
   * `features.mcp` is absent.
   */
  mcp?: unknown;
}
