import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOAuthCallbackExchange,
  type OAuthCallbackExchangeOperations,
} from '../callback-exchange';
import type { ToolsetRedirectState } from '../models';
import {
  OAuthResourceKind,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthFailureReason,
} from '../types';

const CODE = 'auth-code-xyz';
const REDIRECT_URI = 'http://localhost/auth/toolset-signin';

const operations = {
  loginToolset: vi.fn<OAuthCallbackExchangeOperations['loginToolset']>(),
  signInExternalService:
    vi.fn<OAuthCallbackExchangeOperations['signInExternalService']>(),
  signInOfflineCredentials:
    vi.fn<OAuthCallbackExchangeOperations['signInOfflineCredentials']>(),
};

const exchange = createOAuthCallbackExchange(operations);

const run = (redirectState: ToolsetRedirectState) =>
  exchange({
    code: CODE,
    redirectUri: REDIRECT_URI,
    credentialsLevel: ToolsetCredentialsLevel.User,
    redirectState,
  });

describe('createOAuthCallbackExchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operations.loginToolset.mockResolvedValue({ success: true });
    operations.signInExternalService.mockResolvedValue({ success: true });
    operations.signInOfflineCredentials.mockResolvedValue({ success: true });
  });

  it('logs the toolset in when the redirect state names no resource kind', async () => {
    await expect(
      run({ toolsetId: 'toolsets/b/my__1.0.0', offlineUsageConsent: true }),
    ).resolves.toBeNull();

    expect(operations.loginToolset).toHaveBeenCalledOnce();
    expect(operations.loginToolset).toHaveBeenCalledWith(
      'toolsets/b/my__1.0.0',
      {
        url: 'toolsets/b/my__1.0.0',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
        code: CODE,
        redirectUri: REDIRECT_URI,
        offlineUsageConsent: true,
      },
    );
    expect(operations.signInExternalService).not.toHaveBeenCalled();
    expect(operations.signInOfflineCredentials).not.toHaveBeenCalled();
  });

  it('logs the toolset in for the toolset resource kind', async () => {
    await expect(
      run({
        toolsetId: 'toolsets/b/my__1.0.0',
        resourceKind: OAuthResourceKind.Toolset,
      }),
    ).resolves.toBeNull();

    expect(operations.loginToolset).toHaveBeenCalledOnce();
  });

  it('signs in the external service with the appId/serviceId parsed from the scope id', async () => {
    await expect(
      run({
        toolsetId:
          'applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2',
        resourceKind: OAuthResourceKind.ExternalService,
        offlineUsageConsent: true,
      }),
    ).resolves.toBeNull();

    expect(operations.signInExternalService).toHaveBeenCalledOnce();
    expect(operations.signInExternalService).toHaveBeenCalledWith(
      'applications/public/finhub-via-openapi__1.0.0',
      'finhub-api2',
      {
        credentialsLevel: 'USER',
        authenticationType: 'OAUTH',
        code: CODE,
        redirectUri: REDIRECT_URI,
        offlineUsageConsent: true,
      },
    );
    expect(operations.loginToolset).not.toHaveBeenCalled();
    expect(operations.signInOfflineCredentials).not.toHaveBeenCalled();
  });

  it('resolves a missing-redirect-state failure without a call when the external-service scope id does not parse', async () => {
    await expect(
      run({
        toolsetId: 'not-a-scope-id',
        resourceKind: OAuthResourceKind.ExternalService,
      }),
    ).resolves.toBe(ToolsetOAuthFailureReason.MissingRedirectState);

    expect(operations.signInExternalService).not.toHaveBeenCalled();
    expect(operations.loginToolset).not.toHaveBeenCalled();
  });

  it('signs in offline credentials with the code and redirect URI only', async () => {
    await expect(
      run({
        toolsetId: 'offline-credentials',
        resourceKind: OAuthResourceKind.OfflineCredentials,
      }),
    ).resolves.toBeNull();

    expect(operations.signInOfflineCredentials).toHaveBeenCalledOnce();
    expect(operations.signInOfflineCredentials).toHaveBeenCalledWith({
      code: CODE,
      redirectUri: REDIRECT_URI,
    });
    expect(operations.loginToolset).not.toHaveBeenCalled();
    expect(operations.signInExternalService).not.toHaveBeenCalled();
  });

  it('rejects with the operation error so the completion hook reports a failed login request', async () => {
    const error = new Error('network error');
    operations.signInOfflineCredentials.mockRejectedValue(error);

    await expect(
      run({
        toolsetId: 'offline-credentials',
        resourceKind: OAuthResourceKind.OfflineCredentials,
      }),
    ).rejects.toBe(error);
    expect(operations.loginToolset).not.toHaveBeenCalled();
  });
});
