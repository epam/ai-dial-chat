import type { Conversation } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActiveConversationBridge,
  OverlayContextType,
} from '../../../context/overlay/OverlayContext';
import { useOptionalOverlay } from '../../../context/overlay/OverlayContext';
import { saveConversation } from '../../../server-api/conversations.api';
import { useActiveConversationBridge } from '../useActiveConversationBridge';

vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: vi.fn(),
}));
vi.mock('../../../server-api/conversations.api', () => ({
  saveConversation: vi.fn().mockResolvedValue(undefined),
}));

const mockUseOptionalOverlay = vi.mocked(useOptionalOverlay);
const mockSaveConversation = vi.mocked(saveConversation);

const makeConversation = (overrides?: Partial<Conversation>): Conversation =>
  ({
    id: 'bucket/gpt-4o__Hello__uuid',
    prompt: '',
    temperature: 1,
    messages: [
      { role: 'user', content: 'Hi', timestamp: new Date().toISOString() },
    ],
    ...overrides,
  }) as unknown as Conversation;

const makeOverlay = (): OverlayContextType & {
  registerActiveConversationBridge: ReturnType<
    typeof vi.fn<
      (
        bridge: ActiveConversationBridge | null,
        conversationId: string | null,
      ) => void
    >
  >;
} => ({
  registerActiveConversationBridge: vi.fn(),
  registerConversationListBridge: vi.fn(),
  pendingModelId: null,
  authProviderUiModes: undefined,
  clearPendingModelId: vi.fn(),
  notifyConversationLoaded: vi.fn(),
  notifyConversationsUpdated: vi.fn(),
  notifyGenerationStart: vi.fn(),
  notifyGenerationEnd: vi.fn(),
  notifyStopGenerating: vi.fn(),
});

const getRegisteredBridge = (
  overlay: ReturnType<typeof makeOverlay>,
): ActiveConversationBridge => {
  const bridge =
    overlay.registerActiveConversationBridge.mock.calls.at(-1)?.[0];
  if (!bridge) {
    throw new Error('test setup: no bridge was registered');
  }
  return bridge;
};

