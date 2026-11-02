import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import {
  AppsEditorEvents,
  AppsEditorMessages,
  VisualizerConnectorRequests,
} from '../../types/visualizer-connector';
import { ChatVisualizerConnector } from '../ChatVisualizerConnector';

const HOST = 'https://chat.example.com';
const NAME = 'my-viz';

const connectors: ChatVisualizerConnector[] = [];

const createConnector = (
  ...args: Partial<ConstructorParameters<typeof ChatVisualizerConnector>>
): ChatVisualizerConnector => {
  const [dialHost = HOST, appName = NAME, callbacks = {}] = args;
  const connector = new ChatVisualizerConnector(dialHost, appName, callbacks);
  connectors.push(connector);
  return connector;
};

const postFromHost = (data: unknown, origin = HOST): void => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
};

describe('ChatVisualizerConnector', () => {
  let postSpy: MockInstance<typeof window.postMessage>;

  beforeEach(() => {
    postSpy = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    connectors.splice(0).forEach((connector) => connector.destroy());
    vi.restoreAllMocks();
  });

  it('announces nothing on construction', () => {
    createConnector();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('posts READY and READY_TO_INTERACT only when asked', () => {
    const connector = createConnector();
    connector.sendReady();
    connector.sendReadyToInteract();
    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      { type: `${NAME}/READY`, payload: undefined },
      HOST,
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      2,
      { type: `${NAME}/READY_TO_INTERACT`, payload: undefined },
      HOST,
    );
  });

  it('posts the application-editor readyToSave and loggedOut events', () => {
    const connector = createConnector();
    connector.sendReadyToSave();
    connector.sendLoggedOut();
    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      { type: `${NAME}/readyToSave`, payload: undefined },
      HOST,
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      2,
      { type: `${NAME}/loggedOut`, payload: undefined },
      HOST,
    );
  });

  it('keeps the application-editor wire values the editor host matches on', () => {
    expect(Object.values(AppsEditorEvents)).toEqual([
      'readyToInteract',
      'readyToSave',
      'loggedOut',
      'updatedApplicationSuccess',
    ]);
  });

  it('posts to every configured host, or only to the one given', () => {
    const other = 'https://admin.example.com';
    const connector = createConnector([HOST, other]);
    connector.sendReady();
    connector.send({ type: AppsEditorEvents.ReadyToInteract, dialHost: other });
    expect(postSpy.mock.calls.map(([, target]) => target)).toEqual([
      HOST,
      other,
      other,
    ]);
  });

  it('posts SEND_MESSAGE with the message payload', async () => {
    const connector = createConnector();
    await connector.sendMessage('hello');
    expect(postSpy).toHaveBeenCalledWith(
      { type: `${NAME}/SEND_MESSAGE`, payload: { message: 'hello' } },
      HOST,
    );
  });

  it('hands visualize data to onData and acknowledges it with the same requestId', () => {
    const onData = vi.fn();
    createConnector(HOST, NAME, onData);
    const payload = { mimeType: 'image/png', visualizerData: { a: 1 } };
    postFromHost({
      type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'r-1',
      payload,
    });
    expect(onData).toHaveBeenCalledWith(payload);
    expect(postSpy).toHaveBeenCalledWith(
      {
        type: `${NAME}/SEND_VISUALIZE_DATA/RESPONSE`,
        requestId: 'r-1',
        payload: undefined,
      },
      HOST,
    );
  });

  it('hands grouped data to onGroupedData and acknowledges it', () => {
    const onGroupedData = vi.fn();
    createConnector(HOST, NAME, { onGroupedData });
    const payload = { attachments: [], layout: {} };
    postFromHost({
      type: `${NAME}/${VisualizerConnectorRequests.SendGroupedVisualizeData}`,
      requestId: 'r-2',
      payload,
    });
    expect(onGroupedData).toHaveBeenCalledWith(payload);
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: `${NAME}/SEND_GROUPED_VISUALIZE_DATA/RESPONSE`,
        requestId: 'r-2',
      }),
      HOST,
    );
  });

  it('acknowledges but does not deliver a payload missing its fields', () => {
    const onData = vi.fn();
    createConnector(HOST, NAME, onData);
    postFromHost({
      type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'r-3',
      payload: { mimeType: 'image/png' },
    });
    expect(onData).not.toHaveBeenCalled();
    expect(postSpy).toHaveBeenCalledOnce();
  });

  it('discards a message from a host outside dialHosts', () => {
    const onData = vi.fn();
    createConnector(HOST, NAME, onData);
    postFromHost(
      {
        type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
        requestId: 'r-4',
        payload: { mimeType: 'image/png', visualizerData: {} },
      },
      'https://evil.example.com',
    );
    expect(onData).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('rejects an origin that only prefixes a configured host', () => {
    const onData = vi.fn();
    createConnector(HOST, NAME, onData);
    postFromHost(
      {
        type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
        payload: { mimeType: 'image/png', visualizerData: {} },
      },
      'https://chat.example.co',
    );
    expect(onData).not.toHaveBeenCalled();
  });

  it('matches a configured host written with a trailing slash', () => {
    const onData = vi.fn();
    createConnector(`${HOST}/`, NAME, onData);
    postFromHost({
      type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      payload: { mimeType: 'image/png', visualizerData: {} },
    });
    expect(onData).toHaveBeenCalledOnce();
  });

  it('accepts any origin when the first host is the wildcard', () => {
    const onData = vi.fn();
    createConnector('*', NAME, onData);
    postFromHost(
      {
        type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
        payload: { mimeType: 'image/png', visualizerData: {} },
      },
      'https://anywhere.example.com',
    );
    expect(onData).toHaveBeenCalledOnce();
  });

  it('throws when constructed with no host', () => {
    expect(() => createConnector([])).toThrow(/No dial host/);
  });

  it('stops listening on destroy, and a second destroy is a no-op', () => {
    const onData = vi.fn();
    const connector = createConnector(HOST, NAME, onData);
    connector.destroy();
    expect(() => connector.destroy()).not.toThrow();
    postFromHost({
      type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      payload: { mimeType: 'image/png', visualizerData: {} },
    });
    expect(onData).not.toHaveBeenCalled();
  });

  it('writes nothing to the console when no onData is given', () => {
    const warn = vi.spyOn(console, 'warn');
    createConnector(HOST, NAME, {});
    postFromHost({
      type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      payload: { mimeType: 'image/png', visualizerData: {} },
    });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('ChatVisualizerConnector — editor host parity', () => {
  let postSpy: MockInstance<typeof window.postMessage>;

  beforeEach(() => {
    postSpy = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    connectors.splice(0).forEach((connector) => connector.destroy());
    vi.restoreAllMocks();
  });

  it('delivers a layout-only SEND_VISUALIZE_DATA, as Chat 0.x sends it', () => {
    const onData = vi.fn();
    createConnector(HOST, NAME, onData);
    const payload = { visualizerData: { layout: { themeId: 'light' } } };
    postFromHost({
      type: `${NAME}/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'r-1',
      payload,
    });
    expect(onData).toHaveBeenCalledWith(payload);
    expect(postSpy).toHaveBeenCalledOnce();
  });

  it('ignores the messages it posted itself when not framed', () => {
    const onEditorMessage = vi.fn();
    createConnector('*', NAME, { onEditorMessage });
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: AppsEditorMessages.SaveSuccess, hasChanges: true },
        origin: HOST,
        source: window,
      }),
    );
    expect(onEditorMessage).not.toHaveBeenCalled();
  });

  it('acknowledges any other request in its namespace that has a requestId', () => {
    createConnector();
    postFromHost({
      type: `${NAME}/${VisualizerConnectorRequests.SetVisualizerOptions}`,
      requestId: 'r-2',
      payload: {},
    });
    expect(postSpy).toHaveBeenCalledWith(
      {
        type: `${NAME}/SET_VISUALIZER_OPTIONS/RESPONSE`,
        requestId: 'r-2',
        payload: undefined,
      },
      HOST,
    );
  });

  it('does not answer an unsolicited message, a reply, or another namespace', () => {
    createConnector();
    postFromHost({ type: `${NAME}/SOMETHING` });
    postFromHost({
      type: `${NAME}/SEND_VISUALIZE_DATA/RESPONSE`,
      requestId: 'r-3',
    });
    postFromHost({
      type: `other/${VisualizerConnectorRequests.SendVisualizeData}`,
      requestId: 'r-4',
      payload: {},
    });
    expect(postSpy).not.toHaveBeenCalled();
  });
});

describe('ChatVisualizerConnector — application-editor messages', () => {
  let postSpy: MockInstance<typeof window.postMessage>;

  beforeEach(() => {
    postSpy = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    connectors.splice(0).forEach((connector) => connector.destroy());
    vi.restoreAllMocks();
  });

  it('keeps the unprefixed wire values the editor host matches on', () => {
    expect(Object.values(AppsEditorMessages)).toEqual([
      'TRIGGER_SAVE',
      'SAVE_SUCCESS',
      'SAVE_ERROR',
      'VALIDITY_STATE',
      'DIRTY_STATE',
      'REQUEST_TOOLSET_LOGIN',
      'TOOLSET_LOGIN_RESULT',
      'REQUEST_TOOLSET_LOGOUT',
      'TOOLSET_LOGOUT_RESULT',
      'REQUEST_APPLICATION_CREDENTIALS',
      'REQUEST_EXTERNAL_SERVICE_LOGIN',
      'EXTERNAL_SERVICE_LOGIN_RESULT',
    ]);
  });

  it('posts an editor message unprefixed and unchanged to every host', () => {
    const other = 'https://admin.example.com';
    const connector = createConnector([HOST, other]);
    const message = { type: AppsEditorMessages.SaveSuccess, hasChanges: true };
    connector.sendEditorMessage(message);
    expect(postSpy).toHaveBeenNthCalledWith(1, message, HOST);
    expect(postSpy).toHaveBeenNthCalledWith(2, message, other);
  });

  it('posts an editor message only to the host given', () => {
    const other = 'https://admin.example.com';
    const connector = createConnector([HOST, other]);
    connector.sendEditorMessage(
      { type: AppsEditorMessages.DirtyState, payload: { isDirty: true } },
      other,
    );
    expect(postSpy).toHaveBeenCalledOnce();
    expect(postSpy).toHaveBeenCalledWith(expect.anything(), other);
  });

  it('hands TRIGGER_SAVE without a payload to onEditorMessage with its origin', () => {
    const onEditorMessage = vi.fn();
    createConnector(HOST, NAME, { onEditorMessage });
    const message = {
      type: AppsEditorMessages.TriggerSave,
      general: { name: 'App' },
    };
    postFromHost(message);
    expect(onEditorMessage).toHaveBeenCalledWith(message, HOST);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('ignores an editor message from a host outside dialHosts', () => {
    const onEditorMessage = vi.fn();
    createConnector(HOST, NAME, { onEditorMessage });
    postFromHost(
      { type: AppsEditorMessages.TriggerSave },
      'https://evil.example.com',
    );
    expect(onEditorMessage).not.toHaveBeenCalled();
  });

  it('does not treat a prefixed copy of an editor message as one', () => {
    const onEditorMessage = vi.fn();
    createConnector(HOST, NAME, { onEditorMessage });
    postFromHost({ type: `${NAME}/${AppsEditorMessages.TriggerSave}` });
    expect(onEditorMessage).not.toHaveBeenCalled();
  });
});
