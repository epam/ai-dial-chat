import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
} from '../../../models/toolsets';
import * as toolsetsApi from '../../../server-api/toolsets';
import { ROUTES } from '../../../types/routes';
import ToolsetEditor from '../ToolsetEditor';

vi.mock('../../../server-api/toolsets', () => ({
  createToolset: vi.fn(),
  getToolset: vi.fn(),
  listToolsets: vi.fn(),
  loginToolset: vi.fn(),
  updateToolset: vi.fn(),
}));

vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/DeploymentsContext');

const mockShowNotification = vi.fn();
const mockRefetchToolsets = vi.fn();

vi.mock('../../../components/RouteFallback/RouteFallback', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('@epam/ai-dial-editor-builder', () => ({
  EditorLayout: ({
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
      <div>{actions as never}</div>
      <div>{leftContent as never}</div>
      <div>{rightContent as never}</div>
    </div>
  ),
  EditorSection: ({ children }: { children?: unknown }) => (
    <div>{children as never}</div>
  ),
}));

vi.mock('../EditorForm/GeneralForm', () => ({
  default: () => <div />,
}));

vi.mock('../EditorForm/SettingsForm', () => ({
  default: ({
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

const renderEditor = (initialEntry: string = ROUTES.ToolsetEditor) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={ROUTES.ToolsetEditor} element={<ToolsetEditor />} />
        <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
        <Route path="/previous" element={<div>Previous screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ToolsetEditor', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(toolsetsApi.listToolsets).mockResolvedValue({ data: [] });
    vi.mocked(toolsetsApi.createToolset).mockResolvedValue({
      id: 'toolsets/b/my__0.0.1',
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    mockRefetchToolsets.mockResolvedValue(undefined);
    vi.mocked(useDeployments).mockReturnValue({
      refetchToolsets: mockRefetchToolsets,
    } as unknown as ReturnType<typeof useDeployments>);
  });

  it('disables Save & Exit until required Settings fields are valid', async () => {
    renderEditor();

    const saveButton = await screen.findByRole('button', {
      name: ButtonsI18nKeys.Create,
    });

    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(saveButton);
    expect(toolsetsApi.createToolset).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );

    await waitFor(() =>
      expect((saveButton as HTMLButtonElement).disabled).toBe(false),
    );
    expect(toolsetsApi.createToolset).not.toHaveBeenCalled();
  });

  it('shows validation errors after an invalid field becomes dirty', async () => {
    renderEditor();

    await screen.findByRole('button', {
      name: ButtonsI18nKeys.Create,
    });

    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(
      screen.getByRole('button', {
        name: 'touch-empty-endpoint',
      }),
    );

    expect(screen.getByRole('alert').textContent).toContain(
      ToolsetEditorI18nKeys.EndpointRequired,
    );
  });

  it('keeps Save & Exit disabled when OAuth endpoint URLs are invalid', async () => {
    renderEditor();

    const saveButton = await screen.findByRole('button', {
      name: ButtonsI18nKeys.Create,
    });

    await user.click(
      screen.getByRole('button', {
        name: 'fill-invalid-oauth-toolset',
      }),
    );

    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain(
      ToolsetEditorI18nKeys.EndpointInvalid,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'fill-oauth-toolset',
      }),
    );

    await waitFor(() =>
      expect((saveButton as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it('enables Save & Exit for configured OAuth without authorization/token endpoints', async () => {
    renderEditor();

    const saveButton = await screen.findByRole('button', {
      name: ButtonsI18nKeys.Create,
    });

    await user.click(
      screen.getByRole('button', {
        name: 'fill-oauth-toolset-without-endpoints',
      }),
    );

    await waitFor(() =>
      expect((saveButton as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it('logs in a newly created API-key toolset using the returned id', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: ButtonsI18nKeys.Create,
      }),
    );

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__0.0.1',
        expect.objectContaining({
          url: 'toolsets/b/my__0.0.1',
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
      screen.getByRole('button', {
        name: 'invoke-ensure-saved',
      }),
    );

    expect(
      await screen.findByText('ensure-saved-result-toolsets/b/my__0.0.1'),
    ).toBeTruthy();
    expect(toolsetsApi.createToolset).toHaveBeenCalledOnce();
    /* Persisting does not show a success notification. */
    expect(mockShowNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
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
    await screen.findByText('ensure-saved-result-toolsets/b/my__0.0.1');

    await user.click(
      screen.getByRole('button', { name: 'invoke-ensure-saved' }),
    );

    await waitFor(() =>
      expect(toolsetsApi.createToolset).toHaveBeenCalledOnce(),
    );
    expect(
      screen.getByText('ensure-saved-result-toolsets/b/my__0.0.1'),
    ).toBeTruthy();
  });

  it('saves a newly created API-key toolset without login using only the key header', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-without-login-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: ButtonsI18nKeys.Create,
      }),
    );

    await waitFor(() =>
      expect(toolsetsApi.createToolset).toHaveBeenCalledWith(
        expect.objectContaining({
          authSettings: expect.objectContaining({
            authenticationType: ToolsetAuthTypes.ApiKey,
            apiKeyHeader: 'X-API-Key',
          }),
        }),
      ),
    );
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith({
      variant: 'success',
      title: 'entityNotifications.toolset.createdTitle',
      message: 'entityNotifications.toolset.created',
    });
  });

  it('returns to the requested screen after saving a new OAuth toolset without starting login', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    renderEditor(`${ROUTES.ToolsetEditor}?returnUrl=%2Fprevious`);

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-oauth-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: ButtonsI18nKeys.Create,
      }),
    );

    expect(await screen.findByText('Previous screen')).toBeTruthy();
    expect(toolsetsApi.createToolset).toHaveBeenCalledWith(
      expect.objectContaining({
        authSettings: expect.objectContaining({
          redirectUri: expect.stringContaining('/auth/toolset-signin'),
        }),
      }),
    );
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('saves a new OAuth with-login toolset with a redirect URI', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-oauth-with-login-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: ButtonsI18nKeys.Create,
      }),
    );

    await waitFor(() =>
      expect(toolsetsApi.createToolset).toHaveBeenCalledWith(
        expect.objectContaining({
          authSettings: {
            authenticationType: ToolsetAuthTypes.OAuth,
            redirectUri: expect.stringContaining('/auth/toolset-signin'),
          },
        }),
      ),
    );
  });

  it('refetches toolsets after a successful create so the catalog list stays in sync', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: ButtonsI18nKeys.Create,
      }),
    );

    await waitFor(() => expect(mockRefetchToolsets).toHaveBeenCalledOnce());
  });

  it('refetches toolsets after the auth section reports a successful login', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'report-login-success',
      }),
    );

    await waitFor(() => expect(mockRefetchToolsets).toHaveBeenCalledOnce());
  });

  it('refetches toolsets after the auth section reports a successful logout', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'report-logout-success',
      }),
    );

    await waitFor(() => expect(mockRefetchToolsets).toHaveBeenCalledOnce());
  });

  it('shows an error notification when create fails', async () => {
    vi.mocked(toolsetsApi.createToolset).mockRejectedValue(new Error('fail'));
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: ButtonsI18nKeys.Create,
      }),
    );

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message: ToolsetEditorI18nKeys.ErrorCreateFailed,
      }),
    );
  });

  it('shows the DIAL Core error reason instead of a generic message when create fails', async () => {
    const response = new Response(
      JSON.stringify({
        message:
          "The specified endpoint 'https://test.com' is invalid or unreachable.",
      }),
      { status: 400 },
    );
    vi.mocked(toolsetsApi.createToolset).mockRejectedValue(
      new ResponseError(response),
    );
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: ButtonsI18nKeys.Create,
      }),
    );

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message:
          "The specified endpoint 'https://test.com' is invalid or unreachable.",
      }),
    );
  });
});
