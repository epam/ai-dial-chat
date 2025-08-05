export enum ToolsetTransportType {
  HTTP = 'HTTP',
  SSE = 'SSE',
}

export interface Toolset {
  endpoint: string;
  transport: ToolsetTransportType;
  allowed_tools: string[];

  toolset?: string;
  display_name?: string;
  description?: string;
  icon_url?: string;
  user_roles?: string[];
  description_keywords?: string[];
  max_retry_attempts?: number;
  author?: string;
  created_at?: number;
  updated_at?: number;
}
