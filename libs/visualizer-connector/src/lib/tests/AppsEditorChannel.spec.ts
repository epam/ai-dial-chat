import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AppsEditorClientMessage,
  AppsEditorHostMessage,
} from '../../models/apps-editor';
import {
  AppsEditorEvents,
  AppsEditorMessages,
} from '../../types/visualizer-connector';
import { AppsEditorClient } from '../AppsEditorClient';
import { AppsEditorHost } from '../AppsEditorHost';

const HOST_ORIGIN = 'https://chat.example.com';
const EDITOR_ORIGIN = 'https://editor.example.com';
const APPLICATION_NAME = 'Quick app 2.0';
const endpoints: (AppsEditorHost | AppsEditorClient)[] = [];

const dispatchMessage = (
  source: MessageEventSource | null,
  origin: string,
  data: unknown,
): void => {
  window.dispatchEvent(new MessageEvent('message', { source, origin, data }));
};

const createChannel = () => {
  const postToEditor = vi.fn<(data: unknown, origin: string) => void>();
  const postToHost = vi.fn<(data: unknown, origin: string) => void>();
  const editorWindow = { postMessage: postToEditor } as unknown as Window;
  const hostWindow = { postMessage: postToHost } as unknown as Window;
  const onHostMessage = vi.fn<(message: AppsEditorClientMessage) => void>();
  const onClientMessage = vi.fn<(message: AppsEditorHostMessage) => void>();
  const onActivity = vi.fn();

  /* Two window endpoints share the test's event target; source and origin preserve their direction. */
  postToEditor.mockImplementation((data) => {
    dispatchMessage(hostWindow, HOST_ORIGIN, data);
  });
  postToHost.mockImplementation((data) => {
    dispatchMessage(editorWindow, EDITOR_ORIGIN, data);
  });

  const host = new AppsEditorHost<{ name: string }, { status: string }>({
    targetWindow: editorWindow,
    targetOrigin: `${EDITOR_ORIGIN}/editor/`,
    applicationName: APPLICATION_NAME,
    onMessage: onHostMessage,
    onActivity,
  });
  const client = new AppsEditorClient({
    hostWindow,
    hostOrigin: `${HOST_ORIGIN}/chat/`,
    applicationName: APPLICATION_NAME,
    onMessage: onClientMessage,
  });
  endpoints.push(host, client);

  return {
    host,
    client,
    editorWindow,
    hostWindow,
    postToEditor,
    postToHost,
    onHostMessage,
    onClientMessage,
    onActivity,
  };
};

