import type { UseConversationHandlersParams } from '@epam/ai-dial-chat-hooks';
import * as chatHooksModule from '@epam/ai-dial-chat-hooks';
import type { Conversation } from '@epam/ai-dial-chat-shared';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ConversationsContextModule from '../../../context/ConversationsContext';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import * as NotificationContextModule from '../../../context/NotificationContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as conversationsApi from '../../../server-api/conversations.api';
import { ROUTES } from '../../../types/routes';
import { ConversationPage } from '../Conversation';

const CONVERSATION_ID = 'conversations/bucket/gpt-4o__Hello';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  conversationId: 'conversations/bucket/gpt-4o__Hello',
}));

/*
 * `onConversationDeleted` is the wiring under test, so the handlers hook is
 * replaced by a spy that captures the options the page passes it. Invoking the
 * captured callback is what a real last-message deletion does once the hook has
 * issued the DELETE.
 */
const handlersMocks = vi.hoisted(() => ({
  lastParams: undefined as undefined | Record<string, unknown>,
}));

/* Stable across renders so the sidebar-bump wiring can assert it forwards. */
const streamMocks = vi.hoisted(() => ({ startStream: vi.fn() }));

vi.mock('react-router', () => ({
  useNavigate: () => routerMocks.navigate,
  useParams: () => ({ '*': routerMocks.conversationId }),
  useLocation: () => ({
    state: null,
    pathname: `/conversations/${routerMocks.conversationId}`,
    search: '',
  }),
}));

vi.mock('../../../components/ConversationView/ConversationView', () => ({
  default: () => <div>conversation-view</div>,
}));
vi.mock(
  '../../../components/ConversationView/Rate/NegativeFeedbackModal',
  () => ({
    default: () => null,
  }),
);
vi.mock(
  '../../../components/ScheduledTaskConversationBanner/ScheduledTaskConversationBanner',
  () => ({ default: () => null }),
);

vi.mock('../../../context/ActiveScheduledTaskContext', () => ({
  useActiveScheduledTask: () => ({ status: null }),
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { sub: 'user-1', bucket: 'bucket' } }),
}));
vi.mock('../../../context/ClientChannelContext', () => ({
  useClientChannel: () => ({
    channelId: 'channel-1',
    ensureConnected: vi.fn(),
    waitForChannel: vi.fn(),
  }),
}));
vi.mock('../../../context/ConversationsContext');
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/GenerationContext', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../context/GenerationContext')>();
  return {
    ...actual,
    useGeneration: () => ({
      getGeneration: () => undefined,
      startGeneration: vi.fn(),
      completeGeneration: vi.fn(),
    }),
  };
});
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: () => undefined,
}));
vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({ handleClose: vi.fn(), setMessages: vi.fn() }),
}));

vi.mock('../../../hooks/conversation/useActiveConversationBridge', () => ({
  useActiveConversationBridge: () => undefined,
}));
vi.mock('../../../hooks/conversation/useAudioTranscription', () => ({
  useAudioTranscription: () => ({ isAudioMessageSupported: false }),
}));
vi.mock('../../../hooks/useDeploymentChangeEffect', () => ({
  useDeploymentChangeEffect: () => undefined,
}));

vi.mock('../../../server-api/conversations.api');
vi.mock('../../../server-api/api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../server-api/api-client')>();
  return { ...actual };
});

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    useToolsMenu: () => ({
      toolsMenuItems: [],
      onToolToggle: vi.fn(),
      toolConfigurationValue: {},
      restoreToolConfiguration: vi.fn(),
    }),
    useConversationStream: () => ({
      startStream: streamMocks.startStream,
      handleStop: vi.fn(),
      resumeIfAwaitingGeneration: vi.fn(),
      restoreBufferedGeneration: (_id: string, conversation: Conversation) => ({
        ...conversation,
      }),
      isStreaming: false,
      canStopStreaming: false,
    }),
    useConversationHandlers: vi.fn(),
  };
});

const mockGetConversation = vi.mocked(conversationsApi.getConversation);
const mockUseConversations = vi.mocked(
  ConversationsContextModule.useConversations,
);
const mockUseConversationHandlers = vi.mocked(
  chatHooksModule.useConversationHandlers,
);

