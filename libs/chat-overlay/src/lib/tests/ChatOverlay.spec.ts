import {
  OverlayEventType,
  OverlayFeature,
  type OverlayMessageRequest,
  OverlayRequestType,
  type ChatOverlayOptions,
} from '@epam/ai-dial-chat-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatOverlay } from '../ChatOverlay';

const DOMAIN = 'https://chat.example.com/embed';

interface TestHandle {
  overlay: ChatOverlay;
  root: HTMLElement;
  iframe: HTMLIFrameElement;
}

const createOverlay = (
  options: Partial<ChatOverlayOptions> = {},
): TestHandle => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const overlay = new ChatOverlay(root, { domain: DOMAIN, ...options });
  const iframe = root.querySelector('iframe');
  if (!iframe) {
    throw new Error('test setup: iframe was not created');
  }
  return { overlay, root, iframe };
};

const dispatchFromApp = (iframe: HTMLIFrameElement, data: unknown): void => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      source: iframe.contentWindow,
      origin: 'https://chat.example.com',
    }),
  );
};

const dispatchFromOther = (data: unknown): void => {
  window.dispatchEvent(new MessageEvent('message', { data, source: null }));
};

const advanceHandshakeToReadyToInteract = (
  iframe: HTMLIFrameElement,
  requestId: string,
): void => {
  dispatchFromApp(iframe, { type: OverlayEventType.InitReady });
  dispatchFromApp(iframe, { type: OverlayEventType.Ready });
  dispatchFromApp(iframe, {
    type: `${OverlayRequestType.SetOverlayOptions}/RESPONSE`,
    requestId,
    payload: { applied: true },
  });
  dispatchFromApp(iframe, { type: OverlayEventType.ReadyToInteract });
};

