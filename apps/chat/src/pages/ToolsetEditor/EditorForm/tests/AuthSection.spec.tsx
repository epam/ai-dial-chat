import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOLSET_REDIRECT_STATE_KEY } from '../../../../constants/toolsets';
import { ToolsetEditorI18nKeys } from '../../../../constants/translation-keys';
import * as toolsetsApi from '../../../../server-api/toolsets';
import type { ToolsetAuthFormData } from '../../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  WithLogin,
} from '../../../../types/toolsets';
import AuthSection from '../AuthSection';

vi.mock('../../../../server-api/toolsets', () => ({
  loginToolset: vi.fn(),
  logoutToolset: vi.fn(),
}));

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
  DialNotification: ({ message }: { message?: string }) => (
    <p role="alert">{message}</p>
  ),
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
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'http://localhost', href: 'http://localhost/' },
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
    it('stores redirect state in sessionStorage when OAuth Log in is clicked', async () => {
      renderSection(oauthWithConfigAuth());
      await user.click(
        screen.getByRole('button', {
          name: ToolsetEditorI18nKeys.LogInButton,
        }),
      );
      const stored = sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY);
      expect(stored).not.toBeNull();
      const state = JSON.parse(stored as string);
      expect(state.toolsetId).toBe('toolsets/b/my__1.0.0');
      expect(state.credentialsLevel).toBe(ToolsetCredentialsLevel.User);
    });

    it('does not store sessionStorage state when authorizationEndpoint is missing', async () => {
      renderSection({
        ...oauthWithConfigAuth(),
        authorizationEndpoint: '',
      });
      await user.click(
        screen.getByRole('button', {
          name: ToolsetEditorI18nKeys.LogInButton,
        }),
      );
      expect(sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY)).toBeNull();
    });

    it('disables the Log In button before the toolset is saved', () => {
      renderSection(oauthWithConfigAuth(), '', vi.fn());
      const btn = screen.getByRole('button', {
        name: ToolsetEditorI18nKeys.LogInButton,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
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
        expect(screen.getByRole('alert').textContent).toContain(
          ToolsetEditorI18nKeys.ErrorLoginFailed,
        ),
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
