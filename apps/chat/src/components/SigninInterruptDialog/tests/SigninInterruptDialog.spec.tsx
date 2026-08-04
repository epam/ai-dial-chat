import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolsetAuthTypes } from '../../../constants/toolsets';
import {
  ButtonsI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useClientChannel } from '../../../context/ClientChannelContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import {
  ExternalServiceLoginOutcomeType,
  useExternalServiceLogin,
} from '../../../hooks/externalServices/useExternalServiceLogin';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '../../../hooks/toolsets/useToolsetLogin';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { getExternalService } from '../../../server-api/external-services';
import { getToolset } from '../../../server-api/toolsets';
import { PendingSigninEventKind } from '../../../types/client-channel';
import SigninInterruptDialog from '../SigninInterruptDialog';

vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
}));
vi.mock('../../../context/ClientChannelContext', () => ({
  useClientChannel: vi.fn(),
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));
vi.mock('../../../hooks/useUiFeature');
vi.mock('../../../hooks/toolsets/useToolsetLogin', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../hooks/toolsets/useToolsetLogin')
    >();
  return { ...actual, useToolsetLogin: vi.fn() };
});
vi.mock(
  '../../../hooks/externalServices/useExternalServiceLogin',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../hooks/externalServices/useExternalServiceLogin')
      >();
    return { ...actual, useExternalServiceLogin: vi.fn() };
  },
);
vi.mock('../../../server-api/toolsets', () => ({
  getToolset: vi.fn().mockRejectedValue(new Error('not found')),
}));
vi.mock('../../../server-api/external-services', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../server-api/external-services')
    >();
  return { ...actual, getExternalService: vi.fn() };
});

const mockUseClientChannel = vi.mocked(useClientChannel);
const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseUiFeature = vi.mocked(useUiFeature);
const mockUseDeployments = vi.mocked(useDeployments);
const mockUseToolsetLogin = vi.mocked(useToolsetLogin);
const mockUseExternalServiceLogin = vi.mocked(useExternalServiceLogin);
const mockGetToolset = vi.mocked(getToolset);
const mockGetExternalService = vi.mocked(getExternalService);

const apiKeyToolset = {
  id: 'toolsets/bucket/My%20Toolset__1.0',
  toolset: 'My Toolset',
  displayName: 'My Toolset',
  displayVersion: '1.0',
  authSettings: { authenticationType: ToolsetAuthTypes.ApiKey },
};

const toolsetEvent = (id: string, toolsetId: string) => ({
  kind: PendingSigninEventKind.Toolset as const,
  id,
  toolsetId,
});

const externalServiceEvent = (
  id: string,
  appId: string,
  serviceName: string,
) => ({
  kind: PendingSigninEventKind.ExternalService as const,
  id,
  appId,
  serviceName,
});

const makeDeploymentsValue = (toolsets: unknown[] = []) => ({
  items: [],
  selectedItemId: null,
  setSelectedItemId: vi.fn(),
  restoreSelectedItemId: vi.fn(),
  selectedDeploymentConfiguration: null,
  isLoading: false,
  error: null,
  schemas: [],
  toolsets,
  refetchToolsets: vi.fn().mockResolvedValue(undefined),
  refetchDeployments: vi.fn().mockResolvedValue(undefined),
  mergeSharedItem: vi.fn(),
});

