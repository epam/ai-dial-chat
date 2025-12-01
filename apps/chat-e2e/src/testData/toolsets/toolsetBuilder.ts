import { ExpectedConstants } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import {
  Toolset,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
  ToolsetTransportType,
} from '@epam/ai-dial-shared';
import { webcrypto } from 'node:crypto';

export interface AuthSettings {
  authentication_type: ToolsetAuthTypes;
  redirect_uri?: string;
  api_key_header?: string;
  token_endpoint?: string;
  client_id?: string;
  client_secret?: string;
  authorization_endpoint?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  global_auth_status?: ToolsetAuthStatus;
  user_level_auth_status?: ToolsetAuthStatus;
  scopes_supported?: string[];
}

export class ToolsetBuilder {
  private toolset: Toolset;

  constructor() {
    this.toolset = this.reset();
  }

  protected reset(): Toolset {
    this.toolset = {
      endpoint: ExpectedConstants.defaultEntityUrl,
      transport: ToolsetTransportType.SSE,
      allowed_tools: [],
      display_name: GeneratorUtil.randomToolsetName(),
      display_version: ExpectedConstants.defaultEntityVersion,
      reference: webcrypto.randomUUID(),
      url: undefined,
      id: undefined,
      toolset: undefined,
      name: undefined,
      description: undefined,
      icon_url: undefined,
      user_roles: undefined,
      description_keywords: undefined,
      max_retry_attempts: undefined,
      owner: undefined,
      author: undefined,
      created_at: undefined,
      updated_at: undefined,
      auth_settings: {
        authentication_type: ToolsetAuthTypes.NONE,
        redirect_uri: undefined,
        api_key_header: undefined,
        token_endpoint: undefined,
        client_id: undefined,
        client_secret: undefined,
        authorization_endpoint: undefined,
        code_challenge: undefined,
        code_challenge_method: undefined,
        global_auth_status: undefined,
        user_level_auth_status: undefined,
        scopes_supported: undefined,
      },
    };
    return this.toolset;
  }

  withDisplayName(displayName: string): this {
    this.toolset.display_name = displayName;
    return this;
  }

  withDisplayVersion(displayVersion: string): this {
    this.toolset.display_version = displayVersion;
    return this;
  }

  withDescriptionKeywords(...keywords: string[]): this {
    this.toolset.description_keywords = keywords;
    return this;
  }

  withDescription(description: string): this {
    this.toolset.description = description;
    return this;
  }

  withIconUrl(iconUrl: string): this {
    this.toolset.icon_url = iconUrl;
    return this;
  }

  withEndpoint(endpoint: string): this {
    this.toolset.endpoint = endpoint;
    return this;
  }

  withTransport(transport: ToolsetTransportType): this {
    this.toolset.transport = transport;
    return this;
  }

  withAllowedTools(...allowed_tools: string[]): this {
    this.toolset.allowed_tools = allowed_tools;
    return this;
  }

  withReference(reference: string): this {
    this.toolset.reference = reference;
    return this;
  }

  withAuthSettings(authSettings: AuthSettings): this {
    this.toolset.auth_settings = authSettings;
    return this;
  }

  build(): Toolset {
    const builtToolset = { ...this.toolset };
    this.reset();
    return builtToolset;
  }
}
