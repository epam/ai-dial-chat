import { ResponseError } from '@epam/ai-dial-chat-api-client';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import { useAppConfig } from '../../../context/AppConfigContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { useUser } from '../../../context/auth/UserContext';
import { useOperationNotification } from '../../../hooks/useOperationNotification';
import { mcpAppsApiClient } from '../../../server-api/mcp-apps';
import * as toolsetsApi from '../../../server-api/toolsets';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { ROUTES } from '../../../types/routes';
import ToolsetEditorPage from '../ToolsetEditor';

vi.mock('../../../server-api/toolsets', () => ({
  createToolset: vi.fn(),
  getToolset: vi.fn(),
  listToolsets: vi.fn(),
  loginToolset: vi.fn(),
  logoutToolset: vi.fn(),
  updateToolset: vi.fn(),
}));

vi.mock('../../../server-api/mcp-apps', () => ({
  mcpAppsApiClient: { listToolNames: vi.fn() },
}));

vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({ refetchToolsets: mockRefetchToolsets }),
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'b' } }),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: mockAppConfig }),
}));
vi.mock('../../../hooks/useOperationNotification', () => ({
  useOperationNotification: () => ({
    notifyOperationSuccess: mockNotifyOperationSuccess,
  }),
}));

vi.mock('../../../components/RouteFallback/RouteFallback', () => ({
  default: () => <div>Loading</div>,
}));

/*
 * Swaps the composed lib editor for a stub that exposes every host-injected
 * callback as a button, so the adapter test can drive each wiring directly.
 */
vi.mock('@epam/ai-dial-toolset-editor', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-toolset-editor')>();
  const { useState } = await import('react');
  const { ToolsetAuthTypes, ToolsetCredentialsLevel, WithLogin } =
    await import('@epam/ai-dial-chat-hooks');

  interface StubProps {
    initialForm: { name: string };
    toolsetId: string;
    oauthCallbackPath: string;
    labels?: { layout?: { createLabel?: string } };
    buildMcpUrl?: (toolsetId: string) => string;
    listToolNames?: (toolsetId: string) => Promise<string[]>;
    onPersist: (
      form: { name: string },
      toolsetId: string,
    ) => Promise<string | null>;
    onPostSaveLogin: (toolsetId: string, auth: unknown) => Promise<void>;
    onSaveSuccess: (form: { name: string }) => void;
    onSaveComplete: () => void;
    onBack: () => void;
    authActions: {
      login: (toolsetId: string, body: unknown) => Promise<unknown>;
      logout: (toolsetId: string, body: unknown) => Promise<unknown>;
    };
  }

  const apiKeyLoginAuth = {
    authenticationType: ToolsetAuthTypes.ApiKey,
    withLogin: WithLogin.WithLogin,
    isLoggedIn: false,
    apiKey: ' secret ',
  };

  const ToolsetEditorStub = (props: StubProps) => {
    const [persistResult, setPersistResult] = useState<string | null>(null);
    return (
      <div>
        <span>{props.initialForm.name}</span>
        <span>{props.toolsetId}</span>
        <span>{props.oauthCallbackPath}</span>
        <span>{props.labels?.layout?.createLabel}</span>
        <span>
          {props.buildMcpUrl
            ? props.buildMcpUrl('toolsets/b/my__1.0.0')
            : 'no-mcp-url'}
        </span>
        {persistResult != null && (
          <span>{`persist-result-${persistResult}`}</span>
        )}
        <button
          type="button"
          onClick={async () => {
            const id = await props.onPersist(props.initialForm, props.toolsetId);
            setPersistResult(id ?? 'null');
          }}
        >
          adapter-persist
        </button>
        <button
          type="button"
          onClick={() =>
            void props.onPostSaveLogin('toolsets/b/my__1.0.0', apiKeyLoginAuth)
          }
        >
          adapter-post-save-login
        </button>
        <button
          type="button"
          onClick={() =>
            void props.onPostSaveLogin('toolsets/b/my__1.0.0', {
              authenticationType: ToolsetAuthTypes.OAuth,
              withLogin: WithLogin.WithLogin,
              isLoggedIn: false,
            })
          }
        >
          adapter-post-save-login-oauth
        </button>
        <button
          type="button"
          onClick={() => props.onSaveSuccess(props.initialForm)}
        >
          adapter-save-success
        </button>
        <button type="button" onClick={props.onSaveComplete}>
          adapter-save-complete
        </button>
        <button type="button" onClick={props.onBack}>
          adapter-back
        </button>
        <button
          type="button"
          onClick={() =>
            void props.listToolNames?.('toolsets/b/my__1.0.0')
          }
        >
          adapter-list-tool-names
        </button>
        <button
          type="button"
          onClick={() =>
            void props.authActions.login('toolsets/b/my__1.0.0', {
              url: 'toolsets/b/my__1.0.0',
              credentialsLevel: ToolsetCredentialsLevel.User,
              authenticationType: ToolsetAuthTypes.ApiKey,
              apiKey: 'secret',
            })
          }
        >
          adapter-auth-login
        </button>
        <button
          type="button"
          onClick={() =>
            void props.authActions.logout('toolsets/b/my__1.0.0', {
              url: 'toolsets/b/my__1.0.0',
              credentialsLevel: ToolsetCredentialsLevel.User,
              authenticationType: ToolsetAuthTypes.ApiKey,
            })
          }
        >
          adapter-auth-logout
        </button>
      </div>
    );
  };

  return { ...actual, ToolsetEditor: ToolsetEditorStub };
});

