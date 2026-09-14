import {
  getToolsetOAuthChannelName,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthResultType,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
import {
  ToolsetOAuthLoginStatus,
  type ToolsetAuthFormData,
} from '@epam/ai-dial-toolset-editor';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../types/routes';
import { fetchToolsetAuthSettings } from '../../../utils/toolsets';
import { useToolsetEditorOAuthLogin } from '../useToolsetEditorOAuthLogin';

vi.mock('../../../utils/toolsets', () => ({
  fetchToolsetAuthSettings: vi.fn(),
}));

const TOOLSET_ID = 'toolsets/b/my__1.0.0';

/** Minimal fake popup `Window` — enough surface for the OAuth helpers. */
const makeFakePopup = () => {
  const store = new Map<string, string>();
  return {
    sessionStorage: {
      setItem: (key: string, value: string) => store.set(key, value),
      getItem: (key: string) => store.get(key) ?? null,
    },
    location: { href: '' },
    opener: window,
    closed: false,
    close: vi.fn(),
  };
};

let capturedPopup: ReturnType<typeof makeFakePopup> | undefined;

const readFlowId = () =>
  JSON.parse(
    capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ?? '{}',
  ).state as string;

const postOAuthResult = (flowId: string, message: Record<string, unknown>) => {
  const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
  channel.postMessage(message);
  channel.close();
};

const configuredAuth = (): ToolsetAuthFormData => ({
  authenticationType: ToolsetAuthTypes.OAuth,
  withLogin: WithLogin.WithConfig,
  isLoggedIn: false,
  clientId: 'client-id',
  clientSecret: 'secret',
  authorizationEndpoint: 'https://auth.example.com/authorize',
  tokenEndpoint: 'https://auth.example.com/token',
  scopes: [],
});

/** OAuth "With Login" with no configured client — relies on Core's dynamic client registration. */
const dynamicAuth = (): ToolsetAuthFormData => ({
  authenticationType: ToolsetAuthTypes.OAuth,
  withLogin: WithLogin.WithLogin,
  isLoggedIn: false,
});

const runLogin = (
  auth: ToolsetAuthFormData,
  ensureSaved = vi.fn().mockResolvedValue(TOOLSET_ID),
) => {
  const { result } = renderHook(() => useToolsetEditorOAuthLogin());
  return { promise: result.current({ auth, ensureSaved }), ensureSaved };
};

beforeEach(() => {
  vi.clearAllMocks();
  capturedPopup = undefined;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'http://localhost', href: 'http://localhost/' },
  });
  Object.defineProperty(window, 'open', {
    configurable: true,
    value: vi.fn(() => {
      capturedPopup = makeFakePopup();
      return capturedPopup;
    }),
  });
});

describe('useToolsetEditorOAuthLogin — configured client', () => {
  it('opens a popup carrying the redirect state and navigates it to the authorize URL', async () => {
    const { promise } = runLogin(configuredAuth());
    await vi.waitFor(() => expect(capturedPopup).toBeDefined());

    const state = JSON.parse(
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ?? '{}',
    );
    expect(state.toolsetId).toBe(TOOLSET_ID);
    expect(state.credentialsLevel).toBe(ToolsetCredentialsLevel.User);
    expect(capturedPopup?.location.href).toContain(
      'https://auth.example.com/authorize',
    );

    postOAuthResult(readFlowId(), {
      type: ToolsetOAuthResultType.Success,
      toolsetId: TOOLSET_ID,
      credentialsLevel: ToolsetCredentialsLevel.User,
    });
    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.Success,
    });
  });

  it('reports a cancel without opening a popup when the save was abandoned', async () => {
    const { promise } = runLogin(
      configuredAuth(),
      vi.fn().mockResolvedValue(false),
    );

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.Cancelled,
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it('reports an unusable configuration when the authorization endpoint is missing', async () => {
    const { promise } = runLogin({
      ...configuredAuth(),
      authorizationEndpoint: '',
    });

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.InvalidConfig,
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it('reports a blocked popup', async () => {
    vi.mocked(window.open).mockReturnValueOnce(null);

    const { promise } = runLogin(configuredAuth());

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.PopupBlocked,
    });
  });

  it('reports a failed authorization', async () => {
    const { promise } = runLogin(configuredAuth());
    await vi.waitFor(() => expect(capturedPopup).toBeDefined());

    postOAuthResult(readFlowId(), {
      type: ToolsetOAuthResultType.Failure,
      toolsetId: TOOLSET_ID,
      credentialsLevel: ToolsetCredentialsLevel.User,
    });

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.Failed,
    });
  });

  it('recovers a login that completed server-side but was reported as cancelled', async () => {
    vi.mocked(fetchToolsetAuthSettings).mockResolvedValue({
      ...configuredAuth(),
      isLoggedIn: true,
    });

    const { promise } = runLogin(configuredAuth());
    await vi.waitFor(() => expect(capturedPopup).toBeDefined());
    if (capturedPopup) capturedPopup.closed = true;
    /* A closed popup is noticed when the opener regains focus, not by polling. */
    window.dispatchEvent(new Event('focus'));

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.Success,
    });
  });

  it('reports a genuine cancel when the backend confirms no session', async () => {
    vi.mocked(fetchToolsetAuthSettings).mockResolvedValue(configuredAuth());

    const { promise } = runLogin(configuredAuth());
    await vi.waitFor(() => expect(capturedPopup).toBeDefined());
    if (capturedPopup) capturedPopup.closed = true;
    /* A closed popup is noticed when the opener regains focus, not by polling. */
    window.dispatchEvent(new Event('focus'));

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.Cancelled,
    });
  });
});

