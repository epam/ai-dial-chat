import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolsetEditorI18nKeys } from '../../../../constants/translation-keys';
import { useNotification } from '../../../../context/NotificationContext';
import * as toolsetsApi from '../../../../server-api/toolsets';
import type { ToolsetAuthFormData } from '../../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  WithLogin,
} from '../../../../types/toolsets';
import { decodeToolsetRedirectState } from '../../../../utils/toolsets';
import AuthSection from '../AuthSection';

vi.mock('../../../../server-api/toolsets', () => ({
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
  NotificationVariant: { Error: 'error' },
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
) =>
  render(
    <AuthSection
      auth={auth}
      errors={{}}
      isSaving={false}
      toolsetId={toolsetId}
      endpoint={endpoint}
      onAuthChange={onAuthChange}
    />,
  );

describe('AuthSection', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'http://localhost', href: 'http://localhost/' },
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
  });

  describe('API Key conditional fields', () => {
    it('renders key header and API key inputs when ApiKey + WithLogin is active', () => {
      renderSection(apiKeyAuth());
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.KeyHeaderLabel),
      ).toBeTruthy();
      expect(
        screen.getByLabelText(ToolsetEditorI18nKeys.ApiKeyLabel),
      ).toBeTruthy();
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
  });

  describe('OAuth login redirect', () => {
    it('encodes the redirect state into the state param and opens the authorize URL', async () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      renderSection(oauthWithConfigAuth());
      await user.click(
        screen.getByRole('button', {
          name: ToolsetEditorI18nKeys.LogInButton,
        }),
      );
      expect(openSpy).toHaveBeenCalledOnce();
      const [url] = openSpy.mock.calls[0] as [string, string, string];
      const state = new URL(url).searchParams.get('state') as string;
      expect(decodeToolsetRedirectState(state)).toMatchObject({
        toolsetId: 'toolsets/b/my__1.0.0',
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
    });

    it('does not open a window when authorizationEndpoint is missing', async () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      renderSection({
        ...oauthWithConfigAuth(),
        authorizationEndpoint: '',
      });
      await user.click(
        screen.getByRole('button', {
          name: ToolsetEditorI18nKeys.LogInButton,
        }),
      );
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('enables the Log In button before the toolset is saved when the form is valid', () => {
      renderSection(oauthWithConfigAuth(), '', vi.fn());
      const btn = screen.getByRole('button', {
        name: ToolsetEditorI18nKeys.LogInButton,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });

  describe('API key login', () => {
    it('calls loginToolset and updates isLoggedIn on successful API key login', async () => {
      vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
      const onAuthChange = vi.fn();
      renderSection(apiKeyAuth(), 'toolsets/b/my__1.0.0', onAuthChange);
      await user.click(
        screen.getByRole('button', {
          name: ToolsetEditorI18nKeys.LogInButton,
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

    it('shows an error notification when login fails', async () => {
      vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(new Error('fail'));
      renderSection(apiKeyAuth());
      await user.click(
        screen.getByRole('button', {
          name: ToolsetEditorI18nKeys.LogInButton,
        }),
      );
      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Error,
          message: ToolsetEditorI18nKeys.ErrorLoginFailed,
        }),
      );
    });

    it('disables the Log In button when endpoint is empty', () => {
      renderSection(apiKeyAuth(), 'toolsets/b/my__1.0.0', vi.fn(), '');
      const btn = screen.getByRole('button', {
        name: ToolsetEditorI18nKeys.LogInButton,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('disables the Log In button when endpoint is invalid', () => {
      renderSection(apiKeyAuth(), 'toolsets/b/my__1.0.0', vi.fn(), 'not-url');
      const btn = screen.getByRole('button', {
        name: ToolsetEditorI18nKeys.LogInButton,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('enables the Log In button before the toolset is saved when the form is valid', () => {
      renderSection(apiKeyAuth(), '', vi.fn(), VALID_ENDPOINT);
      const btn = screen.getByRole('button', {
        name: ToolsetEditorI18nKeys.LogInButton,
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
        name: ToolsetEditorI18nKeys.LogInButton,
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
        name: ToolsetEditorI18nKeys.LogInButton,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });
});
