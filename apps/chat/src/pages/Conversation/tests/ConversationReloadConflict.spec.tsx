import * as chatHooksModule from '@epam/ai-dial-chat-hooks';
import { GenerationConflictError } from '@epam/ai-dial-chat-hooks';
import { type Conversation, MessageRole } from '@epam/ai-dial-chat-shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ClientChannelContextModule from '../../../context/ClientChannelContext';
import { ConversationDataSourceProvider } from '../../../context/ConversationDataSourceContext';
import * as ConversationsContextModule from '../../../context/ConversationsContext';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import * as NotificationContextModule from '../../../context/NotificationContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import * as chatStreamApi from '../../../server-api/chat-stream.api';
import * as conversationsApi from '../../../server-api/conversations.api';
import { ConversationPage } from '../Conversation';

/*
 * End-to-end regression for a reload in the pre-start window of a new
 * conversation's first answer: the page auto-starts the turn, the backend —
 * still generating it — rejects that start with 409, and the real
 * `useConversationStream` must join the running generation and end on its
 * saved answer. Only the network edge (`server-api`) is faked.
 */

const CONVERSATION_ID = 'conversations/bucket/gpt-4o__Hello';
const CONFLICT_TEXT = 'Another generation is in progress';

const routeState = vi.hoisted(() => ({
  conversationId: 'conversations/bucket/gpt-4o__Hello',
  state: null as unknown,
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ '*': routeState.conversationId }),
  useLocation: () => ({
    state: routeState.state,
    pathname: `/conversations/${routeState.conversationId}`,
    search: '',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'chat.generationConflict' ? CONFLICT_TEXT : key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

/* Renders each message's text so the outcome is observable by content. */
vi.mock('../../../components/ConversationView/ConversationView', () => ({
  default: ({
    conversation,
    isAssistantTyping,
  }: {
    conversation: Conversation | null;
    isAssistantTyping?: boolean;
  }) => (
    <div>
      {conversation?.messages.map((message, index) => (
        <p key={index}>
          {message.content}
          {message.streamErrorMessage}
        </p>
      ))}
      {isAssistantTyping && <span role="status">typing</span>}
    </div>
  ),
}));
vi.mock(
  '../../../components/ConversationView/Rate/NegativeFeedbackModal',
  () => ({ default: () => null }),
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
  useClientChannel: vi.fn(),
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
      startGeneration: () => new AbortController(),
      completeGeneration: vi.fn(),
    }),
  };
});
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: () => undefined,
}));
vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({
    handleClose: vi.fn(),
    setMessages: vi.fn(),
    setConversationModelId: vi.fn(),
  }),
}));
vi.mock('../../../hooks/conversation/useActiveConversationBridge', () => ({
  useActiveConversationBridge: () => undefined,
}));
vi.mock('../../../hooks/conversation/useVisualizerMessageSendHandler', () => ({
  useVisualizerMessageSendHandler: () => undefined,
}));
vi.mock('../../../hooks/conversation/useAudioTranscription', () => ({
  useAudioTranscription: () => ({ isAudioMessageSupported: false }),
}));
vi.mock('../../../hooks/useDeploymentChangeEffect', () => ({
  useDeploymentChangeEffect: () => undefined,
}));
vi.mock('../../../server-api/conversations.api');
vi.mock('../../../server-api/chat-stream.api', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../server-api/chat-stream.api')
    >();
  return { ...actual, streamCompletion: vi.fn(), stopCompletion: vi.fn() };
});
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return { ...actual, useConversationHandlers: vi.fn() };
});

const encoder = new TextEncoder();

const conversationWith = (
  messages: Partial<Conversation['messages'][number]>[],
): Conversation =>
  ({
    id: CONVERSATION_ID,
    folderId: 'conversations/bucket',
    name: 'Hello',
    model: { id: 'gpt-4o' },
    prompt: '',
    temperature: 1,
    messages: messages.map((message) => ({ timestamp: 't', ...message })),
    lastActivityDate: 1000,
    updatedAt: 2000,
    selectedAddons: [],
    assistantModelId: 'gpt-4o',
  }) as Conversation;

const userTurn = { role: MessageRole.User, content: 'What is DIAL?' };
const preStart = () => conversationWith([userTurn]);
const placeholder = () =>
  conversationWith([userTurn, { role: MessageRole.Assistant, content: '' }]);
const saved = () =>
  conversationWith([
    userTurn,
    { role: MessageRole.Assistant, content: 'DIAL is a platform.' },
  ]);

const makeAttachStream = () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });
  return {
    stream,
    emit: (event: unknown) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
  };
};

