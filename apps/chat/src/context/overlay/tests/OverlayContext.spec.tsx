import {
  OverlayEventType,
  OverlayRequestType,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStatus } from '../../../types/auth-status';
import { UserConfigStatus } from '../../../types/user-config-status';
import {
  type ConversationListBridge,
  OverlayProvider,
  shouldDeferOverlayModeUntilConfigReady,
  useOptionalOverlay,
  useOverlay,
} from '../OverlayContext';

const mockNavigate = vi.fn();
const mockSetTheme = vi.fn();
let mockAuthStatus = AuthStatus.Authenticated;
let mockOverlayAllowedOrigins: string[] = ['https://partner.example.com'];

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../AppConfigContext', () => ({
  useAppConfig: () => ({
    config: { overlayAllowedOrigins: mockOverlayAllowedOrigins },
  }),
}));

vi.mock('../../auth/UserContext', () => ({
  useUser: () => ({ status: mockAuthStatus }),
}));

vi.mock('../../ThemeContext', () => ({
  useTheme: () => ({ setTheme: mockSetTheme }),
}));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(OverlayProvider, null, children);

const dispatchFromHost = (
  data: unknown,
  origin = 'https://partner.example.com',
) => {
  window.dispatchEvent(
    new MessageEvent('message', { data, source: window.parent, origin }),
  );
};

