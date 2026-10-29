import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import {
  emitToolsetLoginSuccess,
  getToolsetOAuthChannelName,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetCredentialsLevel,
  type ToolsetRedirectState,
} from '@epam/ai-dial-chat-hooks';
import {
  decodeJsonFromBase64,
  encodeJsonToBase64,
} from '@epam/ai-dial-chat-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ComponentProps, Ref } from 'react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
} from '../../../../constants/translation-keys';
import * as AppConfigContextModule from '../../../../context/AppConfigContext';
import * as UserContextModule from '../../../../context/auth/UserContext';
import * as ThemeContextModule from '../../../../context/ThemeContext';
import { ExternalServiceLoginOutcomeType } from '../../../../hooks/externalServices/useExternalServiceLogin';
import * as deploymentsApi from '../../../../server-api/deployments';
import * as externalServicesApi from '../../../../server-api/external-services';
import * as toolsetsApi from '../../../../server-api/toolsets';
import { AppsEditorEvent } from '../../../../types/apps-editor';
import { AuthStatus } from '../../../../types/auth-status';
import type { AppEditorIframeHandle } from '../AppEditorIframe';
import AppEditorIframe, {
  EDITOR_RESPONSE_TIMEOUT_MS,
} from '../AppEditorIframe';

vi.mock('../../../../context/AppConfigContext', () => ({
  useFeatureFlag: vi.fn(() => true),
}));
vi.mock('../../../../hooks/useUiFeature', () => ({
  useUiFeature: vi.fn(() => true),
}));
vi.mock(
  '../../../../components/ApplicationCredentials/ApplicationCredentials',
  () => ({
    ApplicationCredentials: ({ appId }: { appId: string }) => (
      <div>Credentials for {appId}</div>
    ),
  }),
);
vi.mock('../../../../context/auth/UserContext');
vi.mock('../../../../context/ThemeContext');
vi.mock('../../../../server-api/toolsets', () => ({
  getToolset: vi.fn(),
  logoutToolset: vi.fn(),
}));
vi.mock('../../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));
vi.mock('../../../../server-api/external-services', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../../../server-api/external-services')
  >()),
  listExternalServices: vi.fn(),
}));
const { mockLoginExternalService } = vi.hoisted(() => ({
  mockLoginExternalService: vi.fn(),
}));
vi.mock(
  '../../../../hooks/externalServices/useExternalServiceLogin',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../../../hooks/externalServices/useExternalServiceLogin')
    >()),
    useExternalServiceLogin: () => ({ login: mockLoginExternalService }),
  }),
);

vi.mock('@epam/ai-dial-ui-kit', () => ({
  Popup: ({
    children,
    onClose,
  }: {
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div role="dialog">
      {children}
      <button onClick={onClose}>Close credentials</button>
    </div>
  ),
  NeutralButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  ElementSize: { Small: 'small' },
  /* Read at import time by conversation-input's UsageLimitBannerView. */
  NotificationVariant: { Warning: 'warning', Error: 'error' },
  WarningMessageNotification: ({
    title,
    message,
    action,
  }: {
    title: React.ReactNode;
    message: React.ReactNode;
    action: React.ReactNode;
  }) => (
    <div role="alert">
      <p>{title}</p>
      <p>{message}</p>
      {action}
    </div>
  ),
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  /* Mirrors the kit: a status region wrapping a labelled image. */
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div role="status">
      <div role="img" aria-label={ariaLabel ?? 'Loading'} />
    </div>
  ),
}));

const mockUseUser = vi.mocked(UserContextModule.useUser);
const mockUseTheme = vi.mocked(ThemeContextModule.useTheme);

const SCHEMA = {
  id: 'quickapps2-schema',
  displayName: 'QuickApp',
  editorUrl: 'https://editor.example.com',
};

const DEFAULT_PROPS = {
  schema: SCHEMA,
  appId: 'abc',
  onUpdated: vi.fn(),
};

const renderIframe = (
  props?: Partial<ComponentProps<typeof AppEditorIframe>>,
  ref?: Ref<AppEditorIframeHandle>,
) => render(<AppEditorIframe {...DEFAULT_PROPS} {...props} ref={ref} />);

/** Window of the rendered embedded editor, the only trusted message source. */
const getEditorWindow = () =>
  (screen.queryByTitle('QuickApp') as HTMLIFrameElement | null)
    ?.contentWindow ?? null;

const postEditorMessage = (
  data: Record<string, unknown>,
  source: MessageEventSource | null = getEditorWindow(),
) =>
  fireEvent(
    window,
    new MessageEvent('message', {
      data,
      origin: 'https://editor.example.com',
      source,
    }),
  );

