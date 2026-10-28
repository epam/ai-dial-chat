import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillCatalogListResponseDto,
} from '@epam/ai-dial-chat-api-client';
import * as chatHooksModule from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChatI18nKeys,
  CustomViewerI18nKeys,
} from '../../../constants/translation-keys';
import * as UserContextModule from '../../../context/auth/UserContext';
import { DeploymentsProvider } from '../../../context/DeploymentsContext';
import { FavoriteApplicationsProvider } from '../../../context/FavoriteApplicationsContext';
import * as NotificationContextModule from '../../../context/NotificationContext';
import { SkillsProvider } from '../../../context/SkillsContext';
import {
  useAppConfig as mockUseAppConfig,
  useFeatureFlag as mockUseFeatureFlag,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as KeyboardShortcutModule from '../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import * as applicationSchemasApi from '../../../server-api/application-schemas';
import * as deploymentConfigurationApi from '../../../server-api/deployments';
import * as deploymentsApi from '../../../server-api/deployments.api';
import * as promptsApi from '../../../server-api/prompts.api';
import * as skillsApi from '../../../server-api/skills.api';
import * as toolsetsApi from '../../../server-api/toolsets';
import * as userConfigApi from '../../../server-api/user-config.api';
import { AuthStatus } from '../../../types/auth-status';
import ConversationRoute from '../ConversationRoute';

/*
 * Route-level behavior of the `deployment-id` / `skill-id` / `prompt-id` URL
 * parameters. Like the skill-route integration spec, the contexts, the skill
 * selector chain and the composer are real; only the server-api boundary and
 * unrelated providers are mocked. A browser router is used (not a memory one)
 * because the feature reads and rewrites `window.location` and history state.
 */

const mocks = vi.hoisted(() => ({
  setSelectedDeployment: vi.fn(),
  openParametersPopup: vi.fn(),
  isolated: {
    isActive: false,
    isNotFound: false,
    resolvedDeploymentId: null as string | null,
  },
  overlay: undefined as { notifyConversationLoaded: () => void } | undefined,
}));

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useOpenAttachmentCanvas: () => ({ openAttachmentCanvas: vi.fn() }),
  };
});
/* Lazy-loaded and rendered without an attachment-canvas provider here; it resolves mid-run and would crash later tests. */
vi.mock('../../../components/SkillSelector/SkillDetailsPanelContainer', () => ({
  default: () => null,
}));
vi.mock('../../../components/CustomViewer/CustomViewerFrame', () => ({
  default: () => <div>custom-viewer</div>,
}));
vi.mock('../../../hooks/attachment/useAttachmentCanvasResolvers', () => ({
  useAttachmentCanvasResolvers: () => ({ resolvers: {}, options: {} }),
}));
vi.mock(
  '../../../components/DeploymentSelector/useDeploymentSelectorOverlay',
  () => ({
    useDeploymentSelectorOverlay: () => ({
      renderOverlay: vi.fn(),
      catalogModal: null,
    }),
  }),
);
vi.mock('../../../components/PromptSelector/usePromptSelectorOverlay', () => ({
  usePromptSelectorOverlay: () => ({
    renderOverlay: vi.fn(),
    promptCatalogModal: null,
    parametersPopup: null,
    openParametersPopup: mocks.openParametersPopup,
  }),
}));
vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => ({
    selectedDeploymentId: null,
    setSelectedDeployment: mocks.setSelectedDeployment,
  }),
}));
vi.mock('../../../context/IsolatedModelViewContext', () => ({
  useIsolatedModelView: () => mocks.isolated,
}));
vi.mock('../../../context/ConversationsContext', () => ({
  useConversations: () => ({ refreshConversations: vi.fn() }),
}));
vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: () => mocks.overlay,
}));
vi.mock('../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference');
vi.mock('../../../hooks/useUiFeature', async () => {
  const { DEFAULT_ENABLED_UI_FEATURES } =
    await import('../../../constants/ui-features');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useUiFeature: (feature: any) => DEFAULT_ENABLED_UI_FEATURES.has(feature),
  };
});
vi.mock('../../../server-api/deployments.api');
vi.mock('../../../server-api/application-schemas');
vi.mock('../../../server-api/toolsets');
vi.mock('../../../server-api/deployments');
vi.mock('../../../server-api/conversations.api');
vi.mock('../../../server-api/skills.api');
vi.mock('../../../server-api/prompts.api');
vi.mock('../../../server-api/user-config.api');
vi.mock('../../../server-api/api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../server-api/api-client')>();
  return { ...actual, filesApi: { ...actual.filesApi, uploadFile: vi.fn() } };
});
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return { ...actual, attachmentsToDtos: vi.fn(), useToolsMenu: vi.fn() };
});
vi.mock('../../../components/StarterButtons/StarterButtons', () => ({
  default: () => <div />,
}));