const mockShowNotification = vi.fn();
const mockRefetchToolsets = vi.fn();
const mockNotifyOperationSuccess = vi.fn();
const mockAppConfig = { dialCoreExternalUrl: 'https://dial-core.example.com' };

const NEW_TOOLSET_ID = 'toolsets/b/my__0.0.1';
const EDIT_TOOLSET_ID = 'toolsets/b/my__1.0.0';

const editDto = (): DialToolsetDto => ({
  id: EDIT_TOOLSET_ID,
  toolset: EDIT_TOOLSET_ID,
  displayName: 'My toolset',
  displayVersion: '1.2.3',
  endpoint: 'https://my-toolset.example.com/mcp',
  authSettings: { authenticationType: 'NONE' },
});

const renderPage = (initialEntry: string = ROUTES.ToolsetEditor) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path={ROUTES.ToolsetEditor}
          element={<ToolsetEditorPage />}
        />
        <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
        <Route path="/previous" element={<div>Previous screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ToolsetEditorPage', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(toolsetsApi.listToolsets).mockResolvedValue({ data: [] });
    vi.mocked(toolsetsApi.createToolset).mockResolvedValue({
      id: NEW_TOOLSET_ID,
    });
    vi.mocked(toolsetsApi.updateToolset).mockResolvedValue({
      id: EDIT_TOOLSET_ID,
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
    vi.mocked(toolsetsApi.logoutToolset).mockResolvedValue({ success: true });
    mockRefetchToolsets.mockResolvedValue(undefined);
    vi.mocked(mcpAppsApiClient.listToolNames).mockResolvedValue(['echo']);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    mockAppConfig.dialCoreExternalUrl = 'https://dial-core.example.com';
  });

  it('seeds create mode with a collision-free default name derived from existing toolsets', async () => {
    vi.mocked(toolsetsApi.listToolsets).mockResolvedValue({
      data: [{ ...editDto(), displayName: 'New toolset' }],
    });
    renderPage();

    expect(await screen.findByText('New toolset 1')).toBeTruthy();
    expect(toolsetsApi.getToolset).not.toHaveBeenCalled();
  });

  it('falls back to the plain default form when listing toolsets fails', async () => {
    vi.mocked(toolsetsApi.listToolsets).mockRejectedValue(new Error('fail'));
    renderPage();

    expect(await screen.findByText('New toolset')).toBeTruthy();
  });

  it('shows the route fallback while the edit target is still loading', () => {
    vi.mocked(toolsetsApi.getToolset).mockImplementation(
      () => new Promise(() => {}),
    );
    renderPage(`${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`);

    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('loads the persisted toolset into the editor in edit mode', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue(editDto());
    renderPage(`${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`);

    expect(await screen.findByText('My toolset')).toBeTruthy();
    expect(screen.getByText(EDIT_TOOLSET_ID)).toBeTruthy();
    expect(toolsetsApi.getToolset).toHaveBeenCalledWith(EDIT_TOOLSET_ID);
  });

  it('leaves the editor when the edit target cannot be loaded', async () => {
    vi.mocked(toolsetsApi.getToolset).mockRejectedValue(new Error('missing'));
    renderPage(
      `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}&returnUrl=%2Fprevious`,
    );

    expect(await screen.findByText('Previous screen')).toBeTruthy();
  });

  it('threads the translated labels and the OAuth callback route into the lib editor', async () => {
    renderPage();

    expect(await screen.findByText(ButtonsI18nKeys.Create)).toBeTruthy();
    expect(screen.getByText(ROUTES.ToolsetSignIn)).toBeTruthy();
  });

  it('persists a new toolset through createToolset and resolves the created id', async () => {
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-persist',
    }));

    expect(
      await screen.findByText(`persist-result-${NEW_TOOLSET_ID}`),
    ).toBeTruthy();
    expect(toolsetsApi.createToolset).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New toolset' }),
    );
  });

  it('persists an existing toolset through updateToolset', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue(editDto());
    renderPage(`${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`);

    await user.click(
      await screen.findByRole('button', { name: 'adapter-persist' }),
    );

    await waitFor(() =>
      expect(toolsetsApi.updateToolset).toHaveBeenCalledWith(
        EDIT_TOOLSET_ID,
        expect.objectContaining({ name: 'My toolset' }),
      ),
    );
    expect(toolsetsApi.createToolset).not.toHaveBeenCalled();
  });

  it('shows an error notification when create fails', async () => {
    vi.mocked(toolsetsApi.createToolset).mockRejectedValue(new Error('fail'));
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-persist',
    }));

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ToolsetEditorI18nKeys.ErrorCreateFailed,
        }),
      ),
    );
    expect(
      await screen.findByText('persist-result-null'),
    ).toBeTruthy();
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
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-persist',
    }));

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "The specified endpoint 'https://test.com' is invalid or unreachable.",
        }),
      ),
    );
  });

  it('logs in a saved API-key toolset with a trimmed key through the post-save login', async () => {
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-post-save-login',
    }));

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        EDIT_TOOLSET_ID,
        expect.objectContaining({
          url: EDIT_TOOLSET_ID,
          credentialsLevel: ToolsetCredentialsLevel.User,
          authenticationType: ToolsetAuthTypes.ApiKey,
          apiKey: 'secret',
        }),
      ),
    );
  });

  it('does not start a post-save login for non-API-key auth', async () => {
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-post-save-login-oauth',
    }));

    await waitFor(() =>
      expect(screen.getByRole('button', {
        name: 'adapter-post-save-login-oauth',
      })).toBeTruthy(),
    );
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
  });

  it('forwards authActions.login to loginToolset with the DTO body', async () => {
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-auth-login',
    }));

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        EDIT_TOOLSET_ID,
        expect.objectContaining({
          url: EDIT_TOOLSET_ID,
          apiKey: 'secret',
        }),
      ),
    );
  });

  it('forwards authActions.logout to logoutToolset with the DTO body', async () => {
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-auth-logout',
    }));

    await waitFor(() =>
      expect(toolsetsApi.logoutToolset).toHaveBeenCalledWith(
        EDIT_TOOLSET_ID,
        expect.objectContaining({ url: EDIT_TOOLSET_ID }),
      ),
    );
  });

  it('raises the operation success toast through the operation notification hook', async () => {
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-save-success',
    }));

    expect(mockNotifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Toolset,
      EntityOperation.Created,
      { name: 'New toolset' },
    );
  });

  it('returns to the requested screen when the save completes', async () => {
    renderPage(`${ROUTES.ToolsetEditor}?returnUrl=%2Fprevious`);

    await user.click(await screen.findByRole('button', {
      name: 'adapter-save-complete',
    }));

    expect(await screen.findByText('Previous screen')).toBeTruthy();
  });

  it('falls back to the catalog route from an unsafe returnUrl when going back', async () => {
    renderPage(`${ROUTES.ToolsetEditor}?returnUrl=//evil`);

    await user.click(await screen.findByRole('button', {
      name: 'adapter-back',
    }));

    expect(await screen.findByText('Catalog')).toBeTruthy();
  });

  it('resolves the MCP URL against the configured DIAL Core external URL', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'adapter-persist' });
    expect(
      screen.getByText(
        'https://dial-core.example.com/v1/toolset/toolsets/b/my__1.0.0/mcp',
      ),
    ).toBeTruthy();
  });

  it('omits the MCP URL resolver when no DIAL Core external URL is configured', async () => {
    mockAppConfig.dialCoreExternalUrl = '';
    renderPage();

    expect(await screen.findByText('no-mcp-url')).toBeTruthy();
  });

  it('lists tool names through the MCP Apps client for toolset deployments', async () => {
    renderPage();

    await user.click(await screen.findByRole('button', {
      name: 'adapter-list-tool-names',
    }));

    expect(mcpAppsApiClient.listToolNames).toHaveBeenCalledWith(
      EDIT_TOOLSET_ID,
      'toolset',
    );
  });
});