describe('AppEditorIframe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('builds iframe src with correct auth params', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const url = new URL(iframe.src);
    expect(url.searchParams.get('authProvider')).toBe('local');
    expect(url.searchParams.get('id')).toBe('abc');
    expect(url.searchParams.get('theme')).toBe('dark');
  });

  it('includes applicationName in the iframe src', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.get('applicationName')).toBe(
      'QuickApp',
    );
  });

  it.each(['invalid URL', 'data:text/html,editor'])(
    'does not create a message transport for an invalid editor origin: %s',
    (editorUrl) => {
      const ref = createRef<AppEditorIframeHandle>();
      const onReadyChange = vi.fn();
      renderIframe({ schema: { ...SCHEMA, editorUrl }, onReadyChange }, ref);
      const postMessageSpy = vi.spyOn(
        getEditorWindow() as Window,
        'postMessage',
      );

      ref.current?.triggerSave({ name: 'My App' });
      postEditorMessage({
        type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
      });

      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(onReadyChange).not.toHaveBeenCalledWith(true);
    },
  );

  it('encodes applicationName with spaces and dots and round-trips it', () => {
    renderIframe({ schema: { ...SCHEMA, displayName: 'Quick app 2.0' } });
    const iframe = screen.getByTitle('Quick app 2.0') as HTMLIFrameElement;
    expect(iframe.src).toContain('applicationName=Quick+app+2.0');
    expect(new URL(iframe.src).searchParams.get('applicationName')).toBe(
      'Quick app 2.0',
    );
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
  ])('omits applicationName when displayName is %s', (_label, displayName) => {
    const { container } = renderIframe({
      schema: {
        ...SCHEMA,
        displayName,
      } as unknown as ComponentProps<typeof AppEditorIframe>['schema'],
    });
    // An empty or missing displayName leaves the iframe without a title to query it by.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.has('applicationName')).toBe(false);
  });

  it('changes the iframe src and re-gates readiness when displayName changes', () => {
    const onReadyChange = vi.fn();
    const { rerender } = render(
      <AppEditorIframe {...DEFAULT_PROPS} onReadyChange={onReadyChange} />,
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(onReadyChange).toHaveBeenCalledWith(true);
    onReadyChange.mockClear();

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        schema={{ ...SCHEMA, displayName: 'Other App' }}
        onReadyChange={onReadyChange}
      />,
    );

    const iframe = screen.getByTitle('Other App') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.get('applicationName')).toBe(
      'Other App',
    );
    expect(onReadyChange).toHaveBeenCalledWith(false);
  });

  it('delegates local-network-access to the embedded iframe', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    expect(iframe.getAttribute('allow')).toBe('local-network-access=*');
  });

  it('shows spinner on mount', () => {
    renderIframe();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('exposes the localized loading label inside a single status region', () => {
    renderIframe();
    const [status] = screen.getAllByRole('status');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(
      within(status).getByRole('img', {
        name: AppsEditorI18nKeys.SettingsStepLoadingLabel,
      }),
    ).toBeTruthy();
  });

  it('hides spinner after iframe load event', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp');
    fireEvent.load(iframe);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides spinner after readyToInteract postMessage', () => {
    renderIframe();
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('calls onUpdated when updatedApplicationSuccess message arrives', () => {
    const onUpdated = vi.fn();
    renderIframe({ onUpdated });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.UpdatedSuccess}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it('calls onSaveSuccess with hasChanges: true when the SaveSuccess message carries it', () => {
    const onSaveSuccess = vi.fn();
    renderIframe({ onSaveSuccess });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.SaveSuccess, hasChanges: true },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(onSaveSuccess).toHaveBeenCalledWith(true);
  });

  it('calls onSaveSuccess with hasChanges: false when the SaveSuccess message carries it', () => {
    const onSaveSuccess = vi.fn();
    renderIframe({ onSaveSuccess });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.SaveSuccess, hasChanges: false },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(onSaveSuccess).toHaveBeenCalledWith(false);
  });

  it('normalizes a missing hasChanges field on SaveSuccess to false', () => {
    const onSaveSuccess = vi.fn();
    renderIframe({ onSaveSuccess });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.SaveSuccess },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(onSaveSuccess).toHaveBeenCalledWith(false);
  });

  it.each([
    [{ error: 'Save was refused' }, 'Save was refused'],
    [{ payload: { error: 'Storage unavailable' } }, 'Storage unavailable'],
    [{}, ''],
  ])('forwards the normalized save error: %j', (fields, error) => {
    const onSaveError = vi.fn();
    renderIframe({ onSaveError });

    postEditorMessage({ type: AppsEditorEvent.SaveError, ...fields });

    expect(onSaveError).toHaveBeenCalledWith(error);
  });

  it.each(['missing', 'foreign'])(
    'ignores lifecycle and save messages with a %s source',
    (sourceKind) => {
      const source = sourceKind === 'missing' ? null : window;
      const onReadyChange = vi.fn();
      const onLoggedOutChange = vi.fn();
      const onUpdated = vi.fn();
      const onSaveSuccess = vi.fn();
      const onSaveError = vi.fn();
      renderIframe({
        onReadyChange,
        onLoggedOutChange,
        onUpdated,
        onSaveSuccess,
        onSaveError,
      });
      onReadyChange.mockClear();
      onLoggedOutChange.mockClear();

      for (const type of [
        `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        `${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`,
        `${SCHEMA.displayName}/${AppsEditorEvent.UpdatedSuccess}`,
        AppsEditorEvent.SaveSuccess,
        AppsEditorEvent.SaveError,
      ]) {
        postEditorMessage(
          { type, hasChanges: true, error: 'Foreign error' },
          source,
        );
      }

      expect(screen.getByRole('status')).toBeTruthy();
      expect(onReadyChange).not.toHaveBeenCalled();
      expect(onLoggedOutChange).not.toHaveBeenCalled();
      expect(onUpdated).not.toHaveBeenCalled();
      expect(onSaveSuccess).not.toHaveBeenCalled();
      expect(onSaveError).not.toHaveBeenCalled();
    },
  );

  it('uses the latest callbacks without starting another iframe load', () => {
    const onLoadStart = vi.fn();
    const onSaveSuccess = vi.fn();
    const nextOnSaveSuccess = vi.fn();
    const { rerender } = renderIframe({ onLoadStart, onSaveSuccess });
    const iframe = screen.getByTitle('QuickApp');

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        onLoadStart={onLoadStart}
        onSaveSuccess={nextOnSaveSuccess}
      />,
    );
    postEditorMessage({ type: AppsEditorEvent.SaveSuccess, hasChanges: true });

    expect(screen.getByTitle('QuickApp')).toBe(iframe);
    expect(onLoadStart).toHaveBeenCalledOnce();
    expect(onSaveSuccess).not.toHaveBeenCalled();
    expect(nextOnSaveSuccess).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('ignores messages from a different origin', () => {
    const onUpdated = vi.fn();
    renderIframe({ onUpdated });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://evil.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('removes message listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderIframe();
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
  });

  it('stops delivering editor callbacks after unmount', () => {
    const onSaveSuccess = vi.fn();
    const { unmount } = renderIframe({ onSaveSuccess });
    const source = getEditorWindow();

    unmount();
    postEditorMessage(
      { type: AppsEditorEvent.SaveSuccess, hasChanges: true },
      source,
    );

    expect(onSaveSuccess).not.toHaveBeenCalled();
  });
});

describe('AppEditorIframe — unresponsive editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const postFromEditor = (type: string) =>
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );

  const expireResponseTimeout = () =>
    act(() => {
      vi.advanceTimersByTime(EDITOR_RESPONSE_TIMEOUT_MS);
    });

  it('warns instead of spinning when the editor sends no message in time, even after a load event', () => {
    const onUnresponsiveChange = vi.fn();
    renderIframe({ onUnresponsiveChange });
    // An unreachable host still fires load for the browser's own error page.
    fireEvent.load(screen.getByTitle('QuickApp'));

    expireResponseTimeout();

    const alert = screen.getByRole('alert');
    expect(
      within(alert).getByText(AppsEditorI18nKeys.SettingsStepUnresponsiveTitle),
    ).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(onUnresponsiveChange).toHaveBeenLastCalledWith(true);
  });

  it('keeps the spinner and no warning before the timeout', () => {
    renderIframe();
    act(() => {
      vi.advanceTimersByTime(EDITOR_RESPONSE_TIMEOUT_MS - 1);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('never warns once the editor has sent a message', () => {
    renderIframe();
    postFromEditor(`${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`);
    expireResponseTimeout();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats visualizer READY as activity without making the editor safe to save', () => {
    const onReadyChange = vi.fn();
    renderIframe({ onReadyChange });

    postEditorMessage({ type: `${SCHEMA.displayName}/READY` });
    expireResponseTimeout();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
    expect(onReadyChange).not.toHaveBeenCalledWith(true);
  });

  it('does not count same-origin messages from another window as editor activity', () => {
    renderIframe();

    postEditorMessage({ type: `${SCHEMA.displayName}/READY` }, window);
    expireResponseTimeout();

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('ignores messages from other origins when deciding the editor responded', () => {
    renderIframe();
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://evil.example.com',
        source: getEditorWindow(),
      }),
    );
    expireResponseTimeout();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('clears the warning when a late message arrives', () => {
    const onUnresponsiveChange = vi.fn();
    renderIframe({ onUnresponsiveChange });
    expireResponseTimeout();

    postFromEditor(`${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onUnresponsiveChange).toHaveBeenLastCalledWith(false);
  });

  it('remounts the iframe and restarts the wait on Reload', () => {
    const onLoadStart = vi.fn();
    const onReadyChange = vi.fn();
    renderIframe({ onLoadStart, onReadyChange });
    const firstIframe = screen.getByTitle('QuickApp');
    expect(onLoadStart).toHaveBeenCalledTimes(1);
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
    expireResponseTimeout();

    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Reload }),
    );

    expect(screen.getByTitle('QuickApp')).not.toBe(firstIframe);
    expect(screen.getByTitle('QuickApp').getAttribute('src')).toBe(
      firstIframe.getAttribute('src'),
    );
    expect(onLoadStart).toHaveBeenCalledTimes(2);
    expect(onReadyChange).not.toHaveBeenCalledWith(true);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();

    expireResponseTimeout();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('ignores the old iframe window after Reload and accepts the new one', () => {
    const onReadyChange = vi.fn();
    renderIframe({ onReadyChange });
    const previousWindow = getEditorWindow();
    expireResponseTimeout();

    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Reload }),
    );
    const message = {
      type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
    };
    postEditorMessage(message, previousWindow);

    expect(onReadyChange).not.toHaveBeenCalledWith(true);

    postEditorMessage(message);

    expect(onReadyChange).toHaveBeenLastCalledWith(true);
  });
});

