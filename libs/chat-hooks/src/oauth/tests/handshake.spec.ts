import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getToolsetOAuthChannelName,
  waitForToolsetOAuthResult,
} from '../handshake';
import {
  ToolsetCredentialsLevel,
  ToolsetOAuthChannelControlType,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from '../types';

const CALLBACK_PATH = '/auth/toolset-signin';

interface FakePopup {
  location: { href: string };
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
}

const createFakePopup = (): FakePopup => ({
  location: { href: 'about:blank' },
  closed: false,
  close: vi.fn(function (this: FakePopup) {
    this.closed = true;
  }),
});

const asWindow = (popup: FakePopup): Window => popup as unknown as Window;

const callbackUrl = (params: string): string =>
  `${window.location.origin}${CALLBACK_PATH}?${params}`;

describe('getToolsetOAuthChannelName', () => {
  it('namespaces the channel by flow id', () => {
    expect(getToolsetOAuthChannelName('flow-1')).toBe('toolset-oauth-flow-1');
  });

  it('gives two flows different channel names', () => {
    expect(getToolsetOAuthChannelName('a')).not.toBe(
      getToolsetOAuthChannelName('b'),
    );
  });
});

describe('waitForToolsetOAuthResult', () => {
  const waitOptions = {
    toolsetId: 'toolsets/public/t1',
    credentialsLevel: ToolsetCredentialsLevel.User,
    callbackPath: CALLBACK_PATH,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves success from a broadcast message, acknowledges it, and closes the popup', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-1',
      waitOptions,
    );

    const responder = new BroadcastChannel(
      getToolsetOAuthChannelName('flow-1'),
    );
    const acknowledgements: unknown[] = [];
    responder.onmessage = (event: MessageEvent<unknown>) => {
      acknowledgements.push(event.data);
    };
    responder.postMessage({
      type: ToolsetOAuthResultType.Success,
      toolsetId: waitOptions.toolsetId,
      credentialsLevel: waitOptions.credentialsLevel,
    });

    await vi.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toEqual({
      type: ToolsetOAuthResultType.Success,
      toolsetId: waitOptions.toolsetId,
      credentialsLevel: waitOptions.credentialsLevel,
    });
    expect(popup.close).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(0);
    expect(acknowledgements).toContainEqual({
      type: ToolsetOAuthChannelControlType.ResultAcknowledged,
    });
    responder.close();
  });

  /*
   * Regression guard for the acknowledgement the flow exists to deliver: the
   * channel must stay open past the settling tick, or a callback popup whose
   * `WindowProxy` was severed never learns it may close itself.
   */
  it('keeps the flow channel open past the settling tick so the acknowledgement is delivered', async () => {
    const popup = createFakePopup();
    /* A severed `WindowProxy` — the opener cannot close the popup directly. */
    popup.close.mockImplementation(() => {
      throw new Error('cross-origin popup reference');
    });

    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-ack',
      waitOptions,
    );

    const responder = new BroadcastChannel(
      getToolsetOAuthChannelName('flow-ack'),
    );
    const acknowledgements: unknown[] = [];
    responder.onmessage = (event: MessageEvent<unknown>) => {
      acknowledgements.push(event.data);
    };
    responder.postMessage({
      type: ToolsetOAuthResultType.Success,
      toolsetId: waitOptions.toolsetId,
      credentialsLevel: waitOptions.credentialsLevel,
    });

    await vi.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toMatchObject({
      type: ToolsetOAuthResultType.Success,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(acknowledgements).toEqual([
      { type: ToolsetOAuthChannelControlType.ResultAcknowledged },
    ]);
    responder.close();
  });

  it('resolves failure with the reported reason', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-2',
      waitOptions,
    );

    const responder = new BroadcastChannel(
      getToolsetOAuthChannelName('flow-2'),
    );
    responder.postMessage({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.StateMismatch,
    });

    await vi.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.StateMismatch,
    });
    responder.close();
  });

  it('ignores control messages posted on the flow channel', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-3',
      waitOptions,
    );
    let isSettled = false;
    void pending.then(() => {
      isSettled = true;
    });

    const responder = new BroadcastChannel(
      getToolsetOAuthChannelName('flow-3'),
    );
    responder.postMessage({
      type: ToolsetOAuthChannelControlType.ResultAcknowledged,
    });
    responder.postMessage('not-an-object');
    await vi.advanceTimersByTimeAsync(0);

    expect(isSettled).toBe(false);
    responder.close();
    vi.advanceTimersByTime(5 * 60 * 1000);
    await pending;
  });

  it('reads the result from the popup URL when polling', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-4',
      waitOptions,
    );

    popup.location.href = callbackUrl(
      'toolsetOAuthResult=failure&toolsetOAuthFailureReason=missing-code',
    );
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.MissingCode,
    });
  });

  it('falls back to LoginRequestFailed for an unrecognised failure reason in the popup URL', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-4b',
      waitOptions,
    );

    popup.location.href = callbackUrl(
      'toolsetOAuthResult=failure&toolsetOAuthFailureReason=who-knows',
    );
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.LoginRequestFailed,
    });
  });

  it('resolves from the popup URL even when the channel is unavailable', async () => {
    const popup = createFakePopup();
    const channelSpy = vi
      .spyOn(globalThis, 'BroadcastChannel')
      .mockImplementation(function UnavailableBroadcastChannel(): never {
        throw new Error('channels unavailable');
      });

    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-5',
      waitOptions,
    );
    popup.location.href = callbackUrl('toolsetOAuthResult=success');
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toMatchObject({
      type: ToolsetOAuthResultType.Success,
    });
    channelSpy.mockRestore();
  });

  it('does not settle while the popup URL is cross-origin and unreadable', async () => {
    const popup = createFakePopup();
    Object.defineProperty(popup.location, 'href', {
      get: () => {
        throw new Error('cross-origin');
      },
      set: () => undefined,
      configurable: true,
    });
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-6',
      waitOptions,
    );
    let isSettled = false;
    void pending.then(() => {
      isSettled = true;
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(isSettled).toBe(false);
    vi.advanceTimersByTime(5 * 60 * 1000);
    await pending;
  });

  it('ignores a same-origin popup URL on a path other than the callback path', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-6b',
      waitOptions,
    );
    let isSettled = false;
    void pending.then(() => {
      isSettled = true;
    });

    popup.location.href = `${window.location.origin}/some/other/route?toolsetOAuthResult=success`;
    await vi.advanceTimersByTimeAsync(2000);

    expect(isSettled).toBe(false);
    vi.advanceTimersByTime(5 * 60 * 1000);
    await pending;
  });

  it('reads a result from a second callback route when that is the path the flow was started with', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(asWindow(popup), 'flow-6c', {
      ...waitOptions,
      callbackPath: '/toolsets/editor-callback',
    });

    popup.location.href = `${window.location.origin}/toolsets/editor-callback?toolsetOAuthResult=success`;
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toMatchObject({
      type: ToolsetOAuthResultType.Success,
    });
  });

  it('keeps waiting when a COOP-severed popup reference looks closed without an opener focus', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-7',
      waitOptions,
    );
    let isSettled = false;
    void pending.then(() => {
      isSettled = true;
    });

    popup.closed = true;
    await vi.advanceTimersByTimeAsync(2000);

    expect(isSettled).toBe(false);
    vi.advanceTimersByTime(5 * 60 * 1000);
    await pending;
  });

  it('resolves cancelled when the opener regains focus and the popup is closed', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-8',
      waitOptions,
    );

    popup.closed = true;
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);

    await expect(pending).resolves.toEqual({
      type: ToolsetOAuthResultType.Cancelled,
    });
  });

  it('prefers a result in the popup URL over a cancel on opener focus', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-9',
      waitOptions,
    );

    popup.location.href = callbackUrl('toolsetOAuthResult=success');
    popup.closed = true;
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);

    await expect(pending).resolves.toMatchObject({
      type: ToolsetOAuthResultType.Success,
    });
  });

  it('closes the popup and resolves cancelled on timeout', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-10',
      waitOptions,
    );

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    await expect(pending).resolves.toEqual({
      type: ToolsetOAuthResultType.Cancelled,
    });
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('honours a caller-configured timeout', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(asWindow(popup), 'flow-10b', {
      ...waitOptions,
      timeoutMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);

    await expect(pending).resolves.toEqual({
      type: ToolsetOAuthResultType.Cancelled,
    });
  });

  it('tears down its focus listener, interval, and timeout exactly once', async () => {
    const popup = createFakePopup();
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-11',
      waitOptions,
    );

    popup.location.href = callbackUrl('toolsetOAuthResult=success');
    await vi.advanceTimersByTimeAsync(500);
    await pending;
    /* Flushes the deferred channel close, so only leaked timers remain. */
    await vi.advanceTimersByTimeAsync(1);

    expect(removeListener).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    popup.close.mockClear();
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(popup.close).not.toHaveBeenCalled();
  });

  it('ignores a result reported on a different flow channel', async () => {
    const popup = createFakePopup();
    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-12',
      waitOptions,
    );
    let isSettled = false;
    void pending.then(() => {
      isSettled = true;
    });

    const otherFlow = new BroadcastChannel(
      getToolsetOAuthChannelName('flow-other'),
    );
    otherFlow.postMessage({
      type: ToolsetOAuthResultType.Success,
      toolsetId: waitOptions.toolsetId,
      credentialsLevel: waitOptions.credentialsLevel,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(isSettled).toBe(false);
    otherFlow.close();
    vi.advanceTimersByTime(5 * 60 * 1000);
    await pending;
  });

  it('resolves immediately when the popup URL already carries a result', async () => {
    const popup = createFakePopup();
    popup.location.href = callbackUrl('toolsetOAuthResult=success');

    const pending = waitForToolsetOAuthResult(
      asWindow(popup),
      'flow-13',
      waitOptions,
    );

    await expect(pending).resolves.toMatchObject({
      type: ToolsetOAuthResultType.Success,
    });
    expect(popup.close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
  });
});
