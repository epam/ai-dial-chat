import { ServerSlugs } from '@/chat/types/slugs-types';
import {
  ToolsetAuthPayloadBase,
  ToolsetCredentialsLevel,
} from '@/chat/types/toolsets';
import { API, StatusCodeConfig } from '@/src/testData';
import {
  AuthState,
  SignInRequest,
} from '@/src/testData/toolsets/authMockConfig';
import { ItemUtil } from '@/src/utils';
import { Toolset } from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';
import { Route } from 'playwright-core';

const DEFAULT_STATUS_CODES: StatusCodeConfig = {
  updateToolsetCode: 200,
  backendSignInCode: 200,
};

export abstract class BaseAuthMockHelper<T extends SignInRequest> {
  protected page: Page;
  protected toolset: Toolset;
  protected readonly toolsetEndpoint: string;
  protected readonly expectedStatusCodes: StatusCodeConfig;
  protected state: AuthState<T>;
  protected isSignedInGlobal = false;
  protected isSignedInUser = false;
  protected orgSignInRequest: T | null = null;
  protected userSignInRequest: T | null = null;

  protected constructor(
    page: Page,
    initialToolset: Toolset,
    toolsetEndpoint: string,
    expectedStatusCodes?: Partial<StatusCodeConfig>,
  ) {
    this.page = page;
    this.toolset = { ...initialToolset, endpoint: toolsetEndpoint };
    this.toolsetEndpoint = toolsetEndpoint;
    this.expectedStatusCodes = {
      ...DEFAULT_STATUS_CODES,
      ...expectedStatusCodes,
    };
    this.state = {
      isSignedIn: false,
      enableMocking: false,
      signInRequest: null,
      signOutRequest: null,
    };
  }

  /**
   * Build the auth_settings payload for mocked GET responses.
   */
  protected abstract buildAuthSettings(): Record<string, unknown>;

  abstract setupMocks(): Promise<void>;

  enableMocking(): void {
    this.state.enableMocking = true;
  }

  disableMocking(): void {
    this.state.enableMocking = false;
  }

  isSignedIn(): boolean {
    return this.state.isSignedIn;
  }

  setSignedIn(isSignedIn: boolean) {
    this.state.isSignedIn = isSignedIn;
  }

  setIsSignedInGlobal(isSignedInGlobal: boolean) {
    this.isSignedInGlobal = isSignedInGlobal;
  }

  setIsSignedInUser(isSignedInUser: boolean) {
    this.isSignedInUser = isSignedInUser;
  }

  getSignInRequest(): T | null {
    return this.state.signInRequest;
  }

  getSignOutRequest(): ToolsetAuthPayloadBase | null {
    return this.state.signOutRequest;
  }

  getToolset(): Toolset {
    return this.toolset;
  }

  async cleanup(): Promise<void> {
    await this.page.context().unrouteAll({ behavior: 'ignoreErrors' });
  }

  /**
   * Merges partial toolset properties and re-registers toolset routes.
   */
  async setupUpdatedToolsetRoutes(
    updatedToolsetProps: Partial<Toolset>,
  ): Promise<void> {
    return this.setupToolsetRoutes({ ...this.toolset, ...updatedToolsetProps });
  }

  async setupToolsetRoutes(updatedToolset?: Toolset): Promise<void> {
    this.toolset = updatedToolset ?? this.toolset;
    const id = this.toolset.id ?? this.toolset.name;
    const decodedToolsetId = decodeURIComponent(id!);
    const pattern = `**${API.api}/${ItemUtil.getEncodedItemId(decodedToolsetId)}`;

    await this.page.context().route(pattern, async (route, request) => {
      if (!this.state.enableMocking) {
        await route.continue();
        return;
      }
      const method = request.method();
      switch (method) {
        case 'PUT':
          await this.fulfillPutRoute(route);
          break;
        case 'GET':
          await this.fulfillGetRoute(route);
          break;
        default:
          await route.continue();
      }
    });
  }

  async setupToolsetListingRoute(updatedToolset?: Toolset): Promise<void> {
    this.toolset = updatedToolset ?? this.toolset;
    await this.page
      .context()
      .route(`**${API.toolsetsHost()}`, async (route) => {
        if (!this.state.enableMocking) {
          await route.continue();
          return;
        }
        const response = await route.fetch();
        const json = await response.json();
        const toolsetToEnrich = (json.data as Toolset[]).find(
          (t) => t.reference === this.toolset.reference,
        )!;
        // @ts-expect-error set of records is expected for auth_settings property
        toolsetToEnrich.auth_settings = this.buildAuthSettings();
        await route.fulfill({ response, json });
      });
  }

  async setupSignInRoute(): Promise<void> {
    await this.page
      .context()
      .route(API.toolsetSignInHost(), async (route, request) => {
        if (request.method() !== 'POST') {
          await route.continue();
          return;
        }
        const { backendSignInCode } = this.expectedStatusCodes;
        if (backendSignInCode === 200) {
          const body: T = request.postDataJSON();
          if (body.credentialsLevel === ToolsetCredentialsLevel.GLOBAL) {
            this.isSignedInGlobal = true;
            this.orgSignInRequest = body;
          } else {
            this.isSignedInUser = true;
            this.userSignInRequest = body;
          }
          this.state.isSignedIn = true;
          this.state.signInRequest = body;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Authentication successful',
            }),
          });
        } else {
          await route.fulfill({
            status: backendSignInCode,
            contentType: 'application/json',
          });
        }
      });
  }

  getOrgSignInRequest(): T | null {
    return this.orgSignInRequest;
  }

  getUserSignInRequest(): T | null {
    return this.userSignInRequest;
  }

  async setupSignOutRoute(): Promise<void> {
    const signOutUrl = `**${API.api}/ops/${ServerSlugs.TOOLSET_SIGN_OUT}`;
    await this.page.route(signOutUrl, async (route, request) => {
      const requestData = request.postDataJSON();
      if (requestData === null) {
        throw new Error('Failed to parse sign-out request body');
      }

      this.state.isSignedIn = false;
      this.state.signOutRequest = requestData;

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

  private async fulfillPutRoute(route: Route): Promise<void> {
    const { updateToolsetCode } = this.expectedStatusCodes;
    await route.fulfill({
      status: updateToolsetCode,
      contentType: 'application/json',
      body:
        updateToolsetCode === 200
          ? JSON.stringify({ success: true })
          : undefined,
    });
  }

  private async fulfillGetRoute(route: Route): Promise<void> {
    const enrichedToolset: Toolset = {
      ...this.toolset,
      // @ts-expect-error set of records is expected for auth_settings property
      auth_settings: this.buildAuthSettings(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(enrichedToolset),
    });
  }
}
