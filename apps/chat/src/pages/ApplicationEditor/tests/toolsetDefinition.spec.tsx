import {
  ResponseError,
  TextRefinementPurpose,
} from '@epam/ai-dial-chat-api-client';
import {
  CatalogCreationType,
  type DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import {
  isResourceCreateAdapter,
  type ResourceSaveAdapter,
  ResourceSaveOutcome,
  type ResourceSaveResult,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
} from '@epam/ai-dial-chat-hooks';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  UnsavedChangesI18nKeys,
} from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import {
  resetCatalogCreationState,
  setCatalogCreationState,
} from '../../../context/tests/catalog-creation-state';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { renderWithLeaveGuard } from '../../../hooks/unsaved-changes/tests/render-with-leave-guard';
import { toolsetsApi as toolsetsApiClient } from '../../../server-api/api-client';
import { mcpAppsApiClient } from '../../../server-api/mcp-apps';
import * as toolsetsApi from '../../../server-api/toolsets';
import { ApplicationEditorKind } from '../../../types/application-editor';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { ROUTES } from '../../../types/routes';
import ApplicationEditorPage from '../ApplicationEditorPage';

vi.mock('../../../server-api/toolsets', () => ({
  getToolset: vi.fn(),
  listToolsetFolders: vi.fn(),
  listToolsets: vi.fn(),
  loginToolset: vi.fn(),
  logoutToolset: vi.fn(),
  updateToolset: vi.fn(),
}));

vi.mock('../../../server-api/mcp-apps', () => ({
  mcpAppsApiClient: { listToolNames: vi.fn() },
}));