describe('AppEditorIframe — ready-to-save readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('does not report ready when only readyToInteract arrives', () => {
    const onReadyChange = vi.fn();
    renderIframe({ onReadyChange });
    onReadyChange.mockClear();

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );

    expect(onReadyChange).not.toHaveBeenCalledWith(true);
  });

  it('reports ready once readyToSave arrives', () => {
    const onReadyChange = vi.fn();
    renderIframe({ onReadyChange });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );

    expect(onReadyChange).toHaveBeenCalledWith(true);
  });

  it('gates saving after logout and clears logout after the editor becomes ready again', () => {
    const onReadyChange = vi.fn();
    const onLoggedOutChange = vi.fn();
    renderIframe({ onReadyChange, onLoggedOutChange });

    postEditorMessage({
      type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
    });
    expect(onReadyChange).toHaveBeenLastCalledWith(true);

    postEditorMessage({
      type: `${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`,
    });
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
    expect(onLoggedOutChange).toHaveBeenLastCalledWith(true);

    postEditorMessage({
      type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
    });
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    expect(onLoggedOutChange).toHaveBeenLastCalledWith(false);
  });

  it('re-gates readiness to false when the iframe reloads for a different app', () => {
    const onLoadStart = vi.fn();
    const onReadyChange = vi.fn();
    const { rerender } = render(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        onLoadStart={onLoadStart}
        onReadyChange={onReadyChange}
      />,
    );
    expect(onLoadStart).toHaveBeenCalledTimes(1);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(onReadyChange).toHaveBeenCalledWith(true);
    onReadyChange.mockClear();

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        appId="different-app"
        onLoadStart={onLoadStart}
        onReadyChange={onReadyChange}
      />,
    );

    expect(onLoadStart).toHaveBeenCalledTimes(2);
    expect(onReadyChange).toHaveBeenCalledWith(false);
  });

  it('keeps readiness and the current load when callback and schema references change', () => {
    const onLoadStart = vi.fn();
    const nextOnLoadStart = vi.fn();
    const onReadyChange = vi.fn();
    const { rerender } = renderIframe({ onLoadStart, onReadyChange });
    const firstIframe = screen.getByTitle('QuickApp');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    onReadyChange.mockClear();

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        schema={{ ...SCHEMA }}
        onLoadStart={nextOnLoadStart}
        onReadyChange={onReadyChange}
      />,
    );

    expect(screen.getByTitle('QuickApp')).toBe(firstIframe);
    expect(onLoadStart).toHaveBeenCalledTimes(1);
    expect(nextOnLoadStart).not.toHaveBeenCalled();
    expect(onReadyChange).not.toHaveBeenCalled();

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        appId="different-app"
        onLoadStart={nextOnLoadStart}
        onReadyChange={onReadyChange}
      />,
    );

    expect(onLoadStart).toHaveBeenCalledTimes(1);
    expect(nextOnLoadStart).toHaveBeenCalledTimes(1);
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
  });

  it('ignores a readyToSave message from a different origin', () => {
    const onReadyChange = vi.fn();
    renderIframe({ onReadyChange });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        },
        origin: 'https://evil.example.com',
        source: getEditorWindow(),
      }),
    );

    expect(onReadyChange).not.toHaveBeenCalledWith(true);
  });

  it('reports form validity from the editor window and ignores other sources', () => {
    const onValidityChange = vi.fn();
    renderIframe({ onValidityChange });
    expect(onValidityChange).toHaveBeenLastCalledWith(true);

    const post = (isValid: boolean, source: MessageEventSource | null) =>
      fireEvent(
        window,
        new MessageEvent('message', {
          data: { type: AppsEditorEvent.ValidityState, payload: { isValid } },
          origin: 'https://editor.example.com',
          source,
        }),
      );

    post(false, null);
    expect(onValidityChange).toHaveBeenLastCalledWith(true);

    post(false, getEditorWindow());
    expect(onValidityChange).toHaveBeenLastCalledWith(false);

    post(true, getEditorWindow());
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it('reports logged out once a loggedOut message arrives', () => {
    const onLoggedOutChange = vi.fn();
    renderIframe({ onLoggedOutChange });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );

    expect(onLoggedOutChange).toHaveBeenCalledWith(true);
  });

  it('ignores a loggedOut message from a different origin', () => {
    const onLoggedOutChange = vi.fn();
    renderIframe({ onLoggedOutChange });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`,
        },
        origin: 'https://evil.example.com',
        source: getEditorWindow(),
      }),
    );

    expect(onLoggedOutChange).not.toHaveBeenCalledWith(true);
  });

  it('re-gates logged-out to false when the iframe reloads for a different app', () => {
    const onLoggedOutChange = vi.fn();
    const { rerender } = render(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        onLoggedOutChange={onLoggedOutChange}
      />,
    );

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`,
        },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(onLoggedOutChange).toHaveBeenCalledWith(true);
    onLoggedOutChange.mockClear();

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        appId="different-app"
        onLoggedOutChange={onLoggedOutChange}
      />,
    );

    expect(onLoggedOutChange).toHaveBeenCalledWith(false);
  });
});

