export enum ToolsetTransportType {
  HTTP = 'HTTP',
  SSE = 'SSE',
}

export enum ToolsetAuthTypes {
  OAUTH = 'OAUTH',
  API_KEY = 'API_KEY',
  NONE = 'NONE',
}

export enum ToolsetAuthStatus {
  SIGNED_IN = 'SIGNED_IN',
  SIGNED_OUT = 'SIGNED_OUT',
  FAILED = 'FAILED',
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
  owner?: string;
  author?: string;
  created_at?: number;
  updated_at?: number;

  auth_settings: {
    authentication_type: ToolsetAuthTypes;
    dynamically_registered?: boolean;
    // TODO: remove redirectUri after toolset login is stable with new flow (redirectUri will be sent in login request)
    redirect_uri?: string;
    api_key_header?: string;
    token_endpoint?: string;
    // get
    client_id?: string;
    client_secret?: string;
    authorization_endpoint?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    global_auth_status?: ToolsetAuthStatus;
    user_level_auth_status?: ToolsetAuthStatus;
    scopes_supported?: string[];
  };
}
