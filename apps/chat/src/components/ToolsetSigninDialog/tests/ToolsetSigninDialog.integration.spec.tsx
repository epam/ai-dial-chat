import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { FC } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import {
  ClientChannelProvider,
  useClientChannel,
} from '../../../context/ClientChannelContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useToolsetLogin } from '../../../hooks/toolsets/useToolsetLogin';
import { useUiFeature } from '../../../hooks/useUiFeature';
import {
  reportClientChannel,
  subscribeClientChannel,
  unsubscribeClientChannel,
} from '../../../server-api/client-channel';
import { getToolset } from '../../../server-api/toolsets';
import { ToolsetAuthTypes } from '../../../types/toolsets';
import ToolsetSigninDialog from '../ToolsetSigninDialog';

vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
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
vi.mock('../../../server-api/client-channel', () => ({
  ClientChannelReportResult: { Success: 'success', Denied: 'denied' },
  subscribeClientChannel: vi.fn(),
  reportClientChannel: vi.fn(),
  unsubscribeClientChannel: vi.fn(),
}));

const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseUiFeature = vi.mocked(useUiFeature);
const mockUseDeployments = vi.mocked(useDeployments);
const mockUseToolsetLogin = vi.mocked(useToolsetLogin);
const mockGetToolset = vi.mocked(getToolset);
const mockSubscribe = vi.mocked(subscribeClientChannel);
const mockReport = vi.mocked(reportClientChannel);
const mockUnsubscribe = vi.mocked(unsubscribeClientChannel);

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

const encoder = new TextEncoder();

/** A controllable SSE `ReadableStream` the test can push raw chunks into. */
const makeControllableStream = () => {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });
  return {
    stream,
    push: (chunk: string) => controllerRef?.enqueue(encoder.encode(chunk)),
  };
};

/**
 * Exposes the real provider's `ensureConnected` to the test — this is the
 * call `useConversationStream` makes at the start of every completion send,
 * and it's what should let a reused RPC id surface again after a prior
 * resolution.
 */
const EnsureConnectedProbe: FC<{
  onReady: (ensureConnected: () => void) => void;
}> = ({ onReady }) => {
  const { ensureConnected } = useClientChannel();
  onReady(ensureConnected);
  return null;
};

const signinFrame =
  'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/bucket/My%20Toolset__1.0"}}\n\n';

describe('ToolsetSigninDialog — integration with the real ClientChannelProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToolset.mockRejectedValue(new Error('not found'));
    mockUseFeatureFlag.mockReturnValue(true);
    mockUseUiFeature.mockReturnValue(true);
    mockUnsubscribe.mockResolvedValue(undefined);
    mockReport.mockResolvedValue(undefined);
    mockUseDeployments.mockReturnValue(
      makeDeploymentsValue([apiKeyToolset]) as never,
    );
    mockUseToolsetLogin.mockReturnValue({ login: vi.fn() });
  });

  it('shows the dialog again for a fresh occurrence of a previously-declined event id, without a stuck row', async () => {
    /*
     * Core's RPC `id` can reappear in a later, unrelated completion. A
     * previous bug left the dialog's own per-row state (RowStatus.Processing
     * set while a login/decline call was in flight) keyed by that id forever,
     * so a reused id came back permanently stuck mid-action instead of a
     * fresh, actionable row.
     */
    const user = userEvent.setup();
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });
    let ensureConnected: (() => void) | undefined;

    render(
      <ClientChannelProvider>
        <EnsureConnectedProbe
          onReady={(fn) => {
            ensureConnected = fn;
          }}
        />
        <ToolsetSigninDialog />
      </ClientChannelProvider>,
    );

    push(signinFrame);
    await waitFor(() =>
      expect(screen.getByText('My Toolset (1.0)')).toBeTruthy(),
    );

    await user.click(
      screen.getByRole('button', { name: ToolsetSigninI18nKeys.RowDecline }),
    );
    await waitFor(() =>
      expect(mockReport).toHaveBeenCalledWith('channel-1', {
        id: 'evt-1',
        result: 'denied',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('My Toolset (1.0)')).toBeNull(),
    );

    // A new completion starts — useConversationStream calls ensureConnected()
    // at the start of every send, which is what forgets past resolutions.
    ensureConnected?.();

    // That new completion reuses the same RPC id for a fresh signin request.
    push(signinFrame);
    await waitFor(() =>
      expect(screen.getByText('My Toolset (1.0)')).toBeTruthy(),
    );

    // The row must start clean — not stuck in the "processing" state left
    // over from the previous occurrence's already-resolved decline.
    const apiKeyInput = screen.getByLabelText(
      ToolsetSigninI18nKeys.ApiKeyLabel,
    );
    expect(apiKeyInput.hasAttribute('disabled')).toBe(false);
    expect(
      screen
        .getByRole('group', { name: 'My Toolset' })
        .getAttribute('aria-busy'),
    ).toBe('false');

    await user.type(apiKeyInput, 'secret-key');
    const loginButton = screen.getByRole('button', {
      name: ButtonsI18nKeys.LogIn,
    });
    expect(loginButton.hasAttribute('disabled')).toBe(false);
  });
});