describe('AppEditorIframe — triggerSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('posts TriggerSave with the given general payload', () => {
    const ref = createRef<AppEditorIframeHandle>();
    renderIframe({}, ref);
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    ref.current?.triggerSave({ name: 'My App', description: 'desc' });

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: AppsEditorEvent.TriggerSave,
        general: { name: 'My App', description: 'desc' },
      },
      'https://editor.example.com',
    );
  });

  it('posts TriggerSave with no general payload when none is passed', () => {
    const ref = createRef<AppEditorIframeHandle>();
    renderIframe({}, ref);
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    ref.current?.triggerSave();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: AppsEditorEvent.TriggerSave, general: undefined },
      'https://editor.example.com',
    );
  });
});

describe('AppEditorIframe — toolset login request', () => {
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

  const postOAuthResult = (
    flowId: string,
    message: Record<string, unknown>,
  ) => {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    channel.postMessage(message);
    channel.close();
  };

  const sendLoginRequest = (
    toolsetId: string,
    source: MessageEventSource | null = getEditorWindow(),
  ) => {
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.RequestToolsetLogin, toolsetId },
        origin: 'https://editor.example.com',
        source,
      }),
    );
  };

  let capturedPopup: ReturnType<typeof makeFakePopup> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
    capturedPopup = undefined;
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => {
        capturedPopup = makeFakePopup();
        return capturedPopup;
      }),
    });
    // Best-effort credentials refresh: default to failing harmlessly unless a test opts in.
    vi.mocked(deploymentsApi.getDeploymentDetails).mockRejectedValue(
      new Error('not mocked'),
    );
  });

  const mountIframeAndSpyOnPostMessage = () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    return vi.spyOn(iframe.contentWindow as Window, 'postMessage');
  };

  it('ignores a login request that does not come from the embedded editor window', () => {
    renderIframe();

    sendLoginRequest('toolsets/b/my__1.0.0', window);

    expect(window.open).not.toHaveBeenCalled();
    expect(toolsetsApi.getToolset).not.toHaveBeenCalled();
  });

  it('posts popup-blocked without calling getToolset when the browser blocks the popup', async () => {
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => null),
    });
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLoginResult,
          toolsetId: 'toolsets/b/my__1.0.0',
          success: false,
          reason: 'popup-blocked',
        }),
        'https://editor.example.com',
      ),
    );
    expect(toolsetsApi.getToolset).not.toHaveBeenCalled();
  });

  it('closes the popup and posts not-oauth when the toolset does not use OAuth', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: { authenticationType: 'API_KEY' },
    } as DialToolsetDto);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLoginResult,
          success: false,
          reason: 'not-oauth',
        }),
        'https://editor.example.com',
      ),
    );
    expect(capturedPopup?.close).toHaveBeenCalledOnce();
  });

  it('percent-encodes the raw toolsetId before calling getToolset, but echoes the raw id back to the iframe', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: { authenticationType: 'API_KEY' },
    } as DialToolsetDto);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/My Toolset__1.0.0');

    await waitFor(() =>
      expect(toolsetsApi.getToolset).toHaveBeenCalledWith(
        'toolsets/b/My%20Toolset__1.0.0',
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolsetId: 'toolsets/b/My Toolset__1.0.0',
          success: false,
          reason: 'not-oauth',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('closes the popup and posts toolset-fetch-failed when getToolset rejects', async () => {
    vi.mocked(toolsetsApi.getToolset).mockRejectedValue(new Error('boom'));
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          reason: 'toolset-fetch-failed',
        }),
        'https://editor.example.com',
      ),
    );
    expect(capturedPopup?.close).toHaveBeenCalledOnce();
  });

  it('opens a popup, logs in via OAuth, and posts a success result once the flow channel reports success', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    } as DialToolsetDto);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    const { state: flowId } = decodeJsonFromBase64<ToolsetRedirectState>(
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
        encodeJsonToBase64({}),
    );
    if (flowId == null) {
      throw new Error('expected a stored flow id');
    }

    postOAuthResult(flowId, {
      type: 'success',
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: 'USER',
    });

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLoginResult,
          toolsetId: 'toolsets/b/my__1.0.0',
          success: true,
          credentialsLevel: 'USER',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('refetches toolset details the same way Catalog does and includes credentials in the success result', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    } as DialToolsetDto);
    vi.mocked(deploymentsApi.getDeploymentDetails).mockResolvedValue({
      id: 'toolsets/b/my__1.0.0',
      type: 'toolset',
      toolsetDetails: {
        authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
      },
    } as never);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    const { state: flowId } = decodeJsonFromBase64<ToolsetRedirectState>(
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
        encodeJsonToBase64({}),
    );
    if (flowId == null) {
      throw new Error('expected a stored flow id');
    }

    postOAuthResult(flowId, {
      type: 'success',
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: 'USER',
    });

    await waitFor(() =>
      expect(deploymentsApi.getDeploymentDetails).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          credentials: expect.objectContaining({
            userStatus: 'SIGNED_IN',
          }),
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('posts a failure result with the reported reason when the OAuth login fails', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    } as DialToolsetDto);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    const { state: flowId } = decodeJsonFromBase64<ToolsetRedirectState>(
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
        encodeJsonToBase64({}),
    );
    if (flowId == null) {
      throw new Error('expected a stored flow id');
    }

    postOAuthResult(flowId, {
      type: 'failure',
      reason: 'login-request-failed',
    });

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          reason: 'login-request-failed',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('recovers a login that actually succeeded but was reported as Cancelled by a lost broadcast message', async () => {
    vi.mocked(toolsetsApi.getToolset)
      .mockResolvedValueOnce({
        id: 't',
        toolset: 't',
        authSettings: {
          authenticationType: 'OAUTH',
          clientId: 'client',
          authorizationEndpoint: 'https://auth.example.com/authorize',
        },
      } as DialToolsetDto)
      .mockResolvedValueOnce({
        id: 't',
        toolset: 't',
        authSettings: { globalAuthStatus: 'SIGNED_IN' },
      } as DialToolsetDto);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    if (capturedPopup) capturedPopup.closed = true;
    window.dispatchEvent(new Event('focus'));

    await waitFor(
      () =>
        expect(postMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            credentialsLevel: ToolsetCredentialsLevel.Global,
          }),
          'https://editor.example.com',
        ),
      { timeout: 2000 },
    );
  });

  it('posts a cancelled failure when the recheck finds the toolset still signed out', async () => {
    vi.mocked(toolsetsApi.getToolset)
      .mockResolvedValueOnce({
        id: 't',
        toolset: 't',
        authSettings: {
          authenticationType: 'OAUTH',
          clientId: 'client',
          authorizationEndpoint: 'https://auth.example.com/authorize',
        },
      } as DialToolsetDto)
      .mockResolvedValueOnce({
        id: 't',
        toolset: 't',
        authSettings: { userLevelAuthStatus: 'SIGNED_OUT' },
      } as DialToolsetDto);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    if (capturedPopup) capturedPopup.closed = true;
    window.dispatchEvent(new Event('focus'));

    await waitFor(
      () =>
        expect(postMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            reason: 'cancelled',
          }),
          'https://editor.example.com',
        ),
      { timeout: 2000 },
    );
  });
});

