import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '../../types/visualizer-connector';
import { VisualizerConnector } from '../VisualizerConnector';

const DOMAIN = 'https://viz.example.com';
const NAME = 'my-viz';

interface PostedRequest {
  type: string;
  requestId: string;
  payload?: unknown;
}

let root: HTMLDivElement;
const connectors: VisualizerConnector[] = [];

const createConnector = (
  options: Partial<ConstructorParameters<typeof VisualizerConnector>[1]> = {},
): VisualizerConnector => {
  const connector = new VisualizerConnector(root, {
    domain: DOMAIN,
    visualizerName: NAME,
    ...options,
  });
  connectors.push(connector);
  return connector;
};

const getIframe = (): HTMLIFrameElement => {
  const iframe = root.querySelector('iframe');
  if (!iframe) {
    throw new Error('iframe not mounted');
  }
  return iframe;
};

const postFromIframe = (
  data: unknown,
  source: Window | null = getIframe().contentWindow,
  origin = DOMAIN,
): void => {
  window.dispatchEvent(new MessageEvent('message', { data, source, origin }));
};

const completeHandshake = (): void => {
  postFromIframe({
    type: `${NAME}/${VisualizerConnectorEvents.ReadyToInteract}`,
  });
};

const spyOnIframePost = () =>
  vi.spyOn(getIframe().contentWindow as Window, 'postMessage');

