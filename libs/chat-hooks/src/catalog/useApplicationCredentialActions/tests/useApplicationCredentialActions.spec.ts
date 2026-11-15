import type { ApplicationExternalServiceDto } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExternalServiceLoginOutcomeType } from '../../../external-services/useExternalServiceLogin';
import {
  DEFAULT_APPLICATION_CREDENTIAL_ACTIONS_LABELS as DEFAULTS,
  useApplicationCredentialActions,
  type UseApplicationCredentialActionsParams,
} from '../useApplicationCredentialActions';

const apiKeyService: ApplicationExternalServiceDto = {
  id: 'finance',
  displayName: 'Finance',
  authenticationType: 'API_KEY',
  userLevelAuthStatus: 'SIGNED_IN',
};
const nativeService: ApplicationExternalServiceDto = {
  id: 'dial',
  displayName: 'DIAL',
  authenticationType: 'DIAL_NATIVE',
};

const setup = (
  overrides: Partial<UseApplicationCredentialActionsParams> = {},
) => {
  const params = {
    appId: 'agent',
    services: [apiKeyService, nativeService],
    login: vi
      .fn()
      .mockResolvedValue({ type: ExternalServiceLoginOutcomeType.Success }),
    signOutExternalService: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const { result } = renderHook(() => useApplicationCredentialActions(params));
  return { params, actions: result.current };
};

describe('useApplicationCredentialActions', () => {
  it('logs in with the user-level request and refreshes on success', async () => {
    const { params, actions } = setup();
    await expect(
      actions.onLogin('finance', {
        apiKey: 'key',
        offlineUsageConsent: true,
      }),
    ).resolves.toBe(true);
    expect(params.login).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'agent',
        serviceId: 'finance',
        apiKey: 'key',
        credentialsLevel: 'USER',
        authenticationType: 'API_KEY',
        offlineUsageConsent: true,
      }),
    );
    expect(params.refresh).toHaveBeenCalledOnce();
  });

  it('resolves false without logging in for an unknown service', async () => {
    const { params, actions } = setup();
    await expect(
      actions.onLogin('missing', { offlineUsageConsent: false }),
    ).resolves.toBe(false);
    expect(params.login).not.toHaveBeenCalled();
  });

  it('treats cancellation as neither success nor error', async () => {
    const { params, actions } = setup({
      login: vi
        .fn()
        .mockResolvedValue({ type: ExternalServiceLoginOutcomeType.Cancelled }),
    });
    await expect(
      actions.onLogin('finance', { offlineUsageConsent: false }),
    ).resolves.toBe(false);
    expect(params.refresh).not.toHaveBeenCalled();
  });

  it.each([
    [ExternalServiceLoginOutcomeType.PopupBlocked, 'blocked'],
    [ExternalServiceLoginOutcomeType.AdminConsentRequired, 'consent'],
    [ExternalServiceLoginOutcomeType.OfflineUnavailable, 'offline'],
    [ExternalServiceLoginOutcomeType.Failure, 'failed'],
    ['unknown-outcome', 'failed'],
  ])(
    'throws the host label for a %s outcome without refreshing',
    async (type, message) => {
      const { params, actions } = setup({
        login: vi.fn().mockResolvedValue({ type }),
        labels: {
          loginFailed: 'failed',
          popupBlocked: 'blocked',
          adminConsentRequired: 'consent',
          offlineUnavailable: 'offline',
        },
      });
      await expect(
        actions.onLogin('finance', { offlineUsageConsent: false }),
      ).rejects.toThrow(message);
      expect(params.refresh).not.toHaveBeenCalled();
    },
  );

  it('falls back to the English login error when login throws', async () => {
    const { actions } = setup({
      login: vi.fn().mockRejectedValue(new Error('network')),
    });
    await expect(
      actions.onLogin('finance', { offlineUsageConsent: false }),
    ).rejects.toThrow(DEFAULTS.loginFailed);
  });

  it('signs out only personal credentials and refreshes', async () => {
    const { params, actions } = setup();
    await actions.onLogout('finance');
    expect(params.signOutExternalService).toHaveBeenCalledWith(
      'agent',
      'finance',
      { credentialsLevel: 'USER', authenticationType: 'API_KEY' },
    );
    expect(params.refresh).toHaveBeenCalledOnce();
  });

  it('never signs out a DIAL-native or unknown service', async () => {
    const { params, actions } = setup();
    await actions.onLogout('dial');
    await actions.onLogout('missing');
    expect(params.signOutExternalService).not.toHaveBeenCalled();
    expect(params.refresh).not.toHaveBeenCalled();
  });

  it('throws the logout label and skips the refresh when sign-out fails', async () => {
    const { params, actions } = setup({
      signOutExternalService: vi.fn().mockRejectedValue(new Error('down')),
      labels: { logoutFailed: 'logout failed' },
    });
    await expect(actions.onLogout('finance')).rejects.toThrow('logout failed');
    expect(params.refresh).not.toHaveBeenCalled();
  });
});