describe('AppEditorIframe — toolset logout request', () => {
  const sendLogoutRequest = (
    toolsetId: string,
    source: MessageEventSource | null = getEditorWindow(),
  ) => {
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.RequestToolsetLogout, toolsetId },
        origin: 'https://editor.example.com',
        source,
      }),
    );
  };

  const mountIframeAndSpyOnPostMessage = () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    return vi.spyOn(iframe.contentWindow as Window, 'postMessage');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
    vi.mocked(deploymentsApi.getDeploymentDetails).mockRejectedValue(
      new Error('not mocked'),
    );
  });

  it('percent-encodes the raw toolsetId, calls logoutToolset without authenticationType, and posts a success result echoing the raw id', async () => {
    vi.mocked(toolsetsApi.logoutToolset).mockResolvedValue({ success: true });
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLogoutRequest('toolsets/b/My Toolset__1.0.0');

    await waitFor(() =>
      expect(toolsetsApi.logoutToolset).toHaveBeenCalledWith(
        'toolsets/b/My%20Toolset__1.0.0',
        {
          url: 'toolsets/b/My%20Toolset__1.0.0',
          credentialsLevel: ToolsetCredentialsLevel.Global,
        },
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLogoutResult,
          toolsetId: 'toolsets/b/My Toolset__1.0.0',
          success: true,
          credentialsLevel: ToolsetCredentialsLevel.Global,
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('includes refreshed credentials from getDeploymentDetails in the success result', async () => {
    vi.mocked(toolsetsApi.logoutToolset).mockResolvedValue({ success: true });
    vi.mocked(deploymentsApi.getDeploymentDetails).mockResolvedValue({
      id: 'toolsets/b/my__1.0.0',
      type: 'toolset',
      toolsetDetails: {
        authSettings: { userLevelAuthStatus: 'SIGNED_OUT' },
      },
    } as never);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLogoutRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          credentials: expect.objectContaining({
            userStatus: 'SIGNED_OUT',
          }),
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('posts a logout-failed result when logoutToolset rejects', async () => {
    vi.mocked(toolsetsApi.logoutToolset).mockRejectedValue(
      new Error('network error'),
    );
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    sendLogoutRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLogoutResult,
          toolsetId: 'toolsets/b/my__1.0.0',
          success: false,
          reason: 'logout-failed',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('does not deliver an old logout result after loading another app at the same origin', async () => {
    let finishLogout: () => void = () => undefined;
    vi.mocked(toolsetsApi.logoutToolset)
      .mockResolvedValue({ success: true })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishLogout = () => resolve({ success: true });
          }),
      );
    const { rerender } = renderIframe();
    const previousPost = vi.spyOn(getEditorWindow() as Window, 'postMessage');

    sendLogoutRequest('toolsets/b/my__1.0.0');
    expect(toolsetsApi.logoutToolset).toHaveBeenCalledOnce();
    rerender(<AppEditorIframe {...DEFAULT_PROPS} appId="another-app" />);
    const currentPost = vi.spyOn(getEditorWindow() as Window, 'postMessage');

    await act(async () => {
      finishLogout();
    });

    expect(previousPost).not.toHaveBeenCalled();
    expect(currentPost).not.toHaveBeenCalled();

    sendLogoutRequest('toolsets/b/my__1.0.0');
    await waitFor(() =>
      expect(currentPost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLogoutResult,
          success: true,
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('ignores a logout request from a different origin', async () => {
    renderIframe();
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: AppsEditorEvent.RequestToolsetLogout,
          toolsetId: 'toolsets/b/my__1.0.0',
        },
        origin: 'https://evil.example.com',
        source: getEditorWindow(),
      }),
    );
    expect(toolsetsApi.logoutToolset).not.toHaveBeenCalled();
  });

  it('ignores a logout request that does not come from the embedded editor window', () => {
    renderIframe();

    sendLogoutRequest('toolsets/b/my__1.0.0', window);

    expect(toolsetsApi.logoutToolset).not.toHaveBeenCalled();
  });
});

describe('AppEditorIframe — toolset login broadcast', () => {
  const mountIframeAndSpyOnPostMessage = () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    return vi.spyOn(iframe.contentWindow as Window, 'postMessage');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
    vi.mocked(deploymentsApi.getDeploymentDetails).mockRejectedValue(
      new Error('not mocked'),
    );
  });

  it('posts a ToolsetLoginResult with refreshed credentials when a login succeeds elsewhere in the app', async () => {
    vi.mocked(deploymentsApi.getDeploymentDetails).mockResolvedValue({
      id: 'toolsets/b/My%20Toolset__1.0.0',
      type: 'toolset',
      toolsetDetails: {
        authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
      },
    } as never);
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    emitToolsetLoginSuccess({
      toolsetId: 'toolsets/b/My%20Toolset__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.User,
    });

    await waitFor(() =>
      expect(deploymentsApi.getDeploymentDetails).toHaveBeenCalledWith(
        'toolsets/b/My%20Toolset__1.0.0',
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: AppsEditorEvent.ToolsetLoginResult,
          toolsetId: 'toolsets/b/My Toolset__1.0.0',
          success: true,
          credentialsLevel: ToolsetCredentialsLevel.User,
          credentials: expect.objectContaining({ userStatus: 'SIGNED_IN' }),
        },
        'https://editor.example.com',
      ),
    );
  });

  it('still posts a success result when the credentials refresh fails', async () => {
    const postMessageSpy = mountIframeAndSpyOnPostMessage();

    emitToolsetLoginSuccess({
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.Global,
    });

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: AppsEditorEvent.ToolsetLoginResult,
          toolsetId: 'toolsets/b/my__1.0.0',
          success: true,
          credentialsLevel: ToolsetCredentialsLevel.Global,
          credentials: undefined,
        },
        'https://editor.example.com',
      ),
    );
  });

  it('does not deliver an old broadcast result after loading another app at the same origin', async () => {
    let finishRefresh: () => void = () => undefined;
    vi.mocked(deploymentsApi.getDeploymentDetails).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = () =>
            resolve({
              id: 'toolsets/b/my__1.0.0',
              type: 'toolset',
              toolsetDetails: {
                authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
              },
            } as never);
        }),
    );
    const { rerender } = renderIframe();
    const previousPost = vi.spyOn(getEditorWindow() as Window, 'postMessage');

    emitToolsetLoginSuccess({
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.User,
    });
    rerender(<AppEditorIframe {...DEFAULT_PROPS} appId="another-app" />);
    const currentPost = vi.spyOn(getEditorWindow() as Window, 'postMessage');

    await act(async () => {
      finishRefresh();
    });

    expect(previousPost).not.toHaveBeenCalled();
    expect(currentPost).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount and does not post after the iframe is gone', async () => {
    const { unmount } = renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );
    unmount();

    emitToolsetLoginSuccess({
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.User,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});

