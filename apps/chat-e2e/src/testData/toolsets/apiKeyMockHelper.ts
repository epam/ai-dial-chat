import {
  ApiKeyMockOptions,
  ToolsetApiKeySignInRequest,
} from '@/src/testData/toolsets/authMockConfig';
import { BaseAuthMockHelper } from '@/src/testData/toolsets/baseAuthMockHelper';
import {
  Toolset,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

export class ApiKeyMockHelper extends BaseAuthMockHelper<ToolsetApiKeySignInRequest> {
  constructor(
    page: Page,
    initialToolset: Toolset,
    toolsetEndpoint: string,
    options: ApiKeyMockOptions = {},
  ) {
    super(page, initialToolset, toolsetEndpoint, options);
  }

  async setupMocks(): Promise<void> {
    await this.setupToolsetRoutes();
    await this.setupToolsetListingRoute();
    await this.setupSignInRoute();
    await this.setupSignOutRoute();
  }

  protected buildAuthSettings(): Record<string, unknown> {
    return {
      authentication_type: ToolsetAuthTypes.API_KEY,
      api_key_header: this.toolset.auth_settings?.api_key_header,
      global_auth_status: this.isSignedInGlobal
        ? ToolsetAuthStatus.SIGNED_IN
        : ToolsetAuthStatus.SIGNED_OUT,
      user_level_auth_status: this.isSignedInUser
        ? ToolsetAuthStatus.SIGNED_IN
        : ToolsetAuthStatus.SIGNED_OUT,
    };
  }
}
