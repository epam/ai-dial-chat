import type { AttachmentData } from '@epam/ai-dial-chat-shared';
import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatVisualizerConnector } from '../ChatVisualizerConnector';

const APP_NAME = 'my-viz';
const HOST_ORIGIN = 'https://chat.example.com';

const dispatchFromHost = (data: unknown, origin = HOST_ORIGIN): void => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
};

/* Typed so it matches ChatVisualizerConnector's `dataCallback` overload — an
 * untyped `vi.fn()` infers `Mock<Procedure | Constructable>`, which TS
 * rejects at the call site. */
const createDataCallback = () => vi.fn<(visualizerData: AttachmentData) => void>();

describe('ChatVisualizerConnector', () => {
  let connectors: ChatVisualizerConnector[] = [];

  const track = (
    connector: ChatVisualizerConnector,
  ): ChatVisualizerConnector => {
    connectors.push(connector);
    return connector;
  };

  afterEach(() => {
    connectors.forEach((connector) => connector.destroy());
    connectors = [];
    vi.restoreAllMocks();
  });

  it('throws a descriptive error when constructed with no dial hosts', () => {
    expect(
      () => new ChatVisualizerConnector([], APP_NAME, createDataCallback()),
    ).toThrow(/No dial host/);
  });

  it('sendReady posts the correct envelope to every configured host', () => {
    const connector = track(
      new ChatVisualizerConnector('*', APP_NAME, createDataCallback()),
    );
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    connector.sendReady();

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: `${APP_NAME}/${VisualizerConnectorEvents.Ready}`,
        payload: undefined,
      },
      '*',
    );
  });

  it('sendReadyToInteract posts the correct envelope', () => {
    const connector = track(
      new ChatVisualizerConnector('*', APP_NAME, createDataCallback()),
    );
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    connector.sendReadyToInteract();

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: `${APP_NAME}/${VisualizerConnectorEvents.ReadyToInteract}`,
        payload: undefined,
      },
      '*',
    );
  });

  it('invokes the data callback and posts a matching /RESPONSE for SEND_VISUALIZE_DATA', () => {
    const onData = vi.fn();
    track(new ChatVisualizerConnector('*', APP_NAME, onData));
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    const payload = {
      mimeType: 'application/x-my-viz',
      visualizerData: { layout: { themeId: 'dark' } },
    };
    dispatchFromHost({
      type: `${APP_NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'req-1',
      payload,
    });

    expect(onData).toHaveBeenCalledWith(payload);
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: `${APP_NAME}/${VisualizerConnectorRequests.SendVisualizeData}/RESPONSE`,
        requestId: 'req-1',
        payload: undefined,
      },
      HOST_ORIGIN,
    );
  });

  it('supports a { onData } callbacks object in place of a plain function', () => {
    const onData = vi.fn();
    track(new ChatVisualizerConnector('*', APP_NAME, { onData }));

    const payload = {
      mimeType: 'application/x-my-viz',
      visualizerData: { layout: { themeId: 'dark' } },
    };
    dispatchFromHost({
      type: `${APP_NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'req-1',
      payload,
    });

    expect(onData).toHaveBeenCalledWith(payload);
  });

  it('ignores a message with a different appName prefix', () => {
    const onData = vi.fn();
    track(new ChatVisualizerConnector('*', APP_NAME, onData));

    dispatchFromHost({
      type: `other-viz/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'req-1',
      payload: { mimeType: 'x', visualizerData: {} },
    });

    expect(onData).not.toHaveBeenCalled();
  });

  it('ignores a message from a host not in the configured dial host list', () => {
    const onData = vi.fn();
    track(
      new ChatVisualizerConnector(
        'https://allowed.example.com',
        APP_NAME,
        onData,
      ),
    );

    dispatchFromHost(
      {
        type: `${APP_NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
        requestId: 'req-1',
        payload: { mimeType: 'x', visualizerData: {} },
      },
      'https://attacker.example.com',
    );

    expect(onData).not.toHaveBeenCalled();
  });

  it('does not invoke the callback for a malformed (non-object) payload', () => {
    const onData = vi.fn();
    track(new ChatVisualizerConnector('*', APP_NAME, onData));

    dispatchFromHost({
      type: `${APP_NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'req-1',
      payload: 'not-an-object',
    });

    expect(onData).not.toHaveBeenCalled();
  });

  it('detaches the message listener on destroy', () => {
    const onData = vi.fn();
    const connector = new ChatVisualizerConnector('*', APP_NAME, onData);
    connector.destroy();

    dispatchFromHost({
      type: `${APP_NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'req-1',
      payload: { mimeType: 'x', visualizerData: {} },
    });

    expect(onData).not.toHaveBeenCalled();
  });

  it('sendMessage posts the correct SEND_MESSAGE envelope', async () => {
    const connector = track(
      new ChatVisualizerConnector('*', APP_NAME, createDataCallback()),
    );
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    await connector.sendMessage('hello world');

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: `${APP_NAME}/${VisualizerConnectorEvents.SendMessage}`,
        payload: { message: 'hello world' },
      },
      '*',
    );
  });

  it('invokes onGroupedData and posts a /RESPONSE for SEND_GROUPED_VISUALIZE_DATA', () => {
    const onGroupedData = vi.fn();
    track(new ChatVisualizerConnector('*', APP_NAME, { onGroupedData }));
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    const payload = {
      attachments: [
        {
          url: 'https://example.com/chart.json',
          mimeType: 'application/vnd.plotly.v1+json',
          visualizerData: { layout: { themeId: 'dark' } },
        },
      ],
      layout: { themeId: 'dark' },
    };
    dispatchFromHost({
      type: `${APP_NAME}/${VisualizerConnectorRequests.SendGroupedVisualizeData}`,
      requestId: 'req-2',
      payload,
    });

    expect(onGroupedData).toHaveBeenCalledWith(payload);
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: `${APP_NAME}/${VisualizerConnectorRequests.SendGroupedVisualizeData}/RESPONSE`,
        requestId: 'req-2',
        payload: undefined,
      },
      HOST_ORIGIN,
    );
  });

  it('still sends a /RESPONSE for SEND_GROUPED_VISUALIZE_DATA even without onGroupedData', () => {
    track(new ChatVisualizerConnector('*', APP_NAME, createDataCallback()));
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    dispatchFromHost({
      type: `${APP_NAME}/${VisualizerConnectorRequests.SendGroupedVisualizeData}`,
      requestId: 'req-3',
      payload: { attachments: [], layout: { themeId: 'light' } },
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: `${APP_NAME}/${VisualizerConnectorRequests.SendGroupedVisualizeData}/RESPONSE`,
      }),
      HOST_ORIGIN,
    );
  });
});
