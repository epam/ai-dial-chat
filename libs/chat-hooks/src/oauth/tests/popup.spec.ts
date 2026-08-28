import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initiateOAuthLogin,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
} from '../popup';
import {
  OAuthResourceKind,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
} from '../types';

const CALLBACK_PATH = '/auth/toolset-signin';
const TOOLSET_ID = 'toolsets/public/t1';

const validOAuthConfig = {
  clientId: 'client',
  authorizationEndpoint: 'https://auth.example.com/authorize',
};

interface FakePopup {
  sessionStorage: { setItem: ReturnType<typeof vi.fn> };
  location: { href: string };
  opener: unknown;
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
}

const createFakePopup = (): FakePopup => ({
  sessionStorage: { setItem: vi.fn() },
  location: { href: 'about:blank' },
  opener: {},
  closed: false,
  close: vi.fn(function (this: FakePopup) {
    this.closed = true;
  }),
});

const asWindow = (popup: FakePopup): Window => popup as unknown as Window;

const readRedirectState = (popup: FakePopup) => {
  const [key, value] = popup.sessionStorage.setItem.mock.calls[0] as [
    string,
    string,
  ];
  expect(key).toBe(TOOLSET_REDIRECT_STATE_KEY);
  return JSON.parse(value) as Record<string, unknown>;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openToolsetOAuthPopup', () => {
  it('opens a blank same-origin popup', () => {
    const popup = createFakePopup();
    const open = vi.spyOn(window, 'open').mockReturnValue(asWindow(popup));

    expect(openToolsetOAuthPopup()).toBe(asWindow(popup));
    expect(open).toHaveBeenCalledWith('', '_blank');
  });

  it('returns null when the browser blocks the popup', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(openToolsetOAuthPopup()).toBeNull();
  });
});

describe('initiateOAuthLogin', () => {
  it('opens a same-origin popup synchronously, writes redirect state into it, and navigates it to the authorize URL', () => {
    const popup = createFakePopup();
    const open = vi.spyOn(window, 'open').mockReturnValue(asWindow(popup));

    const result = initiateOAuthLogin(
      validOAuthConfig,
      TOOLSET_ID,
      CALLBACK_PATH,
      ToolsetCredentialsLevel.Global,
    );

    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(result.type).toBe(ToolsetOAuthInitiationResultType.Started);

    const state = readRedirectState(popup);
    expect(state).toMatchObject({
      toolsetId: TOOLSET_ID,
      credentialsLevel: ToolsetCredentialsLevel.Global,
      redirectUri: `${window.location.origin}${CALLBACK_PATH}`,
      resourceKind: OAuthResourceKind.Toolset,
    });

    const navigated = new URL(popup.location.href);
    expect(navigated.origin).toBe('https://auth.example.com');
    expect(navigated.searchParams.get('redirect_uri')).toBe(
      `${window.location.origin}${CALLBACK_PATH}`,
    );
  });

  it('resolves the redirect URI against the caller-supplied callback path', () => {
    const popup = createFakePopup();
    vi.spyOn(window, 'open').mockReturnValue(asWindow(popup));

    initiateOAuthLogin(
      validOAuthConfig,
      TOOLSET_ID,
      '/toolsets/editor-callback',
    );

    expect(readRedirectState(popup).redirectUri).toBe(
      `${window.location.origin}/toolsets/editor-callback`,
    );
  });

  it('uses the generated state as both the CSRF token and the flow id', () => {
    const popup = createFakePopup();
    vi.spyOn(window, 'open').mockReturnValue(asWindow(popup));

    const result = initiateOAuthLogin(
      validOAuthConfig,
      TOOLSET_ID,
      CALLBACK_PATH,
    );

    if (result.type !== ToolsetOAuthInitiationResultType.Started) {
      throw new Error('expected the flow to start');
    }
    expect(readRedirectState(popup).state).toBe(result.flowId);
    expect(new URL(popup.location.href).searchParams.get('state')).toBe(
      result.flowId,
    );
  });

  it('severs the popup opener before navigating to the provider', () => {
    const popup = createFakePopup();
    vi.spyOn(window, 'open').mockReturnValue(asWindow(popup));

    initiateOAuthLogin(validOAuthConfig, TOOLSET_ID, CALLBACK_PATH);

    expect(popup.opener).toBeNull();
  });

  it('defaults the credentials level to USER', () => {
    const popup = createFakePopup();
    vi.spyOn(window, 'open').mockReturnValue(asWindow(popup));

    initiateOAuthLogin(validOAuthConfig, TOOLSET_ID, CALLBACK_PATH);

    expect(readRedirectState(popup).credentialsLevel).toBe(
      ToolsetCredentialsLevel.User,
    );
  });

  it('returns Blocked without writing any redirect state when the browser blocks the popup', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(
      initiateOAuthLogin(validOAuthConfig, TOOLSET_ID, CALLBACK_PATH),
    ).toEqual({ type: ToolsetOAuthInitiationResultType.Blocked });
  });

  it('returns InvalidConfig without opening a popup when the auth config is invalid', () => {
    const open = vi.spyOn(window, 'open');

    expect(
      initiateOAuthLogin(
        { authorizationEndpoint: 'https://auth.example.com/authorize' },
        TOOLSET_ID,
        CALLBACK_PATH,
      ),
    ).toEqual({ type: ToolsetOAuthInitiationResultType.InvalidConfig });
    expect(open).not.toHaveBeenCalled();
  });
});

describe('navigateToolsetOAuthPopup', () => {
  it('writes redirect state into the given popup and navigates it', () => {
    const popup = createFakePopup();

    const result = navigateToolsetOAuthPopup(
      asWindow(popup),
      validOAuthConfig,
      TOOLSET_ID,
      CALLBACK_PATH,
      ToolsetCredentialsLevel.User,
    );

    expect(result.type).toBe(ToolsetOAuthInitiationResultType.Started);
    expect(readRedirectState(popup)).toMatchObject({
      toolsetId: TOOLSET_ID,
      credentialsLevel: ToolsetCredentialsLevel.User,
      resourceKind: OAuthResourceKind.Toolset,
    });
    expect(new URL(popup.location.href).origin).toBe(
      'https://auth.example.com',
    );
    expect(popup.opener).toBeNull();
  });

  it('records the resource kind the caller asked for', () => {
    const popup = createFakePopup();

    navigateToolsetOAuthPopup(
      asWindow(popup),
      validOAuthConfig,
      'applications/b/app::jira',
      CALLBACK_PATH,
      ToolsetCredentialsLevel.User,
      OAuthResourceKind.ExternalService,
    );

    expect(readRedirectState(popup).resourceKind).toBe(
      OAuthResourceKind.ExternalService,
    );
  });

  it('closes the popup and returns InvalidConfig when the auth config cannot build a URL', () => {
    const popup = createFakePopup();

    const result = navigateToolsetOAuthPopup(
      asWindow(popup),
      { authorizationEndpoint: 'https://auth.example.com/authorize' },
      TOOLSET_ID,
      CALLBACK_PATH,
    );

    expect(result).toEqual({
      type: ToolsetOAuthInitiationResultType.InvalidConfig,
    });
    expect(popup.close).toHaveBeenCalledOnce();
    expect(popup.sessionStorage.setItem).not.toHaveBeenCalled();
  });
});