describe('ConversationPage — reload before the first answer saved its start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.conversationId = CONVERSATION_ID;
    routeState.state = null;
    vi.mocked(ClientChannelContextModule.useClientChannel).mockReturnValue({
      channelId: 'channel-1',
      pendingEvents: [],
      reportEvent: vi.fn(),
      ensureConnected: vi.fn(),
      waitForChannel: vi.fn(),
      notifyGenerationSettled: vi.fn(),
    });
    vi.mocked(ConversationsContextModule.useConversations).mockReturnValue({
      conversations: [],
      duplicateConversation: vi.fn(),
      removeConversationFromList: vi.fn(),
      updateConversationTitle: vi.fn(),
      bumpConversationActivity: vi.fn(),
      markConversationUnread: vi.fn(),
      markConversationViewed: vi.fn(),
      watchForDisplayNameUpdate: vi.fn(() => () => undefined),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({ selectedItemId: 'gpt-4o' }),
    );
    vi.mocked(NotificationContextModule.useNotification).mockReturnValue(
      createNotificationContextValue(vi.fn()),
    );
    vi.mocked(chatHooksModule.useConversationHandlers).mockReturnValue({
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
    } as any);
    vi.mocked(chatStreamApi.streamCompletion).mockImplementation(
      (_path, _message, _model, options) => {
        options.onError(new GenerationConflictError());
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the first answer after leaving an existing chat and creating a prefetched chat', async () => {
    vi.mocked(conversationsApi.getConversation).mockResolvedValue(
      saved() as never,
    );
    const { unmount } = render(
      <StrictMode>
        <ConversationPage />
      </StrictMode>,
      { wrapper: ConversationDataSourceProvider },
    );
    await screen.findByText('DIAL is a platform.');
    unmount();
    vi.mocked(conversationsApi.getConversation).mockClear();

    routeState.conversationId = 'conversations/bucket/gpt-4o__New';
    routeState.state = {
      conversation: { ...preStart(), id: routeState.conversationId },
    };
    /* A premature attach cannot see the generation yet; its final read still
       sees only the user message, before the completion saves its start. */
    vi.mocked(conversationsApi.attachToGeneration).mockRejectedValue(
      new Error('not started'),
    );
    vi.mocked(conversationsApi.watchConversation).mockRejectedValue(
      new Error('watch unavailable'),
    );
    let deliverAnswer!: () => void;
    let complete!: () => void;
    let completed = false;
    vi.mocked(chatStreamApi.streamCompletion).mockImplementation(
      (_path, _message, _model, options) => {
        deliverAnswer = () =>
          options.onChunk({
            id: 'reply',
            object: 'chat.completion.chunk',
            choices: [
              {
                index: 0,
                delta: { content: 'New answer' },
                finish_reason: null,
              },
            ],
          });
        complete = () => {
          completed = true;
          return options.onComplete();
        };
      },
    );
    vi.mocked(conversationsApi.getConversation).mockImplementation(
      async () =>
        ({
          ...(completed ? saved() : preStart()),
          id: routeState.conversationId,
          ...(completed
            ? {
                messages: [
                  userTurn,
                  {
                    role: MessageRole.Assistant,
                    content: 'New answer',
                    timestamp: 't',
                  },
                ],
              }
            : {}),
        }) as never,
    );
    const { rerender } = render(
      <StrictMode>
        <ConversationPage />
      </StrictMode>,
      { wrapper: ConversationDataSourceProvider },
    );
    await waitFor(() =>
      expect(chatStreamApi.streamCompletion).toHaveBeenCalledOnce(),
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      deliverAnswer();
    });
    await screen.findByText('New answer');
    expect(conversationsApi.attachToGeneration).not.toHaveBeenCalled();
    expect(conversationsApi.getConversation).not.toHaveBeenCalled();
    routeState.state = null;
    rerender(
      <StrictMode>
        <ConversationPage />
      </StrictMode>,
    );
    await act(async () => {
      await complete();
    });
    expect(await screen.findByText('New answer')).toBeTruthy();
    expect(chatStreamApi.streamCompletion).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(conversationsApi.getConversation).toHaveBeenCalledOnce(),
    );
  });

  it('joins the generation already running and shows its saved answer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const attach = makeAttachStream();
    vi.mocked(conversationsApi.attachToGeneration).mockResolvedValue(
      attach.stream,
    );
    vi.mocked(conversationsApi.getConversation)
      /* The page load after the reload. */
      .mockResolvedValueOnce(preStart() as never)
      /* The conflict handover: still before the start state, then after it. */
      .mockResolvedValueOnce(preStart() as never)
      .mockResolvedValueOnce(placeholder() as never)
      /* The reload once the running generation finished. */
      .mockResolvedValue(saved() as never);

    render(<ConversationPage />, { wrapper: ConversationDataSourceProvider });

    await waitFor(() =>
      expect(chatStreamApi.streamCompletion).toHaveBeenCalledOnce(),
    );
    expect(screen.getByRole('status').textContent).toBe('typing');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await waitFor(() =>
      expect(conversationsApi.attachToGeneration).toHaveBeenCalledOnce(),
    );

    await act(async () => {
      attach.emit({
        type: 'snapshot',
        message: { role: MessageRole.Assistant, content: 'DIAL is' },
      });
    });
    expect(await screen.findByText('DIAL is')).toBeTruthy();
    await act(async () => {
      attach.emit({ type: 'done' });
    });

    expect(await screen.findByText('DIAL is a platform.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getAllByText('What is DIAL?')).toHaveLength(1);
    expect(screen.queryByText(CONFLICT_TEXT)).toBeNull();
    expect(chatStreamApi.streamCompletion).toHaveBeenCalledOnce();
    expect(conversationsApi.saveConversation).not.toHaveBeenCalled();
  });
});
