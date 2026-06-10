import type { Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  SourcesSidebarProvider,
  useSourcesSidebar,
} from '../SourcesSidebarContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SourcesSidebarProvider>{children}</SourcesSidebarProvider>
);

const makeMessages = (): Message[] => [
  {
    id: '1',
    role: MessageRole.User,
    content: 'hello',
    timestamp: new Date().toISOString(),
  },
];

describe('SourcesSidebarContext', () => {
  it('starts closed with empty messages', () => {
    const { result } = renderHook(() => useSourcesSidebar(), { wrapper });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.messages).toEqual([]);
  });

  it('open() opens when closed', () => {
    const { result } = renderHook(() => useSourcesSidebar(), { wrapper });
    act(() => result.current.handleOpen());
    expect(result.current.isOpen).toBe(true);
  });

  it('close() closes when open', () => {
    const { result } = renderHook(() => useSourcesSidebar(), { wrapper });
    act(() => result.current.handleOpen());
    act(() => result.current.handleClose());
    expect(result.current.isOpen).toBe(false);
  });

  it('setMessages updates messages without changing isOpen', () => {
    const { result } = renderHook(() => useSourcesSidebar(), { wrapper });
    const messages = makeMessages();
    act(() => result.current.setMessages(messages));
    expect(result.current.messages).toEqual(messages);
    expect(result.current.isOpen).toBe(false);
  });

  it('setMessages([]) clears messages without changing isOpen', () => {
    const { result } = renderHook(() => useSourcesSidebar(), { wrapper });
    act(() => result.current.handleOpen());
    act(() => result.current.setMessages(makeMessages()));
    act(() => result.current.setMessages([]));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isOpen).toBe(true);
  });

  it('close() also clears messages', () => {
    const { result } = renderHook(() => useSourcesSidebar(), { wrapper });
    act(() => result.current.handleOpen());
    act(() => result.current.setMessages(makeMessages()));
    act(() => result.current.handleClose());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.messages).toEqual([]);
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useSourcesSidebar())).toThrow(
      /SourcesSidebarProvider/,
    );
  });
});
