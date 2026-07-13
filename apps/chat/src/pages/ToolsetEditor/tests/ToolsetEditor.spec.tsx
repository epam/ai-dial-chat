import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolsetEditorI18nKeys } from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import * as toolsetsApi from '../../../server-api/toolsets';
import { ROUTES } from '../../../types/routes';
import {
  ToolsetAuthTypes,
  ToolsetEditorSteps,
  WithLogin,
} from '../../../types/toolsets';
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

vi.mock('../ToolsetEditorHeader', () => ({
  default: ({ onSave }: { onSave: () => void }) => (
    <button type="button" onClick={onSave}>
      save-toolset
    </button>
  ),
}));

vi.mock('../ToolsetEditorView', () => ({
  default: ({
    step,
    errors,
    onChange,
    onAuthChange,
  }: {
    step: string;
    errors: { endpoint?: string };
    onChange: (patch: Record<string, unknown>) => void;
    onAuthChange: (patch: Record<string, unknown>) => void;
  }) => (
    <div>
      <span>{`current-step-${step}`}</span>
      {errors.endpoint && <p role="alert">{errors.endpoint}</p>}
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
    </div>
  ),
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
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification: mockShowNotification,
      dismissNotification: vi.fn(),
    });
    mockRefetchToolsets.mockResolvedValue(undefined);
    vi.mocked(useDeployments).mockReturnValue({
      refetchToolsets: mockRefetchToolsets,
    } as unknown as ReturnType<typeof useDeployments>);
  });

  it('keeps validation errors visible after Save & Exit switches to Settings', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'save-toolset',
      }),
    );

    expect(
      await screen.findByText(`current-step-${ToolsetEditorSteps.Settings}`),
    ).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      ToolsetEditorI18nKeys.EndpointRequired,
    );
    expect(toolsetsApi.createToolset).not.toHaveBeenCalled();
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
        name: 'save-toolset',
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
        name: 'save-toolset',
      }),
    );

    expect(await screen.findByText('Previous screen')).toBeTruthy();
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
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
        name: 'save-toolset',
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
        name: 'save-toolset',
      }),
    );

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message: ToolsetEditorI18nKeys.ErrorCreateFailed,
      }),
    );
  });
});