describe('application editor channel', () => {
  afterEach(() => {
    endpoints.splice(0).forEach((endpoint) => endpoint.destroy());
    vi.restoreAllMocks();
  });

  it('does not announce readiness or send requests on construction', () => {
    const { postToEditor, postToHost, onHostMessage, onClientMessage } =
      createChannel();

    expect(postToEditor).not.toHaveBeenCalled();
    expect(postToHost).not.toHaveBeenCalled();
    expect(onHostMessage).not.toHaveBeenCalled();
    expect(onClientMessage).not.toHaveBeenCalled();
  });

  it('round-trips readiness and saving through the shared protocol', () => {
    const {
      host,
      client,
      postToEditor,
      postToHost,
      onHostMessage,
      onClientMessage,
    } = createChannel();
    client.sendReadyToSave();

    expect(postToHost).toHaveBeenCalledWith(
      { type: `${APPLICATION_NAME}/readyToSave` },
      HOST_ORIGIN,
    );
    expect(onHostMessage).toHaveBeenCalledWith({
      type: AppsEditorEvents.ReadyToSave,
    });

    host.send({
      type: AppsEditorMessages.TriggerSave,
      general: { name: 'App' },
    });
    expect(postToEditor).toHaveBeenCalledWith(
      { type: AppsEditorMessages.TriggerSave, general: { name: 'App' } },
      EDITOR_ORIGIN,
    );
    expect(onClientMessage).toHaveBeenCalledWith({
      type: AppsEditorMessages.TriggerSave,
      general: { name: 'App' },
    });

    client.sendSaveSuccess(true);
    expect(onHostMessage).toHaveBeenLastCalledWith({
      type: AppsEditorMessages.SaveSuccess,
      hasChanges: true,
    });
  });

  it('delivers lifecycle, validity, dirty state, save errors, and authentication requests', () => {
    const { client, onHostMessage } = createChannel();
    client.sendReadyToInteract();
    client.sendLoggedOut();
    client.sendUpdatedApplication({ id: 'app' });
    client.sendSaveSuccess();
    client.sendSaveError('Save failed');
    client.sendValidityState(false);
    client.sendDirtyState(true);
    client.requestToolsetLogin('toolset');
    client.requestToolsetLogout('toolset');
    client.requestApplicationCredentials('app');
    client.requestExternalServiceLogin('app', 'service', {
      offlineUsageConsent: true,
    });

    expect(onHostMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: AppsEditorEvents.ReadyToInteract },
      { type: AppsEditorEvents.LoggedOut },
      {
        type: AppsEditorEvents.UpdatedApplicationSuccess,
        payload: { application: { id: 'app' } },
      },
      { type: AppsEditorMessages.SaveSuccess, hasChanges: false },
      { type: AppsEditorMessages.SaveError, error: 'Save failed' },
      { type: AppsEditorMessages.ValidityState, payload: { isValid: false } },
      { type: AppsEditorMessages.DirtyState, payload: { isDirty: true } },
      { type: AppsEditorMessages.RequestToolsetLogin, toolsetId: 'toolset' },
      { type: AppsEditorMessages.RequestToolsetLogout, toolsetId: 'toolset' },
      { type: AppsEditorMessages.RequestApplicationCredentials, appId: 'app' },
      {
        type: AppsEditorMessages.RequestExternalServiceLogin,
        appId: 'app',
        serviceId: 'service',
        offlineUsageConsent: true,
      },
    ]);
  });

  it('delivers authentication results while leaving credentials opaque to the client', () => {
    const { host, onClientMessage } = createChannel();
    const login = {
      type: AppsEditorMessages.ToolsetLoginResult,
      toolsetId: 'toolset',
      success: true,
      credentialsLevel: 'global',
      credentials: { status: 'connected' },
    } as const;
    const logout = {
      type: AppsEditorMessages.ToolsetLogoutResult,
      toolsetId: 'toolset',
      success: false,
      reason: 'logout-failed',
    } as const;
    const serviceLogin = {
      type: AppsEditorMessages.ExternalServiceLoginResult,
      appId: 'app',
      serviceId: 'service',
      success: false,
      reason: 'popup-blocked',
    } as const;
    host.send(login);
    host.send(logout);
    host.send(serviceLogin);

    expect(onClientMessage.mock.calls.map(([message]) => message)).toEqual([
      login,
      logout,
      serviceLogin,
    ]);
  });

  it('counts malformed or unknown editor traffic as activity without delivering it as a message', () => {
    const { editorWindow, onHostMessage, onActivity } = createChannel();
    const invalidMessages = [
      null,
      [],
      'readyToSave',
      { type: 'unknown' },
      { type: `${APPLICATION_NAME}/READY_TO_INTERACT` },
      { type: `${APPLICATION_NAME}/READY_TO_SAVE` },
      { type: 'Other app/readyToSave' },
      { type: AppsEditorMessages.TriggerSave },
      { type: AppsEditorMessages.SaveError, error: 42 },
      { type: AppsEditorMessages.ValidityState, payload: { isValid: 'true' } },
      { type: AppsEditorMessages.DirtyState, payload: { isDirty: 1 } },
      { type: AppsEditorMessages.RequestToolsetLogin, toolsetId: 42 },
      { type: AppsEditorMessages.RequestToolsetLogout, toolsetId: '' },
      { type: AppsEditorMessages.RequestApplicationCredentials, appId: null },
      {
        type: AppsEditorMessages.RequestExternalServiceLogin,
        appId: 'app',
        serviceId: 'service',
      },
    ];
    invalidMessages.forEach((data) => {
      dispatchMessage(editorWindow, EDITOR_ORIGIN, data);
    });

    expect(onHostMessage).not.toHaveBeenCalled();
    expect(onActivity).toHaveBeenCalledTimes(invalidMessages.length);
  });

  it('rejects malformed host messages and messages in the wrong direction', () => {
    const { hostWindow, onClientMessage } = createChannel();
    [
      null,
      { type: AppsEditorMessages.SaveSuccess, hasChanges: true },
      { type: `${APPLICATION_NAME}/readyToSave` },
      {
        type: AppsEditorMessages.ToolsetLoginResult,
        toolsetId: 't',
        success: 'yes',
      },
      {
        type: AppsEditorMessages.ToolsetLogoutResult,
        toolsetId: 5,
        success: true,
      },
      {
        type: AppsEditorMessages.ExternalServiceLoginResult,
        appId: 'app',
        serviceId: 'service',
      },
    ].forEach((data) => {
      dispatchMessage(hostWindow, HOST_ORIGIN, data);
    });

    expect(onClientMessage).not.toHaveBeenCalled();
  });

  it('checks both the exact source window and origin on each side', () => {
    const {
      editorWindow,
      hostWindow,
      onHostMessage,
      onClientMessage,
      onActivity,
    } = createChannel();
    const ready = { type: `${APPLICATION_NAME}/readyToSave` };
    const save = { type: AppsEditorMessages.TriggerSave };

    dispatchMessage(hostWindow, EDITOR_ORIGIN, ready);
    dispatchMessage(null, EDITOR_ORIGIN, ready);
    dispatchMessage(editorWindow, `${EDITOR_ORIGIN}.evil.example`, ready);
    dispatchMessage(editorWindow, HOST_ORIGIN, save);
    dispatchMessage(null, HOST_ORIGIN, save);
    dispatchMessage(hostWindow, `${HOST_ORIGIN}.evil.example`, save);

    expect(onHostMessage).not.toHaveBeenCalled();
    expect(onClientMessage).not.toHaveBeenCalled();
    expect(onActivity).not.toHaveBeenCalled();
  });

  it('stops receiving, reporting activity, and sending after repeated destroy calls', () => {
    const channel = createChannel();
    channel.host.destroy();
    channel.host.destroy();
    channel.client.destroy();
    channel.client.destroy();

    channel.host.send({ type: AppsEditorMessages.TriggerSave });
    channel.client.sendReadyToSave();
    dispatchMessage(channel.editorWindow, EDITOR_ORIGIN, {
      type: `${APPLICATION_NAME}/readyToSave`,
    });
    dispatchMessage(channel.hostWindow, HOST_ORIGIN, {
      type: AppsEditorMessages.TriggerSave,
    });

    expect(channel.postToEditor).not.toHaveBeenCalled();
    expect(channel.postToHost).not.toHaveBeenCalled();
    expect(channel.onHostMessage).not.toHaveBeenCalled();
    expect(channel.onClientMessage).not.toHaveBeenCalled();
    expect(channel.onActivity).not.toHaveBeenCalled();
  });

  it('does not deliver a message if the activity callback destroys its host', () => {
    const onMessage = vi.fn();
    const host = new AppsEditorHost({
      targetWindow: window,
      targetOrigin: EDITOR_ORIGIN,
      applicationName: APPLICATION_NAME,
      onMessage,
      onActivity: () => host.destroy(),
    });
    endpoints.push(host);

    dispatchMessage(window, EDITOR_ORIGIN, {
      type: `${APPLICATION_NAME}/readyToSave`,
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('uses window.parent when the client has no explicit hostWindow', () => {
    const postMessage = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined);
    const onMessage = vi.fn();
    const client = new AppsEditorClient({
      hostOrigin: HOST_ORIGIN,
      applicationName: APPLICATION_NAME,
      onMessage,
    });
    endpoints.push(client);

    client.sendReadyToSave();
    dispatchMessage(window.parent, HOST_ORIGIN, {
      type: AppsEditorMessages.TriggerSave,
    });

    expect(postMessage).toHaveBeenCalledWith(
      { type: `${APPLICATION_NAME}/readyToSave` },
      HOST_ORIGIN,
    );
    expect(onMessage).toHaveBeenCalledWith({
      type: AppsEditorMessages.TriggerSave,
    });
  });

  it.each(['', ' ', '*', 'null', '/relative', 'data:text/html,editor'])(
    'rejects invalid or opaque endpoint origins: %j',
    (origin) => {
      expect(() => {
        const host = new AppsEditorHost({
          targetWindow: window,
          targetOrigin: origin,
          applicationName: APPLICATION_NAME,
          onMessage: vi.fn(),
        });
        endpoints.push(host);
      }).toThrow();
      expect(() => {
        const client = new AppsEditorClient({
          hostOrigin: origin,
          applicationName: APPLICATION_NAME,
        });
        endpoints.push(client);
      }).toThrow();
    },
  );
});