describe('useActiveConversationBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not register a bridge outside overlay mode', () => {
    mockUseOptionalOverlay.mockReturnValue(undefined);
    const conversation = makeConversation();

    renderHook(() =>
      useActiveConversationBridge({
        conversation,
        conversationId: 'bucket/gpt-4o__Hello__uuid',
        conversationRef: { current: conversation },
        setConversation: vi.fn(),
        handleSend: vi.fn(),
        setOverlayInputContent: vi.fn(),
      }),
    );

    // Nothing to assert on since useOptionalOverlay returned undefined —
    // the absence of a thrown error/registration call is the behavior.
  });

  it('registers a bridge and unregisters it on unmount', () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    const conversation = makeConversation();

    const { unmount } = renderHook(() =>
      useActiveConversationBridge({
        conversation,
        conversationId: 'bucket/gpt-4o__Hello__uuid',
        conversationRef: { current: conversation },
        setConversation: vi.fn(),
        handleSend: vi.fn(),
        setOverlayInputContent: vi.fn(),
      }),
    );

    expect(overlay.registerActiveConversationBridge).toHaveBeenCalledWith(
      expect.objectContaining({
        getMessages: expect.any(Function),
        sendMessage: expect.any(Function),
        setInputContent: expect.any(Function),
        setSystemPrompt: expect.any(Function),
        setTemperature: expect.any(Function),
      }),
      'bucket/gpt-4o__Hello__uuid',
    );

    unmount();
    expect(overlay.registerActiveConversationBridge).toHaveBeenLastCalledWith(
      null,
      null,
    );
  });

  it('getMessages returns the current conversationRef messages', () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    const conversation = makeConversation();
    const conversationRef = { current: conversation };

    renderHook(() =>
      useActiveConversationBridge({
        conversation,
        conversationId: 'bucket/gpt-4o__Hello__uuid',
        conversationRef,
        setConversation: vi.fn(),
        handleSend: vi.fn(),
        setOverlayInputContent: vi.fn(),
      }),
    );

    const bridge = getRegisteredBridge(overlay);
    expect(bridge.getMessages()).toEqual({
      messages: [{ id: '0', role: 'user', content: 'Hi' }],
    });
  });

  it('sendMessage calls handleSend and returns the post-send messages', async () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    const conversation = makeConversation();
    const conversationRef = { current: conversation };
    const handleSend = vi.fn(async () => {
      conversationRef.current = makeConversation({
        messages: [
          ...conversation.messages,
          {
            role: 'assistant' as never,
            content: 'Hi back',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    });

    renderHook(() =>
      useActiveConversationBridge({
        conversation,
        conversationId: 'bucket/gpt-4o__Hello__uuid',
        conversationRef,
        setConversation: vi.fn(),
        handleSend,
        setOverlayInputContent: vi.fn(),
      }),
    );

    const bridge = getRegisteredBridge(overlay);
    const response = await bridge.sendMessage('Hi');

    expect(handleSend).toHaveBeenCalledWith('Hi', []);
    expect(response.messages).toEqual([
      { id: '0', role: 'user', content: 'Hi' },
      { id: '1', role: 'assistant', content: 'Hi back' },
    ]);
  });

  it('setInputContent forwards to setOverlayInputContent', () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    const conversation = makeConversation();
    const setOverlayInputContent = vi.fn();

    renderHook(() =>
      useActiveConversationBridge({
        conversation,
        conversationId: 'bucket/gpt-4o__Hello__uuid',
        conversationRef: { current: conversation },
        setConversation: vi.fn(),
        handleSend: vi.fn(),
        setOverlayInputContent,
      }),
    );

    const bridge = getRegisteredBridge(overlay);
    bridge.setInputContent('draft text');

    expect(setOverlayInputContent).toHaveBeenCalledWith('draft text');
  });

  it('setInputContent forwards empty strings so the input can be cleared', () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    const conversation = makeConversation();
    const setOverlayInputContent = vi.fn();

    renderHook(() =>
      useActiveConversationBridge({
        conversation,
        conversationId: 'bucket/gpt-4o__Hello__uuid',
        conversationRef: { current: conversation },
        setConversation: vi.fn(),
        handleSend: vi.fn(),
        setOverlayInputContent,
      }),
    );

    const bridge = getRegisteredBridge(overlay);
    bridge.setInputContent('');

    expect(setOverlayInputContent).toHaveBeenCalledWith('');
  });

  it('setSystemPrompt persists the new prompt via saveConversation', async () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    const conversation = makeConversation();
    const conversationRef = { current: conversation };
    const setConversation = vi.fn();

    renderHook(() =>
      useActiveConversationBridge({
        conversation,
        conversationId: 'bucket/gpt-4o__Hello__uuid',
        conversationRef,
        setConversation,
        handleSend: vi.fn(),
        setOverlayInputContent: vi.fn(),
      }),
    );

    const bridge = getRegisteredBridge(overlay);
    const response = await bridge.setSystemPrompt('Be concise');

    expect(response).toEqual({ systemPrompt: 'Be concise' });
    expect(conversationRef.current?.prompt).toBe('Be concise');
    expect(setConversation).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Be concise' }),
    );
    expect(mockSaveConversation).toHaveBeenCalledWith(
      'gpt-4o__Hello__uuid',
      expect.objectContaining({ prompt: 'Be concise' }),
    );
  });

  it('setTemperature persists the new temperature via saveConversation', async () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    const conversation = makeConversation();
    const conversationRef = { current: conversation };
    const setConversation = vi.fn();

    renderHook(() =>
      useActiveConversationBridge({
        conversation,
        conversationId: 'bucket/gpt-4o__Hello__uuid',
        conversationRef,
        setConversation,
        handleSend: vi.fn(),
        setOverlayInputContent: vi.fn(),
      }),
    );

    const bridge = getRegisteredBridge(overlay);
    const response = await bridge.setTemperature(0.4);

    expect(response).toEqual({ temperature: 0.4 });
    expect(conversationRef.current?.temperature).toBe(0.4);
    expect(setConversation).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.4 }),
    );
    expect(mockSaveConversation).toHaveBeenCalledWith(
      'gpt-4o__Hello__uuid',
      expect.objectContaining({ temperature: 0.4 }),
    );
  });

  it('re-registers with a fresh bridge when the conversation changes', () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    const conversation = makeConversation();

    const { rerender } = renderHook(
      (props: { conversation: Conversation }) =>
        useActiveConversationBridge({
          conversation: props.conversation,
          conversationId: 'bucket/gpt-4o__Hello__uuid',
          conversationRef: { current: props.conversation },
          setConversation: vi.fn(),
          handleSend: vi.fn(),
          setOverlayInputContent: vi.fn(),
        }),
      { initialProps: { conversation } },
    );

    expect(overlay.registerActiveConversationBridge).toHaveBeenCalledTimes(1);

    const nextConversation = makeConversation({ prompt: 'updated' });
    rerender({ conversation: nextConversation });

    // unregister (null) from cleanup + re-register with the new bridge
    expect(overlay.registerActiveConversationBridge).toHaveBeenCalledTimes(3);
    expect(overlay.registerActiveConversationBridge).toHaveBeenLastCalledWith(
      expect.objectContaining({ getMessages: expect.any(Function) }),
      'bucket/gpt-4o__Hello__uuid',
    );
  });
});
