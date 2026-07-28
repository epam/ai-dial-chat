import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetOAuthCallbackQuery,
} from '../../../../constants/toolsets';
import {
  ApiI18nKeys,
  ButtonsI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../../constants/translation-keys';
import { useNotification } from '../../../../context/NotificationContext';
import * as toolsetsApi from '../../../../server-api/toolsets';
import { ROUTES } from '../../../../types/routes';
import type {
  ToolsetAuthFormData,
  ToolsetFormErrors,
} from '../../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthResultType,
  WithLogin,
} from '../../../../types/toolsets';
import { getToolsetOAuthChannelName } from '../../../../utils/toolsets';
import AuthSection from '../AuthSection';

/** Minimal fake popup `Window` — enough surface for `initiateOAuthLogin`/`waitForToolsetOAuthResult`. */
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

const postOAuthResult = (flowId: string, message: Record<string, unknown>) => {
  const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
  channel.postMessage(message);
  channel.close();
};

vi.mock('../../../../server-api/toolsets', () => ({
  getToolset: vi.fn(),
  loginToolset: vi.fn(),
  logoutToolset: vi.fn(),
}));

vi.mock('../../../../context/NotificationContext');

const mockShowNotification = vi.fn();

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialInput: ({
    value,
    onChange,
    labelProps,
    error,
    disabled,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    labelProps?: { label?: string; required?: boolean };
    error?: string;
    disabled?: boolean;
  }) => (
    <>
      <label>
        {labelProps?.label}
        <input
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </>
  ),
  DialRadioButton: ({
    inputId,
    value,
    label,
    checked,
    disabled,
    onChange,
  }: {
    name?: string;
    inputId?: string;
    value?: string;
    label?: string;
    checked?: boolean;
    disabled?: boolean;
    onChange?: (v: string) => void;
  }) => (
    <label htmlFor={inputId}>
      <input
        id={inputId}
        type="radio"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(value ?? '')}
      />
      {label}
    </label>
  ),
  DialTagInput: ({
    label,
    placeholder,
    onChange,
    initialTags,
    disabled,
  }: {
    label?: string;
    placeholder?: string;
    onChange?: (tags: string[]) => void;
    initialTags?: string[];
    disabled?: boolean;
  }) => (
    <label>
      {label}
      <input
        placeholder={placeholder}
        defaultValue={(initialTags ?? []).join(',')}
        disabled={disabled}
        onChange={(e) =>
          onChange?.(e.target.value ? e.target.value.split(',') : [])
        }
      />
    </label>
  ),
  DialPrimaryButton: ({
    label,
    onClick,
    disabled,
    type,
  }: {
    label?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: string;
  }) => (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  ),
  DialConfirmationPopup: ({
    open,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    isLoading,
  }: {
    open?: boolean;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    isLoading?: boolean;
  }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={onConfirm} disabled={isLoading}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    ) : null,
  ConfirmationPopupVariant: { Danger: 'danger' },
  NotificationVariant: { Error: 'error', Success: 'success' },
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  DIAL_ICON_SIZE: { SM: 16 },
  mergeClasses: (...classes: (string | undefined | false)[]) =>
    classes.filter(Boolean).join(' '),
}));

const noneAuth = (): ToolsetAuthFormData => ({
  authenticationType: ToolsetAuthTypes.None,
  withLogin: WithLogin.WithoutLogin,
  isLoggedIn: false,
});

const apiKeyAuth = (): ToolsetAuthFormData => ({
  authenticationType: ToolsetAuthTypes.ApiKey,
  withLogin: WithLogin.WithLogin,
  isLoggedIn: false,
  keyHeader: 'X-API-Key',
  apiKey: 'secret',
});

const oauthWithConfigAuth = (): ToolsetAuthFormData => ({
  authenticationType: ToolsetAuthTypes.OAuth,
  withLogin: WithLogin.WithConfig,
  isLoggedIn: false,
  clientId: 'client-id',
  clientSecret: 'secret',
  authorizationEndpoint: 'https://auth.example.com/authorize',
  tokenEndpoint: 'https://auth.example.com/token',
  scopes: [],
});

const VALID_ENDPOINT = 'https://example.com/mcp';

