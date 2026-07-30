import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
  type VisualizerConnectorOptions,
} from '@epam/ai-dial-chat-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualizerConnector } from '../VisualizerConnector';

const IFRAME_URL = 'https://viz.example.com/embed';
const VISUALIZER_NAME = 'my-viz';
const IFRAME_ORIGIN = 'https://viz.example.com';

interface TestHandle {
  connector: VisualizerConnector;
  host: HTMLElement;
  iframe: HTMLIFrameElement;
}

const createConnector = (
  options: Partial<VisualizerConnectorOptions> = {},
): TestHandle => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const connector = new VisualizerConnector(host, {
    domain: IFRAME_URL,
    visualizerName: VISUALIZER_NAME,
    ...options,
  });
  const iframe = host.querySelector('iframe');
  if (!iframe) {
    throw new Error('test setup: iframe was not created');
  }
  return { connector, host, iframe };
};

const dispatchFromIframe = (iframe: HTMLIFrameElement, data: unknown): void => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      source: iframe.contentWindow,
      origin: IFRAME_ORIGIN,
    }),
  );
};

const advanceToReadyToInteract = (iframe: HTMLIFrameElement): void => {
  dispatchFromIframe(iframe, {
    type: `${VISUALIZER_NAME}/${VisualizerConnectorEvents.Ready}`,
  });
  dispatchFromIframe(iframe, {
    type: `${VISUALIZER_NAME}/${VisualizerConnectorEvents.ReadyToInteract}`,
  });
};

