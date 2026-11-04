import type {
  DialToolsetDto,
  GetExternalServiceResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExternalServiceAuthType,
  ExternalServiceLoginOutcomeType,
} from '../../../external-services/useExternalServiceLogin';
import { ToolsetAuthTypes } from '../../../oauth/types';
import { ToolsetLoginOutcomeType } from '../../../oauth/useToolsetLogin/useToolsetLogin';
import {
  type PendingExternalServiceSigninEvent,
  type PendingSigninEvent,
  PendingSigninEventKind,
  type PendingToolsetSigninEvent,
} from '../../../shared/client-channel';
import {
  SigninInterruptAnnouncementKind,
  SigninInterruptRowError,
  SigninInterruptRowStatus,
} from '../../types';
import {
  type UseSigninInterruptOptions,
  useSigninInterrupt,
} from '../useSigninInterrupt';

const APP_ID = 'applications/public/finhub__1.0.0';
const SERVICE_NAME = 'finhub-api';

const apiKeyToolset = {
  id: 'toolsets/bucket/My%20Toolset__1.0',
  toolset: 'My Toolset',
  displayName: 'My Toolset',
  displayVersion: '1.0',
  authSettings: { authenticationType: ToolsetAuthTypes.ApiKey },
} as DialToolsetDto;

const toolsetEvent = (
  id: string,
  toolsetId = apiKeyToolset.id,
): PendingToolsetSigninEvent => ({
  kind: PendingSigninEventKind.Toolset,
  id,
  toolsetId,
});

const externalServiceEvent = (
  id: string,
  serviceName = SERVICE_NAME,
): PendingExternalServiceSigninEvent => ({
  kind: PendingSigninEventKind.ExternalService,
  id,
  appId: APP_ID,
  serviceName,
});