const renderSection = (
  auth: ToolsetAuthFormData = noneAuth(),
  toolsetId = 'toolsets/b/my__1.0.0',
  onAuthChange = vi.fn(),
  endpoint = VALID_ENDPOINT,
  errors: ToolsetFormErrors = {},
  onEnsureSaved = vi.fn().mockResolvedValue(toolsetId),
) =>
  render(
    <AuthSection
      auth={auth}
      errors={errors}
      isSaving={false}
      toolsetId={toolsetId}
      endpoint={endpoint}
      onAuthChange={onAuthChange}
      onEnsureSaved={onEnsureSaved}
    />,
  );

describe('AuthSection', () => {
  const user = userEvent.setup({ delay: null });
  let capturedPopup: ReturnType<typeof makeFakePopup> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
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
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification: mockShowNotification,
      dismissNotification: vi.fn(),
    });
  });

  describe('type selection', () => {
    it('calls onAuthChange with ApiKey type when the ApiKey row is clicked', async () => {
      const onAuthChange = vi.fn();
      renderSection(noneAuth(), 'toolsets/b/my__1.0.0', onAuthChange);
      await user.click(
        screen.getByRole('button', {
          name: new RegExp(ToolsetEditorI18nKeys.AuthTypeApiKey, 'i'),
        }),
      );
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.ApiKey,
        }),
      );
    });

    it('calls onAuthChange with OAuth type when the OAuth row is clicked', async () => {
      const onAuthChange = vi.fn();
      renderSection(noneAuth(), 'toolsets/b/my__1.0.0', onAuthChange);
      await user.click(
        screen.getByRole('button', {
          name: new RegExp(ToolsetEditorI18nKeys.AuthTypeOAuth, 'i'),
        }),
      );
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.OAuth,
        }),
      );
    });

    it('defaults a fresh OAuth selection to WithConfig so config fields are visible immediately', async () => {
      const onAuthChange = vi.fn();
      renderSection(noneAuth(), 'toolsets/b/my__1.0.0', onAuthChange);
      await user.click(
        screen.getByRole('button', {
          name: new RegExp(ToolsetEditorI18nKeys.AuthTypeOAuth, 'i'),
        }),
      );
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({ withLogin: WithLogin.WithConfig }),
      );
    });

    it('defaults an OAuth selection to WithLogin when a client is already configured', async () => {
      const onAuthChange = vi.fn();
      renderSection(
        { ...apiKeyAuth(), clientId: 'existing-client' },
        'toolsets/b/my__1.0.0',
        onAuthChange,
      );
      await user.click(
        screen.getByRole('button', {
          name: new RegExp(ToolsetEditorI18nKeys.AuthTypeOAuth, 'i'),
        }),
      );
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({ withLogin: WithLogin.WithLogin }),
      );
    });
  });

  describe('API Key conditional fields', () => {
    it('renders key header and API key inputs when ApiKey + WithLogin is active', () => {
      renderSection(apiKeyAuth());
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.KeyHeaderLabel),
      ).toBeTruthy();
      expect(screen.getByLabelText(ApiI18nKeys.ApiKey)).toBeTruthy();
    });

    it('renders only the key header input when ApiKey + WithoutLogin is active', () => {
      renderSection({
        ...apiKeyAuth(),
        withLogin: WithLogin.WithoutLogin,
        apiKey: '',
      });
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.KeyHeaderLabel),
      ).toBeTruthy();

      expect(
        screen.queryByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }),
      ).toBeNull();
    });

    it('renders WithLogin and WithoutLogin radio buttons for ApiKey', () => {
      renderSection(apiKeyAuth());
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.WithLoginLabel),
      ).toBeTruthy();
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.WithoutLoginLabel),
      ).toBeTruthy();
    });
  });

  describe('OAuth conditional fields', () => {
    it('renders client ID, client secret, auth endpoint, token endpoint, and scopes when OAuth + WithConfig is active', () => {
      renderSection(oauthWithConfigAuth());
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.ClientIdLabel),
      ).toBeTruthy();
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.ClientSecretLabel),
      ).toBeTruthy();
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.AuthorizationEndpointLabel),
      ).toBeTruthy();
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.TokenEndpointLabel),
      ).toBeTruthy();
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.ScopesLabel),
      ).toBeTruthy();
    });

    it('renders WithLogin and WithLogin+Config radio buttons for OAuth', () => {
      renderSection(oauthWithConfigAuth());
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.WithLoginLabel),
      ).toBeTruthy();
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.WithConfigLabel),
      ).toBeTruthy();
    });

    it('renders OAuth endpoint URL validation errors', () => {
      renderSection(
        oauthWithConfigAuth(),
        'toolsets/b/my__1.0.0',
        vi.fn(),
        VALID_ENDPOINT,
        {
          authorizationEndpoint: ToolsetEditorI18nKeys.EndpointInvalid,
          tokenEndpoint: ToolsetEditorI18nKeys.EndpointInvalid,
        },
      );

      const errors = screen.getAllByRole('alert');
      expect(errors).toHaveLength(2);
      expect(errors[0]?.textContent).toContain(
        ToolsetEditorI18nKeys.EndpointInvalid,
      );
      expect(errors[1]?.textContent).toContain(
        ToolsetEditorI18nKeys.EndpointInvalid,
      );
    });
  });

  describe('OAuth login redirect', () => {
    it('opens a popup and stores redirect state in it when OAuth Log in is clicked', async () => {
      renderSection(oauthWithConfigAuth());
      await user.click(
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }),
      );
      expect(capturedPopup).toBeDefined();
      const stored = capturedPopup?.sessionStorage.getItem(
        TOOLSET_REDIRECT_STATE_KEY,
      );
      expect(stored).not.toBeNull();
      const state = JSON.parse(stored as string);
      expect(state.toolsetId).toBe('toolsets/b/my__1.0.0');
      expect(state.credentialsLevel).toBe(ToolsetCredentialsLevel.User);
      expect(capturedPopup?.location.href).toContain(
        'https://auth.example.com/authorize',
      );
    });

    it('does not open a popup when saving unsaved changes fails', async () => {
      const onEnsureSaved = vi.fn().mockResolvedValue(false);
      renderSection(
        oauthWithConfigAuth(),
        'toolsets/b/my__1.0.0',
        vi.fn(),
        VALID_ENDPOINT,
        {},
        onEnsureSaved,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );
      await waitFor(() => expect(onEnsureSaved).toHaveBeenCalledOnce());
      expect(window.open).not.toHaveBeenCalled();
      expect(capturedPopup).toBeUndefined();
    });

    it('does not open a popup when authorizationEndpoint is missing', async () => {
      renderSection({
        ...oauthWithConfigAuth(),
        authorizationEndpoint: '',
      });
      await user.click(
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }),
      );
      expect(window.open).not.toHaveBeenCalled();
      expect(capturedPopup).toBeUndefined();
    });

    it('shows a popup-blocked error notification when the browser blocks the popup', async () => {
      vi.mocked(window.open).mockReturnValueOnce(null);
      renderSection(oauthWithConfigAuth());
      await user.click(
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }),
      );
      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Error,
          message: ToolsetEditorI18nKeys.ErrorPopupBlocked,
        }),
      );
    });

    it('flips the action to Log out after a successful OAuth login', async () => {
      const onAuthChange = vi.fn();
      renderSection(
        oauthWithConfigAuth(),
        'toolsets/b/my__1.0.0',
        onAuthChange,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );
      const flowId = JSON.parse(
        capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
          '{}',
      ).state;

      postOAuthResult(flowId, {
        type: ToolsetOAuthResultType.Success,
        toolsetId: 'toolsets/b/my__1.0.0',
        credentialsLevel: ToolsetCredentialsLevel.User,
      });

      await waitFor(() =>
        expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: true }),
      );
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        message: ToolsetEditorI18nKeys.LoginSuccess,
      });
    });

    it('shows the success notification on the first attempt when the channel event is missed', async () => {
      const onAuthChange = vi.fn();
      renderSection(
        oauthWithConfigAuth(),
        'toolsets/b/my__1.0.0',
        onAuthChange,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );

      const callbackUrl = new URL(ROUTES.ToolsetSignIn, window.location.origin);
      callbackUrl.searchParams.set(
        ToolsetOAuthCallbackQuery.Result,
        ToolsetOAuthResultType.Success,
      );
      if (capturedPopup) capturedPopup.location.href = callbackUrl.toString();

      await waitFor(
        () => expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: true }),
        { timeout: 2000 },
      );
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        message: ToolsetEditorI18nKeys.LoginSuccess,
      });
      expect(toolsetsApi.getToolset).not.toHaveBeenCalled();
    });

    it('keeps Log in available and shows an error notification after a failed OAuth login', async () => {
      const onAuthChange = vi.fn();
      renderSection(
        oauthWithConfigAuth(),
        'toolsets/b/my__1.0.0',
        onAuthChange,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );
      const flowId = JSON.parse(
        capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
          '{}',
      ).state;

      postOAuthResult(flowId, {
        type: 'failure',
        reason: 'login-request-failed',
      });

      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Error,
          message: ToolsetEditorI18nKeys.ErrorLoginFailed,
        }),
      );
      expect(onAuthChange).not.toHaveBeenCalledWith({ isLoggedIn: true });
      expect(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      ).toBeTruthy();
    });

    it('clears the busy state without a notification when the popup is closed manually', async () => {
      const onAuthChange = vi.fn();
      renderSection(
        oauthWithConfigAuth(),
        'toolsets/b/my__1.0.0',
        onAuthChange,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );

      if (capturedPopup) capturedPopup.closed = true;
      window.dispatchEvent(new Event('focus'));

      await waitFor(
        () =>
          expect(
            (
              screen.getByRole('button', {
                name: ButtonsI18nKeys.LogIn,
              }) as HTMLButtonElement
            ).disabled,
          ).toBe(false),
        { timeout: 2000 },
      );
      expect(onAuthChange).not.toHaveBeenCalled();
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('recovers a login that actually succeeded but was reported as Cancelled by a lost broadcast message', async () => {
      const onAuthChange = vi.fn();
      vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
        id: 'toolsets/b/my__1.0.0',
        toolset: 'toolsets/b/my__1.0.0',
        authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
      } as never);
      renderSection(
        oauthWithConfigAuth(),
        'toolsets/b/my__1.0.0',
        onAuthChange,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );

      if (capturedPopup) capturedPopup.closed = true;
      window.dispatchEvent(new Event('focus'));

      await waitFor(() =>
        expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: true }),
      );
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        message: ToolsetEditorI18nKeys.LoginSuccess,
      });
    });

    it('enables the Log In button before the toolset is saved when the form is valid', () => {
      renderSection(oauthWithConfigAuth(), '', vi.fn());
      const btn = screen.getByRole('button', {
        name: ButtonsI18nKeys.LogIn,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('uses the id returned by onEnsureSaved, not a stale toolsetId prop, for the first login of a brand-new toolset', async () => {
      const onEnsureSaved = vi
        .fn()
        .mockResolvedValue('toolsets/b/newly-created');
      renderSection(
        oauthWithConfigAuth(),
        '',
        vi.fn(),
        VALID_ENDPOINT,
        {},
        onEnsureSaved,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );
      await waitFor(() => expect(capturedPopup).toBeDefined());
      const stored = capturedPopup?.sessionStorage.getItem(
        TOOLSET_REDIRECT_STATE_KEY,
      );
      const state = JSON.parse(stored as string);
      expect(state.toolsetId).toBe('toolsets/b/newly-created');
    });
  });

  describe('API key login', () => {
    it('calls loginToolset and updates isLoggedIn on successful API key login', async () => {
      vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
      const onAuthChange = vi.fn();
      renderSection(apiKeyAuth(), 'toolsets/b/my__1.0.0', onAuthChange);
      await user.click(
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }),
      );
      await waitFor(() =>
        expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: true }),
      );
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.ApiKey,
        }),
      );
    });

    it('shows a success notification on successful API key login', async () => {
      vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
      renderSection(apiKeyAuth());
      await user.click(
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }),
      );
      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Success,
          message: ToolsetEditorI18nKeys.LoginSuccess,
        }),
      );
    });

    it('shows an error notification when login fails', async () => {
      vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(new Error('fail'));
      renderSection(apiKeyAuth());
      await user.click(
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }),
      );
      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Error,
          message: ToolsetEditorI18nKeys.ErrorLoginFailed,
        }),
      );
    });

    it('saves unsaved changes before logging in', async () => {
      vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
      const onEnsureSaved = vi.fn().mockResolvedValue('toolsets/b/my__1.0.0');
      renderSection(
        apiKeyAuth(),
        'toolsets/b/my__1.0.0',
        vi.fn(),
        VALID_ENDPOINT,
        {},
        onEnsureSaved,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );
      await waitFor(() => expect(onEnsureSaved).toHaveBeenCalledOnce());
      expect(toolsetsApi.loginToolset).toHaveBeenCalled();
    });

    it('uses the id returned by onEnsureSaved, not a stale toolsetId prop, for the first login of a brand-new toolset', async () => {
      vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
      const onEnsureSaved = vi
        .fn()
        .mockResolvedValue('toolsets/b/newly-created');
      renderSection(
        apiKeyAuth(),
        '',
        vi.fn(),
        VALID_ENDPOINT,
        {},
        onEnsureSaved,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );
      await waitFor(() =>
        expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
          'toolsets/b/newly-created',
          expect.objectContaining({ url: 'toolsets/b/newly-created' }),
        ),
      );
    });

    it('does not attempt to log in when saving unsaved changes fails', async () => {
      const onEnsureSaved = vi.fn().mockResolvedValue(false);
      renderSection(
        apiKeyAuth(),
        'toolsets/b/my__1.0.0',
        vi.fn(),
        VALID_ENDPOINT,
        {},
        onEnsureSaved,
      );
      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );
      await waitFor(() => expect(onEnsureSaved).toHaveBeenCalledOnce());
      expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    });

    it('disables the Log In button when endpoint is empty', () => {
      renderSection(apiKeyAuth(), 'toolsets/b/my__1.0.0', vi.fn(), '');
      const btn = screen.getByRole('button', {
        name: ButtonsI18nKeys.LogIn,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('disables the Log In button when endpoint is invalid', () => {
      renderSection(apiKeyAuth(), 'toolsets/b/my__1.0.0', vi.fn(), 'not-url');
      const btn = screen.getByRole('button', {
        name: ButtonsI18nKeys.LogIn,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('enables the Log In button before the toolset is saved when the form is valid', () => {
      renderSection(apiKeyAuth(), '', vi.fn(), VALID_ENDPOINT);
      const btn = screen.getByRole('button', {
        name: ButtonsI18nKeys.LogIn,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('disables the Log In button when the key header is empty', () => {
      renderSection(
        { ...apiKeyAuth(), keyHeader: '' },
        'toolsets/b/my__1.0.0',
        vi.fn(),
        VALID_ENDPOINT,
      );
      const btn = screen.getByRole('button', {
        name: ButtonsI18nKeys.LogIn,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('disables the Log In button when the API key is empty', () => {
      renderSection(
        { ...apiKeyAuth(), apiKey: '' },
        'toolsets/b/my__1.0.0',
        vi.fn(),
        VALID_ENDPOINT,
      );
      const btn = screen.getByRole('button', {
        name: ButtonsI18nKeys.LogIn,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  describe('Logout', () => {
    it('calls logoutToolset, shows a success notification, and closes the confirm dialog', async () => {
      vi.mocked(toolsetsApi.logoutToolset).mockResolvedValue({
        success: true,
      });
      const onAuthChange = vi.fn();
      renderSection(
        { ...apiKeyAuth(), isLoggedIn: true },
        'toolsets/b/my__1.0.0',
        onAuthChange,
      );

      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogOut }),
      );
      const dialog = screen.getByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: ButtonsI18nKeys.LogOut }),
      );

      await waitFor(() =>
        expect(toolsetsApi.logoutToolset).toHaveBeenCalledWith(
          'toolsets/b/my__1.0.0',
          expect.objectContaining({ url: 'toolsets/b/my__1.0.0' }),
        ),
      );
      expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: false });
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Success,
        message: ToolsetEditorI18nKeys.LogoutSuccess,
      });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows an error notification when logout fails', async () => {
      vi.mocked(toolsetsApi.logoutToolset).mockRejectedValue(new Error('fail'));
      renderSection({ ...apiKeyAuth(), isLoggedIn: true });

      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogOut }),
      );
      const dialog = screen.getByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: ButtonsI18nKeys.LogOut }),
      );

      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Error,
          message: ToolsetEditorI18nKeys.ErrorLogoutFailed,
        }),
      );
    });

    it('does not call logoutToolset when the confirm dialog is cancelled', async () => {
      renderSection({ ...apiKeyAuth(), isLoggedIn: true });

      await user.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogOut }),
      );
      const dialog = screen.getByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: ButtonsI18nKeys.Cancel }),
      );

      expect(toolsetsApi.logoutToolset).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
