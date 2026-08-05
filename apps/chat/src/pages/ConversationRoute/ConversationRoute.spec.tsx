import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { DeploymentItemDto, DialToolsetDto } from '@epam/chat-api-client';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ReactNode, useEffect, useState, type Context } from 'react';
import { MemoryRouter, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../context/auth/UserContext';
import * as DeploymentsContextModule from '../../context/DeploymentsContext';
import * as NotificationContextModule from '../../context/NotificationContext';
import * as OverlayContextMock from '../../context/overlay/OverlayContext';
import * as ToolsMenuModule from '../../hooks/conversation/useToolsMenu';
import * as KeyboardShortcutModule from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import * as conversationsApi from '../../server-api/conversations.api';
import * as filesApi from '../../server-api/files.api';
import { AuthStatus } from '../../types/auth-status';
import * as attachmentToDtoModule from '../../utils/attachment-to-dto';
import ConversationRoute from './ConversationRoute';

const OverlayTestCtx = (
  OverlayContextMock as unknown as {
    _OverlayTestCtx: Context<
      { notifyConversationLoaded: () => void } | undefined
    >;
  }
)._OverlayTestCtx;

const overlayMocks = vi.hoisted(() => ({
  current: undefined as
    | { notifyConversationLoaded: ReturnType<typeof vi.fn> }
    | undefined,
  notifyConversationLoaded: vi.fn(),
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
    config: { asrModelId: null, transcribeSizeLimitBytes: 5 * 1024 * 1024 },
  }),
  useFeatureFlag: () => false,
}));
vi.mock('../../context/DeploymentsContext');
vi.mock('../../context/auth/UserContext');
vi.mock('../../context/NotificationContext');
vi.mock('../../context/overlay/OverlayContext', async () => {
  const { createContext, useContext } = await import('react');
  const _OverlayTestCtx = createContext<
    { notifyConversationLoaded: () => void } | undefined
  >(undefined);
  return {
    useOptionalOverlay: () => useContext(_OverlayTestCtx),
    _OverlayTestCtx,
  };
});
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
vi.mock('../../server-api/conversations.api');
vi.mock('../../server-api/files.api');
vi.mock('../../utils/attachment-to-dto');
vi.mock('../../utils/build-upload-path', () => ({
  buildUploadPath: vi.fn((fileName: string) => `uploads/${fileName}`),
}));
vi.mock('../../components/StarterButtons/StarterButtons', () => ({
  default: ({
    starters,
    onSelect,
  }: {
    starters: Array<{
      const: number;
      title: string;
      'dial:widgetOptions': {
        populateText: string | null;
        submit: boolean;
        confirmationMessage: string | null;
      };
    }>;
    onSelect: (starter: {
      const: number;
      title: string;
      'dial:widgetOptions': {
        populateText: string | null;
        submit: boolean;
        confirmationMessage: string | null;
      };
    }) => void;
  }) => (
    <div>
      {starters.map((starter) => (
        <button
          key={String(starter.const)}
          type="button"
          onClick={() => onSelect(starter)}
        >
          {starter.title}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@epam/ai-dial-conversation-input', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-conversation-input')>();
  return {
    ...actual,
    ConversationInput: ({
      onSend,
      onUploadAttachment,
      deployments,
      selectedDeploymentId,
      isInputDisabled,
      message,
      sendOnEnter,
    }: {
      onSend?: (msg: string, att: never[]) => Promise<void> | void;
      onUploadAttachment?: (attachment: {
        name: string;
        file: File;
      }) => Promise<string>;
      deployments?: unknown[];
      selectedDeploymentId?: string | null;
      isInputDisabled?: boolean;
      message?: string;
      sendOnEnter?: string;
    }) => (
      <div>
        <output aria-label="Catalog items count">
          {deployments?.length ?? 'none'}
        </output>
        <output aria-label="Selected deployment">
          {selectedDeploymentId ?? 'null'}
        </output>
        <output aria-label="Input disabled">
          {String(isInputDisabled ?? false)}
        </output>
        <output aria-label="Input message">{message ?? ''}</output>
        <output aria-label="Send on enter">{sendOnEnter ?? 'none'}</output>
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
        <button
          type="button"
          onClick={() => {
            Promise.resolve(
              onUploadAttachment?.({
                name: 'file.pdf',
                file: new File(['content'], 'file.pdf', {
                  type: 'application/pdf',
                }),
              }),
            ).catch((_err: unknown) => {
              // intentional: test mock swallows rejection to avoid unhandled promise
            });
          }}
        >
          Upload
        </button>
      </div>
    ),
  };
});

const mockItems = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' as const },
];

const renderRoute = () =>
  render(
    <MemoryRouter>
      <ConversationRoute />
    </MemoryRouter>,
  );

const RouteStateDriver = ({ deploymentId }: { deploymentId: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('.', { replace: true, state: { deploymentId } });
  }, [deploymentId, navigate]);
  return null;
};

const renderRouteWithDeploymentState = (deploymentId: string) =>
  render(
    <MemoryRouter>
      <RouteStateDriver deploymentId={deploymentId} />
      <ConversationRoute />
    </MemoryRouter>,
  );

describe('ConversationRoute', () => {
  const mockUseDeployments = vi.mocked(DeploymentsContextModule.useDeployments);
  const mockUseUser = vi.mocked(UserContextModule.useUser);
  const mockUseKeyboardShortcutPreference = vi.mocked(
    KeyboardShortcutModule.useKeyboardShortcutPreference,
  );
  const mockUseToolsMenu = vi.mocked(ToolsMenuModule.useToolsMenu);
  const mockUseNotification = vi.mocked(
    NotificationContextModule.useNotification,
  );
  const mockCreateConversation = vi.mocked(conversationsApi.createConversation);
  const mockUploadFile = vi.mocked(filesApi.uploadFile);
  const mockAttachmentsToDtos = vi.mocked(
    attachmentToDtoModule.attachmentsToDtos,
  );
  const mockShowNotification = vi.fn();
  const mockRestoreSelectedItemId = vi.fn();
  const mockRestoreDefaultSelection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: mockRestoreSelectedItemId,
      restoreDefaultSelection: mockRestoreDefaultSelection,
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
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
    mockCreateConversation.mockResolvedValue({
      id: 'bucket/path__Hello',
    } as never);
    mockUploadFile.mockResolvedValue({ url: 'https://example.com/file.pdf' });
    mockAttachmentsToDtos.mockReturnValue(undefined);
    mockUseKeyboardShortcutPreference.mockReturnValue({
      preference: SendOnEnter.Enter,
      setPreference: vi.fn(),
    });
    mockUseToolsMenu.mockReturnValue({
      toolsMenuItems: [],
      onToolToggle: vi.fn(),
      toolConfigurationValue: {},
    });
    mockUseNotification.mockReturnValue({
      notifications: [],
      showNotification: mockShowNotification,
      dismissNotification: vi.fn(),
    });
  });

  it('passes catalog items and selectedItemId into ConversationInput', async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Catalog items count').textContent).toBe(
        '1',
      );
      expect(screen.getByLabelText('Selected deployment').textContent).toBe(
        'gpt-4o',
      );
    });
  });

  it('restores deploymentId when router state changes while composer stays mounted', async () => {
    const view = renderRouteWithDeploymentState('gpt-4o-mini');

    await waitFor(() => {
      expect(mockRestoreSelectedItemId).toHaveBeenCalledWith('gpt-4o-mini');
    });

    view.rerender(
      <MemoryRouter>
        <RouteStateDriver deploymentId="gpt-4.1" />
        <ConversationRoute />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockRestoreSelectedItemId).toHaveBeenCalledWith('gpt-4.1');
    });
  });

  it('calls restoreDefaultSelection on mount when there is no router-state deploymentId and no pending overlay model', async () => {
    renderRoute();

    await waitFor(() => {
      expect(mockRestoreDefaultSelection).toHaveBeenCalledOnce();
    });
    expect(mockRestoreSelectedItemId).not.toHaveBeenCalled();
  });

  it('does not call restoreDefaultSelection when mounted with an explicit router-state deploymentId', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/', state: { deploymentId: 'gpt-4o-mini' } },
        ]}
      >
        <ConversationRoute />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockRestoreSelectedItemId).toHaveBeenCalledWith('gpt-4o-mini');
    });
    expect(mockRestoreDefaultSelection).not.toHaveBeenCalled();
  });

  it('does not call restoreDefaultSelection while an overlay pending model selection is awaiting resolution', async () => {
    render(
      <MemoryRouter>
        <OverlayTestCtx.Provider
          value={
            {
              notifyConversationLoaded: overlayMocks.notifyConversationLoaded,
              pendingModelId: 'overlay-model',
            } as never
          }
        >
          <ConversationRoute />
        </OverlayTestCtx.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(overlayMocks.notifyConversationLoaded).toHaveBeenCalledOnce();
    });
    expect(mockRestoreDefaultSelection).not.toHaveBeenCalled();
  });

  it('notifies overlay when overlay context becomes available after initial render', async () => {
    let setOverlay!: (
      v: { notifyConversationLoaded: () => void } | undefined,
    ) => void;
    const OverlayDriver = ({ children }: { children: ReactNode }) => {
      const [overlay, setO] = useState<
        { notifyConversationLoaded: () => void } | undefined
      >(undefined);
      // eslint-disable-next-line react-hooks/globals
      setOverlay = setO;
      return (
        <OverlayTestCtx.Provider value={overlay}>
          {children}
        </OverlayTestCtx.Provider>
      );
    };

    render(
      <MemoryRouter>
        <OverlayDriver>
          <ConversationRoute />
        </OverlayDriver>
      </MemoryRouter>,
    );

    expect(overlayMocks.notifyConversationLoaded).not.toHaveBeenCalled();

    await act(async () => {
      setOverlay({
        notifyConversationLoaded: overlayMocks.notifyConversationLoaded,
      });
    });

    expect(overlayMocks.notifyConversationLoaded).toHaveBeenCalledOnce();
  });

  it('calls apiCreateConversation with selectedItemId when send fires', async () => {
    renderRoute();
    const sendButton = await screen.findByRole('button', { name: 'Send' });

    await act(async () => {
      sendButton.click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Hello',
        'gpt-4o',
        undefined,
        undefined,
      );
    });
  });

  it('shows API validation message in a toast when conversation creation fails', async () => {
    mockCreateConversation.mockRejectedValueOnce({
      response: {
        json: vi.fn().mockResolvedValue({
          message: [
            'deploymentId must contain only supported characters or valid percent-encoded bytes',
          ],
          error: 'Bad Request',
          statusCode: 400,
        }),
      },
    });

    renderRoute();
    const sendButton = await screen.findByRole('button', { name: 'Send' });

    await act(async () => {
      sendButton.click();
    });

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message:
          'deploymentId must contain only supported characters or valid percent-encoded bytes',
      });
    });
  });

  it('uploads attachments through onUploadAttachment before send', async () => {
    renderRoute();
    const uploadButton = await screen.findByRole('button', { name: 'Upload' });

    await act(async () => {
      uploadButton.click();
    });

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(
        'user-bucket',
        'uploads/file.pdf',
        expect.any(File),
      );
    });
  });

  it('does not call apiCreateConversation when selectedItemId is null', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    renderRoute();
    const sendButton = await screen.findByRole('button', { name: 'Send' });

    await act(async () => {
      sendButton.click();
    });

    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it('passes isInputDisabled=true when dial:chatMessageInputDisabled is true', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: {
        isChatMessageInputDisabled: true,
      },
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Input disabled').textContent).toBe('true');
    });
  });

  it('passes isInputDisabled=false when selectedDeploymentConfiguration is null', async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Input disabled').textContent).toBe('false');
    });
  });

  it('passes isInputDisabled=false when dial:chatMessageInputDisabled is absent', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: { type: 'object' },
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Input disabled').textContent).toBe('false');
    });
  });

  it('renders Quick Apps intro text and populates input from non-submit starter', async () => {
    mockUseDeployments.mockReturnValue({
      items: [
        {
          ...mockItems[0],
          conversationStarters: {
            introText: 'Choose how to start',
            autoSubmit: false,
            chatMessageInputDisabled: true,
            starters: [{ title: 'Draft', text: 'Write a draft' }],
          },
        },
      ],
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: function (
        item: DeploymentItemDto | DialToolsetDto,
      ): void {
        throw new Error('Function not implemented.');
      },
    });

    renderRoute();

    expect(await screen.findByText('Choose how to start')).toBeTruthy();
    expect(screen.getByLabelText('Input disabled').textContent).toBe('true');

    await act(async () => {
      screen.getByText('Draft').click();
    });

    expect(screen.getByLabelText('Input message').textContent).toBe(
      'Write a draft',
    );
    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it('uses Quick Apps populate-only behavior even when the deployment configuration mirrors a submit-only schema starter', async () => {
    const selectedDeploymentConfiguration: DeploymentConfigurationSchema = {
      type: 'object',
      isChatMessageInputDisabled: true,
      properties: {
        starter: {
          description: 'Choose how to start',
          oneOf: [
            {
              const: 0,
              title: 'Draft',
              'dial:widgetOptions': {
                populateText: null,
                submit: true,
                confirmationMessage: null,
              },
            },
          ],
        },
      },
    };
    mockUseDeployments.mockReturnValue({
      items: [
        {
          ...mockItems[0],
          conversationStarters: {
            introText: 'Choose how to start',
            autoSubmit: false,
            chatMessageInputDisabled: false,
            starters: [{ title: 'Draft', text: 'Write a draft' }],
          },
        },
      ],
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    renderRoute();

    expect(screen.getByLabelText('Input disabled').textContent).toBe('false');

    await act(async () => {
      screen.getByText('Draft').click();
    });

    expect(screen.getByLabelText('Input message').textContent).toBe(
      'Write a draft',
    );
    expect(screen.getByLabelText('Input disabled').textContent).toBe('false');
    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it('creates a conversation from auto-submit Quick Apps starter without configuration value', async () => {
    mockUseDeployments.mockReturnValue({
      items: [
        {
          ...mockItems[0],
          conversationStarters: {
            autoSubmit: true,
            starters: [{ title: 'Summarize', text: 'Summarize this' }],
          },
        },
      ],
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: function (
        item: DeploymentItemDto | DialToolsetDto,
      ): void {
        throw new Error('Function not implemented.');
      },
    });

    renderRoute();

    await act(async () => {
      screen.getByText('Summarize').click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Summarize this',
        'gpt-4o',
        [],
        undefined,
      );
    });
  });

  it('passes submit starter values as deployment configuration', async () => {
    const selectedDeploymentConfiguration: DeploymentConfigurationSchema = {
      type: 'object',
      properties: {
        starter: {
          oneOf: [
            {
              const: 0,
              title: 'OCR image',
              'dial:widgetOptions': {
                populateText: 'Scan this image',
                submit: true,
                confirmationMessage: null,
              },
            },
          ],
        },
      },
    };
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'deepseek-ocr-2',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    renderRoute();

    await act(async () => {
      screen.getByText('OCR image').click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Scan this image',
        'deepseek-ocr-2',
        [],
        { starter: 0 },
      );
    });
  });

  it('lets tool configuration override submit starter configuration on key conflict', async () => {
    mockUseToolsMenu.mockReturnValue({
      toolsMenuItems: [],
      onToolToggle: vi.fn(),
      toolConfigurationValue: { starter: true },
    });
    const selectedDeploymentConfiguration: DeploymentConfigurationSchema = {
      type: 'object',
      properties: {
        starter: {
          oneOf: [
            {
              const: 0,
              title: 'Starter override',
              'dial:widgetOptions': {
                populateText: 'Run starter',
                submit: true,
                confirmationMessage: null,
              },
            },
          ],
        },
      },
    };
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'deepseek-ocr-2',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    renderRoute();

    await act(async () => {
      screen.getByText('Starter override').click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Run starter',
        'deepseek-ocr-2',
        [],
        { starter: true },
      );
    });
  });

  it('uses each starter own prompt instead of the shared schema description', async () => {
    const selectedDeploymentConfiguration: DeploymentConfigurationSchema = {
      type: 'object',
      properties: {
        starter: {
          description: 'Choose how to start',
          oneOf: [
            {
              const: 0,
              title: 'OCR image',
              'dial:widgetOptions': {
                populateText: 'Scan this image',
                submit: true,
                confirmationMessage: null,
              },
            },
            {
              const: 1,
              title: 'Summarize',
              'dial:widgetOptions': {
                populateText: 'Summarize this document',
                submit: true,
                confirmationMessage: null,
              },
            },
          ],
        },
      },
    };
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'deepseek-ocr-2',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    renderRoute();

    await act(async () => {
      screen.getByText('Summarize').click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Summarize this document',
        'deepseek-ocr-2',
        [],
        { starter: 1 },
      );
    });
  });

  it('keeps display text when submitted starter populateText is null', async () => {
    const selectedDeploymentConfiguration: DeploymentConfigurationSchema = {
      type: 'object',
      properties: {
        button: {
          description: 'Pick a number',
          oneOf: [
            {
              const: 2,
              title: '2',
              'dial:widgetOptions': {
                populateText: null,
                submit: true,
                confirmationMessage: null,
              },
            },
          ],
        },
      },
    };
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'form-example',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });

    renderRoute();

    await act(async () => {
      screen.getByText('2').click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Pick a number',
        'form-example',
        [],
        { button: 2 },
      );
    });
  });

  it('shows API validation message in a toast when submitted starter creation fails', async () => {
    const selectedDeploymentConfiguration: DeploymentConfigurationSchema = {
      type: 'object',
      properties: {
        starter: {
          oneOf: [
            {
              const: 0,
              title: 'OCR image',
              'dial:widgetOptions': {
                populateText: 'Scan this image',
                submit: true,
                confirmationMessage: null,
              },
            },
          ],
        },
      },
    };
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'deepseek-ocr-2',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      restoreDefaultSelection: vi.fn(),
      selectedDeploymentConfiguration,
      isLoading: false,
      error: null,
      schemas: [],
      toolsets: [],
      refetchToolsets: vi.fn(),
      refetchDeployments: vi.fn(),
      mergeSharedItem: vi.fn(),
    });
    mockCreateConversation.mockRejectedValueOnce({
      response: {
        json: vi.fn().mockResolvedValue({
          message: 'Deployment is not available',
          error: 'Bad Request',
          statusCode: 400,
        }),
      },
    });

    renderRoute();

    await act(async () => {
      screen.getByText('OCR image').click();
    });

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message: 'Deployment is not available',
      });
    });
  });

  it('passes sendOnEnter=enter to ConversationInput when preference is Enter', async () => {
    mockUseKeyboardShortcutPreference.mockReturnValue({
      preference: SendOnEnter.Enter,
      setPreference: vi.fn(),
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Send on enter').textContent).toBe(
        SendOnEnter.Enter,
      );
    });
  });

  it('passes sendOnEnter=meta-enter to ConversationInput when preference is MetaEnter', async () => {
    mockUseKeyboardShortcutPreference.mockReturnValue({
      preference: SendOnEnter.MetaEnter,
      setPreference: vi.fn(),
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Send on enter').textContent).toBe(
        SendOnEnter.MetaEnter,
      );
    });
  });

  it('shows exactly one network-error notification when three uploads fail offline simultaneously', async () => {
    renderRoute();
    const uploadButton = await screen.findByRole('button', { name: 'Upload' });

    vi.useFakeTimers();
    mockUploadFile.mockRejectedValue(new Error('Failed to fetch'));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await act(async () => {
      uploadButton.click();
      uploadButton.click();
      uploadButton.click();
    });

    expect(mockShowNotification).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(mockShowNotification).toHaveBeenCalledOnce();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: NotificationVariant.Error }),
    );

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates a text-only conversation when bucket is empty', async () => {
    mockUseUser.mockReturnValue({
      user: {
        sub: 'u1',
        providerId: 'p1',
        claims: {},
        bucket: '',
        isAdmin: false,
      },
      status: AuthStatus.Authenticated,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    renderRoute();
    const sendButton = await screen.findByRole('button', { name: 'Send' });

    await act(async () => {
      sendButton.click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Hello',
        'gpt-4o',
        undefined,
        undefined,
      );
    });
  });
});