describe('useToolsetEditorOAuthLogin — dynamic client registration', () => {
  it('opens the popup before the save resolves, then authorizes with the Core-issued client', async () => {
    let releaseSave: (id: string) => void = () => {
      /* replaced synchronously below */
    };
    const ensureSaved = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          releaseSave = resolve;
        }),
    );
    const registeredAuth = {
      ...configuredAuth(),
      clientId: 'dcr-client-id',
    };
    vi.mocked(fetchToolsetAuthSettings).mockResolvedValue(registeredAuth);

    const { result } = renderHook(() => useToolsetEditorOAuthLogin());
    const promise = result.current({ auth: dynamicAuth(), ensureSaved });

    /* The popup must already exist while the persist call is still pending. */
    expect(capturedPopup).toBeDefined();
    expect(capturedPopup?.location.href).toBe('');

    releaseSave(TOOLSET_ID);
    await vi.waitFor(() =>
      expect(capturedPopup?.location.href).toContain('client_id=dcr-client-id'),
    );

    postOAuthResult(readFlowId(), {
      type: ToolsetOAuthResultType.Success,
      toolsetId: TOOLSET_ID,
      credentialsLevel: ToolsetCredentialsLevel.User,
    });

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.Success,
      auth: registeredAuth,
    });
  });

  it('closes the popup and reports a cancel when persisting is abandoned', async () => {
    const { promise } = runLogin(
      dynamicAuth(),
      vi.fn().mockResolvedValue(false),
    );

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.Cancelled,
    });
    expect(capturedPopup?.close).toHaveBeenCalledOnce();
  });

  it('closes the popup and reports a failure when the client cannot be read back', async () => {
    vi.mocked(fetchToolsetAuthSettings).mockRejectedValue(new Error('boom'));

    const { promise } = runLogin(dynamicAuth());

    await expect(promise).resolves.toMatchObject({
      status: ToolsetOAuthLoginStatus.Failed,
    });
    expect(capturedPopup?.close).toHaveBeenCalledOnce();
  });

  it('never opens the flow when the popup is blocked, leaving the toolset unsaved', async () => {
    vi.mocked(window.open).mockReturnValueOnce(null);
    const ensureSaved = vi.fn();

    const { promise } = runLogin(dynamicAuth(), ensureSaved);

    await expect(promise).resolves.toEqual({
      status: ToolsetOAuthLoginStatus.PopupBlocked,
    });
    expect(ensureSaved).not.toHaveBeenCalled();
  });

  it('skips the extra read and reuses an already-known client', async () => {
    const { promise } = runLogin({
      ...configuredAuth(),
      withLogin: WithLogin.WithLogin,
    });
    await vi.waitFor(() => expect(capturedPopup).toBeDefined());

    expect(fetchToolsetAuthSettings).not.toHaveBeenCalled();
    expect(capturedPopup?.location.href).toContain(
      'https://auth.example.com/authorize',
    );

    postOAuthResult(readFlowId(), {
      type: ToolsetOAuthResultType.Success,
      toolsetId: TOOLSET_ID,
      credentialsLevel: ToolsetCredentialsLevel.User,
    });
    await promise;
  });
});

describe('useToolsetEditorOAuthLogin — callback route', () => {
  it('authorizes against the app-owned callback route', async () => {
    const { promise } = runLogin(configuredAuth());
    await vi.waitFor(() => expect(capturedPopup).toBeDefined());

    expect(capturedPopup?.location.href).toContain(
      encodeURIComponent(ROUTES.ToolsetSignIn),
    );

    postOAuthResult(readFlowId(), {
      type: ToolsetOAuthResultType.Success,
      toolsetId: TOOLSET_ID,
      credentialsLevel: ToolsetCredentialsLevel.User,
    });
    await promise;
  });
});
