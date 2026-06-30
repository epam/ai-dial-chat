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
  DialAccordion: ({
    title,
    children,
    expanded,
    onToggle,
    disabled,
  }: {
    title: ReactNode;
    children?: ReactNode;
    expanded?: boolean;
    onToggle?: () => void;
    disabled?: boolean;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onToggle?.()}
        disabled={disabled}
        aria-expanded={expanded}
      >
        {title}
      </button>
      {expanded && <div>{children}</div>}
    </div>
  ),
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
  DialSelect: ({
    options,
    value,
    onChange,
    elementId,
    disabled,
  }: {
    options: { value: string; label: string }[];
    value?: string;
    onChange?: (v: string) => void;
    elementId?: string;
    disabled?: boolean;
  }) => (
    <select
      id={elementId}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
  DIAL_ICON_SIZE: { SM: 16 },
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
  keyHeader: '',
  apiKey: '',
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

const renderSection = (
  auth: ToolsetAuthFormData = noneAuth(),
  toolsetId = 'toolsets/b/my__1.0.0',
  onAuthChange = vi.fn(),
) =>
  render(
    <AuthSection
      auth={auth}
      errors={{}}
      isSaving={false}
      toolsetId={toolsetId}
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

  describe('accordion single-select', () => {
    it('calls onAuthChange with ApiKey type when the ApiKey accordion is toggled', async () => {
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

    it('calls onAuthChange with OAuth type when the OAuth accordion is toggled', async () => {
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
      const state = JSON.parse(stored!);
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
  });
});
