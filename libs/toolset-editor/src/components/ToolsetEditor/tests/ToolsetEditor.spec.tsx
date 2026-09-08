import { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolsetTransportType } from '../../../constants/toolsets';
import type { ToolsetEditorProps } from '../../../models/toolset-editor-props';
import type {
  ToolsetAuthActions,
  ToolsetAuthFormData,
  ToolsetFormData,
} from '../../../models/toolset-form';
import { ToolsetEditor } from '../ToolsetEditor';

vi.mock('@epam/ai-dial-builder-form', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-builder-form')>();
  return {
    ...actual,
    EditorLayout: ({
      title,
      actions,
      leftContent,
      rightContent,
    }: {
      title?: string;
      actions?: unknown;
      leftContent?: unknown;
      rightContent?: unknown;
    }) => (
      <div>
        <h1>{title}</h1>
        <div>{actions as never}</div>
        <div>{leftContent as never}</div>
        <div>{rightContent as never}</div>
      </div>
    ),
    EditorSection: ({ children }: { children?: unknown }) => (
      <div>{children as never}</div>
    ),
  };
});

vi.mock('../../GeneralForm/GeneralForm', () => ({
  GeneralForm: () => <div />,
}));

vi.mock('../../SettingsForm/SettingsForm', () => ({
  SettingsForm: ({
    errors,
    onChange,
    onAuthChange,
    onEnsureSaved,
  }: {
    form?: ToolsetFormData;
    errors?: {
      endpoint?: string;
      authorizationEndpoint?: string;
      tokenEndpoint?: string;
    };
    isSaving?: boolean;
    toolsetId?: string;
    isEditMode?: boolean;
    onChange: (patch: Partial<ToolsetFormData>) => void;
    onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
    onEnsureSaved: () => Promise<string | false>;
  }) => {
    const [ensureSavedResult, setEnsureSavedResult] = useState<string | null>(
      null,
    );
    return (
      <div>
        <button
          type="button"
          onClick={async () => {
            const result = await onEnsureSaved();
            setEnsureSavedResult(result === false ? 'false' : result);
          }}
        >
          invoke-ensure-saved
        </button>
        {ensureSavedResult != null && (
          <span>{`ensure-saved-result-${ensureSavedResult}`}</span>
        )}
        {errors?.endpoint && <p role="alert">{errors.endpoint}</p>}
        {errors?.authorizationEndpoint && (
          <p role="alert">{errors.authorizationEndpoint}</p>
        )}
        {errors?.tokenEndpoint && <p role="alert">{errors.tokenEndpoint}</p>}
        <button type="button" onClick={() => onChange({ endpoint: '' })}>
          touch-empty-endpoint
        </button>
        <button
          type="button"
          onClick={() => {
            onChange({ endpoint: 'https://example.com/mcp' });
            onAuthChange({
              authenticationType: ToolsetAuthTypes.ApiKey,
              withLogin: WithLogin.WithLogin,
              keyHeader: 'X-API-Key',
              apiKey: 'secret',
            });
          }}
        >
          fill-api-key-toolset
        </button>
        <button
          type="button"
          onClick={() => {
            onChange({ endpoint: 'https://example.com/mcp' });
            onAuthChange({
              authenticationType: ToolsetAuthTypes.ApiKey,
              withLogin: WithLogin.WithoutLogin,
              keyHeader: 'X-API-Key',
              apiKey: '',
            });
          }}
        >
          fill-api-key-without-login-toolset
        </button>
        <button
          type="button"
          onClick={() => {
            onChange({ endpoint: 'https://example.com/mcp' });
            onAuthChange({
              authenticationType: ToolsetAuthTypes.OAuth,
              withLogin: WithLogin.WithConfig,
              clientId: 'client-id',
              clientSecret: 'client-secret',
              authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
              tokenEndpoint: 'https://auth.example.com/oauth/token',
            });
          }}
        >
          fill-oauth-toolset
        </button>
        <button
          type="button"
          onClick={() => {
            onChange({ endpoint: 'https://example.com/mcp' });
            onAuthChange({
              authenticationType: ToolsetAuthTypes.OAuth,
              withLogin: WithLogin.WithLogin,
            });
          }}
        >
          fill-oauth-with-login-toolset
        </button>
        <button
          type="button"
          onClick={() => {
            onChange({ endpoint: 'https://example.com/mcp' });
            onAuthChange({
              authenticationType: ToolsetAuthTypes.OAuth,
              withLogin: WithLogin.WithConfig,
              clientId: 'client-id',
              clientSecret: 'client-secret',
            });
          }}
        >
          fill-oauth-toolset-without-endpoints
        </button>
        <button
          type="button"
          onClick={() => {
            onChange({ endpoint: 'https://example.com/mcp' });
            onAuthChange({
              authenticationType: ToolsetAuthTypes.OAuth,
              withLogin: WithLogin.WithConfig,
              clientId: 'client-id',
              clientSecret: 'client-secret',
              authorizationEndpoint: 'not a url',
              tokenEndpoint: 'https://auth.example.com/oauth/token',
            });
          }}
        >
          fill-invalid-oauth-toolset
        </button>
        <button
          type="button"
          onClick={() => onAuthChange({ isLoggedIn: true })}
        >
          report-login-success
        </button>
        <button
          type="button"
          onClick={() => onAuthChange({ isLoggedIn: false })}
        >
          report-logout-success
        </button>
      </div>
    );
  },
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  NeutralButton: ({
    label,
    onClick,
    disabled,
  }: {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  PrimaryButton: ({
    label,
    onClick,
    disabled,
  }: {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
}));

const NEW_TOOLSET_ID = 'toolsets/b/my__0.0.1';
const EDIT_TOOLSET_ID = 'toolsets/b/my__1.0.0';

const onPersist = vi.fn();
const onPostSaveLogin = vi.fn();
const onToolsetsChanged = vi.fn();
const onSaveSuccess = vi.fn();
const onSaveComplete = vi.fn();
const onBack = vi.fn();
const onNotifySuccess = vi.fn();
const onNotifyError = vi.fn();

const authActions: ToolsetAuthActions = {
  login: vi.fn(),
  logout: vi.fn(),
  fetchAuthSettings: vi.fn(),
};

const makeForm = (overrides?: Partial<ToolsetFormData>): ToolsetFormData => ({
  name: 'My toolset',
  version: '1.0.0',
  iconUrl: '',
  description: '',
  topics: [],
  otherLocales: [],
  endpoint: '',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: {
    authenticationType: ToolsetAuthTypes.None,
    withLogin: WithLogin.WithoutLogin,
    isLoggedIn: false,
  },
  ...overrides,
});

const makeProps = (
  props: Partial<ToolsetEditorProps> = {},
): ToolsetEditorProps => ({
  initialForm: makeForm(),
  toolsetId: '',
  onPersist,
  onPostSaveLogin,
  onToolsetsChanged,
  onSaveSuccess,
  onSaveComplete,
  onBack,
  authActions,
  oauthCallbackPath: '/auth/toolset-signin',
  onNotifySuccess,
  onNotifyError,
  bucket: 'bucket',
  FileManagerModal: () => null,
  resolveIconUrl: (url) => url,
  allowedMimeTypes: ['image/png'],
  maxFileSizeBytes: 1024,
  availableLocaleOptions: [],
  ...props,
});

const renderEditor = (props: Partial<ToolsetEditorProps> = {}) =>
  render(<ToolsetEditor {...makeProps(props)} />);

describe('ToolsetEditor', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    onPersist.mockResolvedValue(NEW_TOOLSET_ID);
    onPostSaveLogin.mockResolvedValue(undefined);
    onToolsetsChanged.mockResolvedValue(undefined);
  });

  it('renders the create title and actions with the default labels', () => {
    renderEditor();
    expect(screen.getByText('Create toolset')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('renders the edit title and Save action when a toolsetId is provided', () => {
    renderEditor({ toolsetId: EDIT_TOOLSET_ID });
    expect(screen.getByText('Edit toolset')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('calls onBack when Cancel is clicked', async () => {
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables the create action until required Settings fields are valid', async () => {
    renderEditor();

    const saveButton = (await screen.findByRole('button', {
      name: 'Create',
    })) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);
    await user.click(saveButton);
    expect(onPersist).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );

    await waitFor(() => expect(saveButton.disabled).toBe(false));
    expect(onPersist).not.toHaveBeenCalled();
  });

  it('shows validation errors after an invalid field becomes dirty', async () => {
    renderEditor();

    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(
      screen.getByRole('button', {
        name: 'touch-empty-endpoint',
      }),
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'Endpoint is required',
    );
  });

  it('keeps the create action disabled when OAuth endpoint URLs are invalid', async () => {
    renderEditor();

    const saveButton = (await screen.findByRole('button', {
      name: 'Create',
    })) as HTMLButtonElement;

    await user.click(
      screen.getByRole('button', {
        name: 'fill-invalid-oauth-toolset',
      }),
    );

    expect(saveButton.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain(
      'Enter a valid http(s) or sse URL',
    );

    await user.click(
      screen.getByRole('button', {
        name: 'fill-oauth-toolset',
      }),
    );

    await waitFor(() => expect(saveButton.disabled).toBe(false));
  });

  it('enables the create action for configured OAuth without authorization/token endpoints', async () => {
    renderEditor();

    const saveButton = (await screen.findByRole('button', {
      name: 'Create',
    })) as HTMLButtonElement;

    await user.click(
      screen.getByRole('button', {
        name: 'fill-oauth-toolset-without-endpoints',
      }),
    );

    await waitFor(() => expect(saveButton.disabled).toBe(false));
  });

  it('runs the post-save login for a newly created API-key toolset using the returned id', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onPostSaveLogin).toHaveBeenCalledWith(
        NEW_TOOLSET_ID,
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.ApiKey,
          apiKey: 'secret',
        }),
      ),
    );
  });

  it('resolves onEnsureSaved to the freshly created toolset id for a brand-new toolset', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'invoke-ensure-saved' }),
    );

    expect(
      await screen.findByText(`ensure-saved-result-${NEW_TOOLSET_ID}`),
    ).toBeTruthy();
    expect(onPersist).toHaveBeenCalledOnce();
    /* Persisting through Log In does not report a save success. */
    expect(onSaveSuccess).not.toHaveBeenCalled();
  });

  it('resolves onEnsureSaved to the already-persisted id without another request when nothing changed', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'invoke-ensure-saved' }),
    );
    await screen.findByText(`ensure-saved-result-${NEW_TOOLSET_ID}`);

    await user.click(
      screen.getByRole('button', { name: 'invoke-ensure-saved' }),
    );

    await waitFor(() => expect(onPersist).toHaveBeenCalledOnce());
    expect(
      screen.getByText(`ensure-saved-result-${NEW_TOOLSET_ID}`),
    ).toBeTruthy();
  });

  it('persists an API-key toolset without login through onPersist and reports the save success', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-without-login-toolset',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onPersist).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            authenticationType: ToolsetAuthTypes.ApiKey,
            keyHeader: 'X-API-Key',
          }),
        }),
        '',
      ),
    );
    expect(onSaveSuccess).toHaveBeenCalledOnce();
  });

  it('signals save completion and starts the post-save login after saving a new OAuth toolset', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-oauth-toolset',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onPostSaveLogin).toHaveBeenCalledWith(
        NEW_TOOLSET_ID,
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.OAuth,
          withLogin: WithLogin.WithConfig,
        }),
      ),
    );
    expect(onSaveComplete).toHaveBeenCalledOnce();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('reports the failure through the post-save login error label and does not complete the save when the post-save login rejects', async () => {
    onPostSaveLogin.mockRejectedValue(new Error('fail'));
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onNotifyError).toHaveBeenCalledWith(
        'Failed to log in. Please check your credentials and try again.',
        undefined,
      ),
    );
    expect(onSaveComplete).not.toHaveBeenCalled();
    expect(onSaveSuccess).toHaveBeenCalledOnce();
  });

  it('leaves the failure notification to the host when persisting resolves without an id', async () => {
    onPersist.mockResolvedValue(null);
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(onPersist).toHaveBeenCalledOnce());
    expect(onSaveSuccess).not.toHaveBeenCalled();
    expect(onSaveComplete).not.toHaveBeenCalled();
    expect(onToolsetsChanged).not.toHaveBeenCalled();
    expect(onNotifyError).not.toHaveBeenCalled();
  });

  it('re-seeds the form state when the host supplies a new initialForm identity', async () => {
    const { rerender } = renderEditor();

    await user.click(
      screen.getByRole('button', { name: 'touch-empty-endpoint' }),
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(<ToolsetEditor {...makeProps()} />);

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('calls onToolsetsChanged after a successful create so the host list stays in sync', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(onToolsetsChanged).toHaveBeenCalledOnce());
  });

  it('calls onToolsetsChanged after the auth section reports a successful login', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'report-login-success',
      }),
    );

    await waitFor(() => expect(onToolsetsChanged).toHaveBeenCalledOnce());
  });

  it('calls onToolsetsChanged after the auth section reports a successful logout', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'report-logout-success',
      }),
    );

    await waitFor(() => expect(onToolsetsChanged).toHaveBeenCalledOnce());
  });
});