describe('SigninInterruptDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToolset.mockRejectedValue(new Error('not found'));
    mockGetExternalService.mockRejectedValue(new Error('not found'));
    mockUseFeatureFlag.mockReturnValue(true);
    mockUseUiFeature.mockReturnValue(true);
    mockUseExternalServiceLogin.mockReturnValue({ login: vi.fn() });
  });

  it('renders nothing when there are no pending events', () => {
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(makeDeploymentsValue() as never);
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    const { container } = render(<SigninInterruptDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the toolset display name and version when known', () => {
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [toolsetEvent('evt-1', apiKeyToolset.id)],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    render(<SigninInterruptDialog />);

    expect(screen.getByText('My Toolset (1.0)')).toBeTruthy();
  });

  it('disables the login button until an API key is entered, then logs in and reports success', async () => {
    const user = userEvent.setup();
    const reportEvent = vi.fn().mockResolvedValue(undefined);
    const login = vi.fn().mockResolvedValue({
      type: ToolsetLoginOutcomeType.Success,
    });
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [toolsetEvent('evt-1', apiKeyToolset.id)],
      reportEvent,
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login });

    render(<SigninInterruptDialog />);

    const loginButton = screen.getByRole('button', {
      name: ButtonsI18nKeys.LogIn,
    });
    expect(loginButton.hasAttribute('disabled')).toBe(true);

    await user.type(
      screen.getByLabelText(ToolsetSigninI18nKeys.ApiKeyLabel),
      'secret-key',
    );
    expect(loginButton.hasAttribute('disabled')).toBe(false);

    await user.click(loginButton);

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(
        expect.objectContaining({
          toolsetId: apiKeyToolset.id,
          apiKey: 'secret-key',
          forceStale: true,
        }),
      ),
    );
    await waitFor(() =>
      expect(reportEvent).toHaveBeenCalledWith('evt-1', 'success'),
    );
  });

  it('declines a single toolset event and reports denied', async () => {
    const user = userEvent.setup();
    const reportEvent = vi.fn().mockResolvedValue(undefined);
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [toolsetEvent('evt-1', apiKeyToolset.id)],
      reportEvent,
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    render(<SigninInterruptDialog />);
    await user.click(
      screen.getByRole('button', { name: ToolsetSigninI18nKeys.RowDecline }),
    );

    await waitFor(() =>
      expect(reportEvent).toHaveBeenCalledWith('evt-1', 'denied'),
    );
  });

  describe('external-service rows', () => {
    const APP_ID = 'applications/public/finhub-via-openapi__1.0.0';
    const SERVICE_NAME = 'finhub-api2';
    const apiKeyAppDetails = {
      displayName: 'FinHub API',
      authenticationType: 'API_KEY' as never,
    };

    it('renders the resolved display name for a pending external-service event', async () => {
      mockGetExternalService.mockResolvedValue(apiKeyAppDetails);
      mockUseClientChannel.mockReturnValue({
        channelId: 'channel-1',
        pendingEvents: [externalServiceEvent('evt-1', APP_ID, SERVICE_NAME)],
        reportEvent: vi.fn(),
        ensureConnected: vi.fn(),
      });
      mockUseDeployments.mockReturnValue(makeDeploymentsValue([]) as never);
      mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

      render(<SigninInterruptDialog />);

      await waitFor(() => expect(screen.getByText('FinHub API')).toBeTruthy());
      expect(mockGetExternalService).toHaveBeenCalledWith(APP_ID, SERVICE_NAME);
    });

    it('renders a fallback label while metadata is loading', () => {
      mockGetExternalService.mockReturnValue(new Promise(() => undefined));
      mockUseClientChannel.mockReturnValue({
        channelId: 'channel-1',
        pendingEvents: [externalServiceEvent('evt-1', APP_ID, SERVICE_NAME)],
        reportEvent: vi.fn(),
        ensureConnected: vi.fn(),
      });
      mockUseDeployments.mockReturnValue(makeDeploymentsValue([]) as never);
      mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

      render(<SigninInterruptDialog />);

      expect(screen.getByText(SERVICE_NAME)).toBeTruthy();
    });

    it('logs in with an API key and reports success', async () => {
      const user = userEvent.setup();
      const reportEvent = vi.fn().mockResolvedValue(undefined);
      const login = vi.fn().mockResolvedValue({
        type: ExternalServiceLoginOutcomeType.Success,
      });
      mockGetExternalService.mockResolvedValue(apiKeyAppDetails);
      mockUseExternalServiceLogin.mockReturnValue({ login });
      mockUseClientChannel.mockReturnValue({
        channelId: 'channel-1',
        pendingEvents: [externalServiceEvent('evt-1', APP_ID, SERVICE_NAME)],
        reportEvent,
        ensureConnected: vi.fn(),
      });
      mockUseDeployments.mockReturnValue(makeDeploymentsValue([]) as never);
      mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

      render(<SigninInterruptDialog />);
      await waitFor(() => screen.getByText('FinHub API'));
      /*
       * A single atomic `change` event, rather than `user.type`'s
       * char-by-char keystrokes, avoids racing the metadata-fetch effect's
       * trailing microtask cleanup against a per-keystroke re-render.
       */
      fireEvent.change(
        screen.getByLabelText(ToolsetSigninI18nKeys.ApiKeyLabel),
        { target: { value: 'secret-key' } },
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );

      await waitFor(() =>
        expect(login).toHaveBeenCalledWith(
          expect.objectContaining({
            appId: APP_ID,
            serviceId: SERVICE_NAME,
            apiKey: 'secret-key',
            forceStale: true,
          }),
        ),
      );
      await waitFor(() =>
        expect(reportEvent).toHaveBeenCalledWith('evt-1', 'success'),
      );
    });

    it('auto-resolves a NONE-auth external service without user interaction', async () => {
      const reportEvent = vi.fn().mockResolvedValue(undefined);
      mockGetExternalService.mockResolvedValue({
        displayName: 'No-auth Service',
        authenticationType: 'NONE' as never,
      });
      mockUseClientChannel.mockReturnValue({
        channelId: 'channel-1',
        pendingEvents: [externalServiceEvent('evt-1', APP_ID, SERVICE_NAME)],
        reportEvent,
        ensureConnected: vi.fn(),
      });
      mockUseDeployments.mockReturnValue(makeDeploymentsValue([]) as never);
      mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

      render(<SigninInterruptDialog />);

      await waitFor(() =>
        expect(reportEvent).toHaveBeenCalledWith('evt-1', 'success'),
      );
    });

    it('declines both a toolset and an external-service row via Decline all', async () => {
      const user = userEvent.setup();
      const reportEvent = vi.fn().mockResolvedValue(undefined);
      mockGetExternalService.mockResolvedValue(apiKeyAppDetails);
      mockUseClientChannel.mockReturnValue({
        channelId: 'channel-1',
        pendingEvents: [
          toolsetEvent('evt-1', apiKeyToolset.id),
          externalServiceEvent('evt-2', APP_ID, SERVICE_NAME),
        ],
        reportEvent,
        ensureConnected: vi.fn(),
      });
      mockUseDeployments.mockReturnValue(
        makeDeploymentsValue([apiKeyToolset]) as never,
      );
      mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

      render(<SigninInterruptDialog />);
      await user.click(
        screen.getByRole('button', { name: ToolsetSigninI18nKeys.DeclineAll }),
      );

      await waitFor(() => {
        expect(reportEvent).toHaveBeenCalledWith('evt-1', 'denied');
        expect(reportEvent).toHaveBeenCalledWith('evt-2', 'denied');
      });
    });
  });
});
