import { Routes } from '@/chat/constants/routes';
import config from '@/config/chat.playwright.config';
import { API, OAuthQueryParams } from '@/src/testData';
import {
  DEFAULT_AUTHORIZATION_CODE,
  DEFAULT_OAUTH_CONFIG,
  OAuthMockConfig,
  OAuthMockOptions,
  ToolsetOAuthSignInRequest,
} from '@/src/testData/toolsets/authMockConfig';
import { BaseAuthMockHelper } from '@/src/testData/toolsets/baseAuthMockHelper';
import {
  Toolset,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

export interface OAuthState {
  capturedOAuthUrl: string | null;
  capturedState: string | null;
  callbackUrl: string | null;
}

export class OAuthMockHelper extends BaseAuthMockHelper<ToolsetOAuthSignInRequest> {
  private readonly mockConfig: OAuthMockConfig;
  private readonly authorizationCode: string;
  private oauthState: OAuthState = {
    capturedOAuthUrl: null,
    capturedState: null,
    callbackUrl: null,
  };

  constructor(
    page: Page,
    initialToolset: Toolset,
    toolsetEndpoint: string,
    options: OAuthMockOptions = {},
  ) {
    super(page, initialToolset, toolsetEndpoint, options);
    this.mockConfig = this.buildMockConfig(options.mockOAuthConfig);
    this.authorizationCode =
      options.authorizationCode ?? DEFAULT_AUTHORIZATION_CODE;
  }

  protected buildAuthSettings(): Record<string, unknown> {
    return {
      authentication_type: ToolsetAuthTypes.OAUTH,
      redirect_uri: `${config.use!.baseURL}${Routes.ToolsetSignIn}`,
      client_id: this.mockConfig.client_id,
      authorization_endpoint: this.mockConfig.authorization_endpoint,
      token_endpoint: this.mockConfig.token_endpoint,
      scopes_supported: this.mockConfig.scopes_supported,
      code_challenge_method: this.mockConfig.code_challenge_method,
      global_auth_status: this.isSignedInGlobal
        ? ToolsetAuthStatus.SIGNED_IN
        : ToolsetAuthStatus.SIGNED_OUT,
      user_level_auth_status: this.isSignedInUser
        ? ToolsetAuthStatus.SIGNED_IN
        : ToolsetAuthStatus.SIGNED_OUT,
    };
  }

  async setupMocks(): Promise<void> {
    await this.setupToolsetRoutes();
    await this.setupToolsetListingRoute();
    await this.setupSignInRoute();
    await this.setupOAuthRedirectRoute();
    await this.setupSignOutRoute();
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
    if (!this.oauthState.callbackUrl) {
      throw new Error('Callback URL has not been captured yet');
    }
    // The mocked authorization endpoint's 302 already sends the popup toward
    // the callback URL the moment it opens, so the whole flow (sign-in, then
    // the main page closing the popup) can complete entirely on its own
    // before we ever get here — this is only more likely on slower/remote
    // environments (CI). getSignInRequest() is the one thing that can't lie
    // about whether that already happened, unlike popup.isClosed()/url(),
    // which can lag behind or throw during the browser/context teardown.
    if (popup.isClosed() || this.getSignInRequest() !== null) return;

    // Set up the response waiter before navigating so we don't miss it
    const signInResponsePromise = popup.waitForResponse((resp) =>
      resp.url().includes(API.toolsetSignInHost()),
    );
    try {
      await popup.goto(this.oauthState.callbackUrl, {
        waitUntil: 'domcontentloaded',
      });
    } catch (e) {
      // Race condition: the auto-redirect above already carried the popup
      // through (part of) the callback flow before we got here, so our
      // explicit goto() gets aborted, or the popup/its context torn down, as
      // a side effect. Only bail out for real if sign-in never actually
      // happened AND the popup isn't even heading to the callback page.
      if (this.getSignInRequest() !== null) return;
      const isHeadingToCallback =
        popup.isClosed() || popup.url().includes(Routes.ToolsetSignIn);
      if (!isHeadingToCallback) throw e;
    }

    if (popup.isClosed() || this.getSignInRequest() !== null) return;

    try {
      await signInResponsePromise;
    } catch {
      console.error(
        'Expected sign-in response was not received, likely due to the popup being closed before navigation.',
      );
      return;
    }

    // The main page closes the popup once it detects login-complete=1
    if (!popup.isClosed()) {
      await popup.waitForEvent('close');
    }
  }

  /**
   * Get the current OAuth state
   */
  getOAuthState(): Readonly<OAuthState> {
    return { ...this.oauthState };
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

  public async setupOAuthRedirectRoute(): Promise<void> {
    const redirectPattern = `${this.mockConfig.authorization_endpoint}*`;
    // OAuth URL is opened in a popup, so page.route() won't catch it — use context
    await this.page.context().route(redirectPattern, async (route) => {
      const url = new URL(route.request().url());
      this.oauthState.capturedOAuthUrl = url.toString();
      this.oauthState.capturedState = url.searchParams.get(
        OAuthQueryParams.state,
      );
      const redirectUri = url.searchParams.get(OAuthQueryParams.redirectUri)!;
      this.oauthState.callbackUrl = `${redirectUri}?${OAuthQueryParams.code}=${this.authorizationCode}&${OAuthQueryParams.state}=${this.oauthState.capturedState}`;
      // Redirect popup to callback instead of aborting — this lets
      // the popup complete the full login flow on its own and avoids
      // "Auth timeout" crash from signInToolset()
      await route.fulfill({
        status: 302,
        headers: { location: this.oauthState.callbackUrl },
      });
    });
  }

  private buildMockConfig(
    customConfig: Partial<OAuthMockConfig> = {},
  ): OAuthMockConfig {
    return {
      ...DEFAULT_OAUTH_CONFIG,
      authorization_endpoint: API.authorizationEndpoint(this.toolsetEndpoint),
      token_endpoint: API.tokenEndpoint(this.toolsetEndpoint),
      ...customConfig,
    };
  }
}
