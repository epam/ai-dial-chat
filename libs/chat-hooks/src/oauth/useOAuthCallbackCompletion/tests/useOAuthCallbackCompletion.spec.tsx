import { render, screen, waitFor } from '@testing-library/react';
import type { FC } from 'react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToolsetOAuthChannelName } from '../../handshake';
import type {
  ToolsetOAuthChannelMessage,
  ToolsetRedirectState,
} from '../../models';
import {
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetCredentialsLevel,
  ToolsetOAuthCallbackQuery,
  ToolsetOAuthChannelControlType,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from '../../types';
import {
  useOAuthCallbackCompletion,
  type OAuthExchangeParams,
  type UseOAuthCallbackCompletionParams,
} from '../useOAuthCallbackCompletion';

const CALLBACK_PATH = '/toolset-editor/callback';
const TOOLSET_ID = 'toolsets/b/my__1.0.0';

const setRedirectState = (state: ToolsetRedirectState) =>
  sessionStorage.setItem(TOOLSET_REDIRECT_STATE_KEY, JSON.stringify(state));

/** Consumes the first result and acknowledges it so the callback can close. */
const listenForResult = (flowId: string): Promise<ToolsetOAuthChannelMessage> =>
  new Promise((resolve) => {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    channel.onmessage = (event) => {
      channel.postMessage({
        type: ToolsetOAuthChannelControlType.ResultAcknowledged,
      });
      resolve(event.data as ToolsetOAuthChannelMessage);
      channel.close();
    };
  });

interface HarnessProps {
  exchange: UseOAuthCallbackCompletionParams['exchange'];
  search: string;
  callbackPath?: string;
}

const Harness: FC<HarnessProps> = ({
  exchange,
  search,
  callbackPath = CALLBACK_PATH,
}) => {
  const { isInProgress, failureReason } = useOAuthCallbackCompletion({
    searchParams: new URLSearchParams(search),
    callbackPath,
    exchange,
  });

  return (
    <div>
      <span>{isInProgress ? 'in-progress' : 'settled'}</span>
      <span>{failureReason ?? 'no-failure'}</span>
    </div>
  );
};

describe('useOAuthCallbackCompletion', () => {
  const mockClose = vi.fn();
  const mockReplaceState = vi.fn();
  const exchange =
    vi.fn<
      (params: OAuthExchangeParams) => Promise<ToolsetOAuthFailureReason | null>
    >();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    exchange.mockResolvedValue(null);
    vi.spyOn(window, 'close').mockImplementation(mockClose);
    vi.spyOn(window.history, 'replaceState').mockImplementation(
      mockReplaceState,
    );
  });

  /*
   * A `listenForResult` acknowledgement resolves before the hook's channel has
   * received it, so the resulting `window.close()` lands a task later. Drain it
   * here, or it is counted against the next test's close assertions.
   */
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  const renderCompletion = (search = '?code=test-code') =>
    render(<Harness exchange={exchange} search={search} />);

  describe('preconditions', () => {
    it('attempts no exchange and closes the window when no redirect state is stored', async () => {
      renderCompletion();

      await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
      expect(exchange).not.toHaveBeenCalled();
    });

    it('reports a missing-redirect-state failure when the stored state has no resource id', async () => {
      setRedirectState({ toolsetId: '', state: 'flow-1' });
      const reported = listenForResult('flow-1');
      renderCompletion();

      await expect(reported).resolves.toEqual({
        type: ToolsetOAuthResultType.Failure,
        reason: ToolsetOAuthFailureReason.MissingRedirectState,
      });
      expect(exchange).not.toHaveBeenCalled();
    });

    it('reports a missing-code failure when the callback carries no code', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-2' });
      const reported = listenForResult('flow-2');
      renderCompletion('');

      await expect(reported).resolves.toEqual({
        type: ToolsetOAuthResultType.Failure,
        reason: ToolsetOAuthFailureReason.MissingCode,
      });
      expect(exchange).not.toHaveBeenCalled();
    });

    it('reports a state-mismatch failure and attempts no exchange when the returned state differs', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-3' });
      const reported = listenForResult('flow-3');
      renderCompletion('?code=test-code&state=someone-elses-state');

      await expect(reported).resolves.toEqual({
        type: ToolsetOAuthResultType.Failure,
        reason: ToolsetOAuthFailureReason.StateMismatch,
      });
      expect(exchange).not.toHaveBeenCalled();
    });
  });

  describe('exchange', () => {
    it('passes the code, stored redirect URI, and credentials level to the injected exchange', async () => {
      setRedirectState({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.Global,
        redirectUri: 'http://localhost/auth/toolset-signin',
        state: 'flow-4',
      });
      const reported = listenForResult('flow-4');
      renderCompletion('?code=test-code&state=flow-4');

      await reported;
      expect(exchange).toHaveBeenCalledWith({
        code: 'test-code',
        redirectUri: 'http://localhost/auth/toolset-signin',
        credentialsLevel: ToolsetCredentialsLevel.Global,
        redirectState: expect.objectContaining({ toolsetId: TOOLSET_ID }),
      });
    });

    it('defaults the credentials level to USER and the redirect URI to the supplied callback path', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-5' });
      const reported = listenForResult('flow-5');
      renderCompletion('?code=test-code&state=flow-5');

      await reported;
      expect(exchange).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialsLevel: ToolsetCredentialsLevel.User,
          redirectUri: `${window.location.origin}${CALLBACK_PATH}`,
        }),
      );
    });

    it('reports success once the exchange resolves', async () => {
      setRedirectState({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        state: 'flow-6',
      });
      const reported = listenForResult('flow-6');
      renderCompletion('?code=test-code&state=flow-6');

      await expect(reported).resolves.toEqual({
        type: ToolsetOAuthResultType.Success,
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
    });

    it('reports a login-request-failed outcome when the exchange rejects', async () => {
      exchange.mockRejectedValue(new Error('nope'));
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-7' });
      const reported = listenForResult('flow-7');
      renderCompletion('?code=test-code&state=flow-7');

      await expect(reported).resolves.toEqual({
        type: ToolsetOAuthResultType.Failure,
        reason: ToolsetOAuthFailureReason.LoginRequestFailed,
      });
    });

    it('reports the failure reason the exchange resolves for a host-side validation', async () => {
      exchange.mockResolvedValue(
        ToolsetOAuthFailureReason.MissingRedirectState,
      );
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-8' });
      const reported = listenForResult('flow-8');
      renderCompletion('?code=test-code&state=flow-8');

      await expect(reported).resolves.toEqual({
        type: ToolsetOAuthResultType.Failure,
        reason: ToolsetOAuthFailureReason.MissingRedirectState,
      });
    });

    it('closes the window even when the exchange throws', async () => {
      exchange.mockRejectedValue(new Error('nope'));
      setRedirectState({ toolsetId: TOOLSET_ID });
      renderCompletion();

      await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
    });

    it('performs exactly one exchange under StrictMode double-invocation', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-9' });
      const reported = listenForResult('flow-9');
      render(
        <StrictMode>
          <Harness exchange={exchange} search="?code=test-code&state=flow-9" />
        </StrictMode>,
      );

      await reported;
      expect(exchange).toHaveBeenCalledOnce();
    });
  });

  describe('redirect state and URL hygiene', () => {
    it('removes the redirect state from sessionStorage after running', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID });
      renderCompletion();

      await waitFor(() =>
        expect(sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY)).toBeNull(),
      );
    });

    it('scrubs the authorization code from the visible URL before attempting the exchange', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-10' });
      let urlWhenExchanged: string | undefined;
      exchange.mockImplementation(async () => {
        const calls = mockReplaceState.mock.calls as [
          unknown,
          string,
          string,
        ][];
        urlWhenExchanged = calls.at(-1)?.[2];
        return null;
      });
      const reported = listenForResult('flow-10');
      renderCompletion('?code=test-code&state=flow-10');

      await reported;
      expect(urlWhenExchanged).toBeDefined();
      expect(urlWhenExchanged).not.toContain('code=');
      expect(urlWhenExchanged).not.toContain('test-code');
    });

    it('writes the non-secret result marker into the popup URL', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-11' });
      const reported = listenForResult('flow-11');
      renderCompletion('?code=test-code&state=flow-11');

      await reported;
      const calls = mockReplaceState.mock.calls as [unknown, string, string][];
      const finalUrl = calls.at(-1)?.[2] ?? '';
      expect(finalUrl).toContain(
        `${ToolsetOAuthCallbackQuery.Result}=${ToolsetOAuthResultType.Success}`,
      );
      expect(finalUrl).not.toContain('test-code');
    });

    it('carries the failure reason in the popup URL marker', async () => {
      exchange.mockRejectedValue(new Error('nope'));
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-12' });
      const reported = listenForResult('flow-12');
      renderCompletion('?code=test-code&state=flow-12');

      await reported;
      const calls = mockReplaceState.mock.calls as [unknown, string, string][];
      const finalUrl = calls.at(-1)?.[2] ?? '';
      expect(finalUrl).toContain(
        `${ToolsetOAuthCallbackQuery.FailureReason}=${ToolsetOAuthFailureReason.LoginRequestFailed}`,
      );
    });
  });

  describe('acknowledgement handshake', () => {
    it('closes the popup only after the opener acknowledges the result', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-13' });
      const channel = new BroadcastChannel(
        getToolsetOAuthChannelName('flow-13'),
      );
      const received: unknown[] = [];
      channel.onmessage = (event) => received.push(event.data);

      renderCompletion('?code=test-code&state=flow-13');

      await waitFor(() => expect(received.length).toBeGreaterThan(0));
      expect(mockClose).not.toHaveBeenCalled();

      channel.postMessage({
        type: ToolsetOAuthChannelControlType.ResultAcknowledged,
      });
      await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
      channel.close();
    });

    it('keeps repeating the result until the opener acknowledges it', async () => {
      vi.useFakeTimers();
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-14' });
      const channel = new BroadcastChannel(
        getToolsetOAuthChannelName('flow-14'),
      );
      const received: unknown[] = [];
      channel.onmessage = (event) => received.push(event.data);

      renderCompletion('?code=test-code&state=flow-14');

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1500);
      expect(received.length).toBeGreaterThan(1);

      channel.close();
      vi.useRealTimers();
    });

    it('ignores malformed messages on the flow channel', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-15' });
      const channel = new BroadcastChannel(
        getToolsetOAuthChannelName('flow-15'),
      );
      const received: unknown[] = [];
      channel.onmessage = (event) => received.push(event.data);

      renderCompletion('?code=test-code&state=flow-15');
      await waitFor(() => expect(received.length).toBeGreaterThan(0));

      channel.postMessage('not-an-object');
      channel.postMessage({ type: 'something-else' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockClose).not.toHaveBeenCalled();
      channel.close();
    });

    it('closes the window without a channel when the flow has no id', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID });
      renderCompletion('?code=test-code');

      await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
    });
  });

  describe('exposed state', () => {
    it('starts in progress and settles once the outcome is reported', async () => {
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-16' });
      const reported = listenForResult('flow-16');
      renderCompletion('?code=test-code&state=flow-16');

      expect(screen.getByText('in-progress')).toBeTruthy();

      await reported;
      await screen.findByText('settled');
      expect(screen.getByText('no-failure')).toBeTruthy();
    });

    it('exposes the failure reason so the host can present it', async () => {
      exchange.mockRejectedValue(new Error('nope'));
      setRedirectState({ toolsetId: TOOLSET_ID, state: 'flow-17' });
      const reported = listenForResult('flow-17');
      renderCompletion('?code=test-code&state=flow-17');

      await reported;
      await screen.findByText(ToolsetOAuthFailureReason.LoginRequestFailed);
    });
  });
});