describe('application credential requests from Quick apps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AppConfigContextModule.useFeatureFlag).mockReturnValue(true);
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('does not advertise or open credential forms when the feature is disabled', () => {
    vi.mocked(AppConfigContextModule.useFeatureFlag).mockReturnValue(false);
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.get('applicationCredentials')).toBe(
      'false',
    );
    fireEvent(
      window,
      new MessageEvent('message', {
        origin: SCHEMA.editorUrl,
        source: iframe.contentWindow,
        data: {
          type: AppsEditorEvent.RequestApplicationCredentials,
          appId: 'agent',
        },
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the shared forms only for a message from the embedded editor window', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.get('applicationCredentials')).toBe(
      'true',
    );
    const data = {
      type: AppsEditorEvent.RequestApplicationCredentials,
      appId: 'applications/public/agent with space',
    };
    fireEvent(
      window,
      new MessageEvent('message', {
        data,
        origin: SCHEMA.editorUrl,
        source: window,
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent(
      window,
      new MessageEvent('message', {
        data,
        origin: 'https://untrusted.example',
        source: iframe.contentWindow,
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent(
      window,
      new MessageEvent('message', {
        data,
        origin: SCHEMA.editorUrl,
        source: iframe.contentWindow,
      }),
    );
    expect(
      screen.getByText(
        'Credentials for applications/public/agent%20with%20space',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Close credentials'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('AppEditorIframe — external-service login request', () => {
  const RAW_APP_ID = 'applications/public/runner app';
  const ENCODED_APP_ID = 'applications/public/runner%20app';
  const OAUTH_SERVICE: externalServicesApi.ApplicationExternalServiceDto = {
    id: 'gitlab-oauth',
    displayName: 'GitLab',
    authenticationType: 'OAUTH',
    userLevelAuthStatus: 'SIGNED_OUT',
    clientId: 'client',
    authorizationEndpoint: 'https://gitlab.example.com/oauth/authorize',
    scopesSupported: ['read_repository'],
    codeChallenge: 'challenge',
    codeChallengeMethod: 'S256',
  };

  let popup: { close: ReturnType<typeof vi.fn> } | undefined;

  const sendRequest = (
    fields: Record<string, unknown> = {},
    source: MessageEventSource | null = getEditorWindow(),
  ) =>
    postEditorMessage(
      {
        type: AppsEditorEvent.RequestExternalServiceLogin,
        appId: RAW_APP_ID,
        serviceId: 'gitlab-oauth',
        offlineUsageConsent: true,
        ...fields,
      },
      source,
    );

  const mountAndSpy = () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    return vi.spyOn(iframe.contentWindow as Window, 'postMessage');
  };

  const expectResult = async (
    postMessageSpy: ReturnType<typeof mountAndSpy>,
    fields: Record<string, unknown>,
  ) =>
    waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: AppsEditorEvent.ExternalServiceLoginResult,
          appId: RAW_APP_ID,
          serviceId: 'gitlab-oauth',
          reason: undefined,
          ...fields,
        },
        'https://editor.example.com',
      ),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AppConfigContextModule.useFeatureFlag).mockReturnValue(true);
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
    popup = undefined;
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => {
        popup = { close: vi.fn() };
        return popup;
      }),
    });
    vi.mocked(externalServicesApi.listExternalServices).mockResolvedValue([
      OAUTH_SERVICE,
    ]);
    mockLoginExternalService.mockResolvedValue({
      type: ExternalServiceLoginOutcomeType.Success,
    });
  });

  it('advertises the relay with the credential gates and ignores requests when they are off', () => {
    vi.mocked(AppConfigContextModule.useFeatureFlag).mockReturnValue(false);
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.get('externalServiceLogin')).toBe(
      'false',
    );

    sendRequest();

    expect(window.open).not.toHaveBeenCalled();
    expect(externalServicesApi.listExternalServices).not.toHaveBeenCalled();
  });

  it('advertises the relay when both credential gates are on', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    expect(new URL(iframe.src).searchParams.get('externalServiceLogin')).toBe(
      'true',
    );
  });

  it('ignores a request from another window or without an explicit consent choice', () => {
    renderIframe();

    sendRequest({}, window);
    sendRequest({ offlineUsageConsent: undefined });
    sendRequest({ serviceId: '' });

    expect(window.open).not.toHaveBeenCalled();
    expect(externalServicesApi.listExternalServices).not.toHaveBeenCalled();
  });

  it('signs in at user level with the forwarded consent and posts success without the credentials dialog', async () => {
    const postMessageSpy = mountAndSpy();

    sendRequest();

    await expectResult(postMessageSpy, { success: true });
    expect(externalServicesApi.listExternalServices).toHaveBeenCalledWith(
      ENCODED_APP_ID,
    );
    expect(mockLoginExternalService).toHaveBeenCalledWith({
      appId: ENCODED_APP_ID,
      serviceId: 'gitlab-oauth',
      credentialsLevel: 'USER',
      authenticationType: 'OAUTH',
      oauthSettings: {
        clientId: 'client',
        authorizationEndpoint: 'https://gitlab.example.com/oauth/authorize',
        scopes: ['read_repository'],
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
      },
      offlineUsageConsent: true,
      forceStale: false,
      popup,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reserves the popup before requesting the service listing', async () => {
    const postMessageSpy = mountAndSpy();

    sendRequest();

    await expectResult(postMessageSpy, { success: true });
    expect(vi.mocked(window.open).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(externalServicesApi.listExternalServices).mock
        .invocationCallOrder[0],
    );
  });

  it('forwards a declined consent instead of defaulting it', async () => {
    const postMessageSpy = mountAndSpy();

    sendRequest({ offlineUsageConsent: false });

    await expectResult(postMessageSpy, { success: true });
    expect(mockLoginExternalService).toHaveBeenCalledWith(
      expect.objectContaining({ offlineUsageConsent: false }),
    );
  });

  it('posts popup-blocked without requesting the listing', async () => {
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => null),
    });
    const postMessageSpy = mountAndSpy();

    sendRequest();

    await expectResult(postMessageSpy, {
      success: false,
      reason: 'popup-blocked',
    });
    expect(externalServicesApi.listExternalServices).not.toHaveBeenCalled();
  });

  it.each([
    [[], 'not-found'],
    [
      [{ ...OAUTH_SERVICE, authenticationType: 'API_KEY' }],
      'unsupported-auth-type',
    ],
    [
      [{ ...OAUTH_SERVICE, authenticationType: 'NONE' }],
      'unsupported-auth-type',
    ],
  ])(
    'closes the popup and posts %s → %s without signing in',
    async (services, reason) => {
      vi.mocked(externalServicesApi.listExternalServices).mockResolvedValue(
        services as never,
      );
      const postMessageSpy = mountAndSpy();

      sendRequest();

      await expectResult(postMessageSpy, { success: false, reason });
      expect(popup?.close).toHaveBeenCalledOnce();
      expect(mockLoginExternalService).not.toHaveBeenCalled();
    },
  );

  it('closes the popup and posts failure when the listing fails', async () => {
    vi.mocked(externalServicesApi.listExternalServices).mockRejectedValue(
      new Error('boom'),
    );
    const postMessageSpy = mountAndSpy();

    sendRequest();

    await expectResult(postMessageSpy, { success: false, reason: 'failure' });
    expect(popup?.close).toHaveBeenCalledOnce();
  });

  it.each([
    [ExternalServiceLoginOutcomeType.Cancelled, 'cancelled'],
    [
      ExternalServiceLoginOutcomeType.AdminConsentRequired,
      'admin-consent-required',
    ],
    [ExternalServiceLoginOutcomeType.OfflineUnavailable, 'offline-unavailable'],
    [ExternalServiceLoginOutcomeType.Failure, 'failure'],
  ])('maps the %s outcome to the %s reason', async (outcome, reason) => {
    mockLoginExternalService.mockResolvedValue({ type: outcome });
    const postMessageSpy = mountAndSpy();

    sendRequest();

    await expectResult(postMessageSpy, { success: false, reason });
  });

  it('signs a DIAL-native service in through the same login and refreshes stale credentials', async () => {
    vi.mocked(externalServicesApi.listExternalServices).mockResolvedValue([
      {
        ...OAUTH_SERVICE,
        authenticationType: 'DIAL_NATIVE',
        userLevelAuthStatus: 'FAILED',
      },
    ]);
    const postMessageSpy = mountAndSpy();

    sendRequest();

    await expectResult(postMessageSpy, { success: true });
    expect(mockLoginExternalService).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationType: 'DIAL_NATIVE',
        credentialsLevel: 'USER',
        forceStale: true,
        popup,
      }),
    );
  });
});

