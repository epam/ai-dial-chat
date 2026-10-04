import type { UseConversationHandlersParams } from '@epam/ai-dial-chat-hooks';
import * as chatHooksModule from '@epam/ai-dial-chat-hooks';
import type { Conversation, ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ClientChannelContextModule from '../../../context/ClientChannelContext';
import * as ConversationsContextModule from '../../../context/ConversationsContext';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import * as NotificationContextModule from '../../../context/NotificationContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { CompletionMode } from '../../../server-api/chat-stream.api';
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

/*
 * Stable across renders so the sidebar-bump wiring can assert it forwards.
 * `setConversation` is captured so a test can play a streamed chunk.
 */
const streamMocks = vi.hoisted(() => ({
  startStream: vi.fn(),
  batchChunksPerFrame: undefined as boolean | undefined,
  setConversation: undefined as
    | undefined
    | ((update: (prev: Conversation | null) => Conversation | null) => void),
}));

vi.mock('react-router', () => ({
  useNavigate: () => routerMocks.navigate,
  useParams: () => ({ '*': routerMocks.conversationId }),
  useLocation: () => ({
    state: null,
    pathname: `/conversations/${routerMocks.conversationId}`,
    search: '',
  }),
}));

/* Renders the tool chips so the toggle state is observable by role. */
vi.mock('../../../components/ConversationView/ConversationView', () => ({
  default: ({
    toolsMenuItems = [],
    onToolToggle,
  }: {
    toolsMenuItems?: ToolMenuItem[];
    onToolToggle?: (id: string) => void;
  }) => (
    <div>
      conversation-view
      {toolsMenuItems.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.isSelected}
          onClick={() => onToolToggle?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
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
const clientChannelMocks = vi.hoisted(() => ({
  ensureConnected: vi.fn(),
  waitForChannel: vi.fn(),
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
      startGeneration: vi.fn(),
      completeGeneration: vi.fn(),
    }),
  };
});
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: () => undefined,
}));
const sourcesSidebarMocks = vi.hoisted(() => ({
  handleClose: vi.fn(),
}));

vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({
    handleClose: sourcesSidebarMocks.handleClose,
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
    useConversationStream: (params: {
      state: { setConversation: typeof streamMocks.setConversation };
      batchChunksPerFrame?: boolean;
    }) => {
      streamMocks.setConversation = params.state.setConversation;
      streamMocks.batchChunksPerFrame = params.batchChunksPerFrame;
      return {
        startStream: streamMocks.startStream,
        handleStop: vi.fn(),
        resumeIfAwaitingGeneration: vi.fn(),
        restoreBufferedGeneration: (
          _id: string,
          conversation: Conversation,
        ) => ({
          ...conversation,
        }),
        isStreaming: false,
        canStopStreaming: false,
      };
    },
    useConversationHandlers: vi.fn(),
  };
});

const mockGetConversation = vi.mocked(conversationsApi.getConversation);
const mockUseClientChannel = vi.mocked(
  ClientChannelContextModule.useClientChannel,
);
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

  mockUseClientChannel.mockReturnValue({
    channelId: 'channel-1',
    pendingEvents: [],
    reportEvent: vi.fn(),
    ensureConnected: clientChannelMocks.ensureConnected,
    waitForChannel: clientChannelMocks.waitForChannel,
    notifyGenerationSettled: vi.fn(),
  });

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

  it('passes the loaded name to updateConversationTitle once', async () => {
    const updateConversationTitle = vi.fn();
    mockUseConversations.mockReturnValue({
      ...mockUseConversations(),
      updateConversationTitle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    render(<ConversationPage />);

    await waitFor(() =>
      expect(updateConversationTitle).toHaveBeenCalledWith(
        CONVERSATION_ID,
        'Hello',
      ),
    );
    expect(updateConversationTitle).toHaveBeenCalledOnce();
  });
});

describe('ConversationPage — stream chunk batching', () => {
  it('asks the stream hook to publish chunks once per frame', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    render(<ConversationPage />);

    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());
    expect(streamMocks.batchChunksPerFrame).toBe(true);
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

describe('ConversationPage — leaving the conversations routes', () => {
  it('closes the sources sidebar when the page unmounts', () => {
    const { unmount } = render(<ConversationPage />);

    sourcesSidebarMocks.handleClose.mockClear();
    unmount();

    expect(sourcesSidebarMocks.handleClose).toHaveBeenCalledOnce();
  });
});

describe('ConversationPage — client-channel demand', () => {
  it('opening a conversation and reading it makes zero ensureConnected/waitForChannel calls', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());

    /*
     * Reading an already-answered conversation never starts a completion, so
     * the page must never nudge the client channel on its own — only a
     * completion request (the mocked `useConversationStream.startStream`
     * above) does that, and it is never invoked here.
     */
    expect(clientChannelMocks.ensureConnected).not.toHaveBeenCalled();
    expect(clientChannelMocks.waitForChannel).not.toHaveBeenCalled();
    expect(streamMocks.startStream).not.toHaveBeenCalled();
  });

  it('the automatic first-message start after navigation calls startStream with the continuation mode', async () => {
    const awaitingConversation: Conversation = {
      ...makeConversation(),
      messages: [
        { role: 'user', content: 'hi', timestamp: 't' },
      ] as Conversation['messages'],
    };
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      awaitingConversation as any,
    );

    render(<ConversationPage />);

    await waitFor(() => expect(streamMocks.startStream).toHaveBeenCalledOnce());
    const [, content, , , , , mode] = streamMocks.startStream.mock.calls[0];
    expect(content).toBe('hi');
    expect(mode).toBe(CompletionMode.ContinueLastUser);
  });

  it('lets the automatic first-message start join a generation that is already running', async () => {
    mockGetConversation.mockResolvedValueOnce({
      ...makeConversation(),
      messages: [{ role: 'user', content: 'hi', timestamp: 't' }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<ConversationPage />);

    await waitFor(() => expect(streamMocks.startStream).toHaveBeenCalledOnce());
    expect(streamMocks.startStream).toHaveBeenCalledWith(
      CONVERSATION_ID,
      'hi',
      1,
      expect.any(String),
      undefined,
      expect.any(String),
      CompletionMode.ContinueLastUser,
      { resumeOnConflict: true },
    );
  });

  it('a channelId transition does not re-fetch the conversation or re-enter the loading state', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    const { rerender } = render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalledOnce());

    mockUseClientChannel.mockReturnValue({
      channelId: 'channel-2',
      pendingEvents: [],
      reportEvent: vi.fn(),
      ensureConnected: clientChannelMocks.ensureConnected,
      waitForChannel: clientChannelMocks.waitForChannel,
      notifyGenerationSettled: vi.fn(),
    });
    rerender(<ConversationPage />);

    mockUseClientChannel.mockReturnValue({
      channelId: null,
      pendingEvents: [],
      reportEvent: vi.fn(),
      ensureConnected: clientChannelMocks.ensureConnected,
      waitForChannel: clientChannelMocks.waitForChannel,
      notifyGenerationSettled: vi.fn(),
    });
    rerender(<ConversationPage />);

    expect(mockGetConversation).toHaveBeenCalledOnce();
  });
});