describe('ChatOverlay', () => {
  let handles: TestHandle[] = [];

  beforeEach(() => {
    handles = [];
  });

  afterEach(() => {
    handles.forEach(({ overlay, root }) => {
      overlay.destroy();
      root.remove();
    });
    handles = [];
    vi.useRealTimers();
  });

  const setup = (options?: Partial<ChatOverlayOptions>): TestHandle => {
    const handle = createOverlay(options);
    handles.push(handle);
    return handle;
  };

  it('throws a descriptive error when the root selector matches nothing', () => {
    expect(
      () => new ChatOverlay('#does-not-exist', { domain: DOMAIN }),
    ).toThrow(/ChatOverlay.*#does-not-exist/);
  });

  it('creates an iframe with a non-empty accessible name', () => {
    const { iframe } = setup();
    expect(iframe.getAttribute('aria-label')).toBeTruthy();
  });

  it('allows auth popups to open outside the iframe sandbox', () => {
    const { iframe } = setup();
    const sandbox = iframe.getAttribute('sandbox') ?? '';

    expect(sandbox).toContain('allow-popups');
    expect(sandbox).toContain('allow-popups-to-escape-sandbox');
  });

  it('keeps the loader positioned over the iframe without contributing layout height', () => {
    const { root, iframe } = setup();
    const loader = root.querySelector(
      '[data-dial-overlay-loader]',
    ) as HTMLElement;

    expect(root.style.position).toBe('relative');
    expect(loader.style.position).toBe('absolute');
    expect(loader.style.inset).toBe('0');
    expect(loader.style.display).toBe('flex');
    expect(iframe.style.display).toBe('block');
    expect(iframe.style.height).toBe('100%');
  });

  it('does not override a root element with existing non-static positioning', () => {
    const root = document.createElement('div');
    root.style.position = 'fixed';
    document.body.appendChild(root);

    const overlay = new ChatOverlay(root, { domain: DOMAIN });
    handles.push({
      overlay,
      root,
      iframe: root.querySelector('iframe') as HTMLIFrameElement,
    });

    expect(root.style.position).toBe('fixed');
  });

  it('does not request microphone permission by default', () => {
    const { iframe } = setup();
    expect(iframe.getAttribute('allow')).not.toContain('microphone');
  });

  it('requests microphone permission when voice input is enabled', () => {
    const { iframe } = setup({ enabledFeatures: [OverlayFeature.VoiceInput] });
    expect(iframe.getAttribute('allow')).toContain('microphone');
  });

  it('hides the default loader on READY when loaderHideEvent is unset', () => {
    const { root, iframe } = setup();
    const loader = root.querySelector(
      '[data-dial-overlay-loader]',
    ) as HTMLElement;
    expect(loader.style.display).not.toBe('none');
    dispatchFromApp(iframe, { type: OverlayEventType.InitReady });
    dispatchFromApp(iframe, { type: OverlayEventType.Ready });
    expect(loader.style.display).toBe('none');
  });

  it('keeps the loader visible until the configured loaderHideEvent', () => {
    const { root, iframe } = setup({
      loaderHideEvent: OverlayEventType.ReadyToInteract,
    });
    const loader = root.querySelector(
      '[data-dial-overlay-loader]',
    ) as HTMLElement;
    dispatchFromApp(iframe, { type: OverlayEventType.InitReady });
    dispatchFromApp(iframe, { type: OverlayEventType.Ready });
    expect(loader.style.display).not.toBe('none');
    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.SetOverlayOptions}/RESPONSE`,
      requestId: 'irrelevant',
      payload: {},
    });
    dispatchFromApp(iframe, { type: OverlayEventType.ReadyToInteract });
    expect(loader.style.display).toBe('none');
  });

  it('does not resolve ready() on READY alone', async () => {
    const { overlay, iframe } = setup();
    let resolved = false;
    void overlay.ready().then(
      () => {
        resolved = true;
      },
      () => undefined,
    );
    dispatchFromApp(iframe, { type: OverlayEventType.InitReady });
    dispatchFromApp(iframe, { type: OverlayEventType.Ready });
    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it('resolves ready() to true after the full handshake', async () => {
    const { overlay, iframe } = setup();
    const readyPromise = overlay.ready();
    dispatchFromApp(iframe, { type: OverlayEventType.InitReady });
    dispatchFromApp(iframe, { type: OverlayEventType.Ready });
    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.SetOverlayOptions}/RESPONSE`,
      requestId: 'irrelevant',
      payload: { applied: true },
    });
    dispatchFromApp(iframe, { type: OverlayEventType.ReadyToInteract });
    await expect(readyPromise).resolves.toBe(true);
  });

  it('does not post a request until ready() resolves', () => {
    const { overlay, iframe } = setup();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );
    void overlay.sendMessage('Hello').catch(() => undefined);
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('starts request timeout only after ready() resolves', async () => {
    vi.useFakeTimers();
    const { overlay, iframe } = setup({ requestTimeout: 50 });
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );
    const responsePromise = overlay.sendMessage('Hello');
    let rejected = false;
    void responsePromise.catch(() => {
      rejected = true;
    });

    await vi.advanceTimersByTimeAsync(50);
    await Promise.resolve();

    expect(rejected).toBe(false);
    expect(postMessageSpy).not.toHaveBeenCalled();

    dispatchFromApp(iframe, { type: OverlayEventType.ReadyToInteract });
    await Promise.resolve();

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    const sentMessage = postMessageSpy.mock.calls[0][0] as {
      requestId: string;
      expiresAt?: number;
    };
    expect(sentMessage.expiresAt).toBeGreaterThan(Date.now());

    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.SendMessage}/RESPONSE`,
      requestId: sentMessage.requestId,
      payload: { messages: [] },
    });

    await expect(responsePromise).resolves.toEqual({ messages: [] });
  });

  it('resolves sendMessage with the response payload once ready', async () => {
    const { overlay, iframe } = setup();
    dispatchFromApp(iframe, { type: OverlayEventType.InitReady });
    dispatchFromApp(iframe, { type: OverlayEventType.Ready });
    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.SetOverlayOptions}/RESPONSE`,
      requestId: 'irrelevant',
      payload: { applied: true },
    });
    dispatchFromApp(iframe, { type: OverlayEventType.ReadyToInteract });
    await overlay.ready();

    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );
    const responsePromise = overlay.sendMessage('Hello');
    await Promise.resolve();
    const sentMessage = postMessageSpy.mock.calls[0][0] as {
      requestId: string;
      expiresAt?: number;
    };
    expect(sentMessage.expiresAt).toBeGreaterThan(Date.now());

    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.SendMessage}/RESPONSE`,
      requestId: sentMessage.requestId,
      payload: { messages: [{ id: '1', role: 'user', content: 'Hello' }] },
    });

    await expect(responsePromise).resolves.toEqual({
      messages: [{ id: '1', role: 'user', content: 'Hello' }],
    });
  });

  it('targets postMessage calls at the origin derived from options.domain', () => {
    const { overlay, iframe } = setup({
      domain: 'https://chat.example.com/some/path',
    });
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );
    void overlay.setOverlayOptions({ theme: 'dark' }).catch(() => undefined);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.anything(),
      'https://chat.example.com',
    );
  });

  it('omits undefined optional fields from initial SET_OVERLAY_OPTIONS', () => {
    const { iframe } = setup();
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    dispatchFromApp(iframe, { type: OverlayEventType.Ready });

    const sentMessage = postMessageSpy.mock.calls[0][0] as
      | OverlayMessageRequest
      | undefined;
    expect(sentMessage?.type).toBe(OverlayRequestType.SetOverlayOptions);
    expect(sentMessage?.payload).toEqual({
      hostDomain: window.location.origin,
    });
    expect(Object.hasOwn(sentMessage?.payload as object, 'theme')).toBe(false);
    expect(Object.hasOwn(sentMessage?.payload as object, 'modelId')).toBe(
      false,
    );
    expect(
      Object.hasOwn(sentMessage?.payload as object, 'overlayConversationId'),
    ).toBe(false);
  });

  it('rejects a timed-out request with an error naming the type and timeout', async () => {
    const { overlay, iframe } = setup({ requestTimeout: 50 });
    dispatchFromApp(iframe, { type: OverlayEventType.InitReady });
    dispatchFromApp(iframe, { type: OverlayEventType.Ready });
    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.SetOverlayOptions}/RESPONSE`,
      requestId: 'irrelevant',
      payload: { applied: true },
    });
    dispatchFromApp(iframe, { type: OverlayEventType.ReadyToInteract });

    await expect(overlay.getMessages()).rejects.toThrow(/GET_MESSAGES.*50/);
  });

  it('ignores a response whose requestId matches no pending request', () => {
    const { iframe } = setup();
    expect(() =>
      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.SendMessage}/RESPONSE`,
        requestId: 'unknown-id',
        payload: {},
      }),
    ).not.toThrow();
  });

  it('ignores a response whose type does not match the pending request type', async () => {
    const { overlay, iframe } = setup();
    advanceHandshakeToReadyToInteract(iframe, 'irrelevant');
    await overlay.ready();

    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );
    const responsePromise = overlay.getMessages();
    await Promise.resolve();
    const { requestId } = postMessageSpy.mock.calls[0][0] as {
      requestId: string;
    };
    let resolved = false;
    void responsePromise.then(() => {
      resolved = true;
    });

    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.SendMessage}/RESPONSE`,
      requestId,
      payload: { messages: [{ id: 'wrong', role: 'user', content: 'wrong' }] },
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.GetMessages}/RESPONSE`,
      requestId,
      payload: { messages: [] },
    });

    await expect(responsePromise).resolves.toEqual({ messages: [] });
  });

  it('does not resolve or reject a later message reusing an already-consumed requestId', async () => {
    const { overlay, iframe } = setup();
    advanceHandshakeToReadyToInteract(iframe, 'irrelevant');
    await overlay.ready();

    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );
    const firstCall = overlay.getMessages();
    await Promise.resolve();
    const { requestId } = postMessageSpy.mock.calls[0][0] as {
      requestId: string;
    };

    dispatchFromApp(iframe, {
      type: `${OverlayRequestType.GetMessages}/RESPONSE`,
      requestId,
      payload: { messages: [] },
    });
    await expect(firstCall).resolves.toEqual({ messages: [] });

    // Reusing the same requestId should be a no-op now.
    expect(() =>
      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.GetMessages}/RESPONSE`,
        requestId,
        payload: { messages: [{ id: 'x', role: 'user', content: 'stale' }] },
      }),
    ).not.toThrow();
  });

  it('invokes only the remaining subscriber after one unsubscribes', () => {
    const { iframe } = setup();
    const first = vi.fn();
    const second = vi.fn();
    const overlay = handles[handles.length - 1].overlay;
    const unsubscribeFirst = overlay.subscribe(
      OverlayEventType.GptStartGenerating,
      first,
    );
    overlay.subscribe(OverlayEventType.GptStartGenerating, second);

    unsubscribeFirst();
    dispatchFromApp(iframe, { type: OverlayEventType.GptStartGenerating });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('invokes a subscriber once per repeated identical event', () => {
    const { overlay, iframe } = setup();
    const callback = vi.fn();
    overlay.subscribe(OverlayEventType.ConversationsUpdated, callback);

    dispatchFromApp(iframe, { type: OverlayEventType.ConversationsUpdated });
    dispatchFromApp(iframe, { type: OverlayEventType.ConversationsUpdated });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('discards a message event whose source is not the created iframe', () => {
    const { overlay } = setup();
    const callback = vi.fn();
    overlay.subscribe(OverlayEventType.Ready, callback);

    dispatchFromOther({ type: OverlayEventType.Ready });

    expect(callback).not.toHaveBeenCalled();
  });

  it('removes the message listener and rejects pending requests on destroy', async () => {
    const { overlay, iframe } = setup();
    const pending = overlay.getMessages();
    overlay.destroy();

    await expect(pending).rejects.toThrow();

    // Dispatching a matching message after destroy must not throw or resolve anything.
    expect(() =>
      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.GetMessages}/RESPONSE`,
        requestId: 'whatever',
        payload: { messages: [] },
      }),
    ).not.toThrow();
  });

  it('does not throw when destroy is called twice', () => {
    const { overlay } = setup();
    overlay.destroy();
    expect(() => overlay.destroy()).not.toThrow();
  });

  describe('conversation-list methods', () => {
    const readyOverlay = (): TestHandle => {
      const handle = setup();
      advanceHandshakeToReadyToInteract(handle.iframe, 'irrelevant');
      return handle;
    };

    const captureRequest = (
      iframe: HTMLIFrameElement,
    ): { spy: ReturnType<typeof vi.spyOn> } => {
      const spy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');
      return { spy };
    };

    it('dispatches GET_CONVERSATIONS and resolves with the response payload', async () => {
      const { overlay, iframe } = readyOverlay();
      await overlay.ready();
      const { spy } = captureRequest(iframe);

      const responsePromise = overlay.getConversations();
      await Promise.resolve();
      const sent = spy.mock.calls[0][0] as OverlayMessageRequest;
      expect(sent.type).toBe(OverlayRequestType.GetConversations);

      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.GetConversations}/RESPONSE`,
        requestId: sent.requestId,
        payload: { conversations: [] },
      });
      await expect(responsePromise).resolves.toEqual({ conversations: [] });
    });

    it('dispatches GET_SELECTED_CONVERSATIONS and resolves with the response payload', async () => {
      const { overlay, iframe } = readyOverlay();
      await overlay.ready();
      const { spy } = captureRequest(iframe);

      const responsePromise = overlay.getSelectedConversations();
      await Promise.resolve();
      const sent = spy.mock.calls[0][0] as OverlayMessageRequest;
      expect(sent.type).toBe(OverlayRequestType.GetSelectedConversations);

      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.GetSelectedConversations}/RESPONSE`,
        requestId: sent.requestId,
        payload: { conversations: [] },
      });
      await expect(responsePromise).resolves.toEqual({ conversations: [] });
    });

    it('dispatches SELECT_CONVERSATION with the given id', async () => {
      const { overlay, iframe } = readyOverlay();
      await overlay.ready();
      const { spy } = captureRequest(iframe);

      const responsePromise = overlay.selectConversation('conv-1');
      await Promise.resolve();
      const sent = spy.mock.calls[0][0] as OverlayMessageRequest;
      expect(sent.type).toBe(OverlayRequestType.SelectConversation);
      expect(sent.payload).toEqual({ id: 'conv-1' });

      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.SelectConversation}/RESPONSE`,
        requestId: sent.requestId,
        payload: { conversation: { id: 'conv-1' } },
      });
      await expect(responsePromise).resolves.toEqual({
        conversation: { id: 'conv-1' },
      });
    });

    it('dispatches DELETE_CONVERSATION with the given id', async () => {
      const { overlay, iframe } = readyOverlay();
      await overlay.ready();
      const { spy } = captureRequest(iframe);

      const responsePromise = overlay.deleteConversation('conv-1');
      await Promise.resolve();
      const sent = spy.mock.calls[0][0] as OverlayMessageRequest;
      expect(sent.type).toBe(OverlayRequestType.DeleteConversation);
      expect(sent.payload).toEqual({ id: 'conv-1' });

      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.DeleteConversation}/RESPONSE`,
        requestId: sent.requestId,
        payload: {},
      });
      await expect(responsePromise).resolves.toEqual({});
    });

    it('dispatches RENAME_CONVERSATION with the given id and newName', async () => {
      const { overlay, iframe } = readyOverlay();
      await overlay.ready();
      const { spy } = captureRequest(iframe);

      const responsePromise = overlay.renameConversation('conv-1', 'New name');
      await Promise.resolve();
      const sent = spy.mock.calls[0][0] as OverlayMessageRequest;
      expect(sent.type).toBe(OverlayRequestType.RenameConversation);
      expect(sent.payload).toEqual({ id: 'conv-1', newName: 'New name' });

      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.RenameConversation}/RESPONSE`,
        requestId: sent.requestId,
        payload: { conversation: { id: 'conv-1', title: 'New name' } },
      });
      await expect(responsePromise).resolves.toEqual({
        conversation: { id: 'conv-1', title: 'New name' },
      });
    });

    it('dispatches CREATE_CONVERSATION with deploymentId and firstMessage', async () => {
      const { overlay, iframe } = readyOverlay();
      await overlay.ready();
      const { spy } = captureRequest(iframe);

      const responsePromise = overlay.createConversation({
        deploymentId: 'gpt-4o',
        firstMessage: 'Hello',
      });
      await Promise.resolve();
      const sent = spy.mock.calls[0][0] as OverlayMessageRequest;
      expect(sent.type).toBe(OverlayRequestType.CreateConversation);
      expect(sent.payload).toEqual({
        deploymentId: 'gpt-4o',
        firstMessage: 'Hello',
      });

      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.CreateConversation}/RESPONSE`,
        requestId: sent.requestId,
        payload: { conversation: { id: 'conv-2' } },
      });
      await expect(responsePromise).resolves.toEqual({
        conversation: { id: 'conv-2' },
      });
    });

    it('posts a payload with no firstMessage for createConversation() and createLocalConversation()', async () => {
      const { overlay, iframe } = readyOverlay();
      await overlay.ready();
      const { spy } = captureRequest(iframe);

      const createPromise = overlay.createConversation();
      await Promise.resolve();
      const createSent = spy.mock.calls[0][0] as OverlayMessageRequest;
      expect(createSent.type).toBe(OverlayRequestType.CreateConversation);
      expect(createSent.payload).toEqual({});
      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.CreateConversation}/RESPONSE`,
        requestId: createSent.requestId,
        payload: { conversation: null },
      });
      await createPromise;

      const localPromise = overlay.createLocalConversation();
      await Promise.resolve();
      const localSent = spy.mock.calls[1][0] as OverlayMessageRequest;
      expect(localSent.type).toBe(OverlayRequestType.CreateLocalConversation);
      expect(localSent.payload).toBeUndefined();
      dispatchFromApp(iframe, {
        type: `${OverlayRequestType.CreateLocalConversation}/RESPONSE`,
        requestId: localSent.requestId,
        payload: { conversation: null },
      });

      await expect(createPromise).resolves.toEqual({ conversation: null });
      await expect(localPromise).resolves.toEqual({ conversation: null });
    });

    it('waits for ready() before sending getConversations', () => {
      const { overlay, iframe } = setup();
      const postMessageSpy = vi.spyOn(
        iframe.contentWindow as Window,
        'postMessage',
      );
      void overlay.getConversations().catch(() => undefined);
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('rejects createConversation with a timeout error naming the type and timeout', async () => {
      const { overlay, iframe } = setup({ requestTimeout: 50 });
      advanceHandshakeToReadyToInteract(iframe, 'irrelevant');

      await expect(
        overlay.createConversation({ firstMessage: 'Hi' }),
      ).rejects.toThrow(/CREATE_CONVERSATION.*50/);
    });
  });
});