const flushMicrotasks = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => {
  connectors.splice(0).forEach((connector) => connector.destroy());
  root.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('protocol enums', () => {
  it('keeps the wire values visualizers already expect', () => {
    expect(VisualizerConnectorRequests).toEqual({
      SendVisualizeData: 'SEND_VISUALIZE_DATA',
      SendGroupedVisualizeData: 'SEND_GROUPED_VISUALIZE_DATA',
      SetVisualizerOptions: 'SET_VISUALIZER_OPTIONS',
    });
    expect(VisualizerConnectorEvents).toEqual({
      InitReady: 'INIT_READY',
      Ready: 'READY',
      ReadyToInteract: 'READY_TO_INTERACT',
      SendMessage: 'SEND_MESSAGE',
      CreatedConversationSuccess: 'CREATED_CONVERSATION_SUCCESS',
      UpdatedConversationSuccess: 'UPDATED_CONVERSATION_SUCCESS',
      UpdatedApplicationSuccess: 'UPDATED_APPLICATION_SUCCESS',
    });
  });
});

describe('VisualizerConnector', () => {
  describe('mounting', () => {
    it('mounts an iframe pointing at the visualizer URL', () => {
      createConnector();

      expect(getIframe().src).toBe(`${DOMAIN}/`);
    });

    it('accepts a selector for the container', () => {
      root.id = 'viz-root';
      const connector = new VisualizerConnector('#viz-root', {
        domain: DOMAIN,
        visualizerName: NAME,
      });
      connectors.push(connector);

      expect(getIframe()).toBeTruthy();
    });

    it('throws when the container selector matches nothing', () => {
      expect(
        () =>
          new VisualizerConnector('#missing', {
            domain: DOMAIN,
            visualizerName: NAME,
          }),
      ).toThrow('There is no element with selector #missing');
    });

    it('grants the interactive sandbox tokens but never top navigation', () => {
      createConnector();
      const sandbox = (getIframe().getAttribute('sandbox') ?? '').split(' ');

      [
        'allow-same-origin',
        'allow-scripts',
        'allow-modals',
        'allow-forms',
        'allow-downloads',
        'allow-popups',
        'allow-presentation',
      ].forEach((token) => expect(sandbox.includes(token)).toBe(true));
      expect(sandbox.includes('allow-top-navigation')).toBe(false);
    });

    it('sets the allow attribute', () => {
      createConnector();
      const allow = getIframe().getAttribute('allow') ?? '';

      [
        'clipboard-write',
        'fullscreen',
        'accelerometer',
        'gyroscope',
        'autoplay',
        'web-share',
        'encrypted-media',
      ].forEach((feature) => expect(allow).toContain(feature));
    });

    it('hides the loader once the iframe reports READY', () => {
      createConnector({ loaderClass: 'viz-loader' });
      const loader = root.querySelector<HTMLElement>('.viz-loader');

      expect(loader?.style.display).toBe('flex');
      postFromIframe({ type: `${NAME}/${VisualizerConnectorEvents.Ready}` });
      expect(loader?.style.display).toBe('none');
    });
  });

  describe('handshake', () => {
    it('resolves ready() after READY_TO_INTERACT', async () => {
      const connector = createConnector();
      const ready = connector.ready();

      completeHandshake();

      await expect(ready).resolves.toBe(true);
    });

    it('never times out ready()', async () => {
      vi.useFakeTimers();
      const connector = createConnector({ requestTimeout: 100 });
      const onSettled = vi.fn();
      connector.ready().then(onSettled, onSettled);

      await vi.advanceTimersByTimeAsync(60_000);

      expect(onSettled).not.toHaveBeenCalled();
    });

    it('behaves the same without hostDomain as with it', async () => {
      const withHost = createConnector({
        hostDomain: 'https://chat.example.com',
      });
      const withoutHost = createConnector();
      const readyWith = withHost.ready();
      const readyWithout = withoutHost.ready();

      root
        .querySelectorAll('iframe')
        .forEach((iframe) =>
          postFromIframe(
            { type: `${NAME}/${VisualizerConnectorEvents.ReadyToInteract}` },
            iframe.contentWindow,
          ),
        );

      await expect(readyWith).resolves.toBe(true);
      await expect(readyWithout).resolves.toBe(true);
    });
  });

  describe('send', () => {
    it('posts a namespaced request and resolves with the matching response', async () => {
      const connector = createConnector();
      const postSpy = spyOnIframePost();
      completeHandshake();

      const result = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
        {
          value: 1,
        },
      );
      await flushMicrotasks();

      expect(postSpy).toHaveBeenCalledOnce();
      const [posted, targetOrigin] = postSpy.mock.calls[0] as [
        PostedRequest,
        string,
      ];
      expect(posted.type).toBe(`${NAME}/SEND_VISUALIZE_DATA`);
      expect(posted.payload).toEqual({ value: 1 });
      expect(targetOrigin).toBe(DOMAIN);

      postFromIframe({
        type: `${NAME}/SEND_VISUALIZE_DATA/RESPONSE`,
        requestId: posted.requestId,
        payload: 'ok',
      });

      await expect(result).resolves.toBe('ok');
    });

    it('waits for the handshake before posting', async () => {
      const connector = createConnector();
      const postSpy = spyOnIframePost();

      void connector.send(VisualizerConnectorRequests.SendVisualizeData);
      await flushMicrotasks();
      expect(postSpy).not.toHaveBeenCalled();

      completeHandshake();
      await flushMicrotasks();
      expect(postSpy).toHaveBeenCalledOnce();
    });

    it('ignores a response carrying a different requestId', async () => {
      vi.useFakeTimers();
      const connector = createConnector({ requestTimeout: 1000 });
      completeHandshake();
      const result = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
      );
      const assertion = expect(result).rejects.toContain('Timeout 1000');
      await vi.advanceTimersByTimeAsync(0);

      postFromIframe({
        type: `${NAME}/SEND_VISUALIZE_DATA/RESPONSE`,
        requestId: 'someone-else',
        payload: 'wrong',
      });
      await vi.advanceTimersByTimeAsync(1000);

      await assertion;
    });

    it('rejects with a string once the per-entry requestTimeout elapses', async () => {
      vi.useFakeTimers();
      const connector = createConnector({ requestTimeout: 15000 });
      completeHandshake();
      const result = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
      );
      const assertion = expect(result).rejects.toBe(
        `[VisualizerConnector] Request ${NAME}/SEND_VISUALIZE_DATA failed. Timeout 15000`,
      );

      await vi.advanceTimersByTimeAsync(14999);
      await vi.advanceTimersByTimeAsync(1);

      await assertion;
    });

    it('rejects after the 10000 ms default when no requestTimeout is set', async () => {
      vi.useFakeTimers();
      const connector = createConnector();
      completeHandshake();
      const result = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
      );
      const assertion = expect(result).rejects.toContain('Timeout 10000');

      await vi.advanceTimersByTimeAsync(10000);

      await assertion;
    });

    it('stops the timeout timer once the response arrives', async () => {
      vi.useFakeTimers();
      const connector = createConnector();
      const postSpy = spyOnIframePost();
      completeHandshake();
      const result = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
      );
      await vi.advanceTimersByTimeAsync(0);
      const [posted] = postSpy.mock.calls[0] as [PostedRequest];

      postFromIframe({
        type: `${NAME}/SEND_VISUALIZE_DATA/RESPONSE`,
        requestId: posted.requestId,
      });

      await expect(result).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('message filtering', () => {
    it('ignores messages from another window', async () => {
      const connector = createConnector();
      const handler = vi.fn();
      connector.subscribe(`${NAME}/SEND_MESSAGE`, handler);
      const onReady = vi.fn();
      void connector.ready().then(onReady, () => undefined);

      postFromIframe(
        { type: `${NAME}/${VisualizerConnectorEvents.ReadyToInteract}` },
        window,
      );
      postFromIframe({ type: `${NAME}/SEND_MESSAGE`, payload: 'x' }, window);
      await flushMicrotasks();

      expect(onReady).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });

    it('ignores messages outside the visualizer namespace', () => {
      const connector = createConnector();
      const handler = vi.fn();
      connector.subscribe('SEND_MESSAGE', handler);

      postFromIframe({ type: 'SEND_MESSAGE', payload: 'x' });
      postFromIframe({ type: 'other-viz/SEND_MESSAGE', payload: 'x' });
      postFromIframe({ payload: 'no type' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('accepts a message from the iframe regardless of its origin', () => {
      const connector = createConnector();
      const handler = vi.fn();
      connector.subscribe(`${NAME}/SEND_MESSAGE`, handler);

      postFromIframe(
        { type: `${NAME}/SEND_MESSAGE`, payload: 'hi' },
        getIframe().contentWindow,
        'https://unrelated.example.org',
      );

      expect(handler).toHaveBeenCalledWith('hi');
    });
  });

  describe('subscribe', () => {
    it('stops calling the handler after unsubscribing', () => {
      const connector = createConnector();
      const handler = vi.fn();
      const unsubscribe = connector.subscribe(`${NAME}/SEND_MESSAGE`, handler);

      postFromIframe({ type: `${NAME}/SEND_MESSAGE`, payload: 1 });
      unsubscribe();
      postFromIframe({ type: `${NAME}/SEND_MESSAGE`, payload: 2 });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  describe('destroy', () => {
    it('rejects a pending ready() and stops delivering messages', async () => {
      const connector = createConnector();
      const handler = vi.fn();
      connector.subscribe(`${NAME}/SEND_MESSAGE`, handler);
      const contentWindow = getIframe().contentWindow;
      const ready = connector.ready();

      connector.destroy();
      postFromIframe({ type: `${NAME}/SEND_MESSAGE` }, contentWindow);

      await expect(ready).rejects.toBe('Chat Visualizer destroyed');
      expect(handler).not.toHaveBeenCalled();
    });

    it('resolves a send() still awaiting the handshake with undefined and posts nothing', async () => {
      const connector = createConnector();
      const postSpy = spyOnIframePost();
      const result = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
      );

      connector.destroy();

      await expect(result).resolves.toBeUndefined();
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('removes the iframe and loader, and a second call is a no-op', () => {
      const connector = createConnector({ loaderClass: 'viz-loader' });

      connector.destroy();

      expect(() => connector.destroy()).not.toThrow();
      expect(root.querySelector('iframe')).toBeNull();
      expect(root.querySelector('.viz-loader')).toBeNull();
    });

    it('writes nothing to the console and raises no unhandled rejection', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);

      try {
        createConnector().destroy();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(consoleError).not.toHaveBeenCalled();
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
      }
    });
  });
});