describe('ConversationPage — tool toggle driven by an assistant form_schema', () => {
  type Messages = Conversation['messages'];

  const toolSchema = (value: boolean) => ({
    type: 'object',
    properties: { deep_research: { type: 'boolean', default: value } },
  });

  const userTurn = (configValue?: Record<string, unknown>) => ({
    role: 'user',
    content: 'question',
    timestamp: 't',
    ...(configValue && {
      custom_content: { configuration_value: configValue },
    }),
  });

  const assistantTurn = (content: string, schemaValue?: boolean) => ({
    role: 'assistant',
    content,
    timestamp: 't',
    ...(schemaValue !== undefined && {
      custom_content: { form_schema: toolSchema(schemaValue) },
    }),
  });

  const loadWith = (messages: unknown[]) =>
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...makeConversation(), messages: messages as Messages } as any,
    );

  /* Replaces the last message, as a streamed chunk does. */
  const streamLastMessage = (message: unknown) =>
    act(() => {
      streamMocks.setConversation?.((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages.slice(0, -1), message] as Messages,
            }
          : prev,
      );
    });

  const chip = () => screen.getByRole('button', { name: 'Deep research' });

  beforeEach(() => {
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({
        selectedItemId: 'gpt-4o',
        selectedDeploymentConfiguration: toolSchema(false),
      }),
    );
  });

  it('shows the toggle off on load when the answer after the last question turned it off', async () => {
    loadWith([
      userTurn({ deep_research: true }),
      assistantTurn('report', false),
    ]);

    render(<ConversationPage />);

    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());
    await waitFor(() =>
      expect(chip().getAttribute('aria-pressed')).toBe('false'),
    );
  });

  it("keeps the question's toggle on load when no answer sets it", async () => {
    loadWith([userTurn({ deep_research: true }), assistantTurn('report')]);

    render(<ConversationPage />);

    await waitFor(() =>
      expect(chip().getAttribute('aria-pressed')).toBe('true'),
    );
  });

  it('follows the values an answer streams and sends the last one with the next message', async () => {
    loadWith([userTurn({ deep_research: false }), assistantTurn('')]);
    render(<ConversationPage />);
    await waitFor(() =>
      expect(chip().getAttribute('aria-pressed')).toBe('false'),
    );

    streamLastMessage(assistantTurn('working', true));
    await waitFor(() =>
      expect(chip().getAttribute('aria-pressed')).toBe('true'),
    );

    streamLastMessage(assistantTurn('report', false));
    await waitFor(() =>
      expect(chip().getAttribute('aria-pressed')).toBe('false'),
    );
    expect(getHandlerParams().toolConfigurationValue).toEqual({
      deep_research: false,
    });
  });

  it("keeps the user's re-armed toggle when the same value streams again", async () => {
    loadWith([
      userTurn({ deep_research: true }),
      assistantTurn('report', false),
    ]);
    render(<ConversationPage />);
    await waitFor(() =>
      expect(chip().getAttribute('aria-pressed')).toBe('false'),
    );

    await userEvent.click(chip());
    expect(chip().getAttribute('aria-pressed')).toBe('true');

    streamLastMessage(assistantTurn('report.', false));
    expect(chip().getAttribute('aria-pressed')).toBe('true');
    expect(getHandlerParams().toolConfigurationValue).toEqual({
      deep_research: true,
    });
  });

  it("applies the answer's value once the deployment tools arrive after the load", async () => {
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({ selectedItemId: 'gpt-4o' }),
    );
    loadWith([userTurn(), assistantTurn('working', true)]);
    const { rerender } = render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());

    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({
        selectedItemId: 'gpt-4o',
        selectedDeploymentConfiguration: toolSchema(false),
      }),
    );
    rerender(<ConversationPage />);

    await waitFor(() =>
      expect(chip().getAttribute('aria-pressed')).toBe('true'),
    );
  });
});
