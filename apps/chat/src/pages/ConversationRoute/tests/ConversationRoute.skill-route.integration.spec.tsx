import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillCatalogListResponseDto,
} from '@epam/ai-dial-chat-api-client';
import * as chatHooksModule from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import * as skillsApi from '../../../server-api/skills.api';
import * as toolsetsApi from '../../../server-api/toolsets';
import * as userConfigApi from '../../../server-api/user-config.api';
import { AuthStatus } from '../../../types/auth-status';
import ConversationRoute from '../ConversationRoute';

/*
 * Reproduces [#9109](https://github.com/epam/ai-dial-chat/issues/9109): the catalog's "Use in chat" action on a Skill
 * navigates to `/` with one-shot router state `{ skillId }`, which
 * `ConversationRoute` consumes via the real (unmocked)
 * `apps/chat`'s `useSkillSelectorOverlay` → `@epam/ai-dial-skills`'s
 * `useSkillSelectorOverlay`/`useSkillMentions` chain. Mocking that chain away
 * (as `ConversationRoute.spec.tsx`/`.integration.spec.tsx` do for other
 * scenarios) would hide the exact render-loop this regression test guards
 * against, so `SkillsContext`/`FavoriteApplicationsContext`/the skill
 * selector hooks are left real; only the server-api boundary and unrelated
 * providers are mocked.
 */

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useOpenAttachmentCanvas: () => ({ openAttachmentCanvas: vi.fn() }),
  };
});
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
  }),
}));
vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => ({
    selectedDeploymentId: null,
    setSelectedDeployment: vi.fn(),
  }),
}));
vi.mock('../../../context/IsolatedModelViewContext', () => ({
  useIsolatedModelView: () => ({
    isActive: false,
    isNotFound: false,
    resolvedDeploymentId: null,
  }),
}));
vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: () => undefined,
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

const opusDeployment = {
  id: 'opus',
  displayName: 'Opus',
  type: 'model' as const,
  features: { skillsSupported: true, systemPrompt: true, temperature: true },
};

const skillListing: SkillCatalogListResponseDto = {
  skills: [
    {
      name: 'my-skill',
      path: 'my-skill',
      url: 'skills/my-bucket/my-skill',
      bucket: 'my-bucket',
      nodeType: SkillMetadataItemDtoNodeTypeEnum.Item,
      updatedAt: 1,
    },
  ],
  sharedWithMe: [],
  publicSkills: [],
};

const renderHarness = (skillId?: string) =>
  render(
    <MemoryRouter
      initialEntries={[
        skillId ? { pathname: '/', state: { skillId } } : { pathname: '/' },
      ]}
    >
      <DeploymentsProvider>
        <SkillsProvider>
          <FavoriteApplicationsProvider>
            <ConversationRoute />
          </FavoriteApplicationsProvider>
        </SkillsProvider>
      </DeploymentsProvider>
    </MemoryRouter>,
  );

describe('ConversationRoute — route-driven skill selection (issue #9109)', () => {
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
  const mockUseUser = vi.mocked(UserContextModule.useUser);
  const mockUseNotification = vi.mocked(
    NotificationContextModule.useNotification,
  );
  const mockUseKeyboardShortcutPreference = vi.mocked(
    KeyboardShortcutModule.useKeyboardShortcutPreference,
  );
  const mockUseToolsMenu = vi.mocked(chatHooksModule.useToolsMenu);

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
    mockGetDeployments.mockResolvedValue({ deployments: [opusDeployment] });
    mockGetApplicationSchemas.mockResolvedValue({ schemas: [] });
    mockListToolsets.mockResolvedValue({ data: [] });
    mockGetDeploymentConfiguration.mockRejectedValue(
      new Error('No configuration'),
    );
    mockListCatalogSkills.mockResolvedValue(skillListing);
    mockGetUserConfig.mockResolvedValue({
      version: 1,
      conversations: { pinnedIds: [] },
      toolsets: { installed: [] },
      deployments: { installed: [], selectedId: null },
      prompts: { installed: [] },
      skills: { installed: [] },
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
      createNotificationContextValue(vi.fn()),
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

  it('renders the plain new-chat screen with no skillId (baseline, no crash)', async () => {
    renderHarness();

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeTruthy();
    });
  });

  it('consumes the routed skillId once and renders without a render-depth error', async () => {
    renderHarness('skills/my-bucket/my-skill');

    /* The real textarea is `aria-hidden` while a mention is tracked (its text
       is painted by the invisible mirror overlay instead — see
       Decision 3 in the multi-skill-message-mentions design), so it is
       queried by placeholder rather than role. */
    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('chat.placeholder') as HTMLTextAreaElement)
          .value,
      ).toBe('/my-skill ');
    });

    /* If the render loop regresses, React throws "Maximum update depth
       exceeded" synchronously during render/commit — surfacing as a thrown
       error from `render`/`waitFor` above rather than reaching this line. */
    expect(
      (screen.getByPlaceholderText('chat.placeholder') as HTMLTextAreaElement)
        .value,
    ).toBe('/my-skill ');
  });
});
