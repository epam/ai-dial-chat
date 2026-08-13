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
  private handledSignInCount = 0;

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

  // Drives the popup through the OAuth callback and waits for it to close —
  // the signal that sign-in fully landed. We navigate there ourselves unless
  // the mocked auth redirect already got it there first, or the flow is
  // already done.
  async navigateToCallback(popup: Page): Promise<void> {
    if (!this.oauthState.callbackUrl) {
      throw new Error('Callback URL has not been captured yet');
    }

    if (!this.isFlowAlreadyDone(popup)) {
      // Set up the response waiter before navigating so we don't miss it
      const signInResponsePromise = popup.waitForResponse((resp) =>
        resp.url().includes(API.toolsetSignInHost()),
      );

      // If the mocked auth redirect already landed the popup on the callback
      // page, navigating it there again would cancel its in-flight sign-in
      // request (a new navigation aborts the old document's pending
      // fetches) — let it finish the flow on its own instead.
      if (!popup.url().includes(Routes.ToolsetSignIn)) {
        try {
          await popup.goto(this.oauthState.callbackUrl, {
            waitUntil: 'domcontentloaded',
          });
        } catch (e) {
          // Race: the mocked auth redirect can drive the popup through the
          // whole sign-in flow before/during our goto(), aborting it or
          // tearing the popup down as a side effect. Only rethrow if that's
          // not what happened.
          if (
            !this.isFlowAlreadyDone(popup) &&
            !popup.url().includes(Routes.ToolsetSignIn)
          ) {
            throw e;
          }
        }
      }

      if (!this.isFlowAlreadyDone(popup)) {
        try {
          await signInResponsePromise;
        } catch {
          throw new Error(
            `Expected sign-in response was not received for toolset "${this.getToolset().id}". Popup URL: "${popup.isClosed() ? '<closed>' : popup.url()}"`,
          );
        }
      }
    }

    this.handledSignInCount = this.getSignInCount();

    // The main page closes the popup once it detects login-complete=1. This
    // is also the caller's synchronization point — getSignInRequest() and
    // the app's UI are only guaranteed to reflect this login once the popup
    // is gone, whether we drove the navigation ourselves or the mocked auth
    // redirect completed the whole flow before we ever got here.
    if (!popup.isClosed()) {
      await popup.waitForEvent('close');
    }
  }

  // Race: the mocked auth redirect can finish the whole sign-in flow before
  // we ever get here. The counter catches that reliably; popup.isClosed()
  // can lag or throw mid-teardown.
  private isFlowAlreadyDone(popup: Page): boolean {
    return popup.isClosed() || this.getSignInCount() > this.handledSignInCount;
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
