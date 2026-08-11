import { API } from '@/src/testData';
import { ApiKeyMockHelper } from '@/src/testData/toolsets/apiKeyMockHelper';
import { SignInRequest } from '@/src/testData/toolsets/authMockConfig';
import { BaseAuthMockHelper } from '@/src/testData/toolsets/baseAuthMockHelper';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { Toolset } from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

export type ToolsetAuthMock = BaseAuthMockHelper<SignInRequest>;

const CHANNEL_ID = 'e2e-mocked-channel';
const CHANNEL_ID_HEADER = 'x-dial-client-channel-id';
const TOOLSET_SIGN_IN_METHOD = 'toolset/signin';

// Drives the "Toolset login required" modal: the toolsets listing, the SSE
// sign-in channel and the report endpoint. The login itself goes through
// OAuthMockHelper / ApiKeyMockHelper.
export class ToolsetSignInMockHelper {
  constructor(private readonly page: Page) {}

  // Toolsets the channel will ask to log in on its next connect; emptied once
  // pushed, so reconnects don't re-add already resolved events.
  private pendingToolsets: Toolset[] = [];
  // The full set the channel was set up with, used as the default to re-ask for.
  private channelToolsets: Toolset[] = [];
  private eventId = 0;

  // Pass the returned mock to setupToolsetsListingRoute - it serves the auth
  // settings for all mocks at once.
  async loggedOutOAuthMock(
    toolset: Toolset,
    endpoint: string,
  ): Promise<OAuthMockHelper> {
    const mock = new OAuthMockHelper(this.page, toolset, endpoint);
    await mock.setupToolsetRoutes();
    await mock.setupSignInRoute();
    await mock.setupOAuthRedirectRoute();
    await mock.setupSignOutRoute();
    mock.enableMocking();
    return mock;
  }

  // The login form hides the "API Key parameter name" field but still requires
  // it, so put the header on the toolset up front, else Log in stays disabled.
  async loggedOutApiKeyMock(
    toolset: Toolset,
    endpoint: string,
    apiKeyHeader: string,
  ): Promise<ApiKeyMockHelper> {
    const mock = new ApiKeyMockHelper(
      this.page,
      {
        ...toolset,
        auth_settings: { api_key_header: apiKeyHeader },
      } as Toolset,
      endpoint,
    );
    await mock.setupToolsetRoutes();
    await mock.setupSignInRoute();
    await mock.setupSignOutRoute();
    mock.enableMocking();
    return mock;
  }

  // One route for all mocks - each mock's own setupToolsetListingRoute() would
  // register on the same pattern and the last one would win.
  //
  // Never fetch inside the handler: the modal reads the listing while the chat
  // response streams, and route.fetch() dies with the page fetch lifecycle -
  // the request then hangs forever on a spinner.
  //
  // Auth settings are read per request, so a login flips the toolset to signed
  // in for every later read.
  async setupToolsetsListingRoute(
    fullListing: Toolset[],
    authMocks: ToolsetAuthMock[],
  ): Promise<void> {
    await this.page.context().route(`**${API.toolsetsHost()}`, (route) => {
      const listing = fullListing.map((entry) => {
        const mock = authMocks.find(
          (m) => m.getToolset().reference === entry.reference,
        );
        return mock
          ? ({
              ...entry,
              auth_settings: mock.getAuthSettings(),
            } as Toolset)
          : entry;
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: listing }),
      });
    });
  }

  // Ask the user to log in to each toolset, then keep the report endpoint
  // resolvable so logged-in/declined rows clear.
  async setupSignInChannel(toolsets: Toolset[]): Promise<void> {
    this.channelToolsets = [...toolsets];
    this.pendingToolsets = [...toolsets];

    // The real channel is one long-lived stream; our mock closes the response,
    // so the client reconnects every few seconds. Push the queued events once
    // and clear the queue — otherwise every reconnect re-adds already resolved
    // events and the toolset just logged in reappears. Keep the channel id on
    // every response so report stays resolvable.
    await this.page.route(`**${API.subscribeHost()}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { [CHANNEL_ID_HEADER]: CHANNEL_ID },
        body: this.takePendingEvents(),
      });
    });

    await this.page.route(`**${API.reportHost()}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      }),
    );
  }

  /**
   * Queue another sign-in request, as the backend does for every new message
   * while a toolset stays logged out. The channel reconnects on its own, so the
   * events reach the client shortly after.
   * @param toolsets defaults to the ones passed to setupSignInChannel
   */
  requestSignInAgain(toolsets?: Toolset[]): void {
    this.pendingToolsets = [...(toolsets ?? this.channelToolsets)];
  }

  private takePendingEvents(): string {
    // Each event's toolsetId is decoded via decodeApiUrl on the client; use the
    // toolset id so it matches both the toolsets map key and the login-success
    // payload that resolves (removes) the event.
    const body = this.pendingToolsets
      .map((toolset) =>
        [
          'data:',
          JSON.stringify({
            id: `${++this.eventId}`,
            method: TOOLSET_SIGN_IN_METHOD,
            params: { toolsetId: toolset.id },
          }),
        ].join(' '),
      )
      .join('\n');
    this.pendingToolsets = [];
    return body;
  }
}