const makeConversation = (): Conversation =>
  ({
    id: CONVERSATION_ID,
    folderId: 'conversations/bucket',
    name: 'Hello',
    model: { id: 'gpt-4o' },
    prompt: '',
    temperature: 1,
    messages: [
      { role: 'assistant', content: 'hi', timestamp: 't' },
    ] as Conversation['messages'],
    lastActivityDate: 1000,
    updatedAt: 2000,
    selectedAddons: [],
    assistantModelId: 'gpt-4o',
  }) as Conversation;

const removeConversationFromList = vi.fn();
const bumpConversationActivity = vi.fn();
const showNotification = vi.fn();

const notFoundError = { response: { status: 404, json: vi.fn() } };

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.conversationId = CONVERSATION_ID;
  handlersMocks.lastParams = undefined;

  mockUseConversations.mockReturnValue({
    conversations: [],
    duplicateConversation: vi.fn(),
    removeConversationFromList,
    updateConversationTitle: vi.fn(),
    bumpConversationActivity,
    watchForDisplayNameUpdate: vi.fn(() => () => undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
    createDeploymentsContextValue({ selectedItemId: 'gpt-4o' }),
  );
  vi.mocked(NotificationContextModule.useNotification).mockReturnValue(
    createNotificationContextValue(showNotification),
  );

  mockUseConversationHandlers.mockImplementation((params) => {
    handlersMocks.lastParams = params as unknown as Record<string, unknown>;
    return {
      handleSend: vi.fn(),
      handleUploadAttachment: vi.fn(),
      handleRegenerateMessage: vi.fn(),
      handleDeleteMessage: vi.fn(),
      handleConfirmDelete: vi.fn(),
      handleRateMessage: vi.fn(),
      handleButtonSelect: vi.fn(),
      handleConfirmStarter: vi.fn(),
      handleStartEdit: vi.fn(),
      handleCancelEdit: vi.fn(),
      handleEditMessage: vi.fn(),
      editingMessageIndexes: new Set<number>(),
      pendingDeleteIndex: null,
      setPendingDeleteIndex: vi.fn(),
      pendingStarterContext: null,
      setPendingStarterContext: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });
});

const getHandlerParams = () =>
  handlersMocks.lastParams as unknown as UseConversationHandlersParams;

describe('ConversationPage — a conversation the backend no longer has', () => {
  it('removes the row from the panel when the load fails with not-found', async () => {
    mockGetConversation.mockRejectedValueOnce(notFoundError);

    render(<ConversationPage />);

    await waitFor(() =>
      expect(removeConversationFromList).toHaveBeenCalledWith(CONVERSATION_ID),
    );
    expect(routerMocks.navigate).toHaveBeenCalledWith(ROUTES.Root);
  });

  it('keeps the row when the load fails with anything else', async () => {
    mockGetConversation.mockRejectedValueOnce({
      response: { status: 502, json: vi.fn() },
    });

    render(<ConversationPage />);

    await waitFor(() =>
      expect(routerMocks.navigate).toHaveBeenCalledWith(ROUTES.Root),
    );
    expect(removeConversationFromList).not.toHaveBeenCalled();
  });

  it('leaves the list untouched on a successful load', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    render(<ConversationPage />);

    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());
    expect(removeConversationFromList).not.toHaveBeenCalled();
    expect(routerMocks.navigate).not.toHaveBeenCalledWith(ROUTES.Root);
  });
});

describe('ConversationPage — onConversationDeleted', () => {
  it('drops the conversation from the panel and navigates to root', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    render(<ConversationPage />);
    await waitFor(() => expect(handlersMocks.lastParams).toBeDefined());

    getHandlerParams().onConversationDeleted?.();

    expect(removeConversationFromList).toHaveBeenCalledWith(CONVERSATION_ID);
    expect(routerMocks.navigate).toHaveBeenCalledWith(ROUTES.Root);
  });
});

describe('ConversationPage — sidebar ordering on new activity', () => {
  it('bumps the conversation to the top of the list and forwards the stream start', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    render(<ConversationPage />);
    await waitFor(() => expect(handlersMocks.lastParams).toBeDefined());

    getHandlerParams().startStream(CONVERSATION_ID, 'hello', 1, 'gpt-4o');

    expect(bumpConversationActivity).toHaveBeenCalledWith(CONVERSATION_ID);
    expect(streamMocks.startStream).toHaveBeenCalledWith(
      CONVERSATION_ID,
      'hello',
      1,
      'gpt-4o',
    );
  });
});
