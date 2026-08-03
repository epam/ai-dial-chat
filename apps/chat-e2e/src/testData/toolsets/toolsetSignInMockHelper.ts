import { API } from '@/src/testData';
import { OAuthMockConfig } from '@/src/testData/toolsets/authMockConfig';
import {
  Toolset,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

type AuthSettings = NonNullable<Toolset['auth_settings']>;

// Only the endpoint part of the OAuth config is needed to render a toolset as
// logged out; the rest (client id/secret) matters for the login flow itself.
type OAuthEndpoints = Pick<
  OAuthMockConfig,
  'authorization_endpoint' | 'token_endpoint'
> &
  Partial<Pick<OAuthMockConfig, 'scopes_supported' | 'code_challenge_method'>>;

// A toolset that must appear as login-requiring in the preview sign-in modal.
export interface SignInMockToolset {
  toolset: Toolset;
  authSettings: AuthSettings;
}

const CHANNEL_ID = 'e2e-mocked-channel';
const CHANNEL_ID_HEADER = 'x-dial-client-channel-id';
const TOOLSET_SIGN_IN_METHOD = 'toolset/signin';

// Simulates the "Toolset login required" modal shown in the App editor preview
// (Feature.LiveChatInteraction). The modal is driven by three things that this
// helper mocks: the toolsets listing (so toolsets look logged out), the SSE
// sign-in channel (which asks the user to log in), and the report endpoint
// (which resolves a login/decline). The actual OAuth/API key login itself still
// goes through OAuthMockHelper / ApiKeyMockHelper.
export class ToolsetSignInMockHelper {
  constructor(private readonly page: Page) {}

  // Toolsets the channel will ask to log in on its next connect; emptied once
  // pushed, so reconnects don't re-add already resolved events.
  private pendingToolsets: Toolset[] = [];
  // The full set the channel was set up with, used as the default to re-ask for.
  private channelToolsets: Toolset[] = [];
  private eventId = 0;

  // Logged-out OAuth auth settings — endpoints must match the OAuthMockHelper
  // config so the login popup redirect is intercepted.
  static loggedOutOAuthSettings(config: OAuthEndpoints): AuthSettings {
    return {
      authentication_type: ToolsetAuthTypes.OAUTH,
      authorization_endpoint: config.authorization_endpoint,
      token_endpoint: config.token_endpoint,
      scopes_supported: config.scopes_supported,
      code_challenge_method: config.code_challenge_method,
      global_auth_status: ToolsetAuthStatus.SIGNED_OUT,
      user_level_auth_status: ToolsetAuthStatus.SIGNED_OUT,
    } as AuthSettings;
  }

  // Logged-out API key auth settings. The key header pre-fills the (hidden)
  // config field — without it the login form stays invalid and disabled.
  static loggedOutApiKeySettings(apiKeyHeader: string): AuthSettings {
    return {
      authentication_type: ToolsetAuthTypes.API_KEY,
      api_key_header: apiKeyHeader,
      global_auth_status: ToolsetAuthStatus.SIGNED_OUT,
      user_level_auth_status: ToolsetAuthStatus.SIGNED_OUT,
    } as AuthSettings;
  }

  // Serve the real toolsets listing with the given toolsets enriched as
  // login-requiring. The listing is fulfilled from the passed cache, never
  // fetched inside the handler: the modal reads it via rxjs fromFetch during
  // chat streaming, and route.fetch()/page.request torn down with the page
  // fetch lifecycle would hang the request forever (endless spinner).
  async setupToolsetsListingRoute(
    fullListing: Toolset[],
    signInToolsets: SignInMockToolset[],
  ): Promise<void> {
    for (const { toolset, authSettings } of signInToolsets) {
      const entry = fullListing.find((t) => t.reference === toolset.reference);
      if (entry) entry.auth_settings = authSettings;
    }
    await this.page.context().route(`**${API.toolsetsHost()}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: fullListing }),
      }),
    );
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
