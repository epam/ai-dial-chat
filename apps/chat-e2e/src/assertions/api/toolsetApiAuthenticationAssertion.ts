import { Routes } from '@/chat/constants/routes';
import {
  ToolsetAuthPayloadBase,
  ToolsetCredentialsLevel,
} from '@/chat/types/toolsets';
import { BaseAssertion } from '@/src/assertions';
import { MarketplaceExpectedMessages, OAuthQueryParams } from '@/src/testData';
import {
  OAuthMockConfig,
  ToolsetSignInRequest,
} from '@/src/testData/toolsets/oauthMockConfig';
import { OAuthState } from '@/src/testData/toolsets/oauthMockHelper';
import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

export class ToolsetApiAuthenticationAssertion extends BaseAssertion {
  public assertOAuthRedirectRequest(
    state: OAuthState,
    mockConfig: OAuthMockConfig,
  ) {
    const redirectUrl = new URL(state.capturedOAuthUrl!);
    const params = redirectUrl.searchParams;
    this.assertValueIsNotUndefined(
      state.capturedState,
      MarketplaceExpectedMessages.toolsetOAuthRedirectStateIsDefined,
    );
    this.assertValue(
      params.get(OAuthQueryParams.responseType),
      'code',
      MarketplaceExpectedMessages.toolsetOAuthRedirectResponseTypeIsValid,
    );
    this.assertValue(
      params.get(OAuthQueryParams.codeChallengeMethod),
      mockConfig.code_challenge_method,
      MarketplaceExpectedMessages.toolsetOAuthRedirectCodeChallengeMethodIsValid,
    );
    this.assertValue(
      params.get(OAuthQueryParams.clientId),
      mockConfig.client_id,
      MarketplaceExpectedMessages.toolsetOAuthRedirectClientIdIsValid,
    );
    this.assertStringIncludes(
      params.get(OAuthQueryParams.redirectUri)!,
      Routes.ToolsetSignIn,
      MarketplaceExpectedMessages.toolsetOAuthRedirectUriIsValid,
    );
    this.assertValue(
      params.get(OAuthQueryParams.scope),
      mockConfig.scopes_supported.join(' '),
      MarketplaceExpectedMessages.toolsetSupportedScopesAreValid,
    );
  }

  public assertSignInRequest(
    request: ToolsetSignInRequest,
    expectedValues: {
      url: string;
      authType: ToolsetAuthTypes;
      credentialsLevel: ToolsetCredentialsLevel;
      authorizationCode: string;
    },
  ) {
    this.assertValue(
      request.url,
      decodeURIComponent(expectedValues.url),
      MarketplaceExpectedMessages.toolsetSignInUrlValid,
    );
    this.assertValue(
      request.authenticationType,
      expectedValues.authType,
      MarketplaceExpectedMessages.toolsetSignInAuthTypeIsValid,
    );
    this.assertValue(
      request.credentialsLevel,
      expectedValues.credentialsLevel,
      MarketplaceExpectedMessages.toolsetSignInCredentialsLevelIsValid,
    );
    this.assertValue(
      request.code,
      expectedValues.authorizationCode,
      MarketplaceExpectedMessages.toolsetSignInCodeIsValid,
    );
  }

  public assertSignOutRequest(
    request: ToolsetAuthPayloadBase,
    expectedValues: {
      url: string;
      authType: ToolsetAuthTypes;
      credentialsLevel: ToolsetCredentialsLevel;
    },
  ) {
    this.assertValue(
      request.url,
      decodeURIComponent(expectedValues.url),
      MarketplaceExpectedMessages.toolsetSignOutUrlValid,
    );
    this.assertValue(
      request.authenticationType,
      expectedValues.authType,
      MarketplaceExpectedMessages.toolsetSignOutAuthTypeIsValid,
    );
    this.assertValue(
      request.credentialsLevel,
      expectedValues.credentialsLevel,
      MarketplaceExpectedMessages.toolsetSignOutCredentialsLevelIsValid,
    );
  }
}