const SKILL_URL = 'skills/my-bucket/my-skill';
const PROMPT_ID = 'prompts/user-bucket/Work/summarize';
const PROMPT_BODY = 'Summarize the text.';
const PARAMETERIZED_BODY = 'Summarize {{text}} in {{language}}.';

const promptDto = (content: string) =>
  ({
    id: 'dto-id',
    name: 'Summarize',
    description: 'Summarizes text',
    content,
  }) as Awaited<ReturnType<typeof promptsApi.getPrompt>>;

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

const opusDeployment = {
  id: 'opus',
  displayName: 'Opus',
  type: 'model' as const,
  features: { skillsSupported: true, systemPrompt: true, temperature: true },
};
const sonnetDeployment = {
  id: 'sonnet',
  displayName: 'Sonnet',
  type: 'model' as const,
  features: { skillsSupported: true, systemPrompt: true, temperature: true },
};
const plainDeployment = {
  id: 'plain',
  displayName: 'Plain',
  type: 'model' as const,
  features: { skillsSupported: false, systemPrompt: true, temperature: true },
};
const viewerDeployment = {
  id: 'viewer',
  displayName: 'Viewer',
  type: 'application' as const,
  viewerUrl: 'https://viewer.example.com/',
};
const hiddenDeployment = {
  id: 'secret',
  displayName: 'Secret',
  type: 'model' as const,
  isHidden: true,
};
const customUiDeployment = {
  id: 'viewer-app',
  displayName: 'Viewer',
  type: 'application' as const,
  interfaces: ['custom_ui'],
};

const skillListing: SkillCatalogListResponseDto = {
  skills: [
    {
      name: 'my-skill',
      path: 'my-skill',
      url: SKILL_URL,
      bucket: 'my-bucket',
      nodeType: SkillMetadataItemDtoNodeTypeEnum.Item,
      updatedAt: 1,
    },
  ],
  sharedWithMe: [],
  publicSkills: [],
};

const routers: Array<ReturnType<typeof createBrowserRouter>> = [];
const views: Array<{ unmount: () => void }> = [];

const renderAt = (url: string, routerState?: unknown) => {
  window.history.replaceState(
    routerState ? { usr: routerState, key: 'initial', idx: 0 } : null,
    '',
    url,
  );
  const router = createBrowserRouter([
    {
      path: '*',
      element: (
        <DeploymentsProvider>
          <SkillsProvider>
            <FavoriteApplicationsProvider>
              <ConversationRoute />
            </FavoriteApplicationsProvider>
          </SkillsProvider>
        </DeploymentsProvider>
      ),
    },
  ]);
  routers.push(router);
  const view = render(<RouterProvider router={router} />);
  views.push(view);
  return view;
};

const composerValue = () =>
  (screen.getByPlaceholderText('chat.placeholder') as HTMLTextAreaElement)
    .value;

