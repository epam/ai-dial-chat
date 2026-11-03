import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import type { ApplicationExternalServiceDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
} from '../../external-services/useExternalServiceLogin';
import {
  buildApplicationCredentialLoginParams,
  mapApplicationCredentials,
} from '../application-credentials';

const makeService = (
  overrides: Partial<ApplicationExternalServiceDto> = {},
): ApplicationExternalServiceDto => ({
  id: 'github',
  displayName: 'GitHub',
  authenticationType: 'OAUTH',
  ...overrides,
});

describe('mapApplicationCredentials', () => {
  it('maps a signed-in OAuth service to a removable personal credential', () => {
    const [credential] = mapApplicationCredentials(
      [makeService({ userLevelAuthStatus: 'SIGNED_IN', description: 'Code' })],
      { isOfflineConnected: false },
    );

    expect(credential).toEqual({
      id: 'github',
      name: 'GitHub',
      description: 'Code',
      authenticationType: ToolsetAuthenticationType.OAuth,
      status: CredentialStatus.SignedIn,
      hasSharedCredentials: false,
      canLogout: true,
      canConsentToOfflineUsage: true,
      hint: undefined,
    });
  });

  it('falls back to the id when the display name is empty', () => {
    const [credential] = mapApplicationCredentials(
      [makeService({ displayName: '' })],
      { isOfflineConnected: false },
    );

    expect(credential.name).toBe('github');
  });

  it('maps an API-key service to the API-key form', () => {
    const [credential] = mapApplicationCredentials(
      [makeService({ authenticationType: 'API_KEY' })],
      { isOfflineConnected: false },
    );

    expect(credential.authenticationType).toBe(
      ToolsetAuthenticationType.ApiKey,
    );
  });

  it('flags shared credentials when only a global or app-level login exists', () => {
    const [global, appLevel] = mapApplicationCredentials(
      [
        makeService({ globalAuthStatus: 'SIGNED_IN' }),
        makeService({ appLevelAuthStatus: 'SIGNED_IN' }),
      ],
      { isOfflineConnected: false },
    );

    expect(global.status).toBe(CredentialStatus.SignedOut);
    expect(global.hasSharedCredentials).toBe(true);
    expect(appLevel.hasSharedCredentials).toBe(true);
  });

  it('signs a DIAL-native service in only with offline credentials and the app grant', () => {
    const service = makeService({
      authenticationType: 'DIAL_NATIVE',
      appLevelAuthStatus: 'SIGNED_IN',
    });

    const [connected] = mapApplicationCredentials([service], {
      isOfflineConnected: true,
      dialNativeHint: 'Uses your DIAL login',
    });
    const [disconnected] = mapApplicationCredentials([service], {
      isOfflineConnected: false,
    });

    expect(connected).toMatchObject({
      status: CredentialStatus.SignedIn,
      hasSharedCredentials: false,
      canLogout: false,
      canConsentToOfflineUsage: false,
      hint: 'Uses your DIAL login',
    });
    expect(disconnected.status).toBe(CredentialStatus.SignedOut);
  });
});

describe('buildApplicationCredentialLoginParams', () => {
  it('builds a user-level login request with the service OAuth settings', () => {
    const service = makeService({
      clientId: 'client',
      authorizationEndpoint: 'https://auth.example/authorize',
      scopesSupported: ['repo'],
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      resource: 'https://mcp.example.com/mcp',
    });

    expect(
      buildApplicationCredentialLoginParams('app-1', service, {
        offlineUsageConsent: true,
      }),
    ).toEqual({
      appId: 'app-1',
      serviceId: 'github',
      offlineUsageConsent: true,
      credentialsLevel: ExternalServiceCredentialsLevel.User,
      authenticationType: ExternalServiceAuthType.OAuth,
      oauthSettings: {
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example/authorize',
        scopes: ['repo'],
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        resource: 'https://mcp.example.com/mcp',
      },
      forceStale: false,
    });
  });

  it('passes the entered API key through', () => {
    const params = buildApplicationCredentialLoginParams(
      'app-1',
      makeService({ authenticationType: 'API_KEY' }),
      { apiKey: 'secret', offlineUsageConsent: false },
    );

    expect(params.apiKey).toBe('secret');
    expect(params.authenticationType).toBe(ExternalServiceAuthType.ApiKey);
  });

  it('forces a stale re-login when the personal credential failed', () => {
    const params = buildApplicationCredentialLoginParams(
      'app-1',
      makeService({ userLevelAuthStatus: 'FAILED' }),
      { offlineUsageConsent: false },
    );

    expect(params.forceStale).toBe(true);
  });
});
