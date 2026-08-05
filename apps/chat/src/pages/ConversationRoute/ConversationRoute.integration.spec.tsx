import { act, render, screen, waitFor } from '@testing-library/react';
import { ReactNode, useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../context/auth/UserContext';
import {
  DeploymentsProvider,
  useDeployments,
} from '../../context/DeploymentsContext';
import * as NotificationContextModule from '../../context/NotificationContext';
import * as ToolsMenuModule from '../../hooks/conversation/useToolsMenu';
import * as KeyboardShortcutModule from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import * as applicationSchemasApi from '../../server-api/application-schemas';
import * as conversationsApi from '../../server-api/conversations.api';
import * as deploymentConfigurationApi from '../../server-api/deployments';
import * as deploymentsApi from '../../server-api/deployments.api';
import * as filesApi from '../../server-api/files.api';
import * as toolsetsApi from '../../server-api/toolsets';
import { AuthStatus } from '../../types/auth-status';
import * as attachmentToDtoModule from '../../utils/attachment-to-dto';
import ConversationRoute from './ConversationRoute';

/*
 * Reproduces GitHub issue #8150 Case 3 end to end against the real
 * DeploymentsContext (only the server-api boundary is mocked), instead of
 * mocking useDeployments away as ConversationRoute.spec.tsx does — this is
 * the only way to exercise the actual clobbering bug between
 * restoreSelectedItemId (conversation viewing) and the New Chat screen.
 */

const contextMocks = vi.hoisted(() => ({
  defaultDeploymentId: null as string | null,
  selectedDeploymentId: null as string | null,
  setSelectedDeployment: vi.fn(),
}));

vi.mock('../../hooks/attachment/useOpenAttachmentCanvas', () => ({
  useOpenAttachmentCanvas: () => ({ openAttachmentCanvas: vi.fn() }),
}));
vi.mock(
  '../../components/DeploymentSelector/useDeploymentSelectorOverlay',
  () => ({
    useDeploymentSelectorOverlay: () => ({
      renderOverlay: vi.fn(),
      catalogModal: null,
    }),
  }),
);
vi.mock('../../context/AppConfigContext', () => ({
  default: ({ children }: { children: ReactNode }) => children,
  useAppConfig: () => ({
    status: 'ready',
    features: {},
    config: {
      asrModelId: null,
      transcribeSizeLimitBytes: 5 * 1024 * 1024,
      defaultDeploymentId: contextMocks.defaultDeploymentId,
    },
  }),
  useFeatureFlag: () => false,
}));
vi.mock('../../context/UserConfigContext', () => ({
  useUserConfig: () => ({
    selectedDeploymentId: contextMocks.selectedDeploymentId,
    setSelectedDeployment: contextMocks.setSelectedDeployment,
  }),
}));
vi.mock('../../context/auth/UserContext');
vi.mock('../../context/NotificationContext');
vi.mock('../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: () => undefined,
}));
vi.mock('../../hooks/keyboard-shortcut/useKeyboardShortcutPreference');
vi.mock('../../hooks/useUiFeature', async () => {
  const { DEFAULT_ENABLED_UI_FEATURES } =
    await import('../../constants/ui-features');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useUiFeature: (feature: any) => DEFAULT_ENABLED_UI_FEATURES.has(feature),
  };
});
vi.mock('../../hooks/conversation/useToolsMenu', () => ({
  useToolsMenu: vi.fn(),
}));
vi.mock('../../server-api/deployments.api');
vi.mock('../../server-api/application-schemas');
vi.mock('../../server-api/toolsets');
vi.mock('../../server-api/deployments');
vi.mock('../../server-api/conversations.api');
vi.mock('../../server-api/files.api');
vi.mock('../../utils/attachment-to-dto');
vi.mock('../../utils/build-upload-path', () => ({
  buildUploadPath: vi.fn((fileName: string) => `uploads/${fileName}`),
}));
vi.mock('../../components/StarterButtons/StarterButtons', () => ({
  default: () => <div />,
}));
vi.mock('@epam/ai-dial-conversation-input', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-conversation-input')>();
  return {
    ...actual,
    ConversationInput: ({
      onSend,
      selectedDeploymentId,
    }: {
      onSend?: (msg: string, att: never[]) => Promise<void> | void;
      selectedDeploymentId?: string | null;
    }) => (
      <div>
        <output aria-label="Selected deployment">
          {selectedDeploymentId ?? 'null'}
        </output>
        <button
          type="button"
          onClick={() => {
            Promise.resolve(onSend?.('Hello', [])).catch((_err: unknown) => {
              // intentional: test mock swallows rejection to avoid unhandled promise
            });
          }}
        >
          Send
        </button>
      </div>
    ),
  };
});

const opusDeployment = {
  id: 'opus',
  displayName: 'Opus',
  type: 'model' as const,
};
const whisperDeployment = {
  id: 'whisper',
  displayName: 'Whisper',
  type: 'model' as const,
};

