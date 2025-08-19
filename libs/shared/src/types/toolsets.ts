export enum ToolsetTransportType {
  HTTP = 'HTTP',
  SSE = 'SSE',
}

export enum ToolsetAuthTypes {
  OAUTH = 'OAUTH',
  API_KEY = 'API_KEY',
  NONE = 'NONE',
}

export interface Toolset {
  endpoint: string;
  transport: ToolsetTransportType;
  allowed_tools: string[];
  display_name: string;
  display_version: string;

  reference?: string;
  url?: string;
  id?: string;
  toolset?: string;
  name?: string;
  description?: string;
  icon_url?: string;
  user_roles?: string[];
  description_keywords?: string[];
  max_retry_attempts?: number;
  author?: string;
  created_at?: number;
  updated_at?: number;

  auth_settings: {
    authentication_type: ToolsetAuthTypes;
    client_id?: string;
    client_secret?: string;
    authorization_endpoint?: string;
    redirect_uri?: string;
    api_key_header?: string;
  }
}
