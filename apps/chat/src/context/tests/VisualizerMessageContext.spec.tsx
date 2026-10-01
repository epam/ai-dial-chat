import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  useVisualizerMessage,
  VisualizerMessageProvider,
} from '../VisualizerMessageContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <VisualizerMessageProvider>{children}</VisualizerMessageProvider>
);

const renderContext = () =>
  renderHook(() => useVisualizerMessage(), { wrapper });

describe('VisualizerMessageContext', () => {
  it('sends through the registered sender', () => {
    const { result } = renderContext();
    const send = vi.fn();

    result.current.registerSender({ conversationId: 'conv-a', send });
    result.current.sendMessage('hello');

    expect(send).toHaveBeenCalledWith('hello');
  });

  it('drops the message when no sender is registered', () => {
    const { result } = renderContext();

    expect(() => result.current.sendMessage('hello')).not.toThrow();
  });

  it('sends when the source conversation matches the registered one', () => {
    const { result } = renderContext();
    const send = vi.fn();

    result.current.registerSender({ conversationId: 'conv-a', send });
    result.current.sendMessage('hello', 'conv-a');

    expect(send).toHaveBeenCalledOnce();
  });

  it('drops the message when the source conversation differs', () => {
    const { result } = renderContext();
    const send = vi.fn();

    result.current.registerSender({ conversationId: 'conv-b', send });
    result.current.sendMessage('hello', 'conv-a');

    expect(send).not.toHaveBeenCalled();
  });

  it('stops sending once the sender is cleared', () => {
    const { result } = renderContext();
    const send = vi.fn();

    result.current.registerSender({ conversationId: 'conv-a', send });
    result.current.registerSender(null);
    result.current.sendMessage('hello');

    expect(send).not.toHaveBeenCalled();
    expect(result.current.getRegisteredConversationId()).toBeUndefined();
  });

  it('reports the registered conversation id', () => {
    const { result } = renderContext();

    result.current.registerSender({ conversationId: 'conv-a', send: vi.fn() });

    expect(result.current.getRegisteredConversationId()).toBe('conv-a');
  });

  it('keeps a stable value across re-renders', () => {
    const { result, rerender } = renderContext();
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useVisualizerMessage())).toThrow(
      'useVisualizerMessage must be used within VisualizerMessageProvider',
    );
  });
});
