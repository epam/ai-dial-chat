import type { UseConversationHandlersParams } from '@epam/ai-dial-chat-hooks';
import * as chatHooksModule from '@epam/ai-dial-chat-hooks';
import type { Conversation, ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, type ReactNode, useState } from 'react';
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
  state: null as unknown,
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
  isStreaming: false,
  hasConversationReloadError: false,
  batchChunksPerFrame: undefined as boolean | undefined,
  setConversation: undefined as
    | undefined
    | ((update: (prev: Conversation | null) => Conversation | null) => void),
}));

vi.mock('react-router', () => ({
  useNavigate: () => routerMocks.navigate,
  useParams: () => ({ '*': routerMocks.conversationId }),
  useLocation: () => ({
    state: routerMocks.state,
    pathname: `/conversations/${routerMocks.conversationId}`,
    search: '',
  }),
}));

/*
 * The overlay bridge is captured so a test can push host content, and the
 * view records the content revision each instance mounted with.
 */
const overlayContentMocks = vi.hoisted(() => ({
  setOverlayInputContent: undefined as undefined | ((content: string) => void),
  mountedRevisions: [] as number[],
}));

const MockConversationView = ({
  toolsMenuItems = [],
  onToolToggle,
  inputContentRevision,
  topContent,
}: {
  toolsMenuItems?: ToolMenuItem[];
  onToolToggle?: (id: string) => void;
  inputContentRevision?: number;
  topContent?: ReactNode;
}) => {
  useState(() =>
    overlayContentMocks.mountedRevisions.push(inputContentRevision ?? 0),
  );
  return (
    <div>
      conversation-view
      {topContent}
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
  );
};

/* Renders the tool chips so the toggle state is observable by role. */
vi.mock('../../../components/ConversationView/ConversationView', () => ({
  default: (props: Parameters<typeof MockConversationView>[0]) => (
    <MockConversationView {...props} />
  ),
}));
/* Exposes the viewer's conversation callbacks as buttons so tests can fire them. */
vi.mock('../../../components/CustomViewer/CustomViewerFrame', () => ({
  default: ({
    conversationId,
    onConversationCreated,
    onConversationUpdated,
  }: {
    conversationId?: string;
    onConversationCreated?: (id: string) => void;
    onConversationUpdated?: (id: string) => void;
  }) => (
    <div>
      {`custom-viewer:${conversationId}`}
      <button
        type="button"
        onClick={() => onConversationCreated?.('conversations/bucket/New chat')}
      >
        viewer-created
      </button>
      <button
        type="button"
        onClick={() => onConversationUpdated?.(CONVERSATION_ID_FOR_MOCK)}
      >
        viewer-updated
      </button>
    </div>
  ),
}));
const CONVERSATION_ID_FOR_MOCK = 'conversations/bucket/gpt-4o__Hello';
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
  useActiveConversationBridge: (params: {
    setOverlayInputContent: (content: string) => void;
  }) => {
    overlayContentMocks.setOverlayInputContent = params.setOverlayInputContent;
  },
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
        isStreaming: streamMocks.isStreaming,
        hasConversationReloadError: streamMocks.hasConversationReloadError,
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
const markConversationUnread = vi.fn();
const markConversationViewed = vi.fn();
const showNotification = vi.fn();

const notFoundError = { response: { status: 404, json: vi.fn() } };

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.conversationId = CONVERSATION_ID;
  routerMocks.state = null;
  streamMocks.isStreaming = false;
  streamMocks.hasConversationReloadError = false;
  handlersMocks.lastParams = undefined;
  overlayContentMocks.setOverlayInputContent = undefined;
  overlayContentMocks.mountedRevisions = [];

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
    markConversationUnread,
    markConversationViewed,
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

