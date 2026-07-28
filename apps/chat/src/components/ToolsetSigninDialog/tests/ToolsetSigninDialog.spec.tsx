import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useClientChannel } from '../../../context/ClientChannelContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '../../../hooks/toolsets/useToolsetLogin';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { getToolset } from '../../../server-api/toolsets';
import { ToolsetAuthTypes } from '../../../types/toolsets';
import ToolsetSigninDialog from '../ToolsetSigninDialog';

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
vi.mock('../../../server-api/toolsets', () => ({
  getToolset: vi.fn().mockRejectedValue(new Error('not found')),
}));

const mockUseClientChannel = vi.mocked(useClientChannel);
const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseUiFeature = vi.mocked(useUiFeature);
const mockUseDeployments = vi.mocked(useDeployments);
const mockUseToolsetLogin = vi.mocked(useToolsetLogin);
const mockGetToolset = vi.mocked(getToolset);

const apiKeyToolset = {
  id: 'toolsets/bucket/My%20Toolset__1.0',
  toolset: 'My Toolset',
  displayName: 'My Toolset',
  displayVersion: '1.0',
  authSettings: { authenticationType: ToolsetAuthTypes.ApiKey },
};

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

describe('ToolsetSigninDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToolset.mockRejectedValue(new Error('not found'));
    mockUseFeatureFlag.mockReturnValue(true);
    mockUseUiFeature.mockReturnValue(true);
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

    const { container } = render(<ToolsetSigninDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the toolset display name and version when known', () => {
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [{ id: 'evt-1', toolsetId: apiKeyToolset.id }],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    render(<ToolsetSigninDialog />);

    expect(screen.getByText('My Toolset (1.0)')).toBeTruthy();
  });

  it('renders nothing when live-chat-interaction UI toggle is disabled, even with pending events', () => {
    mockUseUiFeature.mockReturnValue(false);
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [{ id: 'evt-1', toolsetId: apiKeyToolset.id }],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    const { container } = render(<ToolsetSigninDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the liveChatInteraction capability flag is off, even with pending events', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [{ id: 'evt-1', toolsetId: apiKeyToolset.id }],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    const { container } = render(<ToolsetSigninDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a fallback name derived from the id when the toolset is unknown', () => {
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [
        { id: 'evt-1', toolsetId: 'toolsets/bucket/Unknown%20Toolset__2.0' },
      ],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(makeDeploymentsValue([]) as never);
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    render(<ToolsetSigninDialog />);

    expect(screen.getByText('Unknown Toolset')).toBeTruthy();
  });

  it('disables the login button until an API key is entered, then logs in and reports success', async () => {
    const user = userEvent.setup();
    const reportEvent = vi.fn().mockResolvedValue(undefined);
    const login = vi.fn().mockResolvedValue({
      type: ToolsetLoginOutcomeType.Success,
    });
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [{ id: 'evt-1', toolsetId: apiKeyToolset.id }],
      reportEvent,
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login });

    render(<ToolsetSigninDialog />);

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

  it('shows a retryable error when login fails', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({
      type: ToolsetLoginOutcomeType.Failure,
    });
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [{ id: 'evt-1', toolsetId: apiKeyToolset.id }],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login });

    render(<ToolsetSigninDialog />);
    await user.type(
      screen.getByLabelText(ToolsetSigninI18nKeys.ApiKeyLabel),
      'secret-key',
    );
    await user.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(ToolsetSigninI18nKeys.ErrorLoginFailed),
      ).toBeTruthy(),
    );
  });

  it('declines a single event and reports denied', async () => {
    const user = userEvent.setup();
    const reportEvent = vi.fn().mockResolvedValue(undefined);
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [{ id: 'evt-1', toolsetId: apiKeyToolset.id }],
      reportEvent,
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    render(<ToolsetSigninDialog />);
    await user.click(
      screen.getByRole('button', { name: ToolsetSigninI18nKeys.RowDecline }),
    );

    await waitFor(() =>
      expect(reportEvent).toHaveBeenCalledWith('evt-1', 'denied'),
    );
  });

  it('declines all pending events independently on partial failure', async () => {
    const user = userEvent.setup();
    const reportEvent = vi
      .fn()
      .mockImplementation((eventId: string) =>
        eventId === 'evt-2'
          ? Promise.reject(new Error('network error'))
          : Promise.resolve(undefined),
      );
    const secondToolset = {
      ...apiKeyToolset,
      id: 'toolsets/bucket/Second%20Toolset__1.0',
      displayName: 'Second Toolset',
    };
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [
        { id: 'evt-1', toolsetId: apiKeyToolset.id },
        { id: 'evt-2', toolsetId: secondToolset.id },
      ],
      reportEvent,
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset, secondToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    render(<ToolsetSigninDialog />);
    await user.click(
      screen.getByRole('button', { name: ToolsetSigninI18nKeys.DeclineAll }),
    );

    await waitFor(() => {
      expect(reportEvent).toHaveBeenCalledWith('evt-1', 'denied');
      expect(reportEvent).toHaveBeenCalledWith('evt-2', 'denied');
    });
  });

  it('resolves a sibling event for the same toolset and credentials level after a successful login', async () => {
    const user = userEvent.setup();
    const reportEvent = vi.fn().mockResolvedValue(undefined);
    const login = vi.fn().mockResolvedValue({
      type: ToolsetLoginOutcomeType.Success,
    });
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [
        { id: 'evt-1', toolsetId: apiKeyToolset.id },
        { id: 'evt-2', toolsetId: apiKeyToolset.id },
      ],
      reportEvent,
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login });

    render(<ToolsetSigninDialog />);
    const apiKeyInputs = screen.getAllByLabelText(
      ToolsetSigninI18nKeys.ApiKeyLabel,
    );
    await user.type(apiKeyInputs[0], 'secret-key');
    const loginButtons = screen.getAllByRole('button', {
      name: ButtonsI18nKeys.LogIn,
    });
    await user.click(loginButtons[0]);

    await waitFor(() => {
      expect(reportEvent).toHaveBeenCalledWith('evt-1', 'success');
      expect(reportEvent).toHaveBeenCalledWith('evt-2', 'success');
    });
  });

  it('does not call getToolset for a toolset already present in the deployments list', () => {
    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [{ id: 'evt-1', toolsetId: apiKeyToolset.id }],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
    });
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });

    render(<ToolsetSigninDialog />);

    expect(mockGetToolset).not.toHaveBeenCalled();
  });
});