vi.mock('../../../context/NotificationContext');
vi.mock(
  '../../../components/ResourceSavePanelContainer/ResourceSavePanelContainer',
  () => ({
    default: (props: {
      isOpen: boolean;
      typeLabel: string;
      adapter: ResourceSaveAdapter;
      onClose: () => void;
      onSaved: (result: ResourceSaveResult) => void;
    }) => {
      const [createError, setCreateError] = useState('');
      /* A create adapter runs the real create into the root folder, the way the panel does. */
      const handleFinish = async () => {
        if (!isResourceCreateAdapter(props.adapter)) {
          props.onSaved({
            outcome: ResourceSaveOutcome.Saved,
            savedId: 'toolsets/b/Search/my__1.0.0',
            isCreated: false,
            isNewVersion: false,
            isPublished: false,
          });
          return;
        }
        try {
          const { id } = await props.adapter.createIn([]);
          props.onSaved({
            outcome: ResourceSaveOutcome.Saved,
            savedId: id,
            isCreated: true,
            isNewVersion: false,
            isPublished: false,
          });
        } catch {
          setCreateError('Create failed');
        }
      };
      return props.isOpen ? (
        <div role="dialog" aria-label={`Save ${props.typeLabel}`}>
          <button onClick={handleFinish}>Finish save</button>
          <button onClick={props.onClose}>Close panel</button>
          <p>{createError}</p>
        </div>
      ) : null;
    },
  }),
);
vi.mock('../../../server-api/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server-api/api-client')>()),
  toolsetsApi: { createToolset: vi.fn() },
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({ refetchToolsets: mockRefetchToolsets }),
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'b' } }),
}));
vi.mock('../../../context/AppConfigContext', async () => {
  const { useCatalogCreationState } =
    await import('../../../context/tests/catalog-creation-state');
  return {
    useAppConfig: () => ({
      status: 'ready',
      config: mockAppConfig,
      ...useCatalogCreationState(),
    }),
  };
});
vi.mock('../../../server-api/text-refinement.api', () => ({
  refineText: (...args: unknown[]) => mockRefineText(...args),
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
    await vi.importActual<typeof import('@epam/ai-dial-chat-hooks')>(
      '@epam/ai-dial-chat-hooks',
    );

  interface StubProps {
    initialForm: { name: string; version: string };
    toolsetId: string;
    onOAuthLogin: unknown;
    labels?: { layout?: { createLabel?: string } };
    buildMcpUrl?: (toolsetId: string) => string;
    onRefineDescription?: (
      value: string,
      signal: AbortSignal,
    ) => Promise<string>;
    listToolNames?: (toolsetId: string) => Promise<string[]>;
    isVersionReadOnly?: boolean;
    availableLocaleOptions?: { code: string; label: string }[];
    formatLocaleLabel?: (code: string) => string;
    onPersist: (
      form: { name: string },
      toolsetId: string,
    ) => Promise<string | null>;
    onPostSaveLogin: (toolsetId: string, auth: unknown) => Promise<void>;
    onSaveSuccess: (form: { name: string }) => void;
    onSaveComplete: () => void;
    onBack: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
    authActions: {
      login: (toolsetId: string, body: unknown) => Promise<unknown>;
      logout: (toolsetId: string, body: unknown) => Promise<unknown>;
    };
  }

  /* Stands in for the name the user types in the real editor: create mode opens with an empty one. */
  const submittedForm = <T extends { name: string }>(form: T): T => ({
    ...form,
    name: form.name || 'Typed toolset',
  });

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
        <span>{`seeded-version-${props.initialForm.version}`}</span>
        <span>{props.toolsetId}</span>
        <span>{props.onOAuthLogin ? 'oauth-handler' : 'no-oauth-handler'}</span>
        <span>{props.labels?.layout?.createLabel}</span>
        <span>
          {props.isVersionReadOnly ? 'version-read-only' : 'version-editable'}
        </span>
        {props.availableLocaleOptions?.map(({ code, label }) => (
          <span key={code}>{`locale-option-${code}-${label}`}</span>
        ))}
        {props.formatLocaleLabel && (
          <span>{`retained-label-${props.formatLocaleLabel('it')}`}</span>
        )}
        {props.onRefineDescription && (
          <button
            type="button"
            onClick={() =>
              void props.onRefineDescription?.(
                'Draft',
                new AbortController().signal,
              )
            }
          >
            adapter-refine
          </button>
        )}
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
            const id = await props.onPersist(
              submittedForm(props.initialForm),
              props.toolsetId,
            );
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
          onClick={() => props.onSaveSuccess(submittedForm(props.initialForm))}
        >
          adapter-save-success
        </button>
        <button type="button" onClick={props.onSaveComplete}>
          adapter-save-complete
        </button>
        <button type="button" onClick={() => props.onDirtyChange?.(true)}>
          adapter-mark-dirty
        </button>
        <button type="button" onClick={props.onBack}>
          adapter-back
        </button>
        <button
          type="button"
          onClick={() => void props.listToolNames?.('toolsets/b/my__1.0.0')}
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
const mockRefineText = vi.fn();
const mockAppConfig = {
  dialCoreExternalUrl: 'https://dial-core.example.com',
  aiTextRefinementAvailable: false,
  additionalContentLocales: [] as string[],
};

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
  renderWithLeaveGuard(
    <Routes>
      <Route
        path={ROUTES.ToolsetEditor}
        element={<ApplicationEditorPage kind={ApplicationEditorKind.Toolset} />}
      />
      <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
      <Route path={ROUTES.FileManager} element={<div>Files</div>} />
    </Routes>,
    [initialEntry],
  );

describe('ApplicationEditorPage — toolset', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    resetCatalogCreationState();
    sessionStorage.clear();
    vi.mocked(toolsetsApiClient.createToolset).mockResolvedValue({
      id: NEW_TOOLSET_ID,
    } as never);
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
    mockAppConfig.aiTextRefinementAvailable = false;
    mockAppConfig.additionalContentLocales = [];
  });

  it('offers the configured content locales without the primary one', async () => {
    mockAppConfig.additionalContentLocales = ['en', 'de'];
    renderPage();

    expect(await screen.findByText('locale-option-de-Deutsch')).toBeTruthy();
    expect(screen.queryByText(/locale-option-en-/)).toBeNull();
  });

  it('names a stored but unconfigured locale through its language name', async () => {
    mockAppConfig.additionalContentLocales = ['de'];
    renderPage();

    expect(await screen.findByText('retained-label-italiano')).toBeTruthy();
  });

  it('offers no content locales when none are configured', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'adapter-persist' });
    expect(screen.queryByText(/locale-option-/)).toBeNull();
  });

  it('omits description refinement when the capability is unavailable', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'adapter-persist' });
    expect(screen.queryByRole('button', { name: 'adapter-refine' })).toBeNull();
  });

  it('refines the description with the toolset purpose', async () => {
    mockAppConfig.aiTextRefinementAvailable = true;
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'adapter-refine' }),
    );

    expect(mockRefineText).toHaveBeenCalledWith(
      TextRefinementPurpose.ToolsetDescription,
      'Draft',
      expect.any(AbortSignal),
    );
  });

  it('seeds create mode with an empty name and version 1.0.0 without listing toolsets', async () => {
    renderPage();

    expect(await screen.findByText('seeded-version-1.0.0')).toBeTruthy();
    expect(screen.queryByText('New toolset')).toBeNull();
    expect(toolsetsApi.listToolsets).not.toHaveBeenCalled();
    expect(toolsetsApi.getToolset).not.toHaveBeenCalled();
  });

  it('shows the route fallback while the edit target is still loading', () => {
    vi.mocked(toolsetsApi.getToolset).mockImplementation(
      () =>
        new Promise(() => {
          /* empty */
        }),
    );
    renderPage(
      `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`,
    );

    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('loads the persisted toolset into the editor in edit mode', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue(editDto());
    renderPage(
      `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`,
    );

    expect(await screen.findByText('My toolset')).toBeTruthy();
    expect(screen.getByText(EDIT_TOOLSET_ID)).toBeTruthy();
    expect(toolsetsApi.getToolset).toHaveBeenCalledWith(EDIT_TOOLSET_ID);
  });

  it('leaves the editor when the edit target cannot be loaded', async () => {
    vi.mocked(toolsetsApi.getToolset).mockRejectedValue(new Error('missing'));
    renderPage(
      `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`,
    );

    expect(await screen.findByText('Catalog')).toBeTruthy();
  });

  it('threads the translated labels and the app-owned OAuth handler into the lib editor', async () => {
    renderPage();

    expect(await screen.findByText(ButtonsI18nKeys.Create)).toBeTruthy();
    /* The callback route stays inside the handler — the lib only gets the handler itself. */
    expect(screen.getByText('oauth-handler')).toBeTruthy();
  });

  const persistThroughPanel = async () => {
    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-persist',
      }),
    );
    await screen.findByRole('dialog', {
      name: `Save ${CatalogI18nKeys.CreateToolset}`,
    });
    await user.click(screen.getByRole('button', { name: 'Finish save' }));
  };

  it('creates a new toolset create-only through the Save panel and resolves the created id', async () => {
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-persist',
      }),
    );

    expect(
      await screen.findByRole('dialog', {
        name: `Save ${CatalogI18nKeys.CreateToolset}`,
      }),
    ).toBeTruthy();
    expect(toolsetsApiClient.createToolset).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Finish save' }));

    expect(
      await screen.findByText(`persist-result-${NEW_TOOLSET_ID}`),
    ).toBeTruthy();
    expect(toolsetsApiClient.createToolset).toHaveBeenCalledOnce();
    expect(toolsetsApiClient.createToolset).toHaveBeenCalledWith({
      createToolsetBodyDto: expect.objectContaining({
        name: 'Typed toolset',
        version: '1.0.0',
        createOnly: true,
      }),
    });
    expect(
      screen.queryByRole('dialog', {
        name: `Save ${CatalogI18nKeys.CreateToolset}`,
      }),
    ).toBeNull();
  });

  describe('creation permissions', () => {
    const denyToolsets = () =>
      setCatalogCreationState({
        allowedTypes: Object.values(CatalogCreationType).filter(
          (type) => type !== CatalogCreationType.Toolset,
        ),
        restrictedSchemaIds: [],
      });

    it('shows the denied state instead of the create form', () => {
      denyToolsets();
      renderPage();

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: CatalogI18nKeys.CreationDenied,
        }),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: 'adapter-persist' }),
      ).toBeNull();
    });

    it('blocks the create request when permission is lost while the form is open', async () => {
      renderPage();
      const persist = await screen.findByRole('button', {
        name: 'adapter-persist',
      });

      act(() => denyToolsets());
      await user.click(persist);

      expect(toolsetsApiClient.createToolset).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('dialog', {
          name: `Save ${CatalogI18nKeys.CreateToolset}`,
        }),
      ).toBeNull();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: CatalogI18nKeys.CreationDenied }),
      );
    });

    it('still edits and saves an existing toolset', async () => {
      denyToolsets();
      vi.mocked(toolsetsApi.getToolset).mockResolvedValue(editDto());
      renderPage(
        `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`,
      );

      await user.click(
        await screen.findByRole('button', { name: 'adapter-persist' }),
      );

      await waitFor(() =>
        expect(toolsetsApi.updateToolset).toHaveBeenCalledWith(
          EDIT_TOOLSET_ID,
          expect.objectContaining({ name: 'My toolset' }),
        ),
      );
    });

    it('keeps the post-save OAuth login of an existing toolset working', async () => {
      denyToolsets();
      vi.mocked(toolsetsApi.getToolset).mockResolvedValue(editDto());
      renderPage(
        `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`,
      );

      expect(await screen.findByText('oauth-handler')).toBeTruthy();
    });
  });

  it('persists an existing toolset through updateToolset', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue(editDto());
    renderPage(
      `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`,
    );

    await user.click(
      await screen.findByRole('button', { name: 'adapter-persist' }),
    );

    await waitFor(() =>
      expect(toolsetsApi.updateToolset).toHaveBeenCalledWith(
        EDIT_TOOLSET_ID,
        expect.objectContaining({ name: 'My toolset' }),
      ),
    );
    expect(toolsetsApiClient.createToolset).not.toHaveBeenCalled();
  });

  it('keeps the Version editable on create and read-only while editing', async () => {
    renderPage();
    expect(await screen.findByText('version-editable')).toBeTruthy();
  });

  describe('Save panel for an own toolset', () => {
    const openEditor = async () => {
      vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
        ...editDto(),
        isMy: true,
      });
      renderPage(
        `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`,
      );
      expect(await screen.findByText('version-read-only')).toBeTruthy();
    };

    const openPanel = async () => {
      await openEditor();
      await user.click(screen.getByRole('button', { name: 'adapter-persist' }));
      return screen.findByRole('dialog', {
        name: `Save ${CatalogI18nKeys.CreateToolset}`,
      });
    };

    it('opens the Save panel instead of updating in place', async () => {
      await openPanel();
      expect(toolsetsApi.updateToolset).not.toHaveBeenCalled();
    });

    it("resolves the editor's persist with the id the panel saved", async () => {
      await openPanel();
      await user.click(screen.getByRole('button', { name: 'Finish save' }));
      expect(
        await screen.findByText('persist-result-toolsets/b/Search/my__1.0.0'),
      ).toBeTruthy();
      expect(
        screen.queryByRole('dialog', {
          name: `Save ${CatalogI18nKeys.CreateToolset}`,
        }),
      ).toBeNull();
    });

    it('resolves the persist with null when the panel is closed', async () => {
      await openPanel();
      await user.click(screen.getByRole('button', { name: 'Close panel' }));
      expect(await screen.findByText('persist-result-null')).toBeTruthy();
    });

    it('skips the editor success toast the panel already raised', async () => {
      await openPanel();
      await user.click(screen.getByRole('button', { name: 'Finish save' }));
      await screen.findByText('persist-result-toolsets/b/Search/my__1.0.0');
      await user.click(
        screen.getByRole('button', { name: 'adapter-save-success' }),
      );
      expect(mockNotifyOperationSuccess).not.toHaveBeenCalled();
    });

    it('still updates in place a toolset the user does not own', async () => {
      vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
        ...editDto(),
        isMy: false,
      });
      vi.mocked(toolsetsApi.updateToolset).mockResolvedValue({
        id: EDIT_TOOLSET_ID,
      });
      renderPage(
        `${ROUTES.ToolsetEditor}?id=${encodeURIComponent(EDIT_TOOLSET_ID)}`,
      );
      await user.click(
        await screen.findByRole('button', { name: 'adapter-persist' }),
      );
      await waitFor(() => expect(toolsetsApi.updateToolset).toHaveBeenCalled());
    });
  });

  it('keeps the editor open with the panel showing the error when create fails', async () => {
    vi.mocked(toolsetsApiClient.createToolset).mockRejectedValue(
      new Error('fail'),
    );
    renderPage();

    await persistThroughPanel();

    expect(await screen.findByText('Create failed')).toBeTruthy();
    expect(
      screen.getByRole('dialog', {
        name: `Save ${CatalogI18nKeys.CreateToolset}`,
      }),
    ).toBeTruthy();
    /* The persist stays pending, so the editor neither logs in nor exits. */
    expect(screen.queryByText(/^persist-result-/)).toBeNull();
    expect(screen.queryByText('Catalog')).toBeNull();
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('resolves the persist with null when the panel is closed after a failed create', async () => {
    const response = new Response(
      JSON.stringify({
        message:
          "The specified endpoint 'https://test.com' is invalid or unreachable.",
      }),
      { status: 400 },
    );
    vi.mocked(toolsetsApiClient.createToolset).mockRejectedValue(
      new ResponseError(response),
    );
    renderPage();

    await persistThroughPanel();
    await screen.findByText('Create failed');
    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(await screen.findByText('persist-result-null')).toBeTruthy();
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('logs in a saved API-key toolset with a trimmed key through the post-save login', async () => {
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-post-save-login',
      }),
    );

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

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-post-save-login-oauth',
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: 'adapter-post-save-login-oauth',
      }),
    ).toBeTruthy();
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
  });

  it('forwards authActions.login to loginToolset with the DTO body', async () => {
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-auth-login',
      }),
    );

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

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-auth-logout',
      }),
    );

    await waitFor(() =>
      expect(toolsetsApi.logoutToolset).toHaveBeenCalledWith(
        EDIT_TOOLSET_ID,
        expect.objectContaining({ url: EDIT_TOOLSET_ID }),
      ),
    );
  });

  it('raises the operation success toast through the operation notification hook', async () => {
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-save-success',
      }),
    );

    expect(mockNotifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Toolset,
      EntityOperation.Created,
      { name: 'Typed toolset' },
    );
  });

  it('returns to the catalog when the save completes', async () => {
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-save-complete',
      }),
    );

    expect(await screen.findByText('Catalog')).toBeTruthy();
  });

  it('returns to the catalog when going back', async () => {
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-back',
      }),
    );

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

    await user.click(
      await screen.findByRole('button', {
        name: 'adapter-list-tool-names',
      }),
    );

    expect(mcpAppsApiClient.listToolNames).toHaveBeenCalledWith(
      EDIT_TOOLSET_ID,
      'toolset',
    );
  });

  describe('leave guard', () => {
    const markDirty = async () =>
      user.click(
        await screen.findByRole('button', { name: 'adapter-mark-dirty' }),
      );

    it('asks before leaving through navigation while the editor reports edits', async () => {
      const { router } = renderPage();
      await markDirty();

      await act(() => router.navigate(ROUTES.FileManager));

      expect(
        screen.getByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
      ).toBeTruthy();
      expect(router.state.location.pathname).toBe(ROUTES.ToolsetEditor);
    });

    it('routes a dirty Back through the same dialog', async () => {
      renderPage();
      await markDirty();

      await user.click(screen.getByRole('button', { name: 'adapter-back' }));

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.queryByText('Catalog')).toBeNull();
    });

    it('exits after a successful save without the dialog', async () => {
      renderPage();
      await markDirty();

      await user.click(
        screen.getByRole('button', { name: 'adapter-save-complete' }),
      );

      expect(await screen.findByText('Catalog')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