const makeOptions = (
  overrides: Partial<UseSigninInterruptOptions> = {},
): UseSigninInterruptOptions => ({
  pendingEvents: [],
  toolsets: [apiKeyToolset],
  activeLocale: 'en',
  primaryLocale: 'en',
  getToolset: vi.fn().mockRejectedValue(new Error('not found')),
  getExternalService: vi.fn().mockRejectedValue(new Error('not found')),
  loginToolset: vi
    .fn()
    .mockResolvedValue({ type: ToolsetLoginOutcomeType.Success }),
  loginExternalService: vi
    .fn()
    .mockResolvedValue({ type: ExternalServiceLoginOutcomeType.Success }),
  refetchToolsets: vi.fn().mockResolvedValue(undefined),
  reportEvent: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const renderSigninInterrupt = (options: UseSigninInterruptOptions) =>
  renderHook((props: UseSigninInterruptOptions) => useSigninInterrupt(props), {
    initialProps: options,
  });

describe('useSigninInterrupt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a listed toolset without fetching it', () => {
    const options = makeOptions({ pendingEvents: [toolsetEvent('evt-1')] });
    const { result } = renderSigninInterrupt(options);

    expect(result.current.rows[0].info).toMatchObject({
      displayName: 'My Toolset',
      displayVersion: '1.0',
    });
    expect(result.current.rows[0].requiresApiKey).toBe(true);
    expect(result.current.rows[0].canSubmitLogin).toBe(false);
    expect(options.getToolset).not.toHaveBeenCalled();
  });

  it('fetches an external service once and shows the fallback name until it resolves', async () => {
    let resolveService: (value: GetExternalServiceResponseDto) => void = () =>
      undefined;
    const getExternalService = vi.fn().mockReturnValue(
      new Promise<GetExternalServiceResponseDto>((resolve) => {
        resolveService = resolve;
      }),
    );
    const { result } = renderSigninInterrupt(
      makeOptions({
        pendingEvents: [externalServiceEvent('evt-1')],
        getExternalService,
      }),
    );

    expect(result.current.rows[0].info.displayName).toBe(SERVICE_NAME);
    await act(async () => {
      resolveService({
        displayName: 'FinHub API',
        authenticationType: ExternalServiceAuthType.ApiKey,
      });
    });

    expect(result.current.rows[0].info.displayName).toBe('FinHub API');
    expect(getExternalService).toHaveBeenCalledOnce();
    expect(getExternalService).toHaveBeenCalledWith(APP_ID, SERVICE_NAME);
  });

  it('logs in to a toolset with the typed key, refetches toolsets, then reports success', async () => {
    const options = makeOptions({ pendingEvents: [toolsetEvent('evt-1')] });
    const { result } = renderSigninInterrupt(options);

    act(() => result.current.changeApiKey('evt-1', 'secret-key'));
    expect(result.current.rows[0].canSubmitLogin).toBe(true);
    act(() => result.current.login('evt-1'));

    expect(options.loginToolset).toHaveBeenCalledWith(
      expect.objectContaining({
        toolsetId: apiKeyToolset.id,
        apiKey: 'secret-key',
        forceStale: true,
        offlineUsageConsent: true,
      }),
    );
    await waitFor(() =>
      expect(options.reportEvent).toHaveBeenCalledWith('evt-1', 'success'),
    );
    expect(options.refetchToolsets).toHaveBeenCalledOnce();
    expect(result.current.announcement).toEqual({
      kind: SigninInterruptAnnouncementKind.LoginSucceeded,
      name: 'My Toolset',
    });
  });

  it('reports success for a sibling event on the same resource and level', async () => {
    const options = makeOptions({
      pendingEvents: [toolsetEvent('evt-1'), toolsetEvent('evt-2')],
    });
    const { result } = renderSigninInterrupt(options);

    act(() => result.current.login('evt-1'));

    await waitFor(() =>
      expect(options.reportEvent).toHaveBeenCalledWith('evt-2', 'success'),
    );
    expect(options.reportEvent).toHaveBeenCalledWith('evt-1', 'success');
  });

  it('passes the offline-use consent the user chose', async () => {
    const options = makeOptions({ pendingEvents: [toolsetEvent('evt-1')] });
    const { result } = renderSigninInterrupt(options);

    expect(result.current.isOfflineUsageConsentShown).toBe(true);
    act(() => result.current.setOfflineUsageConsent(false));
    act(() => result.current.login('evt-1'));

    expect(options.loginToolset).toHaveBeenCalledWith(
      expect.objectContaining({ offlineUsageConsent: false }),
    );
    await waitFor(() =>
      expect(result.current.announcement?.name).toBe('My Toolset'),
    );
  });

  it.each([
    [
      ToolsetLoginOutcomeType.PopupBlocked,
      SigninInterruptRowError.PopupBlocked,
    ],
    [ToolsetLoginOutcomeType.Failure, SigninInterruptRowError.LoginFailed],
    [ToolsetLoginOutcomeType.Cancelled, undefined],
  ])(
    'returns a toolset row to idle with error %s → %s',
    async (type, error) => {
      const options = makeOptions({
        pendingEvents: [toolsetEvent('evt-1')],
        loginToolset: vi.fn().mockResolvedValue({ type }),
      });
      const { result } = renderSigninInterrupt(options);

      act(() => result.current.login('evt-1'));
      expect(result.current.rows[0].isProcessing).toBe(true);

      await waitFor(() =>
        expect(result.current.rows[0].status).toBe(
          SigninInterruptRowStatus.Idle,
        ),
      );
      expect(result.current.rows[0].error).toBe(error);
      expect(options.reportEvent).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      ExternalServiceLoginOutcomeType.AdminConsentRequired,
      SigninInterruptRowError.AdminConsentRequired,
    ],
    [
      ExternalServiceLoginOutcomeType.OfflineUnavailable,
      SigninInterruptRowError.OfflineUnavailable,
    ],
    [
      ExternalServiceLoginOutcomeType.PopupBlocked,
      SigninInterruptRowError.PopupBlocked,
    ],
    [
      ExternalServiceLoginOutcomeType.Failure,
      SigninInterruptRowError.LoginFailed,
    ],
  ])(
    'maps the external-service outcome %s to the row error %s',
    async (type, error) => {
      const options = makeOptions({
        pendingEvents: [externalServiceEvent('evt-1')],
        getExternalService: vi.fn().mockResolvedValue({
          displayName: 'DIAL native',
          authenticationType: ExternalServiceAuthType.DialNative,
        }),
        loginExternalService: vi.fn().mockResolvedValue({ type }),
      });
      const { result } = renderSigninInterrupt(options);
      await waitFor(() =>
        expect(result.current.rows[0].isDialNative).toBe(true),
      );
      expect(result.current.isOfflineUsageConsentShown).toBe(false);

      act(() => result.current.login('evt-1'));

      await waitFor(() => expect(result.current.rows[0].error).toBe(error));
      expect(options.loginExternalService).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: APP_ID,
          serviceId: SERVICE_NAME,
          authenticationType: ExternalServiceAuthType.DialNative,
          forceStale: true,
        }),
      );
      expect(options.reportEvent).not.toHaveBeenCalled();
    },
  );

  it('auto-resolves a NONE-auth external service once', async () => {
    const options = makeOptions({
      pendingEvents: [externalServiceEvent('evt-1')],
      getExternalService: vi.fn().mockResolvedValue({
        displayName: 'No-auth Service',
        authenticationType: ExternalServiceAuthType.None,
      }),
    });
    const { result, rerender } = renderSigninInterrupt(options);

    await waitFor(() =>
      expect(options.reportEvent).toHaveBeenCalledWith('evt-1', 'success'),
    );
    rerender({ ...options, pendingEvents: [...options.pendingEvents] });

    expect(options.reportEvent).toHaveBeenCalledOnce();
    expect(result.current.rows[0].requiresNoCredentials).toBe(true);
  });

  it('declines an event and announces it', async () => {
    const options = makeOptions({ pendingEvents: [toolsetEvent('evt-1')] });
    const { result } = renderSigninInterrupt(options);

    await act(() => result.current.decline('evt-1'));

    expect(options.reportEvent).toHaveBeenCalledWith('evt-1', 'denied');
    expect(result.current.announcement).toEqual({
      kind: SigninInterruptAnnouncementKind.Declined,
      name: 'My Toolset',
    });
  });

  it('keeps a declined event pending with an error when reporting fails', async () => {
    const options = makeOptions({
      pendingEvents: [toolsetEvent('evt-1')],
      reportEvent: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { result } = renderSigninInterrupt(options);

    await act(() => result.current.decline('evt-1'));

    expect(result.current.rows[0]).toMatchObject({
      status: SigninInterruptRowStatus.Idle,
      error: SigninInterruptRowError.DeclineFailed,
    });
  });

  it('declines every pending event', async () => {
    const options = makeOptions({
      pendingEvents: [toolsetEvent('evt-1'), externalServiceEvent('evt-2')],
    });
    const { result } = renderSigninInterrupt(options);

    act(() => result.current.declineAll());

    await waitFor(() =>
      expect(options.reportEvent).toHaveBeenCalledWith('evt-2', 'denied'),
    );
    expect(options.reportEvent).toHaveBeenCalledWith('evt-1', 'denied');
  });

  it('drops a row state once its event is no longer pending', async () => {
    const options = makeOptions({ pendingEvents: [toolsetEvent('evt-1')] });
    const { result, rerender } = renderSigninInterrupt(options);
    act(() => result.current.changeApiKey('evt-1', 'secret-key'));

    rerender({ ...options, pendingEvents: [] });
    rerender({
      ...options,
      pendingEvents: [toolsetEvent('evt-1')] as PendingSigninEvent[],
    });

    expect(result.current.rows[0].apiKey).toBe('');
  });
});
