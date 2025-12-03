import { Routes } from '@/chat/constants/routes';
import config from '@/config/chat.playwright.config';
import { API, OAuthQueryParams } from '@/src/testData';
import {
  DEFAULT_AUTHORIZATION_CODE,
  DEFAULT_OAUTH_CONFIG,
  OAuthMockConfig,
  OAuthMockOptions,
  ToolsetSignInRequest,
} from '@/src/testData/toolsets/oauthMockConfig';
import {
  Toolset,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

export interface OAuthState {
  isSignedIn: boolean;
  capturedOAuthUrl: string | null;
  capturedState: string | null;
  callbackUrl: string | null;
  enableMocking: boolean;
  signInRequest: ToolsetSignInRequest | null;
}

export class OAuthMockHelper {
  private page: Page;
  private readonly initialToolset: Toolset;
  private readonly toolsetEndpoint: string;
  private readonly mockConfig: OAuthMockConfig;
  private readonly authorizationCode: string;
  private readonly expectedStatusCodes: {
    updateToolsetCode?: number;
    backendSigInCode?: number;
  };
  private state: OAuthState = {
    isSignedIn: false,
    capturedOAuthUrl: null,
    capturedState: null,
    callbackUrl: null,
    enableMocking: false,
    signInRequest: null,
  };

  constructor(
    page: Page,
    initialToolset: Toolset,
    toolsetEndpoint: string,
    options: OAuthMockOptions = {},
  ) {
    this.page = page;
    this.initialToolset = initialToolset;
    this.initialToolset.endpoint = toolsetEndpoint;
    this.toolsetEndpoint = toolsetEndpoint;

    const baseConfig = { ...DEFAULT_OAUTH_CONFIG };
    const endpointConfig = {
      authorization_endpoint: API.authorizationEndpoint(this.toolsetEndpoint),
      token_endpoint: API.tokenEndpoint(this.toolsetEndpoint),
    };
    const customConfig = options.mockOAuthConfig || {};
    this.mockConfig = {
      ...baseConfig,
      ...endpointConfig,
      ...(customConfig.client_id !== undefined && {
        client_id: customConfig.client_id,
      }),
      ...(customConfig.scopes_supported !== undefined && {
        scopes_supported: customConfig.scopes_supported,
      }),
      ...(customConfig.code_challenge_method !== undefined && {
        code_challenge_method: customConfig.code_challenge_method,
      }),
      ...(customConfig.authorization_endpoint !== undefined && {
        authorization_endpoint: customConfig.authorization_endpoint,
      }),
      ...(customConfig.token_endpoint !== undefined && {
        token_endpoint: customConfig.token_endpoint,
      }),
    };
    this.authorizationCode =
      options.authorizationCode ?? DEFAULT_AUTHORIZATION_CODE;
    this.expectedStatusCodes = options.expectedStatusCodes || {
      updateToolsetCode: 200,
      backendSigInCode: 200,
    };
  }

  async setupMocks(): Promise<void> {
    await this.setupToolsetRoutes();
    await this.setupSignInRoute();
    await this.setupOAuthRedirectRoute();
  }

  enableMocking(): void {
    this.state.enableMocking = true;
  }

  disableMocking(): void {
    this.state.enableMocking = false;
  }

  getSignInRequest(): ToolsetSignInRequest | null {
    return this.state.signInRequest;
  }

  /**
   * Navigate to the OAuth callback URL '/auth/toolset-signin' and wait for the response
   */
  async navigateToCallback(): Promise<void> {
    if (!this.state.callbackUrl) {
      throw new Error('Callback URL has not been captured yet');
    }
    const respPromise = this.page.waitForResponse((resp) =>
      resp.url().includes(API.toolsetSignInHost()),
    );
    await this.page.goto(this.state.callbackUrl, {
      waitUntil: 'domcontentloaded',
    });
    await respPromise;
  }

  /**
   * Get sign-in API state
   */
  isSignedIn(): boolean {
    return this.state.isSignedIn;
  }

  /**
   * Get the current OAuth state
   */
  getState(): Readonly<OAuthState> {
    return { ...this.state };
  }

  /**
   * Get the mock OAuth configuration
   */
  getMockConfig(): Readonly<OAuthMockConfig> {
    return { ...this.mockConfig };
  }

  getAuthorizationCode(): string {
    return this.authorizationCode;
  }

  async cleanup(): Promise<void> {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
  }

  public async setupToolsetRoutes(): Promise<void> {
    await this.page.route(
      `**${API.api}/${this.initialToolset.id}`,
      async (route, request) => {
        const method = request.method();
        // Allow initial GET to go through unmocked
        if (!this.state.enableMocking) {
          await route.continue();
          return;
        }
        // Intercepted PUT request
        if (method === 'PUT') {
          const expectedCode = this.expectedStatusCodes.updateToolsetCode;
          await route.fulfill({
            status: expectedCode,
            contentType: 'application/json',
            body:
              expectedCode === 200
                ? JSON.stringify({ success: true })
                : undefined,
          });
          // Intercepted GET request
        } else if (method === 'GET') {
          const enrichedToolset: Toolset = {
            ...this.initialToolset,
            auth_settings: {
              authentication_type: ToolsetAuthTypes.OAUTH,
              redirect_uri: `${config.use!.baseURL}${Routes.ToolsetSignIn}`,
              client_id: this.mockConfig.client_id,
              authorization_endpoint: this.mockConfig.authorization_endpoint,
              token_endpoint: this.mockConfig.token_endpoint,
              scopes_supported: this.mockConfig.scopes_supported,
              code_challenge_method: this.mockConfig.code_challenge_method,
              global_auth_status: this.state.isSignedIn
                ? ToolsetAuthStatus.SIGNED_IN
                : ToolsetAuthStatus.SIGNED_OUT,
              user_level_auth_status: ToolsetAuthStatus.SIGNED_OUT,
            },
          };
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(enrichedToolset),
          });
        } else {
          await route.continue();
        }
      },
    );
  }

  public async setupSignInRoute(): Promise<void> {
    let requestBody;
    await this.page.route(API.toolsetSignInHost(), async (route, request) => {
      // Intercept '/api/ops/toolset/signin' call
      if (request.method() === 'POST') {
        const expectedCode = this.expectedStatusCodes.backendSigInCode;
        if (expectedCode === 200) {
          this.state.isSignedIn = true;
          requestBody = request.postDataJSON();
          this.state.signInRequest = requestBody;
          await route.fulfill({
            status: expectedCode,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Authentication successful',
            }),
          });
        } else {
          await route.fulfill({
            status: expectedCode,
            contentType: 'application/json',
            body: undefined,
          });
        }
      } else {
        await route.continue();
      }
    });
  }

  public async setupOAuthRedirectRoute(): Promise<void> {
    const redirectPattern = `${this.mockConfig.authorization_endpoint}*`;
    // Intercept OAuth redirect
    await this.page.route(redirectPattern, async (route) => {
      const url = new URL(route.request().url());
      this.state.capturedOAuthUrl = url.toString();
      this.state.capturedState = url.searchParams.get(OAuthQueryParams.state);
      // Prepare callback URL but don't navigate inside handler
      const redirectUri = url.searchParams.get(OAuthQueryParams.redirectUri)!;
      this.state.callbackUrl = `${redirectUri}?${OAuthQueryParams.code}=${this.authorizationCode}&${OAuthQueryParams.state}=${this.state.capturedState}`;
      // Abort the redirect
      await route.abort('aborted');
    });
  }
}