describe('OverlayContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockAuthStatus = AuthStatus.Authenticated;
    mockOverlayAllowedOrigins = ['https://partner.example.com'];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('useOverlay outside the provider', () => {
    it('throws a descriptive error', () => {
      expect(() => renderHook(() => useOverlay())).toThrow(
        'useOverlay must be used within an OverlayProvider',
      );
    });
  });

  describe('OverlayModeGate config loading', () => {
    it('defers framed rendering until config can decide overlay eligibility', () => {
      expect(
        shouldDeferOverlayModeUntilConfigReady(UserConfigStatus.Loading, true),
      ).toBe(true);
    });

    it('does not defer top-level rendering while config is loading', () => {
      expect(
        shouldDeferOverlayModeUntilConfigReady(UserConfigStatus.Loading, false),
      ).toBe(false);
    });

    it('does not defer framed rendering after config leaves loading', () => {
      expect(
        shouldDeferOverlayModeUntilConfigReady(UserConfigStatus.Ready, true),
      ).toBe(false);
      expect(
        shouldDeferOverlayModeUntilConfigReady(UserConfigStatus.Error, true),
      ).toBe(false);
    });
  });

  describe('handshake', () => {
    it('sends INIT_READY exactly once via window.parent with no known hostDomain', () => {
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      renderHook(() => useOverlay(), { wrapper });

      const initReadyCalls = postMessageSpy.mock.calls.filter(
        ([message]) =>
          (message as { type: string }).type === OverlayEventType.InitReady,
      );
      expect(initReadyCalls).toHaveLength(1);
      expect(initReadyCalls[0][1]).toBe('*');
    });

    it('sends READY once auth status leaves loading', () => {
      mockAuthStatus = AuthStatus.Authenticated;
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      renderHook(() => useOverlay(), { wrapper });

      const readyCalls = postMessageSpy.mock.calls.filter(
        ([message]) =>
          (message as { type: string }).type === OverlayEventType.Ready,
      );
      expect(readyCalls).toHaveLength(1);
    });

    it('flushes READY_TO_INTERACT after hostDomain is established when the page loaded first', async () => {
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const { result } = renderHook(() => useOverlay(), { wrapper });

      act(() => {
        result.current.notifyConversationLoaded();
      });

      expect(
        postMessageSpy.mock.calls.some(
          ([message]) =>
            (message as { type?: string }).type ===
            OverlayEventType.ReadyToInteract,
        ),
      ).toBe(false);

      dispatchFromHost({
        type: OverlayRequestType.SetOverlayOptions,
        requestId: 'req-1',
        payload: { hostDomain: 'https://partner.example.com' },
      });

      await waitFor(() => {
        const selectedConversationLoadedCalls =
          postMessageSpy.mock.calls.filter(
            ([message]) =>
              (message as { type?: string }).type ===
              OverlayEventType.SelectedConversationLoaded,
          );
        const readyToInteractCalls = postMessageSpy.mock.calls.filter(
          ([message]) =>
            (message as { type?: string }).type ===
            OverlayEventType.ReadyToInteract,
        );

        expect(selectedConversationLoadedCalls).toHaveLength(1);
        expect(selectedConversationLoadedCalls[0][1]).toBe(
          'https://partner.example.com',
        );
        expect(readyToInteractCalls).toHaveLength(1);
        expect(readyToInteractCalls[0][1]).toBe('https://partner.example.com');
      });
    });
  });

  describe('SET_OVERLAY_OPTIONS', () => {
    it('rejects an origin outside the allowlist: no theme change, no response', () => {
      mockOverlayAllowedOrigins = ['https://partner.example.com'];
      renderHook(() => useOverlay(), { wrapper });
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost(
        {
          type: OverlayRequestType.SetOverlayOptions,
          requestId: 'req-1',
          payload: { hostDomain: 'https://evil.example.com', theme: 'dark' },
        },
        'https://evil.example.com',
      );

      expect(mockSetTheme).not.toHaveBeenCalled();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('rejects a hostDomain payload that does not match the message origin', () => {
      mockOverlayAllowedOrigins = [
        'https://partner.example.com',
        'https://other.example.com',
      ];
      renderHook(() => useOverlay(), { wrapper });
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost(
        {
          type: OverlayRequestType.SetOverlayOptions,
          requestId: 'req-1',
          payload: {
            hostDomain: 'https://partner.example.com',
            theme: 'dark',
          },
        },
        'https://other.example.com',
      );

      expect(mockSetTheme).not.toHaveBeenCalled();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('applies theme and responds when the origin is allowed', async () => {
      renderHook(() => useOverlay(), { wrapper });
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost({
        type: OverlayRequestType.SetOverlayOptions,
        requestId: 'req-1',
        payload: {
          hostDomain: 'https://partner.example.com',
          theme: 'dark',
        },
      });

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
      await waitFor(() => {
        const responseCalls = postMessageSpy.mock.calls.filter(
          ([message]) =>
            (message as { type: string }).type ===
            `${OverlayRequestType.SetOverlayOptions}/RESPONSE`,
        );
        expect(responseCalls).toHaveLength(1);
        expect(responseCalls[0][1]).toBe('https://partner.example.com');
      });
    });

    it('accepts undefined optional fields in SET_OVERLAY_OPTIONS', async () => {
      renderHook(() => useOverlay(), { wrapper });
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost({
        type: OverlayRequestType.SetOverlayOptions,
        requestId: 'req-undefined-options',
        payload: {
          hostDomain: 'https://partner.example.com',
          theme: undefined,
          modelId: undefined,
          overlayConversationId: undefined,
        },
      });

      expect(mockSetTheme).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('malformed'),
      );
      await waitFor(() => {
        const responseCalls = postMessageSpy.mock.calls.filter(
          ([message]) =>
            (message as { requestId?: string }).requestId ===
            'req-undefined-options',
        );
        expect(responseCalls).toHaveLength(1);
        expect(responseCalls[0][1]).toBe('https://partner.example.com');
      });
    });

    it('navigates to the requested conversation', () => {
      renderHook(() => useOverlay(), { wrapper });

      dispatchFromHost({
        type: OverlayRequestType.SetOverlayOptions,
        requestId: 'req-1',
        payload: {
          hostDomain: 'https://partner.example.com',
          overlayConversationId: 'abc',
        },
      });

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('abc'));
    });
  });

  describe('active-conversation bridge', () => {
    const establishHostDomain = () => {
      dispatchFromHost({
        type: OverlayRequestType.SetOverlayOptions,
        requestId: 'setup',
        payload: { hostDomain: 'https://partner.example.com' },
      });
    };

    it('ignores active-conversation requests before a validated host is established', () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      const sendMessage = vi.fn().mockResolvedValue({ messages: [] });
      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: () => ({ messages: [] }),
            sendMessage,
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost({
        type: OverlayRequestType.SendMessage,
        requestId: 'send-before-host',
        payload: { content: 'hi' },
      });

      expect(sendMessage).not.toHaveBeenCalled();
      expect(
        postMessageSpy.mock.calls.some(
          ([message]) =>
            (message as { requestId?: string }).requestId ===
            'send-before-host',
        ),
      ).toBe(false);
    });

    it('ignores active-conversation requests from an allowed but different origin', () => {
      mockOverlayAllowedOrigins = [
        'https://partner.example.com',
        'https://other.example.com',
      ];
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const sendMessage = vi.fn().mockResolvedValue({ messages: [] });
      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: () => ({ messages: [] }),
            sendMessage,
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost(
        {
          type: OverlayRequestType.SendMessage,
          requestId: 'send-other-origin',
          payload: { content: 'hi' },
        },
        'https://other.example.com',
      );

      expect(sendMessage).not.toHaveBeenCalled();
      expect(
        postMessageSpy.mock.calls.some(
          ([message]) =>
            (message as { requestId?: string }).requestId ===
            'send-other-origin',
        ),
      ).toBe(false);
    });

    it('answers a request once a bridge registers, using the stored hostDomain', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost({
        type: OverlayRequestType.GetMessages,
        requestId: 'get-1',
      });
      expect(postMessageSpy).not.toHaveBeenCalled();

      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: () => ({ messages: [] }),
            sendMessage: vi.fn(),
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });

      await waitFor(() => {
        const responseCalls = postMessageSpy.mock.calls.filter(
          ([message]) =>
            (message as { type: string; requestId?: string }).requestId ===
            'get-1',
        );
        expect(responseCalls).toHaveLength(1);
        expect(
          (responseCalls[0][0] as { payload: { messages: unknown[] } }).payload
            .messages,
        ).toEqual([]);
      });
    });

    it('rejects malformed active-conversation request payloads without responding', () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const sendMessage = vi.fn().mockResolvedValue({ messages: [] });

      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: () => ({ messages: [] }),
            sendMessage,
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });

      expect(() =>
        dispatchFromHost({
          type: OverlayRequestType.SendMessage,
          requestId: 'malformed-send',
        }),
      ).not.toThrow();

      expect(sendMessage).not.toHaveBeenCalled();
      expect(
        postMessageSpy.mock.calls.some(
          ([message]) =>
            (message as { requestId?: string }).requestId === 'malformed-send',
        ),
      ).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('malformed'),
      );
    });

    it('handles rejected bridge calls without sending a false success response', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const sendMessage = vi.fn().mockRejectedValue(new Error('send failed'));

      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: () => ({ messages: [] }),
            sendMessage,
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });

      dispatchFromHost({
        type: OverlayRequestType.SendMessage,
        requestId: 'rejected-send',
        payload: { content: 'hi' },
      });

      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalledWith('hi');
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('failed to execute'),
          expect.any(Error),
        );
      });
      expect(
        postMessageSpy.mock.calls.some(
          ([message]) =>
            (message as { requestId?: string }).requestId === 'rejected-send',
        ),
      ).toBe(false);
    });

    it('answers subsequent requests against a newly-registered bridge, not the previous one', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      const firstGetMessages = vi.fn(() => ({ messages: [] }));
      const secondGetMessages = vi.fn(() => ({
        messages: [{ id: '1', role: 'user', content: 'hi' }],
      }));

      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: firstGetMessages,
            sendMessage: vi.fn(),
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });
      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: secondGetMessages,
            sendMessage: vi.fn(),
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });

      dispatchFromHost({
        type: OverlayRequestType.GetMessages,
        requestId: 'get-2',
      });

      await waitFor(() => {
        expect(secondGetMessages).toHaveBeenCalledOnce();
      });
      expect(firstGetMessages).not.toHaveBeenCalled();
      void postMessageSpy;
    });

    it('leaves a request pending (unregistering) rather than resolving against a stale bridge', () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      const getMessages = vi.fn(() => ({ messages: [] }));
      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages,
            sendMessage: vi.fn(),
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });
      act(() => {
        result.current.registerActiveConversationBridge(null, null);
      });

      dispatchFromHost({
        type: OverlayRequestType.GetMessages,
        requestId: 'get-3',
      });

      expect(getMessages).not.toHaveBeenCalled();
      const responseCalls = postMessageSpy.mock.calls.filter(
        ([message]) =>
          (message as { requestId?: string }).requestId === 'get-3',
      );
      expect(responseCalls).toHaveLength(0);
    });

    it('drops queued bridge requests after their expiresAt passes', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost({
        type: OverlayRequestType.GetMessages,
        requestId: 'expired-get',
        expiresAt: Date.now() + 50,
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(51);
      });

      const getMessages = vi.fn(() => ({ messages: [] }));
      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages,
            sendMessage: vi.fn(),
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'conv-1',
        );
      });

      expect(getMessages).not.toHaveBeenCalled();
      expect(
        postMessageSpy.mock.calls.some(
          ([message]) =>
            (message as { requestId?: string }).requestId === 'expired-get',
        ),
      ).toBe(false);
    });
  });

  describe('conversation-list bridge', () => {
    const establishHostDomain = () => {
      dispatchFromHost({
        type: OverlayRequestType.SetOverlayOptions,
        requestId: 'setup',
        payload: { hostDomain: 'https://partner.example.com' },
      });
    };

    const makeListBridge = (
      overrides?: Partial<{
        getConversations: () => unknown[];
        createConversation: (options: unknown) => Promise<unknown>;
        deleteConversation: (id: string) => Promise<unknown>;
        renameConversation: (id: string, newName: string) => Promise<unknown>;
        selectConversation: (id: string) => Promise<unknown>;
      }>,
    ): ConversationListBridge =>
      ({
        getConversations: vi.fn(() => []),
        createConversation: vi.fn().mockResolvedValue({ conversation: null }),
        deleteConversation: vi.fn().mockResolvedValue({}),
        renameConversation: vi.fn().mockResolvedValue({}),
        selectConversation: vi.fn().mockResolvedValue({}),
        ...overrides,
      }) as ConversationListBridge;

    const responsesFor = (
      postMessageSpy: ReturnType<typeof vi.spyOn>,
      requestId: string,
    ) =>
      (postMessageSpy.mock.calls as Array<[unknown, unknown?]>)
        .map(([message]) => message as { requestId?: string; payload?: never })
        .filter((message) => message.requestId === requestId);

    it('answers GET_CONVERSATIONS once a conversation-list bridge registers', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const bridge = makeListBridge({
        getConversations: vi.fn(() => [{ id: 'conv-1', title: 'One' }]),
      });

      dispatchFromHost({
        type: OverlayRequestType.GetConversations,
        requestId: 'get-conversations-1',
      });
      expect(postMessageSpy).not.toHaveBeenCalled();

      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      await waitFor(() => {
        const responses = responsesFor(postMessageSpy, 'get-conversations-1');
        expect(responses).toHaveLength(1);
        expect(
          (responses[0] as unknown as { payload: { conversations: unknown[] } })
            .payload.conversations,
        ).toEqual([{ id: 'conv-1', title: 'One' }]);
      });
    });

    it('drops a queued conversation-list request once expiresAt passes without a bridge', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

      dispatchFromHost({
        type: OverlayRequestType.DeleteConversation,
        requestId: 'expired-delete',
        payload: { id: 'conv-1' },
        expiresAt: Date.now() + 50,
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(51);
      });

      const bridge = makeListBridge();
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      expect(bridge.deleteConversation).not.toHaveBeenCalled();
      expect(responsesFor(postMessageSpy, 'expired-delete')).toHaveLength(0);
    });

    it('returns an empty array for GET_SELECTED_CONVERSATIONS when no conversation is mounted', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      act(() => {
        result.current.registerConversationListBridge(makeListBridge());
      });

      dispatchFromHost({
        type: OverlayRequestType.GetSelectedConversations,
        requestId: 'get-selected-empty',
      });

      await waitFor(() => {
        const responses = responsesFor(postMessageSpy, 'get-selected-empty');
        expect(responses).toHaveLength(1);
        expect(
          (responses[0] as unknown as { payload: { conversations: unknown[] } })
            .payload.conversations,
        ).toEqual([]);
      });
    });

    it('returns the active conversation for GET_SELECTED_CONVERSATIONS from the list snapshot when id shapes differ', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const bridge = makeListBridge({
        getConversations: vi.fn(() => [
          {
            id: 'conversations/bucket/conv-1',
            title: 'Active conversation',
          },
        ]),
      });
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });
      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: () => ({ messages: [] }),
            sendMessage: vi.fn(),
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'bucket/conv-1',
        );
      });

      dispatchFromHost({
        type: OverlayRequestType.GetSelectedConversations,
        requestId: 'get-selected-one',
      });

      await waitFor(() => {
        const responses = responsesFor(postMessageSpy, 'get-selected-one');
        expect(responses).toHaveLength(1);
        expect(
          (responses[0] as unknown as { payload: { conversations: unknown[] } })
            .payload.conversations,
        ).toEqual([
          {
            id: 'conversations/bucket/conv-1',
            title: 'Active conversation',
          },
        ]);
      });
    });

    it('falls back to a minimal projection for a just-created conversation not yet in the snapshot', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      act(() => {
        result.current.registerConversationListBridge(makeListBridge());
      });
      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: () => ({ messages: [] }),
            sendMessage: vi.fn(),
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'brand-new-conv',
        );
      });

      dispatchFromHost({
        type: OverlayRequestType.GetSelectedConversations,
        requestId: 'get-selected-fallback',
      });

      await waitFor(() => {
        const responses = responsesFor(postMessageSpy, 'get-selected-fallback');
        expect(responses).toHaveLength(1);
        const { conversations } = (
          responses[0] as unknown as {
            payload: { conversations: { id: string }[] };
          }
        ).payload;
        expect(conversations).toHaveLength(1);
        expect(conversations[0].id).toBe('brand-new-conv');
      });
    });

    it('resolves SELECT_CONVERSATION once the target conversation registers as active when id shapes differ', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const bridge = makeListBridge({
        getConversations: vi.fn(() => [
          {
            id: 'conversations/bucket/conv-1',
            title: 'Selected conversation',
          },
        ]),
      });
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      dispatchFromHost({
        type: OverlayRequestType.SelectConversation,
        requestId: 'select-1',
        payload: { id: 'conversations/bucket/conv-1' },
      });

      await waitFor(() => {
        expect(bridge.selectConversation).toHaveBeenCalledWith(
          'conversations/bucket/conv-1',
        );
      });
      expect(responsesFor(postMessageSpy, 'select-1')).toHaveLength(0);

      act(() => {
        result.current.registerActiveConversationBridge(
          {
            getMessages: () => ({ messages: [] }),
            sendMessage: vi.fn(),
            setInputContent: vi.fn(),
            setSystemPrompt: vi.fn(),
            setTemperature: vi.fn(),
          },
          'bucket/conv-1',
        );
      });

      await waitFor(() => {
        const responses = responsesFor(postMessageSpy, 'select-1');
        expect(responses).toHaveLength(1);
        expect(
          (responses[0] as unknown as { payload: { conversation: unknown } })
            .payload.conversation,
        ).toEqual({
          id: 'conversations/bucket/conv-1',
          title: 'Selected conversation',
        });
      });
    });

    it('drops SELECT_CONVERSATION for an id that never registers as active before expiresAt', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const bridge = makeListBridge();
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      dispatchFromHost({
        type: OverlayRequestType.SelectConversation,
        requestId: 'select-inaccessible',
        payload: { id: 'unknown-conv' },
        expiresAt: Date.now() + 50,
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(51);
      });

      expect(responsesFor(postMessageSpy, 'select-inaccessible')).toHaveLength(
        0,
      );
    });

    it('forwards CREATE_CONVERSATION to the bridge and posts its resolved payload verbatim', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const bridge = makeListBridge({
        createConversation: vi.fn().mockResolvedValue({
          conversation: { id: 'new-conv', title: 'New conversation' },
        }),
      });
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      dispatchFromHost({
        type: OverlayRequestType.CreateConversation,
        requestId: 'create-1',
        payload: { deploymentId: 'gpt-4o', firstMessage: 'Hello' },
      });

      await waitFor(() => {
        expect(bridge.createConversation).toHaveBeenCalledWith({
          deploymentId: 'gpt-4o',
          firstMessage: 'Hello',
        });
        const responses = responsesFor(postMessageSpy, 'create-1');
        expect(responses).toHaveLength(1);
        expect(
          (responses[0] as unknown as { payload: { conversation: unknown } })
            .payload.conversation,
        ).toEqual({ id: 'new-conv', title: 'New conversation' });
      });
    });

    it('forwards CREATE_LOCAL_CONVERSATION to the bridge with an empty options object', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const bridge = makeListBridge();
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      dispatchFromHost({
        type: OverlayRequestType.CreateLocalConversation,
        requestId: 'create-local-1',
      });

      await waitFor(() => {
        expect(bridge.createConversation).toHaveBeenCalledWith({});
      });
    });

    it('forwards DELETE_CONVERSATION and posts the bridge error verbatim', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const bridge = makeListBridge({
        deleteConversation: vi.fn().mockResolvedValue({
          error: { code: 'NOT_FOUND', message: 'no such conversation' },
        }),
      });
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      dispatchFromHost({
        type: OverlayRequestType.DeleteConversation,
        requestId: 'delete-1',
        payload: { id: 'conv-1' },
      });

      await waitFor(() => {
        expect(bridge.deleteConversation).toHaveBeenCalledWith('conv-1');
        const responses = responsesFor(postMessageSpy, 'delete-1');
        expect(responses).toHaveLength(1);
        expect(
          (responses[0] as unknown as { payload: { error: unknown } }).payload
            .error,
        ).toEqual({ code: 'NOT_FOUND', message: 'no such conversation' });
      });
    });

    it('forwards RENAME_CONVERSATION with id and newName', async () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const bridge = makeListBridge({
        renameConversation: vi.fn().mockResolvedValue({
          conversation: { id: 'conv-1', title: 'Renamed' },
        }),
      });
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      dispatchFromHost({
        type: OverlayRequestType.RenameConversation,
        requestId: 'rename-1',
        payload: { id: 'conv-1', newName: 'Renamed' },
      });

      await waitFor(() => {
        expect(bridge.renameConversation).toHaveBeenCalledWith(
          'conv-1',
          'Renamed',
        );
      });
    });

    it('rejects a malformed RENAME_CONVERSATION payload without calling the bridge', () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const bridge = makeListBridge();
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      dispatchFromHost({
        type: OverlayRequestType.RenameConversation,
        requestId: 'rename-malformed',
        payload: { id: 'conv-1' },
      });

      expect(bridge.renameConversation).not.toHaveBeenCalled();
    });

    it('ignores conversation-list requests from an untrusted origin', () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const bridge = makeListBridge();
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });

      dispatchFromHost(
        {
          type: OverlayRequestType.GetConversations,
          requestId: 'get-other-origin',
        },
        'https://other.example.com',
      );

      expect(bridge.getConversations).not.toHaveBeenCalled();
    });

    it('unregisters the bridge and leaves a subsequent request pending', () => {
      const { result } = renderHook(() => useOverlay(), { wrapper });
      establishHostDomain();
      const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
      const bridge = makeListBridge();
      act(() => {
        result.current.registerConversationListBridge(bridge);
      });
      act(() => {
        result.current.registerConversationListBridge(null);
      });

      dispatchFromHost({
        type: OverlayRequestType.GetConversations,
        requestId: 'get-after-unregister',
      });

      expect(bridge.getConversations).not.toHaveBeenCalled();
      expect(responsesFor(postMessageSpy, 'get-after-unregister')).toHaveLength(
        0,
      );
    });
  });

  describe('useOptionalOverlay', () => {
    it('returns undefined outside the provider', () => {
      const { result } = renderHook(() => useOptionalOverlay());
      expect(result.current).toBeUndefined();
    });

    it('returns the context value inside the provider', () => {
      const { result } = renderHook(() => useOptionalOverlay(), { wrapper });
      expect(result.current).toBeDefined();
    });
  });
});
