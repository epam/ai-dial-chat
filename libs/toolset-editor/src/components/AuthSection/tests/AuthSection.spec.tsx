import {
  getToolsetOAuthChannelName,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthCallbackQuery,
  ToolsetOAuthResultType,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthSectionLabels,
  AuthSectionProps,
} from '../../../models/auth-section-props';
import type {
  ToolsetAuthActions,
  ToolsetAuthFormData,
  ToolsetFormErrors,
} from '../../../models/toolset-form';
import { AuthSection } from '../AuthSection';

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

vi.mock('@epam/ai-dial-ui-kit', () => ({
  Input: ({
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
          required={labelProps?.required}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </>
  ),
  TagInput: ({
    labelProps,
    placeholder,
    onChange,
    value,
    disabled,
  }: {
    labelProps?: { label?: string };
    placeholder?: string;
    onChange?: (tags: string[]) => void;
    value?: string[];
    disabled?: boolean;
  }) => (
    <label>
      {labelProps?.label}
      <input
        placeholder={placeholder}
        value={(value ?? []).join(',')}
        disabled={disabled}
        onChange={(e) =>
          onChange?.(e.target.value ? e.target.value.split(',') : [])
        }
      />
    </label>
  ),
  Radio: ({
    id,
    value,
    labelProps,
    isSelected,
    disabled,
    onChange,
  }: {
    name?: string;
    id?: string;
    value?: string;
    labelProps?: { label?: string };
    isSelected?: boolean;
    disabled?: boolean;
    onChange?: (v: string) => void;
  }) => (
    <label htmlFor={id}>
      <input
        id={id}
        type="radio"
        value={value}
        checked={isSelected}
        disabled={disabled}
        onChange={() => onChange?.(value ?? '')}
      />
      {labelProps?.label}
    </label>
  ),
  NeutralButton: ({
    label,
    onClick,
    disabled,
  }: {
    label?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  ConfirmationPopup: ({
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
  SegmentedControl: ({
    items,
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    items?: Array<{
      value: string;
      label?: ReactNode;
      disabled?: boolean;
    }>;
    value?: string;
    onChange?: (v: string) => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <div role="radiogroup" aria-label={ariaLabel}>
      {(items ?? []).map((item) => (
        <button
          key={item.value}
          role="radio"
          aria-checked={item.value === value}
          disabled={item.disabled}
          onClick={() => onChange?.(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20 },
}));

const TOOLSET_ID = 'toolsets/b/my__1.0.0';
const NEW_TOOLSET_ID = 'toolsets/b/newly-created';
const OAUTH_CALLBACK_PATH = '/auth/toolset-signin';
const VALID_ENDPOINT = 'https://example.com/mcp';

const LOGIN_SUCCESS_MESSAGE = 'Successfully logged in.';
const LOGIN_FAILED_MESSAGE =
  'Failed to log in. Please check your credentials and try again.';
const LOGOUT_SUCCESS_MESSAGE = 'Successfully logged out.';
const LOGOUT_FAILED_MESSAGE = 'Failed to log out. Please try again.';
const POPUP_BLOCKED_MESSAGE =
  'The login popup was blocked by your browser. Please allow popups for this site and try again.';

const authActions: ToolsetAuthActions = {
  login: vi.fn(),
  logout: vi.fn(),
  fetchAuthSettings: vi.fn(),
};
const onNotifySuccess = vi.fn();
const onNotifyError = vi.fn();

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

/** OAuth "With Login" with no manually configured client — relies on Core's dynamic client registration. */
const oauthWithLoginDynamicAuth = (): ToolsetAuthFormData => ({
  authenticationType: ToolsetAuthTypes.OAuth,
  withLogin: WithLogin.WithLogin,
  isLoggedIn: false,
});

const renderSection = (props: Partial<AuthSectionProps> = {}) =>
  render(
    <AuthSection
      auth={noneAuth()}
      errors={{}}
      isSaving={false}
      toolsetId={TOOLSET_ID}
      isEditMode
      endpoint={VALID_ENDPOINT}
      authActions={authActions}
      oauthCallbackPath={OAUTH_CALLBACK_PATH}
      onNotifySuccess={onNotifySuccess}
      onNotifyError={onNotifyError}
      onAuthChange={vi.fn()}
      onEnsureSaved={vi.fn().mockResolvedValue(TOOLSET_ID)}
      {...props}
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
  });

  describe('type selection', () => {
    it('calls onAuthChange with ApiKey type when the ApiKey option is clicked', async () => {
      const onAuthChange = vi.fn();
      renderSection({ onAuthChange });
      await user.click(screen.getByRole('radio', { name: 'API Key' }));
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.ApiKey,
        }),
      );
    });

    it('calls onAuthChange with OAuth type when the OAuth option is clicked', async () => {
      const onAuthChange = vi.fn();
      renderSection({ onAuthChange });
      await user.click(screen.getByRole('radio', { name: 'OAuth' }));
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.OAuth,
        }),
      );
    });

    it('disables every non-selected auth-type option while the toolset is logged in, leaving the selected one enabled', () => {
      renderSection({ auth: { ...apiKeyAuth(), isLoggedIn: true } });

      const typeOptions = ['Open access', 'API Key', 'OAuth'].map(
        (name) =>
          screen.getByRole('radio', { name }) as HTMLButtonElement,
      );

      expect(typeOptions.map((option) => option.disabled)).toEqual([
        true,
        false,
        true,
      ]);
    });

    it('marks the active auth type as checked for assistive technology', () => {
      renderSection({ auth: apiKeyAuth() });

      expect(
        screen
          .getByRole('radio', { name: 'API Key' })
          .getAttribute('aria-checked'),
      ).toBe('true');
      expect(
        screen.getByRole('radio', { name: 'OAuth' }).getAttribute('aria-checked'),
      ).toBe('false');
    });

    it('defaults a fresh OAuth selection to WithConfig so config fields are visible immediately', async () => {
      const onAuthChange = vi.fn();
      renderSection({ onAuthChange });
      await user.click(screen.getByRole('radio', { name: 'OAuth' }));
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({ withLogin: WithLogin.WithConfig }),
      );
    });

    it('defaults an OAuth selection to WithLogin when a client is already configured', async () => {
      const onAuthChange = vi.fn();
      renderSection({
        auth: { ...apiKeyAuth(), clientId: 'existing-client' },
        onAuthChange,
      });
      await user.click(screen.getByRole('radio', { name: 'OAuth' }));
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({ withLogin: WithLogin.WithLogin }),
      );
    });
  });

  describe('API Key conditional fields', () => {
    it('renders key header and API key inputs when ApiKey + WithLogin is active', () => {
      renderSection({ auth: apiKeyAuth() });
      expect(
        screen.getByLabelText('API Key parameter name'),
      ).toBeTruthy();
      expect(screen.getByLabelText('API key')).toBeTruthy();
    });

    it('renders only the key header input when ApiKey + WithoutLogin is active', () => {
      renderSection({
        auth: {
          ...apiKeyAuth(),
          withLogin: WithLogin.WithoutLogin,
          apiKey: '',
        },
      });
      expect(
        screen.getByLabelText('API Key parameter name'),
      ).toBeTruthy();

      expect(
        screen.queryByRole('button', { name: 'Log in' }),
      ).toBeNull();
    });

    it('renders WithLogin and WithoutLogin radio buttons for ApiKey', () => {
      renderSection({ auth: apiKeyAuth() });
      expect(screen.getByLabelText('With login')).toBeTruthy();
      expect(screen.getByLabelText('Without login')).toBeTruthy();
    });
  });

  describe('OAuth conditional fields', () => {
    it('renders client ID, client secret, auth endpoint, token endpoint, and scopes when OAuth + WithConfig is active', () => {
      renderSection({ auth: oauthWithConfigAuth() });
      expect(screen.getByLabelText('Client ID')).toBeTruthy();
      expect(screen.getByLabelText('Client secret')).toBeTruthy();
      expect(
        screen.getByLabelText('Authorization endpoint'),
      ).toBeTruthy();
      expect(screen.getByLabelText('Token endpoint')).toBeTruthy();
      expect(screen.getByLabelText('Scopes')).toBeTruthy();
    });

    it('renders Standard login and Custom login radio buttons for OAuth', () => {
      renderSection({ auth: oauthWithConfigAuth() });
      expect(screen.getByLabelText('Standard login')).toBeTruthy();
      expect(screen.getByLabelText('Custom login')).toBeTruthy();
    });

    it('keeps client secret required while creating a new toolset even after a draft is auto-saved', () => {
      renderSection({
        auth: oauthWithConfigAuth(),
        toolsetId: 'toolsets/b/draft-123__1.0.0',
        isEditMode: false,
      });
      expect(
        (
          screen.getByLabelText('Client secret') as HTMLInputElement
        ).required,
      ).toBe(true);
    });

    it('does not require client secret when editing an already-saved toolset', () => {
      renderSection({
        auth: { ...oauthWithConfigAuth(), clientSecret: '' },
      });
      expect(
        (
          screen.getByLabelText('Client secret') as HTMLInputElement
        ).required,
      ).toBe(false);
      expect(
        (
          screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });

    it('renders OAuth endpoint URL validation errors', () => {
      const errors: ToolsetFormErrors = {
        authorizationEndpoint: 'Invalid authorization endpoint',
        tokenEndpoint: 'Invalid token endpoint',
      };
      renderSection({ auth: oauthWithConfigAuth(), errors });

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2);
      expect(alerts[0]?.textContent).toContain(
        'Invalid authorization endpoint',
      );
      expect(alerts[1]?.textContent).toContain('Invalid token endpoint');
    });
  });

  describe('OAuth login redirect', () => {
    it('opens a popup and stores redirect state in it when OAuth Log in is clicked', async () => {
      renderSection({ auth: oauthWithConfigAuth() });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      expect(capturedPopup).toBeDefined();
      const stored = capturedPopup?.sessionStorage.getItem(
        TOOLSET_REDIRECT_STATE_KEY,
      );
      expect(stored).not.toBeNull();
      const state = JSON.parse(stored as string);
      expect(state.toolsetId).toBe(TOOLSET_ID);
      expect(state.credentialsLevel).toBe(ToolsetCredentialsLevel.User);
      expect(capturedPopup?.location.href).toContain(
        'https://auth.example.com/authorize',
      );
    });

    it('does not open a popup when saving unsaved changes fails', async () => {
      const onEnsureSaved = vi.fn().mockResolvedValue(false);
      renderSection({ auth: oauthWithConfigAuth(), onEnsureSaved });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() => expect(onEnsureSaved).toHaveBeenCalledOnce());
      expect(window.open).not.toHaveBeenCalled();
      expect(capturedPopup).toBeUndefined();
    });

    it('does not open a popup when authorizationEndpoint is missing', async () => {
      renderSection({
        auth: { ...oauthWithConfigAuth(), authorizationEndpoint: '' },
      });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      expect(window.open).not.toHaveBeenCalled();
      expect(capturedPopup).toBeUndefined();
    });

    it('shows a popup-blocked error notification when the browser blocks the popup', async () => {
      vi.mocked(window.open).mockReturnValueOnce(null);
      renderSection({ auth: oauthWithConfigAuth() });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() =>
        expect(onNotifyError).toHaveBeenCalledWith(POPUP_BLOCKED_MESSAGE),
      );
    });

    it('flips the action to Log out after a successful OAuth login', async () => {
      const onAuthChange = vi.fn();
      renderSection({ auth: oauthWithConfigAuth(), onAuthChange });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      const flowId = JSON.parse(
        capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
          '{}',
      ).state;

      postOAuthResult(flowId, {
        type: ToolsetOAuthResultType.Success,
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });

      await waitFor(() =>
        expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: true }),
      );
      expect(onNotifySuccess).toHaveBeenCalledWith(LOGIN_SUCCESS_MESSAGE);
    });

    it('shows the success notification on the first attempt when the channel event is missed', async () => {
      const onAuthChange = vi.fn();
      renderSection({ auth: oauthWithConfigAuth(), onAuthChange });
      await user.click(screen.getByRole('button', { name: 'Log in' }));

      const callbackUrl = new URL(
        OAUTH_CALLBACK_PATH,
        window.location.origin,
      );
      callbackUrl.searchParams.set(
        ToolsetOAuthCallbackQuery.Result,
        ToolsetOAuthResultType.Success,
      );
      if (capturedPopup) capturedPopup.location.href = callbackUrl.toString();

      await waitFor(
        () => expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: true }),
        { timeout: 2000 },
      );
      expect(onNotifySuccess).toHaveBeenCalledWith(LOGIN_SUCCESS_MESSAGE);
      expect(authActions.fetchAuthSettings).not.toHaveBeenCalled();
    });

    it('keeps Log in available and shows an error notification after a failed OAuth login', async () => {
      const onAuthChange = vi.fn();
      renderSection({ auth: oauthWithConfigAuth(), onAuthChange });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      const flowId = JSON.parse(
        capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
          '{}',
      ).state;

      postOAuthResult(flowId, {
        type: 'failure',
        reason: 'login-request-failed',
      });

      await waitFor(() =>
        expect(onNotifyError).toHaveBeenCalledWith(LOGIN_FAILED_MESSAGE),
      );
      expect(onAuthChange).not.toHaveBeenCalledWith({ isLoggedIn: true });
      expect(
        screen.getByRole('button', { name: 'Log in' }),
      ).toBeTruthy();
    });

    it('clears the busy state without a notification when the popup is closed manually', async () => {
      const onAuthChange = vi.fn();
      renderSection({ auth: oauthWithConfigAuth(), onAuthChange });
      await user.click(screen.getByRole('button', { name: 'Log in' }));

      if (capturedPopup) capturedPopup.closed = true;
      window.dispatchEvent(new Event('focus'));

      await waitFor(
        () =>
          expect(
            (
              screen.getByRole('button', {
                name: 'Log in',
              }) as HTMLButtonElement
            ).disabled,
          ).toBe(false),
        { timeout: 2000 },
      );
      expect(onAuthChange).not.toHaveBeenCalled();
      expect(onNotifySuccess).not.toHaveBeenCalled();
      expect(onNotifyError).not.toHaveBeenCalled();
    });

    it('recovers a login that actually succeeded but was reported as Cancelled by a lost broadcast message', async () => {
      const onAuthChange = vi.fn();
      authActions.fetchAuthSettings.mockResolvedValue({
        ...oauthWithConfigAuth(),
        isLoggedIn: true,
      });
      renderSection({ auth: oauthWithConfigAuth(), onAuthChange });
      await user.click(screen.getByRole('button', { name: 'Log in' }));

      if (capturedPopup) capturedPopup.closed = true;
      window.dispatchEvent(new Event('focus'));

      await waitFor(() =>
        expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: true }),
      );
      expect(onNotifySuccess).toHaveBeenCalledWith(LOGIN_SUCCESS_MESSAGE);
    });

    it('enables the Log In button before the toolset is saved when the form is valid', () => {
      renderSection({
        auth: oauthWithConfigAuth(),
        toolsetId: '',
        isEditMode: false,
      });
      const btn = screen.getByRole('button', {
        name: 'Log in',
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('uses the id returned by onEnsureSaved, not a stale toolsetId prop, for the first login of a brand-new toolset', async () => {
      const onEnsureSaved = vi.fn().mockResolvedValue(NEW_TOOLSET_ID);
      renderSection({
        auth: oauthWithConfigAuth(),
        toolsetId: '',
        isEditMode: false,
        onEnsureSaved,
      });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() => expect(capturedPopup).toBeDefined());
      const stored = capturedPopup?.sessionStorage.getItem(
        TOOLSET_REDIRECT_STATE_KEY,
      );
      const state = JSON.parse(stored as string);
      expect(state.toolsetId).toBe(NEW_TOOLSET_ID);
    });
  });

  describe('OAuth dynamic client registration login', () => {
    it('opens the popup synchronously, before the persist call resolves, then completes the login for a brand-new dynamically-registered toolset', async () => {
      let resolveEnsureSaved: (value: string | false) => void = () => {
        /* assigned before use */
      };
      const onEnsureSaved = vi.fn(
        () =>
          new Promise<string | false>((resolve) => {
            resolveEnsureSaved = resolve;
          }),
      );
      const onAuthChange = vi.fn();
      authActions.fetchAuthSettings.mockResolvedValue({
        ...oauthWithLoginDynamicAuth(),
        clientId: 'dcr-client-id',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      });
      renderSection({
        auth: oauthWithLoginDynamicAuth(),
        toolsetId: '',
        isEditMode: false,
        onAuthChange,
        onEnsureSaved,
      });

      await user.click(screen.getByRole('button', { name: 'Log in' }));

      // Popup opens immediately, before the persist call resolves.
      expect(capturedPopup).toBeDefined();
      expect(authActions.fetchAuthSettings).not.toHaveBeenCalled();
      expect(capturedPopup?.location.href).toBe('');

      resolveEnsureSaved(NEW_TOOLSET_ID);

      // The popup is then navigated to the authorize URL built from the
      // fetched Core-issued client — the happy path this timing enables.
      await waitFor(() =>
        expect(capturedPopup?.location.href).toContain(
          'https://auth.example.com/authorize',
        ),
      );
      expect(authActions.fetchAuthSettings).toHaveBeenCalledWith(
        NEW_TOOLSET_ID,
      );
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'dcr-client-id' }),
      );
    });

    it('fetches the Core-issued client and navigates the popup to the authorize URL built from it', async () => {
      const onEnsureSaved = vi.fn().mockResolvedValue(NEW_TOOLSET_ID);
      const onAuthChange = vi.fn();
      authActions.fetchAuthSettings.mockResolvedValue({
        ...oauthWithLoginDynamicAuth(),
        clientId: 'dcr-client-id',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      });
      renderSection({
        auth: oauthWithLoginDynamicAuth(),
        toolsetId: '',
        isEditMode: false,
        onAuthChange,
        onEnsureSaved,
      });

      await user.click(screen.getByRole('button', { name: 'Log in' }));

      await waitFor(() =>
        expect(capturedPopup?.location.href).toContain(
          'https://auth.example.com/authorize',
        ),
      );
      expect(capturedPopup?.location.href).toContain('client_id=dcr-client-id');
      expect(onAuthChange).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'dcr-client-id' }),
      );
    });

    it('shows a popup-blocked error and never persists the toolset when the popup is blocked', async () => {
      vi.mocked(window.open).mockReturnValueOnce(null);
      const onEnsureSaved = vi.fn();
      renderSection({
        auth: oauthWithLoginDynamicAuth(),
        toolsetId: '',
        isEditMode: false,
        onEnsureSaved,
      });

      await user.click(screen.getByRole('button', { name: 'Log in' }));

      await waitFor(() =>
        expect(onNotifyError).toHaveBeenCalledWith(POPUP_BLOCKED_MESSAGE),
      );
      expect(onEnsureSaved).not.toHaveBeenCalled();
      expect(authActions.fetchAuthSettings).not.toHaveBeenCalled();
    });

    it('shows an error and closes the popup when persisting the new toolset fails', async () => {
      const onEnsureSaved = vi.fn().mockResolvedValue(false);
      renderSection({
        auth: oauthWithLoginDynamicAuth(),
        toolsetId: '',
        isEditMode: false,
        onEnsureSaved,
      });

      await user.click(screen.getByRole('button', { name: 'Log in' }));

      await waitFor(() => expect(capturedPopup?.close).toHaveBeenCalled());
      expect(authActions.fetchAuthSettings).not.toHaveBeenCalled();
    });

    it('skips the extra fetch and reuses the already-known client for "With Login & Config"', async () => {
      renderSection({ auth: oauthWithConfigAuth() });

      await user.click(screen.getByRole('button', { name: 'Log in' }));

      await waitFor(() => expect(capturedPopup).toBeDefined());
      expect(authActions.fetchAuthSettings).not.toHaveBeenCalled();
      expect(capturedPopup?.location.href).toContain(
        'https://auth.example.com/authorize',
      );
    });

    it('skips the extra fetch and reuses the already-known client when re-logging in on an already-saved OAuth toolset', async () => {
      renderSection({
        auth: { ...oauthWithConfigAuth(), withLogin: WithLogin.WithLogin },
      });

      await user.click(screen.getByRole('button', { name: 'Log in' }));

      await waitFor(() => expect(capturedPopup).toBeDefined());
      expect(authActions.fetchAuthSettings).not.toHaveBeenCalled();
      expect(capturedPopup?.location.href).toContain(
        'https://auth.example.com/authorize',
      );
    });
  });

  describe('API key login', () => {
    it('calls login and updates isLoggedIn on successful API key login', async () => {
      authActions.login.mockResolvedValue(undefined);
      const onAuthChange = vi.fn();
      renderSection({ auth: apiKeyAuth(), onAuthChange });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() =>
        expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: true }),
      );
      expect(authActions.login).toHaveBeenCalledWith(
        TOOLSET_ID,
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.ApiKey,
        }),
      );
    });

    it('shows a success notification on successful API key login', async () => {
      authActions.login.mockResolvedValue(undefined);
      renderSection({ auth: apiKeyAuth() });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() =>
        expect(onNotifySuccess).toHaveBeenCalledWith(LOGIN_SUCCESS_MESSAGE),
      );
    });

    it('shows an error notification when login fails', async () => {
      authActions.login.mockRejectedValue(new Error('fail'));
      renderSection({ auth: apiKeyAuth() });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() =>
        expect(onNotifyError).toHaveBeenCalledWith(
          LOGIN_FAILED_MESSAGE,
          undefined,
        ),
      );
    });

    it('saves unsaved changes before logging in', async () => {
      authActions.login.mockResolvedValue(undefined);
      const onEnsureSaved = vi.fn().mockResolvedValue(TOOLSET_ID);
      renderSection({ auth: apiKeyAuth(), onEnsureSaved });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() => expect(onEnsureSaved).toHaveBeenCalledOnce());
      expect(authActions.login).toHaveBeenCalled();
    });

    it('uses the id returned by onEnsureSaved, not a stale toolsetId prop, for the first login of a brand-new toolset', async () => {
      authActions.login.mockResolvedValue(undefined);
      const onEnsureSaved = vi.fn().mockResolvedValue(NEW_TOOLSET_ID);
      renderSection({
        auth: apiKeyAuth(),
        toolsetId: '',
        isEditMode: false,
        onEnsureSaved,
      });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() =>
        expect(authActions.login).toHaveBeenCalledWith(
          NEW_TOOLSET_ID,
          expect.objectContaining({ url: NEW_TOOLSET_ID }),
        ),
      );
    });

    it('does not attempt to log in when saving unsaved changes fails', async () => {
      const onEnsureSaved = vi.fn().mockResolvedValue(false);
      renderSection({ auth: apiKeyAuth(), onEnsureSaved });
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      await waitFor(() => expect(onEnsureSaved).toHaveBeenCalledOnce());
      expect(authActions.login).not.toHaveBeenCalled();
    });

    it('disables the Log In button when endpoint is empty', () => {
      renderSection({ auth: apiKeyAuth(), endpoint: '' });
      const btn = screen.getByRole('button', {
        name: 'Log in',
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('disables the Log In button when endpoint is invalid', () => {
      renderSection({ auth: apiKeyAuth(), endpoint: 'not-url' });
      const btn = screen.getByRole('button', {
        name: 'Log in',
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('enables the Log In button before the toolset is saved when the form is valid', () => {
      renderSection({
        auth: apiKeyAuth(),
        toolsetId: '',
        isEditMode: false,
      });
      const btn = screen.getByRole('button', {
        name: 'Log in',
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('disables the Log In button when the key header is empty', () => {
      renderSection({ auth: { ...apiKeyAuth(), keyHeader: '' } });
      const btn = screen.getByRole('button', {
        name: 'Log in',
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('disables the Log In button when the API key is empty', () => {
      renderSection({ auth: { ...apiKeyAuth(), apiKey: '' } });
      const btn = screen.getByRole('button', {
        name: 'Log in',
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  describe('Logout', () => {
    it('calls logout, shows a success notification, and closes the confirm dialog', async () => {
      authActions.logout.mockResolvedValue(undefined);
      const onAuthChange = vi.fn();
      renderSection({
        auth: { ...apiKeyAuth(), isLoggedIn: true },
        onAuthChange,
      });

      await user.click(screen.getByRole('button', { name: 'Log out' }));
      const dialog = screen.getByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Log out' }),
      );

      await waitFor(() =>
        expect(authActions.logout).toHaveBeenCalledWith(
          TOOLSET_ID,
          expect.objectContaining({ url: TOOLSET_ID }),
        ),
      );
      expect(onAuthChange).toHaveBeenCalledWith({ isLoggedIn: false });
      expect(onNotifySuccess).toHaveBeenCalledWith(LOGOUT_SUCCESS_MESSAGE);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows an error notification when logout fails', async () => {
      authActions.logout.mockRejectedValue(new Error('fail'));
      renderSection({ auth: { ...apiKeyAuth(), isLoggedIn: true } });

      await user.click(screen.getByRole('button', { name: 'Log out' }));
      const dialog = screen.getByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Log out' }),
      );

      await waitFor(() =>
        expect(onNotifyError).toHaveBeenCalledWith(
          LOGOUT_FAILED_MESSAGE,
          undefined,
        ),
      );
    });

    it('does not call logout when the confirm dialog is cancelled', async () => {
      renderSection({ auth: { ...apiKeyAuth(), isLoggedIn: true } });

      await user.click(screen.getByRole('button', { name: 'Log out' }));
      const dialog = screen.getByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Cancel' }),
      );

      expect(authActions.logout).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('labels', () => {
    it('renders host-supplied labels instead of the English defaults', () => {
      const labels: AuthSectionLabels = {
        sectionTitle: 'Authentication (custom)',
        typeApiKey: 'Key auth',
        typeOAuth: 'OAuth (custom)',
        typeNone: 'Open access (custom)',
      };
      renderSection({ auth: apiKeyAuth(), labels });
      expect(screen.getByText('Authentication (custom)')).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Key auth' })).toBeTruthy();
    });
  });
});