describe('VisualizerConnector', () => {
  let handles: TestHandle[] = [];

  beforeEach(() => {
    handles = [];
  });

  afterEach(() => {
    handles.forEach(({ host }) => {
      host.remove();
    });
    handles = [];
    vi.useRealTimers();
  });

  const setup = (options?: Partial<VisualizerConnectorOptions>): TestHandle => {
    const handle = createConnector(options);
    handles.push(handle);
    return handle;
  };

  describe('iframe capability grant', () => {
    it('grants the default sandbox token set via sandbox.add()', () => {
      const { iframe } = setup();
      const sandbox = iframe.getAttribute('sandbox') ?? '';
      [
        'allow-same-origin',
        'allow-scripts',
        'allow-modals',
        'allow-forms',
        'allow-downloads',
        'allow-popups',
        'allow-presentation',
      ].forEach((token) => expect(sandbox).toContain(token));
    });

    it('never grants allow-top-navigation by default', () => {
      const { iframe } = setup();
      expect(iframe.getAttribute('sandbox')).not.toContain(
        'allow-top-navigation',
      );
    });

    it('sets the allow attribute granting visualizer permissions-policy features', () => {
      const { iframe } = setup();
      const allow = iframe.getAttribute('allow') ?? '';
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
  });

  describe('loader', () => {
    it('always mounts a loader div in the DOM on construction', () => {
      const { host } = setup({ loaderClass: 'test-loader' });
      expect(host.querySelector('.test-loader')).toBeTruthy();
    });

    it('mounts a loader even when no loaderStyles/loaderClass/loaderInnerHTML are given', () => {
      const { host, iframe } = setup();
      /* loader is the non-iframe child */
      const children = Array.from(host.children);
      const loader = children.find((el) => el !== iframe);
      expect(loader).toBeTruthy();
    });

    it('uses defaultLoaderSVG when no loaderInnerHTML is provided', () => {
      const { host, iframe } = setup();
      const children = Array.from(host.children);
      const loader = children.find((el) => el !== iframe) as HTMLElement;
      expect(loader.innerHTML).toContain('<svg');
    });

    it('hides the loader (display:none) on READY but keeps it in the DOM', () => {
      const { host, iframe } = setup({ loaderClass: 'test-loader' });
      const loaderEl = host.querySelector<HTMLElement>('.test-loader');
      expect(loaderEl).toBeTruthy();

      dispatchFromIframe(iframe, {
        type: `${VISUALIZER_NAME}/${VisualizerConnectorEvents.Ready}`,
      });

      expect(host.querySelector('.test-loader')).toBeTruthy();
      expect(loaderEl?.style.display).toBe('none');
    });

    it('hides the loader (display:none) on READY_TO_INTERACT but keeps it in the DOM', () => {
      const { host, iframe } = setup({ loaderClass: 'test-loader' });
      const loaderEl = host.querySelector<HTMLElement>('.test-loader');

      dispatchFromIframe(iframe, {
        type: `${VISUALIZER_NAME}/${VisualizerConnectorEvents.ReadyToInteract}`,
      });

      expect(host.querySelector('.test-loader')).toBeTruthy();
      expect(loaderEl?.style.display).toBe('none');
    });
  });

  describe('handshake', () => {
    it('resolves ready() with true once READY_TO_INTERACT arrives', async () => {
      const { connector, iframe } = setup();
      const readyPromise = connector.ready();
      advanceToReadyToInteract(iframe);
      await expect(readyPromise).resolves.toBe(true);
    });

    it('does not resolve ready() after READY alone', async () => {
      const { connector, iframe } = setup();
      let settled = false;
      connector.ready().then(
        () => (settled = true),
        () => (settled = true),
      );

      dispatchFromIframe(iframe, {
        type: `${VISUALIZER_NAME}/${VisualizerConnectorEvents.Ready}`,
      });
      await Promise.resolve();

      expect(settled).toBe(false);
    });

    it('never times out while READY_TO_INTERACT is never sent', async () => {
      vi.useFakeTimers();
      const { connector } = setup();
      let settled = false;
      connector.ready().then(
        () => (settled = true),
        () => (settled = true),
      );

      await vi.advanceTimersByTimeAsync(60000);

      expect(settled).toBe(false);
    });

    it('ignores messages from a different iframe instance', async () => {
      const { connector: connectorA } = setup();
      const { iframe: iframeB } = setup();
      let settled = false;
      connectorA.ready().then(
        () => (settled = true),
        () => (settled = true),
      );

      advanceToReadyToInteract(iframeB);
      await Promise.resolve();

      expect(settled).toBe(false);
    });

    it('ignores a message with a different visualizerName prefix', async () => {
      const { connector, iframe } = setup();
      let settled = false;
      connector.ready().then(
        () => (settled = true),
        () => (settled = true),
      );

      dispatchFromIframe(iframe, {
        type: `other-viz/${VisualizerConnectorEvents.ReadyToInteract}`,
      });
      await Promise.resolve();

      expect(settled).toBe(false);
    });

    it('does not reject ready() when a message arrives from the same source but unexpected origin', async () => {
      /* development version has no origin check — only source check */
      const { connector, iframe } = setup();
      const readyPromise = connector.ready();

      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: `${VISUALIZER_NAME}/${VisualizerConnectorEvents.ReadyToInteract}`,
          },
          source: iframe.contentWindow,
          origin: 'https://attacker.example.com',
        }),
      );

      /* message is accepted (no origin check) so ready() resolves */
      await expect(readyPromise).resolves.toBe(true);
    });
  });

  describe('send / response', () => {
    it('resolves send() with the response payload once the matching /RESPONSE arrives', async () => {
      const { connector, iframe } = setup();
      advanceToReadyToInteract(iframe);
      await connector.ready();

      const postMessageSpy = vi.spyOn(
        iframe.contentWindow as Window,
        'postMessage',
      );

      const sendPromise = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
        { mimeType: 'application/x-my-viz' },
      );
      await Promise.resolve();

      expect(postMessageSpy).toHaveBeenCalledOnce();
      const sentMessage = postMessageSpy.mock.calls[0][0] as {
        type: string;
        requestId: string;
      };
      expect(sentMessage.type).toBe(
        `${VISUALIZER_NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      );

      dispatchFromIframe(iframe, {
        type: `${sentMessage.type}/RESPONSE`,
        requestId: sentMessage.requestId,
        payload: { ok: true },
      });

      await expect(sendPromise).resolves.toEqual({ ok: true });
    });

    it('waits for READY_TO_INTERACT before posting when waitForReady=true (default)', async () => {
      vi.useFakeTimers();
      const { connector, iframe } = setup();
      const postMessageSpy = vi.spyOn(
        iframe.contentWindow as Window,
        'postMessage',
      );

      void connector
        .send(VisualizerConnectorRequests.SendVisualizeData, {})
        .catch(() => undefined);

      await vi.advanceTimersByTimeAsync(0);
      expect(postMessageSpy).not.toHaveBeenCalled();

      advanceToReadyToInteract(iframe);
      await vi.advanceTimersByTimeAsync(0);

      expect(postMessageSpy).toHaveBeenCalledOnce();
    });

    it('posts immediately when waitForReady=false', () => {
      const { connector, iframe } = setup();
      const postMessageSpy = vi.spyOn(
        iframe.contentWindow as Window,
        'postMessage',
      );

      void connector
        .send(VisualizerConnectorRequests.SendVisualizeData, {}, false)
        .catch(() => undefined);

      expect(postMessageSpy).toHaveBeenCalledOnce();
    });

    it('rejects send(waitForReady=false) after the default 10000ms timeout with no response', async () => {
      vi.useFakeTimers();
      const { connector } = setup();

      const sendPromise = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
        {},
        false,
      );
      let rejected = false;
      sendPromise.catch(() => {
        rejected = true;
      });

      await vi.advanceTimersByTimeAsync(10000);

      expect(rejected).toBe(true);
    });

    it('honours a per-instance requestTimeout override', async () => {
      vi.useFakeTimers();
      const { connector } = setup({ requestTimeout: 15000 });

      const sendPromise = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
        {},
        false,
      );
      let rejected = false;
      sendPromise.catch(() => {
        rejected = true;
      });

      await vi.advanceTimersByTimeAsync(10000);
      expect(rejected).toBe(false);

      await vi.advanceTimersByTimeAsync(5000);
      expect(rejected).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('notifies subscribers of unsolicited messages matching the subscribed eventType', () => {
      const { connector, iframe } = setup();
      const handler = vi.fn();
      const eventType = `${VISUALIZER_NAME}/SOME_EVENT`;
      connector.subscribe(eventType, handler);

      dispatchFromIframe(iframe, { type: eventType });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('does not notify subscribers for a different eventType', () => {
      const { connector, iframe } = setup();
      const handler = vi.fn();
      connector.subscribe(`${VISUALIZER_NAME}/SOME_EVENT`, handler);

      dispatchFromIframe(iframe, { type: `${VISUALIZER_NAME}/OTHER_EVENT` });

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not invoke subscribe callback for READY or READY_TO_INTERACT (they return early)', () => {
      const { connector, iframe } = setup();
      const handler = vi.fn();
      connector.subscribe(
        `${VISUALIZER_NAME}/${VisualizerConnectorEvents.Ready}`,
        handler,
      );
      connector.subscribe(
        `${VISUALIZER_NAME}/${VisualizerConnectorEvents.ReadyToInteract}`,
        handler,
      );

      dispatchFromIframe(iframe, {
        type: `${VISUALIZER_NAME}/${VisualizerConnectorEvents.Ready}`,
      });
      dispatchFromIframe(iframe, {
        type: `${VISUALIZER_NAME}/${VisualizerConnectorEvents.ReadyToInteract}`,
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('stops notifying after unsubscribe', () => {
      const { connector, iframe } = setup();
      const handler = vi.fn();
      const eventType = `${VISUALIZER_NAME}/SOME_EVENT`;
      const unsubscribe = connector.subscribe(eventType, handler);
      unsubscribe();

      dispatchFromIframe(iframe, { type: eventType });

      expect(handler).not.toHaveBeenCalled();
    });

    it('returns the unsubscribe function correctly when multiple subscriptions exist', () => {
      const { connector, iframe } = setup();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const eventType = `${VISUALIZER_NAME}/SOME_EVENT`;
      const unsubscribe1 = connector.subscribe(eventType, handler1);
      connector.subscribe(eventType, handler2);

      unsubscribe1();
      dispatchFromIframe(iframe, { type: eventType });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe('destroy', () => {
    it('resolves a pending send() (waitForReady=true) to undefined when destroyed', async () => {
      const { connector } = setup();
      const sendPromise = connector.send(
        VisualizerConnectorRequests.SendVisualizeData,
        {},
      );

      connector.destroy();

      await expect(sendPromise).resolves.toBeUndefined();
    });

    it('rejects a pending ready() call with the string "Chat Visualizer destroyed"', async () => {
      const { connector } = setup();
      const readyPromise = connector.ready();

      connector.destroy();

      await expect(readyPromise).rejects.toBe('Chat Visualizer destroyed');
    });

    it('removes the iframe from the DOM', () => {
      const { connector, host, iframe } = setup();
      connector.destroy();
      expect(host.contains(iframe)).toBe(false);
    });

    it('removes the loader from the DOM', () => {
      const { connector, host } = setup({ loaderClass: 'test-loader' });
      const loaderEl = host.querySelector('.test-loader');
      expect(loaderEl).toBeTruthy();
      connector.destroy();
      expect(host.contains(loaderEl)).toBe(false);
    });

    it('stops delivering messages to subscribers after destroy', () => {
      const { connector, iframe } = setup();
      const handler = vi.fn();
      const eventType = `${VISUALIZER_NAME}/SOME_EVENT`;
      connector.subscribe(eventType, handler);

      connector.destroy();
      dispatchFromIframe(iframe, { type: eventType });

      expect(handler).not.toHaveBeenCalled();
    });

    it('is a no-op when called more than once', () => {
      const { connector, host, iframe } = setup();
      connector.destroy();
      expect(host.contains(iframe)).toBe(false);

      expect(() => connector.destroy()).not.toThrow();
    });
  });
});