/* Simulates what apps/chat/src/pages/Conversation/Conversation.tsx's
 * loadConversation does when opening an existing conversation: it reflects
 * that conversation's last-used model without persisting the choice. */
const ConversationViewStub = () => {
  const { restoreSelectedItemId } = useDeployments();
  useEffect(() => {
    restoreSelectedItemId(whisperDeployment.id);
  }, [restoreSelectedItemId]);
  return <div>Viewing conversation</div>;
};

const Harness = () => {
  const [view, setView] = useState<'new-chat' | 'conversation'>('new-chat');
  return (
    <>
      <button type="button" onClick={() => setView('conversation')}>
        Open other conversation
      </button>
      <button type="button" onClick={() => setView('new-chat')}>
        New chat
      </button>
      {view === 'conversation' ? (
        <ConversationViewStub />
      ) : (
        <ConversationRoute />
      )}
    </>
  );
};

const renderHarness = () =>
  render(
    <MemoryRouter>
      <DeploymentsProvider>
        <Harness />
      </DeploymentsProvider>
    </MemoryRouter>,
  );

describe('ConversationRoute — new chat model inheritance (issue #8150 Case 3)', () => {
  const mockGetDeployments = vi.mocked(deploymentsApi.getDeployments);
  const mockGetApplicationSchemas = vi.mocked(
    applicationSchemasApi.getApplicationSchemas,
  );
  const mockListToolsets = vi.mocked(toolsetsApi.listToolsets);
  const mockGetDeploymentConfiguration = vi.mocked(
    deploymentConfigurationApi.getDeploymentConfiguration,
  );
  const mockUseUser = vi.mocked(UserContextModule.useUser);
  const mockUseNotification = vi.mocked(
    NotificationContextModule.useNotification,
  );
  const mockUseKeyboardShortcutPreference = vi.mocked(
    KeyboardShortcutModule.useKeyboardShortcutPreference,
  );
  const mockUseToolsMenu = vi.mocked(ToolsMenuModule.useToolsMenu);
  const mockCreateConversation = vi.mocked(conversationsApi.createConversation);
  const mockSaveConversation = vi.mocked(conversationsApi.saveConversation);
  const mockAttachmentsToDtos = vi.mocked(
    attachmentToDtoModule.attachmentsToDtos,
  );
  const mockUploadFile = vi.mocked(filesApi.uploadFile);

  beforeEach(() => {
    vi.clearAllMocks();
    contextMocks.defaultDeploymentId = null;
    contextMocks.selectedDeploymentId = opusDeployment.id;
    contextMocks.setSelectedDeployment.mockResolvedValue(undefined);
    mockGetDeployments.mockResolvedValue({
      deployments: [opusDeployment, whisperDeployment],
    });
    mockGetApplicationSchemas.mockResolvedValue({ schemas: [] });
    mockListToolsets.mockResolvedValue({ data: [] });
    mockGetDeploymentConfiguration.mockRejectedValue(
      new Error('No configuration'),
    );
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
    mockUseNotification.mockReturnValue({
      notifications: [],
      showNotification: vi.fn(),
      dismissNotification: vi.fn(),
    });
    mockUseKeyboardShortcutPreference.mockReturnValue({
      preference: 'enter' as never,
      setPreference: vi.fn(),
    });
    mockUseToolsMenu.mockReturnValue({
      toolsMenuItems: [],
      onToolToggle: vi.fn(),
      toolConfigurationValue: {},
    });
    mockCreateConversation.mockResolvedValue({
      id: 'bucket/path__Hello',
    } as never);
    mockSaveConversation.mockResolvedValue(undefined as never);
    mockAttachmentsToDtos.mockReturnValue(undefined);
    mockUploadFile.mockResolvedValue({ url: 'https://example.com/file.pdf' });
  });

  it('uses the persisted preference for the next new chat instead of a previously viewed conversation model', async () => {
    renderHarness();

    await waitFor(() => {
      expect(screen.getByLabelText('Selected deployment').textContent).toBe(
        opusDeployment.id,
      );
    });

    await act(async () => {
      screen.getByText('Open other conversation').click();
    });
    expect(screen.getByText('Viewing conversation')).toBeTruthy();

    await act(async () => {
      screen.getByText('New chat').click();
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Selected deployment').textContent).toBe(
        opusDeployment.id,
      );
    });

    const sendButton = await screen.findByRole('button', { name: 'Send' });
    await act(async () => {
      sendButton.click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Hello',
        opusDeployment.id,
        undefined,
        undefined,
      );
    });
    expect(mockCreateConversation).not.toHaveBeenCalledWith(
      expect.anything(),
      whisperDeployment.id,
      expect.anything(),
      expect.anything(),
    );
  });
});
