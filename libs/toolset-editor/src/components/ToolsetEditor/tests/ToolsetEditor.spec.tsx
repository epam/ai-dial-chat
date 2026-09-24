import type { EntityEditorProps } from '@epam/ai-dial-builder-form';
import { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOLSET_EDITOR_CLASS } from '../../../constants/public-class-names';
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
  /* The real shell renders its actions twice (header + mobile bar); the stub
     renders them once and stamps the section classes it is handed, so class
     assertions still prove what ToolsetEditor passes in. */
  return {
    ...actual,
    EntityEditor: ({
      title,
      onCancel,
      onSubmit,
      submitLabel,
      isSubmitting,
      isSubmitDisabled,
      metadata,
      setup,
      metadataSectionClassName,
      setupSectionClassName,
      labels,
    }: EntityEditorProps) => (
      <div>
        <h1>{title}</h1>
        <button type="button" disabled={isSubmitting} onClick={onCancel}>
          {labels?.cancelLabel ?? 'Cancel'}
        </button>
        <button
          type="button"
          disabled={isSubmitting || isSubmitDisabled}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
        <div className={metadataSectionClassName}>
          <h2>{labels?.metadataTitle}</h2>
          {metadata}
        </div>
        <div className={setupSectionClassName}>
          <h2>{labels?.setupTitle}</h2>
          {setup}
        </div>
      </div>
    ),
  };
});

vi.mock('../../GeneralForm/GeneralForm', () => ({
  GeneralForm: ({
    form,
    errors,
    onChange,
  }: {
    form: ToolsetFormData;
    errors: { name?: string; version?: string };
    onChange: (patch: Partial<ToolsetFormData>) => void;
  }) => (
    <div>
      <span>{`metadata-name-${form.name}`}</span>
      {errors.name && <p role="alert">{errors.name}</p>}
      {errors.version && <p role="alert">{errors.version}</p>}
      <button type="button" onClick={() => onChange({ name: '' })}>
        clear-name
      </button>
      <button type="button" onClick={() => onChange({ name: 'Renamed' })}>
        rename
      </button>
      <button type="button" onClick={() => onChange({ version: 'v 1' })}>
        type-invalid-version
      </button>
    </div>
  ),
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

/* Partial mock: the kit's real exports stay in place for the transitive imports that read them at module load, while the controls under test are replaced by minimal, queryable equivalents. */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
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
  onOAuthLogin: vi.fn(),
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
      'Enter a valid http(s) URL',
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

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own, and querying *by* the class would
 * still pass with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

describe('ToolsetEditor — shared editor shell', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    onPersist.mockResolvedValue(NEW_TOOLSET_ID);
    onPostSaveLogin.mockResolvedValue(undefined);
    onToolsetsChanged.mockResolvedValue(undefined);
  });

  it('renders the Metadata and Setup section headings with the default labels', () => {
    renderEditor();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Metadata' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Setup' }),
    ).toBeTruthy();
  });

  it('uses host-supplied section titles and action labels', () => {
    renderEditor({
      labels: {
        layout: {
          metadataSectionTitle: 'Metadaten',
          setupSectionTitle: 'Einrichtung',
          cancelLabel: 'Abbrechen',
          createLabel: 'Erstellen',
        },
      },
    });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Metadaten' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Einrichtung' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erstellen' })).toBeTruthy();
  });

  it('shows no metadata error until the user edits the field', async () => {
    renderEditor();

    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'clear-name' }));

    expect(screen.getByRole('alert').textContent).toBe('Name is required');
  });

  it('shows the invalid-version error only for the edited version field', async () => {
    renderEditor();

    await user.click(
      screen.getByRole('button', { name: 'type-invalid-version' }),
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toContain('Version may only contain');
  });

  it('clears the metadata error once the field becomes valid again', async () => {
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'clear-name' }));
    expect(screen.getByRole('alert')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'rename' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('metadata-name-Renamed')).toBeTruthy();
  });

  it('persists the edited metadata together with the Setup fields', async () => {
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'rename' }));
    await user.click(
      screen.getByRole('button', { name: 'fill-api-key-toolset' }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onPersist).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Renamed',
          endpoint: 'https://example.com/mcp',
        }),
        '',
      ),
    );
  });

  it('re-seeds the metadata and clears its errors when the host supplies a new initialForm identity', async () => {
    const { rerender } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'clear-name' }));
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(<ToolsetEditor {...makeProps()} />);

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('metadata-name-My toolset')).toBeTruthy();
  });
});

describe('ToolsetEditor — public class names', () => {
  it('stamps both editor columns', () => {
    renderEditor();

    expect(
      closestWithClass(
        screen.getByText('Metadata'),
        TOOLSET_EDITOR_CLASS.metadataSection,
      ),
    ).toBeTruthy();
    expect(
      closestWithClass(
        screen.getByText('Setup'),
        TOOLSET_EDITOR_CLASS.setupSection,
      ),
    ).toBeTruthy();
  });
});