describe('ConversationRoute — URL entity preselection', () => {
  const mockGetDeployments = vi.mocked(deploymentsApi.getDeployments);
  const mockGetApplicationSchemas = vi.mocked(
    applicationSchemasApi.getApplicationSchemas,
  );
  const mockListToolsets = vi.mocked(toolsetsApi.listToolsets);
  const mockGetDeploymentConfiguration = vi.mocked(
    deploymentConfigurationApi.getDeploymentConfiguration,
  );
  const mockListCatalogSkills = vi.mocked(skillsApi.listCatalogSkills);
  const mockGetUserConfig = vi.mocked(userConfigApi.getUserConfig);
  const mockGetPrompt = vi.mocked(promptsApi.getPrompt);
  const mockUseUser = vi.mocked(UserContextModule.useUser);
  const mockUseNotification = vi.mocked(
    NotificationContextModule.useNotification,
  );
  const mockUseKeyboardShortcutPreference = vi.mocked(
    KeyboardShortcutModule.useKeyboardShortcutPreference,
  );
  const mockUseToolsMenu = vi.mocked(chatHooksModule.useToolsMenu);
  const showNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppConfig.mockImplementation(() => ({
      status: 'ready',
      features: {},
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5 * 1024 * 1024,
        defaultDeploymentId: null,
      },
    }));
    mockUseFeatureFlag.mockImplementation(
      (key?: string) => key === 'skillUsageEnabled',
    );
    mocks.isolated = {
      isActive: false,
      isNotFound: false,
      resolvedDeploymentId: null,
    };
    mocks.overlay = undefined;
    mockGetDeployments.mockResolvedValue({
      deployments: [
        opusDeployment,
        sonnetDeployment,
        hiddenDeployment,
        customUiDeployment,
        plainDeployment,
        viewerDeployment,
      ],
    });
    mockGetApplicationSchemas.mockResolvedValue({ schemas: [] });
    mockListToolsets.mockResolvedValue({ data: [] });
    mockGetDeploymentConfiguration.mockRejectedValue(
      new Error('No configuration'),
    );
    mockListCatalogSkills.mockResolvedValue(skillListing);
    mockGetPrompt.mockResolvedValue(promptDto(PROMPT_BODY));
    mockGetUserConfig.mockResolvedValue({
      version: 1,
      conversations: { pinnedIds: [] },
      toolsets: { installed: [] },
      deployments: { installed: [], selectedId: null },
      prompts: { installed: [] },
      skills: { installed: [] },
      projects: { pinnedIds: [] },
    });
    mockUseUser.mockReturnValue({
      user: {
        sub: 'u1',
        providerId: 'p1',
        claims: {},
        bucket: 'user-bucket',
        isAdmin: false,
      },
      status: AuthStatus.Authenticated,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseNotification.mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    mockUseKeyboardShortcutPreference.mockReturnValue({
      preference: 'enter' as never,
      setPreference: vi.fn(),
    });
    mockUseToolsMenu.mockReturnValue({
      toolsMenuItems: [],
      onToolToggle: vi.fn(),
      toolConfigurationValue: {},
      restoreToolConfiguration: vi.fn(),
    });
  });

  afterEach(() => {
    views.splice(0).forEach((view) => view.unmount());
    routers.splice(0).forEach((router) => router.dispose());
    window.history.replaceState(null, '', '/');
  });

  describe('clearing one-shot router state', () => {
    it('keeps the query string and hash when the router-state deployment is consumed', async () => {
      renderAt('/?foo=bar#h', { deploymentId: 'opus' });

      await waitFor(() => {
        expect(
          (window.history.state as { usr?: unknown } | null)?.usr ?? null,
        ).toBeNull();
      });
      expect(window.location.search).toBe('?foo=bar');
      expect(window.location.hash).toBe('#h');
    });

    it('does not bring back a URL parameter that was removed in the meantime', async () => {
      renderAt('/?deployment-id=opus&foo=bar', { skillId: SKILL_URL });

      await waitFor(() => expect(composerValue()).toBe('/my-skill '));
      await waitFor(() => expect(window.location.search).toBe('?foo=bar'));
    });
  });

  describe('deployment-id', () => {
    const configurationRequestedFor = (id: string) =>
      mockGetDeploymentConfiguration.mock.calls.some(([arg]) => arg === id);
    const lastConfigurationRequest = () =>
      mockGetDeploymentConfiguration.mock.calls.at(-1)?.[0];

    it('selects the requested deployment without persisting it and removes the parameter', async () => {
      renderAt('/?deployment-id=sonnet&foo=bar');

      await waitFor(() => expect(lastConfigurationRequest()).toBe('sonnet'));
      await waitFor(() => expect(window.location.search).toBe('?foo=bar'));
      expect(mocks.setSelectedDeployment).not.toHaveBeenCalled();
      expect(showNotification).not.toHaveBeenCalled();
    });

    it('falls back to the default deployment with a warning for an unknown id', async () => {
      renderAt('/?deployment-id=does-not-exist');

      await waitFor(() => expect(configurationRequestedFor('opus')).toBe(true));
      await waitFor(() => expect(window.location.search).toBe(''));
      expect(showNotification).toHaveBeenCalledOnce();
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'warning' }),
      );
    });

    it.each([
      ['hidden', 'secret'],
      ['a custom-UI-only application', 'viewer-app'],
    ])(
      'treats %s as unknown and uses the default deployment',
      async (_label, id) => {
        renderAt(`/?deployment-id=${id}`);

        await waitFor(() =>
          expect(configurationRequestedFor('opus')).toBe(true),
        );
        expect(configurationRequestedFor(id)).toBe(false);
        expect(showNotification).toHaveBeenCalledOnce();
      },
    );

    it('lets router state win over the URL parameter and still removes it', async () => {
      renderAt('/?deployment-id=sonnet', { deploymentId: 'opus' });

      await waitFor(() => expect(window.location.search).toBe(''));
      await waitFor(() => expect(configurationRequestedFor('opus')).toBe(true));
      expect(configurationRequestedFor('sonnet')).toBe(false);
    });

    it('lets isolated view win and leaves the URL and notifications untouched', async () => {
      mocks.isolated = {
        isActive: true,
        isNotFound: false,
        resolvedDeploymentId: 'opus',
      };

      renderAt('/?deployment-id=missing&foo=bar');

      await waitFor(() => expect(configurationRequestedFor('opus')).toBe(true));
      expect(window.location.search).toBe('?deployment-id=missing&foo=bar');
      expect(showNotification).not.toHaveBeenCalled();
    });

    it('applies nothing and leaves the URL alone in overlay mode', async () => {
      mocks.overlay = { notifyConversationLoaded: vi.fn() };

      renderAt('/?deployment-id=sonnet');

      await waitFor(() => expect(mockGetDeployments).toHaveBeenCalled());
      await waitFor(() => expect(composerValue()).toBe(''));
      expect(window.location.search).toBe('?deployment-id=sonnet');
      expect(configurationRequestedFor('sonnet')).toBe(false);
      expect(showNotification).not.toHaveBeenCalled();
    });
  });

  describe('skill-id', () => {
    it('adds the skill mention once, keeps the deployment and removes the parameter', async () => {
      renderAt(`/?skill-id=${SKILL_URL}&foo=bar`);

      await waitFor(() => expect(composerValue()).toBe('/my-skill '));
      await waitFor(() => expect(window.location.search).toBe('?foo=bar'));
      expect(mocks.setSelectedDeployment).not.toHaveBeenCalled();
      expect(showNotification).not.toHaveBeenCalled();
      expect(composerValue()).toBe('/my-skill ');
    });

    it('shows an error and leaves the composer empty for a skill that is not listed', async () => {
      renderAt('/?skill-id=skills/my-bucket/missing');

      await waitFor(() => expect(showNotification).toHaveBeenCalledOnce());
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
      expect(composerValue()).toBe('');
      await waitFor(() => expect(window.location.search).toBe(''));
    });

    it('blocks sending when the requested deployment does not support skills', async () => {
      renderAt(`/?deployment-id=plain&skill-id=${SKILL_URL}`);

      await waitFor(() => expect(composerValue()).toBe('/my-skill '));
      await waitFor(() =>
        expect(
          screen
            .getByRole('button', { name: ChatI18nKeys.SendMessage })
            .getAttribute('aria-disabled'),
        ).toBe('true'),
      );
    });
  });

  describe('prompt-id', () => {
    it('seeds the composer with a body without parameters and keeps the body out of the URL', async () => {
      renderAt(`/?prompt-id=${PROMPT_ID}&foo=bar`);

      await waitFor(() => expect(composerValue()).toBe(PROMPT_BODY));
      await waitFor(() => expect(window.location.search).toBe('?foo=bar'));
      expect(window.location.href).not.toContain('Summarize');
      expect(mocks.setSelectedDeployment).not.toHaveBeenCalled();
    });

    it('opens the parameters popup for a body with parameters', async () => {
      mockGetPrompt.mockResolvedValue(promptDto(PARAMETERIZED_BODY));

      renderAt(`/?prompt-id=${PROMPT_ID}`);

      await waitFor(() =>
        expect(mocks.openParametersPopup).toHaveBeenCalledExactlyOnceWith({
          id: PROMPT_ID,
          name: 'Summarize',
          description: 'Summarizes text',
          content: PARAMETERIZED_BODY,
        }),
      );
      expect(composerValue()).toBe('');
    });

    it('shows an error and leaves the composer empty when the prompt cannot be read', async () => {
      mockGetPrompt.mockRejectedValue(new Error('404'));

      renderAt(`/?prompt-id=${PROMPT_ID}`);

      await waitFor(() => expect(showNotification).toHaveBeenCalledOnce());
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
      expect(composerValue()).toBe('');
      await waitFor(() => expect(window.location.search).toBe(''));
    });
  });

  describe('skill-id with prompt-id', () => {
    const sendButton = () =>
      screen.getByRole('button', { name: ChatI18nKeys.SendMessage });

    it('puts the skill mention first and the prompt body after it, as a recognised mention', async () => {
      renderAt(
        `/?deployment-id=plain&skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}`,
      );

      await waitFor(() =>
        expect(composerValue()).toBe(`/my-skill ${PROMPT_BODY}`),
      );
      await waitFor(() =>
        expect(sendButton().getAttribute('aria-disabled')).toBe('true'),
      );
      await waitFor(() => expect(window.location.search).toBe(''));
    });

    it('seeds the mention and opens the popup for a parameterized prompt', async () => {
      mockGetPrompt.mockResolvedValue(promptDto(PARAMETERIZED_BODY));

      renderAt(`/?skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}`);

      await waitFor(() => expect(composerValue()).toBe('/my-skill '));
      await waitFor(() =>
        expect(mocks.openParametersPopup).toHaveBeenCalledOnce(),
      );
    });

    it('keeps the skill and reports the prompt when only the prompt fails', async () => {
      mockGetPrompt.mockRejectedValue(new Error('404'));

      renderAt(`/?skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}`);

      await waitFor(() => expect(composerValue()).toBe('/my-skill '));
      expect(showNotification).toHaveBeenCalledOnce();
    });

    it('applies the prompt and reports the skill when only the skill is unknown', async () => {
      renderAt(`/?skill-id=skills/my-bucket/missing&prompt-id=${PROMPT_ID}`);

      await waitFor(() => expect(composerValue()).toBe(PROMPT_BODY));
      expect(showNotification).toHaveBeenCalledOnce();
    });

    it('gives the same result when the prompt arrives after the skills', async () => {
      const prompt = createDeferred<ReturnType<typeof promptDto>>();
      mockGetPrompt.mockReturnValue(prompt.promise);

      renderAt(`/?skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}`);

      await waitFor(() => expect(mockListCatalogSkills).toHaveBeenCalled());
      expect(composerValue()).toBe('');
      prompt.resolve(promptDto(PROMPT_BODY));

      await waitFor(() =>
        expect(composerValue()).toBe(`/my-skill ${PROMPT_BODY}`),
      );
    });

    it('gives the same result when the skills arrive after the prompt', async () => {
      const skills = createDeferred<SkillCatalogListResponseDto>();
      mockListCatalogSkills.mockReturnValue(skills.promise);

      renderAt(`/?skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}`);

      await waitFor(() => expect(mockGetPrompt).toHaveBeenCalled());
      expect(composerValue()).toBe('');
      skills.resolve(skillListing);

      await waitFor(() =>
        expect(composerValue()).toBe(`/my-skill ${PROMPT_BODY}`),
      );
    });
  });

  describe('parameters that cannot show the composer', () => {
    const startButton = () =>
      screen.queryByRole('button', { name: CustomViewerI18nKeys.StartWorking });

    it('still consumes and removes skill-id and prompt-id behind a Custom Viewer start gate, seeding the disabled input', async () => {
      renderAt(
        `/?deployment-id=viewer&skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}`,
      );

      await waitFor(() => expect(window.location.search).toBe(''));
      await waitFor(() => expect(startButton()).toBeTruthy());
      expect(screen.queryByText('custom-viewer')).toBeNull();
      expect(composerValue()).toBe(`/my-skill ${PROMPT_BODY}`);
    });

    it('returns to the start gate when a parameter settles after Start was pressed (known limitation)', async () => {
      const skills = createDeferred<SkillCatalogListResponseDto>();
      mockListCatalogSkills.mockReturnValue(skills.promise);

      renderAt(`/?deployment-id=viewer&skill-id=${SKILL_URL}`);

      await waitFor(() => expect(startButton()).toBeTruthy());
      await waitFor(() =>
        expect(window.location.search).toBe(`?skill-id=${SKILL_URL}`),
      );
      const start = startButton();
      if (start == null) throw new Error('start button is missing');
      await userEvent.click(start);
      expect(await screen.findByText('custom-viewer')).toBeTruthy();

      skills.resolve(skillListing);

      await waitFor(() => expect(startButton()).toBeTruthy());
      expect(screen.queryByText('custom-viewer')).toBeNull();
    });
  });

  describe('isolated view', () => {
    it('ignores skill-id and prompt-id and leaves the URL untouched', async () => {
      mocks.isolated = {
        isActive: true,
        isNotFound: false,
        resolvedDeploymentId: 'opus',
      };

      renderAt(`/?skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}`);

      await waitFor(() => expect(mockGetDeployments).toHaveBeenCalled());
      await waitFor(() => expect(composerValue()).toBe(''));
      expect(mockGetPrompt).not.toHaveBeenCalled();
      expect(window.location.search).toBe(
        `?skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}`,
      );
      expect(showNotification).not.toHaveBeenCalled();
    });
  });

  describe('cleaning the URL', () => {
    it('ends at the bare query and hash after all parameters settle', async () => {
      renderAt(
        `/?deployment-id=sonnet&skill-id=${SKILL_URL}&prompt-id=${PROMPT_ID}&foo=bar#h`,
      );

      await waitFor(() =>
        expect(composerValue()).toBe(`/my-skill ${PROMPT_BODY}`),
      );
      await waitFor(() => expect(window.location.search).toBe('?foo=bar'));
      expect(window.location.hash).toBe('#h');
    });
  });
});
