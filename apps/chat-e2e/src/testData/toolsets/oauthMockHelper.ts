import { Routes } from '@/chat/constants/routes';
import { ServerSlugs } from '@/chat/types/slugs-types';
import { ToolsetAuthPayloadBase } from '@/chat/types/toolsets';
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
  signOutRequest: ToolsetAuthPayloadBase | null;
}

export class OAuthMockHelper {
  private page: Page;
  private toolset: Toolset;
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
    signOutRequest: null,
  };

  constructor(
    page: Page,
    initialToolset: Toolset,
    toolsetEndpoint: string,
    options: OAuthMockOptions = {},
  ) {
    this.page = page;
    this.toolset = initialToolset;
    this.toolset.endpoint = toolsetEndpoint;
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
    await this.setupSignOutRoute();
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

  getSignOutRequest(): ToolsetAuthPayloadBase | null {
    return this.state.signOutRequest;
  }

  getToolset(): Toolset {
    return this.toolset;
  }

  // Navigate the popup to the callback URL and wait for the flow to complete.
  //
  // We navigate explicitly instead of relying on the automatic 302 redirect
  // because after a cross-origin navigation (random OAuth URL → localhost),
  // Playwright's context-level route handlers may not intercept the popup's
  // fetch requests. Driving the popup ourselves keeps everything same-origin
  // from the start, so the sign-in mock fires reliably.
  //
  // After the popup loads /auth/toolset-signin, it calls the sign-in API,
  // then adds login-complete=1 to its URL. The main page detects that and
  // closes the popup. If the popup is already closed (the flow finished
  // during an earlier step), we return immediately.
  async navigateToCallback(popup: Page): Promise<void> {
    if (!this.state.callbackUrl) {
      throw new Error('Callback URL has not been captured yet');
    }
    if (popup.isClosed()) return;

    // Set up the response waiter before navigating so we don't miss it
    const signInResponsePromise = popup.waitForResponse((resp) =>
      resp.url().includes(API.toolsetSignInHost()),
    );
    try {
      await popup.goto(this.state.callbackUrl, {
        waitUntil: 'domcontentloaded',
      });
    } catch (e) {
      // Race condition: the 302 redirect completed the sign-in flow before we
      // got here, so the main page already closed the popup. Nothing left to do.
      if (!popup.isClosed()) throw e;
      signInResponsePromise.catch(() => {});
      return;
    }
    await signInResponsePromise;

    // The main page closes the popup once it detects login-complete=1
    if (!popup.isClosed()) {
      await popup.waitForEvent('close');
    }
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
    await this.page.context().unrouteAll({ behavior: 'ignoreErrors' });
  }

  /**
   * Updates the toolset routes with partial toolset properties.
   * Merges the provided properties with the current toolset state.
   * Note: Subsequent calls will merge with the already-modified toolset.
   * @param updatedToolsetProps - Partial toolset properties to merge
   */
  public async setupUpdatedToolsetRoutes(
    updatedToolsetProps: Partial<Toolset>,
  ): Promise<void> {
    const mergedOptions = { ...this.toolset, ...updatedToolsetProps };
    return this.setupToolsetRoutes(mergedOptions);
  }

  public async setupToolsetRoutes(updatedToolset?: Toolset): Promise<void> {
    this.toolset = updatedToolset ?? this.toolset;
    // context-level so the popup can also fetch the toolset (e.g. after login)
    await this.page
      .context()
      .route(`**${API.api}/${this.toolset.id}`, async (route, request) => {
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
            ...this.toolset,
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
      });
  }

  public async setupSignInRoute(): Promise<void> {
    let requestBody;
    // sign-in POST comes from the popup, so we need context-level interception
    await this.page
      .context()
      .route(API.toolsetSignInHost(), async (route, request) => {
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
    // OAuth URL is opened in a popup, so page.route() won't catch it — use context
    await this.page.context().route(redirectPattern, async (route) => {
      const url = new URL(route.request().url());
      this.state.capturedOAuthUrl = url.toString();
      this.state.capturedState = url.searchParams.get(OAuthQueryParams.state);
      const redirectUri = url.searchParams.get(OAuthQueryParams.redirectUri)!;
      this.state.callbackUrl = `${redirectUri}?${OAuthQueryParams.code}=${this.authorizationCode}&${OAuthQueryParams.state}=${this.state.capturedState}`;
      // Redirect popup to callback instead of aborting — this lets
      // the popup complete the full login flow on its own and avoids
      // "Auth timeout" crash from signInToolset()
      await route.fulfill({
        status: 302,
        headers: { location: this.state.callbackUrl },
      });
    });
  }

  public async setupSignOutRoute(): Promise<void> {
    const signOutUrl = `**${API.api}/ops/${ServerSlugs.TOOLSET_SIGN_OUT}`;
    // Intercept OAuth sign-out call
    await this.page.route(signOutUrl, async (route, request) => {
      this.state.isSignedIn = false;
      const requestData = request.postDataJSON();
      if (requestData === null) {
        throw new Error('Failed to parse sign-out request body');
      } else {
        this.state.signOutRequest = requestData;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Sign-out successful',
        }),
      });
    });
  }
}
