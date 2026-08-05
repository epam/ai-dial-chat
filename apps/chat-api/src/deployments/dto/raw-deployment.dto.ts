export interface RawDeploymentFeaturesDto {
  system_prompt?: boolean;
  temperature?: boolean;
  folder_attachments?: boolean;
  mcp?: boolean;
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
  input_attachment_types?: string[];
  max_input_attachments?: number;
  description_keywords?: string[];
  owner?: string;
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
