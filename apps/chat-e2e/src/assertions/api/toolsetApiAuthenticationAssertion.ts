import { Routes } from '@/chat/constants/routes';
import {
  ToolsetAuthPayloadBase,
  ToolsetCredentialsLevel,
} from '@/chat/types/toolsets';
import { BaseAssertion } from '@/src/assertions';
import { OAuthQueryParams } from '@/src/testData';
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
    this.assertValueIsNotUndefined(state.capturedState);
    this.assertValue(params.get(OAuthQueryParams.responseType), 'code');
    this.assertValue(
      params.get(OAuthQueryParams.codeChallengeMethod),
      mockConfig.code_challenge_method,
    );
    this.assertValue(
      params.get(OAuthQueryParams.clientId),
      mockConfig.client_id,
    );
    this.assertStringIncludes(
      params.get(OAuthQueryParams.redirectUri)!,
      Routes.ToolsetSignIn,
    );
    this.assertValue(
      params.get(OAuthQueryParams.scope),
      mockConfig.scopes_supported.join(' '),
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
    this.assertValue(request.url, decodeURIComponent(expectedValues.url));
    this.assertValue(request.authenticationType, expectedValues.authType);
    this.assertValue(request.credentialsLevel, expectedValues.credentialsLevel);
    this.assertValue(request.code, expectedValues.authorizationCode);
  }

  public assertSignOutRequest(
    request: ToolsetAuthPayloadBase,
    expectedValues: {
      url: string;
      authType: ToolsetAuthTypes;
      credentialsLevel: ToolsetCredentialsLevel;
    },
  ) {
    this.assertValue(request.url, decodeURIComponent(expectedValues.url));
    this.assertValue(request.authenticationType, expectedValues.authType);
    this.assertValue(request.credentialsLevel, expectedValues.credentialsLevel);
  }
}