describe('AppEditorIframe — dirty state', () => {
  const postDirty = (
    data: Record<string, unknown>,
    source: MessageEventSource | null = getEditorWindow(),
  ) =>
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.DirtyState, ...data },
        origin: 'https://editor.example.com',
        source,
      }),
    );

  it('reports clean until the editor says otherwise', () => {
    const onDirtyChange = vi.fn();
    renderIframe({ onDirtyChange });

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('reports unsaved edits posted by the editor window', () => {
    const onDirtyChange = vi.fn();
    renderIframe({ onDirtyChange });

    postDirty({ isDirty: true });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    postDirty({ payload: { isDirty: false } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('ignores a dirty-state message from another window', () => {
    const onDirtyChange = vi.fn();
    renderIframe({ onDirtyChange });

    postDirty({ isDirty: true }, null);

    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
  });

  it('ignores a non-boolean dirty state', () => {
    const onDirtyChange = vi.fn();
    renderIframe({ onDirtyChange });

    postDirty({ isDirty: 'yes' });
    postDirty({ payload: { isDirty: 1 } });

    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
  });

  it('clears the dirty state on save success', () => {
    const onDirtyChange = vi.fn();
    renderIframe({ onDirtyChange });
    postDirty({ isDirty: true });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.SaveSuccess },
        origin: 'https://editor.example.com',
        source: getEditorWindow(),
      }),
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('resets the dirty state when the iframe reloads for a different app', () => {
    const onDirtyChange = vi.fn();
    const { rerender } = render(
      <AppEditorIframe {...DEFAULT_PROPS} onDirtyChange={onDirtyChange} />,
    );
    postDirty({ isDirty: true });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        appId="different-app"
        onDirtyChange={onDirtyChange}
      />,
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