describe('ConversationPage — opening another conversation mid-load', () => {
  const OTHER_ID = 'conversations/bucket/claude__Small';

  /* A load whose response the test releases after the user has moved on. */
  const deferLoad = () => {
    let resolve: (value: unknown) => void = () => undefined;
    let reject: (reason: unknown) => void = () => undefined;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  const makeOther = (): Conversation =>
    ({
      ...makeConversation(),
      id: OTHER_ID,
      name: 'Small',
      model: { id: 'claude' },
      assistantModelId: 'claude',
    }) as Conversation;

  const switchToOther = (rerender: (ui: ReactElement) => void) => {
    routerMocks.conversationId = OTHER_ID;
    rerender(<ConversationPage />);
  };

  it('aborts the superseded request and ignores its late response', async () => {
    const updateConversationTitle = vi.fn();
    mockUseConversations.mockReturnValue({
      ...mockUseConversations(),
      updateConversationTitle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const firstLoad = deferLoad();
    mockGetConversation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockReturnValueOnce(firstLoad.promise as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(makeOther() as any);

    const { rerender } = render(<ConversationPage />);
    switchToOther(rerender);

    await waitFor(() =>
      expect(updateConversationTitle).toHaveBeenCalledWith(OTHER_ID, 'Small'),
    );
    const firstSignal = mockGetConversation.mock.calls[0][1];
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      firstLoad.resolve({
        ...makeConversation(),
        messages: [{ role: 'user', content: 'go', timestamp: 't' }],
      });
    });

    expect(updateConversationTitle).not.toHaveBeenCalledWith(
      CONVERSATION_ID,
      'Hello',
    );
    expect(streamMocks.startStream).not.toHaveBeenCalled();
  });

  it('neither notifies nor navigates away when the superseded request fails', async () => {
    const firstLoad = deferLoad();
    mockGetConversation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockReturnValueOnce(firstLoad.promise as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(makeOther() as any);

    const { rerender } = render(<ConversationPage />);
    switchToOther(rerender);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalledTimes(2));

    await act(async () => {
      firstLoad.reject(notFoundError);
    });

    expect(routerMocks.navigate).not.toHaveBeenCalledWith(ROUTES.Root);
    expect(removeConversationFromList).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe('ConversationPage — conversation start label', () => {
  const STARTED_AT = '2026-09-20T07:15:00.000Z';
  const OTHER_ID = 'conversations/bucket/claude__Small';

  const makeStarted = (id = CONVERSATION_ID): Conversation =>
    ({
      ...makeConversation(),
      id,
      messages: [{ role: 'user', content: 'hi', timestamp: STARTED_AT }],
    }) as Conversation;

  const getStartLabels = () => screen.queryAllByRole('time');

  const openConversation = (
    rerender: (ui: ReactElement) => void,
    id: string,
  ) => {
    routerMocks.conversationId = id;
    rerender(<ConversationPage />);
  };

  beforeEach(() => {
    mockGetConversation.mockImplementation(
      async (path: string) =>
        makeStarted(
          path.includes('claude') ? OTHER_ID : CONVERSATION_ID,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any,
    );
  });

  it('renders exactly one start label for an existing conversation', async () => {
    render(<ConversationPage />);

    await waitFor(() => expect(getStartLabels()).toHaveLength(1));
    expect(getStartLabels()[0].getAttribute('datetime')).toBe(STARTED_AT);
  });

  it('hides the start label for the conversation this page just created', async () => {
    routerMocks.state = { conversation: makeStarted() };
    const { rerender } = render(<ConversationPage />);

    expect(getStartLabels()).toHaveLength(0);

    // The page clears router state right after mount.
    routerMocks.state = null;
    rerender(<ConversationPage />);
    expect(await screen.findByText('conversation-view')).toBeTruthy();

    expect(getStartLabels()).toHaveLength(0);
  });

  it('shows the start label after leaving the just-created conversation and returning', async () => {
    routerMocks.state = { conversation: makeStarted() };
    const { rerender } = render(<ConversationPage />);
    expect(getStartLabels()).toHaveLength(0);

    routerMocks.state = null;
    openConversation(rerender, OTHER_ID);
    openConversation(rerender, CONVERSATION_ID);

    await waitFor(() => expect(getStartLabels()).toHaveLength(1));
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

describe('ConversationPage — read state around a generation', () => {
  const OTHER_ID = 'conversations/bucket/claude__Small';

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: CONVERSATION_ID,
    title: 'Hello',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: false,
    publishedWithMe: false,
    isReadonly: false,
    isScheduledTask: false,
    isUnread: true,
    ...overrides,
  });

  const withRows = (rows: unknown[]) =>
    mockUseConversations.mockReturnValue({
      conversations: rows,
      duplicateConversation: vi.fn(),
      removeConversationFromList,
      updateConversationTitle: vi.fn(),
      bumpConversationActivity,
      markConversationUnread,
      markConversationViewed,
      watchForDisplayNameUpdate: vi.fn(() => () => undefined),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

  const answered = () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    makeConversation() as any;

  it('marks the chat unread locally next to the activity bump when a generation starts', async () => {
    mockGetConversation.mockResolvedValueOnce(answered());

    render(<ConversationPage />);
    await waitFor(() => expect(handlersMocks.lastParams).toBeDefined());

    getHandlerParams().startStream(CONVERSATION_ID, 'hello', 1, 'gpt-4o');

    expect(markConversationUnread).toHaveBeenCalledWith(CONVERSATION_ID);
  });

  it('marks an unread regular chat viewed once it has loaded and nothing is generating', async () => {
    withRows([row()]);
    mockGetConversation.mockResolvedValue(answered());

    render(<ConversationPage />);

    await waitFor(() =>
      expect(markConversationViewed).toHaveBeenCalledExactlyOnceWith(
        CONVERSATION_ID,
      ),
    );
  });

  it('waits for the conversation to load before marking it viewed', async () => {
    withRows([row()]);
    let finishLoad!: (conversation: Conversation) => void;
    mockGetConversation.mockReturnValue(
      new Promise((resolve) => {
        finishLoad = resolve as typeof finishLoad;
      }) as never,
    );

    render(<ConversationPage />);
    await act(async () => undefined);
    expect(markConversationViewed).not.toHaveBeenCalled();

    await act(async () => finishLoad(makeConversation()));

    await waitFor(() => expect(markConversationViewed).toHaveBeenCalledOnce());
  });

  it('does not mark a chat that is already read or a scheduled run', async () => {
    withRows([row({ isUnread: false })]);
    mockGetConversation.mockResolvedValue(answered());
    const { unmount } = render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());
    await act(async () => undefined);
    expect(markConversationViewed).not.toHaveBeenCalled();
    unmount();

    withRows([row({ isScheduledTask: true })]);
    render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalledTimes(2));
    await act(async () => undefined);
    expect(markConversationViewed).not.toHaveBeenCalled();
  });

  it('writes nothing while the chat is streaming, then marks it viewed when the stream ends', async () => {
    withRows([row()]);
    mockGetConversation.mockResolvedValue(answered());
    streamMocks.isStreaming = true;
    const { rerender } = render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());
    await act(async () => undefined);
    expect(markConversationViewed).not.toHaveBeenCalled();

    streamMocks.isStreaming = false;
    rerender(<ConversationPage />);

    await waitFor(() =>
      expect(markConversationViewed).toHaveBeenCalledExactlyOnceWith(
        CONVERSATION_ID,
      ),
    );
  });

  it('keeps an unseen answer unread while its recovery has failed, and marks it viewed after a successful retry', async () => {
    withRows([row()]);
    mockGetConversation.mockResolvedValue(answered());
    streamMocks.hasConversationReloadError = true;
    const { rerender } = render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());
    await act(async () => undefined);
    expect(markConversationViewed).not.toHaveBeenCalled();

    streamMocks.hasConversationReloadError = false;
    rerender(<ConversationPage />);

    await waitFor(() =>
      expect(markConversationViewed).toHaveBeenCalledExactlyOnceWith(
        CONVERSATION_ID,
      ),
    );
  });

  it('does not mark the next chat viewed before its own conversation has loaded', async () => {
    withRows([row({ id: OTHER_ID })]);
    mockGetConversation.mockResolvedValueOnce(answered());
    const { rerender } = render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalledTimes(1));
    await act(async () => undefined);

    /* The route changed, the previous chat is still shown and its fetch is pending. */
    let finishLoad!: (conversation: Conversation) => void;
    mockGetConversation.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoad = resolve as typeof finishLoad;
      }) as never,
    );
    routerMocks.conversationId = OTHER_ID;
    rerender(<ConversationPage />);
    await act(async () => undefined);
    expect(markConversationViewed).not.toHaveBeenCalled();

    await act(async () => finishLoad(makeConversation()));

    await waitFor(() =>
      expect(markConversationViewed).toHaveBeenCalledExactlyOnceWith(OTHER_ID),
    );
  });

  it('does not mark the chat viewed when the user switches to another conversation mid-stream', async () => {
    withRows([row()]);
    mockGetConversation.mockResolvedValue(answered());
    streamMocks.isStreaming = true;
    const { rerender } = render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());

    routerMocks.conversationId = OTHER_ID;
    streamMocks.isStreaming = false;
    rerender(<ConversationPage />);
    await act(async () => undefined);

    expect(markConversationViewed).not.toHaveBeenCalledWith(CONVERSATION_ID);
  });

  it('does not mark the chat viewed when the page is left before the stream ends', async () => {
    withRows([row()]);
    mockGetConversation.mockResolvedValue(answered());
    streamMocks.isStreaming = true;
    const { unmount } = render(<ConversationPage />);
    await waitFor(() => expect(mockGetConversation).toHaveBeenCalled());

    unmount();

    expect(markConversationViewed).not.toHaveBeenCalled();
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

describe('ConversationPage — Custom Viewer', () => {
  const viewerApp = {
    id: 'gpt-4o',
    displayName: 'Explorer',
    type: 'application',
    viewerUrl: 'https://viewer.example.com/',
  };

  beforeEach(() => {
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({
        selectedItemId: 'gpt-4o',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: [viewerApp as any],
      }),
    );
    mockUseConversations.mockReturnValue({
      ...mockUseConversations(),
      refreshConversations: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('renders the viewer instead of the conversation view', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    render(<ConversationPage />);

    expect(
      await screen.findByText(`custom-viewer:${CONVERSATION_ID}`),
    ).toBeTruthy();
    expect(screen.queryByText('conversation-view')).toBeNull();
  });

  it('marks an unread viewer chat viewed once it has loaded', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );
    mockUseConversations.mockReturnValue({
      ...mockUseConversations(),
      conversations: [
        {
          id: CONVERSATION_ID,
          title: 'Hello',
          isPinned: false,
          updatedAt: 0,
          sharedWithMe: false,
          publishedWithMe: false,
          isReadonly: false,
          isScheduledTask: false,
          isUnread: true,
        },
      ],
      markConversationViewed,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<ConversationPage />);

    await screen.findByText(`custom-viewer:${CONVERSATION_ID}`);
    await waitFor(() =>
      expect(markConversationViewed).toHaveBeenCalledExactlyOnceWith(
        CONVERSATION_ID,
      ),
    );
  });

  it('never auto-starts a generation for a viewer conversation', async () => {
    const conversation = makeConversation();
    conversation.messages = [
      { role: 'user', content: 'hi', timestamp: 't' },
    ] as Conversation['messages'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetConversation.mockResolvedValueOnce(conversation as any);

    render(<ConversationPage />);

    await screen.findByText(`custom-viewer:${CONVERSATION_ID}`);
    expect(streamMocks.startStream).not.toHaveBeenCalled();
  });

  it('reloads the open conversation in place when the viewer updates it', async () => {
    mockGetConversation.mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );
    const { refreshConversations } = mockUseConversations();

    render(<ConversationPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'viewer-updated' }),
    );

    await waitFor(() => expect(mockGetConversation).toHaveBeenCalledTimes(2));
    expect(refreshConversations).toHaveBeenCalled();
    expect(screen.getByText(`custom-viewer:${CONVERSATION_ID}`)).toBeTruthy();
  });

  it('refreshes the list and opens a conversation the viewer created', async () => {
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );
    const { refreshConversations } = mockUseConversations();

    render(<ConversationPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'viewer-created' }),
    );

    expect(refreshConversations).toHaveBeenCalledWith([
      'conversations/bucket/New chat',
    ]);
    expect(routerMocks.navigate).toHaveBeenCalledWith(
      expect.stringContaining('/conversations/bucket/New'),
    );
  });

  it('keeps the regular conversation view for a non-viewer model', async () => {
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue(
      createDeploymentsContextValue({ selectedItemId: 'gpt-4o' }),
    );
    mockGetConversation.mockResolvedValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeConversation() as any,
    );

    render(<ConversationPage />);

    expect(await screen.findByText('conversation-view')).toBeTruthy();
  });
});

describe('ConversationPage — overlay input content', () => {
  const OTHER_ID = 'conversations/bucket/claude__Small';

  it('does not hand spent content to the view remounted for another conversation', async () => {
    mockGetConversation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(makeConversation() as any)
      .mockResolvedValueOnce({
        ...makeConversation(),
        id: OTHER_ID,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

    const { rerender } = render(<ConversationPage />);
    await screen.findByText('conversation-view');
    act(() => overlayContentMocks.setOverlayInputContent?.('from host'));

    routerMocks.conversationId = OTHER_ID;
    rerender(<ConversationPage />);

    await waitFor(() =>
      expect(overlayContentMocks.mountedRevisions).toHaveLength(2),
    );
    expect(overlayContentMocks.mountedRevisions[1]).toBe(0);
  });

  it('hands content set while the conversation loads to the view it mounts', async () => {
    let resolveLoad: (value: unknown) => void = () => undefined;
    mockGetConversation.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );

    render(<ConversationPage />);
    act(() => overlayContentMocks.setOverlayInputContent?.('from host'));
    await act(async () => resolveLoad(makeConversation()));

    await screen.findByText('conversation-view');
    expect(overlayContentMocks.mountedRevisions).toEqual([1]);
  });
});
