import {
  OverlayEventType,
  OverlayRequestType,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStatus } from '../../../types/auth-status';
import {
  OverlayProvider,
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
        result.current.registerActiveConversationBridge({
          getMessages: () => ({ messages: [] }),
          sendMessage,
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
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
        result.current.registerActiveConversationBridge({
          getMessages: () => ({ messages: [] }),
          sendMessage,
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
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
        result.current.registerActiveConversationBridge({
          getMessages: () => ({ messages: [] }),
          sendMessage: vi.fn(),
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
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
        result.current.registerActiveConversationBridge({
          getMessages: () => ({ messages: [] }),
          sendMessage,
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
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
        result.current.registerActiveConversationBridge({
          getMessages: () => ({ messages: [] }),
          sendMessage,
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
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
        result.current.registerActiveConversationBridge({
          getMessages: firstGetMessages,
          sendMessage: vi.fn(),
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
      });
      act(() => {
        result.current.registerActiveConversationBridge({
          getMessages: secondGetMessages,
          sendMessage: vi.fn(),
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
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
        result.current.registerActiveConversationBridge({
          getMessages,
          sendMessage: vi.fn(),
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
      });
      act(() => {
        result.current.registerActiveConversationBridge(null);
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
        result.current.registerActiveConversationBridge({
          getMessages,
          sendMessage: vi.fn(),
          setInputContent: vi.fn(),
          setSystemPrompt: vi.fn(),
          setTemperature: vi.fn(),
        });
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
